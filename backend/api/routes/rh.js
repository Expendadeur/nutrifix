const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');
const db = require('../../database/db');

// Gestion des employés - Admin seulement
router.get('/employes', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            role,
            departement,
            statut,
            search,
            type_employe
        } = req.query;

        const filters = {
            page: parseInt(page),
            limit: parseInt(limit),
            role,
            departement,
            statut,
            search,
            type_employe
        };

        // If manager, only show their department
        if (req.userRole === 'manager') {
            filters.departement = req.user.id_departement;
        }

        const employes = await User.getAll(filters);
        const total = await User.count(filters);

        res.status(200).json({
            success: true,
            data: employes,
            pagination: {
                total,
                page: filters.page,
                limit: filters.limit,
                pages: Math.ceil(total / filters.limit)
            }
        });
    } catch (error) {
        console.error('Get employes error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des employés.'
        });
    }
});

// Créer un nouvel employé
router.post('/employes', authenticate, authorize('admin'), async (req, res) => {
    try {
        const userData = req.body;
        userData.cree_par = req.userId;

        const userId = await User.create(userData);

        res.status(201).json({
            success: true,
            message: 'Employé créé avec succès.',
            userId
        });
    } catch (error) {
        console.error('Create employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'employé.'
        });
    }
});

// Obtenir les détails d'un employé
router.get('/employes/:id', authenticate, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Check authorization
        if (req.userRole !== 'admin' && req.userRole !== 'manager' && req.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé.'
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Employé non trouvé.'
            });
        }

        // If manager, check department
        if (req.userRole === 'manager' && user.id_departement !== req.user.id_departement) {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé.'
            });
        }

        // Remove sensitive data
        delete user.mot_de_passe_hash;

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'employé.'
        });
    }
});

// Mettre à jour un employé
router.put('/employes/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const updateData = req.body;
        updateData.modifie_par = req.userId;

        await User.update(userId, updateData);

        res.status(200).json({
            success: true,
            message: 'Employé mis à jour avec succès.'
        });
    } catch (error) {
        console.error('Update employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'employé.'
        });
    }
});

// Désactiver un employé
router.put('/employes/:id/desactiver', authenticate, authorize('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { raison_depart } = req.body;

        await User.update(userId, {
            statut: 'inactif',
            date_depart: new Date(),
            raison_depart,
            modifie_par: req.userId
        });

        res.status(200).json({
            success: true,
            message: 'Employé désactivé avec succès.'
        });
    } catch (error) {
        console.error('Desactivate employe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désactivation de l\'employé.'
        });
    }
});

// Gestion des présences
router.post('/presences', authenticate, async (req, res) => {
    try {
        const { date, heure_entree, localisation_entree } = req.body;

        if (!date || !heure_entree) {
            return res.status(400).json({
                success: false,
                message: 'Date et heure d\'entrée requises.'
            });
        }

        // Check if already checked in today
        const existingSql = `
            SELECT * FROM presences 
            WHERE id_utilisateur = ? AND date = ?
        `;
        const existing = await db.query(existingSql, [req.userId, date]);

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Pointage déjà effectué pour aujourd\'hui.'
            });
        }

        // Insert presence
        const sql = `
            INSERT INTO presences (
                id_utilisateur, date, heure_entree, 
                localisation_entree, statut
            ) VALUES (?, ?, ?, ?, 'present')
        `;

        await db.query(sql, [
            req.userId,
            date,
            heure_entree,
            localisation_entree
        ]);

        res.status(201).json({
            success: true,
            message: 'Pointage d\'entrée enregistré.'
        });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du pointage.'
        });
    }
});

// Pointage de sortie
router.put('/presences/sortie', authenticate, async (req, res) => {
    try {
        const { date, heure_sortie, localisation_sortie } = req.body;

        if (!date || !heure_sortie) {
            return res.status(400).json({
                success: false,
                message: 'Date et heure de sortie requises.'
            });
        }

        // Find today's presence
        const sql = `
            UPDATE presences 
            SET heure_sortie = ?, 
                localisation_sortie = ?,
                date_modification = NOW()
            WHERE id_utilisateur = ? 
            AND date = ? 
            AND heure_sortie IS NULL
        `;

        const result = await db.query(sql, [
            heure_sortie,
            localisation_sortie,
            req.userId,
            date
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun pointage d\'entrée trouvé ou déjà pointé.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Pointage de sortie enregistré.'
        });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du pointage de sortie.'
        });
    }
});

// Obtenir l'historique des présences
router.get('/presences', authenticate, async (req, res) => {
    try {
        const {
            userId,
            startDate,
            endDate,
            page = 1,
            limit = 30
        } = req.query;

        const pPage = parseInt(page);
        const pLimit = parseInt(limit);

        // Determine user ID
        const targetUserId = userId ? parseInt(userId) : req.userId;

        // Check authorization
        if (targetUserId !== req.userId &&
            req.userRole !== 'admin' &&
            req.userRole !== 'manager') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé.'
            });
        }

        let sql = `
            SELECT p.*, u.nom_complet, u.matricule
            FROM presences p
            JOIN utilisateurs u ON p.id_utilisateur = u.id
            WHERE p.id_utilisateur = ?
        `;
        const params = [targetUserId];

        if (startDate) {
            sql += ' AND p.date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND p.date <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY p.date DESC';

        // Pagination
        const offset = (pPage - 1) * pLimit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(pLimit, offset);

        const presences = await db.query(sql, params);

        // Count total
        let countSql = `
            SELECT COUNT(*) as total 
            FROM presences 
            WHERE id_utilisateur = ?
        `;
        const countParams = [targetUserId];

        if (startDate) {
            countSql += ' AND date >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countSql += ' AND date <= ?';
            countParams.push(endDate);
        }

        const resultsCountAll = await db.query(countSql, countParams);
        const countResult = (resultsCountAll && resultsCountAll.length > 0) ? resultsCountAll[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: presences,
            pagination: {
                total: countResult.total,
                page: pPage,
                limit: pLimit,
                pages: Math.ceil(countResult.total / pLimit)
            }
        });
    } catch (error) {
        console.error('Get presences error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des présences.'
        });
    }
});

// Gestion des congés - Demander un congé
router.post('/conges', authenticate, async (req, res) => {
    try {
        const {
            type_conge,
            date_debut,
            date_fin,
            raison,
            pieces_jointes
        } = req.body;

        // Validation
        if (!type_conge || !date_debut || !date_fin || !raison) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires sont requis.'
            });
        }

        // Check if dates are valid
        const start = new Date(date_debut);
        const end = new Date(date_fin);

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: 'La date de début doit être avant la date de fin.'
            });
        }

        // Calculate days
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        // Check available leave balance (simplified)
        // In production, implement proper leave balance calculation

        const sql = `
            INSERT INTO conges (
                id_utilisateur, type_conge, date_debut, date_fin,
                raison, pieces_jointes, statut, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, 'en_attente', ?)
        `;

        await db.query(sql, [
            req.userId,
            type_conge,
            date_debut,
            date_fin,
            raison,
            pieces_jointes,
            req.userId
        ]);

        // Send notification to manager/admin
        if (req.io) {
            req.io.to(`dept-${req.user.id_departement}`).emit('new-notification', {
                type: 'approbation',
                titre: 'Nouvelle demande de congé',
                message: `${req.user.nom_complet} a demandé un congé`,
                userId: req.userId
            });
        }

        res.status(201).json({
            success: true,
            message: 'Demande de congé envoyée avec succès.'
        });
    } catch (error) {
        console.error('Create conge error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la demande de congé.'
        });
    }
});

// Obtenir les congés d'un employé
router.get('/conges', authenticate, async (req, res) => {
    try {
        const { userId, statut, page = 1, limit = 20 } = req.query;

        const pPage = parseInt(page);
        const pLimit = parseInt(limit);

        // Determine user ID
        const targetUserId = userId ? parseInt(userId) : req.userId;

        // Check authorization
        if (targetUserId !== req.userId &&
            req.userRole !== 'admin' &&
            req.userRole !== 'manager') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé.'
            });
        }

        let sql = `
            SELECT c.*, u.nom_complet, u.matricule
            FROM conges c
            JOIN utilisateurs u ON c.id_utilisateur = u.id
            WHERE c.id_utilisateur = ?
        `;
        const params = [targetUserId];

        if (statut) {
            sql += ' AND c.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY c.date_debut DESC';

        // Pagination
        const offset = (pPage - 1) * pLimit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(pLimit, offset);

        const conges = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM conges WHERE id_utilisateur = ?`;
        const countParams = [targetUserId];

        if (statut) {
            countSql += ' AND statut = ?';
            countParams.push(statut);
        }

        const resultsCountLeave = await db.query(countSql, countParams);
        const countResult = (resultsCountLeave && resultsCountLeave.length > 0) ? resultsCountLeave[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: conges,
            pagination: {
                total: countResult.total,
                page: pPage,
                limit: pLimit,
                pages: Math.ceil(countResult.total / pLimit)
            }
        });
    } catch (error) {
        console.error('Get conges error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des congés.'
        });
    }
});

// Approuver/Rejeter un congé (Admin/Manager)
router.put('/conges/:id/validation', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const congeId = parseInt(req.params.id);
        const { decision, commentaire } = req.body;

        if (!['approuve', 'rejete'].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: 'Décision invalide.'
            });
        }

        const sql = `
            UPDATE conges 
            SET statut = ?,
                valide_par = ?,
                date_validation = NOW(),
                commentaire_validation = ?,
                modifie_par = ?
            WHERE id = ?
        `;

        const result = await db.query(sql, [
            decision,
            req.userId,
            commentaire,
            req.userId,
            congeId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Congé non trouvé.'
            });
        }

        // Get leave info for notification
        const leaveSql = `SELECT id_utilisateur FROM conges WHERE id = ?`;
        const leaveResults = await db.query(leaveSql, [congeId]);
        const leave = (leaveResults && leaveResults.length > 0) ? leaveResults[0] : null;

        if (leave && req.io) {
            req.io.to(`user-${leave.id_utilisateur}`).emit('new-notification', {
                type: 'conges',
                titre: 'Statut de congé mis à jour',
                message: `Votre congé a été ${decision === 'approuve' ? 'approuvé' : 'rejeté'}`,
                congeId
            });
        }

        res.status(200).json({
            success: true,
            message: `Congé ${decision === 'approuve' ? 'approuvé' : 'rejeté'} avec succès.`
        });
    } catch (error) {
        console.error('Validate conge error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation du congé.'
        });
    }
});

// Gestion des salaires - Admin/Comptable
router.get('/salaires', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            userId,
            mois,
            annee,
            page = 1,
            limit = 20
        } = req.query;

        const pPage = parseInt(page);
        const pLimit = parseInt(limit);

        let sql = `
            SELECT s.*, u.nom_complet, u.matricule, u.role, d.nom as departement_nom
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (userId) {
            sql += ' AND s.id_utilisateur = ?';
            params.push(userId);
        }

        if (mois) {
            sql += ' AND s.mois = ?';
            params.push(mois);
        }

        if (annee) {
            sql += ' AND s.annee = ?';
            params.push(annee);
        }

        sql += ' ORDER BY s.annee DESC, s.mois DESC';

        // Pagination
        const offset = (pPage - 1) * pLimit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(pLimit, offset);

        const salaires = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM salaires WHERE 1=1`;
        const countParams = [];

        if (userId) {
            countSql += ' AND id_utilisateur = ?';
            countParams.push(userId);
        }

        if (mois) {
            countSql += ' AND mois = ?';
            countParams.push(mois);
        }

        if (annee) {
            countSql += ' AND annee = ?';
            countParams.push(annee);
        }

        const resultsCountSal = await db.query(countSql, countParams);
        const countResult = (resultsCountSal && resultsCountSal.length > 0) ? resultsCountSal[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: salaires,
            pagination: {
                total: countResult.total,
                page: pPage,
                limit: pLimit,
                pages: Math.ceil(countResult.total / pLimit)
            }
        });
    } catch (error) {
        console.error('Get salaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des salaires.'
        });
    }
});

// Obtenir le salaire d'un employé (soi-même)
router.get('/salaires/mon-salaire', authenticate, async (req, res) => {
    try {
        const { mois, annee } = req.query;
        const currentMonth = mois || new Date().getMonth() + 1;
        const currentYear = annee || new Date().getFullYear();

        const sql = `
            SELECT s.*
            FROM salaires s
            WHERE s.id_utilisateur = ?
            AND s.mois = ?
            AND s.annee = ?
        `;

        const salaires = await db.query(sql, [
            req.userId,
            currentMonth,
            currentYear
        ]);

        if (salaires.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun salaire trouvé pour cette période.'
            });
        }

        res.status(200).json({
            success: true,
            data: salaires[0]
        });
    } catch (error) {
        console.error('Get mon salaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du salaire.'
        });
    }
});

// Calculer les salaires mensuels
router.post('/salaires/calculer', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const { mois, annee } = req.body;

        if (!mois || !annee) {
            return res.status(400).json({
                success: false,
                message: 'Mois et année requis.'
            });
        }

        // Call stored procedure
        await db.query('CALL calculer_salaires_mensuel(?, ?)', [mois, annee]);

        res.status(200).json({
            success: true,
            message: 'Salaire calculé avec succès.'
        });
    } catch (error) {
        console.error('Calculer salaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des salaires.'
        });
    }
});

// Gestion des départements
router.get('/departements', authenticate, authorize('admin'), async (req, res) => {
    try {
        const sql = `
            SELECT d.*, 
                   u.nom_complet as responsable_nom,
                   parent.nom as parent_nom
            FROM departements d
            LEFT JOIN utilisateurs u ON d.responsable_id = u.id
            LEFT JOIN departements parent ON d.id_parent = parent.id
            ORDER BY d.type, d.nom
        `;

        const departements = await db.query(sql);

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

// Statistiques RH
router.get('/statistiques', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        // Employee statistics
        const empStats = await User.getDashboardStats();

        // Presence statistics for current month
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const presenceSql = `
            SELECT 
                COUNT(DISTINCT id_utilisateur) as employes_presents,
                AVG(TIME_TO_SEC(duree_travail))/3600 as moyenne_heures,
                SUM(CASE WHEN statut = 'retard' THEN 1 ELSE 0 END) as retards
            FROM presences 
            WHERE MONTH(date) = ? 
            AND YEAR(date) = ?
        `;

        const presenceStatsResults = await db.query(presenceSql, [currentMonth, currentYear]);
        const presenceStats = (presenceStatsResults && presenceStatsResults.length > 0) ? presenceStatsResults[0] : {};

        // Leave statistics
        const leaveSql = `
            SELECT 
                statut,
                COUNT(*) as nombre,
                SUM(jours_demandes) as total_jours
            FROM conges 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            GROUP BY statut
        `;

        const leaveStats = await db.query(leaveSql, [currentMonth, currentYear]);

        // Salary statistics for current month
        const salarySql = `
            SELECT 
                SUM(salaire_brut) as total_brut,
                SUM(salaire_net) as total_net,
                SUM(deduction_inss) as total_inss
            FROM salaires 
            WHERE mois = ? 
            AND annee = ?
        `;

        const [salaryStats] = await db.query(salarySql, [currentMonth, currentYear]);

        res.status(200).json({
            success: true,
            data: {
                employes: empStats,
                presence: presenceStats,
                conges: leaveStats,
                salaires: salaryStats
            }
        });
    } catch (error) {
        console.error('Get RH stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;