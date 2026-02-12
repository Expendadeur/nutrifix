// backend/routes/articlesRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// ============================================
// RÉCUPÉRER TOUS LES ARTICLES DISPONIBLES
// ============================================
router.get('/articles', authenticate, authorize('admin', 'manager', 'employe', 'comptable'), async (req, res) => {
    try {
        const { type, search } = req.query;

        let articles = [];

        // 1. ARTICLES EN STOCK (pour la vente)
        if (!type || type === 'stock') {
            const stocksResult = await db.query(`
                SELECT 
                    'stock' as source,
                    s.id,
                    s.type_article,
                    s.id_article,
                    CASE 
                        WHEN s.type_article = 'lait' THEN CONCAT('Lait (Stock)')
                        WHEN s.type_article = 'oeufs' THEN CONCAT('Œufs - ', COALESCE(s.etiquette, 'Sans étiquette'))
                        WHEN s.type_article = 'viande' THEN CONCAT('Viande (Stock)')
                        WHEN s.type_article = 'culture' THEN CONCAT('Culture (Stock)')
                        WHEN s.type_article = 'intrant' THEN COALESCE(i.nom_intrant, 'Intrant')
                        WHEN s.type_article = 'aliment' THEN COALESCE(a.nom_aliment, 'Aliment')
                        WHEN s.type_article = 'piece' THEN CONCAT('Pièce (Stock)')
                        WHEN s.type_article = 'equipement' THEN CONCAT('Équipement (Stock)')
                        ELSE CONCAT(s.type_article, ' (Stock)')
                    END as designation,
                    s.quantite_disponible,
                    s.unite_mesure,
                    s.cout_unitaire as prix_unitaire_suggere,
                    s.emplacement,
                    s.statut,
                    'vente' as type_operation
                FROM stocks s
                LEFT JOIN intrants_agricoles i ON s.type_article = 'intrant' AND s.id_article = i.id
                LEFT JOIN aliments_betail a ON s.type_article = 'aliment' AND s.id_article = a.id
                WHERE s.statut = 'disponible' 
                AND s.quantite_disponible > 0
                ${search ? "AND (s.type_article LIKE ? OR COALESCE(s.etiquette, '') LIKE ? OR COALESCE(i.nom_intrant, '') LIKE ? OR COALESCE(a.nom_aliment, '') LIKE ?)" : ""}
                ORDER BY s.type_article, s.etiquette
            `, search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : []);

            articles = articles.concat(Array.isArray(stocksResult) ? stocksResult : []);
        }

        // 2. ANIMAUX (pour la vente)
        if (!type || type === 'animaux') {
            const animauxResult = await db.query(`
                SELECT 
                    'animaux' as source,
                    id,
                    'animal' as type_article,
                    id as id_article,
                    CONCAT(espece, ' - ', numero_identification, 
                           CASE WHEN nom_animal IS NOT NULL THEN CONCAT(' (', nom_animal, ')') ELSE '' END) as designation,
                    1 as quantite_disponible,
                    'unité' as unite_mesure,
                    COALESCE(prix_achat, 0) as prix_unitaire_suggere,
                    NULL as emplacement,
                    statut,
                    'vente' as type_operation
                FROM animaux
                WHERE statut = 'vivant'
                ${search ? "AND (espece LIKE ? OR numero_identification LIKE ? OR COALESCE(nom_animal, '') LIKE ?)" : ""}
                ORDER BY espece, numero_identification
            `, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

            articles = articles.concat(Array.isArray(animauxResult) ? animauxResult : []);
        }

        // 3. VÉHICULES (pour la vente)
        if (!type || type === 'vehicules') {
            const vehiculesResult = await db.query(`
                SELECT 
                    'vehicules' as source,
                    id,
                    'vehicule' as type_article,
                    id as id_article,
                    CONCAT(type_vehicule, ' - ', marque, ' ', modele, ' (', immatriculation, ')') as designation,
                    1 as quantite_disponible,
                    'unité' as unite_mesure,
                    COALESCE(valeur_actuelle, prix_achat, 0) as prix_unitaire_suggere,
                    NULL as emplacement,
                    statut,
                    'vente' as type_operation
                FROM vehicules
                WHERE statut = 'actif' AND disponible = 1
                ${search ? "AND (type_vehicule LIKE ? OR marque LIKE ? OR immatriculation LIKE ?)" : ""}
                ORDER BY type_vehicule, marque
            `, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

            articles = articles.concat(Array.isArray(vehiculesResult) ? vehiculesResult : []);
        }

        // 4. INTRANTS AGRICOLES (pour l'achat et la vente)
        if (!type || type === 'intrants') {
            const intrantsResult = await db.query(`
                SELECT 
                    'intrants' as source,
                    id,
                    'intrant' as type_article,
                    id as id_article,
                    CONCAT(nom_intrant, ' - ', type) as designation,
                    quantite_stock as quantite_disponible,
                    unite_mesure,
                    COALESCE(prix_unitaire_vente, prix_unitaire_achat) as prix_unitaire_suggere,
                    COALESCE(emplacement, 'Non défini') as emplacement,
                    statut,
                    'achat_vente' as type_operation
                FROM intrants_agricoles
                WHERE statut = 'actif'
                ${search ? "AND (nom_intrant LIKE ? OR type LIKE ?)" : ""}
                ORDER BY nom_intrant
            `, search ? [`%${search}%`, `%${search}%`] : []);

            articles = articles.concat(Array.isArray(intrantsResult) ? intrantsResult : []);
        }

        // 5. ALIMENTS BÉTAIL (pour l'achat et la vente)
        if (!type || type === 'aliments') {
            const alimentsResult = await db.query(`
                SELECT 
                    'aliments' as source,
                    id,
                    'aliment' as type_article,
                    id as id_article,
                    CONCAT(nom_aliment, ' - ', type) as designation,
                    quantite_stock as quantite_disponible,
                    unite_mesure,
                    COALESCE(prix_unitaire_vente, prix_unitaire_achat) as prix_unitaire_suggere,
                    COALESCE(emplacement, 'Non défini') as emplacement,
                    'actif' as statut,
                    'achat_vente' as type_operation
                FROM aliments_betail
                WHERE statut = 'actif'
                ${search ? "AND (nom_aliment LIKE ? OR type LIKE ?)" : ""}
                ORDER BY nom_aliment
            `, search ? [`%${search}%`, `%${search}%`] : []);

            articles = articles.concat(Array.isArray(alimentsResult) ? alimentsResult : []);
        }

        // 6. PRODUCTION LAITIÈRE (pour la vente)
        if (!type || type === 'lait') {
            const laitResult = await db.query(`
                SELECT 
                    'production_lait' as source,
                    0 as id,
                    'lait' as type_article,
                    0 as id_article,
                    'Lait frais (Production)' as designation,
                    COALESCE(SUM(pl.quantite_litres), 0) as quantite_disponible,
                    'litres' as unite_mesure,
                    1800 as prix_unitaire_suggere,
                    NULL as emplacement,
                    'disponible' as statut,
                    'vente' as type_operation
                FROM productions_lait pl
                WHERE pl.destination = 'vente' 
                AND pl.date_production >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            `);

            const lait = Array.isArray(laitResult) ? laitResult[0] : laitResult;
            if (lait && lait.quantite_disponible > 0) {
                articles.push(lait);
            }
        }

        // 7. PRODUCTION ŒUFS (pour la vente)
        if (!type || type === 'oeufs') {
            const oeufsResult = await db.query(`
                SELECT 
                    'production_oeufs' as source,
                    0 as id,
                    'oeufs' as type_article,
                    0 as id_article,
                    'Œufs - Petit calibre' as designation,
                    COALESCE(SUM(po.calibre_petit), 0) as quantite_disponible,
                    'unité' as unite_mesure,
                    300 as prix_unitaire_suggere,
                    NULL as emplacement,
                    'disponible' as statut,
                    'vente' as type_operation
                FROM productions_oeufs po
                WHERE po.destination = 'vente' 
                AND po.date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                AND po.calibre_petit > 0
                
                UNION ALL
                
                SELECT 
                    'production_oeufs' as source,
                    0 as id,
                    'oeufs' as type_article,
                    0 as id_article,
                    'Œufs - Moyen calibre' as designation,
                    COALESCE(SUM(po.calibre_moyen), 0) as quantite_disponible,
                    'unité' as unite_mesure,
                    400 as prix_unitaire_suggere,
                    NULL as emplacement,
                    'disponible' as statut,
                    'vente' as type_operation
                FROM productions_oeufs po
                WHERE po.destination = 'vente' 
                AND po.date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                AND po.calibre_moyen > 0
                
                UNION ALL
                
                SELECT 
                    'production_oeufs' as source,
                    0 as id,
                    'oeufs' as type_article,
                    0 as id_article,
                    'Œufs - Gros calibre' as designation,
                    COALESCE(SUM(po.calibre_gros), 0) as quantite_disponible,
                    'unité' as unite_mesure,
                    500 as prix_unitaire_suggere,
                    NULL as emplacement,
                    'disponible' as statut,
                    'vente' as type_operation
                FROM productions_oeufs po
                WHERE po.destination = 'vente' 
                AND po.date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                AND po.calibre_gros > 0
                
                UNION ALL
                
                SELECT 
                    'production_oeufs' as source,
                    0 as id,
                    'oeufs' as type_article,
                    0 as id_article,
                    'Œufs - Extra gros calibre' as designation,
                    COALESCE(SUM(po.calibre_extra_gros), 0) as quantite_disponible,
                    'unité' as unite_mesure,
                    600 as prix_unitaire_suggere,
                    NULL as emplacement,
                    'disponible' as statut,
                    'vente' as type_operation
                FROM productions_oeufs po
                WHERE po.destination = 'vente' 
                AND po.date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                AND po.calibre_extra_gros > 0
            `);

            articles = articles.concat(Array.isArray(oeufsResult) ? oeufsResult : []);
        }

        // 8. AUTRES ARTICLES PERSONNALISÉS (pour achat)
        // Permet d'ajouter des articles non répertoriés
        if (!type || type === 'autre') {
            articles.push({
                source: 'autre',
                id: 0,
                type_article: 'autre',
                id_article: 0,
                designation: 'Autre article (à spécifier)',
                quantite_disponible: null,
                unite_mesure: 'unité',
                prix_unitaire_suggere: 0,
                emplacement: null,
                statut: 'disponible',
                type_operation: 'achat_vente'
            });
        }

        res.status(200).json({
            success: true,
            data: articles,
            total: articles.length
        });
    } catch (error) {
        console.error('❌ Get articles error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des articles.',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                code: error.code,
                sql: error.sql
            } : undefined
        });
    }
});

// ============================================
// RÉCUPÉRER DÉTAILS D'UN ARTICLE
// ============================================
router.get('/articles/:source/:id', authenticate, async (req, res) => {
    try {
        const { source, id } = req.params;
        let article = null;

        switch (source) {
            case 'stock':
                const stockResult = await db.query(`
                    SELECT 
                        s.*,
                        CASE 
                            WHEN s.type_article = 'intrant' THEN i.nom_intrant
                            WHEN s.type_article = 'aliment' THEN a.nom_aliment
                            ELSE s.etiquette
                        END as nom_article,
                        CASE 
                            WHEN s.type_article = 'intrant' THEN i.unite_mesure
                            WHEN s.type_article = 'aliment' THEN a.unite_mesure
                            ELSE s.unite_mesure
                        END as unite_article
                    FROM stocks s
                    LEFT JOIN intrants_agricoles i ON s.type_article = 'intrant' AND s.id_article = i.id
                    LEFT JOIN aliments_betail a ON s.type_article = 'aliment' AND s.id_article = a.id
                    WHERE s.id = ?
                `, [id]);
                article = Array.isArray(stockResult) ? stockResult[0] : stockResult;
                break;

            case 'animaux':
                const animalResult = await db.query('SELECT * FROM animaux WHERE id = ?', [id]);
                article = Array.isArray(animalResult) ? animalResult[0] : animalResult;
                break;

            case 'vehicules':
                const vehiculeResult = await db.query('SELECT * FROM vehicules WHERE id = ?', [id]);
                article = Array.isArray(vehiculeResult) ? vehiculeResult[0] : vehiculeResult;
                break;

            case 'intrants':
                const intrantResult = await db.query('SELECT * FROM intrants_agricoles WHERE id = ?', [id]);
                article = Array.isArray(intrantResult) ? intrantResult[0] : intrantResult;
                break;

            case 'aliments':
                const alimentResult = await db.query('SELECT * FROM aliments_betail WHERE id = ?', [id]);
                article = Array.isArray(alimentResult) ? alimentResult[0] : alimentResult;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Source invalide.'
                });
        }

        if (!article) {
            return res.status(404).json({
                success: false,
                message: 'Article non trouvé.'
            });
        }

        res.status(200).json({
            success: true,
            data: article
        });
    } catch (error) {
        console.error('❌ Get article details error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'article.',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                code: error.code,
                sql: error.sql
            } : undefined
        });
    }
});

// ============================================
// VÉRIFIER DISPONIBILITÉ STOCK
// ============================================
router.post('/articles/check-stock', authenticate, async (req, res) => {
    try {
        const { source, id_article, type_article, quantite } = req.body;

        let disponible = false;
        let quantite_disponible = 0;
        let message = '';

        if (source === 'stock') {
            const stockResult = await db.query(`
                SELECT quantite_disponible, statut 
                FROM stocks 
                WHERE type_article = ? AND id_article = ? AND statut = 'disponible'
            `, [type_article, id_article]);

            const stock = Array.isArray(stockResult) ? stockResult[0] : stockResult;

            if (stock) {
                quantite_disponible = parseFloat(stock.quantite_disponible || 0);
                const quantiteDemandee = parseFloat(quantite || 0);
                disponible = stock.statut === 'disponible' && quantite_disponible >= quantiteDemandee;
                message = disponible 
                    ? 'Stock suffisant' 
                    : `Stock insuffisant. Disponible: ${quantite_disponible}`;
            } else {
                message = 'Article non trouvé en stock';
            }
        } else if (source === 'animaux') {
            const animalResult = await db.query('SELECT statut FROM animaux WHERE id = ?', [id_article]);
            const animal = Array.isArray(animalResult) ? animalResult[0] : animalResult;
            
            disponible = animal && animal.statut === 'vivant';
            quantite_disponible = disponible ? 1 : 0;
            message = disponible ? 'Animal disponible' : 'Animal non disponible pour la vente';
        } else if (source === 'vehicules') {
            const vehiculeResult = await db.query('SELECT statut, disponible FROM vehicules WHERE id = ?', [id_article]);
            const vehicule = Array.isArray(vehiculeResult) ? vehiculeResult[0] : vehiculeResult;
            
            disponible = vehicule && vehicule.statut === 'actif' && vehicule.disponible === 1;
            quantite_disponible = disponible ? 1 : 0;
            message = disponible ? 'Véhicule disponible' : 'Véhicule non disponible pour la vente';
        } else if (source === 'intrants') {
            const intrantResult = await db.query(`
                SELECT quantite_stock, statut 
                FROM intrants_agricoles 
                WHERE id = ? AND statut = 'actif'
            `, [id_article]);
            
            const intrant = Array.isArray(intrantResult) ? intrantResult[0] : intrantResult;
            
            if (intrant) {
                quantite_disponible = parseFloat(intrant.quantite_stock || 0);
                const quantiteDemandee = parseFloat(quantite || 0);
                disponible = intrant.statut === 'actif' && quantite_disponible >= quantiteDemandee;
                message = disponible 
                    ? 'Stock suffisant' 
                    : `Stock insuffisant. Disponible: ${quantite_disponible}`;
            } else {
                message = 'Intrant non trouvé';
            }
        } else if (source === 'aliments') {
            const alimentResult = await db.query(`
                SELECT quantite_stock, statut 
                FROM aliments_betail 
                WHERE id = ? AND statut = 'actif'
            `, [id_article]);
            
            const aliment = Array.isArray(alimentResult) ? alimentResult[0] : alimentResult;
            
            if (aliment) {
                quantite_disponible = parseFloat(aliment.quantite_stock || 0);
                const quantiteDemandee = parseFloat(quantite || 0);
                disponible = aliment.statut === 'actif' && quantite_disponible >= quantiteDemandee;
                message = disponible 
                    ? 'Stock suffisant' 
                    : `Stock insuffisant. Disponible: ${quantite_disponible}`;
            } else {
                message = 'Aliment non trouvé';
            }
        } else {
            message = 'Source invalide';
        }

        res.status(200).json({
            success: true,
            disponible,
            quantite_disponible,
            message
        });
    } catch (error) {
        console.error('❌ Check stock error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du stock.',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                code: error.code,
                sql: error.sql
            } : undefined
        });
    }
});

module.exports = router;