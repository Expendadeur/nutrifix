// backend/routes/comptabilite/dashboard.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../../database/db');

// =============================================
// DASHBOARD COMPTABLE PRINCIPAL
// =============================================

router.get('/dashboard', authenticate, authorize('admin', 'comptable', 'manager'), async (req, res) => {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0);

        // ========== TRÉSORERIE ==========
        const tresorerieSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE 0 END), 0) as total_recettes,
                COALESCE(SUM(CASE WHEN type_paiement = 'depense' THEN montant ELSE 0 END), 0) as total_depenses,
                COALESCE(SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE -montant END), 0) as solde_tresorerie
            FROM paiements
            WHERE statut = 'valide'
            AND MONTH(date_paiement) = ?
            AND YEAR(date_paiement) = ?
        `;
        const [tresorerie] = await db.query(tresorerieSql, [currentMonth, currentYear]);

        // Calcul variation par rapport au mois précédent
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        
        const tresorerieLastMonthSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE -montant END), 0) as solde_last_month
            FROM paiements
            WHERE statut = 'valide'
            AND MONTH(date_paiement) = ?
            AND YEAR(date_paiement) = ?
        `;
        const [tresorerieLastMonth] = await db.query(tresorerieLastMonthSql, [lastMonth, lastMonthYear]);
        
        const variation = tresorerieLastMonth.solde_last_month !== 0 
            ? ((tresorerie.solde_tresorerie - tresorerieLastMonth.solde_last_month) / Math.abs(tresorerieLastMonth.solde_last_month)) * 100
            : 0;

        tresorerie.variation = parseFloat(variation.toFixed(2));

        // ========== CRÉANCES CLIENTS ==========
        const creancesSql = `
            SELECT 
                COUNT(*) as nombre_factures_impayees,
                COALESCE(SUM(montant_du), 0) as total_creances,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(CURDATE(), date_echeance) > 0 THEN montant_du 
                    ELSE 0 
                END), 0) as creances_echues,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(date_echeance, CURDATE()) BETWEEN 0 AND 30 THEN montant_du 
                    ELSE 0 
                END), 0) as creances_30j,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(date_echeance, CURDATE()) BETWEEN 31 AND 60 THEN montant_du 
                    ELSE 0 
                END), 0) as creances_60j,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(date_echeance, CURDATE()) > 60 THEN montant_du 
                    ELSE 0 
                END), 0) as creances_plus_60j
            FROM factures
            WHERE type_facture = 'vente'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const [creances] = await db.query(creancesSql);

        // ========== DETTES FOURNISSEURS ==========
        const dettesSql = `
            SELECT 
                COUNT(*) as nombre_factures_a_payer,
                COALESCE(SUM(montant_du), 0) as total_dettes,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(CURDATE(), date_echeance) > 0 THEN montant_du 
                    ELSE 0 
                END), 0) as dettes_echues,
                COALESCE(SUM(CASE 
                    WHEN DATEDIFF(date_echeance, CURDATE()) BETWEEN 0 AND 30 THEN montant_du 
                    ELSE 0 
                END), 0) as dettes_30j
            FROM factures
            WHERE type_facture = 'achat'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `;
        const [dettes] = await db.query(dettesSql);

        // ========== RAPPROCHEMENTS ==========
        const rapprochementsSql = `
            SELECT 
                COUNT(*) as paiements_non_rapproches,
                COALESCE(SUM(montant), 0) as montant_non_rapproche
            FROM paiements
            WHERE rapproche = 0
            AND statut = 'valide'
        `;
        const [rapprochements] = await db.query(rapprochementsSql);

        // ========== ÉCRITURES COMPTABLES ==========
        const ecrituresSql = `
            SELECT 
                COUNT(*) as nombre_ecritures,
                SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN 1 ELSE 0 END) as entrees,
                SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN 1 ELSE 0 END) as sorties
            FROM mouvements_stock
            WHERE MONTH(date_mouvement) = ?
            AND YEAR(date_mouvement) = ?
        `;
        const [ecritures] = await db.query(ecrituresSql, [currentMonth, currentYear]);

        // ========== ALERTES ==========
        const alertes = [];
        
        // Créances échues
        if (parseFloat(creances.creances_echues) > 0) {
            const countEchuesSql = `
                SELECT COUNT(*) as count 
                FROM factures 
                WHERE type_facture = 'vente'
                AND statut_paiement IN ('impayee', 'partiellement_payee')
                AND DATEDIFF(CURDATE(), date_echeance) > 0
            `;
            const [countEchues] = await db.query(countEchuesSql);
            
            alertes.push({
                type: 'creances_echues',
                niveau: 'urgent',
                titre: 'Créances échues',
                message: `${countEchues.count} facture(s) échue(s) pour ${formatCurrency(creances.creances_echues)}`,
                montant: parseFloat(creances.creances_echues),
                count: countEchues.count
            });
        }

        // Dettes échues
        if (parseFloat(dettes.dettes_echues) > 0) {
            const countDettesEchuesSql = `
                SELECT COUNT(*) as count 
                FROM factures 
                WHERE type_facture = 'achat'
                AND statut_paiement IN ('impayee', 'partiellement_payee')
                AND DATEDIFF(CURDATE(), date_echeance) > 0
            `;
            const [countDettesEchues] = await db.query(countDettesEchuesSql);
            
            alertes.push({
                type: 'dettes_echues',
                niveau: 'urgent',
                titre: 'Dettes échues',
                message: `${countDettesEchues.count} facture(s) fournisseur(s) échue(s)`,
                montant: parseFloat(dettes.dettes_echues),
                count: countDettesEchues.count
            });
        }

        // Rapprochements en attente
        if (rapprochements.paiements_non_rapproches > 0) {
            alertes.push({
                type: 'rapprochement',
                niveau: 'warning',
                titre: 'Rapprochements en attente',
                message: `${rapprochements.paiements_non_rapproches} paiement(s) à rapprocher`,
                montant: parseFloat(rapprochements.montant_non_rapproche),
                count: rapprochements.paiements_non_rapproches
            });
        }

        // Alerte trésorerie faible (< 10% du CA moyen mensuel)
        const caMoyenSql = `
            SELECT COALESCE(AVG(montant_total), 0) as ca_moyen
            FROM commandes_vente
            WHERE statut IN ('facturee', 'payee')
            AND date_commande >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        `;
        const [caMoyen] = await db.query(caMoyenSql);
        
        if (parseFloat(tresorerie.solde_tresorerie) < (parseFloat(caMoyen.ca_moyen) * 0.1)) {
            alertes.push({
                type: 'low_cash',
                niveau: 'warning',
                titre: 'Trésorerie faible',
                message: 'Niveau de trésorerie inférieur au seuil recommandé',
                montant: parseFloat(tresorerie.solde_tresorerie),
                count: 1
            });
        }

        // ========== TRANSACTIONS RÉCENTES ==========
        const transactionsSql = `
            SELECT 
                p.id,
                p.date_paiement,
                p.type_paiement,
                p.montant,
                p.mode_paiement,
                CASE 
                    WHEN p.source_type = 'client' THEN CONCAT('Client: ', c.nom_client)
                    WHEN p.source_type = 'fournisseur' THEN CONCAT('Fournisseur: ', f.nom_fournisseur)
                    WHEN p.source_type = 'employe' THEN CONCAT('Employé: ', u.nom_complet)
                    ELSE p.description
                END as source_nom,
                fact.numero_facture
            FROM paiements p
            LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
            LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
            LEFT JOIN utilisateurs u ON p.source_type = 'employe' AND p.id_source = u.id
            LEFT JOIN factures fact ON p.id_facture = fact.id
            WHERE p.statut = 'valide'
            AND MONTH(p.date_paiement) = ?
            AND YEAR(p.date_paiement) = ?
            ORDER BY p.date_paiement DESC, p.date_creation DESC
            LIMIT 10
        `;
        const transactions = await db.query(transactionsSql, [currentMonth, currentYear]);

        // ========== ÉVOLUTION TRÉSORERIE (6 derniers mois) ==========
        const evolutionSql = `
            SELECT 
                DATE_FORMAT(p.date_paiement, '%b') as mois,
                COALESCE(SUM(CASE WHEN p.type_paiement = 'recette' THEN p.montant ELSE 0 END), 0) as recettes,
                COALESCE(SUM(CASE WHEN p.type_paiement = 'depense' THEN p.montant ELSE 0 END), 0) as depenses
            FROM paiements p
            WHERE p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
            AND p.statut = 'valide'
            GROUP BY YEAR(p.date_paiement), MONTH(p.date_paiement)
            ORDER BY YEAR(p.date_paiement), MONTH(p.date_paiement)
        `;
        const evolution_tresorerie = await db.query(evolutionSql);

        // ========== RÉPARTITION DES DÉPENSES ==========
        const depensesSql = `
            SELECT 
                'Achats' as categorie,
                COALESCE(SUM(montant_total), 0) as montant
            FROM commandes_achat
            WHERE statut IN ('facturee', 'payee')
            AND MONTH(date_commande) = ?
            AND YEAR(date_commande) = ?
            
            UNION ALL
            
            SELECT 
                'Salaires' as categorie,
                COALESCE(SUM(salaire_net), 0) as montant
            FROM salaires
            WHERE mois = ?
            AND annee = ?
            AND statut_paiement = 'payé'
            
            UNION ALL
            
            SELECT 
                'Charges' as categorie,
                COALESCE(SUM(montant), 0) as montant
            FROM paiements
            WHERE type_paiement = 'depense'
            AND source_type NOT IN ('fournisseur', 'employe')
            AND MONTH(date_paiement) = ?
            AND YEAR(date_paiement) = ?
            AND statut = 'valide'
        `;
        const depensesRaw = await db.query(depensesSql, [
            currentMonth, currentYear, 
            currentMonth, currentYear,
            currentMonth, currentYear
        ]);

        // Calculer les pourcentages
        const totalDepenses = depensesRaw.reduce((sum, d) => sum + parseFloat(d.montant), 0);
        const repartition_depenses = depensesRaw.map(d => ({
            categorie: d.categorie,
            montant: parseFloat(d.montant),
            pourcentage: totalDepenses > 0 ? (parseFloat(d.montant) / totalDepenses) * 100 : 0
        }));

        // Ajouter catégorie "Autres" si nécessaire
        const sommePourcentages = repartition_depenses.reduce((sum, d) => sum + d.pourcentage, 0);
        if (sommePourcentages < 100 && totalDepenses > 0) {
            const autresMontant = totalDepenses - repartition_depenses.reduce((sum, d) => sum + d.montant, 0);
            if (autresMontant > 0) {
                repartition_depenses.push({
                    categorie: 'Autres',
                    montant: autresMontant,
                    pourcentage: 100 - sommePourcentages
                });
            }
        }

        // ========== TOP CLIENTS ==========
        const topClientsSql = `
            SELECT 
                c.nom_client as nom,
                COALESCE(SUM(cv.montant_total), 0) as montant,
                COUNT(cv.id) as factures
            FROM clients c
            LEFT JOIN commandes_vente cv ON c.id = cv.id_client
            WHERE cv.date_commande >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            AND cv.statut IN ('facturee', 'payee')
            GROUP BY c.id, c.nom_client
            ORDER BY montant DESC
            LIMIT 5
        `;
        const top_clients = await db.query(topClientsSql);

        // ========== INDICATEURS DE PERFORMANCE ==========
        
        // Délai de paiement moyen
        const delaiPaiementSql = `
            SELECT 
                AVG(DATEDIFF(date_dernier_paiement, date_facture)) as delai_moyen
            FROM factures
            WHERE type_facture = 'vente'
            AND statut_paiement = 'payee'
            AND date_dernier_paiement IS NOT NULL
            AND date_facture >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        `;
        const [delaiPaiement] = await db.query(delaiPaiementSql);

        // Taux de recouvrement
        const tauxRecouvrementSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN statut_paiement = 'payee' THEN montant_ttc ELSE 0 END), 0) as paye,
                COALESCE(SUM(montant_ttc), 1) as total
            FROM factures
            WHERE type_facture = 'vente'
            AND date_facture >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        `;
        const [tauxRecouvrement] = await db.query(tauxRecouvrementSql);

        const indicateurs_performance = {
            delai_paiement_moyen: Math.round(parseFloat(delaiPaiement.delai_moyen) || 0),
            taux_recouvrement: parseFloat(((parseFloat(tauxRecouvrement.paye) / parseFloat(tauxRecouvrement.total)) * 100).toFixed(2)),
            ratio_liquidite: parseFloat((parseFloat(tresorerie.solde_tresorerie) / (parseFloat(dettes.total_dettes) || 1)).toFixed(2)),
            rotation_stock: 0 // À calculer si nécessaire
        };

        // ========== RESPONSE ==========
        res.status(200).json({
            success: true,
            data: {
                periode: {
                    mois: currentMonth,
                    annee: currentYear
                },
                tresorerie,
                creances,
                dettes,
                rapprochements,
                ecritures,
                alertes,
                transactions,
                evolution_tresorerie,
                repartition_depenses,
                top_clients,
                indicateurs_performance
            }
        });

    } catch (error) {
        console.error('Dashboard comptable error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard',
            error: error.message
        });
    }
});

// =============================================
// ENDPOINT POUR KPI UNIQUEMENT
// =============================================
router.get('/dashboard/kpi', authenticate, authorize('admin', 'comptable'), async (req, res) => {
    try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Trésorerie
        const [tresorerie] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE -montant END), 0) as solde
            FROM paiements
            WHERE statut = 'valide'
            AND MONTH(date_paiement) = ?
            AND YEAR(date_paiement) = ?
        `, [currentMonth, currentYear]);

        // Créances
        const [creances] = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant_du), 0) as total
            FROM factures
            WHERE type_facture = 'vente'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `);

        // Dettes
        const [dettes] = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant_du), 0) as total
            FROM factures
            WHERE type_facture = 'achat'
            AND statut_paiement IN ('impayee', 'partiellement_payee')
        `);

        // Rapprochements
        const [rapprochements] = await db.query(`
            SELECT 
                COUNT(*) as nombre,
                COALESCE(SUM(montant), 0) as total
            FROM paiements
            WHERE rapproche = 0
            AND statut = 'valide'
        `);

        res.status(200).json({
            success: true,
            data: {
                tresorerie: parseFloat(tresorerie.solde),
                creances: {
                    nombre: creances.nombre,
                    montant: parseFloat(creances.total)
                },
                dettes: {
                    nombre: dettes.nombre,
                    montant: parseFloat(dettes.total)
                },
                rapprochements: {
                    nombre: rapprochements.nombre,
                    montant: parseFloat(rapprochements.total)
                }
            }
        });

    } catch (error) {
        console.error('KPI error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des KPI'
        });
    }
});

// Helper function
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'BIF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

module.exports = router;