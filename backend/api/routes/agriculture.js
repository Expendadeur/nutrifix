const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// Gestion des parcelles
router.get('/parcelles', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            statut,
            type_sol,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT p.*, 
                   tc.nom_culture as culture_actuelle_nom,
                   u.nom_complet as responsable_nom
            FROM parcelles p
            LEFT JOIN cultures c ON p.id_culture_actuelle = c.id
            LEFT JOIN types_cultures tc ON c.id_type_culture = tc.id
            LEFT JOIN utilisateurs u ON c.id = u.id  -- Assuming culture has responsable
            WHERE 1=1
        `;
        const params = [];

        // Filter by user's department for managers
        if (req.userRole === 'manager') {
            // Assuming agriculture department ID is 5
            // In production, get department ID from database
            sql += ' AND 1=1'; // Adjust based on actual department structure
        }

        if (statut) {
            sql += ' AND p.statut = ?';
            params.push(statut);
        }

        if (type_sol) {
            sql += ' AND p.type_sol = ?';
            params.push(type_sol);
        }

        if (search) {
            sql += ` AND (
                p.reference LIKE ? OR 
                p.nom_parcelle LIKE ? OR 
                p.localisation LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY p.reference ASC';

        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const parcelles = await db.query(sql, params);

        const resultsCount = await db.query(countSql, countParams);
        const countResult = (resultsCount && resultsCount.length > 0) ? resultsCount[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: parcelles,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get parcelles error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des parcelles.'
        });
    }
});

// Créer une parcelle
router.post('/parcelles', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            reference,
            nom_parcelle,
            superficie_hectares,
            localisation,
            coordonnees_gps,
            type_sol,
            ph_sol,
            taux_humidite,
            irrigation_installee,
            proprietaire,
            loyer_annuel
        } = req.body;

        // Validation
        if (!reference || !nom_parcelle || !superficie_hectares || !localisation || !type_sol) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO parcelles (
                reference, nom_parcelle, superficie_hectares,
                localisation, coordonnees_gps, type_sol,
                ph_sol, taux_humidite, irrigation_installee,
                proprietaire, loyer_annuel, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;

        await db.query(sql, [
            reference,
            nom_parcelle,
            superficie_hectares,
            localisation,
            coordonnees_gps,
            type_sol,
            ph_sol,
            taux_humidite,
            irrigation_installee || false,
            proprietaire || 'propre',
            loyer_annuel || 0
        ]);

        res.status(201).json({
            success: true,
            message: 'Parcelle créée avec succès.'
        });
    } catch (error) {
        console.error('Create parcelle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la parcelle.'
        });
    }
});

// Planter une culture
router.post('/cultures', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            id_parcelle,
            id_type_culture,
            reference_saison,
            date_semaison,
            quantite_semences_kg,
            densite_semis,
            cout_total
        } = req.body;

        // Validation
        if (!id_parcelle || !id_type_culture || !reference_saison || !date_semaison || !quantite_semences_kg) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Check if parcel is available
        const parcelleSql = `SELECT statut, id_culture_actuelle FROM parcelles WHERE id = ?`;
        const resultsParcelle = await db.query(parcelleSql, [id_parcelle]);
        const parcelle = (resultsParcelle && resultsParcelle.length > 0) ? resultsParcelle[0] : null;

        if (!parcelle || parcelle.statut !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Parcelle non disponible.'
            });
        }

        if (parcelle.id_culture_actuelle) {
            return res.status(400).json({
                success: false,
                message: 'Parcelle déjà en culture.'
            });
        }

        // Get culture type info for harvest date
        const typeCultureSql = `SELECT duree_cycle_jours FROM types_cultures WHERE id = ?`;
        const resultsType = await db.query(typeCultureSql, [id_type_culture]);
        const typeCulture = (resultsType && resultsType.length > 0) ? resultsType[0] : null;

        if (!typeCulture) {
            return res.status(404).json({
                success: false,
                message: 'Type de culture non trouvé.'
            });
        }

        const dateSemaison = new Date(date_semaison);
        const dateRecoltePrevue = new Date(dateSemaison);
        dateRecoltePrevue.setDate(dateSemaison.getDate() + typeCulture.duree_cycle_jours);

        // Start transaction
        await db.transaction(async (connection) => {
            // Insert culture
            const cultureSql = `
                INSERT INTO cultures (
                    id_parcelle, id_type_culture, reference_saison,
                    date_semaison, date_recolte_prevue,
                    quantite_semences_kg, densite_semis,
                    stade_croissance, cout_total, statut
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'semis', ?, 'en_cours')
            `;

            const [result] = await connection.execute(cultureSql, [
                id_parcelle,
                id_type_culture,
                reference_saison,
                date_semaison,
                dateRecoltePrevue,
                quantite_semences_kg,
                densite_semis || null,
                cout_total || 0
            ]);

            // Update parcel with current culture
            await connection.execute(
                'UPDATE parcelles SET id_culture_actuelle = ?, statut = "en_culture" WHERE id = ?',
                [result.insertId, id_parcelle]
            );

            // Update stock of seeds (if applicable)
            if (quantite_semences_kg > 0) {
                // Find seed stock
                const stockSql = `
                    SELECT s.id 
                    FROM stocks s
                    JOIN intrants_agricoles ia ON s.id_article = ia.id
                    WHERE s.type_article = 'intrant'
                    AND ia.type = 'semence'
                    AND ia.id = (SELECT id FROM intrants_agricoles WHERE nom_intrant LIKE ? LIMIT 1)
                `;
                const [stock] = await connection.execute(stockSql, [`%${typeCulture.nom_culture}%`]);

                if (stock && stock.length > 0) {
                    // Record movement
                    await connection.execute(
                        `INSERT INTO mouvements_stock (
                            id_stock, type_mouvement, quantite,
                            unite_mesure, raison, commentaire,
                            effectue_par, date_mouvement
                        ) VALUES (?, 'sortie', ?, 'kg', 'consommation', ?, ?, CURDATE())`,
                        [stock[0].id, quantite_semences_kg, `Semis sur parcelle ${id_parcelle}`, req.userId]
                    );
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Culture plantée avec succès.'
        });
    } catch (error) {
        console.error('Create culture error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la plantation.'
        });
    }
});

// Enregistrer une récolte
router.post('/recoltes', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            id_culture,
            date_recolte_reelle,
            rendement_obtenu_kg,
            qualite,
            taux_perte,
            commentaires
        } = req.body;

        // Validation
        if (!id_culture || !date_recolte_reelle || !rendement_obtenu_kg) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Get culture info
        const cultureSql = `
            SELECT c.*, p.id as parcelle_id, tc.nom_culture
            FROM cultures c
            JOIN parcelles p ON c.id_parcelle = p.id
            JOIN types_cultures tc ON c.id_type_culture = tc.id
            WHERE c.id = ?
        `;
        const resultsCulture = await db.query(cultureSql, [id_culture]);
        const culture = (resultsCulture && resultsCulture.length > 0) ? resultsCulture[0] : null;

        if (!culture) {
            return res.status(404).json({
                success: false,
                message: 'Culture non trouvée.'
            });
        }

        if (culture.statut !== 'en_cours') {
            return res.status(400).json({
                success: false,
                message: 'Culture déjà récoltée ou abandonnée.'
            });
        }

        // Calculate estimated revenue based on average price
        const typeCultureSqlCalcul = `SELECT prix_moyen_kg FROM types_cultures WHERE id = ?`;
        const resultsTypeCalcul = await db.query(typeCultureSqlCalcul, [culture.id_type_culture]);
        const typeCulture = (resultsTypeCalcul && resultsTypeCalcul.length > 0) ? resultsTypeCalcul[0] : {};

        const revenu_estime = typeCulture.prix_moyen_kg ?
            rendement_obtenu_kg * typeCulture.prix_moyen_kg : 0;

        // Start transaction
        await db.transaction(async (connection) => {
            // Update culture
            const updateCultureSql = `
                UPDATE cultures 
                SET date_recolte_reelle = ?,
                    rendement_obtenu_kg = ?,
                    qualite = ?,
                    taux_perte = ?,
                    commentaires = ?,
                    revenu_estime = ?,
                    statut = 'recoltee'
                WHERE id = ?
            `;

            await connection.execute(updateCultureSql, [
                new Date(date_recolte_reelle).toISOString().split('T')[0],
                rendement_obtenu_kg,
                qualite || 'bonne',
                taux_perte || 0,
                commentaires,
                revenu_estime,
                id_culture
            ]);

            // Update parcel
            await connection.execute(
                'UPDATE parcelles SET id_culture_actuelle = NULL, statut = "active" WHERE id = ?',
                [culture.parcelle_id]
            );

            // Update stock with harvested product
            const stockSql = `
                SELECT id FROM stocks 
                WHERE type_article = 'culture' 
                AND id_article = ?
            `;
            const [stock] = await connection.execute(stockSql, [id_culture]);

            if (stock && stock.length > 0) {
                // Update existing stock
                await connection.execute(
                    'UPDATE stocks SET quantite_disponible = quantite_disponible + ? WHERE id = ?',
                    [rendement_obtenu_kg, stock[0].id]
                );
            } else {
                // Create new stock entry
                await connection.execute(
                    `INSERT INTO stocks (
                        type_article, id_article, quantite_disponible,
                        unite_mesure, emplacement, date_entree
                    ) VALUES ('culture', ?, ?, 'kg', 'Entrepôt agricole', CURDATE())`,
                    [id_culture, rendement_obtenu_kg]
                );
            }
        });

        res.status(200).json({
            success: true,
            message: 'Récolte enregistrée avec succès.'
        });
    } catch (error) {
        console.error('Enregistrer recolte error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la récolte.'
        });
    }
});

// Gestion des intrants agricoles
router.get('/intrants', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            type,
            statut,
            stock_bas,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT ia.*, 
                   SUM(CASE WHEN s.type_article = 'intrant' AND s.id_article = ia.id 
                       THEN s.quantite_disponible ELSE 0 END) as quantite_stock_reel
            FROM intrants_agricoles ia
            LEFT JOIN stocks s ON s.type_article = 'intrant' AND s.id_article = ia.id
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            sql += ' AND ia.type = ?';
            params.push(type);
        }

        if (statut) {
            sql += ' AND ia.statut = ?';
            params.push(statut);
        }

        if (stock_bas === 'true') {
            sql += ' AND ia.quantite_stock <= ia.seuil_alerte';
        }

        if (search) {
            sql += ` AND (
                ia.code_intrant LIKE ? OR 
                ia.nom_intrant LIKE ? OR 
                ia.marque LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' GROUP BY ia.id ORDER BY ia.nom_intrant ASC';

        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const intrants = await db.query(sql, params);

        const resultsCountIntrants = await db.query(countSql, countParams);
        const countResult = (resultsCountIntrants && resultsCountIntrants.length > 0) ? resultsCountIntrants[0] : { total: 0 };

        res.status(200).json({
            success: true,
            data: intrants,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get intrants error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des intrants.'
        });
    }
});

// Application d'intrant sur culture
router.post('/applications-intrants', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            id_culture,
            id_intrant,
            id_parcelle,
            quantite_utilisee,
            unite_utilisee,
            methode_application,
            conditions_meteo,
            objectif,
            observations
        } = req.body;

        // Validation
        if (!id_culture || !id_intrant || !id_parcelle || !quantite_utilisee || !objectif) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Check intrant stock
        const intrantSql = `SELECT quantite_stock, seuil_alerte, nom_intrant FROM intrants_agricoles WHERE id = ?`;
        const resultsIntrant = await db.query(intrantSql, [id_intrant]);
        const intrant = (resultsIntrant && resultsIntrant.length > 0) ? resultsIntrant[0] : null;

        if (!intrant) {
            return res.status(404).json({
                success: false,
                message: 'Intrant non trouvé.'
            });
        }

        if (intrant.quantite_stock < quantite_utilisee) {
            return res.status(400).json({
                success: false,
                message: 'Stock insuffisant.'
            });
        }

        // Start transaction
        await db.transaction(async (connection) => {
            // Record application
            const applicationSql = `
                INSERT INTO applications_intrants (
                    id_culture, id_intrant, id_parcelle, id_applicateur,
                    date_application, quantite_utilisee, unite_utilisee,
                    methode_application, conditions_meteo, objectif, observations
                ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)
            `;

            await connection.execute(applicationSql, [
                id_culture,
                id_intrant,
                id_parcelle,
                req.userId,
                quantite_utilisee,
                unite_utilisee,
                methode_application,
                conditions_meteo,
                objectif,
                observations
            ]);

            // Update intrant stock
            await connection.execute(
                'UPDATE intrants_agricoles SET quantite_stock = quantite_stock - ? WHERE id = ?',
                [quantite_utilisee, id_intrant]
            );

            // Send alert if stock is low
            if (intrant.quantite_stock - quantite_utilisee <= intrant.seuil_alerte) {
                // Create notification
                const notificationSql = `
                    INSERT INTO notifications (
                        id_utilisateur, type_notification, titre, message, priorite,
                        type_reference, id_reference
                    ) SELECT 
                        id, 'alerte_stock', 
                        'Stock bas d\'intrant',
                        CONCAT('Le stock de ', ?, ' est bas (', ?, ' ', ?, ' restant)'),
                        'high',
                        'intrant', ?
                    FROM utilisateurs 
                    WHERE role IN ('admin', 'manager') 
                    AND id_departement IN (5, 9) -- Agriculture et Production
                    AND statut = 'actif'
                `;

                await connection.execute(notificationSql, [
                    intrant.nom_intrant,
                    intrant.quantite_stock - quantite_utilisee,
                    unite_utilisee,
                    id_intrant
                ]);
            }
        });

        res.status(201).json({
            success: true,
            message: 'Application d\'intrant enregistrée.'
        });
    } catch (error) {
        console.error('Application intrant error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'application de l\'intrant.'
        });
    }
});

// Statistiques agriculture
router.get('/statistiques', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Parcel statistics
        const parcelleSql = `
            SELECT 
                COUNT(*) as total_parcelles,
                SUM(superficie_hectares) as superficie_totale,
                SUM(CASE WHEN statut = 'en_culture' THEN 1 ELSE 0 END) as parcelles_en_culture,
                SUM(CASE WHEN statut = 'active' THEN 1 ELSE 0 END) as parcelles_disponibles,
                AVG(productivite_moyenne) as productivite_moyenne
            FROM parcelles
        `;
        const resultsParcelleStats = await db.query(parcelleSql);
        const parcelleStats = (resultsParcelleStats && resultsParcelleStats.length > 0) ? resultsParcelleStats[0] : {};

        // Culture statistics
        let cultureSql = `
            SELECT 
                COUNT(*) as total_cultures,
                SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as cultures_en_cours,
                SUM(CASE WHEN statut = 'recoltee' THEN 1 ELSE 0 END) as cultures_recoltees,
                SUM(rendement_obtenu_kg) as total_production_kg,
                SUM(cout_total) as total_couts,
                SUM(revenu_estime) as revenu_estime_total
            FROM cultures
            WHERE 1=1
        `;
        const cultureParams = [];

        if (startDate) {
            cultureSql += ' AND date_semaison >= ?';
            cultureParams.push(startDate);
        }

        if (endDate) {
            cultureSql += ' AND date_semaison <= ?';
            cultureParams.push(endDate);
        }

        const resultsCultureStats = await db.query(cultureSql, cultureParams);
        const cultureStats = (resultsCultureStats && resultsCultureStats.length > 0) ? resultsCultureStats[0] : {};

        // Intrant usage statistics
        const intrantSql = `
            SELECT 
                ia.type,
                COUNT(ai.id) as nombre_applications,
                SUM(ai.quantite_utilisee) as quantite_totale,
                SUM(ai.cout_application) as cout_total
            FROM applications_intrants ai
            JOIN intrants_agricoles ia ON ai.id_intrant = ia.id
            WHERE 1=1
        `;
        const intrantParams = [];

        if (startDate) {
            intrantSql += ' AND ai.date_application >= ?';
            intrantParams.push(startDate);
        }

        if (endDate) {
            intrantSql += ' AND ai.date_application <= ?';
            intrantParams.push(endDate);
        }

        intrantSql += ' GROUP BY ia.type';

        const intrantStats = await db.query(intrantSql, intrantParams);

        // Production by culture type
        const productionSql = `
            SELECT 
                tc.nom_culture,
                COUNT(c.id) as nombre_cultures,
                SUM(c.rendement_obtenu_kg) as total_production,
                AVG(c.rendement_obtenu_kg) as rendement_moyen,
                SUM(c.cout_total) as couts_totaux,
                SUM(c.revenu_estime) as revenus_estimes
            FROM cultures c
            JOIN types_cultures tc ON c.id_type_culture = tc.id
            WHERE c.statut = 'recoltee'
            GROUP BY tc.id, tc.nom_culture
            ORDER BY total_production DESC
        `;
        const productionStats = await db.query(productionSql);

        res.status(200).json({
            success: true,
            data: {
                parcelles: parcelleStats,
                cultures: cultureStats,
                intrants: intrantStats,
                production: productionStats
            }
        });
    } catch (error) {
        console.error('Get agriculture stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;
