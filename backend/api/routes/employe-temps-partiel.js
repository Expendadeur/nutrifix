const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const QRCode = require('qrcode');
const emailService = require('../emailService');

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Calcule le salaire journalier pour un employé temps partiel
 * @param {number} heuresTravaillees - Nombre d'heures travaillées
 * @param {number} tauxHoraire - Taux horaire en FBU
 * @param {Object} deductions - Déductions éventuelles
 * @returns {Object} Détails du calcul de salaire
 */
function calculerSalaireJournalier(heuresTravaillees, tauxHoraire, deductions = {}) {
  const salaireBrut = heuresTravaillees * tauxHoraire;

  // Déductions minimales pour temps partiel (pas d'INSS)
  const autresDeductions = parseFloat(deductions.autres) || 0;
  const avances = parseFloat(deductions.avances) || 0;

  const totalDeductions = autresDeductions + avances;
  const salaireNet = salaireBrut - totalDeductions;

  return {
    heures_travaillees: heuresTravaillees,
    taux_horaire: tauxHoraire,
    salaire_brut: Math.round(salaireBrut),
    deductions: Math.round(totalDeductions),
    salaire_net: Math.round(salaireNet)
  };
}

/**
 * Calcule la durée en heures décimales entre deux heures
 * @param {string} heureEntree - Format HH:MM:SS
 * @param {string} heureSortie - Format HH:MM:SS
 * @returns {number} Durée en heures décimales
 */
function calculerDureeHeures(heureEntree, heureSortie) {
  if (!heureEntree || !heureSortie) return 0;

  const [heE, minE] = heureEntree.split(':').map(Number);
  const [heS, minS] = heureSortie.split(':').map(Number);

  const totalMinutesEntree = heE * 60 + minE;
  const totalMinutesSortie = heS * 60 + minS;

  const dureeMinutes = totalMinutesSortie - totalMinutesEntree;
  const dureeHeures = dureeMinutes / 60;

  return Math.round(dureeHeures * 100) / 100; // 2 décimales
}

// ============================================
// ROUTES API - DASHBOARD
// ============================================

/**
 * @route   GET /api/employe-temps-partiel/dashboard
 * @desc    Récupérer les données du dashboard
 * @access  Private (Employé Temps Partiel)
 */
router.get('/dashboard', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;

    // Vérifier que c'est bien un employé temps partiel
    const [employe] = await db.query(
      `SELECT nom_complet, matricule, salaire_base, date_embauche, type_employe
       FROM utilisateurs WHERE id = ?`,
      [userId]
    );

    if (!employe.length || employe[0].type_employe !== 'temps_partiel') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux employés temps partiel'
      });
    }

    const employeData = employe[0];
    const tauxHoraire = parseFloat(employeData.salaire_base);

    // 1. Heures du mois en cours
    const [heuresMois] = await db.query(
      `SELECT 
        COUNT(DISTINCT date) as jours_travailles,
        COALESCE(SUM(
          TIMESTAMPDIFF(MINUTE, heure_entree, heure_sortie) / 60
        ), 0) as total_heures
       FROM presences 
       WHERE id_utilisateur = ? 
       AND MONTH(date) = MONTH(CURRENT_DATE())
       AND YEAR(date) = YEAR(CURRENT_DATE())
       AND heure_sortie IS NOT NULL`,
      [userId]
    );

    // 2. Statistiques des salaires payés
    const [salairesStats] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN statut_paiement = 'payé' THEN salaire_net ELSE 0 END), 0) as total_paye,
        COUNT(CASE WHEN statut_paiement = 'payé' THEN 1 END) as nombre_paiements
       FROM salaires 
       WHERE id_utilisateur = ?`,
      [userId]
    );

    // 3. Jours non payés ce mois
    const [joursNonPayes] = await db.query(
      `SELECT COUNT(*) as jours_non_payes
       FROM presences p
       WHERE p.id_utilisateur = ?
       AND MONTH(p.date) = MONTH(CURRENT_DATE())
       AND YEAR(p.date) = YEAR(CURRENT_DATE())
       AND p.heure_sortie IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM salaires s
         WHERE s.id_utilisateur = p.id_utilisateur
         AND s.mois = MONTH(p.date)
         AND s.annee = YEAR(p.date)
         AND DAY(p.date) = DAY(s.date_calcul)
         AND s.statut_paiement = 'payé'
       )`,
      [userId]
    );

    // 4. Salaire estimé non payé
    const salaireEnAttente = parseFloat(heuresMois[0].total_heures) * tauxHoraire;

    res.json({
      success: true,
      data: {
        nom_complet: employeData.nom_complet,
        matricule: employeData.matricule,
        taux_horaire: tauxHoraire,
        heures_ce_mois: parseFloat(heuresMois[0].total_heures).toFixed(2),
        jours_travailles_mois: heuresMois[0].jours_travailles,
        jours_non_payes: joursNonPayes[0].jours_non_payes,
        total_paye: parseFloat(salairesStats[0].total_paye),
        salaire_en_attente: Math.round(salaireEnAttente),
        nombre_paiements: salairesStats[0].nombre_paiements
      }
    });
  } catch (error) {
    console.error('Erreur récupération dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données du dashboard'
    });
  }
});

/**
 * @route   GET /api/employe-temps-partiel/carte
 * @desc    Générer et récupérer la carte digitale de l'employé
 * @access  Private (Employé Temps Partiel)
 */
router.get('/carte', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;

    const [employe] = await db.query(`
      SELECT 
        u.*,
        d.nom as departement_nom
      FROM utilisateurs u
      LEFT JOIN departements d ON u.id_departement = d.id
      WHERE u.id = ?
    `, [userId]);

    if (!employe.length) {
      return res.status(404).json({
        success: false,
        message: 'Employé non trouvé'
      });
    }

    const employeData = employe[0];

    // Vérifier que c'est bien un employé temps partiel
    if (employeData.type_employe !== 'temps_partiel') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux employés temps partiel'
      });
    }

    // Si le QR code n'existe pas, le générer
    if (!employeData.qr_code) {
      const qrData = JSON.stringify({
        id: employeData.id,
        matricule: employeData.matricule,
        nom_complet: employeData.nom_complet,
        email: employeData.email,
        telephone: employeData.telephone,
        type_employe: employeData.type_employe,
        departement: employeData.id_departement,
        date_embauche: employeData.date_embauche,
        taux_horaire: parseFloat(employeData.salaire_base),
        timestamp: Date.now()
      });

      const qr_code = await QRCode.toDataURL(qrData);

      // Mettre à jour dans les deux tables (à cause du trigger)
      await db.query('UPDATE employes SET qr_code = ? WHERE id = ?', [qr_code, userId]);

      employeData.qr_code = qr_code;
    }

    // Calculer la date de validité (1 an à partir de la date d'embauche ou renouvellement annuel)
    const dateEmbauche = new Date(employeData.date_embauche);
    const aujourdhui = new Date();
    const anneesCarte = Math.floor((aujourdhui - dateEmbauche) / (365 * 24 * 60 * 60 * 1000));
    const validiteAnnee = dateEmbauche.getFullYear() + anneesCarte + 1;
    const dateValidite = new Date(dateEmbauche);
    dateValidite.setFullYear(validiteAnnee);

    res.status(200).json({
      success: true,
      data: {
        carte: {
          id: employeData.id,
          matricule: employeData.matricule,
          nom_complet: employeData.nom_complet,
          telephone: employeData.telephone,
          email: employeData.email,
          departement_nom: employeData.departement_nom || 'NUTRIFIX',
          photo_identite: employeData.photo_identite,
          qr_code: employeData.qr_code,
          type_employe: 'TEMPS PARTIEL',
          taux_horaire: parseFloat(employeData.salaire_base),
          date_embauche: employeData.date_embauche,
          date_emission: aujourdhui.toISOString().split('T')[0],
          date_validite: dateValidite.toISOString().split('T')[0],
          statut: employeData.statut
        }
      }
    });
  } catch (error) {
    console.error('Erreur génération carte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la carte digitale'
    });
  }
});

// ============================================
// ROUTES API - POINTAGE
// ============================================

/**
 * @route   GET /api/employe-temps-partiel/pointage/today
 * @desc    Récupérer le pointage du jour
 * @access  Private (Employé Temps Partiel)
 */
router.get('/pointage/today', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    const [pointage] = await db.query(
      `SELECT 
        date,
        TIME(heure_entree) as heure_entree,
        TIME(heure_sortie) as heure_sortie,
        CASE 
          WHEN heure_sortie IS NOT NULL THEN
            ROUND(TIMESTAMPDIFF(MINUTE, heure_entree, heure_sortie) / 60, 2)
          ELSE NULL
        END as duree_heures,
        localisation_entree,
        localisation_sortie,
        statut
       FROM presences 
       WHERE id_utilisateur = ? AND date = ?`,
      [userId, dateAujourdhui]
    );

    res.json({
      success: true,
      data: pointage[0] || null
    });
  } catch (error) {
    console.error('Erreur récupération pointage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du pointage'
    });
  }
});

/**
 * @route   POST /api/employe-temps-partiel/pointage/entree
 * @desc    Enregistrer un pointage d'entrée
 * @access  Private (Employé Temps Partiel)
 */
router.post('/pointage/entree', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    // Validation de la localisation
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'La localisation GPS est requise pour le pointage'
      });
    }

    // Vérifier qu'il n'y a pas déjà un pointage aujourd'hui
    const [existing] = await db.query(
      'SELECT id FROM presences WHERE id_utilisateur = ? AND date = ?',
      [userId, dateAujourdhui]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé votre entrée aujourd\'hui'
      });
    }

    const localisation = `${latitude},${longitude}`;

    await db.query(
      `INSERT INTO presences (
        id_utilisateur, date, heure_entree, localisation_entree, statut
      ) VALUES (?, ?, NOW(), ?, 'present')`,
      [userId, dateAujourdhui, localisation]
    );

    res.json({
      success: true,
      message: 'Pointage d\'entrée enregistré avec succès',
      heure_entree: new Date().toTimeString().split(' ')[0]
    });
  } catch (error) {
    console.error('Erreur pointage entrée:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du pointage d\'entrée'
    });
  }
});

/**
 * @route   POST /api/employe-temps-partiel/pointage/sortie
 * @desc    Enregistrer un pointage de sortie et calculer le salaire journalier
 * @access  Private (Employé Temps Partiel)
 */
router.post('/pointage/sortie', authenticate, authorize(['employe']), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    const dateAujourdhui = new Date().toISOString().split('T')[0];

    // Validation de la localisation
    if (!latitude || !longitude) {
      throw new Error('La localisation GPS est requise pour le pointage');
    }

    // Vérifier qu'il y a un pointage d'entrée
    const [presence] = await connection.query(
      `SELECT id, heure_entree, heure_sortie 
       FROM presences 
       WHERE id_utilisateur = ? AND date = ?`,
      [userId, dateAujourdhui]
    );

    if (!presence.length) {
      throw new Error('Vous devez d\'abord pointer votre entrée');
    }

    if (presence[0].heure_sortie) {
      throw new Error('Vous avez déjà pointé votre sortie aujourd\'hui');
    }

    const localisation = `${latitude},${longitude}`;

    // Enregistrer la sortie
    await connection.query(
      `UPDATE presences 
       SET heure_sortie = NOW(), 
           localisation_sortie = ?
       WHERE id = ?`,
      [localisation, presence[0].id]
    );

    // Calculer la durée de travail
    const [updated] = await connection.query(
      `SELECT 
        TIME(heure_entree) as heure_entree,
        TIME(heure_sortie) as heure_sortie,
        ROUND(TIMESTAMPDIFF(MINUTE, heure_entree, heure_sortie) / 60, 2) as duree_heures
       FROM presences 
       WHERE id = ?`,
      [presence[0].id]
    );

    // Récupérer le taux horaire
    const [employe] = await connection.query(
      'SELECT salaire_base FROM utilisateurs WHERE id = ?',
      [userId]
    );

    const tauxHoraire = parseFloat(employe[0].salaire_base);
    const heuresTravaillees = parseFloat(updated[0].duree_heures);

    // Calculer le salaire journalier
    const calcul = calculerSalaireJournalier(heuresTravaillees, tauxHoraire);

    // Enregistrer le salaire journalier dans la table salaires
    const moisActuel = new Date().getMonth() + 1;
    const anneeActuelle = new Date().getFullYear();

    await connection.query(
      `INSERT INTO salaires (
        id_utilisateur,
        mois,
        annee,
        salaire_brut,
        heures_travaillees,
        heures_supp,
        taux_heure_supp,
        deduction_inss,
        deduction_impots,
        autres_deductions,
        avances,
        primes,
        indemnites,
        commissions,
        total_deductions,
        total_additions,
        salaire_net,
        statut_paiement,
        calcul_par,
        date_calcul
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 0, 0, 0, 0, ?, 0, ?, 'calculé', ?, NOW())`,
      [
        userId,
        moisActuel,
        anneeActuelle,
        calcul.salaire_brut,
        calcul.heures_travaillees,
        calcul.deductions,
        calcul.deductions,
        calcul.salaire_net,
        userId
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Pointage de sortie enregistré avec succès',
      heure_sortie: updated[0].heure_sortie,
      duree_travail: `${updated[0].duree_heures}h`,
      salaire_journalier: calcul
    });
  } catch (error) {
    await connection.rollback();
    console.error('Erreur pointage sortie:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement du pointage de sortie'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ROUTES API - HISTORIQUE
// ============================================

/**
 * @route   GET /api/employe-temps-partiel/heures
 * @desc    Récupérer l'historique des heures travaillées
 * @access  Private (Employé Temps Partiel)
 */
router.get('/heures', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { mois, annee } = req.query;

    let query = `
      SELECT 
        p.date,
        TIME(p.heure_entree) as heure_entree,
        TIME(p.heure_sortie) as heure_sortie,
        ROUND(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60, 2) as duree_heures,
        p.remarques,
        CASE 
          WHEN TIME(p.heure_entree) > '08:30:00' THEN 1
          ELSE 0
        END as retard,
        s.salaire_net,
        s.statut_paiement
      FROM presences p
      LEFT JOIN salaires s ON (
        s.id_utilisateur = p.id_utilisateur 
        AND s.mois = MONTH(p.date)
        AND s.annee = YEAR(p.date)
        AND DAY(p.date) = DAY(s.date_calcul)
      )
      WHERE p.id_utilisateur = ?
      AND p.heure_sortie IS NOT NULL
    `;
    const params = [userId];

    if (mois && annee) {
      query += ' AND MONTH(p.date) = ? AND YEAR(p.date) = ?';
      params.push(mois, annee);
    }

    query += ' ORDER BY p.date DESC';

    const [presences] = await db.query(query, params);

    // Récupérer le taux horaire
    const [employe] = await db.query(
      'SELECT salaire_base FROM utilisateurs WHERE id = ?',
      [userId]
    );

    const tauxHoraire = parseFloat(employe[0]?.salaire_base) || 0;

    // Calculer les statistiques
    const totalHeures = presences.reduce((sum, p) => sum + parseFloat(p.duree_heures || 0), 0);
    const joursTravailles = presences.length;
    const moyenneHeuresJour = joursTravailles > 0 ? totalHeures / joursTravailles : 0;

    const totalPaye = presences.reduce((sum, p) => {
      return sum + (p.statut_paiement === 'payé' ? parseFloat(p.salaire_net || 0) : 0);
    }, 0);

    const joursNonPayes = presences.filter(p => !p.statut_paiement || p.statut_paiement !== 'payé').length;

    res.json({
      success: true,
      data: {
        presences,
        statistiques: {
          total_heures: parseFloat(totalHeures.toFixed(2)),
          jours_travailles: joursTravailles,
          moyenne_heures_par_jour: parseFloat(moyenneHeuresJour.toFixed(2)),
          taux_horaire: tauxHoraire,
          total_paye: Math.round(totalPaye),
          jours_non_payes: joursNonPayes,
          salaire_en_attente: Math.round((totalHeures * tauxHoraire) - totalPaye)
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération heures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des heures'
    });
  }
});

/**
 * @route   GET /api/employe-temps-partiel/salaires
 * @desc    Récupérer l'historique des salaires journaliers
 * @access  Private (Employé Temps Partiel)
 */
router.get('/salaires', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { annee, statut } = req.query;

    let query = `
      SELECT 
        s.*,
        DATE_FORMAT(s.date_calcul, '%d/%m/%Y') as date_travail,
        DATEDIFF(CURRENT_DATE(), s.date_calcul) as jours_attente
      FROM salaires s
      WHERE s.id_utilisateur = ?
    `;
    const params = [userId];

    if (annee) {
      query += ' AND s.annee = ?';
      params.push(annee);
    }

    if (statut && statut !== 'tous') {
      query += ' AND s.statut_paiement = ?';
      params.push(statut);
    }

    query += ' ORDER BY s.date_calcul DESC';

    const [salaires] = await db.query(query, params);

    // Calculer les statistiques
    const totalPaye = salaires
      .filter(s => s.statut_paiement === 'payé')
      .reduce((sum, s) => sum + parseFloat(s.salaire_net || 0), 0);

    const montantEnAttente = salaires
      .filter(s => s.statut_paiement === 'calculé')
      .reduce((sum, s) => sum + parseFloat(s.salaire_net || 0), 0);

    const totalHeures = salaires.reduce((sum, s) => sum + parseFloat(s.heures_travaillees || 0), 0);
    const joursPayes = salaires.filter(s => s.statut_paiement === 'payé').length;
    const joursEnAttente = salaires.filter(s => s.statut_paiement === 'calculé').length;

    res.json({
      success: true,
      data: {
        salaires,
        statistiques: {
          total_paye: Math.round(totalPaye),
          montant_en_attente: Math.round(montantEnAttente),
          jours_payes: joursPayes,
          jours_en_attente: joursEnAttente,
          total_heures: parseFloat(totalHeures.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération salaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des salaires'
    });
  }
});

/**
 * @route   GET /api/employe-temps-partiel/salaires/:id
 * @desc    Récupérer le détail d'un salaire journalier
 * @access  Private (Employé Temps Partiel)
 */
router.get('/salaires/:id', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const salaireId = req.params.id;

    // Récupérer le salaire
    const [salaire] = await db.query(
      `SELECT s.*, u.nom_complet, u.matricule
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND s.id_utilisateur = ?`,
      [salaireId, userId]
    );

    if (!salaire.length) {
      return res.status(404).json({
        success: false,
        message: 'Salaire non trouvé'
      });
    }

    const salaireData = salaire[0];

    // Récupérer la présence associée
    const [presence] = await db.query(
      `SELECT 
        date,
        TIME(heure_entree) as heure_entree,
        TIME(heure_sortie) as heure_sortie,
        ROUND(TIMESTAMPDIFF(MINUTE, heure_entree, heure_sortie) / 60, 2) as duree_heures,
        localisation_entree,
        localisation_sortie
       FROM presences
       WHERE id_utilisateur = ?
       AND DATE(date) = DATE(?)
       LIMIT 1`,
      [userId, salaireData.date_calcul]
    );

    res.json({
      success: true,
      data: {
        ...salaireData,
        presence_associee: presence[0] || null
      }
    });
  } catch (error) {
    console.error('Erreur récupération détail salaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du détail du salaire'
    });
  }
});

/**
 * @route   GET /api/employe-temps-partiel/statistiques
 * @desc    Récupérer les statistiques détaillées
 * @access  Private (Employé Temps Partiel)
 */
router.get('/statistiques', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { periode } = req.query; // 'mois', 'trimestre', 'annee', 'tout'

    let dateFilter = '';
    const params = [userId];

    switch (periode) {
      case 'mois':
        dateFilter = 'AND MONTH(p.date) = MONTH(CURRENT_DATE()) AND YEAR(p.date) = YEAR(CURRENT_DATE())';
        break;
      case 'trimestre':
        dateFilter = 'AND QUARTER(p.date) = QUARTER(CURRENT_DATE()) AND YEAR(p.date) = YEAR(CURRENT_DATE())';
        break;
      case 'annee':
        dateFilter = 'AND YEAR(p.date) = YEAR(CURRENT_DATE())';
        break;
      default:
        dateFilter = '';
    }

    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT p.date) as jours_travailles,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60), 0) as total_heures,
        COALESCE(AVG(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60), 0) as moyenne_heures_jour,
        COALESCE(MIN(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60), 0) as min_heures_jour,
        COALESCE(MAX(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60), 0) as max_heures_jour,
        COUNT(CASE WHEN TIME(p.heure_entree) > '08:30:00' THEN 1 END) as jours_retard
       FROM presences p
       WHERE p.id_utilisateur = ?
       AND p.heure_sortie IS NOT NULL
       ${dateFilter}`,
      params
    );

    // Récupérer le taux horaire
    const [employe] = await db.query(
      'SELECT salaire_base FROM utilisateurs WHERE id = ?',
      [userId]
    );

    const tauxHoraire = parseFloat(employe[0]?.salaire_base) || 0;
    const totalHeures = parseFloat(stats[0].total_heures);
    const salaireEstime = Math.round(totalHeures * tauxHoraire);

    // Statistiques de paiement pour la période
    let dateSalaireFilter = '';
    switch (periode) {
      case 'mois':
        dateSalaireFilter = 'AND MONTH(s.date_calcul) = MONTH(CURRENT_DATE()) AND YEAR(s.date_calcul) = YEAR(CURRENT_DATE())';
        break;
      case 'trimestre':
        dateSalaireFilter = 'AND QUARTER(s.date_calcul) = QUARTER(CURRENT_DATE()) AND YEAR(s.date_calcul) = YEAR(CURRENT_DATE())';
        break;
      case 'annee':
        dateSalaireFilter = 'AND YEAR(s.date_calcul) = YEAR(CURRENT_DATE())';
        break;
      default:
        dateSalaireFilter = '';
    }

    const [paiementStats] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN statut_paiement = 'payé' THEN salaire_net ELSE 0 END), 0) as total_paye,
        COUNT(CASE WHEN statut_paiement = 'payé' THEN 1 END) as jours_payes,
        COUNT(CASE WHEN statut_paiement = 'calculé' THEN 1 END) as jours_non_payes
       FROM salaires s
       WHERE s.id_utilisateur = ?
       ${dateSalaireFilter}`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        periode: periode || 'tout',
        jours_travailles: stats[0].jours_travailles,
        jours_payes: paiementStats[0].jours_payes,
        jours_non_payes: paiementStats[0].jours_non_payes,
        heures: {
          total: parseFloat(totalHeures.toFixed(2)),
          moyenne_par_jour: parseFloat(stats[0].moyenne_heures_jour).toFixed(2),
          minimum: parseFloat(stats[0].min_heures_jour).toFixed(2),
          maximum: parseFloat(stats[0].max_heures_jour).toFixed(2)
        },
        ponctualite: {
          jours_retard: stats[0].jours_retard,
          taux_ponctualite: stats[0].jours_travailles > 0 ?
            (((stats[0].jours_travailles - stats[0].jours_retard) / stats[0].jours_travailles) * 100).toFixed(1) : 100
        },
        salaire: {
          taux_horaire: tauxHoraire,
          total_paye: Math.round(paiementStats[0].total_paye),
          estime_total: salaireEstime,
          en_attente: Math.round(salaireEstime - paiementStats[0].total_paye)
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

/**
 * @route   GET /api/employe-temps-partiel/profil
 * @desc    Récupérer les informations du profil
 * @access  Private (Employé Temps Partiel)
 */
router.get('/profil', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;

    const [employe] = await db.query(
      `SELECT 
        u.nom_complet,
        u.matricule,
        u.date_embauche,
        u.salaire_base as taux_horaire,
        u.email,
        u.telephone,
        d.nom as departement_nom
       FROM utilisateurs u
       LEFT JOIN departements d ON u.id_departement = d.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!employe.length) {
      return res.status(404).json({
        success: false,
        message: 'Informations du profil non trouvées'
      });
    }

    const profilData = employe[0];

    // Calculer les statistiques globales
    const dateEmbauche = new Date(profilData.date_embauche);
    const aujourdhui = new Date();
    const joursEcoules = Math.ceil((aujourdhui - dateEmbauche) / (1000 * 60 * 60 * 24));

    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT p.date) as total_jours_travailles,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, p.heure_entree, p.heure_sortie) / 60), 0) as total_heures,
        COALESCE(
          (SELECT SUM(salaire_net) 
           FROM salaires 
           WHERE id_utilisateur = ? AND statut_paiement = 'payé'),
          0
        ) as total_gagne
       FROM presences p
       WHERE p.id_utilisateur = ?
       AND p.heure_sortie IS NOT NULL`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: {
        informations_profil: {
          nom_complet: profilData.nom_complet,
          matricule: profilData.matricule,
          date_embauche: profilData.date_embauche,
          departement: profilData.departement_nom,
          taux_horaire: parseFloat(profilData.taux_horaire),
          email: profilData.email,
          telephone: profilData.telephone
        },
        anciennete: {
          jours_depuis_embauche: joursEcoules,
          mois_depuis_embauche: Math.floor(joursEcoules / 30)
        },
        statistiques_globales: {
          total_jours_travailles: stats[0].total_jours_travailles,
          total_heures: parseFloat(stats[0].total_heures).toFixed(2),
          total_gagne: Math.round(parseFloat(stats[0].total_gagne)),
          moyenne_heures_jour: stats[0].total_jours_travailles > 0 ?
            (parseFloat(stats[0].total_heures) / stats[0].total_jours_travailles).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations du profil'
    });
  }
});

/**
 * @route   POST /api/employe-temps-partiel/salaires/:id/confirmer-reception
 * @desc    Confirmer la réception du paiement avec code OTP et blocage auto après 2 échecs
 * @access  Private (Employé Temps Partiel)
 */
router.post('/salaires/:id/confirmer-reception', authenticate, authorize(['employe']), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const userId = req.user.id;
    const salaireId = req.params.id;
    const { code_verification, mois, annee } = req.body;

    const [salaire] = await connection.query(
      `SELECT s.*, u.nom_complet, u.email 
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND s.id_utilisateur = ?`,
      [salaireId, userId]
    );

    if (!salaire.length) throw new Error('Salaire non trouvé');
    const salaireData = salaire[0];

    if (salaireData.statut_paiement !== 'payé') throw new Error('Ce salaire n\'a pas encore été payé');
    if (salaireData.confirme_reception) throw new Error('La réception a déjà été confirmée');

    const [codeExistant] = await connection.query(
      `SELECT code_verification, date_expiration, tentatives_echouees 
       FROM codes_verification_salaire 
       WHERE id_salaire = ? AND id_utilisateur = ?
       ORDER BY date_creation DESC LIMIT 1`,
      [salaireId, userId]
    );

    if (!codeExistant.length) throw new Error('Veuillez demander un code de vérification');

    const codeData = codeExistant[0];
    if (new Date() > new Date(codeData.date_expiration)) throw new Error('Code expiré. Veuillez en redemander un.');

    if (code_verification !== codeData.code_verification) {
      const nouvellesTentatives = codeData.tentatives_echouees + 1;
      await connection.query(
        `UPDATE codes_verification_salaire SET tentatives_echouees = ? WHERE id_salaire = ? AND id_utilisateur = ? AND code_verification = ?`,
        [nouvellesTentatives, salaireId, userId, codeData.code_verification]
      );

      if (nouvellesTentatives >= 2) {
        await connection.query("UPDATE utilisateurs SET statut = 'bloqué' WHERE id = ?", [userId]);
        await connection.commit();
        return res.status(403).json({
          success: false,
          message: 'Votre compte a été bloqué après 2 tentatives infructueuses. Veuillez contacter l\'administrateur.'
        });
      }

      const restantes = 2 - nouvellesTentatives;
      await connection.commit();
      return res.status(400).json({
        success: false,
        message: `Code incorrect. Il vous reste ${restantes} tentative(s) avant blocage.`
      });
    }

    // Succès
    await connection.query(
      `INSERT INTO confirmations_reception_salaire (id_salaire, id_utilisateur, mois, annee, montant, code_verification_utilise, confirme, date_confirmation)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [salaireId, userId, mois, annee, salaireData.salaire_net, code_verification]
    );

    await connection.query(`UPDATE salaires SET confirme_reception = 1, date_confirmation_reception = NOW() WHERE id = ?`, [salaireId]);
    await connection.query(`UPDATE codes_verification_salaire SET utilise = 1 WHERE id_salaire = ? AND code_verification = ?`, [salaireId, code_verification]);

    await connection.commit();
    res.json({ success: true, message: 'Réception confirmée avec succès' });

  } catch (error) {
    if (connection) await connection.rollback();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * @route   POST /api/employe-temps-partiel/salaires/:id/demander-code
 * @desc    Générer et envoyer un code OTP par email
 */
router.post('/salaires/:id/demander-code', authenticate, authorize(['employe']), async (req, res) => {
  try {
    const userId = req.user.id;
    const salaireId = req.params.id;

    const [salaire] = await db.query(
      `SELECT s.*, u.nom_complet, u.email FROM salaires s JOIN utilisateurs u ON s.id_utilisateur = u.id WHERE s.id = ? AND s.id_utilisateur = ?`,
      [salaireId, userId]
    );

    if (!salaire.length) throw new Error('Salaire non trouvé');
    const salaireData = salaire[0];

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await db.query(
      `INSERT INTO codes_verification_salaire (id_salaire, id_utilisateur, code_verification, date_expiration) VALUES (?, ?, ?, ?)`,
      [salaireId, userId, code, expires]
    );

    if (salaireData.email) {
      await emailService.envoyerCodeVerification(salaireData.email, code, salaireData.nom_complet, salaireData.mois || new Date(salaireData.date_calcul).getMonth() + 1, salaireData.annee || new Date(salaireData.date_calcul).getFullYear());
    }

    res.json({ success: true, message: 'Code envoyé par email', code: process.env.NODE_ENV === 'development' ? code : undefined });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

function getMoisNom(mois) {
  const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return moisNoms[mois - 1] || '';
}

module.exports = router;