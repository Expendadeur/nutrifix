// backend/api/routes/chauffeur.js - Routes API Chauffeur (Structure DB Réelle)
const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const emailService = require('../emailService');
const multer = require('multer');
const path = require('path');

// Configuration Multer pour upload fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/justificatifs/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Format de fichier non autorisé'));
    }
});

// ============================================
// 1. DASHBOARD - DONNÉES GÉNÉRALES
// ============================================
router.get('/dashboard', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        // Statistiques du jour
        const [stats] = await db.query(`
            SELECT 
                COUNT(DISTINCT m.id) as missions_today,
                COALESCE(SUM(m.distance_parcourue), 0) as km_today,
                (SELECT COUNT(*) FROM frais_vehicules 
                 WHERE id_mouvement IN (SELECT id FROM mouvements_vehicules WHERE id_chauffeur = ?)
                 AND valide = 0) as frais_pending,
                (SELECT COUNT(*) FROM mouvements_vehicules 
                 WHERE id_chauffeur = ? 
                 AND DATE(date_mission) = CURDATE()
                 AND statut = 'en_cours') as missions_en_cours
            FROM mouvements_vehicules m
            WHERE m.id_chauffeur = ? 
            AND DATE(m.date_mission) = CURDATE()
        `, [userId, userId, userId]);

        // Véhicule assigné
        const [vehicle] = await db.query(`
            SELECT 
                v.id,
                v.immatriculation,
                v.marque,
                v.modele,
                v.type_vehicule,
                v.statut,
                v.kilometrage_actuel,
                v.disponible
            FROM vehicules v
            WHERE v.id_chauffeur_attitre = ?
            AND v.statut IN ('actif', 'maintenance')
            LIMIT 1
        `, [userId]);

        // Notifications non lues
        const [notifications] = await db.query(`
            SELECT COUNT(*) as unread_count
            FROM notifications
            WHERE id_utilisateur = ? AND statut = 'non_lu'
        `, [userId]);

        res.json({
            success: true,
            data: {
                statistics: stats && stats.length > 0 ? stats[0] : {
                    missions_today: 0,
                    km_today: 0,
                    frais_pending: 0,
                    missions_en_cours: 0
                },
                vehicle: vehicle && vehicle.length > 0 ? vehicle[0] : null,
                notifications: notifications && notifications.length > 0 ? notifications[0].unread_count : 0
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 2. VÉHICULE ASSIGNÉ - DÉTAILS COMPLETS
// ============================================
router.get('/vehicle', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        const [vehicles] = await db.query(`
            SELECT 
                v.id,
                v.immatriculation,
                v.marque,
                v.modele,
                v.annee,
                v.couleur,
                v.type_vehicule,
                v.capacite_carburant,
                v.consommation_moyenne,
                v.kilometrage_actuel,
                v.statut,
                v.disponible,
                v.date_dernier_controle,
                v.prochain_controle,
                
                -- Assurance active
                a.id as assurance_id,
                a.compagnie_assurance,
                a.numero_police,
                a.type_couverture,
                a.date_debut as assurance_debut,
                a.date_expiration as assurance_fin,
                a.montant_prime,
                DATEDIFF(a.date_expiration, CURDATE()) as jours_avant_expiration_assurance,
                
                -- Dernière maintenance
                (SELECT MAX(date_intervention) 
                 FROM maintenances_vehicules 
                 WHERE id_vehicule = v.id 
                 AND statut = 'termine') as derniere_maintenance,
                
                -- Prochaine maintenance planifiée
                (SELECT MIN(date_intervention) 
                 FROM maintenances_vehicules 
                 WHERE id_vehicule = v.id 
                 AND statut = 'planifie' 
                 AND date_intervention > CURDATE()) as prochaine_maintenance,
                
                -- Compteur maintenances en attente
                (SELECT COUNT(*) 
                 FROM maintenances_vehicules 
                 WHERE id_vehicule = v.id 
                 AND statut = 'planifie') as maintenances_planifiees
                
            FROM vehicules v
            LEFT JOIN assurances_vehicules a ON v.id = a.id_vehicule 
                AND a.statut = 'active'
                AND a.date_expiration > CURDATE()
            WHERE v.id_chauffeur_attitre = ?
            LIMIT 1
        `, [userId]);

        if (!vehicles || vehicles.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'Aucun véhicule assigné'
            });
        }

        const vehicleData = vehicles[0];

        // Calculer alertes
        const alerts = [];

        if (vehicleData.jours_avant_expiration_assurance <= 30 && vehicleData.jours_avant_expiration_assurance > 0) {
            alerts.push({
                type: 'assurance',
                message: `Assurance expire dans ${vehicleData.jours_avant_expiration_assurance} jours`,
                urgence: vehicleData.jours_avant_expiration_assurance <= 7 ? 'haute' : 'normale'
            });
        }

        if (vehicleData.prochain_controle && new Date(vehicleData.prochain_controle) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
            alerts.push({
                type: 'controle_technique',
                message: 'Contrôle technique à prévoir bientôt',
                urgence: 'normale'
            });
        }

        res.json({
            success: true,
            data: {
                ...vehicleData,
                alerts
            }
        });
    } catch (error) {
        console.error('Get vehicle error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 3. MISSION EN COURS
// ============================================
router.get('/missions/current', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        const [missions] = await db.query(`
            SELECT 
                m.id,
                m.id_vehicule,
                m.destination,
                m.motif,
                m.date_mission,
                m.heure_depart,
                m.heure_retour,
                m.kilometrage_depart,
                m.kilometrage_retour,
                m.distance_parcourue,
                m.passagers,
                m.marchandise_transportee,
                m.statut,
                m.cout_carburant,
                m.quantite_carburant,
                m.cout_peages,
                m.autres_frais,
                m.total_frais,
                v.immatriculation,
                v.marque,
                v.modele,
                TIMESTAMPDIFF(HOUR, CONCAT(m.date_mission, ' ', m.heure_depart), NOW()) as heures_depuis_depart
            FROM mouvements_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE m.id_chauffeur = ?
            AND m.statut = 'en_cours'
            ORDER BY m.date_mission DESC, m.heure_depart DESC
            LIMIT 1
        `, [userId]);

        res.json({
            success: true,
            data: (missions && missions.length > 0) ? missions[0] : null
        });
    } catch (error) {
        console.error('Get current mission error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 4. HISTORIQUE MISSIONS
// ============================================
router.get('/missions/history', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const status = req.query.status;

        const offset = (page - 1) * limit;

        let whereConditions = ['m.id_chauffeur = ?'];
        let queryParams = [userId];

        if (startDate) {
            whereConditions.push('m.date_mission >= ?');
            queryParams.push(startDate);
        }

        if (endDate) {
            whereConditions.push('m.date_mission <= ?');
            queryParams.push(endDate);
        }

        if (status) {
            whereConditions.push('m.statut = ?');
            queryParams.push(status);
        }

        const whereClause = whereConditions.join(' AND ');

        // Compter total
        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM mouvements_vehicules m
            WHERE ${whereClause}
        `, queryParams);

        // Récupérer missions
        const countSql = `
            SELECT 
                m.id,
                m.destination,
                m.motif,
                m.date_mission,
                m.heure_depart,
                m.heure_retour,
                m.kilometrage_depart,
                m.kilometrage_retour,
                m.distance_parcourue,
                m.statut,
                m.total_frais,
                v.immatriculation,
                v.marque,
                v.modele
            FROM mouvements_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE ${whereClause}
            ORDER BY m.date_mission DESC, m.heure_depart DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [missions] = await db.query(countSql, queryParams);

        res.json({
            success: true,
            data: missions || [],
            pagination: {
                total: countResult && countResult.length > 0 ? countResult[0].total : 0,
                page: page,
                limit: limit,
                pages: countResult && countResult.length > 0 ? Math.ceil(countResult[0].total / limit) : 0
            }
        });
    } catch (error) {
        console.error('Get missions history error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 5. DÉMARRER MISSION (SORTIE)
// ============================================
router.post('/missions/start', authenticate, authorize(['chauffeur']), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const {
            destination,
            motif,
            passagers,
            marchandise_transportee,
            kilometrage_depart
        } = req.body;

        // Validation
        if (!destination || !motif || !kilometrage_depart) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Destination, motif et kilométrage de départ requis'
            });
        }

        // Vérifier qu'il n'y a pas déjà une mission en cours
        const [existingMission] = await connection.query(`
            SELECT id FROM mouvements_vehicules
            WHERE id_chauffeur = ? AND statut = 'en_cours'
        `, [userId]);

        if (existingMission.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà une mission en cours'
            });
        }

        // Récupérer le véhicule assigné
        const [vehicle] = await connection.query(`
            SELECT id, kilometrage_actuel, disponible, statut
            FROM vehicules 
            WHERE id_chauffeur_attitre = ? 
            AND statut = 'actif'
        `, [userId]);

        if (vehicle.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Aucun véhicule actif assigné'
            });
        }

        if (!vehicle[0].disponible) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Véhicule non disponible'
            });
        }

        const vehicleId = vehicle[0].id;
        const kmDepart = Math.round(parseFloat(kilometrage_depart) || 0);

        // Vérifier cohérence kilométrage
        if (kmDepart < vehicle[0].kilometrage_actuel) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Le kilométrage de départ ne peut pas être inférieur au kilométrage actuel du véhicule'
            });
        }

        // Insérer le mouvement
        const [result] = await connection.query(`
            INSERT INTO mouvements_vehicules (
                id_vehicule,
                id_chauffeur,
                type_mouvement,
                date_mission,
                heure_depart,
                kilometrage_depart,
                destination,
                motif,
                passagers,
                marchandise_transportee,
                statut
            ) VALUES (?, ?, 'sortie', CURDATE(), CURTIME(), ?, ?, ?, ?, ?, 'en_cours')
        `, [
            vehicleId,
            userId,
            kmDepart,
            destination,
            motif,
            passagers || null,
            marchandise_transportee || null
        ]);

        const missionId = result.insertId;

        // Mettre à jour le véhicule
        await connection.query(`
            UPDATE vehicules 
            SET 
                kilometrage_actuel = ?,
                disponible = 0
            WHERE id = ?
        `, [kmDepart, vehicleId]);

        // Créer notification
        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur,
                type_notification,
                titre,
                message,
                priorite,
                type_reference,
                id_reference,
                statut
            ) VALUES (?, 'systeme', 'Mission Démarrée', ?, 'normale', 'mouvement', ?, 'non_lu')
        `, [userId, `Mission vers ${destination} démarrée à ${new Date().toLocaleTimeString('fr-FR')}`, missionId]);

        // Trace d'audit
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur,
                module,
                type_action,
                action_details,
                table_affectee,
                id_enregistrement,
                ip_address,
                niveau
            ) VALUES (?, 'flotte', 'MISSION_START', ?, 'mouvements_vehicules', ?, ?, 'info')
        `, [
            userId,
            `Démarrage mission vers ${destination} - KM: ${kmDepart}`,
            missionId,
            req.ip
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Mission démarrée avec succès',
            data: {
                id: missionId,
                destination,
                heure_depart: new Date().toLocaleTimeString('fr-FR'),
                kilometrage_depart: kmDepart
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Start mission error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la mission',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 6. TERMINER MISSION (RETOUR)
// ============================================
router.post('/missions/end', authenticate, authorize(['chauffeur']), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const {
            id_mouvement,
            kilometrage_retour,
            observations_livraison
        } = req.body;

        // Validation
        if (!id_mouvement || !kilometrage_retour) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'ID mission et kilométrage de retour requis'
            });
        }

        // Récupérer la mission
        const [mission] = await connection.query(`
            SELECT 
                m.*,
                v.id as vehicle_id,
                v.kilometrage_actuel
            FROM mouvements_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE m.id = ? 
            AND m.id_chauffeur = ? 
            AND m.statut = 'en_cours'
        `, [id_mouvement, userId]);

        if (mission.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Mission introuvable ou déjà terminée'
            });
        }

        const missionData = mission[0];
        const kmRetour = Math.round(parseFloat(kilometrage_retour) || 0);
        const kmDepart = parseFloat(missionData.kilometrage_depart);

        // Vérifier cohérence kilométrage
        if (kmRetour <= kmDepart) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Le kilométrage de retour doit être supérieur au départ'
            });
        }

        const distanceParcourue = kmRetour - kmDepart;

        // Mettre à jour le mouvement
        await connection.query(`
            UPDATE mouvements_vehicules
            SET 
                heure_retour = CURTIME(),
                kilometrage_retour = ?,
                statut = 'termine',
                observations_livraison = ?
            WHERE id = ?
        `, [kmRetour, observations_livraison || null, id_mouvement]);

        // Mettre à jour le véhicule
        await connection.query(`
            UPDATE vehicules 
            SET 
                kilometrage_actuel = ?,
                disponible = 1
            WHERE id = ?
        `, [kmRetour, missionData.vehicle_id]);

        // Créer notification
        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur,
                type_notification,
                titre,
                message,
                priorite,
                type_reference,
                id_reference,
                statut
            ) VALUES (?, 'systeme', 'Mission Terminée', ?, 'normale', 'mouvement', ?, 'non_lu')
        `, [
            userId,
            `Mission vers ${missionData.destination} terminée. Distance: ${distanceParcourue.toFixed(2)} km`,
            id_mouvement
        ]);

        // Trace
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur,
                module,
                type_action,
                action_details,
                table_affectee,
                id_enregistrement,
                ip_address,
                niveau
            ) VALUES (?, 'flotte', 'MISSION_END', ?, 'mouvements_vehicules', ?, ?, 'info')
        `, [
            userId,
            `Fin mission - Distance: ${distanceParcourue.toFixed(2)} km`,
            id_mouvement,
            req.ip
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Mission terminée avec succès',
            data: {
                distance_parcourue: distanceParcourue,
                kilometrage_retour: kmRetour
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('End mission error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la fin de mission',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 7. SOUMETTRE FRAIS
// ============================================
router.post('/expenses', authenticate, authorize(['chauffeur']), upload.single('piece_justificative'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const {
            id_mouvement,
            type_frais,
            montant,
            description,
            quantite_carburant // pour type carburant
        } = req.body;

        // Validation de base
        if (!type_frais || !montant) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Type de frais et montant requis'
            });
        }

        // Types autorisés
        const typesAutorises = ['carburant', 'peage', 'parking', 'reparation', 'autre', 'versement_journalier'];
        if (!typesAutorises.includes(type_frais)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Type de frais non valide'
            });
        }

        const montantValue = parseFloat(montant);

        // Si versement journalier, montant doit être positif (recette)
        if (type_frais === 'versement_journalier') {
            if (montantValue <= 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Le montant du versement doit être positif'
                });
            }
        }

        // Vérifier que le mouvement existe et appartient au chauffeur
        if (id_mouvement) {
            const [mouvement] = await connection.query(`
                SELECT id FROM mouvements_vehicules
                WHERE id = ? AND id_chauffeur = ?
            `, [id_mouvement, userId]);

            if (mouvement.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Mission introuvable'
                });
            }
        }

        // Récupérer le véhicule
        const [vehicle] = await connection.query(`
            SELECT id FROM vehicules WHERE id_chauffeur_attitre = ?
        `, [userId]);

        if (vehicle.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Aucun véhicule assigné'
            });
        }

        const vehicleId = vehicle[0].id;
        const pieceJustificative = req.file ? req.file.path : null;

        // Insérer le frais
        const [fraisResult] = await connection.query(`
            INSERT INTO frais_vehicules (
                id_mouvement,
                type_frais,
                montant,
                description,
                date,
                piece_justificative,
                valide,
                valide_par,
                date_validation
            ) VALUES (?, ?, ?, ?, CURDATE(), ?, 0, NULL, NULL)
        `, [
            id_mouvement || null,
            type_frais,
            montantValue,
            description || null,
            pieceJustificative
        ]);

        const fraisId = fraisResult.insertId;

        // *** LOGIQUE MÉTIER PAR TYPE DE FRAIS ***

        if (type_frais === 'carburant' && quantite_carburant) {
            // Mettre à jour le mouvement si lié
            if (id_mouvement) {
                await connection.query(`
                    UPDATE mouvements_vehicules
                    SET 
                        cout_carburant = COALESCE(cout_carburant, 0) + ?,
                        quantite_carburant = COALESCE(quantite_carburant, 0) + ?
                    WHERE id = ?
                `, [montantValue, parseFloat(quantite_carburant), id_mouvement]);
            }
        }

        if (type_frais === 'peage' && id_mouvement) {
            await connection.query(`
                UPDATE mouvements_vehicules
                SET cout_peages = COALESCE(cout_peages, 0) + ?
                WHERE id = ?
            `, [montantValue, id_mouvement]);
        }

        if (['parking', 'reparation', 'autre'].includes(type_frais) && id_mouvement) {
            await connection.query(`
                UPDATE mouvements_vehicules
                SET autres_frais = COALESCE(autres_frais, 0) + ?
                WHERE id = ?
            `, [montantValue, id_mouvement]);
        }

        if (type_frais === 'reparation') {
            // Créer une entrée de maintenance urgente
            await connection.query(`
                INSERT INTO maintenances_vehicules (
                    id_vehicule,
                    type_maintenance,
                    description,
                    cout_maintenance,
                    date_intervention,
                    statut
                ) VALUES (?, 'reparation', ?, ?, CURDATE(), 'termine')
            `, [vehicleId, description || 'Réparation urgente signalée par chauffeur', montantValue]);
        }

        // *** VERSEMENT JOURNALIER = RECETTE ***
        if (type_frais === 'versement_journalier') {
            // Enregistrer dans le journal comptable comme RECETTE
            await connection.query(`
                CALL enregistrer_journal_comptable(
                    'vente',
                    'recette',
                    'Versement journalier chauffeur',
                    ?,
                    ?,
                    NULL,
                    NULL,
                    '512 - Banque',
                    '707 - Ventes',
                    'frais_vehicules',
                    ?,
                    'autre',
                    NULL,
                    NULL,
                    ?,
                    CONCAT('FRAIS-', ?),
                    JSON_OBJECT('type', 'versement_journalier', 'vehicule_id', ?)
                )
            `, [
                description || `Versement journalier - ${new Date().toLocaleDateString('fr-FR')}`,
                montantValue,
                fraisId,
                userId,
                fraisId,
                vehicleId
            ]);
        }

        // Notification au manager/admin
        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur,
                type_notification,
                titre,
                message,
                priorite,
                type_reference,
                id_reference,
                statut
            )
            SELECT 
                u.id,
                'approbation',
                ?,
                ?,
                'normale',
                'frais',
                ?,
                'non_lu'
            FROM utilisateurs u
            WHERE u.role IN ('admin', 'manager', 'comptable')
        `, [
            type_frais === 'versement_journalier' ? 'Nouveau Versement Journalier' : 'Nouveau Frais à Valider',
            type_frais === 'versement_journalier'
                ? `Versement de ${montantValue} FBU par un chauffeur`
                : `Frais de type ${type_frais} - ${montantValue} FBU`,
            fraisId
        ]);

        // Trace
        await connection.query(`
            INSERT INTO traces (
                id_utilisateur,
                module,
                type_action,
                action_details,
                table_affectee,
                id_enregistrement,
                ip_address,
                niveau
            ) VALUES (?, 'flotte', ?, ?, 'frais_vehicules', ?, ?, 'info')
        `, [
            userId,
            type_frais === 'versement_journalier' ? 'VERSEMENT_JOURNALIER' : 'FRAIS_SUBMITTED',
            `${type_frais} - ${montantValue} FBU - ${description || ''}`,
            fraisId,
            req.ip
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: type_frais === 'versement_journalier'
                ? 'Versement journalier enregistré avec succès'
                : 'Frais soumis avec succès',
            data: {
                id: fraisId,
                type: type_frais,
                montant: montantValue
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Submit expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la soumission du frais',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 8. LISTE DES FRAIS SOUMIS
// ============================================
router.get('/expenses', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const status = req.query.status;
        const type = req.query.type;

        const offset = (page - 1) * limit;

        let whereConditions = ['m.id_chauffeur = ?'];
        let queryParams = [userId];

        if (status) {
            if (status === 'valide') {
                whereConditions.push('f.valide = 1');
            } else if (status === 'en_attente') {
                whereConditions.push('f.valide = 0');
            }
        }

        if (type) {
            whereConditions.push('f.type_frais = ?');
            queryParams.push(type);
        }

        const whereClause = whereConditions.join(' AND ');

        // Compter total
        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE ${whereClause}
        `, queryParams);

        // Récupérer frais
        const fraisSql = `
            SELECT 
                f.id,
                f.type_frais,
                f.montant,
                f.description,
                f.date,
                f.piece_justificative,
                f.valide,
                f.date_validation,
                CONCAT(u.nom_complet) as valide_par_nom,
                m.destination,
                m.date_mission
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            LEFT JOIN utilisateurs u ON f.valide_par = u.id
            WHERE ${whereClause}
            ORDER BY f.date DESC, f.id DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [frais] = await db.query(fraisSql, queryParams);

        res.json({
            success: true,
            data: frais || [],
            pagination: {
                total: countResult && countResult.length > 0 ? countResult[0].total : 0,
                page: page,
                limit: limit,
                pages: countResult && countResult.length > 0 ? Math.ceil(countResult[0].total / limit) : 0
            }
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 9. MAINTENANCES À VENIR
// ============================================
router.get('/maintenance/upcoming', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        const [maintenances] = await db.query(`
            SELECT 
                m.id,
                m.type_maintenance,
                m.description,
                m.date_intervention,
                m.kilometrage,
                m.statut,
                v.immatriculation,
                v.marque,
                v.modele,
                DATEDIFF(m.date_intervention, CURDATE()) as jours_restants
            FROM maintenances_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            WHERE v.id_chauffeur_attitre = ?
            AND m.statut = 'planifie'
            AND m.date_intervention >= CURDATE()
            ORDER BY m.date_intervention ASC
            LIMIT 10
        `, [userId]);

        res.json({
            success: true,
            data: maintenances || []
        });
    } catch (error) {
        console.error('Get maintenance error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 10. ALERTES ASSURANCE
// ============================================
router.get('/insurance/alerts', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        const [alerts] = await db.query(`
            SELECT 
                a.id,
                a.compagnie_assurance,
                a.numero_police,
                a.type_couverture,
                a.date_debut,
                a.date_expiration,
                a.montant_prime,
                a.franchise,
                DATEDIFF(a.date_expiration, CURDATE()) as jours_restants,
                v.immatriculation,
                v.marque,
                v.modele
            FROM assurances_vehicules a
            JOIN vehicules v ON a.id_vehicule = v.id
            WHERE v.id_chauffeur_attitre = ?
            AND a.statut = 'active'
            AND a.date_expiration BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            ORDER BY a.date_expiration ASC
        `, [userId]);

        res.json({
            success: true,
            data: alerts || []
        });
    } catch (error) {
        console.error('Get insurance alerts error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 11. STATISTIQUES CHAUFFEUR
// ============================================
router.get('/statistics', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'month' } = req.query;

        let dateCondition = 'MONTH(m.date_mission) = MONTH(CURDATE()) AND YEAR(m.date_mission) = YEAR(CURDATE())';
        if (period === 'today') dateCondition = 'DATE(m.date_mission) = CURDATE()';
        if (period === 'week') dateCondition = 'YEARWEEK(m.date_mission, 1) = YEARWEEK(CURDATE(), 1)';
        if (period === 'year') dateCondition = 'YEAR(m.date_mission) = YEAR(CURDATE())';

        const [stats] = await db.query(`
            SELECT 
                COUNT(DISTINCT m.id) as missions_total,
                COUNT(DISTINCT CASE WHEN m.statut = 'termine' THEN m.id END) as missions_terminees,
                COUNT(DISTINCT CASE WHEN m.statut = 'en_cours' THEN m.id END) as missions_en_cours,
                COALESCE(SUM(m.distance_parcourue), 0) as km_total,
                COALESCE(SUM(m.cout_carburant), 0) as cout_carburant_total,
                COALESCE(SUM(m.total_frais), 0) as frais_total,
                
                (SELECT COUNT(*) FROM frais_vehicules f
                 JOIN mouvements_vehicules m2 ON f.id_mouvement = m2.id
                 WHERE m2.id_chauffeur = ? AND f.valide = 0) as frais_en_attente,
                 
                (SELECT COUNT(*) FROM frais_vehicules f
                 JOIN mouvements_vehicules m2 ON f.id_mouvement = m2.id
                 WHERE m2.id_chauffeur = ? AND f.valide = 1) as frais_valides,
                 
                (SELECT COALESCE(SUM(f.montant), 0) FROM frais_vehicules f
                 JOIN mouvements_vehicules m2 ON f.id_mouvement = m2.id
                 WHERE m2.id_chauffeur = ? 
                 AND f.type_frais = 'versement_journalier'
                 AND ${dateCondition.replace('m.', 'm2.')}) as versements_total
                 
            FROM mouvements_vehicules m
            WHERE m.id_chauffeur = ? 
            AND ${dateCondition}
        `, [userId, userId, userId, userId]);

        res.json({
            success: true,
            data: {
                period,
                ...(stats && stats.length > 0 ? stats[0] : {
                    missions_total: 0,
                    missions_terminees: 0,
                    missions_en_cours: 0,
                    km_total: 0,
                    cout_carburant_total: 0,
                    frais_total: 0,
                    frais_en_attente: 0,
                    frais_valides: 0,
                    versements_total: 0
                })
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 12. NOTIFICATIONS
// ============================================
router.get('/notifications', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            type_notification,
            priorite,
            statut,
            unread_only = 'false',
            page = 1,
            limit = 20,
            startDate,
            endDate
        } = req.query;

        // 🔒 NORMALISATION SAFE
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const offset = (pageNum - 1) * limitNum;

        // WHERE CONDITIONS
        let whereConditions = ['n.id_utilisateur = ?'];
        let params = [userId];

        if (type_notification) {
            whereConditions.push('n.type_notification = ?');
            params.push(type_notification);
        }

        if (priorite) {
            whereConditions.push('n.priorite = ?');
            params.push(priorite);
        }

        if (statut) {
            whereConditions.push('n.statut = ?');
            params.push(statut);
        }

        if (unread_only === 'true') {
            whereConditions.push(`n.statut = 'non_lu'`);
        }

        if (startDate) {
            whereConditions.push('n.date_creation >= ?');
            params.push(startDate);
        }

        if (endDate) {
            whereConditions.push('n.date_creation <= ?');
            params.push(endDate);
        }

        const whereClause = whereConditions.join(' AND ');

        // QUERY COUNT
        const [countResult] = await db.query(`
            SELECT COUNT(*) AS total
            FROM notifications n
            WHERE ${whereClause}
        `, params);

        // QUERY DATA
        const notifSql = `
            SELECT 
                n.id,
                n.type_notification,
                n.titre,
                n.message,
                n.priorite,
                n.statut,
                n.date_creation,
                n.type_reference,
                n.id_reference,
                CASE 
                    WHEN n.type_reference = 'mission' THEN 
                        (SELECT destination FROM mouvements_vehicules WHERE id = n.id_reference)
                    WHEN n.type_reference = 'conge' THEN 
                        (SELECT type_conge FROM conges WHERE id = n.id_reference)
                    WHEN n.type_reference = 'commande' THEN 
                        (SELECT numero_commande FROM commandes_vente WHERE id = n.id_reference)
                    WHEN n.type_reference = 'maintenance' THEN 
                        (SELECT description FROM maintenances_vehicules WHERE id = n.id_reference)
                    WHEN n.type_reference = 'facture' THEN 
                        (SELECT numero_facture FROM factures WHERE id = n.id_reference)
                    ELSE NULL
                END AS reference_detail
            FROM notifications n
            WHERE ${whereClause}
            ORDER BY n.priorite DESC, n.date_creation DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `;

        const [notifications] = await db.query(notifSql, params);

        const totalNotifications = countResult && countResult.length > 0 ? countResult[0].total : 0;

        res.status(200).json({
            success: true,
            data: notifications || [],
            pagination: {
                total: totalNotifications,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(totalNotifications / limitNum)
            }
        });

    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications'
        });
    }
});

// ============================================
// 13. MARQUER NOTIFICATION COMME LUE
// ============================================
router.put('/notifications/:id/read', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        await db.query(`
            UPDATE notifications
            SET statut = 'lu', date_lecture = NOW()
            WHERE id = ? AND id_utilisateur = ?
        `, [notificationId, userId]);

        res.json({
            success: true,
            message: 'Notification marquée comme lue'
        });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 14. DÉTAILS SALAIRE DU MOIS EN COURS
// ============================================
router.get('/salary/current', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const [salaryData] = await db.query(`
            SELECT 
                s.id,
                s.mois,
                s.annee,
                s.salaire_brut,
                s.heures_travaillees,
                s.heures_supp,
                s.taux_heure_supp,
                s.deduction_inss,
                s.deduction_impots,
                s.autres_deductions,
                s.avances,
                s.primes,
                s.indemnites,
                s.commissions,
                s.total_deductions,
                s.total_additions,
                s.salaire_net,
                s.mode_paiement,
                s.date_paiement,
                s.reference_paiement,
                s.statut_paiement,
                s.confirme_reception,
                s.date_confirmation_reception,
                s.demande_paiement_envoyee,
                s.date_demande_paiement,
                s.date_calcul,
                u.nom_complet,
                u.email,
                u.telephone,
                u.compte_bancaire,
                u.nom_banque,
                u.salaire_base,
                d.nom as departement_nom,
                
                CASE 
                    WHEN s.statut_paiement = 'payé' THEN 0
                    WHEN CURDATE() > DATE_ADD(LAST_DAY(STR_TO_DATE(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01'), '%Y-%m-%d')), INTERVAL 5 DAY) THEN 1
                    ELSE 0
                END as en_retard_paiement,
                
                DATEDIFF(CURDATE(), STR_TO_DATE(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01'), '%Y-%m-%d')) as jours_travail_cumule,
                
                DATE_ADD(LAST_DAY(STR_TO_DATE(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01'), '%Y-%m-%d')), INTERVAL 5 DAY) as date_limite_paiement
                
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            JOIN departements d ON u.id_departement = d.id
            WHERE s.id_utilisateur = ?
            AND s.mois = ?
            AND s.annee = ?
            LIMIT 1
        `, [userId, currentMonth, currentYear]);

        if (!salaryData || salaryData.length === 0) {
            return res.json({
                success: true,
                message: 'Aucun salaire calculé pour ce mois',
                data: null
            });
        }

        const salary = salaryData[0];

        const detailsCalcul = {
            brut: {
                salaire_base: salary.salaire_brut,
                heures_supp: salary.heures_supp * salary.taux_heure_supp,
                primes: salary.primes,
                indemnites: salary.indemnites,
                commissions: salary.commissions,
                total: salary.salaire_brut + (salary.heures_supp * salary.taux_heure_supp) + salary.primes + salary.indemnites + salary.commissions
            },
            deductions: {
                inss: salary.deduction_inss,
                impots: salary.deduction_impots,
                autres: salary.autres_deductions,
                avances: salary.avances,
                total: salary.total_deductions
            },
            net: {
                montant: salary.salaire_net,
                mode_paiement: salary.mode_paiement,
                date_paiement: salary.date_paiement,
                reference: salary.reference_paiement,
                statut: salary.statut_paiement,
                en_retard: salary.en_retard_paiement === 1
            }
        };

        const [confirmation] = await db.query(`
            SELECT 
                id,
                confirme,
                date_confirmation,
                methode_confirmation,
                code_verification_utilise
            FROM confirmations_reception_salaire
            WHERE id_salaire = ? AND id_utilisateur = ?
            LIMIT 1
        `, [salary.id, userId]);

        const confirmationStatus = confirmation && confirmation.length > 0 ? {
            confirme: confirmation[0].confirme === 1,
            date_confirmation: confirmation[0].date_confirmation,
            methode: confirmation[0].methode_confirmation,
            code_utilise: confirmation[0].code_verification_utilise
        } : null;

        res.json({
            success: true,
            data: {
                mois: salary.mois,
                annee: salary.annee,
                employe: {
                    nom: salary.nom_complet,
                    email: salary.email,
                    telephone: salary.telephone,
                    departement: salary.departement_nom,
                    compte: {
                        numero: salary.compte_bancaire,
                        banque: salary.nom_banque
                    }
                },
                details: detailsCalcul,
                confirmation: confirmationStatus,
                infos_paiement: {
                    statut: salary.statut_paiement,
                    date_limite: salary.date_limite_paiement,
                    date_reelle: salary.date_paiement,
                    en_retard: salary.en_retard_paiement === 1,
                    jours_travail: salary.jours_travail_cumule
                }
            }
        });

    } catch (error) {
        console.error('Get current salary error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 15. HISTORIQUE DES SALAIRES
// ============================================
router.get('/salary/history', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);

        const offset = (page - 1) * limit;

        const salarySql = `
            SELECT 
                s.id,
                s.mois,
                s.annee,
                s.salaire_brut,
                s.salaire_net,
                s.statut_paiement,
                s.date_paiement,
                s.date_calcul,
                s.confirme_reception,
                
                CASE 
                    WHEN s.statut_paiement = 'payé' THEN 0
                    WHEN CURDATE() > DATE_ADD(LAST_DAY(STR_TO_DATE(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01'), '%Y-%m-%d')), INTERVAL 5 DAY) THEN 1
                    ELSE 0
                END as en_retard,
                
                (s.deduction_inss + s.deduction_impots + s.autres_deductions) as total_deductions,
                
                DAY(LAST_DAY(STR_TO_DATE(CONCAT(s.annee, '-', LPAD(s.mois, 2, '0'), '-01'), '%Y-%m-%d'))) as jours_mois,
                
                CASE s.mois
                    WHEN 1 THEN 'Janvier'
                    WHEN 2 THEN 'Février'
                    WHEN 3 THEN 'Mars'
                    WHEN 4 THEN 'Avril'
                    WHEN 5 THEN 'Mai'
                    WHEN 6 THEN 'Juin'
                    WHEN 7 THEN 'Juillet'
                    WHEN 8 THEN 'Août'
                    WHEN 9 THEN 'Septembre'
                    WHEN 10 THEN 'Octobre'
                    WHEN 11 THEN 'Novembre'
                    WHEN 12 THEN 'Décembre'
                END as nom_mois
                
            FROM salaires s
            WHERE s.id_utilisateur = ? 
            AND s.annee = ?
            ORDER BY s.annee DESC, s.mois DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [salaries] = await db.query(salarySql, [userId, year]);

        // Compter total
        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM salaires
            WHERE id_utilisateur = ? AND annee = ?
        `, [userId, year]);

        // Résumé annuel
        const [summary] = await db.query(`
            SELECT 
                COALESCE(SUM(salaire_brut), 0) as total_brut_annuel,
                COALESCE(SUM(salaire_net), 0) as total_net_annuel,
                COALESCE(SUM(deduction_inss + deduction_impots + autres_deductions), 0) as total_deductions_annuel,
                COUNT(CASE WHEN statut_paiement = 'payé' THEN 1 END) as mois_payes,
                COUNT(CASE WHEN statut_paiement != 'payé' THEN 1 END) as mois_impaye,
                AVG(salaire_net) as salaire_net_moyen
            FROM salaires
            WHERE id_utilisateur = ? AND annee = ?
        `, [userId, year]);

        res.json({
            success: true,
            data: {
                salaires: salaries || [],
                summary: summary && summary.length > 0 ? summary[0] : {
                    total_brut_annuel: 0,
                    total_net_annuel: 0,
                    total_deductions_annuel: 0,
                    mois_payes: 0,
                    mois_impaye: 0,
                    salaire_net_moyen: 0
                },
                pagination: {
                    total: countResult && countResult.length > 0 ? countResult[0].total : 0,
                    page: page,
                    limit: limit,
                    pages: countResult && countResult.length > 0 ? Math.ceil(countResult[0].total / limit) : 0
                }
            }
        });

    } catch (error) {
        console.error('Get salary history error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 16. DEMANDER LE PAIEMENT DU SALAIRE
// ============================================
router.post('/salary/request-payment', authenticate, authorize(['chauffeur']), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const [salary] = await connection.query(`
            SELECT 
                s.id,
                s.mois,
                s.annee,
                s.salaire_net,
                s.statut_paiement,
                u.nom_complet,
                u.email
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE s.id_utilisateur = ? 
            AND s.mois = ? 
            AND s.annee = ?
            LIMIT 1
        `, [userId, currentMonth, currentYear]);

        if (salary.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Aucun salaire calculé pour ce mois'
            });
        }

        const salaryData = salary[0];

        const [existingRequest] = await connection.query(`
            SELECT id, statut FROM demandes_paiement_salaire
            WHERE id_salaire = ? 
            AND id_employe = ? 
            AND statut = 'en_attente'
            LIMIT 1
        `, [salaryData.id, userId]);

        if (existingRequest.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà une demande de paiement en attente pour ce mois'
            });
        }

        if (salaryData.statut_paiement === 'payé') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Ce salaire a déjà été payé'
            });
        }

        const [result] = await connection.query(`
            INSERT INTO demandes_paiement_salaire (
                id_salaire,
                id_employe,
                mois,
                annee,
                montant,
                statut,
                date_demande
            ) VALUES (?, ?, ?, ?, ?, 'en_attente', NOW())
        `, [salaryData.id, userId, currentMonth, currentYear, salaryData.salaire_net]);

        const requestId = result.insertId;

        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur,
                type_notification,
                titre,
                message,
                priorite,
                type_reference,
                id_reference,
                statut
            )
            SELECT 
                u.id,
                'approbation',
                'Demande de Paiement de Salaire',
                CONCAT(?, ' demande le paiement de son salaire (', ?, ' FBU)'),
                'haute',
                'demande_salaire',
                ?,
                'non_lu'
            FROM utilisateurs u
            WHERE u.role IN ('admin', 'manager', 'comptable')
            AND u.id_departement = (SELECT id_departement FROM utilisateurs WHERE id = ?)
        `, [salaryData.nom_complet, salaryData.salaire_net, requestId, userId]);

        await connection.query(`
            INSERT INTO traces (
                id_utilisateur,
                module,
                type_action,
                action_details,
                table_affectee,
                id_enregistrement,
                ip_address,
                niveau,
                date_action
            ) VALUES (?, 'rh', 'DEMANDE_PAIEMENT_SALAIRE', ?, 'demandes_paiement_salaire', ?, ?, 'info', NOW())
        `, [
            userId,
            `Demande de paiement - ${currentMonth}/${currentYear} - ${salaryData.salaire_net} FBU`,
            requestId,
            req.ip
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Demande de paiement soumise avec succès',
            data: {
                id: requestId,
                mois: currentMonth,
                annee: currentYear,
                montant: salaryData.salaire_net,
                statut: 'en_attente'
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Request salary payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la demande de paiement',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 17. STATUT DES DEMANDES DE PAIEMENT
// ============================================
router.get('/salary/payment-requests', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const status = req.query.status;

        const offset = (page - 1) * limit;

        let whereConditions = ['d.id_employe = ?'];
        let queryParams = [userId];

        if (status) {
            whereConditions.push('d.statut = ?');
            queryParams.push(status);
        }

        const whereClause = whereConditions.join(' AND ');

        // Compter total
        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM demandes_paiement_salaire d
            WHERE ${whereClause}
        `, queryParams);

        // Récupérer les demandes
        const requestsSql = `
            SELECT 
                d.id,
                d.mois,
                d.annee,
                d.montant,
                d.statut,
                d.date_demande,
                d.date_traitement,
                d.commentaire,
                d.motif_rejet,
                u.nom_complet as traite_par_nom,
                s.statut_paiement as statut_salaire,
                s.date_paiement,
                s.reference_paiement,
                
                CASE d.mois
                    WHEN 1 THEN 'Janvier'
                    WHEN 2 THEN 'Février'
                    WHEN 3 THEN 'Mars'
                    WHEN 4 THEN 'Avril'
                    WHEN 5 THEN 'Mai'
                    WHEN 6 THEN 'Juin'
                    WHEN 7 THEN 'Juillet'
                    WHEN 8 THEN 'Août'
                    WHEN 9 THEN 'Septembre'
                    WHEN 10 THEN 'Octobre'
                    WHEN 11 THEN 'Novembre'
                    WHEN 12 THEN 'Décembre'
                END as nom_mois,
                
                DATEDIFF(CURDATE(), DATE(d.date_demande)) as jours_depuis_demande
                
            FROM demandes_paiement_salaire d
            LEFT JOIN utilisateurs u ON d.traite_par = u.id
            LEFT JOIN salaires s ON d.id_salaire = s.id
            WHERE ${whereClause}
            ORDER BY d.date_demande DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [requests] = await db.query(requestsSql, queryParams);

        res.json({
            success: true,
            data: requests || [],
            pagination: {
                total: countResult && countResult.length > 0 ? countResult[0].total : 0,
                page: page,
                limit: limit,
                pages: countResult && countResult.length > 0 ? Math.ceil(countResult[0].total / limit) : 0
            }
        });

    } catch (error) {
        console.error('Get payment requests error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 18. CONFIRMER RÉCEPTION SALAIRE
// ============================================
router.post('/salary/confirm-reception', authenticate, authorize(['chauffeur']), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = req.user.id;
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const { code_verification } = req.body;

        const [salary] = await connection.query(`
            SELECT s.id, s.salaire_net, s.statut_paiement
            FROM salaires s
            WHERE s.id_utilisateur = ? 
            AND s.mois = ? 
            AND s.annee = ?
            AND s.statut_paiement = 'payé'
            LIMIT 1
        `, [userId, currentMonth, currentYear]);

        if (salary.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Aucun salaire payé ce mois'
            });
        }

        const salaryId = salary[0].id;

        if (code_verification) {
            const [codeCheck] = await connection.query(`
                SELECT id, date_expiration, utilise
                FROM codes_verification_salaire
                WHERE id_salaire = ? 
                AND id_utilisateur = ?
                AND code_verification = ?
                AND utilise = 0
            `, [salaryId, userId, code_verification]);

            if (codeCheck.length === 0) {
                // Incrémenter les tentatives échouées (si le code est faux, on peut essayer de le trouver dans la table sans le filtre code_verification pour compter)
                // Ici, on va simplement chercher le dernier code généré pour cet utilisateur et ce salaire
                const [lastCode] = await connection.query(`
                    SELECT id, tentatives_echouees FROM codes_verification_salaire
                    WHERE id_salaire = ? AND id_utilisateur = ?
                    ORDER BY date_creation DESC LIMIT 1
                `, [salaryId, userId]);

                if (lastCode.length > 0) {
                    const newTentatives = lastCode[0].tentatives_echouees + 1;
                    await connection.query(`
                        UPDATE codes_verification_salaire 
                        SET tentatives_echouees = ?
                        WHERE id = ?
                    `, [newTentatives, lastCode[0].id]);

                    if (newTentatives >= 2) {
                        await connection.query("UPDATE utilisateurs SET statut = 'bloqué' WHERE id = ?", [userId]);
                        await connection.commit();
                        return res.status(403).json({
                            success: false,
                            message: 'Votre compte a été bloqué après 2 tentatives infructueuses. Veuillez contacter l\'administrateur.'
                        });
                    }

                    const restantes = 2 - newTentatives;
                    await connection.commit();
                    return res.status(400).json({
                        success: false,
                        message: `Code de vérification incorrect. Il vous reste ${restantes} tentative(s) avant blocage du compte.`
                    });
                }

                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Code de vérification invalide ou expiré'
                });
            }

            if (new Date(codeCheck[0].date_expiration) < new Date()) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Code de vérification expiré'
                });
            }

            await connection.query(`
                UPDATE codes_verification_salaire
                SET utilise = 1, date_utilisation = NOW()
                WHERE id = ?
            `, [codeCheck[0].id]);
        }

        const [existingConfirmation] = await connection.query(`
            SELECT id FROM confirmations_reception_salaire
            WHERE id_salaire = ? 
            AND id_utilisateur = ? 
            AND mois = ? 
            AND annee = ?
        `, [salaryId, userId, currentMonth, currentYear]);

        if (existingConfirmation.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà confirmé la réception de ce salaire'
            });
        }

        const [result] = await connection.query(`
            INSERT INTO confirmations_reception_salaire (
                id_salaire,
                id_utilisateur,
                mois,
                annee,
                montant,
                code_verification_utilise,
                confirme,
                date_confirmation,
                methode_confirmation,
                ip_address,
                device_info
            ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, ?)
        `, [
            salaryId,
            userId,
            currentMonth,
            currentYear,
            salary[0].salaire_net,
            code_verification || null,
            code_verification ? 'code_email' : 'manuel',
            req.ip,
            req.headers['user-agent'] || null
        ]);

        await connection.query(`
            INSERT INTO notifications (
                id_utilisateur,
                type_notification,
                titre,
                message,
                priorite,
                statut
            )
            SELECT 
                u.id,
                'systeme',
                'Confirmation de Réception de Salaire',
                CONCAT(?, ' a confirmé la réception de son salaire du ', ?, '/', ?),
                'normale',
                'non_lu'
            FROM utilisateurs u
            WHERE u.role IN ('admin', 'manager')
            AND u.id_departement = (SELECT id_departement FROM utilisateurs WHERE id = ?)
        `, ['Chauffeur', currentMonth, currentYear, userId]);

        await connection.query(`
            INSERT INTO traces (
                id_utilisateur,
                module,
                type_action,
                action_details,
                table_affectee,
                id_enregistrement,
                ip_address,
                niveau,
                date_action
            ) VALUES (?, 'rh', 'CONFIRMATION_RECEPTION_SALAIRE', ?, 'confirmations_reception_salaire', ?, ?, 'info', NOW())
        `, [
            userId,
            `Confirmation réception salaire - ${currentMonth}/${currentYear}`,
            result.insertId,
            req.ip
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Réception de salaire confirmée avec succès',
            data: {
                id: result.insertId,
                mois: currentMonth,
                annee: currentYear,
                montant: salary[0].salaire_net,
                date_confirmation: new Date().toLocaleString('fr-FR')
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Confirm salary reception error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la confirmation',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// Demander un code de vérification pour le salaire (Chauffeur)
router.post('/salary/request-code', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Trouver le salaire payé du mois en cours
        const [salary] = await db.query(`
            SELECT s.id, u.email, u.nom_complet
            FROM salaires s
            JOIN utilisateurs u ON s.id_utilisateur = u.id
            WHERE s.id_utilisateur = ? 
            AND s.mois = ? 
            AND s.annee = ?
            AND s.statut_paiement = 'payé'
            LIMIT 1
        `, [userId, currentMonth, currentYear]);

        if (salary.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun salaire payé trouvé pour ce mois.'
            });
        }

        const salaireData = salary[0];
        const salaryId = salaireData.id;

        // Générer code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const dateExpiration = new Date();
        dateExpiration.setHours(dateExpiration.getHours() + 24);

        // Sauvegarder en base
        await db.query(`
            INSERT INTO codes_verification_salaire (
                id_salaire, id_utilisateur, code_verification, date_expiration
            ) VALUES (?, ?, ?, ?)
        `, [salaryId, userId, code, dateExpiration]);

        // Envoyer email
        if (salaireData.email) {
            try {
                await emailService.envoyerCodeVerification(
                    salaireData.email,
                    code,
                    salaireData.nom_complet,
                    currentMonth,
                    currentYear
                );
            } catch (emailError) {
                console.error('Erreur envoi email OTP Chauffeur:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Un code de vérification a été envoyé à votre email.',
            code: process.env.NODE_ENV === 'development' ? code : undefined
        });

    } catch (error) {
        console.error('Request salary code error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});
// ============================================
// 19. RAPPORTS FRAIS CONSOMMÉS VS PRODUITS
// ============================================
router.get('/expenses/report', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'month', startDate, endDate } = req.query;

        let dateCondition = '';
        let params = [userId];

        if (startDate && endDate) {
            dateCondition = 'AND DATE(f.date) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (period === 'today') {
            dateCondition = 'AND DATE(f.date) = CURDATE()';
        } else if (period === 'week') {
            dateCondition = 'AND YEARWEEK(f.date, 1) = YEARWEEK(CURDATE(), 1)';
        } else if (period === 'month') {
            dateCondition = 'AND MONTH(f.date) = MONTH(CURDATE()) AND YEAR(f.date) = YEAR(CURDATE())';
        } else if (period === 'year') {
            dateCondition = 'AND YEAR(f.date) = YEAR(CURDATE())';
        }

        // Frais consommés (dépenses)
        const [expensesData] = await db.query(`
            SELECT 
                f.type_frais,
                COUNT(*) as nombre_transactions,
                COALESCE(SUM(f.montant), 0) as montant_total,
                AVG(f.montant) as montant_moyen,
                MIN(f.montant) as montant_min,
                MAX(f.montant) as montant_max,
                SUM(CASE WHEN f.valide = 1 THEN f.montant ELSE 0 END) as montant_valide,
                SUM(CASE WHEN f.valide = 0 THEN f.montant ELSE 0 END) as montant_en_attente,
                COUNT(CASE WHEN f.valide = 1 THEN 1 END) as transactions_validees,
                COUNT(CASE WHEN f.valide = 0 THEN 1 END) as transactions_en_attente
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            AND f.type_frais IN ('carburant', 'peage', 'parking', 'reparation', 'autre')
            ${dateCondition}
            GROUP BY f.type_frais
            ORDER BY montant_total DESC
        `, params);

        // Versements journaliers (recettes)
        const [revenuesData] = await db.query(`
            SELECT 
                'versement_journalier' as type_frais,
                COUNT(*) as nombre_transactions,
                COALESCE(SUM(f.montant), 0) as montant_total,
                AVG(f.montant) as montant_moyen,
                MIN(f.montant) as montant_min,
                MAX(f.montant) as montant_max,
                SUM(CASE WHEN f.valide = 1 THEN f.montant ELSE 0 END) as montant_valide,
                SUM(CASE WHEN f.valide = 0 THEN f.montant ELSE 0 END) as montant_en_attente,
                COUNT(CASE WHEN f.valide = 1 THEN 1 END) as transactions_validees,
                COUNT(CASE WHEN f.valide = 0 THEN 1 END) as transactions_en_attente
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            AND f.type_frais = 'versement_journalier'
            ${dateCondition}
        `, params);

        // Totaux par jour (CORRECTION ICI - toutes les colonnes non agrégées dans GROUP BY)
        const [dailyData] = await db.query(`
            SELECT 
                DATE(f.date) as date_jour,
                DATE_FORMAT(DATE(f.date), '%d/%m/%Y') as date_jour_format,
                DAYNAME(DATE(f.date)) as jour_semaine,
                SUM(CASE WHEN f.type_frais IN ('carburant', 'peage', 'parking', 'reparation', 'autre') THEN f.montant ELSE 0 END) as depenses_totales,
                SUM(CASE WHEN f.type_frais = 'versement_journalier' THEN f.montant ELSE 0 END) as versements_totaux,
                SUM(CASE WHEN f.type_frais = 'versement_journalier' THEN f.montant ELSE 0 END) - SUM(CASE WHEN f.type_frais IN ('carburant', 'peage', 'parking', 'reparation', 'autre') THEN f.montant ELSE 0 END) as solde_net,
                COUNT(DISTINCT m.id) as missions_jour,
                COALESCE(SUM(m.distance_parcourue), 0) as km_jour
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            ${dateCondition}
            GROUP BY DATE(f.date), DATE_FORMAT(DATE(f.date), '%d/%m/%Y'), DAYNAME(DATE(f.date))
            ORDER BY DATE(f.date) DESC
        `, params);

        const totalDepenses = expensesData.reduce((sum, item) => sum + item.montant_total, 0);
        const totalRecettes = revenuesData && revenuesData.length > 0 ? revenuesData[0].montant_total : 0;

        res.json({
            success: true,
            data: {
                period,
                summary: {
                    total_depenses: totalDepenses,
                    total_recettes: totalRecettes,
                    solde_net: totalRecettes - totalDepenses,
                    ratio_rentabilite: totalRecettes > 0 ? ((totalRecettes - totalDepenses) / totalRecettes * 100).toFixed(2) : 0
                },
                expenses_by_type: expensesData || [],
                revenues: revenuesData && revenuesData.length > 0 ? revenuesData[0] : null,
                daily_breakdown: dailyData || []
            }
        });

    } catch (error) {
        console.error('Get expenses report error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 20. DÉTAILS FRAIS PAR JOUR
// ============================================
router.get('/expenses/daily/:date', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const selectedDate = req.params.date;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            return res.status(400).json({
                success: false,
                message: 'Format de date invalide (attendu: YYYY-MM-DD)'
            });
        }

        const [missions] = await db.query(`
            SELECT 
                m.id,
                m.destination,
                m.motif,
                TIME_FORMAT(m.heure_depart, '%H:%i') as heure_depart,
                TIME_FORMAT(m.heure_retour, '%H:%i') as heure_retour,
                m.kilometrage_depart,
                m.kilometrage_retour,
                m.distance_parcourue,
                m.statut,
                v.immatriculation,
                v.marque,
                v.modele,
                SUM(f.montant) as frais_mission
            FROM mouvements_vehicules m
            JOIN vehicules v ON m.id_vehicule = v.id
            LEFT JOIN frais_vehicules f ON m.id = f.id_mouvement
            WHERE m.id_chauffeur = ? 
            AND DATE(m.date_mission) = ?
            GROUP BY m.id
            ORDER BY m.heure_depart ASC
        `, [userId, selectedDate]);

        const [expenses] = await db.query(`
            SELECT 
                f.id,
                f.type_frais,
                f.montant,
                f.description,
                f.date,
                f.piece_justificative,
                f.valide,
                CASE 
                    WHEN f.type_frais = 'carburant' THEN 'Carburant'
                    WHEN f.type_frais = 'peage' THEN 'Péage'
                    WHEN f.type_frais = 'parking' THEN 'Parking'
                    WHEN f.type_frais = 'reparation' THEN 'Réparation'
                    WHEN f.type_frais = 'versement_journalier' THEN 'Versement Journalier'
                    WHEN f.type_frais = 'autre' THEN 'Autre'
                END as type_libelle,
                m.destination
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            AND DATE(f.date) = ?
            ORDER BY f.date ASC
        `, [userId, selectedDate]);

        const depenses = expenses
            .filter(f => !['versement_journalier'].includes(f.type_frais))
            .reduce((sum, f) => sum + f.montant, 0);

        const versements = expenses
            .filter(f => f.type_frais === 'versement_journalier')
            .reduce((sum, f) => sum + f.montant, 0);

        const totalKm = missions.reduce((sum, m) => sum + (m.distance_parcourue || 0), 0);
        const heuresTravail = missions.length > 0 ? missions.length : 0;

        res.json({
            success: true,
            data: {
                date: selectedDate,
                missions: missions || [],
                expenses: expenses || [],
                summary: {
                    missions_nombre: missions.length,
                    km_total: totalKm,
                    heures_travail: heuresTravail,
                    depenses_total: depenses,
                    versements_total: versements,
                    solde_net: versements - depenses,
                    cout_km: totalKm > 0 ? (depenses / totalKm).toFixed(2) : 0
                }
            }
        });

    } catch (error) {
        console.error('Get daily expenses error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================
// 21. GRAPHIQUES STATISTIQUES (FRAIS)
// ============================================
router.get('/expenses/charts', authenticate, authorize(['chauffeur']), async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'month' } = req.query;

        let groupBy = 'DATE(f.date)';
        let dateLabel = '%d/%m';
        let dateCondition = 'MONTH(f.date) = MONTH(CURDATE()) AND YEAR(f.date) = YEAR(CURDATE())';

        if (period === 'week') {
            groupBy = 'DATE(f.date)';
            dateLabel = '%d/%m';
            dateCondition = 'YEARWEEK(f.date, 1) = YEARWEEK(CURDATE(), 1)';
        } else if (period === 'year') {
            groupBy = 'MONTH(f.date)';
            dateLabel = '%m/%Y';
            dateCondition = 'YEAR(f.date) = YEAR(CURDATE())';
        }

        const [chartData] = await db.query(`
            SELECT 
                DATE_FORMAT(${groupBy}, '${dateLabel}') as periode,
                SUM(CASE WHEN f.type_frais IN ('carburant', 'peage', 'parking', 'reparation', 'autre') THEN f.montant ELSE 0 END) as depenses,
                SUM(CASE WHEN f.type_frais = 'versement_journalier' THEN f.montant ELSE 0 END) as recettes,
                COUNT(DISTINCT m.id) as missions
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            AND ${dateCondition}
            GROUP BY ${groupBy}, DATE_FORMAT(${groupBy}, '${dateLabel}')
            ORDER BY ${groupBy} ASC
        `, [userId]);

        const [typeBreakdown] = await db.query(`
            SELECT 
                f.type_frais,
                CASE 
                    WHEN f.type_frais = 'carburant' THEN 'Carburant'
                    WHEN f.type_frais = 'peage' THEN 'Péage'
                    WHEN f.type_frais = 'parking' THEN 'Parking'
                    WHEN f.type_frais = 'reparation' THEN 'Réparation'
                    WHEN f.type_frais = 'autre' THEN 'Autre'
                END as type_libelle,
                COUNT(*) as nombre,
                SUM(f.montant) as montant
            FROM frais_vehicules f
            JOIN mouvements_vehicules m ON f.id_mouvement = m.id
            WHERE m.id_chauffeur = ? 
            AND ${dateCondition}
            AND f.type_frais IN ('carburant', 'peage', 'parking', 'reparation', 'autre')
            GROUP BY f.type_frais
            ORDER BY montant DESC
        `, [userId]);

        res.json({
            success: true,
            data: {
                period,
                trend: chartData || [],
                expense_breakdown: typeBreakdown || []
            }
        });

    } catch (error) {
        console.error('Get expense charts error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;