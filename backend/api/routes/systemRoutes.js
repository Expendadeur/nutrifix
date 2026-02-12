// backend/api/routes/systemRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../../database/db');

/**
 * GET /api/system/check-uniqueness
 * Verifie si une valeur est unique dans une table/champ donné
 * Query params: table, field, value, excludeId (optional)
 */
router.get('/check-uniqueness', authenticate, async (req, res) => {
    try {
        const { table, field, value, excludeId } = req.query;

        if (!table || !field || !value) {
            return res.status(400).json({
                success: false,
                message: 'Paramètres manquants (table, field, value).'
            });
        }

        // Liste blanche des tables et champs autorisés pour éviter les injections SQL
        // On utilise les noms de tables réels tels qu'ils apparaissent dans la base de données
        const allowedTables = ['utilisateurs', 'vehicules', 'animaux', 'parcelles', 'employes'];
        const allowedFields = ['matricule', 'email', 'immatriculation', 'numero_identification', 'reference'];

        if (!allowedTables.includes(table) || !allowedFields.includes(field)) {
            return res.status(400).json({
                success: false,
                message: 'Table ou champ non autorisé.'
            });
        }

        let sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${field} = ?`;
        const params = [value];

        if (excludeId && excludeId !== 'null' && excludeId !== 'undefined') {
            sql += ' AND id != ?';
            params.push(excludeId);
        }

        const [results] = await db.query(sql, params);
        const isUnique = results.count === 0;

        res.status(200).json({
            success: true,
            isUnique,
            message: isUnique ? 'Valeur disponible' : 'Valeur déjà utilisée'
        });
    } catch (error) {
        console.error('Check uniqueness error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification d\'unicité.'
        });
    }
});

module.exports = router;
