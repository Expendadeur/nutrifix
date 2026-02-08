const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// Gestion des animaux
router.get('/animaux', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const {
            espece,
            race,
            sexe,
            statut,
            statut_sante,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT a.*,
                   m.numero_identification as mere_numero,
                   p.numero_identification as pere_numero,
                   f.nom_fournisseur
            FROM animaux a
            LEFT JOIN animaux m ON a.id_mere = m.id
            LEFT JOIN animaux p ON a.id_pere = p.id
            LEFT JOIN fournisseurs f ON a.id_fournisseur = f.id
            WHERE 1=1
        `;
        const params = [];

        if (espece) {
            sql += ' AND a.espece = ?';
            params.push(espece);
        }

        if (race) {
            sql += ' AND a.race = ?';
            params.push(race);
        }

        if (sexe) {
            sql += ' AND a.sexe = ?';
            params.push(sexe);
        }

        if (statut) {
            sql += ' AND a.statut = ?';
            params.push(statut);
        }

        if (statut_sante) {
            sql += ' AND a.statut_sante = ?';
            params.push(statut_sante);
        }

        if (search) {
            sql += ` AND (
                a.numero_identification LIKE ? OR 
                a.nom_animal LIKE ? OR 
                a.marques_distinctives LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY a.numero_identification ASC';

        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const animaux = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM animaux WHERE 1=1`;
        const countParams = [];

        if (espece) {
            countSql += ' AND espece = ?';
            countParams.push(espece);
        }

        if (statut) {
            countSql += ' AND statut = ?';
            countParams.push(statut);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: animaux,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
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

// Enregistrer un nouvel animal
router.post('/animaux', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const {
            numero_identification,
            nom_animal,
            espece,
            race,
            sexe,
            date_naissance,
            poids_naissance,
            origine,
            id_fournisseur,
            id_mere,
            id_pere,
            prix_achat,
            id_enclos,
            statut_sante,
            photo
        } = req.body;

        // Validation
        if (!numero_identification || !espece || !race || !sexe || !date_naissance || !origine) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO animaux (
                numero_identification, nom_animal, espece, race, sexe,
                date_naissance, poids_naissance, origine, id_fournisseur,
                id_mere, id_pere, prix_achat, id_enclos, statut_sante,
                statut, date_acquisition, photo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vivant', CURDATE(), ?)
        `;

        await db.query(sql, [
            numero_identification,
            nom_animal,
            espece,
            race,
            sexe,
            date_naissance,
            poids_naissance || null,
            origine,
            id_fournisseur || null,
            id_mere || null,
            id_pere || null,
            prix_achat || null,
            id_enclos || null,
            statut_sante || 'bon',
            photo
        ]);

        res.status(201).json({
            success: true,
            message: 'Animal enregistré avec succès.'
        });
    } catch (error) {
        console.error('Create animal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'animal.'
        });
    }
});

// Suivi sanitaire - Enregistrer une intervention
router.post('/suivis-sanitaires', authenticate, authorize('admin', 'veterinaire'), async (req, res) => {
    try {
        const {
            id_animal,
            type_intervention,
            symptomes,
            diagnostic,
            produit_utilise,
            dosage,
            mode_administration,
            veterinaire,
            date_prochaine_visite,
            instructions_suivi,
            observations,
            cout_intervention
        } = req.body;

        // Validation
        if (!id_animal || !type_intervention || !diagnostic) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO suivis_sanitaires (
                id_animal, type_intervention, symptomes,
                diagnostic, produit_utilise, dosage,
                mode_administration, veterinaire, id_technicien,
                date_prochaine_visite, instructions_suivi,
                observations, cout_intervention
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            id_animal,
            type_intervention,
            symptomes,
            diagnostic,
            produit_utilise,
            dosage,
            mode_administration,
            veterinaire || req.user.nom_complet,
            req.userId,
            date_prochaine_visite,
            instructions_suivi,
            observations,
            cout_intervention || 0
        ]);

        // Update animal health status if treatment
        if (type_intervention === 'traitement') {
            await db.query(
                'UPDATE animaux SET statut_sante = "en_traitement" WHERE id = ?',
                [id_animal]
            );
        }

        // Create notification for next visit
        if (date_prochaine_visite) {
            const notificationSql = `
                INSERT INTO notifications (
                    id_utilisateur, type_notification, titre, message,
                    priorite, type_reference, id_reference, date_creation
                ) VALUES (?, 'sanitaire', 'Visite de suivi',
                CONCAT('Visite de suivi prévue pour l\'animal ', 
                (SELECT numero_identification FROM animaux WHERE id = ?), 
                ' le ', ?), 'normale', 'animal', ?, DATE_ADD(CURDATE(), INTERVAL -1 DAY))
            `;

            await db.query(notificationSql, [
                req.userId,
                id_animal,
                date_prochaine_visite,
                id_animal
            ]);
        }

        res.status(201).json({
            success: true,
            message: 'Intervention sanitaire enregistrée.'
        });
    } catch (error) {
        console.error('Create suivi sanitaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'intervention.'
        });
    }
});

// Production laitière - Enregistrer une traite
router.post('/productions-lait', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const {
            id_animal,
            quantite_litres,
            taux_matiere_grasse,
            taux_proteine,
            temperature,
            ph,
            qualite,
            observations,
            methode_traite,
            destination,
            id_reservoir
        } = req.body;

        // Validation
        if (!id_animal || !quantite_litres) {
            return res.status(400).json({
                success: false,
                message: 'Animal et quantité requis.'
            });
        }

        // Check if animal is a female and of milk-producing species
        const animalSql = `SELECT espece, sexe FROM animaux WHERE id = ? AND statut = 'vivant'`;
        const [animal] = await db.query(animalSql, [id_animal]);

        if (!animal) {
            return res.status(404).json({
                success: false,
                message: 'Animal non trouvé ou non vivant.'
            });
        }

        if (animal.sexe !== 'femelle' || !['vache', 'brebis', 'chevre'].includes(animal.espece)) {
            return res.status(400).json({
                success: false,
                message: 'Animal non producteur de lait.'
            });
        }

        const sql = `
            INSERT INTO productions_lait (
                id_animal, date_production, quantite_litres,
                taux_matiere_grasse, taux_proteine, temperature,
                ph, qualite, observations, traite_par,
                heure_traite, methode_traite, destination, id_reservoir
            ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, CURTIME(), ?, ?, ?)
        `;

        await db.query(sql, [
            id_animal,
            quantite_litres,
            taux_matiere_grasse || null,
            taux_proteine || null,
            temperature || null,
            ph || null,
            qualite || 'B',
            observations,
            req.userId,
            methode_traite || 'manuel',
            destination || 'vente',
            id_reservoir || null
        ]);

        // Update stock of milk
        const stockSql = `
            INSERT INTO stocks (
                type_article, id_article, quantite_disponible,
                unite_mesure, emplacement, date_entree,
                cout_unitaire
            ) VALUES ('lait', LAST_INSERT_ID(), ?, 'litre', 'Frigo laitier', CURDATE(), 
                (SELECT prix_moyen_kg FROM types_cultures WHERE nom_culture LIKE '%lait%' LIMIT 1))
            ON DUPLICATE KEY UPDATE 
                quantite_disponible = quantite_disponible + VALUES(quantite_disponible),
                date_modification = CURDATE()
        `;

        await db.query(stockSql, [quantite_litres]);

        res.status(201).json({
            success: true,
            message: 'Production laitière enregistrée.'
        });
    } catch (error) {
        console.error('Create production lait error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la production.'
        });
    }
});

// Production d'œufs - Enregistrer une récolte
router.post('/productions-oeufs', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_poulailler,
            nombre_oeufs,
            oeufs_casses,
            oeufs_sales,
            calibre_petit,
            calibre_moyen,
            calibre_gros,
            calibre_extra_gros,
            taux_fertile,
            observations,
            stockage_temperature,
            destination
        } = req.body;

        // Validation
        if (!id_poulailler || !nombre_oeufs) {
            return res.status(400).json({
                success: false,
                message: 'Poulailler et nombre d\'œufs requis.'
            });
        }

        const sql = `
            INSERT INTO productions_oeufs (
                id_poulailler, date_recolte, nombre_oeufs,
                oeufs_casses, oeufs_sales, calibre_petit,
                calibre_moyen, calibre_gros, calibre_extra_gros,
                taux_fertile, observations, recolte_par,
                heure_recolte, stockage_temperature, destination
            ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURTIME(), ?, ?)
        `;

        await db.query(sql, [
            id_poulailler,
            nombre_oeufs,
            oeufs_casses || 0,
            oeufs_sales || 0,
            calibre_petit || 0,
            calibre_moyen || Math.floor(nombre_oeufs * 0.5), // Default distribution
            calibre_gros || Math.floor(nombre_oeufs * 0.3),
            calibre_extra_gros || Math.floor(nombre_oeufs * 0.2),
            taux_fertile || null,
            observations,
            req.userId,
            stockage_temperature || 4.0,
            destination || 'vente'
        ]);

        // Update stock of eggs
        const stockSql = `
            INSERT INTO stocks (
                type_article, id_article, quantite_disponible,
                unite_mesure, emplacement, date_entree,
                date_peremption
            ) VALUES ('oeufs', LAST_INSERT_ID(), ?, 'unite', 'Frigo œufs', CURDATE(), 
                DATE_ADD(CURDATE(), INTERVAL 28 DAY))
            ON DUPLICATE KEY UPDATE 
                quantite_disponible = quantite_disponible + VALUES(quantite_disponible),
                date_modification = CURDATE()
        `;

        await db.query(stockSql, [nombre_oeufs - (oeufs_casses || 0)]);

        res.status(201).json({
            success: true,
            message: 'Production d\'œufs enregistrée.'
        });
    } catch (error) {
        console.error('Create production oeufs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la production.'
        });
    }
});

// Distribution d'aliments
router.post('/rations-alimentaires', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_animal,
            id_aliment,
            quantite_distribuee,
            unite_distribution,
            acceptation,
            reste_non_consomme,
            observations
        } = req.body;

        // Validation
        if (!id_animal || !id_aliment || !quantite_distribuee) {
            return res.status(400).json({
                success: false,
                message: 'Animal, aliment et quantité requis.'
            });
        }

        // Check aliment stock
        const alimentSql = `SELECT quantite_stock, seuil_alerte FROM aliments_betail WHERE id = ?`;
        const [aliment] = await db.query(alimentSql, [id_aliment]);

        if (!aliment) {
            return res.status(404).json({
                success: false,
                message: 'Aliment non trouvé.'
            });
        }

        if (aliment.quantite_stock < quantite_distribuee) {
            return res.status(400).json({
                success: false,
                message: 'Stock d\'aliment insuffisant.'
            });
        }

        // Start transaction
        await db.transaction(async (connection) => {
            // Record distribution
            const distributionSql = `
                INSERT INTO rations_alimentaires (
                    id_animal, id_aliment, date_distribution,
                    heure_distribution, quantite_distribuee,
                    unite_distribution, distribue_par, acceptation,
                    reste_non_consomme, observations
                ) VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?)
            `;

            await connection.execute(distributionSql, [
                id_animal,
                id_aliment,
                quantite_distribuee,
                unite_distribution,
                req.userId,
                acceptation || 'complete',
                reste_non_consomme || 0,
                observations
            ]);

            // Update aliment stock
            await connection.execute(
                'UPDATE aliments_betail SET quantite_stock = quantite_stock - ? WHERE id = ?',
                [quantite_distribuee, id_aliment]
            );

            // Send alert if stock is low
            if (aliment.quantite_stock - quantite_distribuee <= aliment.seuil_alerte) {
                const notificationSql = `
                    INSERT INTO notifications (
                        id_utilisateur, type_notification, titre, message, priorite,
                        type_reference, id_reference
                    ) SELECT 
                        id, 'alerte_stock', 
                        'Stock bas d\'aliment',
                        CONCAT('Le stock de ', ?, ' est bas (', ?, ' ', ?, ' restant)'),
                        'high',
                        'aliment', ?
                    FROM utilisateurs 
                    WHERE role IN ('admin', 'manager') 
                    AND id_departement IN (6, 9) -- Élevage et Production
                    AND statut = 'actif'
                `;

                await connection.execute(notificationSql, [
                    aliment.nom_aliment,
                    aliment.quantite_stock - quantite_distribuee,
                    unite_distribution,
                    id_aliment
                ]);
            }
        });

        res.status(201).json({
            success: true,
            message: 'Distribution d\'aliment enregistrée.'
        });
    } catch (error) {
        console.error('Create ration alimentaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la distribution.'
        });
    }
});

// Statistiques élevage
router.get('/statistiques', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Animal statistics
        const animalSql = `
            SELECT 
                COUNT(*) as total_animaux,
                SUM(CASE WHEN statut = 'vivant' THEN 1 ELSE 0 END) as animaux_vivants,
                SUM(CASE WHEN sexe = 'male' THEN 1 ELSE 0 END) as males,
                SUM(CASE WHEN sexe = 'femelle' THEN 1 ELSE 0 END) as femelles,
                COUNT(DISTINCT espece) as nombre_especes,
                COUNT(DISTINCT race) as nombre_races
            FROM animaux
        `;
        const [animalStats] = await db.query(animalSql);

        // Health statistics
        const healthSql = `
            SELECT 
                statut_sante,
                COUNT(*) as nombre_animaux
            FROM animaux 
            WHERE statut = 'vivant'
            GROUP BY statut_sante
        `;
        const healthStats = await db.query(healthSql);

        // Milk production statistics
        let milkSql = `
            SELECT 
                COUNT(*) as nombre_traites,
                SUM(quantite_litres) as total_lait_produit,
                AVG(quantite_litres) as moyenne_par_traite,
                AVG(taux_matiere_grasse) as taux_grasse_moyen,
                AVG(taux_proteine) as taux_proteine_moyen
            FROM productions_lait
            WHERE 1=1
        `;
        const milkParams = [];

        if (startDate) {
            milkSql += ' AND date_production >= ?';
            milkParams.push(startDate);
        }

        if (endDate) {
            milkSql += ' AND date_production <= ?';
            milkParams.push(endDate);
        }

        const [milkStats] = await db.query(milkSql, milkParams);

        // Egg production statistics
        let eggSql = `
            SELECT 
                COUNT(*) as nombre_recoltes,
                SUM(nombre_oeufs) as total_oeufs,
                AVG(nombre_oeufs) as moyenne_par_recolte,
                SUM(oeufs_casses) as oeufs_casses_total,
                SUM(oeufs_sales) as oeufs_sales_total
            FROM productions_oeufs
            WHERE 1=1
        `;
        const eggParams = [];

        if (startDate) {
            eggSql += ' AND date_recolte >= ?';
            eggParams.push(startDate);
        }

        if (endDate) {
            eggSql += ' AND date_recolte <= ?';
            eggParams.push(endDate);
        }

        const [eggStats] = await db.query(eggSql, eggParams);

        // Feed consumption statistics
        let feedSql = `
            SELECT 
                COUNT(*) as nombre_distributions,
                SUM(quantite_distribuee) as total_aliment,
                SUM(cout_distribution) as cout_total_alimentation
            FROM rations_alimentaires
            WHERE 1=1
        `;
        const feedParams = [];

        if (startDate) {
            feedSql += ' AND date_distribution >= ?';
            feedParams.push(startDate);
        }

        if (endDate) {
            feedSql += ' AND date_distribution <= ?';
            feedParams.push(endDate);
        }

        const [feedStats] = await db.query(feedSql, feedParams);

        res.status(200).json({
            success: true,
            data: {
                animaux: animalStats,
                sante: healthStats,
                lait: milkStats,
                oeufs: eggStats,
                alimentation: feedStats
            }
        });
    } catch (error) {
        console.error('Get elevage stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;