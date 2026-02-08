// backend/routes/personnelRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

// ============================================
// EMPLOYÉS - CRUD COMPLET
// ============================================

/**
 * GET /api/personnel/employes
 * Récupérer la liste des employés avec filtres
 */
router.get('/employes', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { type_employe, id_departement, statut } = req.query;

        let sql = `
            SELECT 
                u.*,
                d.nom as departement_nom,
                (SELECT COUNT(*) 
                 FROM presences p 
                 WHERE p.id_utilisateur = u.id 
                 AND p.statut = 'present') as jours_travailles
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (type_employe && type_employe !== 'all') {
            sql += ' AND u.type_employe = ?';
            params.push(type_employe);
        }

        if (id_departement && id_departement !== 'all') {
            sql += ' AND u.id_departement = ?';
            params.push(id_departement);
        }

        if (statut && statut !== 'all') {
            sql += ' AND u.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY u.nom_complet';

        const employes = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: employes
        });
    } catch (error) {
        console.error('Get employes error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des employés.'
        });
    }
});

/**
 * GET /api/personnel/employes/:id
 * Récupérer un employé spécifique
 */
router.get('/employes/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        const [employe] = await db.query(`
            SELECT 
                u.*,
                d.nom as departement_nom,
                (SELECT COUNT(*) 
                 FROM presences p 
                 WHERE p.id_utilisateur = u.id 
                 AND p.statut = 'present') as jours_travailles,
                (SELECT COUNT(*) 
                 FROM conges c 
                 WHERE c.id_utilisateur = u.id 
                 AND c.statut = 'approuve') as conges_pris
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.id = ?
        `, [id]);

        if (!employe) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé.'
            });
        }

        res.status(200).json({
            success: true,
            data: employe
        });
    } catch (error) {
        console.error('Get employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'employé.'
        });
    }
});

/**
 * POST /api/personnel/employes
 * Créer un nouvel employé
 */
router.post('/employes', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            matricule,
            email,
            nom_complet,
            telephone,
            type_employe,
            role,
            id_departement,
            date_embauche,
            date_naissance,
            adresse,
            ville,
            pays,
            numero_cnss,
            salaire_base,
            jours_conges_annuels,
            compte_bancaire,
            nom_banque,
            photo_identite,
            statut
        } = req.body;

        // Validation des champs obligatoires
        if (!matricule || !email || !nom_complet || !telephone || !type_employe || !role || !id_departement || !date_embauche || !salaire_base) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Vérifier si le matricule existe déjà
        const [existingMatricule] = await db.query(
            'SELECT id FROM utilisateurs WHERE matricule = ?',
            [matricule]
        );

        if (existingMatricule) {
            return res.status(400).json({
                success: false,
                message: 'Ce matricule existe déjà.'
            });
        }

        // Vérifier si l'email existe déjà
        const [existingEmail] = await db.query(
            'SELECT id FROM utilisateurs WHERE email = ?',
            [email]
        );

        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Cet email existe déjà.'
            });
        }

        // Générer un mot de passe temporaire
        const tempPassword = Math.random().toString(36).slice(-8);
        const mot_de_passe_hash = await bcrypt.hash(tempPassword, 10);

        // Générer QR Code
        const qrData = JSON.stringify({
            id: Date.now(),
            matricule,
            nom_complet,
            email,
            telephone,
            type_employe,
            date_embauche
        });
        const qr_code = await QRCode.toDataURL(qrData);

        // Insérer dans la table employes d'abord
        const resultEmploye = await db.query(`
            INSERT INTO employes (
                matricule, email, mot_de_passe_hash, nom_complet, telephone,
                type_employe, role, id_departement, date_embauche,
                salaire_base, statut, date_naissance, adresse, ville, pays,
                numero_cnss, jours_conges_annuels, compte_bancaire, nom_banque,
                qr_code, photo_identite, doit_changer_mdp, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
            matricule, email, mot_de_passe_hash, nom_complet, telephone,
            type_employe, role, id_departement, date_embauche,
            salaire_base, statut || 'actif', date_naissance, adresse, ville, 
            pays || 'Burundi', numero_cnss, jours_conges_annuels || 20, 
            compte_bancaire, nom_banque, qr_code, photo_identite, req.userId
        ]);

        // Le trigger va automatiquement créer l'entrée dans utilisateurs

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'creation_employe', ?, 'employes', ?, 'info')
        `, [
            req.userId,
            `Nouvel employé créé: ${nom_complet} (${matricule})`,
            resultEmploye.insertId
        ]);

        res.status(201).json({
            success: true,
            message: 'Employé créé avec succès.',
            data: { 
                id: resultEmploye.insertId,
                tempPassword: tempPassword // À envoyer par email sécurisé
            }
        });
    } catch (error) {
        console.error('Create employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'employé.'
        });
    }
});

/**
 * PUT /api/personnel/employes/:id
 * Modifier un employé
 */
router.put('/employes/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            matricule,
            email,
            nom_complet,
            telephone,
            type_employe,
            role,
            id_departement,
            date_embauche,
            date_naissance,
            adresse,
            ville,
            pays,
            numero_cnss,
            salaire_base,
            jours_conges_annuels,
            compte_bancaire,
            nom_banque,
            photo_identite,
            statut
        } = req.body;

        // Vérifier si l'employé existe
        const [employe] = await db.query('SELECT * FROM employes WHERE id = ?', [id]);
        if (!employe) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé.'
            });
        }

        // Sauvegarder l'ancien état pour l'historique
        const donnees_avant = { ...employe };

        // Mise à jour
        await db.query(`
            UPDATE employes SET
                matricule = ?, email = ?, nom_complet = ?, telephone = ?,
                type_employe = ?, role = ?, id_departement = ?, date_embauche = ?,
                date_naissance = ?, adresse = ?, ville = ?, pays = ?,
                numero_cnss = ?, salaire_base = ?, jours_conges_annuels = ?,
                compte_bancaire = ?, nom_banque = ?, photo_identite = ?,
                statut = ?, modifie_par = ?, date_modification = NOW()
            WHERE id = ?
        `, [
            matricule, email, nom_complet, telephone,
            type_employe, role, id_departement, date_embauche,
            date_naissance, adresse, ville, pays || 'Burundi',
            numero_cnss, salaire_base, jours_conges_annuels || 20,
            compte_bancaire, nom_banque, photo_identite,
            statut, req.userId, id
        ]);

        // Le trigger va automatiquement mettre à jour utilisateurs

        // Calculer les différences
        const donnees_apres = {
            matricule, email, nom_complet, telephone,
            type_employe, role, id_departement, date_embauche,
            date_naissance, adresse, ville, pays,
            numero_cnss, salaire_base, jours_conges_annuels,
            compte_bancaire, nom_banque, photo_identite, statut
        };

        const differences = {};
        for (const key in donnees_apres) {
            if (donnees_avant[key] !== donnees_apres[key]) {
                differences[key] = {
                    ancien: donnees_avant[key],
                    nouveau: donnees_apres[key]
                };
            }
        }

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau,
                donnees_avant, donnees_apres, differences
            ) VALUES (?, 'rh', 'modification_employe', ?, 'employes', ?, 'info', ?, ?, ?)
        `, [
            req.userId,
            `Employé modifié: ${nom_complet}`,
            id,
            JSON.stringify(donnees_avant),
            JSON.stringify(donnees_apres),
            JSON.stringify(differences)
        ]);

        res.status(200).json({
            success: true,
            message: 'Employé modifié avec succès.'
        });
    } catch (error) {
        console.error('Update employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de l\'employé.'
        });
    }
});

/**
 * DELETE /api/personnel/employes/:id
 * Supprimer un employé (soft delete)
 */
router.delete('/employes/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const [employe] = await db.query('SELECT * FROM employes WHERE id = ?', [id]);

        if (!employe) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé.'
            });
        }

        // Soft delete
        await db.query('UPDATE employes SET statut = ?, date_depart = NOW(), modifie_par = ? WHERE id = ?', 
            ['inactif', req.userId, id]
        );

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'suppression_employe', ?, 'employes', ?, 'warning')
        `, [
            req.userId,
            `Employé supprimé: ${employe.nom_complet}`,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Employé supprimé avec succès.'
        });
    } catch (error) {
        console.error('Delete employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'employé.'
        });
    }
});

/**
 * GET /api/personnel/employes/:id/carte
 * Générer et récupérer la carte digitale d'un employé
 */
router.get('/employes/:id/carte', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        const [employe] = await db.query(`
            SELECT 
                u.*,
                d.nom as departement_nom
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.id = ?
        `, [id]);

        if (!employe) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé.'
            });
        }

        // Si le QR code n'existe pas, le générer
        if (!employe.qr_code) {
            const qrData = JSON.stringify({
                id: employe.id,
                matricule: employe.matricule,
                nom_complet: employe.nom_complet,
                email: employe.email,
                telephone: employe.telephone,
                type_employe: employe.type_employe,
                date_embauche: employe.date_embauche
            });
            const qr_code = await QRCode.toDataURL(qrData);

            await db.query('UPDATE employes SET qr_code = ? WHERE id = ?', [qr_code, id]);
            employe.qr_code = qr_code;
        }

        res.status(200).json({
            success: true,
            data: {
                employe,
                carte: {
                    id: employe.id,
                    matricule: employe.matricule,
                    nom_complet: employe.nom_complet,
                    telephone: employe.telephone,
                    departement_nom: employe.departement_nom || 'NUTRIFIX',
                    photo_identite: employe.photo_identite,
                    qr_code: employe.qr_code,
                    type_employe: employe.type_employe,
                    date_embauche: employe.date_embauche,
                    numero_cnss: employe.numero_cnss,
                    validite: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Generate carte error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération de la carte.'
        });
    }
});

// ============================================
// DÉPARTEMENTS
// ============================================

/**
 * GET /api/personnel/departements
 * Récupérer la liste des départements
 */
router.get('/departements', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const departements = await db.query(`
            SELECT 
                d.*,
                (SELECT COUNT(*) 
                 FROM utilisateurs u 
                 WHERE u.id_departement = d.id 
                 AND u.statut = 'actif') as nombre_employes,
                (SELECT nom_complet 
                 FROM utilisateurs 
                 WHERE id = d.responsable_id) as responsable_nom
            FROM departements d
            WHERE d.statut = 'actif'
            ORDER BY d.nom
        `);

        res.status(200).json({
            success: true,
            data: departements
        });
    } catch (error) {
        console.error('Get departements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements.'
        });
    }
});

/**
 * POST /api/personnel/departements
 * Créer un département
 */
router.post('/departements', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { nom, id_parent, type, budget_annuel, responsable_id, statut } = req.body;

        if (!nom || !type) {
            return res.status(400).json({
                success: false,
                message: 'Le nom et le type du département sont obligatoires.'
            });
        }

        const result = await db.query(`
            INSERT INTO departements (nom, id_parent, type, budget_annuel, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [nom, id_parent, type, budget_annuel || 0, responsable_id, statut || 'actif']);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'creation_departement', ?, 'departements', ?, 'info')
        `, [req.userId, `Département créé: ${nom}`, result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Département créé avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create departement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du département.'
        });
    }
});

/**
 * PUT /api/personnel/departements/:id
 * Modifier un département
 */
router.put('/departements/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, id_parent, type, budget_annuel, responsable_id, statut } = req.body;

        await db.query(`
            UPDATE departements SET
                nom = ?, id_parent = ?, type = ?, budget_annuel = ?,
                responsable_id = ?, statut = ?
            WHERE id = ?
        `, [nom, id_parent, type, budget_annuel, responsable_id, statut, id]);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'modification_departement', ?, 'departements', ?, 'info')
        `, [req.userId, `Département modifié: ${nom}`, id]);

        res.status(200).json({
            success: true,
            message: 'Département modifié avec succès.'
        });
    } catch (error) {
        console.error('Update departement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du département.'
        });
    }
});

/**
 * DELETE /api/personnel/departements/:id
 * Supprimer un département
 */
router.delete('/departements/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des employés dans ce département
        const [count] = await db.query(
            'SELECT COUNT(*) as count FROM utilisateurs WHERE id_departement = ? AND statut = ?',
            [id, 'actif']
        );

        if (count.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer un département avec des employés actifs.'
            });
        }

        await db.query('UPDATE departements SET statut = ? WHERE id = ?', ['inactif', id]);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'suppression_departement', ?, 'departements', ?, 'warning')
        `, [req.userId, `Département supprimé: ID ${id}`, id]);

        res.status(200).json({
            success: true,
            message: 'Département supprimé avec succès.'
        });
    } catch (error) {
        console.error('Delete departement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du département.'
        });
    }
});

// ============================================
// PRÉSENCES
// ============================================

/**
 * GET /api/personnel/presences
 * Récupérer les présences
 */
router.get('/presences', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { date, id_utilisateur } = req.query;

        let sql = `
            SELECT 
                p.*,
                u.nom_complet as employe_nom,
                u.photo_identite as photo,
                u.telephone,
                d.nom as departement_nom
            FROM presences p
            JOIN utilisateurs u ON p.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            sql += ' AND DATE(p.date) = ?';
            params.push(date);
        }

        if (id_utilisateur) {
            sql += ' AND p.id_utilisateur = ?';
            params.push(id_utilisateur);
        }

        sql += ' ORDER BY p.heure_entree DESC';

        const presences = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: presences
        });
    } catch (error) {
        console.error('Get presences error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des présences.'
        });
    }
});

/**
 * POST /api/personnel/presences
 * Enregistrer une présence
 */
router.post('/presences', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id_utilisateur, date, heure_entree, heure_sortie, statut } = req.body;

        if (!id_utilisateur || !date || !heure_entree) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO presences (id_utilisateur, date, heure_entree, heure_sortie, statut)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                heure_sortie = VALUES(heure_sortie),
                statut = VALUES(statut)
        `;

        await db.query(sql, [id_utilisateur, date, heure_entree, heure_sortie, statut || 'present']);

        res.status(201).json({
            success: true,
            message: 'Présence enregistrée avec succès.'
        });
    } catch (error) {
        console.error('Create presence error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la présence.'
        });
    }
});

// ============================================
// SALAIRES
// ============================================

/**
 * GET /api/personnel/salaires
 * Récupérer les salaires
 */
router.get('/salaires', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { mois, annee, statut } = req.query;

        let sql = `
            SELECT 
                s.*,
                u.nom_complet as employe_nom,
                u.matricule,
                u.type_employe,
                u.salaire_base,
                d.nom as departement_nom
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (mois) {
            sql += ' AND s.mois = ?';
            params.push(mois);
        }

        if (annee) {
            sql += ' AND s.annee = ?';
            params.push(annee);
        }

        if (statut) {
            sql += ' AND s.statut_paiement = ?';
            params.push(statut);
        }

        sql += ' ORDER BY u.nom_complet';

        const salaires = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: salaires
        });
    } catch (error) {
        console.error('Get salaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des salaires.'
        });
    }
});

/**
 * POST /api/personnel/salaires/calculer
 * Calculer les salaires du mois
 */
router.post('/salaires/calculer', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { mois, annee } = req.body;

        if (!mois || !annee) {
            return res.status(400).json({
                success: false,
                message: 'Mois et année requis.'
            });
        }

        // Récupérer tous les employés actifs
        const employes = await db.query(
            'SELECT * FROM utilisateurs WHERE statut = ?',
            ['actif']
        );

        const salairesCalcules = [];

        for (const employe of employes) {
            // Vérifier si salaire déjà calculé
            const [existing] = await db.query(`
                SELECT id FROM salaires 
                WHERE id_utilisateur = ? AND mois = ? AND annee = ?
            `, [employe.id, mois, annee]);

            if (existing) {
                continue; // Déjà calculé
            }

            // Calcul du salaire de base
            let salaireBase = parseFloat(employe.salaire_base);

            // Calcul des jours travaillés
            const [presences] = await db.query(`
                SELECT COUNT(*) as jours_travailles
                FROM presences
                WHERE id_utilisateur = ?
                AND MONTH(date) = ?
                AND YEAR(date) = ?
                AND statut = 'present'
            `, [employe.id, mois, annee]);

            const joursTravaill = presences?.jours_travailles || 0;
            
            // Calcul des heures supplémentaires
            const [heuresSupp] = await db.query(`
                SELECT COALESCE(SUM(TIME_TO_SEC(heures_supp))/3600, 0) as total_heures_supp
                FROM presences
                WHERE id_utilisateur = ?
                AND MONTH(date) = ?
                AND YEAR(date) = ?
            `, [employe.id, mois, annee]);

            const totalHeuresSupp = heuresSupp?.total_heures_supp || 0;
            const tauxHeureSupp = salaireBase / 173.33 * 1.5; // 173.33 = heures mensuelles
            const montantHeuresSupp = totalHeuresSupp * tauxHeureSupp;

            // Calcul des primes (exemple: prime de présence)
            const primePresence = joursTravaill >= 22 ? salaireBase * 0.10 : 0;
            const totalPrimes = primePresence;

            // Calcul des déductions (INSS, impôt)
            let deductionINSS = 0;
            let deductionImpot = 0;

            if (employe.type_employe === 'INSS') {
                deductionINSS = salaireBase * 0.05; // 5% INSS employé

                // Calcul impôt progressif (exemple simplifié pour le Burundi)
                const salaireImposable = salaireBase - deductionINSS;
                if (salaireImposable > 100000) {
                    deductionImpot = (salaireImposable - 100000) * 0.30 + 15000;
                } else if (salaireImposable > 50000) {
                    deductionImpot = (salaireImposable - 50000) * 0.20;
                }
            }

            const totalDeductions = deductionINSS + deductionImpot;
            const totalAdditions = totalPrimes + montantHeuresSupp;
            const montantNet = salaireBase + totalAdditions - totalDeductions;

            // Insérer le salaire
            const result = await db.query(`
                INSERT INTO salaires (
                    id_utilisateur, mois, annee, salaire_brut,
                    heures_travaillees, heures_supp, taux_heure_supp,
                    deduction_inss, deduction_impots,
                    primes, indemnites,
                    total_deductions, total_additions, salaire_net,
                    statut_paiement, calcul_par, date_calcul
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculé', ?, NOW())
            `, [
                employe.id, mois, annee, salaireBase,
                joursTravaill * 8, totalHeuresSupp, tauxHeureSupp,
                deductionINSS, deductionImpot,
                totalPrimes, 0,
                totalDeductions, totalAdditions, montantNet,
                req.userId
            ]);

            salairesCalcules.push({
                id: result.insertId,
                id_utilisateur: employe.id,
                employe_nom: employe.nom_complet,
                montant_net: montantNet
            });
        }

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, niveau
            ) VALUES (?, 'rh', 'calcul_salaires', ?, 'salaires', 'info')
        `, [
            req.userId,
            `Calcul des salaires ${mois}/${annee} - ${salairesCalcules.length} employés`
        ]);

        res.status(200).json({
            success: true,
            message: 'Salaires calculés avec succès.',
            data: {
                count: salairesCalcules.length,
                salaires: salairesCalcules
            }
        });
    } catch (error) {
        console.error('Calculer salaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des salaires.'
        });
    }
});

/**
 * PUT /api/personnel/salaires/:id/valider
 * Valider un salaire
 */
router.put('/salaires/:id/valider', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(`
            UPDATE salaires 
            SET statut_paiement = 'payé', 
                valide_par = ?, 
                date_validation = NOW()
            WHERE id = ?
        `, [req.userId, id]);

        // Récupérer les détails du salaire pour le journal
        const [salaire] = await db.query(`
            SELECT s.*, u.nom_complet, u.matricule
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE s.id = ?
        `, [id]);

        if (salaire) {
            // Enregistrement dans journal comptable via le trigger
            // Le trigger trigger_journal_salaire s'occupera de cela
        }

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'validation_salaire', ?, 'salaires', ?, 'info')
        `, [
            req.userId,
            `Salaire validé: ${salaire?.nom_complet} - ${salaire?.mois}/${salaire?.annee}`,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Salaire validé avec succès.'
        });
    } catch (error) {
        console.error('Valider salaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation du salaire.'
        });
    }
});

// ============================================
// CONGÉS
// ============================================

/**
 * GET /api/personnel/conges
 * Récupérer les congés
 */
router.get('/conges', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { statut } = req.query;

        let sql = `
            SELECT 
                c.*,
                u.nom_complet as employe_nom,
                u.photo_identite as photo,
                u.telephone,
                d.nom as departement_nom,
                v.nom_complet as valideur_nom
            FROM conges c
            JOIN utilisateurs u ON c.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            LEFT JOIN utilisateurs v ON c.valide_par = v.id
            WHERE 1=1
        `;
        const params = [];

        if (statut) {
            sql += ' AND c.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY c.date_creation DESC';

        const conges = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: conges
        });
    } catch (error) {
        console.error('Get conges error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des congés.'
        });
    }
});

/**
 * PUT /api/personnel/conges/:id/approuver
 * Approuver un congé
 */
router.put('/conges/:id/approuver', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(`
            UPDATE conges 
            SET statut = 'approuve', 
                valide_par = ?, 
                date_validation = NOW()
            WHERE id = ?
        `, [req.userId, id]);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'approbation_conge', 'Congé approuvé', 'conges', ?, 'info')
        `, [req.userId, id]);

        res.status(200).json({
            success: true,
            message: 'Congé approuvé avec succès.'
        });
    } catch (error) {
        console.error('Approuver conge error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'approbation du congé.'
        });
    }
});

/**
 * PUT /api/personnel/conges/:id/rejeter
 * Rejeter un congé
 */
router.put('/conges/:id/rejeter', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { commentaire_validation } = req.body;

        if (!commentaire_validation) {
            return res.status(400).json({
                success: false,
                message: 'La raison du rejet est obligatoire.'
            });
        }

        await db.query(`
            UPDATE conges 
            SET statut = 'rejete', 
                commentaire_validation = ?,
                valide_par = ?, 
                date_validation = NOW()
            WHERE id = ?
        `, [commentaire_validation, req.userId, id]);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'rh', 'rejet_conge', ?, 'conges', ?, 'warning')
        `, [req.userId, `Congé rejeté: ${commentaire_validation}`, id]);

        res.status(200).json({
            success: true,
            message: 'Congé rejeté avec succès.'
        });
    } catch (error) {
        console.error('Rejeter conge error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du rejet du congé.'
        });
    }
});

// ============================================
// HISTORIQUE / TRACES
// ============================================

/**
 * GET /api/personnel/historique
 * Récupérer l'historique RH
 */
router.get('/historique', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { type, module } = req.query;

        let sql = `
            SELECT 
                t.*,
                u.nom_complet as effectue_par_nom,
                u.role as effectue_par_role
            FROM traces t
            LEFT JOIN utilisateurs u ON t.id_utilisateur = u.id
            WHERE t.module = 'rh'
        `;
        const params = [];

        if (type && type !== 'all') {
            sql += ' AND t.type_action LIKE ?';
            params.push(`%${type}%`);
        }

        sql += ' ORDER BY t.date_action DESC LIMIT 100';

        const historique = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: historique
        });
    } catch (error) {
        console.error('Get historique RH error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique.'
        });
    }
});

// ============================================
// STATISTIQUES RH
// ============================================

/**
 * GET /api/personnel/statistiques
 * Récupérer les statistiques RH
 */
router.get('/statistiques', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        // Total employés
        const [totalEmployes] = await db.query(
            'SELECT COUNT(*) as total FROM utilisateurs WHERE statut = ?',
            ['actif']
        );

        // Par type
        const parType = await db.query(`
            SELECT type_employe, COUNT(*) as count
            FROM utilisateurs
            WHERE statut = 'actif'
            GROUP BY type_employe
        `);

        // Par département
        const parDepartement = await db.query(`
            SELECT d.nom, COUNT(u.id) as count
            FROM departements d
            LEFT JOIN utilisateurs u ON d.id = u.id_departement AND u.statut = 'actif'
            WHERE d.statut = 'actif'
            GROUP BY d.id, d.nom
        `);

        // Présences du jour
        const [presencesJour] = await db.query(`
            SELECT COUNT(*) as total
            FROM presences
            WHERE DATE(date) = CURDATE()
            AND statut = 'present'
        `);

        // Congés en attente
        const [congesEnAttente] = await db.query(`
            SELECT COUNT(*) as total
            FROM conges
            WHERE statut = 'en_attente'
        `);

        // Masse salariale du mois
        const [masseSalariale] = await db.query(`
            SELECT COALESCE(SUM(salaire_net), 0) as total
            FROM salaires
            WHERE mois = MONTH(CURDATE())
            AND annee = YEAR(CURDATE())
        `);

        res.status(200).json({
            success: true,
            data: {
                total_employes: totalEmployes?.total || 0,
                par_type: parType,
                par_departement: parDepartement,
                presences_jour: presencesJour?.total || 0,
                conges_en_attente: congesEnAttente?.total || 0,
                masse_salariale_mois: masseSalariale?.total || 0
            }
        });
    } catch (error) {
        console.error('Get statistiques RH error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;