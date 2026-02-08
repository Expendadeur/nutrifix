const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// Gestion des fournisseurs
router.get('/fournisseurs', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { 
            type, 
            statut,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT f.*,
                   (SELECT COUNT(*) FROM commandes_achat WHERE id_fournisseur = f.id) as nombre_commandes,
                   (SELECT SUM(montant_total) FROM commandes_achat WHERE id_fournisseur = f.id AND statut IN ('facturee', 'payee')) as total_achats
            FROM fournisseurs f
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            sql += ' AND f.type = ?';
            params.push(type);
        }

        if (statut) {
            sql += ' AND f.statut = ?';
            params.push(statut);
        }

        if (search) {
            sql += ` AND (
                f.code_fournisseur LIKE ? OR 
                f.nom_fournisseur LIKE ? OR 
                f.contact_principal LIKE ? OR
                f.telephone LIKE ? OR
                f.email LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY f.nom_fournisseur ASC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const fournisseurs = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM fournisseurs WHERE 1=1`;
        const countParams = [];

        if (type) {
            countSql += ' AND type = ?';
            countParams.push(type);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: fournisseurs,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get fournisseurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des fournisseurs.'
        });
    }
});

// Gestion des clients
router.get('/clients', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { 
            type, 
            niveau_fidelite,
            statut,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT c.*,
                   (SELECT COUNT(*) FROM commandes_vente WHERE id_client = c.id) as nombre_commandes,
                   (SELECT SUM(montant_total) FROM commandes_vente WHERE id_client = c.id AND statut IN ('facturee', 'payee')) as total_achats
            FROM clients c
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            sql += ' AND c.type = ?';
            params.push(type);
        }

        if (niveau_fidelite) {
            sql += ' AND c.niveau_fidelite = ?';
            params.push(niveau_fidelite);
        }

        if (statut) {
            sql += ' AND c.statut = ?';
            params.push(statut);
        }

        if (search) {
            sql += ` AND (
                c.code_client LIKE ? OR 
                c.nom_client LIKE ? OR 
                c.contact_principal LIKE ? OR
                c.telephone LIKE ? OR
                c.email LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY c.nom_client ASC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const clients = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM clients WHERE 1=1`;
        const countParams = [];

        if (type) {
            countSql += ' AND type = ?';
            countParams.push(type);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: clients,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des clients.'
        });
    }
});

// Commandes d'achat
router.get('/commandes-achat', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { 
            id_fournisseur, 
            statut,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT ca.*,
                   f.nom_fournisseur,
                   f.contact_principal as fournisseur_contact,
                   u.nom_complet as createur_nom
            FROM commandes_achat ca
            JOIN fournisseurs f ON ca.id_fournisseur = f.id
            JOIN utilisateurs u ON ca.cree_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (id_fournisseur) {
            sql += ' AND ca.id_fournisseur = ?';
            params.push(id_fournisseur);
        }

        if (statut) {
            sql += ' AND ca.statut = ?';
            params.push(statut);
        }

        if (startDate) {
            sql += ' AND ca.date_commande >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND ca.date_commande <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY ca.date_commande DESC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const commandes = await db.query(sql, params);

        // Get details for each order
        for (let commande of commandes) {
            const detailsSql = `
                SELECT l.*
                FROM lignes_commande_achat l
                WHERE l.id_commande_achat = ?
            `;
            const details = await db.query(detailsSql, [commande.id]);
            commande.lignes = details;
        }

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM commandes_achat WHERE 1=1`;
        const countParams = [];

        if (id_fournisseur) {
            countSql += ' AND id_fournisseur = ?';
            countParams.push(id_fournisseur);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: commandes,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get commandes achat error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes.'
        });
    }
});

// Créer une commande d'achat
router.post('/commandes-achat', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_fournisseur,
            date_livraison_prevue,
            lieu_livraison,
            mode_paiement,
            conditions_paiement,
            lignes
        } = req.body;

        // Validation
        if (!id_fournisseur || !date_livraison_prevue || !lignes || lignes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Informations de commande incomplètes.'
            });
        }

        // Generate order number
        const date = new Date();
        const orderNumber = `CA-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Calculate total amount
        let montant_ht = 0;
        lignes.forEach(ligne => {
            const montantLigne = ligne.quantite_commandee * ligne.prix_unitaire_ht;
            montant_ht += montantLigne;
        });

        // Start transaction
        await db.transaction(async (connection) => {
            // Create purchase order
            const orderSql = `
                INSERT INTO commandes_achat (
                    numero_commande, id_fournisseur, date_commande,
                    date_livraison_prevue, lieu_livraison, mode_paiement,
                    conditions_paiement, montant_ht, tva_pourcent,
                    frais_livraison, remise, cree_par
                ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, 16, 0, 0, ?)
            `;

            const [orderResult] = await connection.execute(orderSql, [
                orderNumber,
                id_fournisseur,
                date_livraison_prevue,
                lieu_livraison,
                mode_paiement,
                conditions_paiement || '30 jours',
                montant_ht,
                req.userId
            ]);

            const orderId = orderResult.insertId;

            // Insert order lines
            for (let ligne of lignes) {
                const ligneSql = `
                    INSERT INTO lignes_commande_achat (
                        id_commande_achat, type_article, id_article,
                        designation, description, quantite_commandee,
                        unite, prix_unitaire_ht, tva_pourcent, date_livraison_prevue
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 16, ?)
                `;

                await connection.execute(ligneSql, [
                    orderId,
                    ligne.type_article,
                    ligne.id_article || null,
                    ligne.designation,
                    ligne.description || '',
                    ligne.quantite_commandee,
                    ligne.unite,
                    ligne.prix_unitaire_ht,
                    date_livraison_prevue
                ]);
            }

            // Update supplier statistics
            await connection.execute(
                `UPDATE fournisseurs 
                 SET nombre_achats = nombre_achats + 1,
                     montant_total_achats = montant_total_achats + ?
                 WHERE id = ?`,
                [montant_ht, id_fournisseur]
            );
        });

        res.status(201).json({
            success: true,
            message: 'Commande d\'achat créée avec succès.',
            numero_commande: orderNumber
        });
    } catch (error) {
        console.error('Create commande achat error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande.'
        });
    }
});

// Commandes de vente
router.get('/commandes-vente', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { 
            id_client, 
            statut,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT cv.*,
                   c.nom_client,
                   c.contact_principal as client_contact,
                   u.nom_complet as createur_nom
            FROM commandes_vente cv
            JOIN clients c ON cv.id_client = c.id
            JOIN utilisateurs u ON cv.cree_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (id_client) {
            sql += ' AND cv.id_client = ?';
            params.push(id_client);
        }

        if (statut) {
            sql += ' AND cv.statut = ?';
            params.push(statut);
        }

        if (startDate) {
            sql += ' AND cv.date_commande >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND cv.date_commande <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY cv.date_commande DESC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const commandes = await db.query(sql, params);

        // Get details for each order
        for (let commande of commandes) {
            const detailsSql = `
                SELECT l.*,
                       s.quantite_disponible as stock_disponible
                FROM lignes_commande_vente l
                LEFT JOIN stocks s ON l.type_produit = s.type_article AND l.id_produit = s.id_article
                WHERE l.id_commande_vente = ?
            `;
            const details = await db.query(detailsSql, [commande.id]);
            commande.lignes = details;
        }

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM commandes_vente WHERE 1=1`;
        const countParams = [];

        if (id_client) {
            countSql += ' AND id_client = ?';
            countParams.push(id_client);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: commandes,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get commandes vente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes.'
        });
    }
});

// Créer une commande de vente
router.post('/commandes-vente', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_client,
            date_livraison_prevue,
            lieu_livraison,
            mode_paiement,
            conditions_paiement,
            lignes
        } = req.body;

        // Validation
        if (!id_client || !date_livraison_prevue || !lignes || lignes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Informations de commande incomplètes.'
            });
        }

        // Check stock availability
        for (let ligne of lignes) {
            if (ligne.type_produit !== 'service') { // Services don't require stock
                const stockSql = `
                    SELECT quantite_disponible, quantite_reservee
                    FROM stocks 
                    WHERE type_article = ? 
                    AND id_article = ?
                `;
                const [stock] = await db.query(stockSql, [ligne.type_produit, ligne.id_produit]);
                
                if (!stock || stock.quantite_disponible - stock.quantite_reservee < ligne.quantite_commandee) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuffisant pour ${ligne.designation}. Disponible: ${stock ? stock.quantite_disponible - stock.quantite_reservee : 0}`
                    });
                }
            }
        }

        // Generate order number
        const date = new Date();
        const orderNumber = `CV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Calculate total amount
        let montant_ht = 0;
        lignes.forEach(ligne => {
            const montantLigne = ligne.quantite_commandee * ligne.prix_unitaire_ht;
            montant_ht += montantLigne;
        });

        // Start transaction
        await db.transaction(async (connection) => {
            // Create sales order
            const orderSql = `
                INSERT INTO commandes_vente (
                    numero_commande, id_client, date_commande,
                    date_livraison_prevue, lieu_livraison, mode_paiement,
                    conditions_paiement, montant_ht, tva_pourcent,
                    frais_livraison, remise, cree_par
                ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, 16, 0, 0, ?)
            `;

            const [orderResult] = await connection.execute(orderSql, [
                orderNumber,
                id_client,
                date_livraison_prevue,
                lieu_livraison,
                mode_paiement,
                conditions_paiement || '30 jours',
                montant_ht,
                req.userId
            ]);

            const orderId = orderResult.insertId;

            // Insert order lines and reserve stock
            for (let ligne of lignes) {
                const ligneSql = `
                    INSERT INTO lignes_commande_vente (
                        id_commande_vente, type_produit, id_produit,
                        designation, description, quantite_commandee,
                        unite, prix_unitaire_ht, tva_pourcent, date_livraison_prevue
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 16, ?)
                `;

                await connection.execute(ligneSql, [
                    orderId,
                    ligne.type_produit,
                    ligne.id_produit || null,
                    ligne.designation,
                    ligne.description || '',
                    ligne.quantite_commandee,
                    ligne.unite,
                    ligne.prix_unitaire_ht,
                    date_livraison_prevue
                ]);

                // Reserve stock if applicable
                if (ligne.type_produit !== 'service' && ligne.id_produit) {
                    await connection.execute(
                        `UPDATE stocks 
                         SET quantite_reservee = quantite_reservee + ?
                         WHERE type_article = ? 
                         AND id_article = ?`,
                        [ligne.quantite_commandee, ligne.type_produit, ligne.id_produit]
                    );
                }
            }

            // Update client statistics
            await connection.execute(
                `UPDATE clients 
                 SET nombre_achats = nombre_achats + 1,
                     montant_total_achats = montant_total_achats + ?,
                     dernier_achat = CURDATE(),
                     premier_achat = COALESCE(premier_achat, CURDATE())
                 WHERE id = ?`,
                [montant_ht, id_client]
            );

            // Update client loyalty level
            await connection.execute(
                `UPDATE clients 
                 SET niveau_fidelite = CASE
                     WHEN nombre_achats >= 50 THEN 'vip'
                     WHEN nombre_achats >= 20 THEN 'fidele'
                     WHEN nombre_achats >= 10 THEN 'regulier'
                     WHEN nombre_achats >= 1 THEN 'occasionnel'
                     ELSE 'nouveau'
                 END
                 WHERE id = ?`,
                [id_client]
            );
        });

        res.status(201).json({
            success: true,
            message: 'Commande de vente créée avec succès.',
            numero_commande: orderNumber
        });
    } catch (error) {
        console.error('Create commande vente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande.'
        });
    }
});

// Livrer une commande
router.post('/commandes/:id/livrer', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const commandeId = parseInt(req.params.id);
        const { lignes_livrees } = req.body;

        // Get order
        const orderSql = `SELECT * FROM commandes_vente WHERE id = ?`;
        const [order] = await db.query(orderSql, [commandeId]);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée.'
            });
        }

        if (order.statut === 'livree_complete') {
            return res.status(400).json({
                success: false,
                message: 'Commande déjà livrée complètement.'
            });
        }

        // Start transaction
        await db.transaction(async (connection) => {
            // Update delivery quantities
            let allDelivered = true;
            let totalDelivered = 0;

            for (let ligne of lignes_livrees) {
                const updateSql = `
                    UPDATE lignes_commande_vente 
                    SET quantite_livree = quantite_livree + ?,
                        statut_livraison = CASE
                            WHEN quantite_livree + ? >= quantite_commandee THEN 'complete'
                            ELSE 'partielle'
                        END
                    WHERE id = ? AND id_commande_vente = ?
                `;

                await connection.execute(updateSql, [
                    ligne.quantite_livree,
                    ligne.quantite_livree,
                    ligne.id,
                    commandeId
                ]);

                // Update stock
                if (ligne.quantite_livree > 0) {
                    const lineSql = `SELECT type_produit, id_produit FROM lignes_commande_vente WHERE id = ?`;
                    const [line] = await connection.execute(lineSql, [ligne.id]);

                    if (line[0].type_produit !== 'service' && line[0].id_produit) {
                        // Remove from reserved stock and decrease available stock
                        await connection.execute(
                            `UPDATE stocks 
                             SET quantite_reservee = quantite_reservee - ?,
                                 quantite_disponible = quantite_disponible - ?
                             WHERE type_article = ? 
                             AND id_article = ?`,
                            [ligne.quantite_livree, ligne.quantite_livree, line[0].type_produit, line[0].id_produit]
                        );
                    }
                }

                // Record stock movement
                if (ligne.quantite_livree > 0 && ligne.type_produit !== 'service') {
                    const stockSql = `SELECT id FROM stocks WHERE type_article = ? AND id_article = ?`;
                    const [stock] = await connection.execute(stockSql, [ligne.type_produit, ligne.id_produit]);

                    if (stock && stock.length > 0) {
                        await connection.execute(
                            `INSERT INTO mouvements_stock (
                                id_stock, type_mouvement, quantite,
                                unite_mesure, raison, commentaire,
                                type_reference, id_reference, effectue_par, date_mouvement
                            ) VALUES (?, 'sortie', ?, ?, 'vente', ?, 'commande_vente', ?, ?, CURDATE())`,
                            [
                                stock[0].id,
                                ligne.quantite_livree,
                                ligne.unite || 'unite',
                                `Livraison commande ${order.numero_commande}`,
                                commandeId,
                                req.userId
                            ]
                        );
                    }
                }

                // Check if line is completely delivered
                const lineStatusSql = `SELECT statut_livraison FROM lignes_commande_vente WHERE id = ?`;
                const [lineStatus] = await connection.execute(lineStatusSql, [ligne.id]);
                
                if (lineStatus[0].statut_livraison !== 'complete') {
                    allDelivered = false;
                }

                totalDelivered += ligne.quantite_livree;
            }

            // Update order status
            const newStatus = allDelivered ? 'livree_complete' : 'livree_partielle';
            
            await connection.execute(
                `UPDATE commandes_vente 
                 SET statut = ?,
                     date_livraison_reelle = CURDATE()
                 WHERE id = ?`,
                [newStatus, commandeId]
            );

            // Create notification for client (if applicable)
            if (allDelivered) {
                const notificationSql = `
                    INSERT INTO notifications (
                        id_utilisateur, type_notification, titre, message,
                        priorite, type_reference, id_reference
                    ) VALUES (?, 'paiement', 'Commande livrée',
                    CONCAT('Votre commande ', ?, ' a été livrée complètement. Montant à payer: ', ?),
                    'normale', 'commande_vente', ?)
                `;

                await connection.execute(notificationSql, [
                    order.cree_par, // This should be the client's user ID in a real system
                    order.numero_commande,
                    order.montant_total,
                    commandeId
                ]);
            }
        });

        res.status(200).json({
            success: true,
            message: 'Livraison enregistrée avec succès.'
        });
    } catch (error) {
        console.error('Livrer commande error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la livraison.'
        });
    }
});

// Statistiques commerciales
router.get('/statistiques', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'month' } = req.query;

        // Sales statistics
        let salesSql = `
            SELECT 
                COUNT(*) as nombre_commandes,
                SUM(montant_total) as chiffre_affaires,
                AVG(montant_total) as moyenne_commande,
                SUM(CASE WHEN statut = 'payee' THEN montant_total ELSE 0 END) as total_paye,
                COUNT(DISTINCT id_client) as clients_actifs
            FROM commandes_vente
            WHERE date_commande >= ? AND date_commande <= ?
        `;

        const [salesStats] = await db.query(salesSql, [
            startDate || '2024-01-01',
            endDate || '2024-12-31'
        ]);

        // Purchase statistics
        let purchaseSql = `
            SELECT 
                COUNT(*) as nombre_commandes_achat,
                SUM(montant_total) as total_achats,
                AVG(montant_total) as moyenne_achat,
                COUNT(DISTINCT id_fournisseur) as fournisseurs_actifs
            FROM commandes_achat
            WHERE date_commande >= ? AND date_commande <= ?
        `;

        const [purchaseStats] = await db.query(purchaseSql, [
            startDate || '2024-01-01',
            endDate || '2024-12-31'
        ]);

        // Sales by product type
        const productSql = `
            SELECT 
                l.type_produit,
                COUNT(*) as nombre_lignes,
                SUM(l.quantite_commandee) as quantite_totale,
                SUM(l.montant_ttc) as montant_total
            FROM lignes_commande_vente l
            JOIN commandes_vente cv ON l.id_commande_vente = cv.id
            WHERE cv.date_commande >= ? AND cv.date_commande <= ?
            GROUP BY l.type_produit
            ORDER BY montant_total DESC
        `;

        const productStats = await db.query(productSql, [
            startDate || '2024-01-01',
            endDate || '2024-12-31'
        ]);

        // Top clients
        const topClientsSql = `
            SELECT 
                c.nom_client,
                COUNT(cv.id) as nombre_commandes,
                SUM(cv.montant_total) as total_achats,
                c.niveau_fidelite
            FROM clients c
            JOIN commandes_vente cv ON c.id = cv.id_client
            WHERE cv.date_commande >= ? AND cv.date_commande <= ?
            GROUP BY c.id, c.nom_client, c.niveau_fidelite
            ORDER BY total_achats DESC
            LIMIT 10
        `;

        const topClients = await db.query(topClientsSql, [
            startDate || '2024-01-01',
            endDate || '2024-12-31'
        ]);

        // Sales trend by period
        let trendSql;
        if (groupBy === 'day') {
            trendSql = `
                SELECT 
                    DATE(date_commande) as periode,
                    COUNT(*) as nombre_commandes,
                    SUM(montant_total) as chiffre_affaires
                FROM commandes_vente
                WHERE date_commande >= ? AND date_commande <= ?
                GROUP BY DATE(date_commande)
                ORDER BY DATE(date_commande)
            `;
        } else if (groupBy === 'week') {
            trendSql = `
                SELECT 
                    YEARWEEK(date_commande) as periode,
                    COUNT(*) as nombre_commandes,
                    SUM(montant_total) as chiffre_affaires
                FROM commandes_vente
                WHERE date_commande >= ? AND date_commande <= ?
                GROUP BY YEARWEEK(date_commande)
                ORDER BY YEARWEEK(date_commande)
            `;
        } else { // month
            trendSql = `
                SELECT 
                    DATE_FORMAT(date_commande, '%Y-%m') as periode,
                    COUNT(*) as nombre_commandes,
                    SUM(montant_total) as chiffre_affaires
                FROM commandes_vente
                WHERE date_commande >= ? AND date_commande <= ?
                GROUP BY DATE_FORMAT(date_commande, '%Y-%m')
                ORDER BY DATE_FORMAT(date_commande, '%Y-%m')
            `;
        }

        const trendStats = await db.query(trendSql, [
            startDate || '2024-01-01',
            endDate || '2024-12-31'
        ]);

        res.status(200).json({
            success: true,
            data: {
                ventes: salesStats,
                achats: purchaseStats,
                produits: productStats,
                meilleurs_clients: topClients,
                tendances: trendStats
            }
        });
    } catch (error) {
        console.error('Get commercial stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

module.exports = router;