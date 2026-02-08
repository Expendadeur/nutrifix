const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');

// Gestion des véhicules
router.get('/vehicules', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const { 
            statut, 
            type, 
            departement,
            disponible,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT v.*, 
                   u.nom_complet as chauffeur_nom,
                   d.nom as departement_nom
            FROM vehicules v
            LEFT JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
            LEFT JOIN departements d ON v.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        // Filter by department for managers
        if (req.userRole === 'manager') {
            sql += ' AND v.id_departement = ?';
            params.push(req.user.id_departement);
        }

        // Filter for chauffeur - only assigned vehicle
        if (req.userRole === 'chauffeur') {
            sql += ' AND v.id_chauffeur_attitre = ?';
            params.push(req.userId);
        }

        if (statut) {
            sql += ' AND v.statut = ?';
            params.push(statut);
        }

        if (type) {
            sql += ' AND v.type_vehicule = ?';
            params.push(type);
        }

        if (departement) {
            sql += ' AND v.id_departement = ?';
            params.push(departement);
        }

        if (disponible !== undefined) {
            sql += ' AND v.disponible = ?';
            params.push(disponible === 'true');
        }

        sql += ' ORDER BY v.immatriculation ASC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const vehicules = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM vehicules WHERE 1=1`;
        const countParams = [];

        if (req.userRole === 'manager') {
            countSql += ' AND id_departement = ?';
            countParams.push(req.user.id_departement);
        }

        if (req.userRole === 'chauffeur') {
            countSql += ' AND id_chauffeur_attitre = ?';
            countParams.push(req.userId);
        }

        if (statut) {
            countSql += ' AND statut = ?';
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

// Créer un véhicule
router.post('/vehicules', authenticate, authorize('admin'), async (req, res) => {
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
            id_departement,
            id_chauffeur_attitre,
            prix_achat
        } = req.body;

        // Validation
        if (!immatriculation || !marque || !modele || !type_vehicule || !id_departement) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        const sql = `
            INSERT INTO vehicules (
                immatriculation, marque, modele, annee, couleur,
                type_vehicule, capacite_carburant, consommation_moyenne,
                id_departement, id_chauffeur_attitre, prix_achat,
                valeur_actuelle, date_achat, kilometrage_actuel
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 0)
        `;

        const valeur_actuelle = prix_achat || 0;

        await db.query(sql, [
            immatriculation,
            marque,
            modele,
            annee,
            couleur,
            type_vehicule,
            capacite_carburant,
            consommation_moyenne,
            id_departement,
            id_chauffeur_attitre,
            prix_achat,
            valeur_actuelle
        ]);

        res.status(201).json({
            success: true,
            message: 'Véhicule créé avec succès.'
        });
    } catch (error) {
        console.error('Create vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du véhicule.'
        });
    }
});

// Mouvements véhicules - Sortie
router.post('/mouvements/sortie', authenticate, authorize('admin', 'chauffeur'), async (req, res) => {
    try {
        const {
            id_vehicule,
            destination,
            motif,
            passagers,
            marchandise_transportee,
            kilometrage_depart
        } = req.body;

        // Validation
        if (!id_vehicule || !destination || !motif || !kilometrage_depart) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants.'
            });
        }

        // Check if chauffeur is assigned to this vehicle
        if (req.userRole === 'chauffeur') {
            const checkSql = `SELECT id FROM vehicules WHERE id = ? AND id_chauffeur_attitre = ?`;
            const [vehicle] = await db.query(checkSql, [id_vehicule, req.userId]);
            
            if (!vehicle) {
                return res.status(403).json({
                    success: false,
                    message: 'Vous n\'êtes pas assigné à ce véhicule.'
                });
            }
        }

        // Check if vehicle is available
        const vehicleSql = `SELECT disponible FROM vehicules WHERE id = ?`;
        const [vehicle] = await db.query(vehicleSql, [id_vehicule]);
        
        if (!vehicle || !vehicle.disponible) {
            return res.status(400).json({
                success: false,
                message: 'Véhicule non disponible.'
            });
        }

        // Insert movement
        const sql = `
            INSERT INTO mouvements_vehicules (
                id_vehicule, id_chauffeur, type_mouvement,
                date_mission, heure_depart, kilometrage_depart,
                destination, motif, passagers, marchandise_transportee
            ) VALUES (?, ?, 'sortie', CURDATE(), CURTIME(), ?, ?, ?, ?, ?)
        `;

        const chauffeurId = req.userRole === 'chauffeur' ? req.userId : req.body.id_chauffeur;

        await db.query(sql, [
            id_vehicule,
            chauffeurId,
            kilometrage_depart,
            destination,
            motif,
            passagers ? JSON.stringify(passagers) : null,
            marchandise_transportee
        ]);

        // Update vehicle status
        await db.query('UPDATE vehicules SET disponible = FALSE WHERE id = ?', [id_vehicule]);

        res.status(201).json({
            success: true,
            message: 'Sortie de véhicule enregistrée.'
        });
    } catch (error) {
        console.error('Sortie vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la sortie.'
        });
    }
});

// Mouvements véhicules - Retour
router.post('/mouvements/retour', authenticate, authorize('admin', 'chauffeur'), async (req, res) => {
    try {
        const {
            id_mouvement,
            kilometrage_retour,
            cout_carburant,
            quantite_carburant,
            cout_peages,
            autres_frais
        } = req.body;

        // Validation
        if (!id_mouvement || !kilometrage_retour) {
            return res.status(400).json({
                success: false,
                message: 'ID mouvement et kilométrage retour requis.'
            });
        }

        // Get movement details
        const mouvementSql = `
            SELECT mv.*, v.id as vehicle_id
            FROM mouvements_vehicules mv
            JOIN vehicules v ON mv.id_vehicule = v.id
            WHERE mv.id = ? AND mv.type_mouvement = 'sortie' AND mv.statut = 'en_cours'
        `;
        const [mouvement] = await db.query(mouvementSql, [id_mouvement]);

        if (!mouvement) {
            return res.status(404).json({
                success: false,
                message: 'Mouvement de sortie non trouvé.'
            });
        }

        // Check authorization for chauffeur
        if (req.userRole === 'chauffeur' && mouvement.id_chauffeur !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à modifier ce mouvement.'
            });
        }

        // Update movement
        const updateSql = `
            UPDATE mouvements_vehicules 
            SET type_mouvement = 'retour',
                heure_retour = CURTIME(),
                kilometrage_retour = ?,
                cout_carburant = ?,
                quantite_carburant = ?,
                cout_peages = ?,
                autres_frais = ?,
                statut = 'termine',
                valide_par = ?,
                date_validation = NOW()
            WHERE id = ?
        `;

        await db.query(updateSql, [
            kilometrage_retour,
            cout_carburant || 0,
            quantite_carburant || 0,
            cout_peages || 0,
            autres_frais || 0,
            req.userId,
            id_mouvement
        ]);

        // Update vehicle mileage and status
        await db.query(`
            UPDATE vehicules 
            SET kilometrage_actuel = ?,
                disponible = TRUE
            WHERE id = ?
        `, [kilometrage_retour, mouvement.id_vehicule]);

        res.status(200).json({
            success: true,
            message: 'Retour de véhicule enregistré.'
        });
    } catch (error) {
        console.error('Retour vehicule error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du retour.'
        });
    }
});

// Obtenir les mouvements d'un véhicule
router.get('/mouvements/:vehiculeId', authenticate, async (req, res) => {
    try {
        const vehiculeId = parseInt(req.params.vehiculeId);
        const { 
            startDate, 
            endDate,
            statut,
            page = 1,
            limit = 30
        } = req.query;

        // Check authorization
        const vehicleSql = `SELECT id_departement FROM vehicules WHERE id = ?`;
        const [vehicle] = await db.query(vehicleSql, [vehiculeId]);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Véhicule non trouvé.'
            });
        }

        // For managers, check department
        if (req.userRole === 'manager' && vehicle.id_departement !== req.user.id_departement) {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé.'
            });
        }

        // For chauffeur, check assignment
        if (req.userRole === 'chauffeur') {
            const assignedSql = `SELECT id FROM vehicules WHERE id = ? AND id_chauffeur_attitre = ?`;
            const [assigned] = await db.query(assignedSql, [vehiculeId, req.userId]);
            
            if (!assigned) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès non autorisé.'
                });
            }
        }

        let sql = `
            SELECT mv.*, 
                   v.immatriculation,
                   v.marque,
                   v.modele,
                   u.nom_complet as chauffeur_nom,
                   val.nom_complet as validateur_nom
            FROM mouvements_vehicules mv
            JOIN vehicules v ON mv.id_vehicule = v.id
            LEFT JOIN utilisateurs u ON mv.id_chauffeur = u.id
            LEFT JOIN utilisateurs val ON mv.valide_par = val.id
            WHERE mv.id_vehicule = ?
        `;
        const params = [vehiculeId];

        if (startDate) {
            sql += ' AND mv.date_mission >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND mv.date_mission <= ?';
            params.push(endDate);
        }

        if (statut) {
            sql += ' AND mv.statut = ?';
            params.push(statut);
        }

        sql += ' ORDER BY mv.date_mission DESC, mv.heure_depart DESC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const mouvements = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM mouvements_vehicules WHERE id_vehicule = ?`;
        const countParams = [vehiculeId];

        if (startDate) {
            countSql += ' AND date_mission >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countSql += ' AND date_mission <= ?';
            countParams.push(endDate);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: mouvements,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get mouvements error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des mouvements.'
        });
    }
});

// Gestion des maintenances
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

        // Calculate next maintenance (simplified)
        const date_prochaine_maintenance = new Date();
        date_prochaine_maintenance.setDate(date_prochaine_maintenance.getDate() + 90); // 90 days default

        const sql = `
            INSERT INTO maintenances_vehicules (
                id_vehicule, type_maintenance, description,
                fournisseur, numero_facture, cout_maintenance,
                kilometrage, date_intervention, date_prochaine_maintenance,
                garantie_jours, photos, valide_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            id_vehicule,
            type_maintenance,
            description,
            fournisseur,
            numero_facture,
            cout_maintenance,
            kilometrage,
            date_intervention || new Date(),
            date_prochaine_maintenance,
            garantie_jours || 0,
            photos ? JSON.stringify(photos) : null,
            req.userId
        ]);

        res.status(201).json({
            success: true,
            message: 'Maintenance enregistrée avec succès.'
        });
    } catch (error) {
        console.error('Create maintenance error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de la maintenance.'
        });
    }
});

// Obtenir les maintenances d'un véhicule
router.get('/maintenances/:vehiculeId', authenticate, async (req, res) => {
    try {
        const vehiculeId = parseInt(req.params.vehiculeId);
        const { 
            type,
            statut,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        let sql = `
            SELECT m.*, 
                   v.immatriculation,
                   v.marque,
                   v.modele,
                   val.nom_complet as validateur_nom
            FROM maintenances_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            LEFT JOIN utilisateurs val ON m.valide_par = val.id
            WHERE m.id_vehicule = ?
        `;
        const params = [vehiculeId];

        if (type) {
            sql += ' AND m.type_maintenance = ?';
            params.push(type);
        }

        if (statut) {
            sql += ' AND m.statut = ?';
            params.push(statut);
        }

        if (startDate) {
            sql += ' AND m.date_intervention >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND m.date_intervention <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY m.date_intervention DESC';
        
        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const maintenances = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM maintenances_vehicules WHERE id_vehicule = ?`;
        const countParams = [vehiculeId];

        if (type) {
            countSql += ' AND type_maintenance = ?';
            countParams.push(type);
        }

        const [countResult] = await db.query(countSql, countParams);

        res.status(200).json({
            success: true,
            data: maintenances,
            pagination: {
                total: countResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get maintenances error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des maintenances.'
        });
    }
});

// Gestion des assurances
router.post('/assurances', authenticate, authorize('admin'), async (req, res) => {
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
        if (!id_vehicule || !compagnie_assurance || !numero_police || !type_couverture || 
            !date_debut || !date_expiration || !montant_prime) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires sont requis.'
            });
        }

        const sql = `
            INSERT INTO assurances_vehicules (
                id_vehicule, compagnie_assurance, numero_police,
                type_couverture, date_debut, date_expiration,
                montant_prime, franchise, scan_police, scan_attestation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            id_vehicule,
            compagnie_assurance,
            numero_police,
            type_couverture,
            date_debut,
            date_expiration,
            montant_prime,
            franchise || 0,
            scan_police,
            scan_attestation
        ]);

        res.status(201).json({
            success: true,
            message: 'Assurance enregistrée avec succès.'
        });
    } catch (error) {
        console.error('Create assurance error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'assurance.'
        });
    }
});

// Obtenir les assurances expirantes
router.get('/assurances/expirantes', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const { jours } = req.query;
        const joursAvantExpiration = jours || 30;

        let sql = `
            SELECT a.*, 
                   v.immatriculation,
                   v.marque,
                   v.modele,
                   u.nom_complet as chauffeur_nom
            FROM assurances_vehicules a
            JOIN vehicules v ON a.id_vehicule = v.id
            LEFT JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
            WHERE a.statut = 'active'
            AND DATEDIFF(a.date_expiration, CURDATE()) <= ?
        `;
        const params = [joursAvantExpiration];

        // Filter by department for managers
        if (req.userRole === 'manager') {
            sql += ' AND v.id_departement = ?';
            params.push(req.user.id_departement);
        }

        // Filter for chauffeur
        if (req.userRole === 'chauffeur') {
            sql += ' AND v.id_chauffeur_attitre = ?';
            params.push(req.userId);
        }

        sql += ' ORDER BY a.date_expiration ASC';

        const assurances = await db.query(sql, params);

        res.status(200).json({
            success: true,
            data: assurances
        });
    } catch (error) {
        console.error('Get expiring assurances error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des assurances expirantes.'
        });
    }
});

// Statistiques flotte
router.get('/statistiques', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { departement, startDate, endDate } = req.query;

        // Vehicle statistics
        let vehicleSql = `
            SELECT 
                COUNT(*) as total_vehicules,
                SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as actifs,
                SUM(CASE WHEN statut = 'maintenance' THEN 1 ELSE 0 END) as en_maintenance,
                SUM(CASE WHEN type_vehicule = 'camion' THEN 1 ELSE 0 END) as camions,
                SUM(CASE WHEN type_vehicule = 'pickup' THEN 1 ELSE 0 END) as pickups,
                SUM(CASE WHEN type_vehicule = 'voiture' THEN 1 ELSE 0 END) as voitures,
                AVG(kilometrage_actuel) as km_moyen,
                SUM(prix_achat) as valeur_total_achat
            FROM vehicules
            WHERE 1=1
        `;
        const vehicleParams = [];

        if (departement) {
            vehicleSql += ' AND id_departement = ?';
            vehicleParams.push(departement);
        } else if (req.userRole === 'manager') {
            vehicleSql += ' AND id_departement = ?';
            vehicleParams.push(req.user.id_departement);
        }

        const [vehicleStats] = await db.query(vehicleSql, vehicleParams);

        // Movement statistics
        let movementSql = `
            SELECT 
                COUNT(*) as total_missions,
                SUM(distance_parcourue) as total_km,
                AVG(distance_parcourue) as km_moyen_mission,
                SUM(total_frais) as total_frais,
                AVG(total_frais) as frais_moyen_mission,
                COUNT(DISTINCT id_chauffeur) as chauffeurs_actifs
            FROM mouvements_vehicules
            WHERE statut = 'termine'
        `;
        const movementParams = [];

        if (startDate) {
            movementSql += ' AND date_mission >= ?';
            movementParams.push(startDate);
        }

        if (endDate) {
            movementSql += ' AND date_mission <= ?';
            movementParams.push(endDate);
        }

        const [movementStats] = await db.query(movementSql, movementParams);

        // Maintenance statistics
        const maintenanceSql = `
            SELECT 
                COUNT(*) as total_maintenances,
                SUM(cout_maintenance) as total_cout_maintenance,
                AVG(cout_maintenance) as cout_moyen_maintenance,
                COUNT(CASE WHEN statut = 'planifie' THEN 1 END) as planifiees,
                COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as en_cours
            FROM maintenances_vehicules
            WHERE 1=1
        `;

        const [maintenanceStats] = await db.query(maintenanceSql);

        res.status(200).json({
            success: true,
            data: {
                vehicules: vehicleStats,
                mouvements: movementStats,
                maintenances: maintenanceStats
            }
        });
    } catch (error) {
        console.error('Get flotte stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques.'
        });
    }
});

// Alertes flotte (maintenances, assurances)
router.get('/alertes', authenticate, authorize('admin', 'manager', 'chauffeur'), async (req, res) => {
    try {
        const alertes = [];

        // Maintenances à venir
        const maintenanceSql = `
            SELECT m.*, v.immatriculation
            FROM maintenances_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE m.statut = 'planifie'
            AND m.date_intervention <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `;
        const maintenances = await db.query(maintenanceSql);

        maintenances.forEach(m => {
            alertes.push({
                type: 'maintenance',
                niveau: 'warning',
                titre: 'Maintenance à venir',
                message: `Maintenance prévue pour ${m.immatriculation} le ${m.date_intervention}`,
                date: m.date_intervention,
                vehicule_id: m.id_vehicule
            });
        });

        // Assurances expirantes
        const assuranceSql = `
            SELECT a.*, v.immatriculation
            FROM assurances_vehicules a
            JOIN vehicules v ON a.id_vehicule = v.id
            WHERE a.statut = 'active'
            AND a.date_expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        `;
        const assurances = await db.query(assuranceSql);

        assurances.forEach(a => {
            const joursRestants = Math.ceil((new Date(a.date_expiration) - new Date()) / (1000 * 60 * 60 * 24));
            let niveau = 'info';
            
            if (joursRestants <= 7) niveau = 'urgent';
            else if (joursRestants <= 15) niveau = 'high';
            else if (joursRestants <= 30) niveau = 'warning';

            alertes.push({
                type: 'assurance',
                niveau: niveau,
                titre: 'Assurance expirante',
                message: `Assurance de ${a.immatriculation} expire dans ${joursRestants} jours`,
                date: a.date_expiration,
                vehicule_id: a.id_vehicule
            });
        });

        // Véhicules en maintenance longue
        const vehiculeSql = `
            SELECT v.*, DATEDIFF(CURDATE(), (
                SELECT MAX(date_intervention)
                FROM maintenances_vehicules mv
                WHERE mv.id_vehicule = v.id
                AND mv.statut = 'termine'
            )) as jours_depuis_derniere_maintenance
            FROM vehicules v
            WHERE v.statut = 'maintenance'
            AND v.id_departement = ?
        `;
        const vehiculeParams = [req.userRole === 'manager' ? req.user.id_departement : null].filter(p => p);
        const vehicules = await db.query(vehiculeSql, vehiculeParams);

        vehicules.forEach(v => {
            if (v.jours_depuis_derniere_maintenance > 30) {
                alertes.push({
                    type: 'vehicule',
                    niveau: 'warning',
                    titre: 'Véhicule en maintenance longue',
                    message: `${v.immatriculation} est en maintenance depuis ${v.jours_depuis_derniere_maintenance} jours`,
                    vehicule_id: v.id
                });
            }
        });

        res.status(200).json({
            success: true,
            data: alertes
        });
    } catch (error) {
        console.error('Get alertes error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des alertes.'
        });
    }
});

module.exports = router;
