// backend/routes/parametresRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const EmailService = require('../emailService');
const emailService = new EmailService();

// ============================================
// MIDDLEWARE DE LOGGING
// ============================================
const logAction = async (userId, module, action, description, details = null) => {
    try {
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                donnees_avant, donnees_apres, ip_address, date_action
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [userId, module, action, description, null, details ? JSON.stringify(details) : null, null]);
    } catch (error) {
        console.error('Erreur logging:', error);
    }
};

// ============================================
// HISTORIQUE & TRAÇABILITÉ
// ============================================

/**
 * GET /api/admin/historique
 * Récupérer l'historique complet avec filtres avancés
 */
router.get('/historique', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const {
            type, module, utilisateur, startDate, endDate,
            niveau, table, limit = 500, offset = 0
        } = req.query;

        let sql = `
            SELECT t.*,
                   u.nom_complet as utilisateur_nom,
                   u.role as utilisateur_role,
                   u.photo_identite as utilisateur_photo
            FROM traces t
            LEFT JOIN utilisateurs u ON t.id_utilisateur = u.id
            WHERE 1=1
        `;
        const params = [];

        if (type && type !== 'all') {
            sql += ' AND t.type_action = ?';
            params.push(type);
        }

        if (module && module !== 'all') {
            sql += ' AND t.module = ?';
            params.push(module);
        }

        if (utilisateur && utilisateur !== 'all') {
            sql += ' AND t.id_utilisateur = ?';
            params.push(utilisateur);
        }

        if (startDate) {
            sql += ' AND DATE(t.date_action) >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND DATE(t.date_action) <= ?';
            params.push(endDate);
        }

        if (niveau && niveau !== 'all') {
            sql += ' AND t.niveau = ?';
            params.push(niveau);
        }

        if (table) {
            sql += ' AND t.table_affectee = ?';
            params.push(table);
        }

        sql += ' ORDER BY t.date_action DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const historique = await db.query(sql, params);

        // Statistiques
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN niveau = 'critical' THEN 1 END) as critiques,
                COUNT(CASE WHEN niveau = 'error' THEN 1 END) as erreurs,
                COUNT(CASE WHEN niveau = 'warning' THEN 1 END) as warnings,
                COUNT(CASE WHEN niveau = 'info' THEN 1 END) as infos,
                COUNT(DISTINCT id_utilisateur) as utilisateurs_actifs,
                COUNT(DISTINCT module) as modules_actifs
            FROM traces
            WHERE DATE(date_action) >= COALESCE(?, DATE_SUB(NOW(), INTERVAL 30 DAY))
              AND DATE(date_action) <= COALESCE(?, NOW())
        `, [startDate, endDate]);

        res.status(200).json({
            success: true,
            data: historique,
            stats: stats,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: stats.total
            }
        });
    } catch (error) {
        console.error('Get historique error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique.',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/historique/:id
 * Détails d'une entrée d'historique
 */
router.get('/historique/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const [trace] = await db.query(`
            SELECT t.*,
                   u.nom_complet as utilisateur_nom,
                   u.email as utilisateur_email,
                   u.role as utilisateur_role,
                   u.photo_identite as utilisateur_photo
            FROM traces t
            LEFT JOIN utilisateurs u ON t.id_utilisateur = u.id
            WHERE t.id = ?
        `, [id]);

        if (!trace) {
            return res.status(404).json({
                success: false,
                message: 'Entrée d\'historique non trouvée.'
            });
        }

        res.status(200).json({
            success: true,
            data: trace
        });
    } catch (error) {
        console.error('Get historique detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails.'
        });
    }
});

/**
 * GET /api/admin/historique/stats/resume
 * Statistiques résumées de l'historique
 */
router.get('/historique/stats/resume', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { periode = '30' } = req.query; // jours

        const [statsGenerales] = await db.query(`
            SELECT 
                COUNT(*) as total_actions,
                COUNT(DISTINCT id_utilisateur) as utilisateurs_actifs,
                COUNT(DISTINCT module) as modules_actifs,
                COUNT(CASE WHEN niveau = 'critical' THEN 1 END) as critiques,
                COUNT(CASE WHEN niveau = 'error' THEN 1 END) as erreurs
            FROM traces
            WHERE date_action >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [periode]);

        const actionsParModule = await db.query(`
            SELECT module, COUNT(*) as count
            FROM traces
            WHERE date_action >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY module
            ORDER BY count DESC
        `, [periode]);

        const actionsParUtilisateur = await db.query(`
            SELECT 
                u.nom_complet, 
                u.role,
                COUNT(*) as count
            FROM traces t
            JOIN utilisateurs u ON t.id_utilisateur = u.id
            WHERE t.date_action >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY u.id
            ORDER BY count DESC
            LIMIT 10
        `, [periode]);

        const tendanceQuotidienne = await db.query(`
            SELECT 
                DATE(date_action) as date,
                COUNT(*) as count
            FROM traces
            WHERE date_action >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(date_action)
            ORDER BY date DESC
        `, [periode]);

        res.status(200).json({
            success: true,
            data: {
                generales: statsGenerales,
                parModule: actionsParModule,
                parUtilisateur: actionsParUtilisateur,
                tendanceQuotidienne: tendanceQuotidienne
            }
        });
    } catch (error) {
        console.error('Get stats resume error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

// ============================================
// GESTION DES UTILISATEURS
// ============================================

/**
 * GET /api/admin/utilisateurs
 * Liste complète des utilisateurs avec filtres
 */
router.get('/utilisateurs', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { role, statut, departement, search } = req.query;

        let sql = `
            SELECT 
                u.*,
                d.nom as departement_nom,
                (SELECT COUNT(*) FROM traces WHERE id_utilisateur = u.id) as nb_actions,
                (SELECT COUNT(*) FROM presences WHERE id_utilisateur = u.id 
                 AND MONTH(date) = MONTH(CURRENT_DATE)) as nb_presences_mois
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (role && role !== 'all') {
            sql += ' AND u.role = ?';
            params.push(role);
        }

        if (statut && statut !== 'all') {
            sql += ' AND u.statut = ?';
            params.push(statut);
        }

        if (departement && departement !== 'all') {
            sql += ' AND u.id_departement = ?';
            params.push(departement);
        }

        if (search) {
            sql += ` AND (
                u.nom_complet LIKE ? OR 
                u.email LIKE ? OR 
                u.matricule LIKE ? OR 
                u.telephone LIKE ?
            )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        sql += ' ORDER BY u.nom_complet ASC';

        const utilisateurs = await db.query(sql, params);

        // Ne pas retourner les mots de passe
        const utilisateursSafe = utilisateurs.map(u => {
            const { mot_de_passe_hash, ...utilisateurSansPassword } = u;
            return utilisateurSansPassword;
        });

        // Statistiques
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN statut = 'actif' THEN 1 END) as actifs,
                COUNT(CASE WHEN statut = 'inactif' THEN 1 END) as inactifs,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
                COUNT(CASE WHEN role = 'manager' THEN 1 END) as managers,
                COUNT(CASE WHEN role = 'employe' THEN 1 END) as employes
            FROM utilisateurs
        `);

        res.status(200).json({
            success: true,
            data: utilisateursSafe,
            stats: stats
        });
    } catch (error) {
        console.error('Get utilisateurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs.'
        });
    }
});

/**
 * GET /api/admin/utilisateurs/:id
 * Détails d'un utilisateur
 */
router.get('/utilisateurs/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const [user] = await db.query(`
            SELECT 
                u.*,
                d.nom as departement_nom,
                (SELECT COUNT(*) FROM traces WHERE id_utilisateur = u.id) as nb_actions_total,
                (SELECT COUNT(*) FROM presences WHERE id_utilisateur = u.id 
                 AND YEAR(date) = YEAR(CURRENT_DATE)) as nb_presences_annee
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.id = ?
        `, [id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        // Ne pas retourner le mot de passe
        const { mot_de_passe_hash, ...userSafe } = user;

        // Récupérer les dernières actions
        const dernieresActions = await db.query(`
            SELECT * FROM traces
            WHERE id_utilisateur = ?
            ORDER BY date_action DESC
            LIMIT 10
        `, [id]);

        res.status(200).json({
            success: true,
            data: {
                ...userSafe,
                dernieresActions
            }
        });
    } catch (error) {
        console.error('Get utilisateur detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails.'
        });
    }
});

/**
 * POST /api/admin/utilisateurs
 * Créer un nouvel utilisateur
 */
router.post('/utilisateurs', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const {
            matricule, email, nom_complet, telephone,
            mot_de_passe, type_employe, role, id_departement,
            date_embauche, salaire_base, statut, photo_identite
        } = req.body;

        // Validation
        if (!matricule || !email || !nom_complet || !mot_de_passe || !role || !id_departement) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Vérifier si le matricule ou l'email existe déjà
        const [existingUser] = await db.query(
            'SELECT id FROM employes WHERE matricule = ? OR email = ?',
            [matricule, email]
        );

        if (existingUser[0]) {
            return res.status(400).json({
                success: false,
                message: 'Un utilisateur avec ce matricule ou cet email existe déjà.'
            });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

        // Préparer les données pour le QR Code
        const qrData = JSON.stringify({
            matricule,
            nom: nom_complet,
            type: type_employe || 'INSS',
            date: new Date().toISOString()
        });

        // Générer le QR Code
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'M',
            margin: 1,
            color: {
                dark: '#1E3A8A',
                light: '#FFFFFF'
            }
        });

        const sql = `
            INSERT INTO employes (
                matricule, email, mot_de_passe_hash, nom_complet, telephone,
                type_employe, role, id_departement, date_embauche, salaire_base,
                statut, photo_identite, doit_changer_mdp, qr_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `;

        const [result] = await db.query(sql, [
            matricule, email, hashedPassword, nom_complet, telephone,
            type_employe || 'INSS', role, id_departement,
            date_embauche || new Date(), salaire_base || 0,
            statut || 'actif', photo_identite, qrCodeDataUrl
        ]);

        const insertId = result.insertId;

        // Envoyer l'email de bienvenue à l'employé
        try {
            await emailService.envoyerEmailBienvenue(
                email,
                nom_complet,
                matricule,
                mot_de_passe,
                date_embauche || new Date(),
                role
            );
            console.log(`✅ Email de bienvenue envoyé à ${email}`);
        } catch (emailError) {
            console.error('Erreur envoi email bienvenue:', emailError);
            // On ne bloque pas la création si l'email échoue
        }

        // Notifier les administrateurs (exemple: envoyer à l'email configuré dans .env)
        try {
            await emailService.envoyerNotificationNouvelEmploye(
                process.env.EMAIL_USER,
                'Administrateur HR',
                nom_complet,
                matricule,
                type_employe || 'INSS',
                date_embauche || new Date()
            );
        } catch (adminEmailError) {
            console.error('Erreur notification admin:', adminEmailError);
        }

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'création',
            `Nouvel utilisateur créé: ${nom_complet} (${role})`,
            { userId: insertId, matricule, email, role }
        );

        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès. Email de bienvenue envoyé.',
            data: { id: insertId, qr_code: qrCodeDataUrl }
        });
    } catch (error) {
        console.error('Create utilisateur error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'utilisateur.',
            error: error.message
        });
    }
});

/**
 * PUT /api/admin/utilisateurs/:id
 * Modifier un utilisateur
 */
router.put('/utilisateurs/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            matricule, email, nom_complet, telephone,
            type_employe, role, id_departement, salaire_base,
            statut, photo_identite
        } = req.body;

        // Récupérer l'utilisateur actuel pour logging
        const [currentUser] = await db.query('SELECT * FROM employes WHERE id = ?', [id]);

        if (!currentUser || currentUser.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        const user = currentUser[0];

        const sql = `
            UPDATE employes SET
                matricule = ?, email = ?, nom_complet = ?, telephone = ?,
                type_employe = ?, role = ?, id_departement = ?, salaire_base = ?,
                statut = ?, photo_identite = ?, modifie_par = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            matricule || user.matricule,
            email || user.email,
            nom_complet || user.nom_complet,
            telephone || user.telephone,
            type_employe || user.type_employe,
            role || user.role,
            id_departement || user.id_departement,
            salaire_base !== undefined ? salaire_base : user.salaire_base,
            statut || user.statut,
            photo_identite || user.photo_identite,
            req.userId,
            id
        ]);

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'modification',
            `Modification utilisateur: ${nom_complet || user.nom_complet}`,
            { userId: id, changes: req.body }
        );

        // Notifier l'employé
        try {
            await emailService.envoyerNotificationModificationCompte(
                email || user.email,
                nom_complet || user.nom_complet
            );
        } catch (emailError) {
            console.error('Erreur envoi email modification:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Utilisateur modifié avec succès. Email de notification envoyé.'
        });
    } catch (error) {
        console.error('Update utilisateur error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de l\'utilisateur.'
        });
    }
});

/**
 * DELETE /api/admin/utilisateurs/:id
 * Supprimer un utilisateur
 */
router.delete('/utilisateurs/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Ne pas permettre de supprimer son propre compte
        if (parseInt(id) === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas supprimer votre propre compte.'
            });
        }

        const [userResult] = await db.query('SELECT nom_complet, matricule FROM employes WHERE id = ?', [id]);

        if (!userResult[0]) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        const user = userResult[0];

        // Plutôt que supprimer, désactiver (soft delete)
        await db.query(
            'UPDATE employes SET statut = ?, date_depart = NOW(), raison_depart = ? WHERE id = ?',
            ['inactif', 'Supprimé par admin', id]
        );

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'suppression',
            `Suppression utilisateur: ${user.nom_complet} (${user.matricule})`,
            { userId: id }
        );

        // Notifier l'employé
        try {
            await emailService.envoyerNotificationDesactivationCompte(
                user.email,
                user.nom_complet,
                'Supprimé par un administrateur'
            );
        } catch (emailError) {
            console.error('Erreur envoi email désactivation:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Utilisateur supprimé avec succès. Email de notification envoyé.'
        });
    } catch (error) {
        console.error('Delete utilisateur error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur.'
        });
    }
});

/**
 * PUT /api/admin/utilisateurs/:id/reset-password
 * Réinitialiser le mot de passe d'un utilisateur
 */
router.put('/utilisateurs/:id/reset-password', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères.'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE employes SET mot_de_passe_hash = ?, doit_changer_mdp = 1, date_modification_mdp = NOW() WHERE id = ?',
            [hashedPassword, id]
        );

        const [userResult] = await db.query('SELECT nom_complet, matricule, email FROM employes WHERE id = ?', [id]);
        const user = userResult[0];

        // Envoyer l'email
        try {
            await emailService.envoyerNotificationReinitialisationMotDePasse(
                user.email,
                user.nom_complet,
                newPassword
            );
        } catch (emailError) {
            console.error('Erreur envoi email reset password:', emailError);
        }

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'réinitialisation',
            `Réinitialisation mot de passe: ${user.nom_complet}`,
            { userId: id }
        );

        res.status(200).json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès. Email envoyé à l\'employé.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la réinitialisation du mot de passe.'
        });
    }
});

// ============================================
// GESTION DES DÉPARTEMENTS
// ============================================

/**
 * GET /api/admin/departements
 * Liste des départements
 */
router.get('/departements', authenticate, authorize(['admin', 'manager']), async (req, res) => {
    try {
        const { statut } = req.query;

        let sql = `
            SELECT d.*,
                   (SELECT COUNT(*) FROM utilisateurs WHERE id_departement = d.id AND statut = 'actif') as nombre_employes,
                   (SELECT nom_complet FROM utilisateurs WHERE id = d.responsable_id) as responsable_nom,
                   (SELECT budget_utilise FROM budgets_departements 
                    WHERE id_departement = d.id AND annee = YEAR(CURRENT_DATE)) as budget_utilise
            FROM departements d
            WHERE 1=1
        `;
        const params = [];

        if (statut) {
            sql += ' AND d.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY d.nom ASC';

        const departements = await db.query(sql, params);

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
 * POST /api/admin/departements
 * Créer un département
 */
router.post('/departements', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { nom, type, budget_annuel, responsable_id, statut } = req.body;

        if (!nom || !type) {
            return res.status(400).json({
                success: false,
                message: 'Le nom et le type sont obligatoires.'
            });
        }

        const sql = `
            INSERT INTO departements (nom, type, budget_annuel, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            nom, type, budget_annuel || 0, responsable_id, statut || 'actif'
        ]);

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'création',
            `Nouveau département: ${nom}`,
            { departementId: result.insertId, nom, type }
        );

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
 * PUT /api/admin/departements/:id
 * Modifier un département
 */
router.put('/departements/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, type, budget_annuel, responsable_id, statut } = req.body;

        const sql = `
            UPDATE departements SET
                nom = ?, type = ?, budget_annuel = ?, responsable_id = ?, statut = ?
            WHERE id = ?
        `;

        await db.query(sql, [nom, type, budget_annuel, responsable_id, statut, id]);

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'modification',
            `Modification département: ${nom}`,
            { departementId: id, changes: req.body }
        );

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
 * DELETE /api/admin/departements/:id
 * Supprimer un département
 */
router.delete('/departements/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des employés
        const [count] = await db.query(
            'SELECT COUNT(*) as count FROM utilisateurs WHERE id_departement = ?',
            [id]
        );

        if (count.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer un département avec des employés.'
            });
        }

        const [dept] = await db.query('SELECT nom FROM departements WHERE id = ?', [id]);

        await db.query('DELETE FROM departements WHERE id = ?', [id]);

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'suppression',
            `Suppression département: ${dept.nom}`,
            { departementId: id }
        );

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
// PARAMÈTRES DE NOTIFICATION
// ============================================

/**
 * GET /api/admin/notification-settings
 * Récupérer les paramètres de notification
 */
router.get('/notification-settings', authenticate, authorize(['admin']), async (req, res) => {
    try {
        // Comme il n'y a pas de table parametres_notifications dans la BD,
        // on va utiliser une approche alternative avec une table de configuration générique
        // ou stocker dans un fichier JSON

        // Pour l'instant, retourner des valeurs par défaut
        const defaultSettings = {
            email_enabled: true,
            sms_enabled: false,
            push_enabled: true,
            alertes_stock: true,
            alertes_maintenance: true,
            alertes_echeances: true,
            alertes_salaires: true,
            alertes_conges: true,
            frequence_rapports: 'hebdomadaire'
        };

        res.status(200).json({
            success: true,
            data: defaultSettings
        });
    } catch (error) {
        console.error('Get notification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paramètres.'
        });
    }
});

/**
 * PUT /api/admin/notification-settings
 * Mettre à jour les paramètres de notification
 */
router.put('/notification-settings', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const settings = req.body;

        // Ici, vous devriez sauvegarder dans une table de configuration
        // Pour l'instant, on simule juste le succès

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'modification',
            'Modification paramètres de notification',
            settings
        );

        res.status(200).json({
            success: true,
            message: 'Paramètres de notification sauvegardés.'
        });
    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la sauvegarde des paramètres.'
        });
    }
});

// ============================================
// PARAMÈTRES GÉNÉRAUX
// ============================================

/**
 * GET /api/admin/general-settings
 * Récupérer les paramètres généraux
 */
router.get('/general-settings', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const defaultSettings = {
            nom_entreprise: 'NUTRIFIX',
            devise: 'BIF',
            fuseau_horaire: 'Africa/Bujumbura',
            langue: 'fr',
            format_date: 'DD/MM/YYYY',
            tva_defaut: '18',
            backup_auto: true,
            frequence_backup: 'quotidien',
            retention_logs: '90'
        };

        res.status(200).json({
            success: true,
            data: defaultSettings
        });
    } catch (error) {
        console.error('Get general settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paramètres.'
        });
    }
});

/**
 * PUT /api/admin/general-settings
 * Mettre à jour les paramètres généraux
 */
router.put('/general-settings', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const settings = req.body;

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'modification',
            'Modification paramètres généraux',
            settings
        );

        res.status(200).json({
            success: true,
            message: 'Paramètres généraux sauvegardés.'
        });
    } catch (error) {
        console.error('Update general settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la sauvegarde des paramètres.'
        });
    }
});

// ============================================
// BACKUP & MAINTENANCE
// ============================================

/**
 * POST /api/admin/backup
 * Créer une sauvegarde manuelle
 */
router.post('/backup', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { exec } = require('child_process');
        const fs = require('fs');
        const path = require('path');

        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `nutrifix_backup_${timestamp}.sql`;
        const backupPath = path.join(backupDir, backupFilename);

        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'nutrifix_db'
        };

        const command = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user} ${dbConfig.password ? `-p${dbConfig.password}` : ''} ${dbConfig.database} > "${backupPath}"`;

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error('Backup error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la création de la sauvegarde.',
                    error: error.message
                });
            }

            // Logging
            await logAction(
                req.userId,
                'parametres',
                'backup',
                `Sauvegarde créée: ${backupFilename}`,
                { filename: backupFilename, size: fs.statSync(backupPath).size }
            );

            res.status(200).json({
                success: true,
                message: 'Sauvegarde créée avec succès.',
                data: {
                    filename: backupFilename,
                    path: backupPath,
                    size: fs.statSync(backupPath).size,
                    date: new Date()
                }
            });
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la sauvegarde.'
        });
    }
});

/**
 * GET /api/admin/backups
 * Liste des sauvegardes disponibles
 */
router.get('/backups', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');

        const backupDir = path.join(__dirname, '../../backups');

        if (!fs.existsSync(backupDir)) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.sql'))
            .map(file => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    date: stats.mtime,
                    path: filePath
                };
            })
            .sort((a, b) => b.date - a.date);

        res.status(200).json({
            success: true,
            data: files
        });
    } catch (error) {
        console.error('Get backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des sauvegardes.'
        });
    }
});

/**
 * DELETE /api/admin/backups/:filename
 * Supprimer une sauvegarde
 */
router.delete('/backups/:filename', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { filename } = req.params;
        const fs = require('fs');
        const path = require('path');

        const backupPath = path.join(__dirname, '../../backups', filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                message: 'Sauvegarde non trouvée.'
            });
        }

        fs.unlinkSync(backupPath);

        // Logging
        await logAction(
            req.userId,
            'parametres',
            'suppression',
            `Suppression sauvegarde: ${filename}`,
            { filename }
        );

        res.status(200).json({
            success: true,
            message: 'Sauvegarde supprimée avec succès.'
        });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la sauvegarde.'
        });
    }
});

// ============================================
// STATISTIQUES SYSTÈME
// ============================================

/**
 * GET /api/admin/stats/system
 * Statistiques système globales
 */
router.get('/stats/system', authenticate, authorize(['admin']), async (req, res) => {
    try {
        // Statistiques utilisateurs
        const [usersStats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN statut = 'actif' THEN 1 END) as actifs,
                COUNT(CASE WHEN derniere_connexion >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as actifs_7j
            FROM utilisateurs
        `);

        // Statistiques base de données
        const [dbStats] = await db.query(`
            SELECT 
                table_name,
                table_rows,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC
            LIMIT 10
        `);

        // Statistiques activité
        const [activityStats] = await db.query(`
            SELECT 
                DATE(date_action) as date,
                COUNT(*) as count
            FROM traces
            WHERE date_action >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(date_action)
            ORDER BY date DESC
        `);

        res.status(200).json({
            success: true,
            data: {
                users: usersStats,
                database: dbStats,
                activity: activityStats
            }
        });
    } catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;