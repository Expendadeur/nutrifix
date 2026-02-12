// backend/routes/operationsRoutes.js
//dans server.js:app.use('/api/operations',managerLimiter, OperationsRoutes);
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// ============================================
// UTILITAIRES - ENREGISTREMENT JOURNAL COMPTABLE
// ============================================
async function enregistrerJournalComptable(data) {
    const {
        categorie,
        type_mouvement,
        libelle,
        description,
        montant,
        quantite = null,
        unite_mesure = null,
        compte_debit,
        compte_credit,
        table_source,
        id_source,
        tiers_type = null,
        tiers_id = null,
        tiers_nom = null,
        effectue_par,
        reference_externe = null,
        donnees_complementaires = null
    } = data;

    const sql = `
        CALL enregistrer_journal_comptable(
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `;

    await db.query(sql, [
        categorie,
        type_mouvement,
        libelle,
        description,
        montant,
        quantite,
        unite_mesure,
        compte_debit,
        compte_credit,
        table_source,
        id_source,
        tiers_type,
        tiers_id,
        tiers_nom,
        effectue_par,
        reference_externe,
        donnees_complementaires ? JSON.stringify(donnees_complementaires) : null
    ]);
}

// ============================================
// NOUVELLE FONCTION - ENREGISTREMENT BUDGET DÉPARTEMENT
// ============================================
async function enregistrerDansBudgetDepartement(data) {
    const {
        id_departement,
        type_mouvement, // 'depense' ou 'recette'
        categorie,
        description,
        montant,
        reference = null,
        effectue_par
    } = data;

    // Validation
    if (!id_departement || !montant || montant <= 0) {
        console.warn('⚠️ Enregistrement budget ignoré: département ou montant invalide');
        return;
    }

    try {
        if (type_mouvement === 'depense') {
            await db.query(`
                INSERT INTO depenses_departement 
                (id_departement, categorie, description, montant, date_depense, reference, effectue_par, statut)
                VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 'approuve')
            `, [id_departement, categorie, description, montant, reference, effectue_par]);
            console.log(`✅ Dépense de ${montant} BIF enregistrée pour le département ${id_departement}`);
        } else if (type_mouvement === 'recette') {
            await db.query(`
                INSERT INTO revenus_departement 
                (id_departement, source, description, montant, date_revenu, enregistre_par)
                VALUES (?, ?, ?, ?, CURDATE(), ?)
            `, [id_departement, categorie, description, montant, effectue_par]);
            console.log(`✅ Recette de ${montant} BIF enregistrée pour le département ${id_departement}`);
        }
    } catch (error) {
        console.error('⚠️ Erreur lors de l\'enregistrement dans le budget du département:', error.message);
    }
}

// ============================================
// DONNÉES RÉFÉRENTIELLES
// ============================================

/**
 * GET /chauffeurs - Liste des chauffeurs
 */
router.get('/chauffeurs', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id,
                u.matricule,
                u.nom_complet,
                u.telephone,
                u.email,
                u.statut,
                d.nom as departement_nom,
                v.immatriculation as vehicule_attribue,
                v.id as vehicule_id
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            LEFT JOIN vehicules v ON v.id_chauffeur_attitre = u.id
            WHERE u.role = 'chauffeur' AND u.statut = 'actif'
            ORDER BY u.nom_complet
        `;

        const chauffeurs = await db.query(sql);

        res.status(200).json({
            success: true,
            data: chauffeurs
        });
    } catch (error) {
        console.error('Get chauffeurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des chauffeurs.'
        });
    }
});

/**
 * GET /departements - Liste des départements
 */
router.get('/departements', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                d.id,
                d.nom,
                d.type,
                d.budget_annuel,
                d.statut,
                d.id_parent,
                dp.nom as parent_nom,
                r.nom_complet as responsable_nom,
                r.id as responsable_id,
                (SELECT COUNT(*) FROM utilisateurs WHERE id_departement = d.id AND statut = 'actif') as nombre_employes
            FROM departements d
            LEFT JOIN departements dp ON d.id_parent = dp.id
            LEFT JOIN utilisateurs r ON d.responsable_id = r.id
            WHERE d.statut = 'actif'
            ORDER BY d.nom
        `;

        const departements = await db.query(sql);

        res.status(200).json({
            success: true,
            data: departements
        });
    } catch (error) {
        console.error('Get departements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des départements.'
        });
    }
});

/**
 * GET /veterinaires - Liste des vétérinaires
 */
router.get('/veterinaires', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id,
                u.matricule,
                u.nom_complet,
                u.telephone,
                u.email,
                u.statut,
                d.nom as departement_nom,
                (SELECT COUNT(*) FROM suivis_sanitaires WHERE id_technicien = u.id) as nombre_interventions
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.role = 'veterinaire' AND u.statut = 'actif'
            ORDER BY u.nom_complet
        `;

        const veterinaires = await db.query(sql);

        res.status(200).json({
            success: true,
            data: veterinaires
        });
    } catch (error) {
        console.error('Get veterinaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des vétérinaires.'
        });
    }
});

/**
 * GET /fournisseurs - Liste des fournisseurs
 */
router.get('/fournisseurs', authenticate, async (req, res) => {
    try {
        const { type, statut, search } = req.query;

        let sql = `
            SELECT 
                f.id,
                f.code_fournisseur,
                f.nom_fournisseur,
                f.type,
                f.contact_principal,
                f.telephone,
                f.email,
                f.adresse,
                f.ville,
                f.pays,
                f.numero_tva,
                f.note_evaluation,
                f.nombre_achats,
                f.montant_total_achats,
                f.limite_credit,
                f.solde_actuel,
                f.conditions_paiement,
                f.statut
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
        } else {
            // Par défaut, ne montrer que les actifs
            sql += ' AND f.statut = "actif"';
        }

        if (search) {
            sql += ` AND (
                f.nom_fournisseur LIKE ? OR 
                f.code_fournisseur LIKE ? OR 
                f.contact_principal LIKE ? OR
                f.telephone LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY f.nom_fournisseur';

        const fournisseurs = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: fournisseurs
        });
    } catch (error) {
        console.error('Get fournisseurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des fournisseurs.'
        });
    }
});

/**
 * GET /agriculteurs - Liste des agriculteurs
 */
router.get('/agriculteurs', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id,
                u.matricule,
                u.nom_complet,
                u.telephone,
                u.email,
                u.statut,
                d.nom as departement_nom,
                (SELECT COUNT(*) FROM cultures c 
                 JOIN parcelles p ON c.id_parcelle = p.id 
                 WHERE c.statut = 'en_cours') as cultures_actives
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.role = 'agriculteur' AND u.statut = 'actif'
            ORDER BY u.nom_complet
        `;

        const agriculteurs = await db.query(sql);

        res.status(200).json({
            success: true,
            data: agriculteurs
        });
    } catch (error) {
        console.error('Get agriculteurs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des agriculteurs.'
        });
    }
});

/**
 * GET /techniciens - Liste des techniciens
 */
router.get('/techniciens', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.id,
                u.matricule,
                u.nom_complet,
                u.telephone,
                u.email,
                u.statut,
                d.nom as departement_nom
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.role = 'technicien' AND u.statut = 'actif'
            ORDER BY u.nom_complet
        `;

        const techniciens = await db.query(sql);

        res.status(200).json({
            success: true,
            data: techniciens
        });
    } catch (error) {
        console.error('Get techniciens error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des techniciens.'
        });
    }
});

/**
 * GET /types-cultures - Liste des types de cultures
 */
router.get('/types-cultures', authenticate, async (req, res) => {
    try {
        const { famille, saison } = req.query;

        let sql = `
            SELECT 
                tc.id,
                tc.code_culture,
                tc.nom_culture,
                tc.famille,
                tc.duree_cycle_jours,
                tc.saison_optimale,
                tc.temperature_optimale_min,
                tc.temperature_optimale_max,
                tc.besoins_eau_mm,
                tc.espacement_plants_cm,
                tc.profondeur_semaison_cm,
                tc.rendement_moyen_kg_ha,
                tc.prix_moyen_kg,
                tc.duree_conservation_jours,
                tc.conditions_stockage
            FROM types_cultures tc
            WHERE 1=1
        `;
        const params = [];

        if (famille) {
            sql += ' AND tc.famille = ?';
            params.push(famille);
        }

        if (saison) {
            sql += ' AND (tc.saison_optimale = ? OR tc.saison_optimale = "toutes")';
            params.push(saison);
        }

        sql += ' ORDER BY tc.nom_culture';

        const typesCultures = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: typesCultures
        });
    } catch (error) {
        console.error('Get types cultures error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des types de cultures.'
        });
    }
});

// ============================================
// FLOTTE - VÉHICULES
// ============================================

/**
 * GET /vehicules - Liste tous les véhicules avec filtres
 */
router.get('/vehicules', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const { type_vehicule, statut, disponible, search } = req.query;
        // conversions sûres pour la pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;

        let sql = `
            SELECT 
                v.*,
                u.nom_complet as chauffeur_nom,
                d.nom as departement_nom,
                (SELECT COUNT(*) 
                 FROM maintenances_vehicules mv 
                 WHERE mv.id_vehicule = v.id AND mv.statut = 'planifie') as maintenances_planifiees,
                (SELECT date_prochaine_maintenance 
                 FROM maintenances_vehicules mv 
                 WHERE mv.id_vehicule = v.id 
                 ORDER BY date_prochaine_maintenance ASC LIMIT 1) as prochaine_maintenance,
                (SELECT date_expiration 
                 FROM assurances_vehicules av 
                 WHERE av.id_vehicule = v.id AND av.statut = 'active' 
                 ORDER BY date_expiration ASC LIMIT 1) as expiration_assurance
            FROM vehicules v
            LEFT JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
            LEFT JOIN departements d ON v.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        if (type_vehicule) {
            sql += ' AND v.type_vehicule = ?';
            params.push(type_vehicule);
        }

        if (statut) {
            sql += ' AND v.statut = ?';
            params.push(statut);
        }

        if (disponible !== undefined) {
            sql += ' AND v.disponible = ?';
            params.push(disponible === 'true' ? 1 : 0);
        }

        if (search) {
            sql += ` AND (
                v.marque LIKE ? OR 
                v.modele LIKE ? OR 
                v.immatriculation LIKE ? OR
                u.nom_complet LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY v.marque, v.modele';

        // Pagination – injecter les valeurs numériques directement dans la requête
        const offset = (page - 1) * limit;
        sql += ` LIMIT ${limit} OFFSET ${offset}`;

        const vehicules = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM vehicules v WHERE 1=1`;
        const countParams = [];

        if (type_vehicule) {
            countSql += ' AND v.type_vehicule = ?';
            countParams.push(type_vehicule);
        }

        if (statut) {
            countSql += ' AND v.statut = ?';
            countParams.push(statut);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: vehicules,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get vehicules error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des véhicules.'
        });
    }
});

/**
 * GET /vehicules/:id - Détails d'un véhicule
 */
router.get('/vehicules/:id', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const { id } = req.params;

        const [vehicule] = await db.query(`
            SELECT 
                v.*,
                u.nom_complet as chauffeur_nom,
                u.telephone as chauffeur_telephone,
                d.nom as departement_nom
            FROM vehicules v
            LEFT JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
            LEFT JOIN departements d ON v.id_departement = d.id
            WHERE v.id = ?
        `, [id]);

        if (!vehicule) {
            return res.status(404).json({
                success: false,
                message: 'Véhicule non trouvé.'
            });
        }

        // Récupérer historique des maintenances
        const maintenances = await db.query(`
            SELECT * FROM maintenances_vehicules
            WHERE id_vehicule = ?
            ORDER BY date_intervention DESC
            LIMIT 10
        `, [id]);

        // Récupérer assurances
        const assurances = await db.query(`
            SELECT * FROM assurances_vehicules
            WHERE id_vehicule = ?
            ORDER BY date_expiration DESC
        `, [id]);

        // Récupérer mouvements récents
        const mouvements = await db.query(`
            SELECT 
                mv.*,
                u.nom_complet as chauffeur_nom
            FROM mouvements_vehicules mv
            LEFT JOIN utilisateurs u ON mv.id_chauffeur = u.id
            WHERE mv.id_vehicule = ?
            ORDER BY mv.date_mission DESC
            LIMIT 20
        `, [id]);

        res.status(200).json({
            success: true,
            data: {
                vehicule,
                maintenances,
                assurances,
                mouvements
            }
        });
    } catch (error) {
        console.error('Get vehicule details error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des détails du véhicule.'
        });
    }
});

/**
 * POST /vehicules - Créer un nouveau véhicule
 */
router.post('/vehicules', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            immatriculation,
            marque,
            modele,
            annee,
            couleur,
            type_vehicule,
            capacite_carburant,
            consommation_moyenne,
            kilometrage_actuel,
            date_achat,
            prix_achat,
            valeur_actuelle,
            id_chauffeur_attitre,
            id_departement,
            statut,
            disponible,
            photo
        } = req.body;

        // Validation
        if (!immatriculation || !marque || !modele || !type_vehicule || !id_departement) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants (immatriculation, marque, modèle, type, département).'
            });
        }

        // Vérifier si l'immatriculation existe déjà
        const [existant] = await db.query(
            'SELECT id FROM vehicules WHERE immatriculation = ?',
            [immatriculation]
        );

        if (existant) {
            return res.status(400).json({
                success: false,
                message: 'Un véhicule avec cette immatriculation existe déjà.'
            });
        }

        const sql = `
            INSERT INTO vehicules (
                immatriculation, marque, modele, annee, couleur,
                type_vehicule, capacite_carburant, consommation_moyenne,
                kilometrage_actuel, date_achat, prix_achat, valeur_actuelle,
                id_chauffeur_attitre, id_departement, statut, disponible, photo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            immatriculation,
            marque,
            modele,
            parseInt(annee, 10),
            couleur,
            type_vehicule,
            parseFloat(capacite_carburant) || 0,
            parseFloat(consommation_moyenne) || 0,
            Math.round(parseFloat(kilometrage_actuel) || 0),
            (date_achat ? new Date(date_achat) : new Date()).toISOString().split('T')[0],
            prix_achat,
            valeur_actuelle || prix_achat,
            id_chauffeur_attitre,
            id_departement,
            statut || 'actif',
            disponible !== undefined ? disponible : 1,
            photo
        ]);

        // Enregistrer dans le journal si prix d'achat fourni
        if (prix_achat && prix_achat > 0) {
            await enregistrerJournalComptable({
                categorie: 'achat',
                type_mouvement: 'depense',
                libelle: `Achat véhicule - ${immatriculation}`,
                description: `Achat ${marque} ${modele} - ${immatriculation}`,
                montant: prix_achat,
                compte_debit: '218 - Matériel de transport',
                compte_credit: '401 - Fournisseurs',
                table_source: 'vehicules',
                id_source: result.insertId,
                effectue_par: req.userId,
                reference_externe: immatriculation,
                donnees_complementaires: {
                    marque,
                    modele,
                    type_vehicule,
                    date_achat
                }
            });

            // Enregistrer la dépense dans le budget du département
            await enregistrerDansBudgetDepartement({
                id_departement: id_departement,
                type_mouvement: 'depense',
                categorie: 'achat',
                description: `Achat véhicule - ${immatriculation}`,
                montant: prix_achat,
                reference: immatriculation,
                effectue_par: req.userId
            });
        }

        res.status(201).json({
            success: true,
            message: 'Véhicule enregistré avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du véhicule.'
        });
    }
});

/**
 * PUT /vehicules/:id - Modifier un véhicule
 */
router.put('/vehicules/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            immatriculation,
            marque,
            modele,
            annee,
            couleur,
            type_vehicule,
            capacite_carburant,
            consommation_moyenne,
            kilometrage_actuel,
            valeur_actuelle,
            id_chauffeur_attitre,
            id_departement,
            statut,
            disponible,
            photo
        } = req.body;

        // Vérifier si le véhicule existe
        const [vehiculeExist] = await db.query('SELECT id FROM vehicules WHERE id = ?', [id]);
        if (!vehiculeExist) {
            return res.status(404).json({
                success: false,
                message: 'Véhicule non trouvé.'
            });
        }

        const sql = `
            UPDATE vehicules SET
                immatriculation = ?,
                marque = ?,
                modele = ?,
                annee = ?,
                couleur = ?,
                type_vehicule = ?,
                capacite_carburant = ?,
                consommation_moyenne = ?,
                kilometrage_actuel = ?,
                valeur_actuelle = ?,
                id_chauffeur_attitre = ?,
                id_departement = ?,
                statut = ?,
                disponible = ?,
                photo = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            immatriculation,
            marque,
            modele,
            annee,
            couleur,
            type_vehicule,
            capacite_carburant,
            consommation_moyenne,
            kilometrage_actuel,
            valeur_actuelle,
            id_chauffeur_attitre,
            id_departement,
            statut,
            disponible,
            photo,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Véhicule modifié avec succès.'
        });
    } catch (error) {
        console.error('Update vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du véhicule.'
        });
    }
});

/**
 * DELETE /vehicules/:id - Désactiver un véhicule
 */
router.delete('/vehicules/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE vehicules SET statut = ?, disponible = ? WHERE id = ?',
            ['hors_service', 0, id]
        );

        res.status(200).json({
            success: true,
            message: 'Véhicule désactivé avec succès.'
        });
    } catch (error) {
        console.error('Delete vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désactivation du véhicule.'
        });
    }
});

// ============================================
// FLOTTE - MOUVEMENTS VÉHICULES
// ============================================

/**
 * GET /mouvements-vehicules - Liste des mouvements
 */
router.get('/mouvements-vehicules', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const {
            id_vehicule,
            id_chauffeur,
            statut,
            startDate,
            endDate
        } = req.query;

        // conversions sûres pour la pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;

        let sql = `
            SELECT 
                mv.*,
                v.immatriculation,
                v.marque,
                v.modele,
                u.nom_complet as chauffeur_nom
            FROM mouvements_vehicules mv
            JOIN vehicules v ON mv.id_vehicule = v.id
            JOIN utilisateurs u ON mv.id_chauffeur = u.id
            WHERE 1=1
        `;
        const params = [];

        if (id_vehicule) {
            sql += ' AND mv.id_vehicule = ?';
            params.push(id_vehicule);
        }

        if (id_chauffeur) {
            sql += ' AND mv.id_chauffeur = ?';
            params.push(id_chauffeur);
        }

        if (statut) {
            sql += ' AND mv.statut = ?';
            params.push(statut);
        }

        if (startDate) {
            sql += ' AND mv.date_mission >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND mv.date_mission <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY mv.date_mission DESC, mv.heure_depart DESC';

        const offset = (page - 1) * limit;
        // injecter LIMIT / OFFSET directement
        sql += ` LIMIT ${limit} OFFSET ${offset}`;

        const mouvements = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: mouvements
        });
    } catch (error) {
        console.error('Get mouvements vehicules error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des mouvements.'
        });
    }
});

/**
 * POST /mouvements-vehicules - Créer un mouvement (sortie véhicule)
 */
router.post('/mouvements-vehicules', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const {
            id_vehicule,
            id_chauffeur,
            type_mouvement,
            date_mission,
            heure_depart,
            heure_retour,
            kilometrage_depart,
            kilometrage_retour,
            destination,
            motif,
            passagers,
            marchandise_transportee,
            cout_carburant,
            quantite_carburant,
            cout_peages,
            autres_frais
        } = req.body;

        // Validation
        if (!id_vehicule || !id_chauffeur || !type_mouvement || !kilometrage_depart || !destination || !motif) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Vérifier disponibilité du véhicule
        const [vehicule] = await db.query(
            'SELECT disponible, statut FROM vehicules WHERE id = ?',
            [id_vehicule]
        );

        if (!vehicule) {
            return res.status(404).json({
                success: false,
                message: 'Véhicule non trouvé.'
            });
        }

        if (type_mouvement === 'sortie' && (!vehicule.disponible || vehicule.statut !== 'actif')) {
            return res.status(400).json({
                success: false,
                message: 'Véhicule non disponible pour sortie.'
            });
        }

        const sql = `
            INSERT INTO mouvements_vehicules (
                id_vehicule, id_chauffeur, type_mouvement, date_mission,
                heure_depart, heure_retour, kilometrage_depart, kilometrage_retour,
                destination, motif, passagers, marchandise_transportee,
                cout_carburant, quantite_carburant, cout_peages, autres_frais,
                statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            id_vehicule,
            id_chauffeur,
            type_mouvement,
            date_mission || new Date(),
            heure_depart,
            heure_retour,
            kilometrage_depart,
            kilometrage_retour,
            destination,
            motif,
            passagers,
            marchandise_transportee,
            cout_carburant || 0,
            quantite_carburant || 0,
            cout_peages || 0,
            autres_frais || 0,
            type_mouvement === 'retour' ? 'termine' : 'en_cours'
        ]);

        // Mettre à jour la disponibilité du véhicule
        if (type_mouvement === 'sortie') {
            await db.query('UPDATE vehicules SET disponible = 0 WHERE id = ?', [id_vehicule]);
        } else if (type_mouvement === 'retour') {
            await db.query(
                'UPDATE vehicules SET disponible = 1, kilometrage_actuel = ? WHERE id = ?',
                [kilometrage_retour, id_vehicule]
            );
        }

        // Enregistrer frais dans journal si retour avec frais
        if (type_mouvement === 'retour') {
            const totalFrais = (parseFloat(cout_carburant) || 0) +
                (parseFloat(cout_peages) || 0) +
                (parseFloat(autres_frais) || 0);

            if (totalFrais > 0) {
                const [vehiculeInfo] = await db.query(
                    'SELECT immatriculation, marque, modele FROM vehicules WHERE id = ?',
                    [id_vehicule]
                );

                await enregistrerJournalComptable({
                    categorie: 'maintenance',
                    type_mouvement: 'depense',
                    libelle: `Frais mission - ${vehiculeInfo.immatriculation}`,
                    description: `Mission ${destination} - ${motif}`,
                    montant: totalFrais,
                    compte_debit: '625 - Frais de transport',
                    compte_credit: '512 - Banque',
                    table_source: 'mouvements_vehicules',
                    id_source: result.insertId,
                    effectue_par: req.userId,
                    reference_externe: `MV-${result.insertId}`,
                    donnees_complementaires: {
                        cout_carburant,
                        quantite_carburant,
                        cout_peages,
                        autres_frais,
                        distance_parcourue: kilometrage_retour - kilometrage_depart
                    }
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Mouvement enregistré avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create mouvement vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du mouvement.'
        });
    }
});

/**
 * PUT /mouvements-vehicules/:id - Modifier un mouvement
 */
router.put('/mouvements-vehicules/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            heure_retour,
            kilometrage_retour,
            cout_carburant,
            quantite_carburant,
            cout_peages,
            autres_frais,
            statut
        } = req.body;

        const [mouvement] = await db.query(
            'SELECT id_vehicule, kilometrage_depart FROM mouvements_vehicules WHERE id = ?',
            [id]
        );

        if (!mouvement) {
            return res.status(404).json({
                success: false,
                message: 'Mouvement non trouvé.'
            });
        }

        const sql = `
            UPDATE mouvements_vehicules SET
                heure_retour = ?,
                kilometrage_retour = ?,
                cout_carburant = ?,
                quantite_carburant = ?,
                cout_peages = ?,
                autres_frais = ?,
                statut = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            heure_retour,
            kilometrage_retour,
            cout_carburant,
            quantite_carburant,
            cout_peages,
            autres_frais,
            statut,
            id
        ]);

        // Si terminé, rendre véhicule disponible et mettre à jour kilométrage
        if (statut === 'termine' && kilometrage_retour) {
            await db.query(
                'UPDATE vehicules SET disponible = 1, kilometrage_actuel = ? WHERE id = ?',
                [kilometrage_retour, mouvement.id_vehicule]
            );
        }

        res.status(200).json({
            success: true,
            message: 'Mouvement mis à jour avec succès.'
        });
    } catch (error) {
        console.error('Update mouvement error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du mouvement.'
        });
    }
});

// ============================================
// FLOTTE - MAINTENANCES
// ============================================

/**
 * GET /maintenances - Liste des maintenances
 */
router.get('/maintenances', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id_vehicule, statut, type_maintenance } = req.query;

        let sql = `
            SELECT 
                mv.*,
                v.immatriculation,
                v.marque,
                v.modele,
                u.nom_complet as validateur_nom
            FROM maintenances_vehicules mv
            JOIN vehicules v ON mv.id_vehicule = v.id
            LEFT JOIN utilisateurs u ON mv.valide_par = u.id
            WHERE 1=1
        `;
        const params = [];

        if (id_vehicule) {
            sql += ' AND mv.id_vehicule = ?';
            params.push(id_vehicule);
        }

        if (statut) {
            sql += ' AND mv.statut = ?';
            params.push(statut);
        }

        if (type_maintenance) {
            sql += ' AND mv.type_maintenance = ?';
            params.push(type_maintenance);
        }

        sql += ' ORDER BY mv.date_intervention DESC';

        const maintenances = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: maintenances
        });
    } catch (error) {
        console.error('Get maintenances error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des maintenances.'
        });
    }
});

/**
 * POST /maintenances - Créer une maintenance
 */
router.post('/maintenances', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_vehicule,
            type_maintenance,
            description,
            fournisseur,
            numero_facture,
            cout_maintenance,
            kilometrage,
            date_intervention,
            date_prochaine_maintenance,
            kilometrage_prochaine,
            garantie_jours,
            photos
        } = req.body;

        // Validation
        if (!id_vehicule || !type_maintenance || !description || !cout_maintenance || !kilometrage) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO maintenances_vehicules (
                id_vehicule, type_maintenance, description, fournisseur,
                numero_facture, cout_maintenance, kilometrage, date_intervention,
                date_prochaine_maintenance, kilometrage_prochaine, garantie_jours,
                photos, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'termine')
        `;

        const result = await db.query(sql, [
            id_vehicule,
            type_maintenance,
            description,
            fournisseur,
            numero_facture,
            cout_maintenance,
            kilometrage,
            date_intervention || new Date(),
            date_prochaine_maintenance,
            kilometrage_prochaine,
            garantie_jours,
            JSON.stringify(photos)
        ]);

        // Note: Le trigger 'trigger_journal_maintenance_vehicule' se déclenche automatiquement

        res.status(201).json({
            success: true,
            message: 'Maintenance enregistrée avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create maintenance error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la maintenance.'
        });
    }
});

// ============================================
// FLOTTE - ASSURANCES
// ============================================

/**
 * GET /assurances - Liste des assurances
 */
router.get('/assurances', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id_vehicule, statut } = req.query;

        let sql = `
            SELECT 
                av.*,
                v.immatriculation,
                v.marque,
                v.modele,
                DATEDIFF(av.date_expiration, CURDATE()) as jours_restants
            FROM assurances_vehicules av
            JOIN vehicules v ON av.id_vehicule = v.id
            WHERE 1=1
        `;
        const params = [];

        if (id_vehicule) {
            sql += ' AND av.id_vehicule = ?';
            params.push(id_vehicule);
        }

        if (statut) {
            sql += ' AND av.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY av.date_expiration ASC';

        const assurances = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: assurances
        });
    } catch (error) {
        console.error('Get assurances error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des assurances.'
        });
    }
});

/**
 * POST /assurances - Créer une assurance
 */
router.post('/assurances', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_vehicule,
            compagnie_assurance,
            numero_police,
            type_couverture,
            date_debut,
            date_expiration,
            montant_prime,
            franchise,
            scan_police,
            scan_attestation
        } = req.body;

        // Validation
        if (!id_vehicule || !compagnie_assurance || !numero_police || !type_couverture || !date_expiration || !montant_prime) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO assurances_vehicules (
                id_vehicule, compagnie_assurance, numero_police, type_couverture,
                date_debut, date_expiration, montant_prime, franchise,
                scan_police, scan_attestation, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;

        const result = await db.query(sql, [
            id_vehicule,
            compagnie_assurance,
            numero_police,
            type_couverture,
            date_debut || new Date(),
            date_expiration,
            montant_prime,
            franchise || 0,
            scan_police,
            scan_attestation
        ]);

        res.status(201).json({
            success: true,
            message: 'Assurance enregistrée avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create assurance error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'assurance.'
        });
    }
});

// ============================================
// AGRICULTURE - PARCELLES
// ============================================

/**
 * GET /parcelles - Liste des parcelles
 */
router.get('/parcelles', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const { statut, search } = req.query;

        let sql = `
            SELECT 
                p.*,
                tc.nom_culture as culture_actuelle, 
                c.date_semaison as date_plantation,
                c.date_recolte_prevue
            FROM parcelles p
            LEFT JOIN cultures c ON p.id_culture_actuelle = c.id AND c.statut = 'en_cours'
            LEFT JOIN types_cultures tc ON c.id_type_culture = tc.id
            WHERE 1=1
        `;
        const params = [];

        if (statut) {
            sql += ' AND p.statut = ?';
            params.push(statut);
        }

        if (search) {
            sql += ' AND (p.reference LIKE ? OR p.nom_parcelle LIKE ? OR p.localisation LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY p.reference';

        const parcelles = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: parcelles
        });
    } catch (error) {
        console.error('Get parcelles error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des parcelles.'
        });
    }
});

/**
 * POST /parcelles - Créer une parcelle
 */
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
            loyer_annuel,
            photo
        } = req.body;

        const loyerAnnuelValue = loyer_annuel === '' ? null : loyer_annuel;

        // Validation
        if (!reference || !nom_parcelle || !superficie_hectares || !localisation || !type_sol) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO parcelles (
                reference, nom_parcelle, superficie_hectares, localisation,
                coordonnees_gps, type_sol, ph_sol, taux_humidite,
                irrigation_installee, proprietaire, loyer_annuel, statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;

        const result = await db.query(sql, [
            reference,
            nom_parcelle,
            superficie_hectares,
            localisation,
            coordonnees_gps,
            type_sol,
            ph_sol,
            taux_humidite,
            irrigation_installee || 0,
            proprietaire || 'propre',
            loyerAnnuelValue
        ]);

        // Enregistrement de la dépense de location si applicable
        if (loyerAnnuelValue && loyerAnnuelValue > 0) {
            await enregistrerDansBudgetDepartement({
                id_departement: req.user.id_departement,
                type_mouvement: 'depense',
                categorie: 'location_terrain',
                description: `Location parcelle - ${nom_parcelle} (${reference})`,
                montant: loyerAnnuelValue,
                reference: reference,
                effectue_par: req.userId
            });
        }


        res.status(201).json({
            success: true,
            message: 'Parcelle créée avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create parcelle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la parcelle.'
        });
    }
});

/**
 * PUT /parcelles/:id - Modifier une parcelle
 */
router.put('/parcelles/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
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
            statut,
            proprietaire,
            loyer_annuel,
            photo
        } = req.body;

        const sql = `
            UPDATE parcelles SET
                reference = ?,
                nom_parcelle = ?,
                superficie_hectares = ?,
                localisation = ?,
                coordonnees_gps = ?,
                type_sol = ?,
                ph_sol = ?,
                taux_humidite = ?,
                irrigation_installee = ?,
                statut = ?,
                proprietaire = ?,
                loyer_annuel = ?
            WHERE id = ?
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
            irrigation_installee,
            statut,
            proprietaire,
            loyer_annuel,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Parcelle modifiée avec succès.'
        });
    } catch (error) {
        console.error('Update parcelle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de la parcelle.'
        });
    }
});

/**
 * DELETE /parcelles/:id - Supprimer une parcelle
 */
router.delete('/parcelles/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si des cultures sont liées
        const [culturesActives] = await db.query(
            'SELECT COUNT(*) as count FROM cultures WHERE id_parcelle = ? AND statut = "en_cours"',
            [id]
        );

        if (culturesActives.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer: des cultures sont en cours sur cette parcelle.'
            });
        }

        await db.query('UPDATE parcelles SET statut = "abandonnee" WHERE id = ?', [id]);

        res.status(200).json({
            success: true,
            message: 'Parcelle supprimée avec succès.'
        });
    } catch (error) {
        console.error('Delete parcelle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la parcelle.'
        });
    }
});

// ============================================
// AGRICULTURE - CULTURES
// ============================================

/**
 * GET /cultures - Liste des cultures
 */
router.get('/cultures', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const { id_parcelle, statut, id_type_culture } = req.query;

        let sql = `
            SELECT 
                c.*,
                p.reference as parcelle_reference,
                p.nom_parcelle,
                tc.nom_culture,
                tc.duree_cycle_jours as duree_cycle
            FROM cultures c
            JOIN parcelles p ON c.id_parcelle = p.id
            JOIN types_cultures tc ON c.id_type_culture = tc.id
            WHERE 1=1
        `;
        const params = [];

        if (id_parcelle) {
            sql += ' AND c.id_parcelle = ?';
            params.push(id_parcelle);
        }

        if (statut) {
            sql += ' AND c.statut = ?';
            params.push(statut);
        }

        if (id_type_culture) {
            sql += ' AND c.id_type_culture = ?';
            params.push(id_type_culture);
        }

        sql += ' ORDER BY c.date_semaison DESC';

        const cultures = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: cultures
        });
    } catch (error) {
        console.error('Get cultures error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des cultures.'
        });
    }
});

/**
 * POST /cultures - Démarrer une nouvelle culture
 */
router.post('/cultures', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const {
            id_parcelle,
            id_type_culture,
            reference_saison,
            date_semaison,
            date_levage_prevue,
            date_recolte_prevue,
            quantite_semences_kg,
            densite_semis,
            commentaires
        } = req.body;

        // Validation
        if (!id_parcelle || !id_type_culture || !reference_saison || !date_semaison || !date_recolte_prevue) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Vérifier si parcelle disponible
        const [parcelle] = await db.query(
            'SELECT statut FROM parcelles WHERE id = ?',
            [id_parcelle]
        );

        if (!parcelle || parcelle.statut === 'en_culture') {
            return res.status(400).json({
                success: false,
                message: 'Parcelle non disponible pour nouvelle culture.'
            });
        }

        const sql = `
            INSERT INTO cultures (
                id_parcelle, id_type_culture, reference_saison, date_semaison,
                date_levage_prevue, date_recolte_prevue, quantite_semences_kg,
                densite_semis, commentaires, statut, stade_croissance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_cours', 'semis')
        `;

        const result = await db.query(sql, [
            id_parcelle,
            id_type_culture,
            reference_saison,
            date_semaison,
            date_levage_prevue,
            date_recolte_prevue,
            quantite_semences_kg,
            densite_semis,
            commentaires
        ]);

        // Mettre à jour statut parcelle
        await db.query(
            'UPDATE parcelles SET statut = "en_culture", id_culture_actuelle = ? WHERE id = ?',
            [result.insertId, id_parcelle]
        );

        res.status(201).json({
            success: true,
            message: 'Culture démarrée avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create culture error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la culture.'
        });
    }
});

/**
 * PUT /cultures/:id/stade - Mettre à jour le stade de croissance
 */
router.put('/cultures/:id/stade', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const { id } = req.params;
        const { stade_croissance, commentaires } = req.body;

        const validStades = ['semis', 'levage', 'croissance', 'floraison', 'maturation', 'recolte'];

        if (!validStades.includes(stade_croissance)) {
            return res.status(400).json({
                success: false,
                message: 'Stade de croissance invalide.'
            });
        }

        await db.query(
            'UPDATE cultures SET stade_croissance = ?, commentaires = CONCAT(IFNULL(commentaires, ""), "\n", ?) WHERE id = ?',
            [stade_croissance, `${new Date().toISOString()}: Passage au stade ${stade_croissance}. ${commentaires || ''}`, id]
        );

        res.status(200).json({
            success: true,
            message: 'Stade de croissance mis à jour.'
        });
    } catch (error) {
        console.error('Update stade error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du stade.'
        });
    }
});

// ============================================
// ÉLEVAGE - ANIMAUX
// ============================================

/**
 * GET /animaux - Liste des animaux
 */
router.get('/animaux', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const {
            espece,
            race,
            sexe,
            statut,
            statut_sante,
            search
        } = req.query;

        // conversions sûres pour pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;

        let sql = `
            SELECT 
                a.*,
                m.numero_identification as mere_numero,
                p.numero_identification as pere_numero
            FROM animaux a
            LEFT JOIN animaux m ON a.id_mere = m.id
            LEFT JOIN animaux p ON a.id_pere = p.id
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
                a.nom_animal LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        sql += ' ORDER BY a.date_naissance DESC';

        const offset = (page - 1) * limit;
        // injecter LIMIT / OFFSET directement
        sql += ` LIMIT ${limit} OFFSET ${offset}`;

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

/**
 * POST /animaux - Enregistrer un nouvel animal
 */
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
            poids_actuel,
            couleur,
            marques_distinctives,
            origine,
            id_fournisseur,
            id_mere,
            id_pere,
            prix_achat,
            date_acquisition,
            photo,
            certificat_veterinaire
        } = req.body;

        // Validation
        if (!numero_identification || !espece || !race || !sexe || !date_naissance) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Vérifier unicité numéro identification
        const [existant] = await db.query(
            'SELECT id FROM animaux WHERE numero_identification = ?',
            [numero_identification]
        );

        if (existant) {
            return res.status(400).json({
                success: false,
                message: 'Un animal avec ce numéro d\'identification existe déjà.'
            });
        }

        const sql = `
            INSERT INTO animaux (
                numero_identification, nom_animal, espece, race, sexe,
                date_naissance, poids_naissance, poids_actuel, couleur,
                marques_distinctives, origine, id_fournisseur, id_mere,
                id_pere, prix_achat, date_acquisition, photo,
                certificat_veterinaire, statut, statut_sante
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vivant', 'bon')
        `;

        const formatDate = (date) => {
            if (!date) return null;
            return new Date(date).toISOString().split('T')[0];
        };

        const result = await db.query(sql, [
            numero_identification,
            nom_animal,
            espece,
            race,
            sexe,
            formatDate(date_naissance),
            poids_naissance,
            poids_actuel || poids_naissance,
            couleur,
            marques_distinctives,
            origine || 'achat',
            id_fournisseur,
            id_mere,
            id_pere,
            prix_achat,
            formatDate(date_acquisition || new Date()),
            photo,
            certificat_veterinaire
        ]);

        // Enregistrer achat dans journal si prix fourni
        if (prix_achat && prix_achat > 0 && origine === 'achat') {
            let fournisseurNom = null;
            if (id_fournisseur) {
                const [fournisseur] = await db.query(
                    'SELECT nom_fournisseur FROM fournisseurs WHERE id = ?',
                    [id_fournisseur]
                );
                fournisseurNom = fournisseur?.nom_fournisseur;
            }

            await enregistrerJournalComptable({
                categorie: 'achat',
                type_mouvement: 'depense',
                libelle: `Achat animal - ${numero_identification}`,
                description: `Achat ${espece} ${race} - ${nom_animal || numero_identification}`,
                montant: prix_achat,
                compte_debit: '215 - Cheptel',
                compte_credit: '401 - Fournisseurs',
                table_source: 'animaux',
                id_source: result.insertId,
                tiers_type: 'fournisseur',
                tiers_id: id_fournisseur,
                tiers_nom: fournisseurNom,
                effectue_par: req.userId,
                reference_externe: numero_identification,
                donnees_complementaires: {
                    espece,
                    race,
                    sexe,
                    date_naissance,
                    origine
                }
            });

            // Enregistrer la dépense dans le budget du département
            await enregistrerDansBudgetDepartement({
                id_departement: req.user.id_departement,
                type_mouvement: 'depense',
                categorie: 'achat',
                description: `Achat animal - ${numero_identification}`,
                montant: prix_achat,
                reference: numero_identification,
                effectue_par: req.userId
            });
        }

        res.status(201).json({
            success: true,
            message: 'Animal enregistré avec succès.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create animal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'animal.'
        });
    }
});

/**
 * PUT /animaux/:id - Modifier un animal
 */
router.put('/animaux/:id', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom_animal,
            poids_actuel,
            couleur,
            marques_distinctives,
            statut,
            statut_sante,
            photo
        } = req.body;

        const sql = `
            UPDATE animaux SET
                nom_animal = ?,
                poids_actuel = ?,
                couleur = ?,
                marques_distinctives = ?,
                statut = ?,
                statut_sante = ?,
                photo = ?
            WHERE id = ?
        `;

        await db.query(sql, [
            nom_animal,
            poids_actuel,
            couleur,
            marques_distinctives,
            statut,
            statut_sante,
            photo,
            id
        ]);

        res.status(200).json({
            success: true,
            message: 'Animal modifié avec succès.'
        });
    } catch (error) {
        console.error('Update animal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de l\'animal.'
        });
    }
});

/**
 * DELETE /animaux/:id - Marquer un animal comme vendu/décédé
 */
router.delete('/animaux/:id', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { raison_sortie, date_sortie } = req.body;

        await db.query(
            'UPDATE animaux SET statut = "decede", date_sortie = ?, raison_sortie = ? WHERE id = ?',
            [(date_sortie ? new Date(date_sortie) : new Date()).toISOString().split('T')[0], raison_sortie || 'Non spécifié', id]
        );

        res.status(200).json({
            success: true,
            message: 'Animal marqué comme sorti du cheptel.'
        });
    } catch (error) {
        console.error('Delete animal error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la sortie de l\'animal.'
        });
    }
});

// ============================================
// ÉLEVAGE - SUIVIS SANITAIRES
// ============================================

/**
 * POST /suivis-sanitaires - Enregistrer une intervention sanitaire
 */
router.post('/suivis-sanitaires', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
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
            veterinaire,
            id_technicien,
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
                id_animal, type_intervention, date_intervention, symptomes,
                diagnostic, produit_utilise, dosage, mode_administration,
                veterinaire, id_technicien, date_prochaine_visite,
                instructions_suivi, observations, cout_intervention
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            id_animal,
            type_intervention,
            (date_intervention ? new Date(date_intervention) : new Date()).toISOString().split('T')[0],
            symptomes,
            diagnostic,
            produit_utilise,
            dosage,
            mode_administration,
            veterinaire,
            id_technicien || req.userId,
            date_prochaine_visite ? new Date(date_prochaine_visite).toISOString().split('T')[0] : null,
            instructions_suivi,
            observations,
            cout_intervention || 0
        ]);

        // Mettre à jour statut santé animal
        if (type_intervention === 'traitement') {
            await db.query(
                'UPDATE animaux SET statut_sante = "en_traitement" WHERE id = ?',
                [id_animal]
            );
        } else if (type_intervention === 'vaccination') {
            await db.query(
                'UPDATE animaux SET derniere_vaccination = ?, prochaine_vaccination = ? WHERE id = ?',
                [
                    (date_intervention ? new Date(date_intervention) : new Date()).toISOString().split('T')[0],
                    date_prochaine_visite ? new Date(date_prochaine_visite).toISOString().split('T')[0] : null,
                    id_animal
                ]
            );
        }

        // Enregistrer coût dans journal si présent
        if (cout_intervention && cout_intervention > 0) {
            const [animal] = await db.query(
                'SELECT numero_identification, espece FROM animaux WHERE id = ?',
                [id_animal]
            );

            await enregistrerJournalComptable({
                categorie: 'autre',
                type_mouvement: 'depense',
                libelle: `Soins vétérinaires - ${animal.numero_identification}`,
                description: `${type_intervention} - ${diagnostic}`,
                montant: cout_intervention,
                compte_debit: '614 - Charges vétérinaires',
                compte_credit: '512 - Banque',
                table_source: 'suivis_sanitaires',
                id_source: result.insertId,
                effectue_par: req.userId,
                reference_externe: `SS-${result.insertId}`,
                donnees_complementaires: {
                    animal_id: id_animal,
                    numero_identification: animal.numero_identification,
                    type_intervention,
                    veterinaire
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Intervention sanitaire enregistrée.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create suivi sanitaire error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'intervention.'
        });
    }
});

// ============================================
// ÉLEVAGE - PRODUCTIONS LAIT
// ============================================

/**
 * POST /productions-lait - Enregistrer production de lait
 */
router.post('/productions-lait', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const {
            id_animal,
            date_production,
            quantite_litres,
            taux_matiere_grasse,
            taux_proteine,
            temperature,
            ph,
            qualite,
            observations,
            heure_traite,
            methode_traite,
            destination,
            id_reservoir
        } = req.body;

        // Validation
        if (!id_animal || !quantite_litres || !heure_traite) {
            return res.status(400).json({
                success: false,
                message: 'Animal, quantité et heure de traite requis.'
            });
        }

        const sql = `
            INSERT INTO productions_lait (
                id_animal, date_production, quantite_litres, taux_matiere_grasse,
                taux_proteine, temperature, ph, qualite, observations,
                traite_par, heure_traite, methode_traite, destination, id_reservoir
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            id_animal,
            (date_production ? new Date(date_production) : new Date()).toISOString().split('T')[0],
            quantite_litres,
            taux_matiere_grasse,
            taux_proteine,
            temperature,
            ph,
            qualite || 'B',
            observations,
            req.userId,
            heure_traite,
            methode_traite || 'manuel',
            destination || 'vente',
            id_reservoir
        ]);

        // Note: Le trigger 'trigger_journal_production_lait' se déclenche automatiquement

        res.status(201).json({
            success: true,
            message: 'Production de lait enregistrée.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create production lait error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la production.'
        });
    }
});

// ============================================
// ÉLEVAGE - PRODUCTIONS OEUFS
// ============================================

/**
 * POST /productions-oeufs - Enregistrer production d'oeufs
 */
router.post('/productions-oeufs', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            id_poulailler,
            date_recolte,
            nombre_oeufs,
            oeufs_casses,
            oeufs_sales,
            calibre_petit,
            calibre_moyen,
            calibre_gros,
            calibre_extra_gros,
            taux_fertile,
            observations,
            heure_recolte,
            stockage_temperature,
            destination
        } = req.body;

        // Validation
        if (!id_poulailler || !nombre_oeufs || !heure_recolte) {
            return res.status(400).json({
                success: false,
                message: 'Poulailler, nombre d\'oeufs et heure requis.'
            });
        }

        const sql = `
            INSERT INTO productions_oeufs (
                id_poulailler, date_recolte, nombre_oeufs, oeufs_casses,
                oeufs_sales, calibre_petit, calibre_moyen, calibre_gros,
                calibre_extra_gros, taux_fertile, observations, recolte_par,
                heure_recolte, stockage_temperature, destination
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(sql, [
            id_poulailler,
            (date_recolte ? new Date(date_recolte) : new Date()).toISOString().split('T')[0],
            nombre_oeufs,
            oeufs_casses || 0,
            oeufs_sales || 0,
            calibre_petit || 0,
            calibre_moyen || 0,
            calibre_gros || 0,
            calibre_extra_gros || 0,
            taux_fertile,
            observations,
            req.userId,
            heure_recolte,
            stockage_temperature,
            destination || 'vente'
        ]);

        // Note: Le trigger 'trigger_journal_production_oeufs' se déclenche automatiquement

        res.status(201).json({
            success: true,
            message: 'Production d\'oeufs enregistrée.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create production oeufs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la production.'
        });
    }
});

// ============================================
// STATISTIQUES & DASHBOARDS
// ============================================

/**
 * GET /stats/flotte - Statistiques de la flotte
 */
router.get('/stats/flotte', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const stats = {};

        // Nombre total de véhicules
        const [totalVehicules] = await db.query(
            'SELECT COUNT(*) as total FROM vehicules WHERE statut != "vendu"'
        );
        stats.total_vehicules = totalVehicules.total;

        // Véhicules disponibles
        const [disponibles] = await db.query(
            'SELECT COUNT(*) as total FROM vehicules WHERE disponible = 1 AND statut = "actif"'
        );
        stats.vehicules_disponibles = disponibles.total;

        // Maintenances à venir (30 jours)
        const [maintenancesProchaines] = await db.query(`
            SELECT COUNT(*) as total 
            FROM maintenances_vehicules 
            WHERE date_prochaine_maintenance BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND statut = 'planifie'
        `);
        stats.maintenances_prochaines = maintenancesProchaines.total;

        // Assurances à renouveler (30 jours)
        const [assurancesExpiration] = await db.query(`
            SELECT COUNT(*) as total 
            FROM assurances_vehicules 
            WHERE date_expiration BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND statut = 'active'
        `);
        stats.assurances_a_renouveler = assurancesExpiration.total;

        // Coûts du mois
        const [coutsMois] = await db.query(`
            SELECT 
                COALESCE(SUM(cout_maintenance), 0) as maintenance,
                (SELECT COALESCE(SUM(cout_carburant + cout_peages + autres_frais), 0) 
                 FROM mouvements_vehicules 
                 WHERE MONTH(date_mission) = MONTH(CURDATE()) 
                 AND YEAR(date_mission) = YEAR(CURDATE())) as mouvements
            FROM maintenances_vehicules
            WHERE MONTH(date_intervention) = MONTH(CURDATE())
            AND YEAR(date_intervention) = YEAR(CURDATE())
        `);
        stats.couts_mois = {
            maintenance: coutsMois.maintenance,
            mouvements: coutsMois.mouvements,
            total: parseFloat(coutsMois.maintenance) + parseFloat(coutsMois.mouvements)
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats flotte error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

/**
 * GET /stats/agriculture - Statistiques agriculture
 */
router.get('/stats/agriculture', authenticate, authorize('admin', 'manager', 'agriculteur'), async (req, res) => {
    try {
        const stats = {};

        // Parcelles actives
        const [parcellesActives] = await db.query(
            'SELECT COUNT(*) as total FROM parcelles WHERE statut = "active"'
        );
        stats.parcelles_actives = parcellesActives.total;

        // Cultures en cours
        const [culturesEnCours] = await db.query(
            'SELECT COUNT(*) as total FROM cultures WHERE statut = "en_cours"'
        );
        stats.cultures_en_cours = culturesEnCours.total;

        // Récoltes à venir (30 jours)
        const [recoltesProchaines] = await db.query(`
            SELECT COUNT(*) as total 
            FROM cultures 
            WHERE date_recolte_prevue BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND statut = 'en_cours'
        `);
        stats.recoltes_prochaines = recoltesProchaines.total;

        // Production du mois
        const [productionMois] = await db.query(`
            SELECT COALESCE(SUM(rendement_obtenu_kg), 0) as total
            FROM recoltes
            WHERE MONTH(date_recolte_reelle) = MONTH(CURDATE())
            AND YEAR(date_recolte_reelle) = YEAR(CURDATE())
        `);
        stats.production_mois = productionMois.total;

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats agriculture error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

/**
 * GET /stats/elevage - Statistiques élevage
 */
router.get('/stats/elevage', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const stats = {};

        // Animaux par espèce
        const animauxParEspece = await db.query(`
            SELECT espece, COUNT(*) as total
            FROM animaux
            WHERE statut = 'vivant'
            GROUP BY espece
        `);
        stats.par_espece = animauxParEspece;

        // Total animaux
        const [totalAnimaux] = await db.query(
            'SELECT COUNT(*) as total FROM animaux WHERE statut = "vivant"'
        );
        stats.total_animaux = totalAnimaux.total;

        // Animaux en production
        const [enProduction] = await db.query(
            'SELECT COUNT(*) as total FROM animaux WHERE statut_production = "en_production"'
        );
        stats.animaux_en_production = enProduction.total;

        // Animaux en traitement
        const [enTraitement] = await db.query(
            'SELECT COUNT(*) as total FROM animaux WHERE statut_sante = "en_traitement"'
        );
        stats.animaux_en_traitement = enTraitement.total;

        // Production lait du mois
        const [productionLait] = await db.query(`
            SELECT COALESCE(SUM(quantite_litres), 0) as total
            FROM productions_lait
            WHERE MONTH(date_production) = MONTH(CURDATE())
            AND YEAR(date_production) = YEAR(CURDATE())
        `);
        stats.production_lait_mois = productionLait.total;

        // Production oeufs du mois
        const [productionOeufs] = await db.query(`
            SELECT COALESCE(SUM(nombre_oeufs), 0) as total
            FROM productions_oeufs
            WHERE MONTH(date_recolte) = MONTH(CURDATE())
            AND YEAR(date_recolte) = YEAR(CURDATE())
        `);
        stats.production_oeufs_mois = productionOeufs.total;

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats elevage error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

/**
 * GET /suivis-sanitaires - Liste des suivis sanitaires
 */
router.get('/suivis-sanitaires', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        // On essaie de joindre avec animaux si possible, sinon on fait un select simple
        const sql = `
            SELECT ss.*, a.numero_identification, a.nom_animal 
            FROM suivis_sanitaires ss
            LEFT JOIN animaux a ON ss.id_animal = a.id 
            ORDER BY ss.date_intervention DESC
        `;
        const [suivis] = await db.query(sql);
        res.status(200).json({
            success: true,
            data: suivis
        });
    } catch (error) {
        console.error('Get suivis sanitaires error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des suivis sanitaires.'
        });
    }
});

/**
 * GET /productions-lait - Historique production lait
 */
router.get('/productions-lait', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const sql = `
            SELECT pl.*, a.numero_identification, a.nom_animal 
            FROM productions_lait pl
            LEFT JOIN animaux a ON pl.id_animal = a.id 
            ORDER BY pl.date_production DESC
        `;
        const [productions] = await db.query(sql);
        res.status(200).json({
            success: true,
            data: productions
        });
    } catch (error) {
        console.error('Get productions lait error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la production de lait.'
        });
    }
});

/**
 * GET /productions-oeufs - Historique production oeufs
 */
router.get('/productions-oeufs', authenticate, authorize('admin', 'manager', 'veterinaire'), async (req, res) => {
    try {
        const sql = `
            SELECT po.* 
            FROM productions_oeufs po
            ORDER BY po.date_recolte DESC
        `;
        const [productions] = await db.query(sql);
        res.status(200).json({
            success: true,
            data: productions
        });
    } catch (error) {
        console.error('Get productions oeufs error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la production d\'oeufs.'
        });
    }
});

module.exports = router;