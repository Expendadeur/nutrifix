// backend/api/routes/employe-inss.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const emailService = require('../emailService');

// ============================================
// CONFIGURATION MULTER
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

// ============================================
// CONSTANTES RÉGLEMENTATION INSS BURUNDI (2026)
// ============================================
const INSS_CONSTANTS = {
  PLAFOND_PENSIONS: 450000,
  PLAFOND_RISQUES_PRO: 80000,
  SMIG: 150000,
  CIVIL: {
    PENSIONS_EMPLOYEUR: 0.06,
    PENSIONS_EMPLOYE: 0.04,
    RISQUES_PRO_EMPLOYEUR: 0.03
  },
  MILITAIRE_POLICE: {
    PENSIONS_EMPLOYEUR: 0.088,
    PENSIONS_EMPLOYE: 0.058,
    RISQUES_PRO_EMPLOYEUR: 0.03,
    INDEMNITES_FORFAITAIRES_TAUX: 2.0
  },
  IPR_BAREME: [
    { min: 0, max: 150000, taux: 0 },
    { min: 150001, max: 300000, taux: 0.20 },
    { min: 300001, max: Infinity, taux: 0.30 }
  ]
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function calculerAssietteCotisations(remuneration, categorie = 'civil') {
  const salaireBase = parseFloat(remuneration.salaire_base) || 0;
  let assietteBase = 0;

  if (categorie === 'militaire_police') {
    const indemnitesForftaitaires = salaireBase * INSS_CONSTANTS.MILITAIRE_POLICE.INDEMNITES_FORFAITAIRES_TAUX;
    assietteBase = salaireBase + indemnitesForftaitaires;
  } else {
    assietteBase = salaireBase +
      (parseFloat(remuneration.indemnites_logement) || 0) +
      (parseFloat(remuneration.indemnites_deplacement) || 0) +
      (parseFloat(remuneration.heures_supplementaires) || 0) +
      (parseFloat(remuneration.primes_diverses) || 0) +
      (parseFloat(remuneration.gratifications) || 0);
  }

  if (assietteBase < INSS_CONSTANTS.SMIG) {
    assietteBase = INSS_CONSTANTS.SMIG;
  }

  const assiettePensions = Math.min(assietteBase, INSS_CONSTANTS.PLAFOND_PENSIONS);
  const assietteRisquesPro = Math.min(assietteBase, INSS_CONSTANTS.PLAFOND_RISQUES_PRO);

  return {
    assiette_brute: Math.round(assietteBase),
    assiette_pensions: Math.round(assiettePensions),
    assiette_risques_pro: Math.round(assietteRisquesPro)
  };
}

function calculerCotisationsINSS(assiettePensions, assietteRisquesPro, categorie = 'civil') {
  const taux = categorie === 'militaire_police'
    ? INSS_CONSTANTS.MILITAIRE_POLICE
    : INSS_CONSTANTS.CIVIL;

  const pensionsEmployeur = assiettePensions * taux.PENSIONS_EMPLOYEUR;
  const pensionsEmploye = assiettePensions * taux.PENSIONS_EMPLOYE;
  const totalPensions = pensionsEmployeur + pensionsEmploye;

  const risquesProEmployeur = assietteRisquesPro * taux.RISQUES_PRO_EMPLOYEUR;

  const totalEmployeur = pensionsEmployeur + risquesProEmployeur;
  const totalEmploye = pensionsEmploye;
  const totalCotisations = totalEmployeur + totalEmploye;

  return {
    pensions_employeur: Math.round(pensionsEmployeur),
    pensions_employe: Math.round(pensionsEmploye),
    pensions_total: Math.round(totalPensions),
    taux_pensions_employeur: taux.PENSIONS_EMPLOYEUR * 100,
    taux_pensions_employe: taux.PENSIONS_EMPLOYE * 100,
    risques_pro_employeur: Math.round(risquesProEmployeur),
    taux_risques_pro: taux.RISQUES_PRO_EMPLOYEUR * 100,
    total_employeur: Math.round(totalEmployeur),
    total_employe: Math.round(totalEmploye),
    total_cotisations: Math.round(totalCotisations)
  };
}

function calculerIPR(salaireBrut) {
  const montant = parseFloat(salaireBrut) || 0;
  const tranche = INSS_CONSTANTS.IPR_BAREME.find(
    t => montant >= t.min && montant <= t.max
  );

  if (!tranche || tranche.taux === 0) {
    return 0;
  }

  const partieImposable = montant - tranche.min + 1;
  const ipr = partieImposable * tranche.taux;

  return Math.round(ipr);
}

async function calculerSoldeConges(userId, connection = db) {
  console.log("\n========================================");
  console.log("🔍 DÉBUT calculerSoldeConges");
  console.log("========================================");

  try {
    // ========================================
    // DEBUG 1 : Paramètres d'entrée
    // ========================================
    console.log("📥 PARAMÈTRES D'ENTRÉE:");
    console.log("  - userId:", userId);
    console.log("  - Type de userId:", typeof userId);
    console.log("  - userId est null?", userId === null);
    console.log("  - userId est undefined?", userId === undefined);
    console.log("  - connection fournie?", connection !== db ? "OUI (transaction)" : "NON (db par défaut)");

    // ========================================
    // DEBUG 2 : Requête SQL
    // ========================================
    const sqlQuery = `SELECT date_embauche, jours_conges_annuels FROM employes WHERE id = ? LIMIT 1`;
    console.log("\n📝 REQUÊTE SQL:");
    console.log("  SQL:", sqlQuery);
    console.log("  Paramètres:", [userId]);

    // ========================================
    // DEBUG 3 : Exécution de la requête
    // ========================================
    console.log("\n⏳ EXÉCUTION DE LA REQUÊTE...");
    const startTime = Date.now();

    const result = await connection.query(sqlQuery, [userId]);

    const executionTime = Date.now() - startTime;
    console.log(`✅ Requête exécutée en ${executionTime}ms`);

    // ========================================
    // DEBUG 4 : Résultat brut
    // ========================================
    console.log("\n📦 RÉSULTAT BRUT DE LA REQUÊTE:");
    console.log("  - Type de result:", typeof result);
    console.log("  - result est un array?", Array.isArray(result));
    console.log("  - Longueur de result:", result?.length);
    console.log("  - result complet:", JSON.stringify(result, null, 2));

    // ========================================
    // DEBUG 5 : Déstructuration
    // ========================================
    console.log("\n🔓 DÉSTRUCTURATION:");
    const [rows] = result;
    console.log("  - Type de rows:", typeof rows);
    console.log("  - rows est un array?", Array.isArray(rows));
    console.log("  - rows existe?", rows !== undefined && rows !== null);
    console.log("  - Longueur de rows:", rows?.length);
    console.log("  - rows complet:", JSON.stringify(rows, null, 2));

    // ========================================
    // DEBUG 6 : Vérification du résultat
    // ========================================
    console.log("\n✔️ VÉRIFICATIONS:");
    console.log("  - !rows?", !rows);
    console.log("  - rows.length === 0?", rows?.length === 0);
    console.log("  - !rows[0]?", !rows?.[0]);

    if (!rows || rows.length === 0 || !rows[0]) {
      console.log("\n⚠️ AUCUN EMPLOYÉ TROUVÉ");
      console.log("  Raison:", !rows ? "rows est falsy" : rows.length === 0 ? "tableau vide" : "rows[0] est undefined");
      return {
        mois_travailles: 0,
        jours_acquis: 0,
        jours_pris: 0,
        jours_en_attente: 0,
        jours_disponibles: 0,
        date_embauche: null
      };
    }

    // ========================================
    // DEBUG 7 : Premier élément
    // ========================================
    console.log("\n👤 DONNÉES EMPLOYÉ (rows[0]):");
    const employe = rows[0];
    console.log("  - Type de employe:", typeof employe);
    console.log("  - employe existe?", employe !== undefined && employe !== null);
    console.log("  - employe complet:", JSON.stringify(employe, null, 2));
    console.log("  - Propriétés de employe:", Object.keys(employe || {}));

    // ========================================
    // DEBUG 8 : Champs spécifiques
    // ========================================
    console.log("\n📅 CHAMPS SPÉCIFIQUES:");
    console.log("  - employe.date_embauche:", employe?.date_embauche);
    console.log("  - Type de date_embauche:", typeof employe?.date_embauche);
    console.log("  - employe.jours_conges_annuels:", employe?.jours_conges_annuels);
    console.log("  - Type de jours_conges_annuels:", typeof employe?.jours_conges_annuels);

    // ========================================
    // DEBUG 9 : Vérification date_embauche
    // ========================================
    if (!employe || !employe.date_embauche) {
      console.log("\n❌ DATE D'EMBAUCHE MANQUANTE OU INVALIDE");
      console.log("  - employe existe?", !!employe);
      console.log("  - date_embauche existe?", !!employe?.date_embauche);
      return {
        mois_travailles: 0,
        jours_acquis: 0,
        jours_pris: 0,
        jours_en_attente: 0,
        jours_disponibles: 0,
        date_embauche: null
      };
    }

    // ========================================
    // DEBUG 10 : Calculs
    // ========================================
    console.log("\n🧮 CALCULS:");
    const dateEmbauche = new Date(employe.date_embauche);
    console.log("  - dateEmbauche (objet Date):", dateEmbauche);
    console.log("  - dateEmbauche valide?", !isNaN(dateEmbauche.getTime()));

    const maintenant = new Date();
    console.log("  - maintenant:", maintenant);

    const moisTravailles = Math.max(0,
      (maintenant.getFullYear() - dateEmbauche.getFullYear()) * 12 +
      (maintenant.getMonth() - dateEmbauche.getMonth())
    );
    console.log("  - moisTravailles:", moisTravailles);

    const joursParAn = employe.jours_conges_annuels || 20;
    console.log("  - joursParAn:", joursParAn);

    const joursAcquis = Math.floor((moisTravailles * joursParAn) / 12);
    console.log("  - joursAcquis:", joursAcquis);

    // ========================================
    // DEBUG 11 : Résultat final
    // ========================================
    const resultat = {
      mois_travailles: moisTravailles,
      jours_acquis: joursAcquis,
      jours_pris: 0,
      jours_en_attente: 0,
      jours_disponibles: joursAcquis,
      date_embauche: employe.date_embauche
    };

    console.log("\n✅ RÉSULTAT FINAL:");
    console.log(JSON.stringify(resultat, null, 2));
    console.log("========================================");
    console.log("🔍 FIN calculerSoldeConges");
    console.log("========================================\n");

    return resultat;

  } catch (error) {
    // ========================================
    // DEBUG 12 : Gestion d'erreur
    // ========================================
    console.log("\n❌❌❌ ERREUR DANS calculerSoldeConges ❌❌❌");
    console.log("  - Message:", error.message);
    console.log("  - Type:", error.constructor.name);
    console.log("  - Code:", error.code);
    console.log("  - Stack complet:");
    console.log(error.stack);
    console.log("========================================\n");

    return {
      mois_travailles: 0,
      jours_acquis: 0,
      jours_pris: 0,
      jours_en_attente: 0,
      jours_disponibles: 0,
      date_embauche: null
    };
  }
}

async function calculerSoldeConges(userId, connection = db) {
  try {
    // ✅ NE PAS déstructurer avec [rows]
    const rows = await connection.query(
      `SELECT date_embauche, jours_conges_annuels FROM employes WHERE id = ? LIMIT 1`,
      [userId]
    );

    // Vérification
    if (!rows || rows.length === 0) {
      console.warn(`⚠️ Aucun employé trouvé pour userId: ${userId}`);
      return {
        mois_travailles: 0,
        jours_acquis: 0,
        jours_pris: 0,
        jours_en_attente: 0,
        jours_disponibles: 0,
        date_embauche: null
      };
    }

    // ✅ Maintenant rows[0] fonctionne
    const employe = rows[0];

    if (!employe || !employe.date_embauche) {
      console.warn(`⚠️ Date d'embauche manquante pour userId: ${userId}`);
      return {
        mois_travailles: 0,
        jours_acquis: 0,
        jours_pris: 0,
        jours_en_attente: 0,
        jours_disponibles: 0,
        date_embauche: null
      };
    }

    const dateEmbauche = new Date(employe.date_embauche);
    const maintenant = new Date();

    const moisTravailles = Math.max(0,
      (maintenant.getFullYear() - dateEmbauche.getFullYear()) * 12 +
      (maintenant.getMonth() - dateEmbauche.getMonth())
    );

    const joursParAn = employe.jours_conges_annuels || 20;
    const joursAcquis = Math.floor((moisTravailles * joursParAn) / 12);

    return {
      mois_travailles: moisTravailles,
      jours_acquis: joursAcquis,
      jours_pris: 0,
      jours_en_attente: 0,
      jours_disponibles: joursAcquis,
      date_embauche: employe.date_embauche
    };
  } catch (error) {
    console.error("❌ Erreur calcul solde congés:", error.message);
    return {
      mois_travailles: 0,
      jours_acquis: 0,
      jours_pris: 0,
      jours_en_attente: 0,
      jours_disponibles: 0,
      date_embauche: null
    };
  }
}

async function getManagersAndAdminsEmails(departementId = null) {
  try {
    let query = `
      SELECT DISTINCT email, nom_complet 
      FROM employes 
      WHERE role IN ('manager', 'admin') 
      AND statut = 'actif'
      AND email IS NOT NULL
    `;
    const params = [];

    if (departementId) {
      query += ' AND (id_departement = ? OR role = "admin")';
      params.push(departementId);
    }

    let managers = await db.query(query, params);
    if (Array.isArray(managers) && managers.length > 0 && Array.isArray(managers[0])) {
      managers = managers[0];
    }
    return managers || [];
  } catch (error) {
    console.error('❌ Erreur récupération managers:', error);
    return [];
  }
}

// ============================================
// ROUTES API
// ============================================

router.get('/dashboard', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Dashboard pour userId:', userId);

    let presencesMois = await db.query(
      `SELECT 
        COUNT(*) as jours_presents,
        COALESCE(SUM(TIMESTAMPDIFF(HOUR, heure_entree, heure_sortie)), 0) as total_heures,
        COALESCE(AVG(TIMESTAMPDIFF(HOUR, heure_entree, heure_sortie)), 0) as moyenne_heures_jour
       FROM presences 
       WHERE id_utilisateur = ? 
       AND MONTH(date) = MONTH(CURRENT_DATE())
       AND YEAR(date) = YEAR(CURRENT_DATE())
       AND heure_sortie IS NOT NULL`,
      [userId]
    );
    if (Array.isArray(presencesMois) && presencesMois.length > 0 && Array.isArray(presencesMois[0])) {
      presencesMois = presencesMois[0];
    }

    const presencesData = presencesMois && presencesMois.length > 0 ? presencesMois[0] : {
      jours_presents: 0,
      total_heures: 0,
      moyenne_heures_jour: 0
    };

    let soldeConges;
    try {
      soldeConges = await calculerSoldeConges(userId);
    } catch (error) {
      console.error('⚠️ Erreur calcul congés:', error);
      soldeConges = {
        mois_travailles: 0,
        jours_acquis: 0,
        jours_pris: 0,
        jours_en_attente: 0,
        jours_disponibles: 0,
        date_embauche: null
      };
    }

    let dernierSalaire = await db.query(
      `SELECT salaire_net, mois, annee, statut_paiement, date_paiement
       FROM salaires 
       WHERE id_utilisateur = ? 
       ORDER BY annee DESC, mois DESC 
       LIMIT 1`,
      [userId]
    );
    if (Array.isArray(dernierSalaire) && dernierSalaire.length > 0 && Array.isArray(dernierSalaire[0])) {
      dernierSalaire = dernierSalaire[0];
    }

    const salaireData = dernierSalaire && dernierSalaire.length > 0 ? {
      salaire_net: parseFloat(dernierSalaire[0].salaire_net) || 0,
      mois: dernierSalaire[0].mois,
      annee: dernierSalaire[0].annee,
      statut: dernierSalaire[0].statut_paiement,
      date_paiement: dernierSalaire[0].date_paiement
    } : null;

    let notifications = await db.query(
      `SELECT COUNT(*) as non_lues 
       FROM notifications 
       WHERE id_utilisateur = ? AND statut = 'non_lu'`,
      [userId]
    );
    if (Array.isArray(notifications) && notifications.length > 0 && Array.isArray(notifications[0])) {
      notifications = notifications[0];
    }

    const notificationsData = notifications && notifications.length > 0 ?
      notifications[0].non_lues : 0;

    let prochainsConges = await db.query(
      `SELECT type_conge, date_debut, date_fin, jours_demandes
       FROM conges 
       WHERE id_utilisateur = ? 
       AND statut = 'approuve' 
       AND date_debut >= CURRENT_DATE()
       ORDER BY date_debut ASC 
       LIMIT 3`,
      [userId]
    );
    if (Array.isArray(prochainsConges) && prochainsConges.length > 0 && Array.isArray(prochainsConges[0])) {
      prochainsConges = prochainsConges[0];
    }

    res.json({
      success: true,
      data: {
        presences_mois: {
          jours_presents: presencesData.jours_presents || 0,
          total_heures: Math.round(presencesData.total_heures) || 0,
          moyenne_heures_jour: parseFloat(presencesData.moyenne_heures_jour || 0).toFixed(1)
        },
        conges: soldeConges,
        dernier_salaire: salaireData,
        notifications_non_lues: notificationsData || 0,
        prochains_conges: prochainsConges || []
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données du dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// ✅ FIX 2: CORRIGER /profil
// ============================================
router.get("/profil", authenticate, authorize(["employe"]), async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        e.id,
        e.matricule,
        e.email,
        e.nom_complet,
        e.telephone,
        e.type_employe,
        e.role,
        e.id_departement,
        d.nom AS departement_nom,
        e.date_embauche,
        e.date_naissance,
        e.adresse,
        e.ville,
        e.pays,
        e.numero_cnss,
        e.salaire_base,
        e.jours_conges_annuels,
        e.compte_bancaire,
        e.nom_banque,
        e.photo_identite,
        e.statut
      FROM employes e
      LEFT JOIN departements d ON d.id = e.id_departement
      WHERE e.id = ?
      LIMIT 1
    `;

    let rows = await db.query(sql, [userId]);
    if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0])) {
      rows = rows[0];
    }

    // ✅ CORRECTION : Vérifier AVANT d'accéder à rows[0]
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profil introuvable"
      });
    }

    const employe = rows[0];

    return res.json({
      success: true,
      data: employe,
    });
  } catch (error) {
    console.error("❌ Erreur récupération profil:", error);
    res.status(500).json({
      success: false,
      message: "Erreur récupération profil"
    });
  }
});

router.put('/profil', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      telephone,
      email,
      adresse,
      ville,
      compte_bancaire,
      nom_banque
    } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    if (telephone && !/^[\d\s\+\-\(\)]+$/.test(telephone)) {
      return res.status(400).json({
        success: false,
        message: 'Format de téléphone invalide'
      });
    }

    await db.query(
      `UPDATE employes SET 
        telephone = ?,
        email = ?,
        adresse = ?,
        ville = ?,
        compte_bancaire = ?,
        nom_banque = ?,
        date_modification = NOW()
       WHERE id = ?`,
      [
        telephone || null,
        email || null,
        adresse || null,
        ville || null,
        compte_bancaire || null,
        nom_banque || null,
        userId
      ]
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/conges/demande',
  authenticate,
  authorize(['employe']),
  upload.single('piece_jointe'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const userId = req.user.id;
      const {
        type_conge,
        date_debut,
        date_fin,
        raison
      } = req.body;

      if (!type_conge || !date_debut || !date_fin || !raison) {
        throw new Error('Tous les champs obligatoires doivent être remplis');
      }

      const dateDebut = new Date(date_debut);
      const dateFin = new Date(date_fin);
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);

      if (dateDebut < aujourdhui) {
        throw new Error('La date de début ne peut pas être dans le passé');
      }

      if (dateFin < dateDebut) {
        throw new Error('La date de fin doit être après la date de début');
      }

      const joursDemandesCalendar = Math.ceil((dateFin - dateDebut) / (1000 * 60 * 60 * 24)) + 1;

      if (type_conge === 'annuel') {
        const solde = await calculerSoldeConges(userId);

        if (joursDemandesCalendar > solde.jours_disponibles) {
          throw new Error(
            `Solde insuffisant. Vous avez ${solde.jours_disponibles} jours disponibles et vous demandez ${joursDemandesCalendar} jours`
          );
        }
      }

      const [chevauchements] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM conges 
         WHERE id_utilisateur = ? 
         AND statut != 'rejete'
         AND (
           (date_debut <= ? AND date_fin >= ?) OR
           (date_debut <= ? AND date_fin >= ?) OR
           (date_debut >= ? AND date_fin <= ?)
         )`,
        [userId, date_debut, date_debut, date_fin, date_fin, date_debut, date_fin]
      );

      if (chevauchements && chevauchements[0] && chevauchements[0].count > 0) {
        throw new Error('Vous avez déjà une demande de congé pour cette période');
      }

      const [result] = await connection.query(
        `INSERT INTO conges (
          id_utilisateur, type_conge, date_debut, date_fin, 
          jours_demandes, raison, pieces_jointes, statut, 
          cree_par, date_creation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, NOW())`,
        [
          userId,
          type_conge,
          date_debut,
          date_fin,
          joursDemandesCalendar,
          raison,
          req.file ? req.file.path : null,
          userId
        ]
      );

      const [employe] = await connection.query(
        'SELECT id_departement, nom_complet, email FROM employes WHERE id = ?',
        [userId]
      );

      if (employe && employe.length > 0) {
        const employeData = employe[0];

        const [managers] = await connection.query(
          `SELECT id, email, nom_complet FROM employes 
           WHERE role IN ('manager', 'admin') 
           AND (id_departement = ? OR role = 'admin')
           AND statut = 'actif'
           AND email IS NOT NULL`,
          [employeData.id_departement]
        );

        for (const manager of managers) {
          await connection.query(
            `INSERT INTO notifications (
              id_utilisateur, type_notification, titre, message,
              priorite, type_reference, id_reference, 
              statut, date_creation
            ) VALUES (?, 'approbation', ?, ?, 'normale', 'conge', ?, 'non_lu', NOW())`,
            [
              manager.id,
              'Nouvelle demande de congé',
              `${employeData.nom_complet} a soumis une demande de congé ${type_conge} du ${date_debut} au ${date_fin}`,
              result.insertId
            ]
          );

          if (manager.email) {
            try {
              await emailService.envoyerNotificationConge(
                manager.email,
                employeData.nom_complet,
                type_conge,
                date_debut,
                date_fin,
                joursDemandesCalendar
              );
              console.log(`✅ Email envoyé au manager ${manager.nom_complet}`);
            } catch (emailError) {
              console.error('⚠️ Erreur envoi email manager:', emailError);
            }
          }
        }

        if (employeData.email) {
          try {
            await emailService.envoyerConfirmationDemandeConge(
              employeData.email,
              employeData.nom_complet,
              type_conge,
              date_debut,
              date_fin,
              joursDemandesCalendar
            );
            console.log('✅ Email de confirmation envoyé à l\'employé');
          } catch (emailError) {
            console.error('⚠️ Erreur envoi email employé:', emailError);
          }
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Demande de congé soumise avec succès. Vos responsables ont été notifiés par email.',
        data: {
          id_conge: result.insertId,
          jours_demandes: joursDemandesCalendar
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('❌ Erreur création demande congé:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la création de la demande de congé'
      });
    } finally {
      connection.release();
    }
  }
);

router.get('/conges', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { statut, annee } = req.query;

    let query = `
      SELECT 
        c.*,
        e.nom_complet as validateur_nom
      FROM conges c
      LEFT JOIN utilisateurs e ON c.valide_par = e.id
      WHERE c.id_utilisateur = ?
    `;
    const params = [userId];

    if (statut && statut !== 'tous') {
      query += ' AND c.statut = ?';
      params.push(statut);
    }

    if (annee) {
      query += ' AND YEAR(c.date_debut) = ?';
      params.push(annee);
    }

    query += ' ORDER BY c.date_creation DESC';

    const conges = await db.query(query, params);

    res.json({
      success: true,
      data: conges || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération congés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des congés',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/conges/solde', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const solde = await calculerSoldeConges(userId);

    res.json({
      success: true,
      data: solde
    });
  } catch (error) {
    console.error('❌ Erreur récupération solde congés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du solde de congés',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/salaires', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { annee } = req.query;

    let query = `
      SELECT 
        s.*,
        MONTH(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01')) as mois_numero
      FROM salaires s
      WHERE s.id_utilisateur = ?
    `;
    const params = [userId];

    if (annee) {
      query += ' AND s.annee = ?';
      params.push(annee);
    }

    query += ' ORDER BY s.annee DESC, s.mois DESC';

    const salaires = await db.query(query, params);

    let statistiques = null;
    if (salaires && salaires.length > 0) {
      const total_brut = salaires.reduce((sum, s) => sum + (parseFloat(s.salaire_brut) || 0), 0);
      const total_net = salaires.reduce((sum, s) => sum + (parseFloat(s.salaire_net) || 0), 0);

      statistiques = {
        nombre_bulletins: salaires.length,
        total_brut: Math.round(total_brut),
        total_net: Math.round(total_net),
        moyenne_brut: Math.round(total_brut / salaires.length),
        moyenne_net: Math.round(total_net / salaires.length)
      };
    }

    res.json({
      success: true,
      data: {
        bulletins: salaires || [],
        statistiques: statistiques
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération salaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des bulletins de salaire',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/salaires/:id', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const salaireId = req.params.id;

    const salaire = await db.query(
      `SELECT 
        s.*, 
        e.nom_complet, 
        e.matricule, 
        e.numero_cnss, 
        d.nom as departement
       FROM salaires s
       JOIN employes e ON s.id_utilisateur = e.id
       LEFT JOIN departements d ON e.id_departement = d.id
       WHERE s.id = ? AND s.id_utilisateur = ?`,
      [salaireId, userId]
    );

    if (!salaire || salaire.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bulletin de salaire non trouvé'
      });
    }

    const salaireData = salaire[0];

    const numericFields = [
      'salaire_brut', 'heures_travaillees', 'heures_supp', 'taux_heure_supp',
      'deduction_inss', 'deduction_impots', 'autres_deductions', 'avances',
      'primes', 'indemnites', 'commissions', 'total_deductions',
      'total_additions', 'salaire_net'
    ];

    numericFields.forEach(field => {
      if (salaireData[field]) {
        salaireData[field] = parseFloat(salaireData[field]);
      }
    });

    res.json({
      success: true,
      data: salaireData
    });
  } catch (error) {
    console.error('❌ Erreur récupération bulletin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du bulletin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/presences', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mois, annee } = req.query;

    let query = `
      SELECT 
        p.*,
        TIMESTAMPDIFF(HOUR, p.heure_entree, p.heure_sortie) as duree_heures,
        CASE 
          WHEN TIME(p.heure_entree) > '08:30:00' THEN 1
          ELSE 0
        END as retard
      FROM presences p
      WHERE p.id_utilisateur = ?
    `;
    const params = [userId];

    if (mois && annee) {
      query += ' AND MONTH(p.date) = ? AND YEAR(p.date) = ?';
      params.push(mois, annee);
    }

    query += ' ORDER BY p.date DESC';

    const presences = await db.query(query, params);

    const presencesData = presences || [];
    const totalHeures = presencesData.reduce((sum, p) => sum + (parseFloat(p.duree_heures) || 0), 0);
    const joursRetard = presencesData.filter(p => p.retard === 1).length;

    res.json({
      success: true,
      data: {
        presences: presencesData,
        statistiques: {
          total_jours: presencesData.length,
          total_heures: Math.round(totalHeures),
          moyenne_heures_jour: presencesData.length > 0 ?
            (totalHeures / presencesData.length).toFixed(1) : 0,
          jours_retard: joursRetard,
          taux_ponctualite: presencesData.length > 0 ?
            (((presencesData.length - joursRetard) / presencesData.length) * 100).toFixed(1) : 100
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération présences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des présences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/pointage/entree', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    const existing = await db.query(
      'SELECT id FROM presences WHERE id_utilisateur = ? AND date = ?',
      [userId, dateAujourdhui]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé aujourd\'hui'
      });
    }

    const localisation = latitude && longitude ? `${latitude},${longitude}` : null;

    await db.query(
      `INSERT INTO presences (
        id_utilisateur, date, heure_entree, localisation_entree, statut
      ) VALUES (?, ?, NOW(), ?, 'present')`,
      [userId, dateAujourdhui, localisation]
    );

    res.json({
      success: true,
      message: 'Pointage d\'entrée enregistré avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur pointage entrée:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du pointage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/pointage/sortie', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    const presence = await db.query(
      'SELECT id, heure_entree, heure_sortie FROM presences WHERE id_utilisateur = ? AND date = ?',
      [userId, dateAujourdhui]
    );

    if (!presence || presence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez d\'abord pointer votre entrée'
      });
    }

    if (presence[0].heure_sortie) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé votre sortie aujourd\'hui'
      });
    }

    const localisation = latitude && longitude ? `${latitude},${longitude}` : null;

    await db.query(
      `UPDATE presences 
       SET heure_sortie = NOW(), 
           localisation_sortie = ?
       WHERE id = ?`,
      [localisation, presence[0].id]
    );

    const updated = await db.query(
      `SELECT TIMESTAMPDIFF(HOUR, heure_entree, heure_sortie) as duree 
       FROM presences WHERE id = ?`,
      [presence[0].id]
    );

    res.json({
      success: true,
      message: 'Pointage de sortie enregistré avec succès',
      duree_travail: updated && updated[0] ? `${updated[0].duree}h` : null
    });
  } catch (error) {
    console.error('❌ Erreur pointage sortie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du pointage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/notifications', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { statut, limit = 20 } = req.query;

    let query = `
      SELECT *
      FROM notifications
      WHERE id_utilisateur = ?
    `;
    const params = [userId];

    if (statut && statut !== 'tous') {
      query += ' AND statut = ?';
      params.push(statut);
    }

    query += ' ORDER BY date_creation DESC LIMIT ?';
    params.push(parseInt(limit));

    const notifications = await db.query(query, params);

    res.json({
      success: true,
      data: notifications || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.put('/notifications/:id/marquer-lu', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    await db.query(
      `UPDATE notifications 
       SET statut = 'lu', date_lecture = NOW()
       WHERE id = ? AND id_utilisateur = ?`,
      [notificationId, userId]
    );

    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });
  } catch (error) {
    console.error('❌ Erreur marquage notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage de la notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/salaires/:id/demander-paiement',
  authenticate,
  authorize(['employe']),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const userId = req.user.id;
      const salaireId = req.params.id;
      const { mois, annee, montant } = req.body;

      const [salaire] = await connection.query(
        `SELECT s.*, e.nom_complet, e.email, e.id_departement 
         FROM salaires s
         JOIN utilisateurs e ON s.id_utilisateur = e.id
         WHERE s.id = ? AND s.id_utilisateur = ?`,
        [salaireId, userId]
      );

      if (!salaire || salaire.length === 0) {
        throw new Error('Salaire non trouvé');
      }

      const salaireData = salaire[0];

      if (salaireData.statut_paiement !== 'calculé') {
        throw new Error('Ce salaire n\'est pas en attente de paiement');
      }

      const [demandeExistante] = await connection.query(
        `SELECT * FROM demandes_paiement_salaire 
         WHERE id_salaire = ? AND statut = 'en_attente'`,
        [salaireId]
      );

      if (demandeExistante && demandeExistante.length > 0) {
        throw new Error('Une demande de paiement est déjà en cours pour ce salaire');
      }

      await connection.query(
        `INSERT INTO demandes_paiement_salaire (
          id_salaire, id_employe, mois, annee, montant,
          statut, date_demande
        ) VALUES (?, ?, ?, ?, ?, 'en_attente', NOW())`,
        [salaireId, userId, mois, annee, montant]
      );

      const [managers] = await connection.query(
        `SELECT id, email, nom_complet FROM employes 
         WHERE role IN ('manager', 'admin') 
         AND (id_departement = ? OR role = 'admin')
         AND statut = 'actif'
         AND email IS NOT NULL`,
        [salaireData.id_departement]
      );

      for (const manager of managers) {
        await connection.query(
          `INSERT INTO notifications (
            id_utilisateur, type_notification, titre, message,
            priorite, type_reference, id_reference, 
            statut, date_creation
          ) VALUES (?, 'approbation', ?, ?, 'haute', 'demande_paiement_salaire', ?, 'non_lu', NOW())`,
          [
            manager.id,
            'Demande de paiement de salaire',
            `${salaireData.nom_complet} demande le paiement de son salaire de ${getMoisNom(mois)} ${annee} - Montant: ${montant.toLocaleString()} FBU`,
            salaireId
          ]
        );

        if (manager.email) {
          try {
            await emailService.envoyerNotificationDemandePaiement(
              manager.email,
              manager.nom_complet,
              salaireData.nom_complet,
              mois,
              annee,
              montant
            );
            console.log(`✅ Email demande paiement envoyé à ${manager.nom_complet}`);
          } catch (emailError) {
            console.error('⚠️ Erreur envoi email manager:', emailError);
          }
        }
      }

      if (salaireData.email) {
        try {
          await emailService.envoyerConfirmationDemandePaiement(
            salaireData.email,
            salaireData.nom_complet,
            mois,
            annee,
            montant
          );
          console.log('✅ Email confirmation demande paiement envoyé à l\'employé');
        } catch (emailError) {
          console.error('⚠️ Erreur envoi email employé:', emailError);
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Demande de paiement envoyée avec succès. Les responsables ont été notifiés par email.'
      });
    } catch (error) {
      await connection.rollback();
      console.error('❌ Erreur demande paiement:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de l\'envoi de la demande'
      });
    } finally {
      connection.release();
    }
  }
);

router.post('/salaires/:id/confirmer-reception',
  authenticate,
  authorize(['employe']),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const userId = req.user.id;
      const salaireId = req.params.id;
      const { code_verification, mois, annee } = req.body;

      const [salaire] = await connection.query(
        `SELECT s.*, e.nom_complet, e.email, e.id_departement 
         FROM salaires s
         JOIN utilisateurs e ON s.id_utilisateur = e.id
         WHERE s.id = ? AND s.id_utilisateur = ?`,
        [salaireId, userId]
      );

      if (!salaire || salaire.length === 0) {
        throw new Error('Salaire non trouvé');
      }

      const salaireData = salaire[0];

      if (salaireData.statut_paiement !== 'payé') {
        throw new Error('Ce salaire n\'a pas encore été payé');
      }

      const [confirmationExistante] = await connection.query(
        `SELECT * FROM confirmations_reception_salaire 
         WHERE id_salaire = ? AND confirme = 1`,
        [salaireId]
      );

      if (confirmationExistante && confirmationExistante.length > 0) {
        throw new Error('La réception de ce salaire a déjà été confirmée');
      }

      let codeAttendu;
      const [codeExistant] = await connection.query(
        `SELECT code_verification, date_expiration 
         FROM codes_verification_salaire 
         WHERE id_salaire = ? AND id_utilisateur = ?
         ORDER BY date_creation DESC LIMIT 1`,
        [salaireId, userId]
      );

      if (codeExistant && codeExistant.length > 0) {
        const dateExpiration = new Date(codeExistant[0].date_expiration);
        const maintenant = new Date();

        if (maintenant > dateExpiration) {
          throw new Error('Le code de vérification a expiré. Veuillez demander un nouveau code.');
        }

        codeAttendu = codeExistant[0].code_verification;
      } else {
        codeAttendu = Math.floor(100000 + Math.random() * 900000).toString();
        const dateExpiration = new Date();
        dateExpiration.setHours(dateExpiration.getHours() + 24);

        await connection.query(
          `INSERT INTO codes_verification_salaire (
            id_salaire, id_utilisateur, code_verification, date_expiration
          ) VALUES (?, ?, ?, ?)`,
          [salaireId, userId, codeAttendu, dateExpiration]
        );

        if (salaireData.email) {
          try {
            await emailService.envoyerCodeVerification(
              salaireData.email,
              codeAttendu,
              salaireData.nom_complet,
              mois,
              annee
            );
            console.log('✅ Code envoyé par email à:', salaireData.email);
          } catch (emailError) {
            console.error('⚠️ Erreur envoi email:', emailError);
          }
        }

        throw new Error(
          process.env.NODE_ENV === 'development'
            ? `Un code de vérification a été envoyé à votre email. Code: ${codeAttendu} (DEV)`
            : 'Un code de vérification a été envoyé à votre email.'
        );
      }

      if (code_verification !== codeAttendu) {
        throw new Error('Code de vérification incorrect');
      }

      await connection.query(
        `INSERT INTO confirmations_reception_salaire (
          id_salaire, id_utilisateur, mois, annee, montant,
          code_verification_utilise, confirme, date_confirmation
        ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [salaireId, userId, mois, annee, salaireData.salaire_net, code_verification]
      );

      await connection.query(
        `UPDATE salaires 
         SET confirme_reception = 1, date_confirmation_reception = NOW()
         WHERE id = ?`,
        [salaireId]
      );

      await connection.query(
        `UPDATE codes_verification_salaire 
         SET utilise = 1, date_utilisation = NOW()
         WHERE id_salaire = ? AND code_verification = ?`,
        [salaireId, code_verification]
      );

      const [managers] = await connection.query(
        `SELECT id, email, nom_complet FROM employes 
         WHERE role IN ('manager', 'admin') 
         AND (id_departement = ? OR role = 'admin')
         AND statut = 'actif'
         AND email IS NOT NULL`,
        [salaireData.id_departement]
      );

      for (const manager of managers) {
        await connection.query(
          `INSERT INTO notifications (
            id_utilisateur, type_notification, titre, message,
            priorite, type_reference, id_reference, 
            statut, date_creation
          ) VALUES (?, 'information', ?, ?, 'normale', 'confirmation_salaire', ?, 'non_lu', NOW())`,
          [
            manager.id,
            'Confirmation de réception de salaire',
            `${salaireData.nom_complet} a confirmé la réception de son salaire de ${getMoisNom(mois)} ${annee}`,
            salaireId
          ]
        );

        if (manager.email) {
          try {
            await emailService.envoyerNotificationConfirmationReception(
              manager.email,
              manager.nom_complet,
              salaireData.nom_complet,
              mois,
              annee,
              parseFloat(salaireData.salaire_net)
            );
            console.log(`✅ Email confirmation envoyé à ${manager.nom_complet}`);
          } catch (emailError) {
            console.error('⚠️ Erreur envoi email manager:', emailError);
          }
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Réception du salaire confirmée avec succès. Les responsables ont été notifiés.'
      });
    } catch (error) {
      await connection.rollback();
      console.error('❌ Erreur confirmation réception:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la confirmation'
      });
    } finally {
      connection.release();
    }
  }
);

router.post('/salaires/:id/demander-code',
  authenticate,
  authorize(['employe']),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const salaireId = req.params.id;

      const salaire = await db.query(
        `SELECT s.*, e.nom_complet, e.email
         FROM salaires s
         JOIN employes e ON s.id_utilisateur = e.id
         WHERE s.id = ? AND s.id_utilisateur = ?`,
        [salaireId, userId]
      );

      if (!salaire || salaire.length === 0) {
        throw new Error('Salaire non trouvé');
      }

      const salaireData = salaire[0];

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const dateExpiration = new Date();
      dateExpiration.setHours(dateExpiration.getHours() + 24);

      await db.query(
        `INSERT INTO codes_verification_salaire (
          id_salaire, id_utilisateur, code_verification, date_expiration
        ) VALUES (?, ?, ?, ?)`,
        [salaireId, userId, code, dateExpiration]
      );

      if (salaireData.email) {
        try {
          await emailService.envoyerCodeVerification(
            salaireData.email,
            code,
            salaireData.nom_complet,
            salaireData.mois,
            salaireData.annee
          );
          console.log('✅ Nouveau code envoyé par email');
        } catch (emailError) {
          console.error('⚠️ Erreur envoi email:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Un nouveau code de vérification a été envoyé à votre email',
        code: process.env.NODE_ENV === 'development' ? code : undefined
      });
    } catch (error) {
      console.error('❌ Erreur demande code:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la demande du code'
      });
    }
  }
);

// ============================================
// /carte - Génération de carte d'employé avec QR Code
// ============================================
router.get("/carte", authenticate, authorize(["employe"]), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`📇 Génération carte pour userId: ${userId}`);

    const sql = `
      SELECT 
        e.*, 
        d.nom AS departement_nom
      FROM employes e
      LEFT JOIN departements d ON d.id = e.id_departement
      WHERE e.id = ?
      LIMIT 1
    `;

    // ✅ CORRECTION : Sans déstructuration pour mysql2
    const rows = await db.query(sql, [userId]);

    // Vérification si l'employé existe
    if (!rows || rows.length === 0) {
      console.warn(`⚠️ Employé non trouvé pour userId: ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: "Employé introuvable" 
      });
    }

    // ✅ Récupérer le premier employé
    const employe = rows[0];
    console.log(`✅ Employé trouvé: ${employe.nom_complet} (Matricule: ${employe.matricule})`);

    // ✅ Vérifier et générer le QR code si nécessaire
    let qrCodeDataUrl = employe.qr_code;

    // Si le QR code n'existe pas ou n'est pas une Data URL valide
    if (!qrCodeDataUrl || !qrCodeDataUrl.startsWith('data:image')) {
      console.log('🔄 Génération du QR Code...');
      
      // Données à encoder dans le QR code
      const payload = JSON.stringify({ 
        id: employe.id, 
        matricule: employe.matricule, 
        nom: employe.nom_complet,
        type: employe.type_employe || 'INSS',
        timestamp: Date.now()
      });

      try {
        // Générer le QR Code comme Data URL
        qrCodeDataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#1E3A8A',  // Couleur du QR code
            light: '#FFFFFF'  // Couleur de fond
          }
        });

        console.log(`✅ QR Code généré (${qrCodeDataUrl.length} caractères)`);

        // Mettre à jour la base de données avec le QR code généré
        await db.query(
          "UPDATE employes SET qr_code = ? WHERE id = ?",
          [qrCodeDataUrl, userId]
        );
        
        console.log('💾 QR Code sauvegardé dans la base de données');
      } catch (qrError) {
        console.error('❌ Erreur génération QR Code:', qrError);
        // Si la génération échoue, on continue sans QR code
        qrCodeDataUrl = null;
      }
    } else {
      console.log('✅ QR Code existant trouvé dans la base de données');
    }

    // ✅ Calculer la date de validité (1 an à partir d'aujourd'hui)
    const validite = new Date();
    validite.setFullYear(validite.getFullYear() + 1);
    const validiteFormatted = validite.toISOString().split('T')[0];

    // ✅ Préparer les données de la carte
    const carteData = {
      id: employe.id,
      nom_complet: employe.nom_complet,
      matricule: employe.matricule,
      email: employe.email,
      telephone: employe.telephone,
      departement_nom: employe.departement_nom || 'NUTRIFIX',
      type_employe: employe.type_employe || 'INSS',
      numero_cnss: employe.numero_cnss,
      date_embauche: employe.date_embauche,
      photo_identite: employe.photo_identite,
      qr_code: qrCodeDataUrl,
      validite: validiteFormatted
    };

    console.log('📤 Envoi des données de la carte au frontend');
    console.log('🔍 QR Code inclus:', qrCodeDataUrl ? 'OUI' : 'NON');

    return res.json({
      success: true,
      data: {
        carte: carteData
      }
    });

  } catch (error) {
    console.error("❌ Erreur génération carte:", error);
    console.error("Stack:", error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la génération de la carte",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

function getMoisNom(mois) {
  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return moisNoms[mois - 1] || '';
}

module.exports = router;