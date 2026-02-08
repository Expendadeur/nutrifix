const express = require('express');
const router = express.Router();
const { 
    authenticateFingerprint, 
    registerFingerprint, 
    deleteFingerprint,
    authenticate,
    authorize
} = require('../middleware/auth');

// ============================================
// AUTHENTIFICATION PAR EMPREINTE DIGITALE
// ============================================
router.post('/fingerprint/login', authenticateFingerprint, (req, res) => {
    try {
        const userData = {
            id: req.user.id,
            matricule: req.user.matricule,
            email: req.user.email,
            nom_complet: req.user.nom_complet,
            role: req.user.role,
            type_employe: req.user.type_employe,
            id_departement: req.user.id_departement,
            departement_nom: req.user.departement_nom,
            departement_type: req.user.departement_type,
            photo_identite: req.user.photo_identite
        };

        res.status(200).json({
            success: true,
            message: 'Authentification par empreinte digitale réussie.',
            token: req.token,
            user: userData
        });
    } catch (error) {
        console.error('Fingerprint login response error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion.'
        });
    }
});

// ============================================
// ENREGISTREMENT EMPREINTE DIGITALE
// ============================================
router.post('/fingerprint/register', authenticate, registerFingerprint, (req, res) => {
    // La réponse est déjà gérée dans le middleware registerFingerprint
});

// ============================================
// VERIFICATION EMPREINTE ENREGISTREE
// ============================================
router.get('/fingerprint/check/:userId', authenticate, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Permission refusée.'
            });
        }

        const userSql = `
            SELECT id, matricule, nom_complet, 
                   CASE WHEN donnees_biometriques IS NOT NULL THEN TRUE ELSE FALSE END as has_fingerprint,
                   CASE WHEN donnees_biometriques IS NOT NULL 
                        THEN JSON_EXTRACT(donnees_biometriques, '$.enrollmentDate')
                        ELSE NULL END as enrollment_date
            FROM utilisateurs 
            WHERE id = ?
        `;
        
        const [user] = await req.db.query(userSql, [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                userId: user.id,
                matricule: user.matricule,
                nom_complet: user.nom_complet,
                has_fingerprint: user.has_fingerprint,
                enrollment_date: user.enrollment_date
            }
        });
    } catch (error) {
        console.error('Check fingerprint error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification.'
        });
    }
});

// ============================================
// MISE A JOUR EMPREINTE DIGITALE
// ============================================
router.put('/fingerprint/update/:userId', authenticate, registerFingerprint, (req, res) => {
    // La mise à jour utilise la même logique que l'enregistrement
});

// ============================================
// SUPPRESSION EMPREINTE DIGITALE
// ============================================
router.delete('/fingerprint/:userId', authenticate, deleteFingerprint, (req, res) => {
    // La réponse est déjà gérée dans le middleware deleteFingerprint
});

// ============================================
// LISTE UTILISATEURS AVEC EMPREINTE
// ============================================
router.get('/fingerprint/users', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { departement, has_fingerprint } = req.query;
        
        let sql = `
            SELECT u.id, u.matricule, u.nom_complet, u.email, 
                   u.role, u.type_employe,
                   d.nom as departement_nom,
                   CASE WHEN u.donnees_biometriques IS NOT NULL THEN TRUE ELSE FALSE END as has_fingerprint,
                   CASE WHEN u.donnees_biometriques IS NOT NULL 
                        THEN JSON_EXTRACT(u.donnees_biometriques, '$.enrollmentDate')
                        ELSE NULL END as enrollment_date
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.statut = 'actif'
        `;
        
        const params = [];

        // Filter par département pour les managers
        if (req.user.role === 'manager') {
            sql += ' AND u.id_departement = ?';
            params.push(req.user.id_departement);
        } else if (departement) {
            sql += ' AND u.id_departement = ?';
            params.push(departement);
        }

        // Filter par présence d'empreinte
        if (has_fingerprint !== undefined) {
            if (has_fingerprint === 'true') {
                sql += ' AND u.donnees_biometriques IS NOT NULL';
            } else {
                sql += ' AND u.donnees_biometriques IS NULL';
            }
        }

        sql += ' ORDER BY u.nom_complet ASC';

        const users = await req.db.query(sql, params);

        res.status(200).json({
            success: true,
            total: users.length,
            data: users
        });
    } catch (error) {
        console.error('Get fingerprint users error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs.'
        });
    }
});

// ============================================
// STATISTIQUES EMPREINTES DIGITALES
// ============================================
router.get('/fingerprint/stats', authenticate, authorize('admin'), async (req, res) => {
    try {
        const statsSql = `
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) as users_with_fingerprint,
                SUM(CASE WHEN donnees_biometriques IS NULL THEN 1 ELSE 0 END) as users_without_fingerprint,
                ROUND(
                    (SUM(CASE WHEN donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) * 100, 
                    2
                ) as coverage_percentage
            FROM utilisateurs
            WHERE statut = 'actif'
        `;

        const [stats] = await req.db.query(statsSql);

        // Stats par département
        const deptStatsSql = `
            SELECT 
                d.nom as departement,
                COUNT(u.id) as total_users,
                SUM(CASE WHEN u.donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) as with_fingerprint,
                ROUND(
                    (SUM(CASE WHEN u.donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) / COUNT(u.id)) * 100, 
                    2
                ) as coverage_percentage
            FROM departements d
            LEFT JOIN utilisateurs u ON d.id = u.id_departement AND u.statut = 'actif'
            GROUP BY d.id, d.nom
            ORDER BY d.nom
        `;

        const deptStats = await req.db.query(deptStatsSql);

        // Stats par rôle
        const roleStatsSql = `
            SELECT 
                role,
                COUNT(*) as total_users,
                SUM(CASE WHEN donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) as with_fingerprint,
                ROUND(
                    (SUM(CASE WHEN donnees_biometriques IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) * 100, 
                    2
                ) as coverage_percentage
            FROM utilisateurs
            WHERE statut = 'actif'
            GROUP BY role
            ORDER BY role
        `;

        const roleStats = await req.db.query(roleStatsSql);

        res.status(200).json({
            success: true,
            data: {
                global: stats,
                by_department: deptStats,
                by_role: roleStats
            }
        });
    } catch (error) {
        console.error('Get fingerprint stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

// ============================================
// HISTORIQUE AUTHENTIFICATIONS PAR EMPREINTE
// ============================================
router.get('/fingerprint/history/:userId', authenticate, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { limit = 50, offset = 0 } = req.query;

        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Permission refusée.'
            });
        }

        const historySql = `
            SELECT 
                type_action,
                action_details,
                ip_address,
                user_agent,
                niveau,
                date_action
            FROM traces
            WHERE id_utilisateur = ?
            AND type_action IN ('FINGERPRINT_AUTH_SUCCESS', 'FAILED_FINGERPRINT_AUTH')
            ORDER BY date_action DESC
            LIMIT ? OFFSET ?
        `;

        const history = await req.db.query(historySql, [userId, parseInt(limit), parseInt(offset)]);

        // Count total
        const countSql = `
            SELECT COUNT(*) as total
            FROM traces
            WHERE id_utilisateur = ?
            AND type_action IN ('FINGERPRINT_AUTH_SUCCESS', 'FAILED_FINGERPRINT_AUTH')
        `;

        const [countResult] = await req.db.query(countSql, [userId]);

        res.status(200).json({
            success: true,
            total: countResult.total,
            data: history.map(record => ({
                ...record,
                action_details: typeof record.action_details === 'string' 
                    ? JSON.parse(record.action_details) 
                    : record.action_details
            }))
        });
    } catch (error) {
        console.error('Get fingerprint history error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique.'
        });
    }
});

module.exports = router;
