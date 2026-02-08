// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// ============================================
// MIDDLEWARE DE VALIDATION
// ============================================
const validatePeriod = (req, res, next) => {
    const validPeriods = ['day', 'week', 'month', 'year'];
    const { period = 'month' } = req.query;

    if (!validPeriods.includes(period)) {
        return res.status(400).json({
            success: false,
            message: `Période invalide. Valeurs acceptées: ${validPeriods.join(', ')}`
        });
    }

    req.validatedPeriod = period;
    next();
};

// ============================================
// UTILITAIRES DE DATES
// ============================================
const getDateFilters = (period) => {
    const filters = {
        current: {},
        previous: {}
    };

    const now = new Date();

    switch (period) {
        case 'day':
            filters.current.start = new Date(now.setHours(0, 0, 0, 0));
            filters.current.end = new Date(now.setHours(23, 59, 59, 999));

            const yesterday = new Date(filters.current.start);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.previous.start = new Date(yesterday.setHours(0, 0, 0, 0));
            filters.previous.end = new Date(yesterday.setHours(23, 59, 59, 999));
            break;

        case 'week':
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            filters.current.start = new Date(now.setDate(now.getDate() + diffToMonday));
            filters.current.start.setHours(0, 0, 0, 0);
            filters.current.end = new Date(filters.current.start);
            filters.current.end.setDate(filters.current.end.getDate() + 6);
            filters.current.end.setHours(23, 59, 59, 999);

            filters.previous.start = new Date(filters.current.start);
            filters.previous.start.setDate(filters.previous.start.getDate() - 7);
            filters.previous.end = new Date(filters.previous.start);
            filters.previous.end.setDate(filters.previous.end.getDate() + 6);
            filters.previous.end.setHours(23, 59, 59, 999);
            break;

        case 'year':
            filters.current.start = new Date(now.getFullYear(), 0, 1);
            filters.current.end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            filters.previous.start = new Date(now.getFullYear() - 1, 0, 1);
            filters.previous.end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;

        default: // month
            filters.current.start = new Date(now.getFullYear(), now.getMonth(), 1);
            filters.current.end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            filters.previous.start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            filters.previous.end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    return filters;
};

// ============================================
// FONCTIONS DE RÉCUPÉRATION DES DONNÉES
// ============================================

/**
 * Récupère les KPIs principaux
 */
async function getKPIs(dateFilters) {
    try {
        const formatDate = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        const currentStart = formatDate(dateFilters.current.start);
        const currentEnd = formatDate(dateFilters.current.end);
        const previousStart = formatDate(dateFilters.previous.start);
        const previousEnd = formatDate(dateFilters.previous.end);

        // ============================================
        // CHIFFRE D'AFFAIRES
        // ============================================
        const caResults = await db.query(`
            SELECT 
                COALESCE(SUM(CASE 
                    WHEN date_commande BETWEEN ? AND ? 
                    THEN montant_total ELSE 0 
                END), 0) as ca_actuel,
                COALESCE(SUM(CASE 
                    WHEN date_commande BETWEEN ? AND ? 
                    THEN montant_total ELSE 0 
                END), 0) as ca_precedent
            FROM commandes_vente
            WHERE statut IN ('livree_complete', 'facturee', 'payee')
        `, [currentStart, currentEnd, previousStart, previousEnd]);

        const caData = Array.isArray(caResults) ? caResults[0] : caResults;
        const ca_actuel = parseFloat(caData?.ca_actuel || 0);
        const ca_precedent = parseFloat(caData?.ca_precedent || 0);
        const ca_tendance = ca_precedent > 0
            ? parseFloat(((ca_actuel - ca_precedent) / ca_precedent * 100).toFixed(1))
            : 0;

        console.log('💰 CA:', { ca_actuel, ca_precedent, ca_tendance });

        // ============================================
        // BÉNÉFICE NET
        // ============================================
        const beneficeResults = await db.query(`
            SELECT 
                COALESCE(SUM(CASE 
                    WHEN type_mouvement IN ('entree', 'recette') 
                    AND date_operation BETWEEN ? AND ? 
                    THEN montant ELSE 0 
                END), 0) as recettes,
                COALESCE(SUM(CASE 
                    WHEN type_mouvement IN ('sortie', 'depense') 
                    AND date_operation BETWEEN ? AND ? 
                    THEN montant ELSE 0 
                END), 0) as depenses
            FROM journal_comptable
            WHERE statut = 'valide'
        `, [currentStart, currentEnd, currentStart, currentEnd]);

        const beneficeData = Array.isArray(beneficeResults) ? beneficeResults[0] : beneficeResults;
        const recettes = parseFloat(beneficeData?.recettes || 0);
        const depenses = parseFloat(beneficeData?.depenses || 0);
        const benefice = recettes - depenses;

        console.log('📊 Bénéfice:', { recettes, depenses, benefice });

        // ============================================
        // EMPLOYÉS
        // ============================================
        const employesResults = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as actifs
            FROM utilisateurs
            WHERE role IN ('employe', 'manager', 'comptable', 'veterinaire', 'chauffeur', 'agriculteur', 'technicien')
        `);

        const employesData = Array.isArray(employesResults) ? employesResults[0] : employesResults;
        const employes = {
            total: parseInt(employesData?.total || 0),
            actifs: parseInt(employesData?.actifs || 0)
        };

        console.log('👥 Employés:', employes);

        // ============================================
        // VÉHICULES
        // ============================================
        const vehiculesResults = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as actifs,
                SUM(CASE WHEN disponible = 1 AND statut = 'actif' THEN 1 ELSE 0 END) as disponibles
            FROM vehicules
        `);

        const vehiculesData = Array.isArray(vehiculesResults) ? vehiculesResults[0] : vehiculesResults;
        const vehicules = {
            total: parseInt(vehiculesData?.total || 0),
            actifs: parseInt(vehiculesData?.actifs || 0),
            disponibles: parseInt(vehiculesData?.disponibles || 0)
        };

        console.log('🚗 Véhicules:', vehicules);

        // ============================================
        // ANIMAUX
        // ============================================
        const animauxResults = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'vivant' THEN 1 ELSE 0 END) as vivants
            FROM animaux
        `);

        const animauxData = Array.isArray(animauxResults) ? animauxResults[0] : animauxResults;
        const animaux = {
            total: parseInt(animauxData?.total || 0),
            vivants: parseInt(animauxData?.vivants || 0)
        };

        console.log('🐄 Animaux:', animaux);

        // ============================================
        // COMMANDES
        // ============================================
        const commandesResults = await db.query(`
            SELECT 
                COUNT(CASE WHEN statut IN ('brouillon', 'confirmee', 'en_preparation') THEN 1 END) as en_cours,
                COUNT(CASE WHEN statut = 'livree_complete' 
                    AND date_commande BETWEEN ? AND ? THEN 1 END) as livrees
            FROM commandes_vente
        `, [currentStart, currentEnd]);

        const commandesData = Array.isArray(commandesResults) ? commandesResults[0] : commandesResults;
        const commandes = {
            en_cours: parseInt(commandesData?.en_cours || 0),
            livrees: parseInt(commandesData?.livrees || 0)
        };

        console.log('📦 Commandes:', commandes);

        // ============================================
        // RETOUR
        // ============================================
        return {
            chiffre_affaires: {
                valeur: ca_actuel,
                tendance: ca_tendance,
                evolution: ca_tendance >= 0 ? 'hausse' : 'baisse',
                precedent: ca_precedent
            },
            benefice_net: {
                valeur: benefice,
                recettes: recettes,
                depenses: depenses,
                evolution: benefice >= 0 ? 'positif' : 'negatif',
                tendance: 0
            },
            employes: employes,
            vehicules: vehicules,
            animaux: animaux,
            commandes: commandes
        };
    } catch (error) {
        console.error('❌ Erreur getKPIs:', error);
        throw error;
    }
}

/**
 * Récupère les alertes critiques
 */
async function getAlerts() {
    try {
        const alerts = [];

        // ============================================
        // MAINTENANCES VÉHICULES
        // ============================================
        const maintenancesResult = await db.query(`
            SELECT 
                v.immatriculation,
                v.marque,
                v.modele,
                m.type_maintenance,
                m.date_prochaine_maintenance as date_echeance,
                DATEDIFF(m.date_prochaine_maintenance, NOW()) as jours_restants
            FROM maintenances_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE m.statut = 'planifie'
            AND m.date_prochaine_maintenance <= DATE_ADD(NOW(), INTERVAL 7 DAY)
            AND m.date_prochaine_maintenance >= NOW()
            ORDER BY m.date_prochaine_maintenance ASC
            LIMIT 5
        `);

        const maintenances = Array.isArray(maintenancesResult) ? maintenancesResult : [];

        maintenances.forEach(m => {
            alerts.push({
                id: `maintenance_${m.immatriculation}`,
                type: 'maintenance',
                severite: m.jours_restants <= 2 ? 'critical' : 'warning',
                title: 'Maintenance Programmée',
                description: `${m.marque} ${m.modele} (${m.immatriculation}) - ${m.type_maintenance}`,
                time: `Dans ${m.jours_restants} jour${m.jours_restants > 1 ? 's' : ''}`,
                color: m.jours_restants <= 2 ? '#E74C3C' : '#F39C12',
                icon: 'build'
            });
        });

        // ============================================
        // STOCKS FAIBLES
        // ============================================
        const stocksResult = await db.query(`
            SELECT 
                s.type_article,
                s.id_article,
                s.quantite_disponible,
                s.seuil_alerte,
                s.unite_mesure
            FROM stocks s
            WHERE s.quantite_disponible <= s.seuil_alerte
            AND s.statut = 'disponible'
            ORDER BY (s.quantite_disponible / s.seuil_alerte) ASC
            LIMIT 5
        `);

        const stocks = Array.isArray(stocksResult) ? stocksResult : [];

        stocks.forEach(s => {
            alerts.push({
                id: `stock_${s.type_article}_${s.id_article}`,
                type: 'stock',
                severite: 'warning',
                title: 'Stock Faible',
                description: `${s.type_article} - Quantité: ${s.quantite_disponible} ${s.unite_mesure}`,
                time: 'Maintenant',
                color: '#E67E22',
                icon: 'inventory'
            });
        });

        // ============================================
        // FACTURES IMPAYÉES
        // ============================================
        const facturesResult = await db.query(`
            SELECT 
                numero_facture,
                montant_du,
                DATEDIFF(NOW(), date_echeance) as jours_retard
            FROM factures
            WHERE statut_paiement IN ('impayee', 'partiellement_payee')
            AND date_echeance < NOW()
            ORDER BY date_echeance ASC
            LIMIT 5
        `);

        const factures = Array.isArray(facturesResult) ? facturesResult : [];

        factures.forEach(f => {
            alerts.push({
                id: `facture_${f.numero_facture}`,
                type: 'paiement',
                severite: f.jours_retard > 30 ? 'critical' : 'warning',
                title: 'Facture Impayée',
                description: `${f.numero_facture} - ${parseFloat(f.montant_du).toFixed(2)} BIF`,
                time: `${f.jours_retard} jour${f.jours_retard > 1 ? 's' : ''} de retard`,
                color: '#E74C3C',
                icon: 'receipt'
            });
        });

        // ============================================
        // CONGÉS EN ATTENTE
        // ============================================
        const congesResult = await db.query(`
            SELECT 
                c.id,
                u.nom_complet,
                c.type_conge,
                c.date_debut,
                DATEDIFF(c.date_debut, NOW()) as jours_avant
            FROM conges c
            JOIN utilisateurs u ON c.id_utilisateur = u.id
            WHERE c.statut = 'en_attente'
            ORDER BY c.date_creation DESC
            LIMIT 3
        `);

        const conges = Array.isArray(congesResult) ? congesResult : [];

        conges.forEach(c => {
            alerts.push({
                id: `conge_${c.id}`,
                type: 'conges',
                severite: 'info',
                title: 'Demande de Congé',
                description: `${c.nom_complet} - ${c.type_conge}`,
                time: c.jours_avant > 0 ? `Débute dans ${c.jours_avant} jours` : 'En cours',
                color: '#3498DB',
                icon: 'event'
            });
        });

        // ============================================
        // ASSURANCES VÉHICULES
        // ============================================
        const assurancesResult = await db.query(`
            SELECT 
                v.immatriculation,
                a.compagnie_assurance,
                a.date_expiration,
                DATEDIFF(a.date_expiration, NOW()) as jours_restants
            FROM assurances_vehicules a
            JOIN vehicules v ON a.id_vehicule = v.id
            WHERE a.statut = 'active'
            AND a.date_expiration <= DATE_ADD(NOW(), INTERVAL 30 DAY)
            AND a.date_expiration >= NOW()
            ORDER BY a.date_expiration ASC
            LIMIT 3
        `);

        const assurances = Array.isArray(assurancesResult) ? assurancesResult : [];

        assurances.forEach(a => {
            alerts.push({
                id: `assurance_${a.immatriculation}`,
                type: 'assurance',
                severite: a.jours_restants <= 7 ? 'critical' : 'warning',
                title: 'Assurance à Renouveler',
                description: `${a.immatriculation} - ${a.compagnie_assurance}`,
                time: `Expire dans ${a.jours_restants} jours`,
                color: a.jours_restants <= 7 ? '#E74C3C' : '#F39C12',
                icon: 'security'
            });
        });

        console.log('🔔 Alertes:', alerts.length);

        return alerts;
    } catch (error) {
        console.error('❌ Erreur getAlerts:', error);
        return [];
    }
}

/**
 * Récupère les données des graphiques
 */
async function getCharts(dateFilters) {
    try {
        const formatDate = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // ============================================
        // ÉVOLUTION CA (30 derniers jours)
        // ============================================
        const evolutionCAResult = await db.query(`
            SELECT 
                DATE(date_commande) as date,
                COALESCE(SUM(montant_total), 0) as montant
            FROM commandes_vente
            WHERE statut IN ('livree_complete', 'facturee', 'payee')
            AND date_commande >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(date_commande)
            ORDER BY date ASC
        `);

        const evolutionCA = Array.isArray(evolutionCAResult) ? evolutionCAResult : [];

        // ============================================
        // RÉPARTITION REVENUS
        // ============================================
        const repartitionRevenusResult = await db.query(`
            SELECT 
                categorie,
                COALESCE(SUM(montant), 0) as montant
            FROM journal_comptable
            WHERE type_mouvement IN ('entree', 'recette')
            AND date_operation BETWEEN ? AND ?
            AND statut = 'valide'
            GROUP BY categorie
            ORDER BY montant DESC
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const repartitionRevenus = Array.isArray(repartitionRevenusResult) ? repartitionRevenusResult : [];

        console.log('📈 Charts:', { evolutionCA: evolutionCA.length, repartitionRevenus: repartitionRevenus.length });

        return {
            evolutionCA: {
                labels: evolutionCA.map(e => {
                    const date = new Date(e.date);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                }),
                datasets: [{
                    data: evolutionCA.map(e => parseFloat(e.montant))
                }]
            },
            repartitionRevenus: repartitionRevenus.map((r, index) => ({
                name: r.categorie || 'Non défini',
                montant: parseFloat(r.montant),
                color: getCategorieColor(r.categorie, index),
                legendFontColor: '#7F8C8D',
                legendFontSize: 12
            }))
        };
    } catch (error) {
        console.error('❌ Erreur getCharts:', error);
        return {
            evolutionCA: { labels: [], datasets: [{ data: [] }] },
            repartitionRevenus: []
        };
    }
}

/**
 * Récupère les top performers
 */
async function getTopPerformers(dateFilters) {
    try {
        const formatDate = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // ============================================
        // TOP CLIENTS
        // ============================================
        const topClientsResult = await db.query(`
            SELECT 
                c.id,
                c.nom_client as nom,
                COUNT(DISTINCT cv.id) as achats,
                COALESCE(SUM(cv.montant_total), 0) as montant
            FROM clients c
            JOIN commandes_vente cv ON c.id = cv.id_client
            WHERE cv.statut IN ('livree_complete', 'facturee', 'payee')
            AND cv.date_commande BETWEEN ? AND ?
            GROUP BY c.id, c.nom_client
            ORDER BY montant DESC
            LIMIT 5
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const topClients = Array.isArray(topClientsResult) ? topClientsResult : [];

        // ============================================
        // TOP PRODUITS
        // ============================================
        const topProduitsResult = await db.query(`
            SELECT 
                lcv.designation as nom,
                COUNT(*) as ventes,
                COALESCE(SUM(lcv.montant_ttc), 0) as montant
            FROM lignes_commande_vente lcv
            JOIN commandes_vente cv ON lcv.id_commande_vente = cv.id
            WHERE cv.statut IN ('livree_complete', 'facturee', 'payee')
            AND cv.date_commande BETWEEN ? AND ?
            GROUP BY lcv.designation
            ORDER BY montant DESC
            LIMIT 5
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const topProduits = Array.isArray(topProduitsResult) ? topProduitsResult : [];

        console.log('🏆 Top Performers:', { clients: topClients.length, produits: topProduits.length });

        return {
            clients: topClients.map(c => ({
                ...c,
                achats: parseInt(c.achats),
                montant: parseFloat(c.montant)
            })),
            produits: topProduits.map(p => ({
                ...p,
                ventes: parseInt(p.ventes),
                montant: parseFloat(p.montant)
            }))
        };
    } catch (error) {
        console.error('❌ Erreur getTopPerformers:', error);
        return { clients: [], produits: [] };
    }
}

/**
 * Récupère les statistiques par module
 */
async function getModuleStats(dateFilters) {
    try {
        const stats = [];
        const formatDate = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // ============================================
        // RH
        // ============================================
        const rhStatsResult = await db.query(`
            SELECT 
                COUNT(DISTINCT u.id) as operations,
                COALESCE(SUM(s.salaire_net), 0) as montant
            FROM utilisateurs u
            LEFT JOIN salaires s ON u.id = s.id_utilisateur
            WHERE u.statut = 'actif'
            AND (
                (s.mois = MONTH(?) AND s.annee = YEAR(?))
                OR s.id IS NULL
            )
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.start)]);

        const rhStats = Array.isArray(rhStatsResult) ? rhStatsResult[0] : rhStatsResult;

        stats.push({
            module: 'RH',
            operations: parseInt(rhStats?.operations || 0),
            montant: parseFloat(rhStats?.montant || 0)
        });

        // ============================================
        // COMMERCIAL
        // ============================================
        const commercialStatsResult = await db.query(`
            SELECT 
                COUNT(*) as operations,
                COALESCE(SUM(montant_total), 0) as montant
            FROM commandes_vente
            WHERE date_commande BETWEEN ? AND ?
            AND statut IN ('livree_complete', 'facturee', 'payee')
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const commercialStats = Array.isArray(commercialStatsResult) ? commercialStatsResult[0] : commercialStatsResult;

        stats.push({
            module: 'Commercial',
            operations: parseInt(commercialStats?.operations || 0),
            montant: parseFloat(commercialStats?.montant || 0)
        });

        // ============================================
        // FINANCE
        // ============================================
        const financeStatsResult = await db.query(`
            SELECT 
                COUNT(*) as operations,
                COALESCE(SUM(CASE 
                    WHEN type_mouvement IN ('entree', 'recette') 
                    THEN montant ELSE 0 
                END), 0) as montant
            FROM journal_comptable
            WHERE date_operation BETWEEN ? AND ?
            AND statut = 'valide'
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const financeStats = Array.isArray(financeStatsResult) ? financeStatsResult[0] : financeStatsResult;

        stats.push({
            module: 'Finance',
            operations: parseInt(financeStats?.operations || 0),
            montant: parseFloat(financeStats?.montant || 0)
        });

        // ============================================
        // ÉLEVAGE
        // ============================================
        const elevageStatsResult = await db.query(`
            SELECT 
                COUNT(*) as operations,
                COALESCE(SUM(quantite_litres * 1800), 0) as montant
            FROM productions_lait
            WHERE date_production BETWEEN ? AND ?
            AND destination = 'vente'
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const elevageStats = Array.isArray(elevageStatsResult) ? elevageStatsResult[0] : elevageStatsResult;

        stats.push({
            module: 'Élevage',
            operations: parseInt(elevageStats?.operations || 0),
            montant: parseFloat(elevageStats?.montant || 0)
        });

        // ============================================
        // AGRICULTURE
        // ============================================
        const agricultureStatsResult = await db.query(`
            SELECT 
                COUNT(*) as operations,
                COALESCE(SUM(cout_total), 0) as montant
            FROM cultures
            WHERE date_semaison BETWEEN ? AND ?
        `, [formatDate(dateFilters.current.start), formatDate(dateFilters.current.end)]);

        const agricultureStats = Array.isArray(agricultureStatsResult) ? agricultureStatsResult[0] : agricultureStatsResult;

        stats.push({
            module: 'Agriculture',
            operations: parseInt(agricultureStats?.operations || 0),
            montant: parseFloat(agricultureStats?.montant || 0)
        });

        console.log('📊 Module Stats:', stats.length);

        return stats;
    } catch (error) {
        console.error('❌ Erreur getModuleStats:', error);
        return [];
    }
}

/**
 * Obtient la couleur d'une catégorie
 */
function getCategorieColor(categorie, index) {
    const colors = {
        'vente': '#27AE60',
        'production': '#9B59B6',
        'elevage': '#E67E22',
        'agriculture': '#16A085',
        'stock': '#3498DB',
        'paiement': '#F39C12',
        'salaire': '#E74C3C',
        'maintenance': '#95A5A6',
        'autre': '#7F8C8D'
    };

    const defaultColors = [
        '#3498DB', '#E74C3C', '#F39C12', '#27AE60',
        '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'
    ];

    return colors[categorie] || defaultColors[index % defaultColors.length];
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/admin/dashboard
 * Récupère toutes les données du dashboard
 */
router.get('/dashboard', authenticate, authorize('admin'), validatePeriod, async (req, res) => {
    try {
        console.log('📊 Dashboard request - Période:', req.validatedPeriod);

        const dateFilters = getDateFilters(req.validatedPeriod);

        console.log('📅 Filtres de dates:', {
            current: {
                start: dateFilters.current.start.toISOString(),
                end: dateFilters.current.end.toISOString()
            },
            previous: {
                start: dateFilters.previous.start.toISOString(),
                end: dateFilters.previous.end.toISOString()
            }
        });

        // Récupération parallèle de toutes les données
        const [kpis, alerts, charts, topPerformers, moduleStats] = await Promise.all([
            getKPIs(dateFilters),
            getAlerts(),
            getCharts(dateFilters),
            getTopPerformers(dateFilters),
            getModuleStats(dateFilters)
        ]);

        console.log('✅ Données récupérées:', {
            kpis: kpis ? 'OK' : 'NULL',
            alerts: alerts?.length || 0,
            charts: charts ? 'OK' : 'NULL',
            topPerformers: topPerformers ? 'OK' : 'NULL',
            moduleStats: moduleStats?.length || 0
        });

        const responseData = {
            success: true,
            data: {
                kpis: kpis || {
                    chiffre_affaires: { valeur: 0, tendance: 0, evolution: 'stable', precedent: 0 },
                    benefice_net: { valeur: 0, recettes: 0, depenses: 0, evolution: 'positif', tendance: 0 },
                    employes: { total: 0, actifs: 0 },
                    vehicules: { total: 0, actifs: 0, disponibles: 0 },
                    animaux: { total: 0, vivants: 0 },
                    commandes: { en_cours: 0, livrees: 0 }
                },
                alertes: alerts || [],
                charts: charts || {
                    evolutionCA: { labels: [], datasets: [{ data: [] }] },
                    repartitionRevenus: []
                },
                topPerformers: topPerformers || { clients: [], produits: [] },
                moduleStats: moduleStats || [],
                period: req.validatedPeriod,
                lastUpdate: new Date()
            }
        };

        console.log('📤 Envoi réponse dashboard');

        res.status(200).json(responseData);

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/demandes-paiement-salaire
 * Récupère les demandes de paiement de salaire
 */
router.get('/demandes-paiement-salaire', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { statut = 'en_attente', page = 1, limit = 5 } = req.query;

        // Conversion et validation des paramètres
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // Validation des valeurs
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                success: false,
                message: 'Numéro de page invalide'
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: 'Limite invalide (doit être entre 1 et 100)'
            });
        }

        // Validation du statut
        const statutsValides = ['en_attente', 'validee', 'rejetee', 'payee'];
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
        }

        const offset = (pageNum - 1) * limitNum;

        console.log('🔍 Recherche demandes:', { statut, page: pageNum, limit: limitNum, offset });

        const demandesResult = await db.query(`
            SELECT 
                dps.id,
                dps.id_salaire,
                dps.mois,
                dps.annee,
                dps.montant,
                dps.statut,
                dps.date_demande,
                dps.commentaire,
                DATEDIFF(NOW(), dps.date_demande) as jours_attente,
                u.nom_complet as employe_nom,
                u.matricule as employe_matricule,
                u.email as employe_email,
                u.telephone as employe_telephone,
                u.type_employe,
                d.nom as departement_nom
            FROM demandes_paiement_salaire dps
            JOIN salaires s ON dps.id_salaire = s.id
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE dps.statut = ?
            ORDER BY dps.date_demande ASC
            LIMIT ${limitNum} OFFSET ${offset}
        `, [statut]);

        const demandes = Array.isArray(demandesResult) ? demandesResult : [];

        console.log('✅ Demandes trouvées:', demandes.length);

        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM demandes_paiement_salaire
            WHERE statut = ?
        `, [statut]);

        const totalCount = Array.isArray(countResult) ? (countResult[0]?.total || 0) : 0;

        res.status(200).json({
            success: true,
            data: {
                demandes: demandes,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: parseInt(totalCount),
                    totalPages: Math.ceil(parseInt(totalCount) / limitNum)
                }
            }
        });
    } catch (error) {
        console.error('❌ Erreur demandes paiement:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des demandes de paiement.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/admin/demandes-paiement-salaire/:id/valider
 * Valide une demande de paiement
 */
router.post('/demandes-paiement-salaire/:id/valider', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { commentaire } = req.body;

        const codeVerification = Math.floor(100000 + Math.random() * 900000).toString();

        await db.query(`
            UPDATE demandes_paiement_salaire
            SET 
                statut = 'validee',
                date_validation = NOW(),
                id_validateur = ?,
                commentaire_validation = ?,
                code_verification = ?
            WHERE id = ?
        `, [req.user.id, commentaire || null, codeVerification, id]);

        const demandeResult = await db.query(`
            SELECT 
                dps.*,
                s.id_utilisateur,
                u.email as employe_email,
                u.nom_complet as employe_nom
            FROM demandes_paiement_salaire dps
            JOIN salaires s ON dps.id_salaire = s.id
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE dps.id = ?
        `, [id]);

        const demande = Array.isArray(demandeResult) ? demandeResult[0] : null;

        if (demande) {
            await db.query(`
                INSERT INTO notifications (
                    id_utilisateur,
                    titre,
                    message,
                    type,
                    statut,
                    date_creation
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                demande.id_utilisateur,
                'Paiement Validé',
                `Votre demande de paiement pour ${demande.mois}/${demande.annee} a été validée. Code: ${codeVerification}`,
                'paiement',
                'non_lu'
            ]);
        }

        res.status(200).json({
            success: true,
            message: 'Demande validée avec succès',
            data: {
                codeVerification,
                demande: demande
            }
        });
    } catch (error) {
        console.error('❌ Erreur validation demande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la validation de la demande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/admin/demandes-paiement-salaire/:id/rejeter
 * Rejette une demande de paiement
 */
router.post('/demandes-paiement-salaire/:id/rejeter', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { motif_rejet, commentaire } = req.body;

        if (!motif_rejet || motif_rejet.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Le motif de rejet est obligatoire'
            });
        }

        await db.query(`
            UPDATE demandes_paiement_salaire
            SET 
                statut = 'rejetee',
                date_rejet = NOW(),
                id_rejeteur = ?,
                motif_rejet = ?,
                commentaire_rejet = ?
            WHERE id = ?
        `, [req.user.id, motif_rejet, commentaire || null, id]);

        const demandeResult = await db.query(`
            SELECT 
                dps.*,
                s.id_utilisateur,
                u.nom_complet as employe_nom
            FROM demandes_paiement_salaire dps
            JOIN salaires s ON dps.id_salaire = s.id
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE dps.id = ?
        `, [id]);

        const demande = Array.isArray(demandeResult) ? demandeResult[0] : null;

        if (demande) {
            await db.query(`
                INSERT INTO notifications (
                    id_utilisateur,
                    titre,
                    message,
                    type,
                    statut,
                    date_creation
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                demande.id_utilisateur,
                'Paiement Rejeté',
                `Votre demande de paiement pour ${demande.mois}/${demande.annee} a été rejetée. Motif: ${motif_rejet}`,
                'paiement',
                'non_lu'
            ]);
        }

        res.status(200).json({
            success: true,
            message: 'Demande rejetée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur rejet demande:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du rejet de la demande.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/kpis
 */
router.get('/kpis', authenticate, authorize('admin'), validatePeriod, async (req, res) => {
    try {
        const dateFilters = getDateFilters(req.validatedPeriod);
        const kpis = await getKPIs(dateFilters);

        res.status(200).json({
            success: true,
            data: kpis
        });
    } catch (error) {
        console.error('KPIs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des KPIs.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/alerts
 */
router.get('/alerts', authenticate, authorize('admin'), async (req, res) => {
    try {
        const alerts = await getAlerts();

        res.status(200).json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('Alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des alertes.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/charts
 */
router.get('/charts', authenticate, authorize('admin'), validatePeriod, async (req, res) => {
    try {
        const dateFilters = getDateFilters(req.validatedPeriod);
        const charts = await getCharts(dateFilters);

        res.status(200).json({
            success: true,
            data: charts
        });
    } catch (error) {
        console.error('Charts error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des graphiques.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/top-performers
 */
router.get('/top-performers', authenticate, authorize('admin'), validatePeriod, async (req, res) => {
    try {
        const dateFilters = getDateFilters(req.validatedPeriod);
        const topPerformers = await getTopPerformers(dateFilters);

        res.status(200).json({
            success: true,
            data: topPerformers
        });
    } catch (error) {
        console.error('Top performers error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des top performers.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/module-stats
 */
router.get('/module-stats', authenticate, authorize('admin'), validatePeriod, async (req, res) => {
    try {
        const dateFilters = getDateFilters(req.validatedPeriod);
        const moduleStats = await getModuleStats(dateFilters);

        res.status(200).json({
            success: true,
            data: moduleStats
        });
    } catch (error) {
        console.error('Module stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques modules.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/admin/summary
 */
router.get('/summary', authenticate, authorize('admin'), async (req, res) => {
    try {
        const summaryResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM utilisateurs WHERE statut = 'actif') as utilisateurs_actifs,
                (SELECT COUNT(*) FROM vehicules WHERE statut = 'actif') as vehicules_actifs,
                (SELECT COUNT(*) FROM animaux WHERE statut = 'vivant') as animaux_vivants,
                (SELECT COUNT(*) FROM commandes_vente WHERE statut IN ('brouillon', 'confirmee', 'en_preparation')) as commandes_en_cours,
                (SELECT COUNT(*) FROM notifications WHERE statut = 'non_lu') as notifications_non_lues
        `);

        const systemStats = Array.isArray(summaryResult) ? summaryResult[0] : summaryResult;

        res.status(200).json({
            success: true,
            data: systemStats || {}
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du résumé.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;