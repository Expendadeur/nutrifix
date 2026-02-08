const db = require('../../database/db');
const fetch = require('node-fetch'); // si Node v22, fetch est global, sinon tu peux utiliser node-fetch

// Envoyer push notification Expo
async function sendExpoPushNotification(userId, notification) {
    try {
        const tokensSql = `SELECT push_token FROM devices WHERE id_utilisateur = ? AND push_token IS NOT NULL`;
        const [devices] = await db.query(tokensSql, [userId]);
        if (devices.length === 0) return;

        const messages = devices.map(device => ({
            to: device.push_token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            priority: 'high'
        }));

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages)
        });

        const result = await response.json();
        console.log('Expo push result:', result);

    } catch (error) {
        console.error('Send Expo push error:', error);
    }
}

// Créer notification
async function createNotification(data) {
    const { userId, type, title, message, priority = 'normale', referenceType, referenceId } = data;
    try {
        const sql = `INSERT INTO notifications (id_utilisateur, type_notification, titre, message, priorite, type_reference, id_reference)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [userId, type, title, message, priority, referenceType || null, referenceId || null]);

        if (global.io) {
            global.io.to(`user-${userId}`).emit('new-notification', {
                type_notification: type,
                titre: title,
                message,
                priorite: priority,
                type_reference: referenceType,
                id_reference: referenceId
            });
        }

        await sendExpoPushNotification(userId, {
            title,
            body: message,
            data: { type, reference_type: referenceType, reference_id: referenceId, priority }
        });

        return true;
    } catch (error) {
        console.error('Create notification error:', error);
        return false;
    }
}

module.exports = { sendExpoPushNotification, createNotification };
