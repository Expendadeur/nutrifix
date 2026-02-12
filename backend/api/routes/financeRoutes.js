// backend/routes/financeRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// ============================================
// DASHBOARD FINANCIER - Vue d'ensemble
// ============================================
router.get('/dashboard', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(new Date().setDate(1)).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        // Totaux généraux
        const resultsTotaux = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END), 0) as total_entrees,
                COALESCE(SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END), 0) as total_sorties
            FROM journal_comptable
            WHERE date_operation >= ? AND date_operation <= ?
        `, [start, end]);
        const totaux = (resultsTotaux && resultsTotaux.length > 0) ? resultsTotaux[0] : { total_entrees: 0, total_sorties: 0 };

        // Créances et Dettes
        const resultsCreances = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant_du), 0) as total
            FROM factures
            WHERE type_facture = 'vente' AND statut_paiement != 'payee'
        `);
        const creances = (resultsCreances && resultsCreances.length > 0) ? resultsCreances[0] : { nombre: 0, total: 0 };

        const resultsDettes = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant_du), 0) as total
            FROM factures
            WHERE type_facture = 'achat' AND statut_paiement != 'payee'
        `);
        const dettes = (resultsDettes && resultsDettes.length > 0) ? resultsDettes[0] : { nombre: 0, total: 0 };

        // Évolution mensuelle
        const evolutionMensuelle = await db.query(`
            SELECT 
                DATE_FORMAT(date_operation, '%Y-%m') as mois,
                COALESCE(SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END), 0) as entrees,
                COALESCE(SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END), 0) as sorties
            FROM journal_comptable
            WHERE date_operation >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(date_operation, '%Y-%m')
            ORDER BY mois ASC
        `);

        // Top dépenses par catégorie
        const topDepenses = await db.query(`
            SELECT 
                categorie,
                COALESCE(SUM(montant), 0) as total,
                COUNT(*) as nombre
            FROM journal_comptable
            WHERE type_mouvement IN ('sortie', 'depense')
            AND date_operation >= ? AND date_operation <= ?
            GROUP BY categorie
            ORDER BY total DESC
            LIMIT 10
        `, [start, end]);

        // Factures en retard
        const resultsFacturesRetard = await db.query(`
            SELECT COUNT(*) as nombre
            FROM factures
            WHERE statut_paiement IN ('impayee', 'partiellement_payee')
            AND date_echeance < CURDATE()
        `);
        const facturesRetard = (resultsFacturesRetard && resultsFacturesRetard.length > 0) ? resultsFacturesRetard[0] : { nombre: 0 };

        res.status(200).json({
            success: true,
            data: {
                totaux: {
                    entrees: parseFloat(totaux.total_entrees),
                    sorties: parseFloat(totaux.total_sorties),
                    solde: parseFloat(totaux.total_entrees) - parseFloat(totaux.total_sorties)
                },
                creances: {
                    nombre: parseInt(creances.nombre),
                    total: parseFloat(creances.total)
                },
                dettes: {
                    nombre: parseInt(dettes.nombre),
                    total: parseFloat(dettes.total)
                },
                evolutionMensuelle: evolutionMensuelle.map(e => ({
                    mois: e.mois,
                    entrees: parseFloat(e.entrees),
                    sorties: parseFloat(e.sorties),
                    solde: parseFloat(e.entrees) - parseFloat(e.sorties)
                })),
                topDepenses: topDepenses.map(d => ({
                    categorie: d.categorie,
                    total: parseFloat(d.total),
                    nombre: parseInt(d.nombre)
                })),
                alertes: {
                    facturesRetard: parseInt(facturesRetard.nombre)
                }
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

// ============================================
// CRÉANCES - Gestion complète
// ============================================
router.get('/creances', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { statut, client_id } = req.query;

        let sql = `
            SELECT 
                f.id,
                f.numero_facture,
                f.date_facture,
                f.date_echeance,
                f.montant_ttc as montant_total,
                f.montant_regle as montant_paye,
                f.montant_du as montant_restant,
                f.statut_paiement as statut,
                f.nombre_relances,
                f.date_derniere_relance,
                c.id as client_id,
                c.nom_client as client_nom,
                c.telephone as client_telephone,
                c.email as client_email,
                DATEDIFF(CURDATE(), f.date_echeance) as jours_retard
            FROM factures f
            JOIN clients c ON f.id_client = c.id
            WHERE f.type_facture = 'vente'
            AND f.statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const params = [];

        if (statut) {
            sql += ' AND f.statut_paiement = ?';
            params.push(statut);
        }

        if (client_id) {
            sql += ' AND f.id_client = ?';
            params.push(client_id);
        }

        sql += ' ORDER BY f.date_echeance ASC';

        const creances = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: creances.map(c => ({
                ...c,
                montant_total: parseFloat(c.montant_total),
                montant_paye: parseFloat(c.montant_paye),
                montant_restant: parseFloat(c.montant_restant),
                jours_retard: parseInt(c.jours_retard)
            }))
        });
    } catch (error) {
        console.error('Get creances error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des créances.'
        });
    }
});

router.post('/creances/:id/relancer', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { message_personnalise } = req.body;

        // Récupérer la facture
        const [facture] = await connection.query(`
            SELECT f.*, c.nom_client, c.email, c.telephone
            FROM factures f
            JOIN clients c ON f.id_client = c.id
            WHERE f.id = ?
        `, [id]);

        if (!facture) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Facture non trouvée.'
            });
        }

        // Mettre à jour la facture
        await connection.query(`
            UPDATE factures 
            SET nombre_relances = nombre_relances + 1,
                date_derniere_relance = NOW()
            WHERE id = ?
        `, [id]);

        // Créer une notification
        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur, type_notification, titre, message, priorite
            ) VALUES (?, 'rappel', ?, ?, 'haute')
        `, [
            req.userId,
            `Relance client - ${facture.numero_facture}`,
            `Relance envoyée à ${facture.nom_client} pour la facture ${facture.numero_facture}`
        ]);

        // Enregistrer dans les traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement
            ) VALUES (?, 'finance', 'relance_client', ?, 'factures', ?)
        `, [
            req.userId,
            `Relance client ${facture.nom_client} - Facture ${facture.numero_facture}`,
            id
        ]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Relance envoyée avec succès.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Relancer client error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de la relance.'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// DETTES - Gestion complète
// ============================================
router.get('/dettes', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { statut, fournisseur_id } = req.query;

        let sql = `
            SELECT 
                f.id,
                f.numero_facture,
                f.date_facture,
                f.date_echeance,
                f.montant_ttc as montant_total,
                f.montant_regle as montant_paye,
                f.montant_du as montant_restant,
                f.statut_paiement as statut,
                fr.id as fournisseur_id,
                fr.nom_fournisseur as fournisseur_nom,
                fr.telephone as fournisseur_telephone,
                fr.email as fournisseur_email,
                DATEDIFF(CURDATE(), f.date_echeance) as jours_retard
            FROM factures f
            JOIN fournisseurs fr ON f.id_fournisseur = fr.id
            WHERE f.type_facture = 'achat'
            AND f.statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const params = [];

        if (statut) {
            sql += ' AND f.statut_paiement = ?';
            params.push(statut);
        }

        if (fournisseur_id) {
            sql += ' AND f.id_fournisseur = ?';
            params.push(fournisseur_id);
        }

        sql += ' ORDER BY f.date_echeance ASC';

        const dettes = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: dettes.map(d => ({
                ...d,
                montant_total: parseFloat(d.montant_total),
                montant_paye: parseFloat(d.montant_paye),
                montant_restant: parseFloat(d.montant_restant),
                jours_retard: parseInt(d.jours_retard)
            }))
        });
    } catch (error) {
        console.error('Get dettes error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des dettes.'
        });
    }
});

// ============================================
// PAIEMENTS - Gestion complète
// ============================================
router.get('/paiements', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { startDate, endDate, type_paiement, mode_paiement, statut } = req.query;

        let sql = `
            SELECT 
                p.*,
                CASE 
                    WHEN p.source_type = 'client' THEN c.nom_client
                    WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
                    WHEN p.source_type = 'employe' THEN u.nom_complet
                    ELSE p.source_type
                END as source_nom
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN utilisateurs u ON p.source_type = 'employe' AND p.id_source = u.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            sql += ' AND p.date_paiement >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND p.date_paiement <= ?';
            params.push(endDate);
        }

        if (type_paiement) {
            sql += ' AND p.type_paiement = ?';
            params.push(type_paiement);
        }

        if (mode_paiement) {
            sql += ' AND p.mode_paiement = ?';
            params.push(mode_paiement);
        }

        if (statut) {
            sql += ' AND p.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY p.date_paiement DESC LIMIT 500';

        const paiements = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: paiements.map(p => ({
                ...p,
                montant: parseFloat(p.montant)
            }))
        });
    } catch (error) {
        console.error('Get paiements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paiements.'
        });
    }
});

router.post('/paiements', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            type_paiement, montant, mode_paiement, reference_mode,
            source_type, id_source, id_facture, id_commande,
            description, banque, numero_compte, numero_cheque,
            date_paiement
        } = req.body;

        // Validation
        if (!type_paiement || !montant || !mode_paiement || !source_type) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Données incomplètes.'
            });
        }

        // Générer référence unique
        const reference_paiement = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Insérer le paiement
        const [paiementResult] = await connection.query(`
            INSERT INTO paiements (
                reference_paiement, type_paiement, montant, mode_paiement, reference_mode,
                source_type, id_source, id_facture, id_commande,
                description, banque, numero_compte, numero_cheque,
                date_paiement, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valide')
        `, [
            reference_paiement, type_paiement, montant, mode_paiement, reference_mode,
            source_type, id_source, id_facture, id_commande,
            description, banque, numero_compte, numero_cheque,
            date_paiement || new Date()
        ]);

        // Mettre à jour la facture si applicable
        if (id_facture) {
            await connection.query(`
                UPDATE factures 
                SET montant_regle = montant_regle + ?,
                    montant_du = montant_ttc - (montant_regle + ?),
                    statut_paiement = CASE 
                        WHEN (montant_regle + ?) >= montant_ttc THEN 'payee'
                        WHEN (montant_regle + ?) > 0 THEN 'partiellement_payee'
                        ELSE 'impayee'
                    END,
                    date_dernier_paiement = NOW()
                WHERE id = ?
            `, [montant, montant, montant, montant, id_facture]);
        }

        // Enregistrer dans traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement
            ) VALUES (?, 'finance', 'creation_paiement', ?, 'paiements', ?)
        `, [
            req.userId,
            `Paiement ${type_paiement} - ${montant} ${mode_paiement}`,
            paiementResult.insertId
        ]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Paiement enregistré avec succès.',
            data: {
                id: paiementResult.insertId,
                reference: reference_paiement
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du paiement.'
        });
    } finally {
        connection.release();
    }
});

router.put('/paiements/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const updateData = req.body;

        // Récupérer le paiement actuel
        const [paiement] = await connection.query('SELECT * FROM paiements WHERE id = ?', [id]);

        if (!paiement) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Paiement non trouvé.'
            });
        }

        // Mettre à jour
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE paiements SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Enregistrer dans traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, donnees_avant, donnees_apres
            ) VALUES (?, 'finance', 'modification_paiement', ?, 'paiements', ?, ?, ?)
        `, [
            req.userId,
            `Modification paiement ${paiement.reference_paiement}`,
            id,
            JSON.stringify(paiement),
            JSON.stringify(updateData)
        ]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Paiement mis à jour avec succès.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du paiement.'
        });
    } finally {
        connection.release();
    }
});

router.delete('/paiements/:id', authenticate, authorize('admin'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        // Vérifier existence
        const [paiement] = await connection.query('SELECT * FROM paiements WHERE id = ?', [id]);

        if (!paiement) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Paiement non trouvé.'
            });
        }

        // Annuler au lieu de supprimer
        await connection.query(`
            UPDATE paiements SET statut = 'annule' WHERE id = ?
        `, [id]);

        // Si lié à une facture, mettre à jour
        if (paiement.id_facture) {
            await connection.query(`
                UPDATE factures 
                SET montant_regle = montant_regle - ?,
                    montant_du = montant_du + ?,
                    statut_paiement = CASE 
                        WHEN (montant_regle - ?) <= 0 THEN 'impayee'
                        WHEN (montant_regle - ?) < montant_ttc THEN 'partiellement_payee'
                        ELSE statut_paiement
                    END
                WHERE id = ?
            `, [paiement.montant, paiement.montant, paiement.montant, paiement.montant, paiement.id_facture]);
        }

        // Enregistrer dans traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement, niveau
            ) VALUES (?, 'finance', 'annulation_paiement', ?, 'paiements', ?, 'warning')
        `, [
            req.userId,
            `Annulation paiement ${paiement.reference_paiement}`,
            id
        ]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Paiement annulé avec succès.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Delete paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'annulation du paiement.'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// JOURNAL COMPTABLE - Accès complet
// ============================================
router.get('/journal-comptable', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const {
            startDate, endDate, categorie, type_mouvement,
            table_source, search, limit = 1000
        } = req.query;

        let sql = `
            SELECT 
                jc.*,
                u.nom_complet as effectue_par_nom
            FROM journal_comptable jc
            LEFT JOIN utilisateurs u ON jc.effectue_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            sql += ' AND jc.date_operation >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND jc.date_operation <= ?';
            params.push(endDate);
        }

        if (categorie) {
            sql += ' AND jc.categorie = ?';
            params.push(categorie);
        }

        if (type_mouvement) {
            sql += ' AND jc.type_mouvement = ?';
            params.push(type_mouvement);
        }

        if (table_source) {
            sql += ' AND jc.table_source = ?';
            params.push(table_source);
        }

        if (search) {
            sql += ' AND (jc.libelle LIKE ? OR jc.description LIKE ? OR jc.reference_externe LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ' ORDER BY jc.date_operation DESC, jc.heure_operation DESC LIMIT ?';
        params.push(parseInt(limit));

        const mouvements = await db.query(sql, params);

        // Calculer totaux pour la période
        const resultsTotauxPeriode = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END), 0) as total_entrees,
                COALESCE(SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END), 0) as total_sorties,
                COUNT(*) as nombre_operations
            FROM journal_comptable
            WHERE date_operation >= ? AND date_operation <= ?
        `, [
            startDate || '1900-01-01',
            endDate || '2100-12-31'
        ]);
        const totaux = (resultsTotauxPeriode && resultsTotauxPeriode.length > 0) ? resultsTotauxPeriode[0] : { total_entrees: 0, total_sorties: 0, nombre_operations: 0 };

        const solde = parseFloat(totaux.total_entrees) - parseFloat(totaux.total_sorties);

        res.status(200).json({
            success: true,
            data: {
                mouvements: mouvements.map(m => ({
                    ...m,
                    montant: parseFloat(m.montant),
                    quantite: m.quantite ? parseFloat(m.quantite) : null
                })),
                totaux: {
                    total_entrees: parseFloat(totaux.total_entrees),
                    total_sorties: parseFloat(totaux.total_sorties),
                    solde,
                    nombre_operations: parseInt(totaux.nombre_operations)
                }
            }
        });
    } catch (error) {
        console.error('Get journal comptable error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du journal.'
        });
    }
});

router.get('/journal-comptable/export', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const { startDate, endDate, format = 'csv' } = req.query;

        const mouvements = await db.query(`
            SELECT 
                jc.numero_ecriture,
                jc.date_operation,
                jc.heure_operation,
                jc.categorie,
                jc.type_mouvement,
                jc.libelle,
                jc.description,
                jc.montant,
                jc.compte_debit,
                jc.compte_credit,
                jc.effectue_par_nom,
                jc.reference_externe
            FROM journal_comptable jc
            WHERE jc.date_operation >= ? AND jc.date_operation <= ?
            ORDER BY jc.date_operation, jc.heure_operation
        `, [startDate, endDate]);

        if (format === 'csv') {
            const csv = [
                ['Numéro', 'Date', 'Heure', 'Catégorie', 'Type', 'Libellé', 'Montant', 'Débit', 'Crédit', 'Effectué par'].join(','),
                ...mouvements.map(m => [
                    m.numero_ecriture,
                    m.date_operation,
                    m.heure_operation,
                    m.categorie,
                    m.type_mouvement,
                    m.libelle,
                    m.montant,
                    m.compte_debit,
                    m.compte_credit,
                    m.effectue_par_nom
                ].join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=journal_comptable_${startDate}_${endDate}.csv`);
            return res.send(csv);
        }

        res.status(200).json({
            success: true,
            data: mouvements
        });
    } catch (error) {
        console.error('Export journal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export.'
        });
    }
});

// ============================================
// RAPPORTS FINANCIERS
// ============================================
router.get('/rapports', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const { type = 'synthese', departement, startDate, endDate } = req.query;
        const start = startDate || new Date(new Date().setDate(1)).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const rapportData = {};

        // Évolution CA
        const evolutionCA = await db.query(`
            SELECT 
                DATE(jc.date_operation) as date,
                COALESCE(SUM(CASE WHEN jc.type_mouvement IN ('entree', 'recette') THEN jc.montant ELSE 0 END), 0) as entrees,
                COALESCE(SUM(CASE WHEN jc.type_mouvement IN ('sortie', 'depense') THEN jc.montant ELSE 0 END), 0) as sorties
            FROM journal_comptable jc
            WHERE jc.date_operation >= ? AND jc.date_operation <= ?
            ${departement && departement !== 'all' ? 'AND jc.donnees_complementaires->"$.departement_id" = ?' : ''}
            GROUP BY DATE(jc.date_operation)
            ORDER BY date ASC
        `, departement && departement !== 'all' ? [start, end, departement] : [start, end]);

        rapportData.evolutionCA = {
            labels: evolutionCA.map(e => new Date(e.date).toLocaleDateString('fr-FR')),
            datasets: [
                {
                    label: 'Entrées',
                    data: evolutionCA.map(e => parseFloat(e.entrees)),
                    color: () => '#27AE60'
                },
                {
                    label: 'Sorties',
                    data: evolutionCA.map(e => parseFloat(e.sorties)),
                    color: () => '#E74C3C'
                }
            ]
        };

        // Répartition Dépenses
        const repartitionDepenses = await db.query(`
            SELECT 
                jc.categorie,
                COALESCE(SUM(jc.montant), 0) as montant,
                COUNT(*) as nombre
            FROM journal_comptable jc
            WHERE jc.type_mouvement IN ('sortie', 'depense')
            AND jc.date_operation >= ? AND jc.date_operation <= ?
            ${departement && departement !== 'all' ? 'AND jc.donnees_complementaires->"$.departement_id" = ?' : ''}
            GROUP BY jc.categorie
            ORDER BY montant DESC
        `, departement && departement !== 'all' ? [start, end, departement] : [start, end]);

        rapportData.repartitionDepenses = repartitionDepenses.map(r => ({
            name: r.categorie,
            montant: parseFloat(r.montant),
            nombre: parseInt(r.nombre),
            color: getCategorieColor(r.categorie),
            legendFontColor: '#7F8C8D',
            legendFontSize: 12
        }));

        // Comparatif Départements (si type = departement)
        if (type === 'departement' || type === 'comparatif') {
            const comparatifDepartements = await db.query(`
                SELECT 
                    d.nom as departement,
                    COALESCE(SUM(CASE WHEN jc.type_mouvement IN ('entree', 'recette') THEN jc.montant ELSE 0 END), 0) as entrees,
                    COALESCE(SUM(CASE WHEN jc.type_mouvement IN ('sortie', 'depense') THEN jc.montant ELSE 0 END), 0) as sorties
                FROM departements d
                LEFT JOIN journal_comptable jc ON jc.donnees_complementaires->"$.departement_id" = d.id
                    AND jc.date_operation >= ? AND jc.date_operation <= ?
                WHERE d.statut = 'actif'
                GROUP BY d.id, d.nom
                ORDER BY sorties DESC
                LIMIT 10
            `, [start, end]);

            rapportData.comparatifDepartements = {
                labels: comparatifDepartements.map(d => d.departement),
                datasets: [
                    {
                        data: comparatifDepartements.map(d => parseFloat(d.sorties))
                    }
                ]
            };
        }

        // Résumé financier
        const [resume] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END), 0) as total_entrees,
                COALESCE(SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END), 0) as total_sorties
            FROM journal_comptable
            WHERE date_operation >= ? AND date_operation <= ?
        `, [start, end]);

        rapportData.resume = {
            total_entrees: parseFloat(resume.total_entrees),
            total_sorties: parseFloat(resume.total_sorties),
            resultat_net: parseFloat(resume.total_entrees) - parseFloat(resume.total_sorties)
        };

        res.status(200).json({
            success: true,
            data: rapportData
        });
    } catch (error) {
        console.error('Get rapports error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du rapport.'
        });
    }
});

// ============================================
// RAPPROCHEMENT BANCAIRE
// ============================================
router.get('/rapprochement/releve-bancaire', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        // Simuler relevé bancaire (à adapter selon source réelle)
        const releve = await db.query(`
            SELECT 
                p.id,
                p.date_paiement as date,
                p.reference_paiement as reference,
                p.description as libelle,
                p.montant,
                CASE WHEN p.type_paiement = 'recette' THEN 'credit' ELSE 'debit' END as type,
                p.rapproche
            FROM paiements p
            WHERE p.mode_paiement IN ('virement', 'cheque')
            AND p.statut = 'valide'
            ORDER BY p.date_paiement DESC
            LIMIT 100
        `);

        res.status(200).json({
            success: true,
            data: releve
        });
    } catch (error) {
        console.error('Get relevé error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du relevé.'
        });
    }
});

router.get('/rapprochement/mouvements-comptables', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const mouvements = await db.query(`
            SELECT 
                jc.id,
                jc.date_operation as date,
                jc.reference_externe as reference,
                jc.libelle,
                jc.montant,
                CASE WHEN jc.type_mouvement IN ('sortie', 'depense') THEN 'debit' ELSE 'credit' END as type,
                jc.rapproche
            FROM journal_comptable jc
            WHERE jc.compte_debit LIKE '%512%' OR jc.compte_credit LIKE '%512%'
            ORDER BY jc.date_operation DESC
            LIMIT 100
        `);

        res.status(200).json({
            success: true,
            data: mouvements
        });
    } catch (error) {
        console.error('Get mouvements comptables error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des mouvements.'
        });
    }
});

router.get('/rapprochement/statut', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const [statut] = await db.query(`
            SELECT 
                COALESCE(
                    (SELECT SUM(montant) FROM paiements 
                     WHERE mode_paiement IN ('virement', 'cheque') 
                     AND statut = 'valide' AND rapproche = 0), 
                    0
                ) as solde_banque,
                COALESCE(
                    (SELECT SUM(montant) FROM journal_comptable 
                     WHERE (compte_debit LIKE '%512%' OR compte_credit LIKE '%512%') 
                     AND rapproche = 0), 
                    0
                ) as solde_comptable
        `);

        const difference = Math.abs(parseFloat(statut.solde_banque) - parseFloat(statut.solde_comptable));

        res.status(200).json({
            success: true,
            data: {
                solde_banque: parseFloat(statut.solde_banque),
                solde_comptable: parseFloat(statut.solde_comptable),
                difference,
                rapproche: difference < 0.01 // Tolérance de 1 centime
            }
        });
    } catch (error) {
        console.error('Get statut rapprochement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du statut.'
        });
    }
});

router.get('/rapprochement/ecarts', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        // Identifier les écarts
        const ecarts = [];

        // Mouvements bancaires sans correspondance comptable
        const bancairesSansCorrespondance = await db.query(`
            SELECT p.*
            FROM paiements p
            WHERE p.mode_paiement IN ('virement', 'cheque')
            AND p.statut = 'valide'
            AND p.rapproche = 0
            AND NOT EXISTS (
                SELECT 1 FROM journal_comptable jc
                WHERE jc.reference_externe = p.reference_paiement
                AND jc.rapproche = 0
            )
        `);

        bancairesSansCorrespondance.forEach(p => {
            ecarts.push({
                type: 'manque_comptable',
                description: `Paiement bancaire sans écriture comptable: ${p.reference_paiement}`,
                montant: parseFloat(p.montant),
                date: p.date_paiement,
                reference: p.reference_paiement
            });
        });

        // Écritures comptables sans mouvement bancaire
        const comptablesSansCorrespondance = await db.query(`
            SELECT jc.*
            FROM journal_comptable jc
            WHERE (jc.compte_debit LIKE '%512%' OR jc.compte_credit LIKE '%512%')
            AND jc.rapproche = 0
            AND jc.reference_externe IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM paiements p
                WHERE p.reference_paiement = jc.reference_externe
                AND p.rapproche = 0
            )
        `);

        comptablesSansCorrespondance.forEach(jc => {
            ecarts.push({
                type: 'manque_bancaire',
                description: `Écriture comptable sans mouvement bancaire: ${jc.numero_ecriture}`,
                montant: parseFloat(jc.montant),
                date: jc.date_operation,
                reference: jc.reference_externe
            });
        });

        res.status(200).json({
            success: true,
            data: ecarts
        });
    } catch (error) {
        console.error('Get ecarts error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des écarts.'
        });
    }
});

router.put('/rapprochement/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { table } = req.query; // 'paiements' ou 'journal_comptable'

        if (table === 'paiements') {
            await connection.query('UPDATE paiements SET rapproche = 1 WHERE id = ?', [id]);
        } else {
            await connection.query('UPDATE journal_comptable SET rapproche = 1 WHERE id = ?', [id]);
        }

        // Enregistrer dans traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee, id_enregistrement
            ) VALUES (?, 'finance', 'rapprochement', ?, ?, ?)
        `, [
            req.userId,
            `Rapprochement mouvement`,
            table,
            id
        ]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Mouvement rapproché avec succès.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Rapprocher mouvement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du rapprochement.'
        });
    } finally {
        connection.release();
    }
});

router.post('/rapprochement/valider', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Créer un enregistrement de rapprochement validé
        await connection.query(`
            INSERT INTO rapprochements_bancaires (
                date_rapprochement, effectue_par, statut
            ) VALUES (NOW(), ?, 'valide')
        `, [req.userId]);

        // Enregistrer dans traces
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details, niveau
            ) VALUES (?, 'finance', 'validation_rapprochement', ?, 'info')
        `, [
            req.userId,
            'Rapprochement bancaire validé'
        ]);

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Rapprochement validé avec succès.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Valider rapprochement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation du rapprochement.'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// DÉPARTEMENTS
// ============================================
router.get('/departements', authenticate, authorize('admin', 'manager', 'comptable'), async (req, res) => {
    try {
        const departements = await db.query(`
            SELECT 
                d.*,
                COALESCE(bd.budget_alloue, 0) as budget_alloue,
                COALESCE(bd.budget_utilise, 0) as budget_utilise
            FROM departements d
            LEFT JOIN budgets_departements bd ON d.id = bd.id_departement 
                AND bd.annee = YEAR(CURDATE())
            WHERE d.statut = 'actif'
            ORDER BY d.nom
        `);

        res.status(200).json({
            success: true,
            data: departements.map(d => ({
                ...d,
                budget_alloue: parseFloat(d.budget_alloue),
                budget_utilise: parseFloat(d.budget_utilise),
                budget_restant: parseFloat(d.budget_alloue) - parseFloat(d.budget_utilise)
            }))
        });
    } catch (error) {
        console.error('Get departements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements.'
        });
    }
});

// ============================================
// FONCTIONS UTILITAIRES
// ============================================
function getCategorieColor(categorie) {
    const colors = {
        'vente': '#27AE60',
        'achat': '#E74C3C',
        'salaire': '#F39C12',
        'production': '#9B59B6',
        'stock': '#3498DB',
        'maintenance': '#E67E22',
        'autre': '#95A5A6'
    };
    return colors[categorie] || '#95A5A6';
}

module.exports = router;