const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const ExcelJS = require('exceljs');

// =============================================
// DASHBOARD COMPTABLE
// =============================================

router.get('/dashboard', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Solde de trésorerie
        const tresorerieSql = `
            SELECT 
                SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE 0 END) as total_recettes,
                SUM(CASE WHEN type_paiement = 'depense' THEN montant ELSE 0 END) as total_depenses,
                SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE -montant END) as solde_tresorerie
            FROM paiements
            WHERE statut = 'valide'
            AND MONTH(date_paiement) = ?
            AND YEAR(date_paiement) = ?
        `;
        const [tresorerie] = await db.query(tresorerieSql, [currentMonth, currentYear]);

        // Créances clients
        const creancesSql = `
            SELECT 
                COUNT(*) as nombre_factures_impayees,
                SUM(montant_du) as total_creances,
                SUM(CASE WHEN jours_restants < 0 THEN montant_du ELSE 0 END) as creances_echues,
                SUM(CASE WHEN jours_restants BETWEEN 0 AND 30 THEN montant_du ELSE 0 END) as creances_30j,
                SUM(CASE WHEN jours_restants BETWEEN 31 AND 60 THEN montant_du ELSE 0 END) as creances_60j,
                SUM(CASE WHEN jours_restants > 60 THEN montant_du ELSE 0 END) as creances_plus_60j
            FROM factures
            WHERE type_facture = 'vente'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const [creances] = await db.query(creancesSql);

        // Dettes fournisseurs
        const dettesSql = `
            SELECT 
                COUNT(*) as nombre_factures_a_payer,
                SUM(montant_du) as total_dettes,
                SUM(CASE WHEN jours_restants < 0 THEN montant_du ELSE 0 END) as dettes_echues,
                SUM(CASE WHEN jours_restants BETWEEN 0 AND 30 THEN montant_du ELSE 0 END) as dettes_30j
            FROM factures
            WHERE type_facture = 'achat'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const [dettes] = await db.query(dettesSql);

        // Rapprochements en attente
        const rapprochementsSql = `
            SELECT 
                COUNT(*) as paiements_non_rapproches,
                SUM(montant) as montant_non_rapproche
            FROM paiements
            WHERE rapproche = FALSE
            AND statut = 'valide'
        `;
        const [rapprochements] = await db.query(rapprochementsSql);

        // Transactions récentes
        const transactionsSql = `
            SELECT 
                p.*,
                CASE 
                    WHEN p.source_type = 'client' THEN c.nom_client
                    WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
                    ELSE p.source_type
                END as source_nom,
                f_fact.numero_facture
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN factures f_fact ON p.id_facture = f_fact.id
            WHERE MONTH(p.date_paiement) = ?
            AND YEAR(p.date_paiement) = ?
            ORDER BY p.date_paiement DESC, p.date_creation DESC
            LIMIT 10
        `;
        const transactions = await db.query(transactionsSql, [currentMonth, currentYear]);

        // Écritures comptables du mois
        const ecrituresSql = `
            SELECT 
                COUNT(*) as nombre_ecritures,
                SUM(CASE WHEN type_mouvement = 'entree' THEN 1 ELSE 0 END) as entrees,
                SUM(CASE WHEN type_mouvement = 'sortie' THEN 1 ELSE 0 END) as sorties
            FROM mouvements_stock
            WHERE MONTH(date_mouvement) = ?
            AND YEAR(date_mouvement) = ?
        `;
        const [ecritures] = await db.query(ecrituresSql, [currentMonth, currentYear]);

        // Alertes comptables
        const alertes = [];

        // Factures échues
        if (creances.creances_echues > 0) {
            alertes.push({
                type: 'creances_echues',
                niveau: 'urgent',
                titre: 'Créances échues',
                message: `${creances.nombre_factures_impayees} factures échues pour ${formatCurrency(creances.creances_echues)}`,
                montant: creances.creances_echues
            });
        }

        // Paiements non rapprochés
        if (rapprochements.paiements_non_rapproches > 0) {
            alertes.push({
                type: 'rapprochement',
                niveau: 'warning',
                titre: 'Rapprochements en attente',
                message: `${rapprochements.paiements_non_rapproches} paiements à rapprocher`,
                montant: rapprochements.montant_non_rapproche
            });
        }

        res.status(200).json({
            success: true,
            data: {
                tresorerie: tresorerie,
                creances: creances,
                dettes: dettes,
                rapprochements: rapprochements,
                transactions: transactions,
                ecritures: ecritures,
                alertes: alertes,
                periode: {
                    mois: currentMonth,
                    annee: currentYear
                }
            }
        });
    } catch (error) {
        console.error('Dashboard comptable error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard'
        });
    }
});

// =============================================
// RAPPROCHEMENT BANCAIRE
// =============================================

router.get('/rapprochement-bancaire', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            compte,
            startDate,
            endDate,
            statut = 'non_rapproche'
        } = req.query;

        // Paiements à rapprocher
        let sql = `
            SELECT 
                p.*,
                CASE 
                    WHEN p.source_type = 'client' THEN c.nom_client
                    WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
                    ELSE p.source_type
                END as source_nom,
                f_fact.numero_facture
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN factures f_fact ON p.id_facture = f_fact.id
            WHERE p.statut = 'valide'
        `;
        const params = [];

        if (statut === 'non_rapproche') {
            sql += ' AND p.rapproche = FALSE';
        } else if (statut === 'rapproche') {
            sql += ' AND p.rapproche = TRUE';
        }

        if (compte) {
            sql += ' AND p.numero_compte = ?';
            params.push(compte);
        }

        if (startDate) {
            sql += ' AND p.date_paiement >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND p.date_paiement <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY p.date_paiement DESC';

        const paiements = await db.query(sql, params);

        // Calcul des totaux
        const totaux = paiements.reduce((acc, p) => {
            if (p.type_paiement === 'recette') {
                acc.recettes += parseFloat(p.montant);
            } else {
                acc.depenses += parseFloat(p.montant);
            }
            return acc;
        }, { recettes: 0, depenses: 0 });

        totaux.solde = totaux.recettes - totaux.depenses;

        res.status(200).json({
            success: true,
            data: {
                paiements: paiements,
                totaux: totaux,
                nombre_transactions: paiements.length
            }
        });
    } catch (error) {
        console.error('Rapprochement bancaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des transactions'
        });
    }
});

router.post('/rapprochement-bancaire/rapprocher', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const { paiement_ids, date_rapprochement } = req.body;

        if (!paiement_ids || paiement_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun paiement sélectionné'
            });
        }

        const placeholders = paiement_ids.map(() => '?').join(',');
        const sql = `
            UPDATE paiements 
            SET rapproche = TRUE,
                date_rapprochement = ?
            WHERE id IN (${placeholders})
            AND statut = 'valide'
        `;

        await db.query(sql, [date_rapprochement || new Date(), ...paiement_ids]);

        // Log de l'action
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                table_affectee
            ) VALUES (?, 'finance', 'RAPPROCHEMENT_BANCAIRE', ?, 'paiements')
        `, [req.userId, `Rapprochement de ${paiement_ids.length} paiements`]);

        res.status(200).json({
            success: true,
            message: `${paiement_ids.length} paiement(s) rapproché(s) avec succès`
        });
    } catch (error) {
        console.error('Rapprocher paiement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du rapprochement'
        });
    }
});

/**
 * POST /rapprochement-bancaire/export-excel - Exporter les transactions en Excel
 */
router.post('/rapprochement-bancaire/export-excel', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            compte,
            startDate,
            endDate,
            statut = 'all'
        } = req.body;

        // Requête pour récupérer les données à exporter
        let sql = `
            SELECT 
                p.*,
                CASE 
                    WHEN p.source_type = 'client' THEN c.nom_client
                    WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
                    ELSE p.source_type
                END as source_nom,
                f_fact.numero_facture
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN factures f_fact ON p.id_facture = f_fact.id
            WHERE p.statut = 'valide'
        `;
        const params = [];

        if (statut === 'non_rapproche') {
            sql += ' AND p.rapproche = FALSE';
        } else if (statut === 'rapproche') {
            sql += ' AND p.rapproche = TRUE';
        }

        if (compte) {
            sql += ' AND p.numero_compte = ?';
            params.push(compte);
        }

        if (startDate) {
            sql += ' AND p.date_paiement >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND p.date_paiement <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY p.date_paiement DESC';

        const paiements = await db.query(sql, params);

        // Création du classeur Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'NUTRIFIX';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Rapprochement Bancaire');

        // Styles
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } },
            alignment: { horizontal: 'center' }
        };

        // En-têtes
        worksheet.columns = [
            { header: 'Date', key: 'date_paiement', width: 15 },
            { header: 'Référence', key: 'reference_paiement', width: 20 },
            { header: 'Source', key: 'source_nom', width: 25 },
            { header: 'Facture', key: 'numero_facture', width: 20 },
            { header: 'Mode', key: 'mode_paiement', width: 15 },
            { header: 'Compte', key: 'numero_compte', width: 20 },
            { header: 'Type', key: 'type_paiement', width: 12 },
            { header: 'Montant', key: 'montant', width: 15 },
            { header: 'Statut', key: 'rapproche', width: 15 }
        ];

        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });

        // Données
        paiements.forEach(p => {
            worksheet.addRow({
                date_paiement: new Date(p.date_paiement).toLocaleDateString('fr-FR'),
                reference_paiement: p.reference_paiement,
                source_nom: p.source_nom,
                numero_facture: p.numero_facture || '-',
                mode_paiement: p.mode_paiement,
                numero_compte: p.numero_compte || '-',
                type_paiement: p.type_paiement === 'recette' ? 'Recette' : 'Dépense',
                montant: parseFloat(p.montant),
                rapproche: p.rapproche ? 'Rapproché' : 'En attente'
            });
        });

        // Formater la colonne montant
        worksheet.getColumn('montant').numFmt = '#,##0.00 "BIF"';

        // Générer le buffer et l'envoyer en base64
        const buffer = await workbook.xlsx.writeBuffer();
        res.status(200).json({
            success: true,
            data: buffer.toString('base64'),
            filename: `Rapprochement_Bancaire_${new Date().toISOString().split('T')[0]}.xlsx`
        });

    } catch (error) {
        console.error('Export Excel rapprochement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération de l\'export Excel'
        });
    }
});

// =============================================
// JOURNAL COMPTABLE (MOUVEMENTS)
// =============================================

router.get('/journal-comptable', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            type_mouvement,
            categorie,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        // Construction de la requête unifiée pour tous les mouvements
        let mouvements = [];

        // 1. Mouvements de stock
        const stockSql = `
            SELECT 
                ms.id,
                'stock' as categorie,
                ms.type_mouvement,
                ms.date_mouvement as date_operation,
                ms.quantite,
                ms.unite_mesure,
                ms.raison,
                ms.commentaire,
                CONCAT(s.type_article, ' - ', 
                    CASE 
                        WHEN s.type_article = 'intrant' THEN ia.nom_intrant
                        WHEN s.type_article = 'aliment' THEN ab.nom_aliment
                        ELSE s.type_article
                    END
                ) as description,
                u.nom_complet as effectue_par_nom,
                NULL as montant,
                NULL as compte_debit,
                NULL as compte_credit
            FROM mouvements_stock ms
            JOIN stocks s ON ms.id_stock = s.id
            LEFT JOIN intrants_agricoles ia ON s.type_article = 'intrant' AND s.id_article = ia.id
            LEFT JOIN aliments_betail ab ON s.type_article = 'aliment' AND s.id_article = ab.id
            LEFT JOIN utilisateurs u ON ms.effectue_par = u.id
            WHERE 1=1
        `;
        const stockParams = [];

        if (startDate) {
            stockSql += ' AND ms.date_mouvement >= ?';
            stockParams.push(startDate);
        }

        if (endDate) {
            stockSql += ' AND ms.date_mouvement <= ?';
            stockParams.push(endDate);
        }

        // 2. Paiements (mouvements financiers)
        const paiementsSql = `
            SELECT 
                p.id,
                'paiement' as categorie,
                p.type_paiement as type_mouvement,
                p.date_paiement as date_operation,
                NULL as quantite,
                NULL as unite_mesure,
                p.description as raison,
                p.reference_paiement as commentaire,
                CONCAT(
                    CASE 
                        WHEN p.source_type = 'client' THEN CONCAT('Client: ', c.nom_client)
                        WHEN p.source_type = 'fournisseur' THEN CONCAT('Fournisseur: ', f.nom_fournisseur)
                        ELSE p.source_type
                    END,
                    ' - ', p.mode_paiement
                ) as description,
                val.nom_complet as effectue_par_nom,
                p.montant,
                CASE 
                    WHEN p.type_paiement = 'recette' THEN 'Banque/Caisse'
                    ELSE NULL
                END as compte_debit,
                CASE 
                    WHEN p.type_paiement = 'depense' THEN 'Banque/Caisse'
                    ELSE NULL
                END as compte_credit
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN utilisateurs val ON p.valide_par = val.id
            WHERE p.statut = 'valide'
        `;
        const paiementsParams = [];

        if (startDate) {
            paiementsSql += ' AND p.date_paiement >= ?';
            paiementsParams.push(startDate);
        }

        if (endDate) {
            paiementsSql += ' AND p.date_paiement <= ?';
            paiementsParams.push(endDate);
        }

        // 3. Ventes (commandes vente livrées)
        const ventesSql = `
            SELECT 
                cv.id,
                'vente' as categorie,
                'sortie' as type_mouvement,
                cv.date_livraison_reelle as date_operation,
                NULL as quantite,
                NULL as unite_mesure,
                'Vente' as raison,
                cv.numero_commande as commentaire,
                CONCAT('Client: ', c.nom_client, ' - ', cv.numero_commande) as description,
                u.nom_complet as effectue_par_nom,
                cv.montant_total as montant,
                'Clients' as compte_debit,
                'Ventes' as compte_credit
            FROM commandes_vente cv
            JOIN clients c ON cv.id_client = c.id
            LEFT JOIN utilisateurs u ON cv.cree_par = u.id
            WHERE cv.statut IN ('livree_complete', 'facturee', 'payee')
            AND cv.date_livraison_reelle IS NOT NULL
        `;
        const ventesParams = [];

        if (startDate) {
            ventesSql += ' AND cv.date_livraison_reelle >= ?';
            ventesParams.push(startDate);
        }

        if (endDate) {
            ventesSql += ' AND cv.date_livraison_reelle <= ?';
            ventesParams.push(endDate);
        }

        // 4. Achats (commandes achat livrées)
        const achatsSql = `
            SELECT 
                ca.id,
                'achat' as categorie,
                'entree' as type_mouvement,
                ca.date_livraison_reelle as date_operation,
                NULL as quantite,
                NULL as unite_mesure,
                'Achat' as raison,
                ca.numero_commande as commentaire,
                CONCAT('Fournisseur: ', f.nom_fournisseur, ' - ', ca.numero_commande) as description,
                u.nom_complet as effectue_par_nom,
                ca.montant_total as montant,
                'Achats/Stock' as compte_debit,
                'Fournisseurs' as compte_credit
            FROM commandes_achat ca
            JOIN fournisseurs f ON ca.id_fournisseur = f.id
            LEFT JOIN utilisateurs u ON ca.cree_par = u.id
            WHERE ca.statut IN ('livree_complete', 'facturee', 'payee')
            AND ca.date_livraison_reelle IS NOT NULL
        `;
        const achatsParams = [];

        if (startDate) {
            achatsSql += ' AND ca.date_livraison_reelle >= ?';
            achatsParams.push(startDate);
        }

        if (endDate) {
            achatsSql += ' AND ca.date_livraison_reelle <= ?';
            achatsParams.push(endDate);
        }

        // 5. Salaires
        const salairesSql = `
            SELECT 
                s.id,
                'salaire' as categorie,
                'sortie' as type_mouvement,
                s.date_paiement as date_operation,
                NULL as quantite,
                NULL as unite_mesure,
                'Salaire' as raison,
                CONCAT(s.mois, '/', s.annee) as commentaire,
                CONCAT('Salaire: ', u.nom_complet, ' - ', s.mois, '/', s.annee) as description,
                val.nom_complet as effectue_par_nom,
                s.salaire_net as montant,
                'Charges personnel' as compte_debit,
                'Banque/Caisse' as compte_credit
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            LEFT JOIN utilisateurs val ON s.valide_par = val.id
            WHERE s.statut_paiement = 'payé'
            AND s.date_paiement IS NOT NULL
        `;
        const salairesParams = [];

        if (startDate) {
            salairesSql += ' AND s.date_paiement >= ?';
            salairesParams.push(startDate);
        }

        if (endDate) {
            salairesSql += ' AND s.date_paiement <= ?';
            salairesParams.push(endDate);
        }

        // Exécuter toutes les requêtes
        const [stockMvts, paiementsMvts, ventesMvts, achatsMvts, salairesMvts] = await Promise.all([
            db.query(stockSql, stockParams),
            db.query(paiementsSql, paiementsParams),
            db.query(ventesSql, ventesParams),
            db.query(achatsSql, achatsParams),
            db.query(salairesSql, salairesParams)
        ]);

        // Fusionner tous les mouvements
        mouvements = [
            ...stockMvts,
            ...paiementsMvts,
            ...ventesMvts,
            ...achatsMvts,
            ...salairesMvts
        ];

        // Filtrer par catégorie si spécifié
        if (categorie) {
            mouvements = mouvements.filter(m => m.categorie === categorie);
        }

        // Filtrer par type de mouvement si spécifié
        if (type_mouvement) {
            mouvements = mouvements.filter(m => m.type_mouvement === type_mouvement);
        }

        // Trier par date (plus récent en premier)
        mouvements.sort((a, b) => new Date(b.date_operation) - new Date(a.date_operation));

        // Pagination
        const total = mouvements.length;
        const offset = (page - 1) * limit;
        const paginatedMouvements = mouvements.slice(offset, offset + parseInt(limit));

        // Calcul des totaux
        const totaux = mouvements.reduce((acc, m) => {
            if (m.montant) {
                if (m.type_mouvement === 'entree' || m.type_mouvement === 'recette') {
                    acc.entrees += parseFloat(m.montant);
                } else if (m.type_mouvement === 'sortie' || m.type_mouvement === 'depense') {
                    acc.sorties += parseFloat(m.montant);
                }
            }
            return acc;
        }, { entrees: 0, sorties: 0 });

        totaux.solde = totaux.entrees - totaux.sorties;

        res.status(200).json({
            success: true,
            data: {
                mouvements: paginatedMouvements,
                totaux: totaux,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Journal comptable error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du journal'
        });
    }
});

// =============================================
// GESTION DES IMPÔTS
// =============================================

// Créer une table pour les impôts si elle n'existe pas
router.post('/setup-impots-table', authenticate, authorize('admin'), async (req, res) => {
    try {
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS impots (
                id INT PRIMARY KEY AUTO_INCREMENT,
                type_impot ENUM('tva', 'ipr', 'im', 'taxe_municipale', 'autre') NOT NULL,
                periode_type ENUM('mensuel', 'trimestriel', 'annuel') NOT NULL,
                annee INT NOT NULL,
                periode INT NOT NULL COMMENT 'Mois ou Trimestre',
                
                -- Montants
                base_imposable DECIMAL(15,2) DEFAULT 0.00,
                taux_pourcent DECIMAL(5,2) NOT NULL,
                montant_calcule DECIMAL(15,2) GENERATED ALWAYS AS (base_imposable * taux_pourcent / 100) STORED,
                montant_paye DECIMAL(15,2) DEFAULT 0.00,
                montant_du DECIMAL(15,2) GENERATED ALWAYS AS (montant_calcule - montant_paye) STORED,
                
                -- Dates
                date_echeance DATE NOT NULL,
                date_paiement DATE DEFAULT NULL,
                
                -- Détails
                reference_declaration VARCHAR(100) DEFAULT NULL,
                reference_paiement VARCHAR(100) DEFAULT NULL,
                observations TEXT DEFAULT NULL,
                
                -- Pièces jointes
                declaration_pdf VARCHAR(255) DEFAULT NULL,
                recu_paiement VARCHAR(255) DEFAULT NULL,
                
                -- Statut
                statut ENUM('a_declarer', 'declare', 'a_payer', 'paye', 'en_retard') DEFAULT 'a_declarer',
                
                -- Traçabilité
                calcule_par INT DEFAULT NULL,
                date_calcul DATETIME DEFAULT NULL,
                valide_par INT DEFAULT NULL,
                date_validation DATETIME DEFAULT NULL,
                
                date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (calcule_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
                FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
                
                INDEX idx_type (type_impot),
                INDEX idx_periode (annee, periode),
                INDEX idx_statut (statut),
                INDEX idx_echeance (date_echeance)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        await db.query(createTableSql);

        res.status(200).json({
            success: true,
            message: 'Table des impôts créée avec succès'
        });
    } catch (error) {
        console.error('Setup impots table error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la table'
        });
    }
});

router.get('/impots', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            type_impot,
            annee,
            statut,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT 
                i.*,
                calc.nom_complet as calcule_par_nom,
                val.nom_complet as valide_par_nom
            FROM impots i
            LEFT JOIN utilisateurs calc ON i.calcule_par = calc.id
            LEFT JOIN utilisateurs val ON i.valide_par = val.id
            WHERE 1=1
        `;
        const params = [];

        if (type_impot) {
            sql += ' AND i.type_impot = ?';
            params.push(type_impot);
        }

        if (annee) {
            sql += ' AND i.annee = ?';
            params.push(annee);
        }

        if (statut) {
            sql += ' AND i.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY i.annee DESC, i.periode DESC';

        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const impots = await db.query(sql, params);

        // Count total
        let countSql = 'SELECT COUNT(*) as total FROM impots WHERE 1=1';
        const countParams = [];

        if (type_impot) {
            countSql += ' AND type_impot = ?';
            countParams.push(type_impot);
        }

        if (annee) {
            countSql += ' AND annee = ?';
            countParams.push(annee);
        }

        const [countResult] = await db.query(countSql, countParams);

        // Totaux
        const totauxSql = `
            SELECT 
                SUM(montant_calcule) as total_calcule,
                SUM(montant_paye) as total_paye,
                SUM(montant_du) as total_du,
                SUM(CASE WHEN statut = 'en_retard' THEN montant_du ELSE 0 END) as retard
            FROM impots
            WHERE annee = ?
        `;
        const [totaux] = await db.query(totauxSql, [annee || new Date().getFullYear()]);

        res.status(200).json({
            success: true,
            data: {
                impots: impots,
                totaux: totaux,
                pagination: {
                    total: countResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(countResult.total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get impots error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des impôts'
        });
    }
});

router.post('/impots/calculer', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const {
            type_impot,
            periode_type,
            annee,
            periode,
            taux_pourcent
        } = req.body;

        // Validation
        if (!type_impot || !periode_type || !annee || !periode || !taux_pourcent) {
            return res.status(400).json({
                success: false,
                message: 'Informations incomplètes'
            });
        }

        let base_imposable = 0;
        let date_echeance;

        // Calcul de la base imposable selon le type d'impôt
        if (type_impot === 'tva') {
            // TVA sur les ventes
            const startDate = new Date(annee, periode - 1, 1);
            const endDate = new Date(annee, periode, 0);

            const ventesSQL = `
                SELECT SUM(montant_ht) as total_ventes
                FROM commandes_vente
                WHERE date_commande BETWEEN ? AND ?
                AND statut IN ('facturee', 'payee')
            `;
            const [ventes] = await db.query(ventesSQL, [startDate, endDate]);
            base_imposable = ventes.total_ventes || 0;

            // Échéance TVA: 15 du mois suivant
            date_echeance = new Date(annee, periode, 15);

        } else if (type_impot === 'ipr') {
            // Impôt sur les revenus professionnels
            const salairesSql = `
                SELECT SUM(salaire_brut) as total_salaires
                FROM salaires
                WHERE mois = ? AND annee = ?
            `;
            const [salaires] = await db.query(salairesSql, [periode, annee]);
            base_imposable = salaires.total_salaires || 0;

            date_echeance = new Date(annee, periode, 15);

        } else if (type_impot === 'im') {
            // Impôt mobilier (sur les revenus)
            const ventesSQL = `
                SELECT SUM(montant_total) as total_revenus
                FROM commandes_vente
                WHERE YEAR(date_commande) = ? 
                AND statut IN ('facturee', 'payee')
            `;
            const [revenus] = await db.query(ventesSQL, [annee]);
            base_imposable = revenus.total_revenus || 0;

            date_echeance = new Date(annee, 11, 31); // 31 décembre
        }

        // Vérifier si l'impôt existe déjà
        const existingSql = `
            SELECT id FROM impots 
            WHERE type_impot = ? 
            AND annee = ? 
            AND periode = ?
        `;
        const [existing] = await db.query(existingSql, [type_impot, annee, periode]);

        if (existing) {
            // Mettre à jour
            await db.query(`
                UPDATE impots 
                SET base_imposable = ?,
                    taux_pourcent = ?,
                    calcule_par = ?,
                    date_calcul = NOW()
                WHERE id = ?
            `, [base_imposable, taux_pourcent, req.userId, existing.id]);

            res.status(200).json({
                success: true,
                message: 'Impôt mis à jour avec succès',
                data: {
                    id: existing.id,
                    base_imposable,
                    montant_calcule: base_imposable * taux_pourcent / 100
                }
            });
        } else {
            // Créer nouveau
            const insertSql = `
                INSERT INTO impots (
                    type_impot, periode_type, annee, periode,
                    base_imposable, taux_pourcent, date_echeance,
                    calcule_par, date_calcul
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const result = await db.query(insertSql, [
                type_impot,
                periode_type,
                annee,
                periode,
                base_imposable,
                taux_pourcent,
                date_echeance,
                req.userId
            ]);

            res.status(201).json({
                success: true,
                message: 'Impôt calculé avec succès',
                data: {
                    id: result.insertId,
                    base_imposable,
                    montant_calcule: base_imposable * taux_pourcent / 100
                }
            });
        }
    } catch (error) {
        console.error('Calculer impot error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul de l\'impôt'
        });
    }
});

router.post('/impots/:id/payer', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const impotId = parseInt(req.params.id);
        const {
            montant_paye,
            date_paiement,
            reference_paiement,
            recu_paiement
        } = req.body;

        if (!montant_paye || !date_paiement || !reference_paiement) {
            return res.status(400).json({
                success: false,
                message: 'Informations de paiement incomplètes'
            });
        }

        // Mettre à jour l'impôt
        await db.query(`
            UPDATE impots 
            SET montant_paye = montant_paye + ?,
                date_paiement = ?,
                reference_paiement = ?,
                recu_paiement = ?,
                statut = CASE 
                    WHEN montant_paye + ? >= montant_calcule THEN 'paye'
                    ELSE 'a_payer'
                END,
                valide_par = ?,
                date_validation = NOW()
            WHERE id = ?
        `, [
            montant_paye,
            date_paiement,
            reference_paiement,
            recu_paiement,
            montant_paye,
            req.userId,
            impotId
        ]);

        // Enregistrer le paiement
        const impotSql = `SELECT type_impot, annee, periode FROM impots WHERE id = ?`;
        const [impot] = await db.query(impotSql, [impotId]);

        await db.query(`
            INSERT INTO paiements (
                reference_paiement, type_paiement, source_type,
                id_source, montant, mode_paiement, date_paiement,
                description, valide_par, statut
            ) VALUES (?, 'depense', 'impot', ?, ?, 'virement', ?, ?, ?, 'valide')
        `, [
            reference_paiement,
            impotId,
            montant_paye,
            date_paiement,
            `Paiement impôt ${impot.type_impot} - ${impot.periode}/${impot.annee}`,
            req.userId
        ]);

        res.status(200).json({
            success: true,
            message: 'Paiement d\'impôt enregistré avec succès'
        });
    } catch (error) {
        console.error('Payer impot error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du paiement'
        });
    }
});

// =============================================
// CLÔTURE MENSUELLE
// =============================================

router.post('/cloture-mensuelle', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const { mois, annee } = req.body;

        if (!mois || !annee) {
            return res.status(400).json({
                success: false,
                message: 'Mois et année requis'
            });
        }

        // Vérifier si la clôture existe déjà
        const existingSql = `
            SELECT id FROM clotures_mensuelles 
            WHERE mois = ? AND annee = ?
        `;
        const [existing] = await db.query(existingSql, [mois, annee]);

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'La clôture pour cette période existe déjà'
            });
        }

        const startDate = new Date(annee, mois - 1, 1);
        const endDate = new Date(annee, mois, 0);

        // Calculer tous les totaux
        // 1. Chiffre d'affaires
        const caSql = `
            SELECT COALESCE(SUM(montant_total), 0) as ca
            FROM commandes_vente
            WHERE date_commande BETWEEN ? AND ?
            AND statut IN ('facturee', 'payee')
        `;
        const [ca] = await db.query(caSql, [startDate, endDate]);

        // 2. Achats
        const achatsSql = `
            SELECT COALESCE(SUM(montant_total), 0) as achats
            FROM commandes_achat
            WHERE date_commande BETWEEN ? AND ?
            AND statut IN ('facturee', 'payee')
        `;
        const [achats] = await db.query(achatsSql, [startDate, endDate]);

        // 3. Charges de personnel
        const salairesSql = `
            SELECT COALESCE(SUM(salaire_net), 0) as salaires
            FROM salaires
            WHERE mois = ? AND annee = ?
        `;
        const [salaires] = await db.query(salairesSql, [mois, annee]);

        // 4. Autres charges
        const chargesSql = `
            SELECT COALESCE(SUM(montant), 0) as autres_charges
            FROM paiements
            WHERE date_paiement BETWEEN ? AND ?
            AND type_paiement = 'depense'
            AND source_type NOT IN ('fournisseur', 'employe')
            AND statut = 'valide'
        `;
        const [charges] = await db.query(chargesSql, [startDate, endDate]);

        // 5. Recettes
        const recettesSql = `
            SELECT COALESCE(SUM(montant), 0) as recettes
            FROM paiements
            WHERE date_paiement BETWEEN ? AND ?
            AND type_paiement = 'recette'
            AND statut = 'valide'
        `;
        const [recettes] = await db.query(recettesSql, [startDate, endDate]);

        // 6. Trésorerie
        const tresorerieSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE 0 END), 0) as entrees,
                COALESCE(SUM(CASE WHEN type_paiement = 'depense' THEN montant ELSE 0 END), 0) as sorties
            FROM paiements
            WHERE date_paiement BETWEEN ? AND ?
            AND statut = 'valide'
        `;
        const [tresorerie] = await db.query(tresorerieSql, [startDate, endDate]);

        // 7. Créances
        const creancesSql = `
            SELECT COALESCE(SUM(montant_du), 0) as creances
            FROM factures
            WHERE type_facture = 'vente'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
            AND date_facture <= ?
        `;
        const [creances] = await db.query(creancesSql, [endDate]);

        // 8. Dettes
        const dettesSql = `
            SELECT COALESCE(SUM(montant_du), 0) as dettes
            FROM factures
            WHERE type_facture = 'achat'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
            AND date_facture <= ?
        `;
        const [dettes] = await db.query(dettesSql, [endDate]);

        // Créer la table de clôture si elle n'existe pas
        await db.query(`
            CREATE TABLE IF NOT EXISTS clotures_mensuelles (
                id INT PRIMARY KEY AUTO_INCREMENT,
                mois INT NOT NULL,
                annee INT NOT NULL,
                
                -- Résultats
                chiffre_affaires DECIMAL(15,2) DEFAULT 0.00,
                total_achats DECIMAL(15,2) DEFAULT 0.00,
                charges_personnel DECIMAL(15,2) DEFAULT 0.00,
                autres_charges DECIMAL(15,2) DEFAULT 0.00,
                total_charges DECIMAL(15,2) GENERATED ALWAYS AS (
                    total_achats + charges_personnel + autres_charges
                ) STORED,
                resultat_brut DECIMAL(15,2) GENERATED ALWAYS AS (
                    chiffre_affaires - total_charges
                ) STORED,
                
                -- Trésorerie
                tresorerie_entrees DECIMAL(15,2) DEFAULT 0.00,
                tresorerie_sorties DECIMAL(15,2) DEFAULT 0.00,
                variation_tresorerie DECIMAL(15,2) GENERATED ALWAYS AS (
                    tresorerie_entrees - tresorerie_sorties
                ) STORED,
                
                -- Créances et dettes
                creances_clients DECIMAL(15,2) DEFAULT 0.00,
                dettes_fournisseurs DECIMAL(15,2) DEFAULT 0.00,
                
                -- Statut
                statut ENUM('ouverte', 'validee', 'cloturee') DEFAULT 'ouverte',
                date_validation DATE DEFAULT NULL,
                date_cloture DATE DEFAULT NULL,
                
                -- Observations
                observations TEXT DEFAULT NULL,
                
                -- Traçabilité
                cree_par INT NOT NULL,
                date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                valide_par INT DEFAULT NULL,
                cloture_par INT DEFAULT NULL,
                
                FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE RESTRICT,
                FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
                FOREIGN KEY (cloture_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
                
                UNIQUE KEY uk_periode (mois, annee),
                INDEX idx_statut (statut),
                INDEX idx_annee (annee)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Insérer la clôture
        const insertSql = `
            INSERT INTO clotures_mensuelles (
                mois, annee, chiffre_affaires, total_achats,
                charges_personnel, autres_charges, tresorerie_entrees,
                tresorerie_sorties, creances_clients, dettes_fournisseurs,
                cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(insertSql, [
            mois,
            annee,
            ca.ca,
            achats.achats,
            salaires.salaires,
            charges.autres_charges,
            tresorerie.entrees,
            tresorerie.sorties,
            creances.creances,
            dettes.dettes,
            req.userId
        ]);

        res.status(201).json({
            success: true,
            message: 'Clôture mensuelle créée avec succès',
            data: {
                id: result.insertId,
                mois,
                annee,
                chiffre_affaires: ca.ca,
                resultat_brut: ca.ca - (achats.achats + salaires.salaires + charges.autres_charges),
                variation_tresorerie: tresorerie.entrees - tresorerie.sorties
            }
        });
    } catch (error) {
        console.error('Clôture mensuelle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la clôture mensuelle'
        });
    }
});

router.get('/clotures-mensuelles', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const { annee, statut } = req.query;

        let sql = `
            SELECT 
                cm.*,
                cree.nom_complet as cree_par_nom,
                val.nom_complet as valide_par_nom,
                clot.nom_complet as cloture_par_nom
            FROM clotures_mensuelles cm
            LEFT JOIN utilisateurs cree ON cm.cree_par = cree.id
            LEFT JOIN utilisateurs val ON cm.valide_par = val.id
            LEFT JOIN utilisateurs clot ON cm.cloture_par = clot.id
            WHERE 1=1
        `;
        const params = [];

        if (annee) {
            sql += ' AND cm.annee = ?';
            params.push(annee);
        }

        if (statut) {
            sql += ' AND cm.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY cm.annee DESC, cm.mois DESC';

        const clotures = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: clotures
        });
    } catch (error) {
        console.error('Get clotures error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des clôtures'
        });
    }
});

router.post('/clotures-mensuelles/:id/valider', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const clotureId = parseInt(req.params.id);

        await db.query(`
            UPDATE clotures_mensuelles 
            SET statut = 'validee',
                date_validation = CURDATE(),
                valide_par = ?
            WHERE id = ?
            AND statut = 'ouverte'
        `, [req.userId, clotureId]);

        res.status(200).json({
            success: true,
            message: 'Clôture validée avec succès'
        });
    } catch (error) {
        console.error('Valider cloture error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation'
        });
    }
});

router.post('/clotures-mensuelles/:id/cloturer', authenticate, authorize('admin'), async (req, res) => {
    try {
        const clotureId = parseInt(req.params.id);

        await db.query(`
            UPDATE clotures_mensuelles 
            SET statut = 'cloturee',
                date_cloture = CURDATE(),
                cloture_par = ?
            WHERE id = ?
            AND statut = 'validee'
        `, [req.userId, clotureId]);

        res.status(200).json({
            success: true,
            message: 'Clôture finalisée avec succès'
        });
    } catch (error) {
        console.error('Cloturer error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la clôture finale'
        });
    }
});

// Helper function
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'BIF'
    }).format(amount);
}

module.exports = router;