// backend/routes/commercialRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// ============================================
// CLIENTS - GESTION COMPLÈTE
// ============================================
router.get('/clients', authenticate, authorize('admin', 'manager', 'employe', 'comptable'), async (req, res) => {
    try {
        const { type, statut, niveau_fidelite, search, limit = 50, offset = 0 } = req.query;

        // Conversion et validation des paramètres de pagination
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        // Validation
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 1000)'
            });
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset invalide'
            });
        }

        let sql = `
            SELECT 
                c.*,
                COUNT(DISTINCT cv.id) as nombre_commandes,
                COALESCE(SUM(CASE WHEN cv.statut IN ('livree_complete', 'payee') 
                    THEN cv.montant_total ELSE 0 END), 0) as total_achats,
                COALESCE(MAX(cv.date_commande), NULL) as derniere_commande,
                COALESCE(SUM(CASE WHEN cv.statut NOT IN ('livree_complete', 'payee', 'annulee') 
                    THEN cv.montant_total ELSE 0 END), 0) as total_encours,
                COALESCE(SUM(CASE WHEN f.statut_paiement IN ('impayee', 'partiellement_payee') 
                    THEN f.montant_du ELSE 0 END), 0) as dette_actuelle
            FROM clients c
            LEFT JOIN commandes_vente cv ON cv.id_client = c.id
            LEFT JOIN factures f ON f.id_client = c.id
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            sql += ' AND c.type = ?';
            params.push(type);
        }

        if (statut) {
            sql += ' AND c.statut = ?';
            params.push(statut);
        }

        if (niveau_fidelite) {
            sql += ' AND c.niveau_fidelite = ?';
            params.push(niveau_fidelite);
        }

        if (search) {
            sql += ` AND (c.nom_client LIKE ? OR c.contact_principal LIKE ? 
                     OR c.telephone LIKE ? OR c.email LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ` GROUP BY c.id ORDER BY c.nom_client LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const clientsResult = await db.query(sql, params);
        const clients = Array.isArray(clientsResult) ? clientsResult : [];

        // Compter le total
        let countSql = 'SELECT COUNT(*) as total FROM clients WHERE 1=1';
        const countParams = [];

        if (type) {
            countSql += ' AND type = ?';
            countParams.push(type);
        }
        if (statut) {
            countSql += ' AND statut = ?';
            countParams.push(statut);
        }
        if (niveau_fidelite) {
            countSql += ' AND niveau_fidelite = ?';
            countParams.push(niveau_fidelite);
        }

        const countResult = await db.query(countSql, countParams);
        const total = Array.isArray(countResult) ? (countResult[0]?.total || 0) : 0;

        res.status(200).json({
            success: true,
            data: clients,
            pagination: {
                total: parseInt(total),
                limit: limitNum,
                offset: offsetNum,
                pages: Math.ceil(parseInt(total) / limitNum)
            }
        });
    } catch (error) {
        console.error('❌ Get clients error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des clients.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/clients/:id', authenticate, authorize('admin', 'manager', 'employe', 'comptable'), async (req, res) => {
    try {
        const { id } = req.params;

        const clientResult = await db.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT cv.id) as nombre_commandes,
                COALESCE(SUM(CASE WHEN cv.statut IN ('livree_complete', 'payee') 
                    THEN cv.montant_total ELSE 0 END), 0) as total_achats,
                COALESCE(SUM(CASE WHEN cv.statut NOT IN ('livree_complete', 'payee', 'annulee') 
                    THEN cv.montant_total ELSE 0 END), 0) as total_encours,
                COALESCE(AVG(cv.montant_total), 0) as moyenne_commande,
                COALESCE(MAX(cv.date_commande), NULL) as derniere_commande
            FROM clients c
            LEFT JOIN commandes_vente cv ON cv.id_client = c.id
            WHERE c.id = ?
            GROUP BY c.id
        `, [id]);

        const client = Array.isArray(clientResult) ? clientResult[0] : null;

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client non trouvé.'
            });
        }

        // Récupérer les dernières commandes
        const commandesResult = await db.query(`
            SELECT id, numero_commande, date_commande, montant_total, statut
            FROM commandes_vente
            WHERE id_client = ?
            ORDER BY date_commande DESC
            LIMIT 10
        `, [id]);
        const commandes = Array.isArray(commandesResult) ? commandesResult : [];

        // Récupérer les factures impayées
        const facturesResult = await db.query(`
            SELECT id, numero_facture, date_facture, date_echeance, montant_ttc, montant_du, statut_paiement
            FROM factures
            WHERE id_client = ? AND statut_paiement IN ('impayee', 'partiellement_payee')
            ORDER BY date_echeance ASC
        `, [id]);
        const facturesImpayees = Array.isArray(facturesResult) ? facturesResult : [];

        res.status(200).json({
            success: true,
            data: {
                ...client,
                dernieres_commandes: commandes,
                factures_impayees: facturesImpayees
            }
        });
    } catch (error) {
        console.error('❌ Get client error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du client.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/clients', authenticate, authorize('admin', 'manager', 'employe'), async (req, res) => {
    try {
        const {
            nom_client, type, contact_principal, telephone, email, adresse, ville, pays,
            secteur_activite, numero_tva, nif, cni, photo_profil, banque, numero_compte, limite_credit,
            delai_paiement_jours, niveau_fidelite, statut
        } = req.body;

        // Validation
        if (!nom_client || !telephone) {
            return res.status(400).json({
                success: false,
                message: 'Nom du client et téléphone sont requis.'
            });
        }

        // Générer code client unique
        const lastClientResult = await db.query(
            'SELECT code_client FROM clients ORDER BY id DESC LIMIT 1'
        );
        const lastClient = Array.isArray(lastClientResult) ? lastClientResult[0] : null;
        const lastCode = lastClient ? parseInt(lastClient.code_client.replace('CLI-', '')) : 0;
        const code_client = `CLI-${String(lastCode + 1).padStart(6, '0')}`;

        const sql = `
            INSERT INTO clients (
                code_client, nom_client, type, contact_principal, telephone, email,
                adresse, ville, pays, secteur_activite, numero_tva, nif, cni, photo_profil, 
                banque, numero_compte, limite_credit, delai_paiement_jours, 
                niveau_fidelite, statut, premier_achat
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const result = await db.query(sql, [
            code_client, nom_client, type || 'particulier', contact_principal,
            telephone, email, adresse, ville, pays || 'Burundi', secteur_activite,
            numero_tva, nif, cni, photo_profil, banque, numero_compte,
            limite_credit || 0, delai_paiement_jours || 30,
            niveau_fidelite || 'nouveau', statut || 'actif'
        ]);

        const insertId = Array.isArray(result) ? (result[0]?.insertId || result.insertId) : result.insertId;

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, ip_address
            ) VALUES (?, 'commercial', 'creation_client', ?, 'clients', ?, ?)
        `, [
            req.user?.id || req.userId,
            `Nouveau client créé: ${nom_client} (${code_client})`,
            insertId,
            req.ip
        ]);

        res.status(201).json({
            success: true,
            message: 'Client créé avec succès.',
            data: { id: insertId, code_client }
        });
    } catch (error) {
        console.error('❌ Create client error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du client.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.put('/clients/:id', authenticate, authorize('admin', 'manager', 'employe'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom_client, type, contact_principal, telephone, email, adresse, ville, pays,
            secteur_activite, numero_tva, nif, cni, photo_profil, banque,
            numero_compte, limite_credit, delai_paiement_jours, niveau_fidelite, statut
        } = req.body;

        // Récupérer les anciennes données
        const oldDataResult = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
        const oldData = Array.isArray(oldDataResult) ? oldDataResult[0] : null;

        if (!oldData) {
            return res.status(404).json({
                success: false,
                message: 'Client non trouvé.'
            });
        }

        const sql = `
            UPDATE clients SET
                nom_client = ?, type = ?, contact_principal = ?, telephone = ?,
                email = ?, adresse = ?, ville = ?, pays = ?, secteur_activite = ?,
                numero_tva = ?, nif = ?, cni = ?, photo_profil = ?, banque = ?, 
                numero_compte = ?, limite_credit = ?, delai_paiement_jours = ?, 
                niveau_fidelite = ?, statut = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            nom_client, type, contact_principal, telephone, email, adresse, ville, pays,
            secteur_activite, numero_tva, nif, cni, photo_profil, banque,
            numero_compte, limite_credit, delai_paiement_jours, niveau_fidelite, statut, id
        ]);

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, donnees_avant, donnees_apres
            ) VALUES (?, 'commercial', 'modification_client', ?, 'clients', ?, ?, ?)
        `, [
            req.user?.id || req.userId,
            `Client modifié: ${nom_client}`,
            id,
            JSON.stringify(oldData),
            JSON.stringify(req.body)
        ]);

        res.status(200).json({
            success: true,
            message: 'Client modifié avec succès.'
        });
    } catch (error) {
        console.error('❌ Update client error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du client.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.delete('/clients/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des commandes
        const commandesCountResult = await db.query(
            'SELECT COUNT(*) as count FROM commandes_vente WHERE id_client = ?',
            [id]
        );
        const commandesCount = Array.isArray(commandesCountResult) ? commandesCountResult[0] : commandesCountResult;

        if (commandesCount?.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer un client avec des commandes associées.'
            });
        }

        await db.query('DELETE FROM clients WHERE id = ?', [id]);

        res.status(200).json({
            success: true,
            message: 'Client supprimé avec succès.'
        });
    } catch (error) {
        console.error('❌ Delete client error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du client.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// FOURNISSEURS - GESTION COMPLÈTE
// ============================================
router.get('/fournisseurs', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { type, statut, search, limit = 100, offset = 0 } = req.query;

        // Conversion et validation
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 1000)'
            });
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset invalide'
            });
        }

        let sql = `
            SELECT 
                f.*,
                COUNT(DISTINCT ca.id) as nombre_commandes,
                COALESCE(SUM(CASE WHEN ca.statut IN ('livree_complete', 'payee') 
                    THEN ca.montant_total ELSE 0 END), 0) as total_achats,
                COALESCE(SUM(CASE WHEN ca.statut NOT IN ('livree_complete', 'payee', 'annulee') 
                    THEN ca.montant_total ELSE 0 END), 0) as total_encours
            FROM fournisseurs f
            LEFT JOIN commandes_achat ca ON ca.id_fournisseur = f.id
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
            sql += ` AND (f.nom_fournisseur LIKE ? OR f.contact_principal LIKE ? 
                     OR f.telephone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ` GROUP BY f.id ORDER BY f.nom_fournisseur LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const fournisseursResult = await db.query(sql, params);
        const fournisseurs = Array.isArray(fournisseursResult) ? fournisseursResult : [];

        res.status(200).json({
            success: true,
            data: fournisseurs
        });
    } catch (error) {
        console.error('❌ Get fournisseurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des fournisseurs.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/fournisseurs', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            nom_fournisseur, type, contact_principal, telephone, email, adresse,
            ville, pays, numero_registre, numero_tva, nif, cni, photo_profil,
            banque, numero_compte, conditions_paiement, statut
        } = req.body;

        if (!nom_fournisseur || !telephone) {
            return res.status(400).json({
                success: false,
                message: 'Nom et téléphone requis.'
            });
        }

        // Générer code fournisseur
        const lastFournisseurResult = await db.query(
            'SELECT code_fournisseur FROM fournisseurs ORDER BY id DESC LIMIT 1'
        );
        const lastFournisseur = Array.isArray(lastFournisseurResult) ? lastFournisseurResult[0] : null;
        const lastCode = lastFournisseur ? parseInt(lastFournisseur.code_fournisseur.replace('FRS-', '')) : 0;
        const code_fournisseur = `FRS-${String(lastCode + 1).padStart(6, '0')}`;

        const sql = `
            INSERT INTO fournisseurs (
                code_fournisseur, nom_fournisseur, type, contact_principal, telephone,
                email, adresse, ville, pays, numero_registre, numero_tva, 
                nif, cni, photo_profil, banque, numero_compte, conditions_paiement, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            code_fournisseur, nom_fournisseur, type || 'general', contact_principal,
            telephone, email, adresse, ville, pays || 'Burundi', numero_registre,
            numero_tva, nif, cni, photo_profil, banque, numero_compte,
            conditions_paiement || '30 jours', statut || 'actif'
        ]);

        const insertId = Array.isArray(result) ? (result[0]?.insertId || result.insertId) : result.insertId;

        // Traçabilité
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement
            ) VALUES (?, 'commercial', 'creation_fournisseur', ?, 'fournisseurs', ?)
        `, [req.user?.id || req.userId, `Nouveau fournisseur: ${nom_fournisseur}`, insertId]);

        res.status(201).json({
            success: true,
            message: 'Fournisseur créé avec succès.',
            data: { id: insertId, code_fournisseur }
        });
    } catch (error) {
        console.error('❌ Create fournisseur error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du fournisseur.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.put('/fournisseurs/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom_fournisseur, type, contact_principal, telephone, email, adresse,
            ville, pays, numero_registre, numero_tva, nif, cni, photo_profil,
            banque, numero_compte, conditions_paiement, note_evaluation, statut
        } = req.body;

        const sql = `
            UPDATE fournisseurs SET
                nom_fournisseur = ?, type = ?, contact_principal = ?, telephone = ?,
                email = ?, adresse = ?, ville = ?, pays = ?, numero_registre = ?,
                numero_tva = ?, nif = ?, cni = ?, photo_profil = ?, banque = ?, 
                numero_compte = ?, conditions_paiement = ?, note_evaluation = ?, statut = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            nom_fournisseur, type, contact_principal, telephone, email, adresse,
            ville, pays, numero_registre, numero_tva, nif, cni, photo_profil,
            banque, numero_compte, conditions_paiement, note_evaluation, statut, id
        ]);

        res.status(200).json({
            success: true,
            message: 'Fournisseur modifié avec succès.'
        });
    } catch (error) {
        console.error('❌ Update fournisseur error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du fournisseur.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// COMMANDES VENTE - GESTION COMPLÈTE
// ============================================
router.get('/commandes-vente', authenticate, authorize('admin', 'manager', 'employe', 'comptable'), async (req, res) => {
    try {
        const { statut, id_client, startDate, endDate, limit = 50, offset = 0 } = req.query;

        // Conversion et validation des paramètres de pagination
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        // Validation
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 1000)'
            });
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset invalide'
            });
        }

        let sql = `
            SELECT 
                cv.*,
                cv.statut as statut,
                c.nom_client,
                c.telephone as client_telephone,
                u.nom_complet as cree_par_nom,
                (SELECT id FROM factures WHERE id_commande = cv.id LIMIT 1) as id_facture,
                (SELECT COUNT(*) FROM lignes_commande_vente WHERE id_commande_vente = cv.id) as nombre_lignes
            FROM commandes_vente cv
            JOIN clients c ON cv.id_client = c.id
            LEFT JOIN utilisateurs u ON cv.cree_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (statut) {
            sql += ' AND cv.statut = ?';
            params.push(statut);
        }

        if (id_client) {
            sql += ' AND cv.id_client = ?';
            params.push(parseInt(id_client, 10));
        }

        if (startDate) {
            sql += ' AND cv.date_commande >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND cv.date_commande <= ?';
            params.push(endDate);
        }

        sql += ` ORDER BY cv.date_commande DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const commandesResult = await db.query(sql, params);
        const commandes = Array.isArray(commandesResult) ? commandesResult : [];

        res.status(200).json({
            success: true,
            data: commandes
        });
    } catch (error) {
        console.error('❌ Get commandes vente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/commandes-vente/:id', authenticate, authorize('admin', 'manager', 'employe', 'comptable'), async (req, res) => {
    try {
        const { id } = req.params;

        const commandeResult = await db.query(`
            SELECT 
                cv.*,
                c.nom_client,
                c.telephone as client_telephone,
                c.adresse as client_adresse,
                u.nom_complet as cree_par_nom
            FROM commandes_vente cv
            JOIN clients c ON cv.id_client = c.id
            LEFT JOIN utilisateurs u ON cv.cree_par = u.id
            WHERE cv.id = ?
        `, [id]);

        const commande = Array.isArray(commandeResult) ? commandeResult[0] : null;

        if (!commande) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée.'
            });
        }

        // Récupérer les lignes de commande
        const lignesResult = await db.query(`
            SELECT * FROM lignes_commande_vente
            WHERE id_commande_vente = ?
            ORDER BY id
        `, [id]);
        const lignes = Array.isArray(lignesResult) ? lignesResult : [];

        res.status(200).json({
            success: true,
            data: {
                ...commande,
                lignes
            }
        });
    } catch (error) {
        console.error('❌ Get commande vente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la commande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/commandes-vente', authenticate, authorize('admin', 'manager', 'employe'), async (req, res) => {
    let connection;

    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        const {
            id_client, date_commande, date_livraison_prevue, lieu_livraison,
            mode_paiement, conditions_paiement, tva_pourcent, frais_livraison,
            remise, observations_livraison, lignes
        } = req.body;

        // Validation
        if (!id_client || !lignes || lignes.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Client et produits requis.'
            });
        }

        // NOUVEAU : Vérifier les stocks avant de créer la commande
        for (const ligne of lignes) {
            if (ligne.article_source === 'stock') {
                const stockResult = await connection.query(`
                    SELECT quantite_disponible 
                    FROM stocks 
                    WHERE type_article = ? AND id_article = ?
                `, [ligne.type_article, ligne.id_article]);

                const stock = Array.isArray(stockResult) ? stockResult[0] : stockResult;

                if (!stock || stock.quantite_disponible < parseFloat(ligne.quantite_commandee)) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuffisant pour: ${ligne.designation}`
                    });
                }
            }
        }

        // Générer numéro de commande
        const lastCommandeResult = await connection.query(
            'SELECT numero_commande FROM commandes_vente ORDER BY id DESC LIMIT 1'
        );
        const lastCommande = Array.isArray(lastCommandeResult) ? lastCommandeResult[0] : null;
        const lastNum = lastCommande && lastCommande.numero_commande
            ? parseInt(lastCommande.numero_commande.split('-')[1])
            : 0;
        const numero_commande = `CV-${String(lastNum + 1).padStart(6, '0')}`;

        // Calculer montants
        let montant_ht = 0;
        for (const ligne of lignes) {
            const montant_ligne = ligne.quantite_commandee * ligne.prix_unitaire_ht *
                (1 - (ligne.remise_pourcent || 0) / 100);
            montant_ht += montant_ligne;
        }

        const montant_tva = montant_ht * (parseFloat(tva_pourcent) || 0) / 100;
        const montant_ttc = montant_ht + montant_tva;
        const montant_total = montant_ttc + (parseFloat(frais_livraison) || 0) - (parseFloat(remise) || 0);

        // Insérer commande
        const commandeResult = await connection.query(`
            INSERT INTO commandes_vente (
                numero_commande, id_client, date_commande, date_livraison_prevue,
                lieu_livraison, mode_paiement, conditions_paiement, montant_ht,
                tva_pourcent, montant_tva, montant_ttc, frais_livraison, remise,
                montant_total, observations_livraison, statut, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', ?)
        `, [
            numero_commande, id_client, date_commande || new Date(),
            date_livraison_prevue, lieu_livraison, mode_paiement || 'especes',
            conditions_paiement, montant_ht, tva_pourcent || 0, montant_tva,
            montant_ttc, frais_livraison || 0, remise || 0, montant_total,
            observations_livraison, req.user?.id || req.userId
        ]);

        const commandeId = Array.isArray(commandeResult) ?
            (commandeResult[0]?.insertId || commandeResult.insertId) : commandeResult.insertId;

        // Insérer lignes ET réserver le stock
        for (const ligne of lignes) {
            const montant_ligne_ht = ligne.quantite_commandee * ligne.prix_unitaire_ht *
                (1 - (ligne.remise_pourcent || 0) / 100);
            const montant_ligne_tva = montant_ligne_ht * (ligne.tva_pourcent || 0) / 100;
            const montant_ligne_ttc = montant_ligne_ht + montant_ligne_tva;

            await connection.query(`
                INSERT INTO lignes_commande_vente (
                    id_commande_vente, type_produit, id_produit, designation,
                    description, quantite_commandee, unite, prix_unitaire_ht,
                    remise_pourcent, tva_pourcent, montant_ht, montant_tva, montant_ttc
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                commandeId, ligne.type_produit, ligne.id_produit, ligne.designation,
                ligne.description, ligne.quantite_commandee, ligne.unite,
                ligne.prix_unitaire_ht, ligne.remise_pourcent || 0,
                ligne.tva_pourcent || 0, montant_ligne_ht, montant_ligne_tva,
                montant_ligne_ttc
            ]);

            // NOUVEAU : Réserver le stock si c'est un article en stock
            if (ligne.article_source === 'stock') {
                await connection.query(`
                    UPDATE stocks 
                    SET quantite_reservee = quantite_reservee + ?
                    WHERE type_article = ? AND id_article = ?
                `, [ligne.quantite_commandee, ligne.type_article, ligne.id_article]);
            }
        }

        // Traçabilité
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement
            ) VALUES (?, 'commercial', 'creation_commande_vente', ?, 'commandes_vente', ?)
        `, [req.user?.id || req.userId, `Commande créée: ${numero_commande}`, commandeId]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Commande créée avec succès.',
            data: {
                id: commandeId,
                numero_commande,
                montant_total
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Create commande vente error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// À ajouter dans commercialRoutes.js
router.put('/commandes-vente/:id/annuler', authenticate, authorize('admin', 'manager'), async (req, res) => {
    let connection;

    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        const { id } = req.params;

        // Récupérer les lignes de commande
        const lignesResult = await connection.query(`
            SELECT lcv.*, cv.statut 
            FROM lignes_commande_vente lcv
            JOIN commandes_vente cv ON lcv.id_commande_vente = cv.id
            WHERE lcv.id_commande_vente = ?
        `, [id]);

        const lignes = Array.isArray(lignesResult) ? lignesResult : [];

        if (lignes.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée.'
            });
        }

        // Libérer les stocks réservés
        for (const ligne of lignes) {
            await connection.query(`
                UPDATE stocks 
                SET quantite_reservee = GREATEST(0, quantite_reservee - ?)
                WHERE type_article = ? AND id_article = ?
            `, [ligne.quantite_commandee, ligne.type_produit, ligne.id_produit]);
        }

        // Marquer la commande comme annulée
        await connection.query(`
            UPDATE commandes_vente 
            SET statut = 'annulee'
            WHERE id = ?
        `, [id]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Commande annulée et stocks libérés.'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Cancel commande error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'annulation de la commande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/commandes-vente/:id/statut', authenticate, authorize('admin', 'manager'), async (req, res) => {
    let connection;

    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        const { id } = req.params;
        const { statut } = req.body;

        const statutsValides = ['brouillon', 'confirmee', 'en_preparation', 'livree_partielle',
            'livree_complete', 'facturee', 'payee', 'annulee'];

        if (!statutsValides.includes(statut)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Statut invalide.'
            });
        }

        // Récupérer la commande et ses lignes
        const [commandeRows] = await connection.query('SELECT * FROM commandes_vente WHERE id = ?', [id]);
        const commande = commandeRows[0];

        if (!commande) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée.'
            });
        }

        const [lignes] = await connection.query(
            'SELECT * FROM lignes_commande_vente WHERE id_commande_vente = ?',
            [id]
        );

        // NOUVEAU : Si livraison complète, déduire du stock
        if (statut === 'livree_complete' && commande.statut !== 'livree_complete') {
            for (const ligne of lignes) {
                // Déduire du stock disponible
                await connection.query(`
                    UPDATE stocks 
                    SET 
                        quantite_disponible = GREATEST(0, quantite_disponible - ?),
                        quantite_reservee = GREATEST(0, quantite_reservee - ?)
                    WHERE type_article = ? AND id_article = ?
                `, [
                    ligne.quantite_commandee,
                    ligne.quantite_commandee,
                    ligne.type_produit,
                    ligne.id_produit
                ]);

                // Créer un mouvement de stock
                await connection.query(`
                    INSERT INTO mouvements_stock (
                        id_stock, type_mouvement, quantite, unite_mesure,
                        type_reference, id_reference, raison, commentaire,
                        effectue_par, date_mouvement
                    )
                    SELECT 
                        s.id, 'sortie', ?, ?, 'commande_vente', ?, 'vente',
                        CONCAT('Vente - Commande ', ?),
                        ?, CURDATE()
                    FROM stocks s
                    WHERE s.type_article = ? AND s.id_article = ?
                    LIMIT 1
                `, [
                    ligne.quantite_commandee,
                    ligne.unite,
                    id,
                    commande.numero_commande,
                    req.user?.id || req.userId,
                    ligne.type_produit,
                    ligne.id_produit
                ]);
            }
        }

        // NOUVEAU : Si annulation
        if (statut === 'annulee' && commande.statut !== 'annulee') {
            // 1. Restaurer les stocks
            for (const ligne of lignes) {
                if (commande.statut === 'livree_complete') {
                    // Si déjà livré, on remet dans le stock disponible
                    await connection.query(`
                        UPDATE stocks SET quantite_disponible = quantite_disponible + ?
                        WHERE type_article = ? AND id_article = ?
                    `, [ligne.quantite_commandee, ligne.type_produit, ligne.id_produit]);

                    // Mouvement de stock de retour
                    await connection.query(`
                        INSERT INTO mouvements_stock (
                            id_stock, type_mouvement, quantite, unite_mesure,
                            type_reference, id_reference, raison, commentaire,
                            effectue_par, date_mouvement
                        )
                        SELECT s.id, 'entree', ?, ?, 'commande_vente', ?, 'annulation',
                        CONCAT('Annulation - Commande ', ?), ?, CURDATE()
                        FROM stocks s WHERE s.type_article = ? AND s.id_article = ? LIMIT 1
                    `, [ligne.quantite_commandee, ligne.unite, id, commande.numero_commande, req.user?.id || req.userId, ligne.type_produit, ligne.id_produit]);
                } else if (['confirmee', 'en_preparation', 'livree_partielle'].includes(commande.statut)) {
                    // Si seulement réservé, on libère la réservation
                    await connection.query(`
                        UPDATE stocks SET quantite_reservee = GREATEST(0, quantite_reservee - ?)
                        WHERE type_article = ? AND id_article = ?
                    `, [ligne.quantite_commandee, ligne.type_produit, ligne.id_produit]);
                }
            }

            // 2. Si c'était déjà dans le journal comptable (livraison complète), on annule l'écriture
            if (commande.statut === 'livree_complete' || commande.statut === 'payee') {
                const [clientRows] = await connection.query('SELECT nom_client FROM clients WHERE id = ?', [commande.id_client]);
                const clientNom = (clientRows && clientRows[0]) ? clientRows[0].nom_client : 'Client';

                await connection.query('CALL enregistrer_journal_comptable(?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                    'vente', 'depense', `ANNULATION Vente - ${commande.numero_commande}`,
                    `Annulation commande client: ${commande.numero_commande}`, commande.montant_total,
                    '707 - Ventes', '411 - Clients', 'commandes_vente', id, 'client',
                    commande.id_client, clientNom, req.user?.id || req.userId,
                    commande.numero_commande, JSON_OBJECT('annulation', true)
                ]);
            }
        }

        // Mettre à jour le statut
        await connection.query(`
            UPDATE commandes_vente 
            SET statut = ?, valide_par = ?, date_validation = NOW()
            WHERE id = ?
        `, [statut, req.user?.id || req.userId, id]);

        // Créer/Mettre à jour facture
        if (statut === 'payee' || (statut === 'confirmee' && (commande.statut === 'brouillon' || !commande.statut))) {
            // Check if facture already exists
            const [existingRows] = await connection.query('SELECT id FROM factures WHERE id_commande = ?', [id]);
            const existing = existingRows[0];

            if (!existing) {
                const [lastFactureRows] = await connection.query('SELECT numero_facture FROM factures ORDER BY id DESC LIMIT 1');
                const lastFacture = lastFactureRows[0];
                const lastNum = lastFacture && lastFacture.numero_facture ? parseInt(lastFacture.numero_facture.split('-')[1]) : 0;
                const numero_facture = `FAC-${String(lastNum + 1).padStart(6, '0')}`;

                const dateEcheance = new Date();
                dateEcheance.setDate(dateEcheance.getDate() + 30);

                await connection.query(`
                    INSERT INTO factures (
                        numero_facture, type_facture, id_commande, id_client,
                        date_facture, date_echeance, montant_ht, montant_tva,
                        montant_ttc, montant_du, montant_regle, statut_paiement, cree_par
                    ) VALUES (?, 'vente', ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    numero_facture, id, commande.id_client, dateEcheance,
                    commande.montant_ht, commande.montant_tva, commande.montant_ttc,
                    statut === 'payee' ? 0 : commande.montant_ttc,
                    statut === 'payee' ? commande.montant_ttc : 0,
                    statut === 'payee' ? 'payee' : 'impayee',
                    req.user?.id || req.userId
                ]);
            } else if (statut === 'payee') {
                await connection.query(`
                    UPDATE factures SET statut_paiement = 'payee', montant_regle = montant_ttc, montant_du = 0
                    WHERE id_commande = ?
                `, [id]);
            }
        }

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Statut mis à jour avec succès.'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Update statut commande error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du statut.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// ============================================
// COMMANDES ACHAT - GESTION COMPLÈTE
// ============================================
router.get('/commandes-achat', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { statut, id_fournisseur, startDate, endDate, limit = 50, offset = 0 } = req.query;

        // Conversion et validation
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 1000)'
            });
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset invalide'
            });
        }

        let sql = `
            SELECT 
                ca.*,
                f.nom_fournisseur,
                f.telephone as fournisseur_telephone,
                u.nom_complet as cree_par_nom,
                (SELECT COUNT(*) FROM lignes_commande_achat WHERE id_commande_achat = ca.id) as nombre_lignes
            FROM commandes_achat ca
            JOIN fournisseurs f ON ca.id_fournisseur = f.id
            LEFT JOIN utilisateurs u ON ca.cree_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (statut) {
            sql += ' AND ca.statut = ?';
            params.push(statut);
        }

        if (id_fournisseur) {
            sql += ' AND ca.id_fournisseur = ?';
            params.push(parseInt(id_fournisseur, 10));
        }

        if (startDate) {
            sql += ' AND ca.date_commande >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND ca.date_commande <= ?';
            params.push(endDate);
        }

        sql += ` ORDER BY ca.date_commande DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const commandesResult = await db.query(sql, params);
        const commandes = Array.isArray(commandesResult) ? commandesResult : [];

        res.status(200).json({
            success: true,
            data: commandes
        });
    } catch (error) {
        console.error('❌ Get commandes achat error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes d\'achat.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/commandes-achat', authenticate, authorize('admin', 'manager'), async (req, res) => {
    let connection;

    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        const {
            id_fournisseur, date_commande, date_livraison_prevue, lieu_livraison,
            mode_paiement, conditions_paiement, delai_paiement_jours, tva_pourcent,
            frais_livraison, remise, observations_livraison, lignes
        } = req.body;

        if (!id_fournisseur || !lignes || lignes.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Fournisseur et articles requis.'
            });
        }

        // Générer numéro
        const lastCommandeResult = await connection.query(
            'SELECT numero_commande FROM commandes_achat ORDER BY id DESC LIMIT 1'
        );
        const lastCommande = Array.isArray(lastCommandeResult) ? lastCommandeResult[0] : null;
        const lastNum = lastCommande && lastCommande.numero_commande
            ? parseInt(lastCommande.numero_commande.split('-')[1])
            : 0;
        const numero_commande = `CA-${String(lastNum + 1).padStart(6, '0')}`;

        // Calculer montants
        let montant_ht = 0;
        for (const ligne of lignes) {
            const montant_ligne = ligne.quantite_commandee * ligne.prix_unitaire_ht *
                (1 - (ligne.remise_pourcent || 0) / 100);
            montant_ht += montant_ligne;
        }

        const montant_tva = montant_ht * (parseFloat(tva_pourcent) || 0) / 100;
        const montant_ttc = montant_ht + montant_tva;
        const montant_total = montant_ttc + (parseFloat(frais_livraison) || 0) - (parseFloat(remise) || 0);

        // Insérer commande
        const commandeResult = await connection.query(`
            INSERT INTO commandes_achat (
                numero_commande, id_fournisseur, date_commande, date_livraison_prevue,
                lieu_livraison, mode_paiement, conditions_paiement, delai_paiement_jours,
                montant_ht, tva_pourcent, montant_tva, montant_ttc, frais_livraison,
                remise, montant_total, observations_livraison, statut, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', ?)
        `, [
            numero_commande, id_fournisseur, date_commande || new Date(),
            date_livraison_prevue, lieu_livraison, mode_paiement || 'credit',
            conditions_paiement, delai_paiement_jours || 30, montant_ht,
            tva_pourcent || 0, montant_tva, montant_ttc, frais_livraison || 0,
            remise || 0, montant_total, observations_livraison, req.user?.id || req.userId
        ]);

        const commandeId = Array.isArray(commandeResult) ?
            (commandeResult[0]?.insertId || commandeResult.insertId) : commandeResult.insertId;

        // Insérer lignes
        for (const ligne of lignes) {
            const montant_ligne_ht = ligne.quantite_commandee * ligne.prix_unitaire_ht *
                (1 - (ligne.remise_pourcent || 0) / 100);
            const montant_ligne_tva = montant_ligne_ht * (ligne.tva_pourcent || 0) / 100;
            const montant_ligne_ttc = montant_ligne_ht + montant_ligne_tva;

            await connection.query(`
                INSERT INTO lignes_commande_achat (
                    id_commande_achat, type_article, id_article, designation,
                    description, quantite_commandee, unite, prix_unitaire_ht,
                    remise_pourcent, tva_pourcent, montant_ht, montant_tva, montant_ttc
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                commandeId, ligne.type_article, ligne.id_article, ligne.designation,
                ligne.description, ligne.quantite_commandee, ligne.unite,
                ligne.prix_unitaire_ht, ligne.remise_pourcent || 0,
                ligne.tva_pourcent || 0, montant_ligne_ht, montant_ligne_tva,
                montant_ligne_ttc
            ]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Commande d\'achat créée avec succès.',
            data: {
                id: commandeId,
                numero_commande,
                montant_total
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Create commande achat error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// ============================================
// FACTURES
// ============================================
router.get('/factures', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { type_facture, statut_paiement, startDate, endDate, limit = 100, offset = 0 } = req.query;

        // Conversion et validation
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 1000)'
            });
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Offset invalide'
            });
        }

        let sql = `
            SELECT 
                f.*,
                CASE 
                    WHEN f.type_facture = 'vente' THEN c.nom_client
                    WHEN f.type_facture = 'achat' THEN fr.nom_fournisseur
                END as tiers_nom,
                (f.montant_ttc - f.montant_regle) as montant_restant,
                DATEDIFF(f.date_echeance, CURDATE()) as jours_echeance
            FROM factures f
            LEFT JOIN clients c ON f.id_client = c.id
            LEFT JOIN fournisseurs fr ON f.id_fournisseur = fr.id
            WHERE 1=1
        `;
        const params = [];

        if (type_facture) {
            sql += ' AND f.type_facture = ?';
            params.push(type_facture);
        }

        if (statut_paiement) {
            sql += ' AND f.statut_paiement = ?';
            params.push(statut_paiement);
        }

        if (startDate) {
            sql += ' AND f.date_facture >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND f.date_facture <= ?';
            params.push(endDate);
        }

        sql += ` ORDER BY f.date_facture DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

        const facturesResult = await db.query(sql, params);
        const factures = Array.isArray(facturesResult) ? facturesResult : [];

        res.status(200).json({
            success: true,
            data: factures
        });
    } catch (error) {
        console.error('❌ Get factures error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des factures.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// PAIEMENTS
// ============================================
router.get('/paiements', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { type_paiement, statut, startDate, endDate } = req.query;

        let sql = `
            SELECT 
                p.*,
                CASE 
                    WHEN p.type_paiement = 'encaissement' THEN 'Encaissement'
                    WHEN p.type_paiement = 'decaissement' THEN 'Décaissement'
                    ELSE p.type_paiement
                END as type_paiement_libelle,
                f.numero_facture,
                u.nom_complet as valide_par_nom
            FROM paiements p
            LEFT JOIN factures f ON p.id_facture = f.id
            LEFT JOIN utilisateurs u ON p.valide_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (type_paiement) {
            sql += ' AND p.type_paiement = ?';
            params.push(type_paiement);
        }

        if (statut) {
            sql += ' AND p.statut = ?';
            params.push(statut);
        }

        if (startDate) {
            sql += ' AND p.date_paiement >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND p.date_paiement <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY p.date_paiement DESC, p.id DESC';

        const paiementsResult = await db.query(sql, params);
        const paiements = Array.isArray(paiementsResult) ? paiementsResult : [];

        res.status(200).json({
            success: true,
            data: paiements
        });
    } catch (error) {
        console.error('❌ Get paiements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paiements.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/paiements', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const {
            type_paiement, source_type, id_source, id_facture, montant,
            mode_paiement, date_paiement, banque, numero_compte, numero_cheque,
            description, devise, taux_change
        } = req.body;

        if (!montant || parseFloat(montant) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide.'
            });
        }

        // Générer référence
        const lastPaiementResult = await db.query(
            'SELECT reference_paiement FROM paiements ORDER BY id DESC LIMIT 1'
        );
        const lastPaiement = Array.isArray(lastPaiementResult) ? lastPaiementResult[0] : null;
        const lastNum = lastPaiement ? parseInt(lastPaiement.reference_paiement.split('-')[1]) : 0;
        const reference_paiement = `PAI-${String(lastNum + 1).padStart(6, '0')}`;

        const sql = `
            INSERT INTO paiements (
                reference_paiement, type_paiement, source_type, id_source, id_facture,
                montant, mode_paiement, date_paiement, banque, numero_compte,
                numero_cheque, description, devise, taux_change, statut, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)
        `;

        const result = await db.query(sql, [
            reference_paiement, type_paiement || 'encaissement', source_type,
            id_source, id_facture, montant, mode_paiement || 'especes',
            date_paiement || new Date(), banque, numero_compte, numero_cheque,
            description, devise || 'BIF', taux_change || 1, req.user?.id || req.userId
        ]);

        const insertId = Array.isArray(result) ? (result[0]?.insertId || result.insertId) : result.insertId;

        res.status(201).json({
            success: true,
            message: 'Paiement enregistré avec succès.',
            data: { id: insertId, reference_paiement }
        });
    } catch (error) {
        console.error('❌ Create paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du paiement.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.put('/paiements/:id/valider', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(`
            UPDATE paiements 
            SET statut = 'valide', valide_par = ?, date_validation = NOW()
            WHERE id = ?
        `, [req.user?.id || req.userId, id]);

        res.status(200).json({
            success: true,
            message: 'Paiement validé avec succès.'
        });
    } catch (error) {
        console.error('❌ Valider paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation du paiement.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// STATISTIQUES ET RAPPORTS
// ============================================
router.get('/statistiques', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateDebut = startDate || new Date(new Date().getFullYear(), 0, 1);
        const dateFin = endDate || new Date();

        // Ventes
        const statsVentesResult = await db.query(`
            SELECT 
                COUNT(*) as nombre_commandes,
                COALESCE(SUM(CASE WHEN statut IN ('livree_complete', 'payee') THEN montant_total ELSE 0 END), 0) as total_ventes,
                COALESCE(SUM(CASE WHEN statut NOT IN ('livree_complete', 'payee', 'annulee') THEN montant_total ELSE 0 END), 0) as total_ventes_encours,
                COALESCE(AVG(montant_total), 0) as moyenne_commande,
                COUNT(DISTINCT id_client) as nombre_clients
            FROM commandes_vente
            WHERE date_commande BETWEEN ? AND ?
            AND statut != 'annulee'
        `, [dateDebut, dateFin]);
        const statsVentes = Array.isArray(statsVentesResult) ? statsVentesResult[0] : statsVentesResult;

        // Achats
        const statsAchatsResult = await db.query(`
            SELECT 
                COUNT(*) as nombre_commandes,
                COALESCE(SUM(CASE WHEN statut IN ('livree_complete', 'payee') THEN montant_total ELSE 0 END), 0) as total_achats,
                COALESCE(SUM(CASE WHEN statut NOT IN ('livree_complete', 'payee', 'annulee') THEN montant_total ELSE 0 END), 0) as total_achats_encours,
                COUNT(DISTINCT id_fournisseur) as nombre_fournisseurs
            FROM commandes_achat
            WHERE date_commande BETWEEN ? AND ?
            AND statut != 'annulee'
        `, [dateDebut, dateFin]);
        const statsAchats = Array.isArray(statsAchatsResult) ? statsAchatsResult[0] : statsAchatsResult;

        // Factures impayées
        const facturesImpayeesResult = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant_du), 0) as montant_total,
                COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), date_echeance) > 0 THEN montant_du ELSE 0 END), 0) as montant_retard,
                COUNT(CASE WHEN DATEDIFF(CURDATE(), date_echeance) > 0 THEN 1 END) as en_retard
            FROM factures
            WHERE statut_paiement IN ('impayee', 'partiellement_payee')
        `);
        const facturesImpayees = Array.isArray(facturesImpayeesResult) ? facturesImpayeesResult[0] : facturesImpayeesResult;

        // Top 5 clients
        const topClientsResult = await db.query(`
            SELECT 
                c.id, c.nom_client,
                COUNT(cv.id) as nombre_commandes,
                COALESCE(SUM(cv.montant_total), 0) as total_achats
            FROM clients c
            LEFT JOIN commandes_vente cv ON cv.id_client = c.id 
                AND cv.date_commande BETWEEN ? AND ?
                AND cv.statut != 'annulee'
            GROUP BY c.id
            ORDER BY total_achats DESC
            LIMIT 5
        `, [dateDebut, dateFin]);
        const topClients = Array.isArray(topClientsResult) ? topClientsResult : [];

        // Évolution mensuelle
        const evolutionMensuelleResult = await db.query(`
            SELECT 
                DATE_FORMAT(date_commande, '%Y-%m') as mois,
                COUNT(*) as nombre_commandes,
                COALESCE(SUM(montant_total), 0) as total_ventes
            FROM commandes_vente
            WHERE date_commande BETWEEN ? AND ?
            AND statut IN ('confirmee', 'livree_complete', 'payee')
            GROUP BY DATE_FORMAT(date_commande, '%Y-%m')
            ORDER BY mois
        `, [dateDebut, dateFin]);
        const evolutionMensuelle = Array.isArray(evolutionMensuelleResult) ? evolutionMensuelleResult : [];

        res.status(200).json({
            success: true,
            data: {
                ventes: statsVentes,
                achats: statsAchats,
                factures_impayees: facturesImpayees,
                top_clients: topClients,
                evolution_mensuelle: evolutionMensuelle
            }
        });
    } catch (error) {
        console.error('❌ Get statistiques error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// EXPORT ET IMPRESSION
// ============================================
router.get('/export/commandes-vente', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { startDate, endDate, format = 'csv' } = req.query;

        let sql = `
            SELECT 
                cv.numero_commande,
                cv.date_commande,
                c.nom_client,
                cv.montant_total,
                cv.statut,
                cv.mode_paiement
            FROM commandes_vente cv
            JOIN clients c ON cv.id_client = c.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            sql += ' AND cv.date_commande >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND cv.date_commande <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY cv.date_commande DESC';

        const dataResult = await db.query(sql, params);
        const data = Array.isArray(dataResult) ? dataResult : [];

        if (format === 'csv') {
            let csv = 'Numéro,Date,Client,Montant,Statut,Mode Paiement\n';
            data.forEach(row => {
                csv += `${row.numero_commande},${row.date_commande},${row.nom_client},${row.montant_total},${row.statut},${row.mode_paiement}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=commandes-vente-${Date.now()}.csv`);
            res.send(csv);
        } else {
            res.status(200).json({
                success: true,
                data
            });
        }
    } catch (error) {
        console.error('❌ Export commandes error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;