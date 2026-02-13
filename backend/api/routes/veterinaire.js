// backend/api/routes/veterinaireRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const emailService = require('../emailService');

// ==================== DASHBOARD VÉTÉRINAIRE ====================
router.get('/dashboard', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;

        // Récupérer les informations du vétérinaire
        const userSql = `
            SELECT * FROM utilisateurs WHERE id = ?
        `;
        const resultsVet = await db.query(userSql, [userId]);
        const veterinaire = (resultsVet && resultsVet.length > 0) ? resultsVet[0] : null;

        if (!veterinaire) {
            return res.status(404).json({
                success: false,
                message: 'Vétérinaire non trouvé.'
            });
        }

        // Supprimer le mot de passe
        delete veterinaire.mot_de_passe_hash;

        // Statistiques dashboard
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const statsSql = `
            SELECT 
                -- Animaux sous surveillance
                (SELECT COUNT(*) FROM animaux 
                 WHERE statut = 'vivant' 
                 AND statut_sante IN ('moyen', 'malade', 'en_traitement')) as animauxSurveillance,
                
                -- Interventions aujourd'hui
                (SELECT COUNT(*) FROM suivis_sanitaires 
                 WHERE DATE(date_intervention) = CURDATE()
                 AND id_technicien = ?) as interventionsToday,
                
                -- Vaccinations à venir (7 prochains jours)
                (SELECT COUNT(DISTINCT a.id) 
                 FROM animaux a
                 WHERE a.statut = 'vivant'
                 AND a.prochaine_vaccination BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)) as vaccinationsDues,
                
                -- Animaux en bonne santé
                (SELECT COUNT(*) FROM animaux 
                 WHERE statut = 'vivant' 
                 AND statut_sante IN ('excellent', 'bon')) as animauxSains,
                
                -- Total interventions ce mois
                (SELECT COUNT(*) FROM suivis_sanitaires 
                 WHERE MONTH(date_intervention) = ?
                 AND YEAR(date_intervention) = ?
                 AND id_technicien = ?) as totalInterventions
        `;

        const resultsStats = await db.query(statsSql, [
            userId,
            currentMonth, currentYear, userId
        ]);
        const stats = (resultsStats && resultsStats.length > 0) ? resultsStats[0] : {};

        // Interventions aujourd'hui
        const interventionsTodaySql = `
            SELECT 
                ss.*,
                a.numero_identification as animal_numero,
                a.nom_animal as animal_nom,
                a.espece,
                a.race,
                CASE 
                    WHEN ss.type_intervention = 'vaccination' THEN 'Vaccination'
                    WHEN ss.type_intervention = 'traitement' THEN 'Traitement'
                    WHEN ss.type_intervention = 'consultation' THEN 'Consultation'
                    WHEN ss.type_intervention = 'analyse' THEN 'Analyse'
                    WHEN ss.type_intervention = 'chirurgie' THEN 'Chirurgie'
                    ELSE ss.type_intervention
                END as type_label,
                TIME(ss.date_intervention) as heure_prevue,
                CASE 
                    WHEN ss.observations LIKE '%urgent%' OR ss.observations LIKE '%urgence%' THEN TRUE
                    ELSE FALSE
                END as urgent
            FROM suivis_sanitaires ss
            JOIN animaux a ON ss.id_animal = a.id
            WHERE DATE(ss.date_intervention) = CURDATE()
            AND ss.id_technicien = ?
            ORDER BY ss.date_intervention ASC
        `;

        const interventionsToday = await db.query(interventionsTodaySql, [userId]);

        // Vaccinations à venir
        const vaccinationsDuesSql = `
            SELECT 
                a.id as animal_id,
                a.numero_identification as animal_numero,
                a.nom_animal as animal_nom,
                a.espece,
                a.race,
                a.prochaine_vaccination as date_prevue,
                DATEDIFF(a.prochaine_vaccination, CURDATE()) as jours_restants,
                'Vaccination de routine' as vaccin
            FROM animaux a
            WHERE a.statut = 'vivant'
            AND a.prochaine_vaccination BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY a.prochaine_vaccination ASC
            LIMIT 10
        `;

        const vaccinationsDues = await db.query(vaccinationsDuesSql);

        // Animaux sous surveillance
        const animauxSurveillanceSql = `
            SELECT 
                a.*,
                ss.diagnostic as raison_surveillance,
                ss.date_intervention as derniere_intervention
            FROM animaux a
            LEFT JOIN suivis_sanitaires ss ON a.id = ss.id_animal 
                AND ss.date_intervention = (
                    SELECT MAX(date_intervention) 
                    FROM suivis_sanitaires 
                    WHERE id_animal = a.id
                )
            WHERE a.statut = 'vivant'
            AND a.statut_sante IN ('moyen', 'malade', 'en_traitement')
            ORDER BY a.statut_sante DESC, ss.date_intervention DESC
            LIMIT 10
        `;

        const animauxSurveillance = await db.query(animauxSurveillanceSql);

        // Alertes sanitaires
        const alertesSql = `
            SELECT 
                n.id,
                n.titre,
                n.message,
                n.priorite,
                n.id_reference as animal_id,
                n.date_creation,
                TIMESTAMPDIFF(MINUTE, n.date_creation, NOW()) as minutes_ago,
                CASE 
                    WHEN TIMESTAMPDIFF(MINUTE, n.date_creation, NOW()) < 60 
                        THEN CONCAT(TIMESTAMPDIFF(MINUTE, n.date_creation, NOW()), ' min')
                    WHEN TIMESTAMPDIFF(HOUR, n.date_creation, NOW()) < 24 
                        THEN CONCAT(TIMESTAMPDIFF(HOUR, n.date_creation, NOW()), 'h')
                    ELSE CONCAT(TIMESTAMPDIFF(DAY, n.date_creation, NOW()), 'j')
                END as time_ago
            FROM notifications n
            WHERE n.type_notification = 'alerte_sanitaire'
            AND n.statut = 'non_lu'
            AND n.date_creation >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY n.priorite DESC, n.date_creation DESC
            LIMIT 10
        `;

        const alertes = await db.query(alertesSql);

        res.status(200).json({
            success: true,
            data: {
                veterinaire,
                stats,
                interventionsToday,
                vaccinationsDues,
                animauxSurveillance,
                alertes
            }
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard.'
        });
    }
});

// ==================== GESTION DES ANIMAUX ====================
router.get('/animaux', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            espece,
            statut,
            search,
            type_animal
        } = req.query;

        // Convertir en nombres pour éviter l'erreur ER_WRONG_ARGUMENTS
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let sql = `
            SELECT 
                a.*,
                COUNT(DISTINCT ss.id) as nb_interventions,
                MAX(ss.date_intervention) as derniere_intervention
            FROM animaux a
            LEFT JOIN suivis_sanitaires ss ON a.id = ss.id_animal
            WHERE a.statut = 'vivant'
        `;

        // Count total initialization
        let countSql = `
            SELECT COUNT(DISTINCT a.id) as total
            FROM animaux a
            WHERE a.statut = 'vivant'
        `;

        const params = [];
        const countParams = [];

        if (espece) {
            sql += ' AND a.espece = ?';
            params.push(espece);
            countSql += ' AND a.espece = ?';
            countParams.push(espece);
        }

        if (statut === 'surveillance') {
            sql += ' AND a.statut_sante IN ("moyen", "malade", "en_traitement")';
            countSql += ' AND a.statut_sante IN ("moyen", "malade", "en_traitement")';
        } else if (statut === 'healthy') {
            sql += ' AND a.statut_sante IN ("excellent", "bon")';
            countSql += ' AND a.statut_sante IN ("excellent", "bon")';
        } else if (statut === 'en_traitement') {
            sql += ' AND a.statut_sante = "en_traitement"';
            countSql += ' AND a.statut_sante = "en_traitement"';
        }

        if (type_animal) {
            sql += ' AND a.type_animal = ?';
            params.push(type_animal);
            countSql += ' AND a.type_animal = ?';
            countParams.push(type_animal);
        }

        if (search) {
            const searchCondition = ` AND (
                a.numero_identification LIKE ? OR 
                a.nom_animal LIKE ? OR 
                a.marques_distinctives LIKE ?
            )`;
            sql += searchCondition;
            countSql += searchCondition;

            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' GROUP BY a.id';
        sql += ' ORDER BY a.statut_sante DESC, a.date_naissance DESC';
        sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

        const animaux = await db.query(sql, params);

        // Execute count query (already built)
        const resultsCountAllVet = await db.query(countSql, countParams);
        const countResult = (resultsCountAllVet && resultsCountAllVet.length > 0) ? resultsCountAllVet[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: animaux,
            pagination: {
                total: countResult.total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult.total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get animaux error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des animaux.'
        });
    }
});

// Obtenir les détails d'un animal
router.get('/animaux/:id', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const animalId = parseInt(req.params.id);

        const sql = `
            SELECT 
                a.*,
                m.numero_identification as mere_numero,
                p.numero_identification as pere_numero
            FROM animaux a
            LEFT JOIN animaux m ON a.id_mere = m.id
            LEFT JOIN animaux p ON a.id_pere = p.id
            WHERE a.id = ?
        `;

        const resultsAnimalId = await db.query(sql, [animalId]);
        const animal = (resultsAnimalId && resultsAnimalId.length > 0) ? resultsAnimalId[0] : null;

        if (!animal) {
            return res.status(404).json({
                success: false,
                message: 'Animal non trouvé.'
            });
        }

        // Récupérer historique médical récent
        const historiqueSql = `
            SELECT 
                ss.*,
                u.nom_complet as veterinaire_nom,
                CASE 
                    WHEN ss.type_intervention = 'vaccination' THEN 'Vaccination'
                    WHEN ss.type_intervention = 'traitement' THEN 'Traitement'
                    WHEN ss.type_intervention = 'consultation' THEN 'Consultation'
                    WHEN ss.type_intervention = 'analyse' THEN 'Analyse'
                    WHEN ss.type_intervention = 'chirurgie' THEN 'Chirurgie'
                    ELSE ss.type_intervention
                END as type_label
            FROM suivis_sanitaires ss
            LEFT JOIN utilisateurs u ON ss.id_technicien = u.id
            WHERE ss.id_animal = ?
            ORDER BY ss.date_intervention DESC
            LIMIT 10
        `;

        const historique_recent = await db.query(historiqueSql, [animalId]);
        animal.historique_recent = historique_recent;

        res.status(200).json({
            success: true,
            data: animal
        });
    } catch (error) {
        console.error('Get animal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'animal.'
        });
    }
});

// Rechercher des animaux
router.get('/animaux/search/:query', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const query = req.params.query;

        const sql = `
            SELECT 
                id,
                numero_identification,
                nom_animal,
                espece,
                race,
                sexe,
                statut_sante,
                photo
            FROM animaux
            WHERE statut = 'vivant'
            AND (
                numero_identification LIKE ? OR
                nom_animal LIKE ? OR
                marques_distinctives LIKE ?
            )
            LIMIT 10
        `;

        const searchTerm = `%${query}%`;
        const animaux = await db.query(sql, [searchTerm, searchTerm, searchTerm]);

        res.status(200).json({
            success: true,
            data: animaux
        });
    } catch (error) {
        console.error('Search animaux error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche des animaux.'
        });
    }
});

// Historique médical complet d'un animal
router.get('/animaux/:id/historique', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const animalId = parseInt(req.params.id);
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const sql = `
            SELECT 
                ss.*,
                u.nom_complet as veterinaire_nom,
                CASE 
                    WHEN ss.type_intervention = 'vaccination' THEN 'Vaccination'
                    WHEN ss.type_intervention = 'traitement' THEN 'Traitement'
                    WHEN ss.type_intervention = 'consultation' THEN 'Consultation'
                    WHEN ss.type_intervention = 'analyse' THEN 'Analyse'
                    WHEN ss.type_intervention = 'chirurgie' THEN 'Chirurgie'
                    ELSE ss.type_intervention
                END as type_label
            FROM suivis_sanitaires ss
            LEFT JOIN utilisateurs u ON ss.id_technicien = u.id
            WHERE ss.id_animal = ?
            ORDER BY ss.date_intervention DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `;

        const historique = await db.query(sql, [animalId]);

        // Count total
        const countSql = `
            SELECT COUNT(*) as total 
            FROM suivis_sanitaires 
            WHERE id_animal = ?
        `;
        const resultsCountHist = await db.query(countSql, [animalId]);
        const countResult = (resultsCountHist && resultsCountHist.length > 0) ? resultsCountHist[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: historique,
            pagination: {
                total: countResult.total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult.total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get historique medical error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique médical.'
        });
    }
});

// ==================== GESTION DES INTERVENTIONS ====================
router.get('/interventions', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            filter,
            type_intervention,
            startDate,
            endDate,
            search,
            id_animal
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let sql = `
            SELECT 
                ss.*,
                a.numero_identification as animal_numero,
                a.nom_animal as animal_nom,
                a.espece as animal_espece,
                a.race as animal_race,
                a.photo as animal_photo,
                u.nom_complet as veterinaire_nom,
                CASE 
                    WHEN ss.type_intervention = 'vaccination' THEN 'Vaccination'
                    WHEN ss.type_intervention = 'traitement' THEN 'Traitement'
                    WHEN ss.type_intervention = 'consultation' THEN 'Consultation'
                    WHEN ss.type_intervention = 'analyse' THEN 'Analyse'
                    WHEN ss.type_intervention = 'chirurgie' THEN 'Chirurgie'
                    ELSE ss.type_intervention
                END as type_label,
                CASE 
                    WHEN ss.observations LIKE '%urgent%' OR ss.observations LIKE '%urgence%' THEN TRUE
                    ELSE FALSE
                END as urgent
            FROM suivis_sanitaires ss
            JOIN animaux a ON ss.id_animal = a.id
            LEFT JOIN utilisateurs u ON ss.id_technicien = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filter === 'today') {
            sql += ' AND DATE(ss.date_intervention) = CURDATE()';
        } else if (filter === 'vaccinations') {
            sql += ' AND ss.type_intervention = "vaccination"';
        } else if (filter === 'traitements') {
            sql += ' AND ss.type_intervention = "traitement"';
        } else if (filter === 'urgents') {
            sql += ' AND (ss.observations LIKE "%urgent%" OR ss.observations LIKE "%urgence%")';
        }

        if (type_intervention) {
            sql += ' AND ss.type_intervention = ?';
            params.push(type_intervention);
        }

        if (startDate) {
            sql += ' AND DATE(ss.date_intervention) >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND DATE(ss.date_intervention) <= ?';
            params.push(endDate);
        }

        if (id_animal) {
            sql += ' AND ss.id_animal = ?';
            params.push(id_animal);
        }

        if (search) {
            sql += ` AND (
                a.numero_identification LIKE ? OR 
                a.nom_animal LIKE ? OR 
                u.nom_complet LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY ss.date_intervention DESC';
        sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

        const interventions = await db.query(sql, params);

        // Count total
        let countSql = `
            SELECT COUNT(*) as total
            FROM suivis_sanitaires ss
            JOIN animaux a ON ss.id_animal = a.id
            LEFT JOIN utilisateurs u ON ss.id_technicien = u.id
            WHERE 1=1
        `;
        const countParams = [];

        if (filter === 'today') {
            countSql += ' AND DATE(ss.date_intervention) = CURDATE()';
        } else if (filter === 'vaccinations') {
            countSql += ' AND ss.type_intervention = "vaccination"';
        } else if (filter === 'traitements') {
            countSql += ' AND ss.type_intervention = "traitement"';
        } else if (filter === 'urgents') {
            countSql += ' AND (ss.observations LIKE "%urgent%" OR ss.observations LIKE "%urgence%")';
        }

        if (type_intervention) {
            countSql += ' AND ss.type_intervention = ?';
            countParams.push(type_intervention);
        }

        if (startDate) {
            countSql += ' AND DATE(ss.date_intervention) >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countSql += ' AND DATE(ss.date_intervention) <= ?';
            countParams.push(endDate);
        }

        if (id_animal) {
            countSql += ' AND ss.id_animal = ?';
            countParams.push(id_animal);
        }

        if (search) {
            countSql += ` AND (
                a.numero_identification LIKE ? OR 
                a.nom_animal LIKE ? OR 
                u.nom_complet LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const resultsCountInterv = await db.query(countSql, countParams);
        const countResult = (resultsCountInterv && resultsCountInterv.length > 0) ? resultsCountInterv[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: interventions,
            pagination: {
                total: countResult.total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult.total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get interventions error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des interventions.'
        });
    }
});

// Créer une nouvelle intervention
router.post('/interventions', authenticate, authorize('veterinaire'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            id_animal,
            type_intervention,
            date_intervention,
            symptomes,
            diagnostic,
            produit_utilise,
            dosage,
            mode_administration,
            date_prochaine_visite,
            instructions_suivi,
            observations,
            cout_intervention,
            veterinaire
        } = req.body;

        // Validation
        if (!id_animal || !type_intervention || !date_intervention || !diagnostic) {
            return res.status(400).json({
                success: false,
                message: 'Animal, type d\'intervention, date et diagnostic sont requis.'
            });
        }

        // Vérifier que l'animal existe et est vivant
        const animalSql = `
            SELECT * FROM animaux WHERE id = ? AND statut = 'vivant'
        `;
        const [resultsAnimalCheck] = await connection.query(animalSql, [id_animal]);
        const animal = (resultsAnimalCheck && resultsAnimalCheck.length > 0) ? resultsAnimalCheck[0] : null;

        if (!animal) {
            return res.status(400).json({
                success: false,
                message: 'Animal non trouvé ou non vivant.'
            });
        }

        // Commencer une transaction
        await connection.beginTransaction();

        try {
            // Insérer l'intervention
            const insertSql = `
                INSERT INTO suivis_sanitaires (
                    id_animal, type_intervention, date_intervention,
                    symptomes, diagnostic, produit_utilise, dosage,
                    mode_administration, date_prochaine_visite,
                    instructions_suivi, observations, cout_intervention,
                    id_technicien, veterinaire
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await connection.execute(insertSql, [
                id_animal,
                type_intervention,
                (date_intervention ? new Date(date_intervention) : new Date()).toISOString().split('T')[0],
                symptomes || null,
                diagnostic,
                produit_utilise || null,
                dosage || null,
                mode_administration || null,
                date_prochaine_visite ? new Date(date_prochaine_visite).toISOString().split('T')[0] : null,
                instructions_suivi || null,
                observations || null,
                cout_intervention || 0,
                req.userId,
                veterinaire || null
            ]);

            const interventionId = result.insertId;

            // Mettre à jour le statut de l'animal si traitement
            if (type_intervention === 'traitement') {
                await connection.execute(
                    'UPDATE animaux SET statut_sante = ? WHERE id = ?',
                    ['en_traitement', id_animal]
                );
            }

            // Mettre à jour la date de vaccination si c'est une vaccination
            if (type_intervention === 'vaccination') {
                await connection.execute(
                    `UPDATE animaux 
                     SET derniere_vaccination = ?,
                         prochaine_vaccination = DATE_ADD(?, INTERVAL 6 MONTH)
                     WHERE id = ?`,
                    [
                        (date_intervention ? new Date(date_intervention) : new Date()).toISOString().split('T')[0],
                        (date_intervention ? new Date(date_intervention) : new Date()).toISOString().split('T')[0],
                        id_animal
                    ]
                );
            }

            // Créer une notification si prochaine visite
            if (date_prochaine_visite) {
                await connection.execute(
                    `INSERT INTO notifications (
                        id_utilisateur, type_notification, titre, message,
                        priorite, type_reference, id_reference
                    ) VALUES (?, 'rappel', 'Prochaine visite', ?, 'normale', 'animal', ?)`,
                    [
                        req.userId,
                        `Prochaine visite prévue le ${date_prochaine_visite} pour l'animal ${id_animal}`,
                        id_animal
                    ]
                );
            }

            // Valider la transaction
            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Intervention créée avec succès.',
                interventionId
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Create intervention error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'intervention.'
        });
    } finally {
        connection.release();
    }
});

// Obtenir les détails d'une intervention
router.get('/interventions/:id', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const interventionId = parseInt(req.params.id);

        const sql = `
            SELECT 
                ss.*,
                a.numero_identification as animal_numero,
                a.nom_animal as animal_nom,
                a.espece,
                a.race,
                a.sexe,
                a.photo as animal_photo,
                u.nom_complet as veterinaire_nom,
                CASE 
                    WHEN ss.type_intervention = 'vaccination' THEN 'Vaccination'
                    WHEN ss.type_intervention = 'traitement' THEN 'Traitement'
                    WHEN ss.type_intervention = 'consultation' THEN 'Consultation'
                    WHEN ss.type_intervention = 'analyse' THEN 'Analyse'
                    WHEN ss.type_intervention = 'chirurgie' THEN 'Chirurgie'
                    ELSE ss.type_intervention
                END as type_label
            FROM suivis_sanitaires ss
            JOIN animaux a ON ss.id_animal = a.id
            LEFT JOIN utilisateurs u ON ss.id_technicien = u.id
            WHERE ss.id = ?
        `;

        const resultsIntervDetails = await db.query(sql, [interventionId]);
        const intervention = (resultsIntervDetails && resultsIntervDetails.length > 0) ? resultsIntervDetails[0] : null;

        if (!intervention) {
            return res.status(404).json({
                success: false,
                message: 'Intervention non trouvée.'
            });
        }

        res.status(200).json({
            success: true,
            data: intervention
        });
    } catch (error) {
        console.error('Get intervention error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'intervention.'
        });
    }
});

// Mettre à jour une intervention
router.put('/interventions/:id', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const interventionId = parseInt(req.params.id);
        const updateData = req.body;

        // Vérifier que l'intervention existe
        const checkSql = `
            SELECT * FROM suivis_sanitaires WHERE id = ?
        `;
        const resultsCheckInterv = await db.query(checkSql, [interventionId]);
        const intervention = (resultsCheckInterv && resultsCheckInterv.length > 0) ? resultsCheckInterv[0] : null;

        if (!intervention) {
            return res.status(404).json({
                success: false,
                message: 'Intervention non trouvée.'
            });
        }

        const fields = [];
        const params = [];

        // Construire dynamiquement la requête UPDATE
        if (updateData.symptomes !== undefined) {
            fields.push('symptomes = ?');
            params.push(updateData.symptomes);
        }
        if (updateData.diagnostic !== undefined) {
            fields.push('diagnostic = ?');
            params.push(updateData.diagnostic);
        }
        if (updateData.produit_utilise !== undefined) {
            fields.push('produit_utilise = ?');
            params.push(updateData.produit_utilise);
        }
        if (updateData.dosage !== undefined) {
            fields.push('dosage = ?');
            params.push(updateData.dosage);
        }
        if (updateData.instructions_suivi !== undefined) {
            fields.push('instructions_suivi = ?');
            params.push(updateData.instructions_suivi);
        }
        if (updateData.observations !== undefined) {
            fields.push('observations = ?');
            params.push(updateData.observations);
        }
        if (updateData.date_prochaine_visite !== undefined) {
            fields.push('date_prochaine_visite = ?');
            params.push(updateData.date_prochaine_visite ? new Date(updateData.date_prochaine_visite).toISOString().split('T')[0] : null);
        }

        // Toujours mettre à jour la date de modification
        fields.push('date_modification = NOW()');

        if (fields.length === 1) { // Seulement date_modification
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée à mettre à jour.'
            });
        }

        const sql = `
            UPDATE suivis_sanitaires 
            SET ${fields.join(', ')}
            WHERE id = ?
        `;
        params.push(interventionId);

        await db.query(sql, params);

        res.status(200).json({
            success: true,
            message: 'Intervention mise à jour avec succès.'
        });
    } catch (error) {
        console.error('Update intervention error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'intervention.'
        });
    }
});

// ==================== PROFIL VÉTÉRINAIRE ====================
router.get('/profil', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;

        // Informations utilisateur
        const userSql = `
            SELECT * FROM utilisateurs WHERE id = ?
        `;
        const resultsUserProfile = await db.query(userSql, [userId]);
        const user = (resultsUserProfile && resultsUserProfile.length > 0) ? resultsUserProfile[0] : null;

        // Supprimer le mot de passe
        delete user.mot_de_passe_hash;

        // Statistiques
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const statsSql = `
            SELECT 
                -- Présences ce mois
                (SELECT COUNT(DISTINCT date) 
                 FROM presences 
                 WHERE id_utilisateur = ?
                 AND MONTH(date) = ?
                 AND YEAR(date) = ?
                 AND statut = 'present') as jours_presence,
                
                -- Interventions ce mois
                (SELECT COUNT(*) 
                 FROM suivis_sanitaires 
                 WHERE id_technicien = ?
                 AND MONTH(date_intervention) = ?
                 AND YEAR(date_intervention) = ?) as interventions_mois,
                
                -- Solde congés
                (SELECT 25 - COALESCE(SUM(jours_demandes), 0)
                 FROM conges 
                 WHERE id_utilisateur = ?
                 AND YEAR(date_debut) = ?
                 AND statut = 'approuve') as solde_conges
        `;

        const resultsStatsProfile = await db.query(statsSql, [
            userId, currentMonth, currentYear,
            userId, currentMonth, currentYear,
            userId, currentYear
        ]);
        const stats = (resultsStatsProfile && resultsStatsProfile.length > 0) ? resultsStatsProfile[0] : {};

        // Présences récentes
        const presencesSql = `
            SELECT *
            FROM presences
            WHERE id_utilisateur = ?
            ORDER BY date DESC
            LIMIT 10
        `;
        const presences = await db.query(presencesSql, [userId]);

        // Congés
        const congesSql = `
            SELECT *
            FROM conges
            WHERE id_utilisateur = ?
            ORDER BY date_debut DESC
            LIMIT 5
        `;
        const conges = await db.query(congesSql, [userId]);

        // Notifications
        const notificationsSql = `
            SELECT 
                n.*,
                CASE 
                    WHEN TIMESTAMPDIFF(MINUTE, n.date_creation, NOW()) < 60 
                        THEN CONCAT(TIMESTAMPDIFF(MINUTE, n.date_creation, NOW()), ' min')
                    WHEN TIMESTAMPDIFF(HOUR, n.date_creation, NOW()) < 24 
                        THEN CONCAT(TIMESTAMPDIFF(HOUR, n.date_creation, NOW()), 'h')
                    ELSE CONCAT(TIMESTAMPDIFF(DAY, n.date_creation, NOW()), 'j')
                END as time_ago,
                CASE WHEN n.statut = 'non_lu' THEN FALSE ELSE TRUE END as \`read\`
            FROM notifications n
            WHERE n.id_utilisateur = ?
            ORDER BY n.date_creation DESC
            LIMIT 20
        `;
        const notifications = await db.query(notificationsSql, [userId]);

        res.status(200).json({
            success: true,
            data: {
                user,
                stats,
                presences,
                conges,
                notifications
            }
        });
    } catch (error) {
        console.error('Get profil error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du profil.'
        });
    }
});

// Marquer une notification comme lue
router.put('/notifications/:id/read', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        const sql = `
            UPDATE notifications
            SET statut = 'lu',
                date_lecture = NOW()
            WHERE id = ?
            AND id_utilisateur = ?
        `;

        const result = await db.query(sql, [notificationId, req.userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marquée comme lue.'
        });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage de la notification.'
        });
    }
});

// ==================== STATISTIQUES VÉTÉRINAIRES ====================
router.get('/statistiques', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Statistiques générales
        const generalSql = `
            SELECT 
                -- Total animaux vivants
                (SELECT COUNT(*) FROM animaux WHERE statut = 'vivant') as total_animaux,
                
                -- Animaux en bonne santé
                (SELECT COUNT(*) FROM animaux 
                 WHERE statut = 'vivant' 
                 AND statut_sante IN ('excellent', 'bon')) as animaux_sains,
                
                -- Animaux sous surveillance
                (SELECT COUNT(*) FROM animaux 
                 WHERE statut = 'vivant' 
                 AND statut_sante IN ('moyen', 'malade', 'en_traitement')) as animaux_surveillance,
                
                -- Interventions ce mois
                (SELECT COUNT(*) FROM suivis_sanitaires 
                 WHERE MONTH(date_intervention) = ?
                 AND YEAR(date_intervention) = ?) as interventions_mois,
                
                -- Total vaccinations ce mois
                (SELECT COUNT(*) FROM suivis_sanitaires 
                 WHERE MONTH(date_intervention) = ?
                 AND YEAR(date_intervention) = ?
                 AND type_intervention = 'vaccination') as vaccinations_mois,
                
                -- Coût total interventions ce mois
                (SELECT COALESCE(SUM(cout_intervention), 0) 
                 FROM suivis_sanitaires 
                 WHERE MONTH(date_intervention) = ?
                 AND YEAR(date_intervention) = ?) as cout_total_mois
        `;

        const resultsGeneralStats = await db.query(generalSql, [
            currentMonth, currentYear,
            currentMonth, currentYear,
            currentMonth, currentYear
        ]);
        const generalStats = (resultsGeneralStats && resultsGeneralStats.length > 0) ? resultsGeneralStats[0] : {};

        // Interventions par type ce mois
        const interventionsByTypeSql = `
            SELECT 
                type_intervention,
                COUNT(*) as count
            FROM suivis_sanitaires
            WHERE MONTH(date_intervention) = ?
            AND YEAR(date_intervention) = ?
            GROUP BY type_intervention
            ORDER BY count DESC
        `;

        const interventionsByType = await db.query(interventionsByTypeSql, [
            currentMonth,
            currentYear
        ]);

        // Animaux par espèce
        const animauxByEspeceSql = `
            SELECT 
                espece,
                COUNT(*) as count
            FROM animaux
            WHERE statut = 'vivant'
            GROUP BY espece
            ORDER BY count DESC
        `;

        const animauxByEspece = await db.query(animauxByEspeceSql);

        // Vaccinations à venir
        const vaccinationsDueSql = `
            SELECT 
                espece,
                COUNT(*) as count
            FROM animaux
            WHERE statut = 'vivant'
            AND prochaine_vaccination BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            GROUP BY espece
        `;

        const vaccinationsDue = await db.query(vaccinationsDueSql);

        res.status(200).json({
            success: true,
            data: {
                general: generalStats,
                interventionsByType,
                animauxByEspece,
                vaccinationsDue
            }
        });
    } catch (error) {
        console.error('Get statistiques error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

// ==================== GESTION DES SALAIRES ====================

// Obtenir l'historique des salaires du vétérinaire
router.get('/salaires/historique', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 12, annee, statut } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let sql = `
            SELECT 
                s.*,
                CASE 
                    WHEN s.mois = 1 THEN 'Janvier'
                    WHEN s.mois = 2 THEN 'Février'
                    WHEN s.mois = 3 THEN 'Mars'
                    WHEN s.mois = 4 THEN 'Avril'
                    WHEN s.mois = 5 THEN 'Mai'
                    WHEN s.mois = 6 THEN 'Juin'
                    WHEN s.mois = 7 THEN 'Juillet'
                    WHEN s.mois = 8 THEN 'Août'
                    WHEN s.mois = 9 THEN 'Septembre'
                    WHEN s.mois = 10 THEN 'Octobre'
                    WHEN s.mois = 11 THEN 'Novembre'
                    WHEN s.mois = 12 THEN 'Décembre'
                END as mois_nom,
                val.nom_complet as validateur_nom
            FROM salaires s
            LEFT JOIN utilisateurs val ON s.valide_par = val.id
            WHERE s.id_utilisateur = ?
        `;
        const params = [userId];

        if (annee) {
            sql += ' AND s.annee = ?';
            params.push(parseInt(annee));
        }

        if (statut) {
            sql += ' AND s.statut_paiement = ?';
            params.push(statut);
        }

        sql += ' ORDER BY s.annee DESC, s.mois DESC';
        sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

        const salaires = await db.query(sql, params);

        // Count total
        let countSql = `
            SELECT COUNT(*) as total
            FROM salaires
            WHERE id_utilisateur = ?
        `;
        const countParams = [userId];

        if (annee) {
            countSql += ' AND annee = ?';
            countParams.push(parseInt(annee));
        }

        if (statut) {
            countSql += ' AND statut_paiement = ?';
            countParams.push(statut);
        }

        const resultsCountSal = await db.query(countSql, countParams);
        const countResult = (resultsCountSal && resultsCountSal.length > 0) ? resultsCountSal[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: salaires,
            pagination: {
                total: countResult.total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult.total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get salaires historique error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'historique des salaires.'
        });
    }
});

// Obtenir les détails d'un salaire spécifique
router.get('/salaires/:id', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const salaireId = parseInt(req.params.id);
        const userId = req.userId;

        const sql = `
            SELECT 
                s.*,
                CASE 
                    WHEN s.mois = 1 THEN 'Janvier'
                    WHEN s.mois = 2 THEN 'Février'
                    WHEN s.mois = 3 THEN 'Mars'
                    WHEN s.mois = 4 THEN 'Avril'
                    WHEN s.mois = 5 THEN 'Mai'
                    WHEN s.mois = 6 THEN 'Juin'
                    WHEN s.mois = 7 THEN 'Juillet'
                    WHEN s.mois = 8 THEN 'Août'
                    WHEN s.mois = 9 THEN 'Septembre'
                    WHEN s.mois = 10 THEN 'Octobre'
                    WHEN s.mois = 11 THEN 'Novembre'
                    WHEN s.mois = 12 THEN 'Décembre'
                END as mois_nom,
                calc.nom_complet as calcule_par_nom,
                val.nom_complet as valide_par_nom,
                u.nom_complet as employe_nom,
                u.matricule as employe_matricule,
                d.nom as departement_nom
            FROM salaires s
            LEFT JOIN utilisateurs calc ON s.calcul_par = calc.id
            LEFT JOIN utilisateurs val ON s.valide_par = val.id
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE s.id = ?
            AND s.id_utilisateur = ?
        `;

        const resultsSalaireDet = await db.query(sql, [salaireId, userId]);
        const salaire = (resultsSalaireDet && resultsSalaireDet.length > 0) ? resultsSalaireDet[0] : null;

        if (!salaire) {
            return res.status(404).json({
                success: false,
                message: 'Salaire non trouvé.'
            });
        }

        res.status(200).json({
            success: true,
            data: salaire
        });
    } catch (error) {
        console.error('Get salaire details error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails du salaire.'
        });
    }
});

// Demander le paiement d'un salaire
router.post('/salaires/:id/demander-paiement', authenticate, authorize('veterinaire'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const salaireId = parseInt(req.params.id);
        const userId = req.userId;

        const checkSql = `
            SELECT s.*, u.nom_complet 
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE s.id = ? AND s.id_utilisateur = ?
        `;
        const [resultsSalaireCheck] = await connection.query(checkSql, [salaireId, userId]);
        const salaire = (resultsSalaireCheck && resultsSalaireCheck.length > 0) ? resultsSalaireCheck[0] : null;

        if (!salaire) {
            return res.status(404).json({
                success: false,
                message: 'Salaire non trouvé.'
            });
        }

        // Vérifier que le salaire n'est pas déjà payé
        if (salaire.statut_paiement === 'payé') {
            return res.status(400).json({
                success: false,
                message: 'Ce salaire a déjà été payé.'
            });
        }

        // Vérifier qu'une demande n'existe pas déjà
        const checkDemandeSql = `
            SELECT id FROM demandes_paiement_salaire
            WHERE id_salaire = ?
            AND statut = 'en_attente'
        `;
        const [resultsDemandeExistant] = await connection.query(checkDemandeSql, [salaireId]);
        const demandeExistante = (resultsDemandeExistant && resultsDemandeExistant.length > 0) ? resultsDemandeExistant[0] : null;

        if (demandeExistante) {
            return res.status(400).json({
                success: false,
                message: 'Une demande de paiement est déjà en attente pour ce salaire.'
            });
        }

        await connection.beginTransaction();

        try {
            // Créer la demande de paiement
            const insertSql = `
                INSERT INTO demandes_paiement_salaire (
                    id_salaire,
                    id_employe,
                    mois,
                    annee,
                    montant,
                    statut,
                    commentaire
                ) VALUES (?, ?, ?, ?, ?, 'en_attente', ?)
            `;

            const commentaire = req.body.commentaire || `Demande de paiement pour le salaire de ${salaire.mois}/${salaire.annee}`;

            await connection.execute(insertSql, [
                salaireId,
                userId,
                salaire.mois,
                salaire.annee,
                salaire.salaire_net,
                commentaire
            ]);

            // Mettre à jour le salaire
            await connection.execute(
                'UPDATE salaires SET demande_paiement_envoyee = 1, date_demande_paiement = NOW() WHERE id = ?',
                [salaireId]
            );

            // Créer une notification pour le manager/admin
            await connection.execute(
                `INSERT INTO notifications (
                    id_utilisateur,
                    type_notification,
                    titre,
                    message,
                    priorite,
                    type_reference,
                    id_reference
                ) SELECT 
                    id,
                    'paiement',
                    'Demande de paiement de salaire',
                    ?,
                    'haute',
                    'demande_paiement',
                    ?
                FROM utilisateurs
                WHERE role IN ('admin', 'manager')
                AND statut = 'actif'
                LIMIT 1`,
                [
                    `${salaire.nom_complet} a demandé le paiement de son salaire de ${salaire.mois}/${salaire.annee} (${salaire.salaire_net} FBU)`,
                    salaireId
                ]
            );

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Demande de paiement envoyée avec succès.'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Demande paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de la demande de paiement.'
        });
    } finally {
        connection.release();
    }
});

// Confirmer la réception d'un salaire payé
router.post('/salaires/:id/confirmer-reception', authenticate, authorize('veterinaire'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const salaireId = parseInt(req.params.id);
        const userId = req.userId;
        const { code_verification } = req.body;

        const checkSql = `
            SELECT s.*, u.nom_complet 
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE s.id = ? AND s.id_utilisateur = ?
        `;
        const [resultsSalaireRec] = await connection.query(checkSql, [salaireId, userId]);
        const salaire = (resultsSalaireRec && resultsSalaireRec.length > 0) ? resultsSalaireRec[0] : null;

        if (!salaire) {
            return res.status(404).json({
                success: false,
                message: 'Salaire non trouvé.'
            });
        }

        // Vérifier que le salaire est marqué comme payé
        if (salaire.statut_paiement !== 'payé') {
            return res.status(400).json({
                success: false,
                message: 'Ce salaire n\'a pas encore été payé.'
            });
        }

        // Vérifier que la réception n'a pas déjà été confirmée
        if (salaire.confirme_reception) {
            return res.status(400).json({
                success: false,
                message: 'La réception de ce salaire a déjà été confirmée.'
            });
        }

        await connection.beginTransaction();

        try {
            // Si un code de vérification est fourni, le vérifier
            if (code_verification) {
                const verifSql = `
                    SELECT * FROM codes_verification_salaire
                    WHERE id_salaire = ?
                    AND id_utilisateur = ?
                    AND code_verification = ?
                    AND date_expiration > NOW()
                    AND utilise = 0
                `;
                const [resultsCodeVerif] = await connection.query(verifSql, [salaireId, userId, code_verification]);
                const codeVerif = (resultsCodeVerif && resultsCodeVerif.length > 0) ? resultsCodeVerif[0] : null;

                if (!codeVerif) {
                    // Incrémenter les tentatives échouées
                    await connection.execute(
                        `UPDATE codes_verification_salaire 
                         SET tentatives_echouees = tentatives_echouees + 1
                         WHERE id_salaire = ? AND id_utilisateur = ?`,
                        [salaireId, userId]
                    );

                    // Vérifier le nombre de tentatives
                    const [tentatives] = await connection.query(
                        `SELECT tentatives_echouees FROM codes_verification_salaire 
                         WHERE id_salaire = ? AND id_utilisateur = ?`,
                        [salaireId, userId]
                    );

                    if (tentatives && tentatives.length > 0 && tentatives[0].tentatives_echouees >= 2) {
                        // Bloquer le compte de l'utilisateur
                        await connection.execute(
                            "UPDATE utilisateurs SET statut = 'bloqué' WHERE id = ?",
                            [userId]
                        );
                        await connection.commit();

                        return res.status(403).json({
                            success: false,
                            message: 'Votre compte a été bloqué après 2 tentatives infructueuses. Veuillez contacter l\'administrateur.'
                        });
                    }

                    const restantes = 2 - (tentatives[0].tentatives_echouees || 0);
                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message: `Code de vérification invalide ou expiré. Il vous reste ${restantes} tentative(s) avant blocage du compte.`
                    });
                }

                // Marquer le code comme utilisé
                await connection.execute(
                    `UPDATE codes_verification_salaire 
                     SET utilise = 1, date_utilisation = NOW()
                     WHERE id = ?`,
                    [codeVerif.id]
                );
            }

            // Créer la confirmation de réception
            const insertSql = `
                INSERT INTO confirmations_reception_salaire (
                    id_salaire,
                    id_utilisateur,
                    mois,
                    annee,
                    montant,
                    code_verification_utilise,
                    confirme,
                    date_confirmation,
                    methode_confirmation
                ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), ?)
            `;

            await connection.execute(insertSql, [
                salaireId,
                userId,
                salaire.mois,
                salaire.annee,
                salaire.salaire_net,
                code_verification || null,
                code_verification ? 'code_email' : 'manuel'
            ]);

            // Mettre à jour le salaire
            await connection.execute(
                'UPDATE salaires SET confirme_reception = 1, date_confirmation_reception = NOW() WHERE id = ?',
                [salaireId]
            );

            await connection.commit();

            // --- Envoyer les notifications par email à l'admin et au manager ---
            try {
                // Récupérer les admins et managers actifs
                const [admins] = await db.query(
                    "SELECT nom_complet, email FROM utilisateurs WHERE role IN ('admin', 'manager') AND statut = 'actif'"
                );

                if (admins && admins.length > 0) {
                    // Envoyer un email à chaque admin/manager
                    for (const admin of admins) {
                        try {
                            await emailService.envoyerNotificationConfirmationReception(
                                admin.email,
                                admin.nom_complet,
                                salaire.nom_complet,
                                salaire.mois,
                                salaire.annee,
                                salaire.salaire_net
                            );
                        } catch (emailError) {
                            console.error(`Erreur envoi email confirmation à ${admin.email}:`, emailError);
                        }
                    }
                }
            } catch (notificationError) {
                console.error('Erreur lors de la récupération des admins pour notification:', notificationError);
            }

            res.status(200).json({
                success: true,
                message: 'Réception du salaire confirmée avec succès.'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Confirmer reception error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la confirmation de réception.'
        });
    } finally {
        connection.release();
    }
});

// Demander un code de vérification pour le salaire
router.post('/salaires/:id/demander-code', authenticate, authorize('veterinaire'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const userId = req.userId;
        const salaireId = req.params.id;

        // Vérifier que le salaire appartient à l'utilisateur
        const [salaire] = await connection.query(
            `SELECT s.id, u.email, u.nom_complet, s.mois, s.annee 
             FROM salaires s
             JOIN utilisateurs u ON s.id_utilisateur = u.id
             WHERE s.id = ? AND s.id_utilisateur = ?`,
            [salaireId, userId]
        );

        if (!salaire || salaire.length === 0) {
            return res.status(404).json({ success: false, message: 'Salaire non trouvé' });
        }

        const salaireData = salaire[0];

        // Générer code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const dateExpiration = new Date();
        dateExpiration.setHours(dateExpiration.getHours() + 24);

        // Sauvegarder en base
        await connection.execute(
            `INSERT INTO codes_verification_salaire (
                id_salaire, id_utilisateur, code_verification, date_expiration
            ) VALUES (?, ?, ?, ?)`,
            [salaireId, userId, code, dateExpiration]
        );

        // Envoyer email
        if (salaireData.email) {
            try {
                await emailService.envoyerCodeVerification(
                    salaireData.email,
                    code,
                    salaireData.nom_complet,
                    salaireData.mois,
                    salaireData.annee
                );
            } catch (emailError) {
                console.error('Erreur envoi email OTP:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Un code de vérification a été envoyé à votre email.',
            code: process.env.NODE_ENV === 'development' ? code : undefined
        });
    } catch (error) {
        console.error('Erreur demander-code:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
        connection.release();
    }
});

// Obtenir la liste des paiements reçus
router.get('/paiements/recus', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20, annee } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let sql = `
            SELECT 
                s.id,
                s.mois,
                s.annee,
                CASE 
                    WHEN s.mois = 1 THEN 'Janvier'
                    WHEN s.mois = 2 THEN 'Février'
                    WHEN s.mois = 3 THEN 'Mars'
                    WHEN s.mois = 4 THEN 'Avril'
                    WHEN s.mois = 5 THEN 'Mai'
                    WHEN s.mois = 6 THEN 'Juin'
                    WHEN s.mois = 7 THEN 'Juillet'
                    WHEN s.mois = 8 THEN 'Août'
                    WHEN s.mois = 9 THEN 'Septembre'
                    WHEN s.mois = 10 THEN 'Octobre'
                    WHEN s.mois = 11 THEN 'Novembre'
                    WHEN s.mois = 12 THEN 'Décembre'
                END as mois_nom,
                s.salaire_brut,
                s.salaire_net,
                s.date_paiement,
                s.mode_paiement,
                s.reference_paiement,
                s.confirme_reception,
                s.date_confirmation_reception,
                DATEDIFF(CURDATE(), s.date_paiement) as jours_depuis_paiement
            FROM salaires s
            WHERE s.id_utilisateur = ?
            AND s.statut_paiement = 'payé'
        `;
        const params = [userId];

        if (annee) {
            sql += ' AND s.annee = ?';
            params.push(parseInt(annee));
        }

        sql += ' ORDER BY s.annee DESC, s.mois DESC';
        sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

        const paiements = await db.query(sql, params);

        // Count total
        let countSql = `
            SELECT COUNT(*) as total
            FROM salaires
            WHERE id_utilisateur = ?
            AND statut_paiement = 'payé'
        `;
        const countParams = [userId];

        if (annee) {
            countSql += ' AND annee = ?';
            countParams.push(parseInt(annee));
        }

        const countResult = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: paiements,
            pagination: {
                total: countResult[0].total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult[0].total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get paiements recus error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paiements reçus.'
        });
    }
});

// Obtenir la liste des paiements en attente (non réglés)
router.get('/paiements/en-attente', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const sql = `
            SELECT 
                s.id,
                s.mois,
                s.annee,
                CASE 
                    WHEN s.mois = 1 THEN 'Janvier'
                    WHEN s.mois = 2 THEN 'Février'
                    WHEN s.mois = 3 THEN 'Mars'
                    WHEN s.mois = 4 THEN 'Avril'
                    WHEN s.mois = 5 THEN 'Mai'
                    WHEN s.mois = 6 THEN 'Juin'
                    WHEN s.mois = 7 THEN 'Juillet'
                    WHEN s.mois = 8 THEN 'Août'
                    WHEN s.mois = 9 THEN 'Septembre'
                    WHEN s.mois = 10 THEN 'Octobre'
                    WHEN s.mois = 11 THEN 'Novembre'
                    WHEN s.mois = 12 THEN 'Décembre'
                END as mois_nom,
                s.salaire_brut,
                s.salaire_net,
                s.statut_paiement,
                s.date_calcul,
                s.demande_paiement_envoyee,
                s.date_demande_paiement,
                DATEDIFF(CURDATE(), s.date_calcul) as jours_en_attente,
                d.statut as statut_demande,
                d.date_demande as date_demande_paiement
            FROM salaires s
            LEFT JOIN demandes_paiement_salaire d ON s.id = d.id_salaire
            WHERE s.id_utilisateur = ?
            AND s.statut_paiement IN ('calculé', 'reporté')
            ORDER BY s.annee DESC, s.mois DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `;

        const paiements = await db.query(sql, [userId]);

        // Count total
        const countSql = `
            SELECT COUNT(*) as total
            FROM salaires
            WHERE id_utilisateur = ?
            AND statut_paiement IN ('calculé', 'reporté')
        `;
        const countResult = await db.query(countSql, [userId]);

        res.status(200).json({
            success: true,
            data: paiements,
            pagination: {
                total: countResult[0].total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countResult[0].total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get paiements en attente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paiements en attente.'
        });
    }
});

// ==================== STATISTIQUES D'INTERVENTIONS ====================
// Obtenir le nombre de jours d'intervention par mois
router.get('/statistiques/interventions-mensuelles', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;
        const { annee = new Date().getFullYear() } = req.query;

        const sql = `
            SELECT 
                MONTH(date_intervention) as mois,
                CASE 
                    WHEN MONTH(date_intervention) = 1 THEN 'Janvier'
                    WHEN MONTH(date_intervention) = 2 THEN 'Février'
                    WHEN MONTH(date_intervention) = 3 THEN 'Mars'
                    WHEN MONTH(date_intervention) = 4 THEN 'Avril'
                    WHEN MONTH(date_intervention) = 5 THEN 'Mai'
                    WHEN MONTH(date_intervention) = 6 THEN 'Juin'
                    WHEN MONTH(date_intervention) = 7 THEN 'Juillet'
                    WHEN MONTH(date_intervention) = 8 THEN 'Août'
                    WHEN MONTH(date_intervention) = 9 THEN 'Septembre'
                    WHEN MONTH(date_intervention) = 10 THEN 'Octobre'
                    WHEN MONTH(date_intervention) = 11 THEN 'Novembre'
                    WHEN MONTH(date_intervention) = 12 THEN 'Décembre'
                END as mois_nom,
                COUNT(DISTINCT DATE(date_intervention)) as jours_intervention,
                COUNT(*) as nombre_interventions,
                COUNT(DISTINCT id_animal) as animaux_traites,
                SUM(CASE WHEN type_intervention = 'vaccination' THEN 1 ELSE 0 END) as vaccinations,
                SUM(CASE WHEN type_intervention = 'traitement' THEN 1 ELSE 0 END) as traitements,
                SUM(CASE WHEN type_intervention = 'consultation' THEN 1 ELSE 0 END) as consultations,
                SUM(CASE WHEN type_intervention = 'chirurgie' THEN 1 ELSE 0 END) as chirurgies,
                COALESCE(SUM(cout_intervention), 0) as cout_total
            FROM suivis_sanitaires
            WHERE id_technicien = ?
            AND YEAR(date_intervention) = ?
            GROUP BY MONTH(date_intervention), mois_nom
            ORDER BY MONTH(date_intervention)
        `;

        const statistiques = await db.query(sql, [userId, parseInt(annee)]);

        // Calculer les totaux annuels
        const totalSql = `
            SELECT 
                COUNT(DISTINCT DATE(date_intervention)) as total_jours,
                COUNT(*) as total_interventions,
                COUNT(DISTINCT id_animal) as total_animaux,
                COALESCE(SUM(cout_intervention), 0) as cout_total_annuel
            FROM suivis_sanitaires
            WHERE id_technicien = ?
            AND YEAR(date_intervention) = ?
        `;

        const resultsTotauxAnnuel = await db.query(totalSql, [userId, parseInt(annee)]);
        const totaux = (resultsTotauxAnnuel && resultsTotauxAnnuel.length > 0) ? resultsTotauxAnnuel[0] : {};

        res.status(200).json({
            success: true,
            data: {
                par_mois: statistiques,
                totaux: totaux,
                annee: parseInt(annee)
            }
        });
    } catch (error) {
        console.error('Get interventions mensuelles error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques d\'interventions.'
        });
    }
});

// Obtenir les jours d'intervention pour un mois spécifique
router.get('/statistiques/jours-intervention/:mois/:annee', authenticate, authorize('veterinaire'), async (req, res) => {
    try {
        const userId = req.userId;
        const mois = parseInt(req.params.mois);
        const annee = parseInt(req.params.annee);

        const sql = `
            SELECT 
                DATE(date_intervention) as date,
                COUNT(*) as nombre_interventions,
                COUNT(DISTINCT id_animal) as animaux_traites,
                GROUP_CONCAT(DISTINCT type_intervention) as types_interventions,
                COALESCE(SUM(cout_intervention), 0) as cout_total_jour
            FROM suivis_sanitaires
            WHERE id_technicien = ?
            AND MONTH(date_intervention) = ?
            AND YEAR(date_intervention) = ?
            GROUP BY DATE(date_intervention)
            ORDER BY DATE(date_intervention)
        `;

        const jours = await db.query(sql, [userId, mois, annee]);

        res.status(200).json({
            success: true,
            data: {
                jours: jours,
                mois: mois,
                annee: annee,
                total_jours: jours.length
            }
        });
    } catch (error) {
        console.error('Get jours intervention error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des jours d\'intervention.'
        });
    }
});

module.exports = router;