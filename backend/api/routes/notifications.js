// backend/routes/notifications.js

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const { sendExpoPushNotification } = require('../utils/notifications');

// ============================================
// ROUTES PUSH NOTIFICATIONS (Expo)
// ============================================

/**
 * Enregistrer un device pour les push notifications
 * POST /api/notifications/register-device
 */
router.post('/register-device', authenticate, async (req, res) => {
    try {
        const { pushToken, platform, deviceId } = req.body;

        // Validation stricte
        if (!pushToken || typeof pushToken !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Token push invalide ou manquant'
            });
        }

        // Vérifier que ce n'est pas un token web (qui nécessite VAPID)
        if (platform === 'web') {
            return res.status(400).json({
                success: false,
                message: 'Les notifications push web nécessitent une configuration VAPID',
                info: 'Utilisez WebSocket ou notifications in-app pour le web'
            });
        }

        // Vérifier si le device existe déjà
        const checkSql = `
            SELECT id FROM devices 
            WHERE push_token = ? AND id_utilisateur = ?
        `;
        const existing = await db.query(checkSql, [pushToken, req.userId]);

        if (existing && existing.length > 0) {
            // Mettre à jour le device existant
            const updateSql = `
                UPDATE devices SET 
                    platform = ?,
                    device_id = ?,
                    date_modification = NOW(),
                    actif = 1
                WHERE id = ?
            `;
            await db.query(updateSql, [
                platform || 'unknown',
                deviceId || 'unknown',
                existing[0].id
            ]);

            console.log(`✅ Device mis à jour pour utilisateur ${req.userId}`);
        } else {
            // Créer un nouveau device
            const insertSql = `
                INSERT INTO devices (
                    id_utilisateur, 
                    push_token, 
                    platform, 
                    device_id,
                    actif,
                    date_creation
                ) VALUES (?, ?, ?, ?, 1, NOW())
            `;
            await db.query(insertSql, [
                req.userId,
                pushToken,
                platform || 'unknown',
                deviceId || 'unknown'
            ]);

            console.log(`✅ Nouveau device créé pour utilisateur ${req.userId}`);
        }

        res.status(200).json({
            success: true,
            message: 'Device enregistré avec succès'
        });

    } catch (error) {
        console.error('❌ Register device error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement du device',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Désactiver un device
 * DELETE /api/notifications/unregister-device
 */
router.delete('/unregister-device', authenticate, async (req, res) => {
    try {
        const { pushToken } = req.body;

        if (!pushToken) {
            return res.status(400).json({
                success: false,
                message: 'Token push requis'
            });
        }

        const sql = `
            UPDATE devices 
            SET actif = 0, date_modification = NOW()
            WHERE push_token = ? AND id_utilisateur = ?
        `;

        const result = await db.query(sql, [pushToken, req.userId]);

        res.status(200).json({
            success: true,
            message: 'Device désactivé',
            affected: result.affectedRows
        });

    } catch (error) {
        console.error('❌ Unregister device error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désactivation du device'
        });
    }
});

// ============================================
// ROUTES NOTIFICATIONS APPLICATIVES
// ============================================

/**
 * Récupérer les notifications de l'utilisateur
 * GET /api/notifications
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const {
            type_notification,
            statut,
            priorite,
            startDate,
            endDate,
            page,
            limit,
            unreadOnly
        } = req.query;

        // =============================
        // Pagination sécurisée
        // =============================
        const pPage =
            Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;

        const pLimit =
            Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;

        const offset = (pPage - 1) * pLimit;

        // =============================
        // WHERE + params
        // =============================
        let whereSql = ' WHERE n.id_utilisateur = ? ';
        const params = [req.userId];

        if (type_notification) {
            whereSql += ' AND n.type_notification = ?';
            params.push(type_notification);
        }

        if (statut) {
            whereSql += ' AND n.statut = ?';
            params.push(statut);
        } else if (unreadOnly === 'true') {
            whereSql += ' AND n.statut = "non_lu"';
        }

        if (priorite) {
            whereSql += ' AND n.priorite = ?';
            params.push(priorite);
        }

        if (startDate && startDate !== '') {
            whereSql += ' AND n.date_creation >= ?';
            params.push(startDate);
        }

        if (endDate && endDate !== '') {
            whereSql += ' AND n.date_creation <= ?';
            params.push(endDate);
        }

        // =============================
        // DATA
        // =============================
        const sql = `
      SELECT 
        n.*,
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
      ${whereSql}
      ORDER BY n.priorite DESC, n.date_creation DESC
      LIMIT ${offset}, ${pLimit}
    `;

        // =============================
        // COUNT
        // =============================
        const countSql = `
      SELECT COUNT(*) AS total
      FROM notifications n
      ${whereSql}
    `;

        const notifications = await db.query(sql, params);
        const countResult = await db.query(countSql, params);
        const total = countResult[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                total,
                page: pPage,
                limit: pLimit,
                pages: Math.ceil(total / pLimit)
            }
        });

    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des notifications',
            error: error.message
        });
    }
});


/**
 * Récupérer les statistiques
 * GET /api/notifications/stats
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const sql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN statut = 'non_lu' THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN priorite = 'urgente' THEN 1 ELSE 0 END) as urgent,
                SUM(CASE WHEN priorite = 'haute' THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN priorite = 'normale' THEN 1 ELSE 0 END) as normal,
                SUM(CASE WHEN priorite = 'basse' THEN 1 ELSE 0 END) as low
            FROM notifications 
            WHERE id_utilisateur = ?
        `;

        const stats = await db.query(sql, [req.userId]);

        res.status(200).json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        console.error('❌ Get notification stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

/**
 * Marquer une notification comme lue
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticate, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        if (isNaN(notificationId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de notification invalide'
            });
        }

        const sql = `
            UPDATE notifications 
            SET statut = 'lu',
                date_lecture = NOW(),
                date_modification = NOW()
            WHERE id = ? AND id_utilisateur = ?
        `;

        const result = await db.query(sql, [notificationId, req.userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marquée comme lue'
        });

    } catch (error) {
        console.error('❌ Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour'
        });
    }
});

/**
 * Marquer toutes comme lues
 * PUT /api/notifications/read-all
 */
router.put('/read-all', authenticate, async (req, res) => {
    try {
        const sql = `
            UPDATE notifications 
            SET statut = 'lu',
                date_lecture = NOW(),
                date_modification = NOW()
            WHERE id_utilisateur = ? AND statut = 'non_lu'
        `;

        const result = await db.query(sql, [req.userId]);

        res.status(200).json({
            success: true,
            message: `${result.affectedRows} notification(s) marquée(s) comme lue(s)`
        });

    } catch (error) {
        console.error('❌ Mark all read error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour'
        });
    }
});

/**
 * Supprimer une notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        if (isNaN(notificationId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de notification invalide'
            });
        }

        const sql = `
            DELETE FROM notifications 
            WHERE id = ? AND id_utilisateur = ?
        `;

        const result = await db.query(sql, [notificationId, req.userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification non trouvée'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification supprimée'
        });

    } catch (error) {
        console.error('❌ Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression'
        });
    }
});

/**
 * Supprimer toutes les notifications
 * DELETE /api/notifications
 */
router.delete('/', authenticate, async (req, res) => {
    try {
        const sql = `DELETE FROM notifications WHERE id_utilisateur = ?`;
        const result = await db.query(sql, [req.userId]);

        res.status(200).json({
            success: true,
            message: `${result.affectedRows} notification(s) supprimée(s)`
        });

    } catch (error) {
        console.error('❌ Delete all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression'
        });
    }
});

// ============================================
// ROUTES ADMIN - ENVOI DE NOTIFICATIONS
// ============================================

/**
 * Envoyer une notification à un utilisateur
 * POST /api/notifications/send
 */
router.post('/send', authenticate, authorize('admin', 'manager'), async (req, res) => {
    try {
        const {
            user_id,
            type_notification,
            titre,
            message,
            priorite = 'normale',
            type_reference,
            id_reference,
            actions_possibles
        } = req.body;

        // Validation
        if (!user_id || !type_notification || !titre || !message) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants (user_id, type_notification, titre, message)'
            });
        }

        // Créer la notification dans la base
        const sql = `
            INSERT INTO notifications (
                id_utilisateur, type_notification, titre, message,
                priorite, type_reference, id_reference, actions_possibles,
                date_creation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        await db.query(sql, [
            user_id,
            type_notification,
            titre,
            message,
            priorite,
            type_reference || null,
            id_reference || null,
            actions_possibles ? JSON.stringify(actions_possibles) : null
        ]);

        // Envoyer via WebSocket si disponible
        if (req.io) {
            req.io.to(`user-${user_id}`).emit('new-notification', {
                id_utilisateur: user_id,
                type_notification,
                titre,
                message,
                priorite,
                type_reference,
                id_reference,
                timestamp: new Date().toISOString()
            });
        }

        // Envoyer une push notification Expo (mobile uniquement)
        try {
            await sendExpoPushNotification(user_id, {
                title: titre,
                body: message,
                data: {
                    type: type_notification,
                    reference_type: type_reference,
                    reference_id: id_reference,
                    priority: priorite
                }
            });
        } catch (pushError) {
            console.warn('⚠️ Erreur push notification:', pushError.message);
            // Ne pas bloquer si la push échoue
        }

        res.status(201).json({
            success: true,
            message: 'Notification envoyée avec succès'
        });

    } catch (error) {
        console.error('❌ Send notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de la notification'
        });
    }
});

/**
 * Diffuser une notification à un groupe
 * POST /api/notifications/broadcast
 */
router.post('/broadcast', authenticate, authorize('admin'), async (req, res) => {
    try {
        const {
            user_ids,
            departement_id,
            role,
            type_notification,
            titre,
            message,
            priorite = 'normale'
        } = req.body;

        // Validation
        if (!type_notification || !titre || !message) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants (type_notification, titre, message)'
            });
        }

        // Déterminer les utilisateurs cibles
        let targetUsers = [];

        if (user_ids && user_ids.length > 0) {
            const placeholders = user_ids.map(() => '?').join(',');
            const usersSql = `
                SELECT id FROM utilisateurs 
                WHERE id IN (${placeholders}) AND statut = 'actif'
            `;
            targetUsers = await db.query(usersSql, user_ids);

        } else if (departement_id) {
            const deptSql = `
                SELECT id FROM utilisateurs 
                WHERE id_departement = ? AND statut = 'actif'
            `;
            targetUsers = await db.query(deptSql, [departement_id]);

        } else if (role) {
            const roleSql = `
                SELECT id FROM utilisateurs 
                WHERE role = ? AND statut = 'actif'
            `;
            targetUsers = await db.query(roleSql, [role]);

        } else {
            return res.status(400).json({
                success: false,
                message: 'Cible de diffusion non spécifiée (user_ids, departement_id ou role)'
            });
        }

        if (!targetUsers || targetUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun utilisateur trouvé'
            });
        }

        // Créer les notifications
        const insertPromises = targetUsers.map(user => {
            return db.query(
                `INSERT INTO notifications (
                    id_utilisateur, type_notification, titre, message,
                    priorite, date_creation
                ) VALUES (?, ?, ?, ?, ?, NOW())`,
                [user.id, type_notification, titre, message, priorite]
            );
        });

        await Promise.all(insertPromises);

        // Envoyer via WebSocket
        if (req.io) {
            targetUsers.forEach(user => {
                req.io.to(`user-${user.id}`).emit('new-notification', {
                    type_notification,
                    titre,
                    message,
                    priorite,
                    timestamp: new Date().toISOString()
                });
            });
        }

        res.status(201).json({
            success: true,
            message: `Notification diffusée à ${targetUsers.length} utilisateur(s)`
        });

    } catch (error) {
        console.error('❌ Broadcast notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la diffusion'
        });
    }
});

/**
 * Envoyer un message à l'administration (Contact Admin/RH)
 * POST /api/notifications/contact-admin
 */
router.post('/contact-admin', authenticate, async (req, res) => {
    try {
        const { sujet, message } = req.body;
        const userId = req.userId;

        if (!sujet || !message) {
            return res.status(400).json({
                success: false,
                message: 'Le sujet et le message sont obligatoires.'
            });
        }

        // Récupérer tous les administrateurs actifs
        const admins = await db.query(
            "SELECT id FROM employes WHERE role = 'admin' AND statut = 'actif'"
        );

        if (!admins || admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun administrateur disponible pour recevoir votre message.'
            });
        }

        // Récupérer les informations de l'expéditeur
        const sender = await db.query(
            "SELECT nom_complet, role FROM employes WHERE id = ?",
            [userId]
        );
        const senderInfo = (sender && sender[0]) ? `${sender[0].nom_complet} (${sender[0].role})` : 'Un employé';

        // Créer les notifications pour chaque admin
        const insertPromises = admins.map(admin => {
            return db.query(
                `INSERT INTO notifications (
                    id_utilisateur, type_notification, titre, message,
                    priorite, date_creation, statut
                ) VALUES (?, 'message', ?, ?, 'normale', NOW(), 'non_lu')`,
                [admin.id, `Nouveau message: ${sujet}`, `De: ${senderInfo}\n\n${message}`]
            );
        });

        await Promise.all(insertPromises);

        // Notifier via Socket.io si disponible
        if (req.io) {
            admins.forEach(admin => {
                req.io.to(`user-${admin.id}`).emit('new-notification', {
                    type_notification: 'message',
                    titre: `Message de ${senderInfo}`,
                    message: sujet,
                    timestamp: new Date().toISOString()
                });
            });
        }

        res.status(201).json({
            success: true,
            message: 'Votre message a été envoyé à l\'administration avec succès.'
        });

    } catch (error) {
        console.error('❌ Contact admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de l\'envoi de votre message.'
        });
    }
});

module.exports = router;