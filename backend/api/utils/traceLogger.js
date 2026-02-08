// backend/api/utils/traceLogger.js
const db = require('../../database/db');

/**
 * Enregistre une trace dans la base de données
 * @param {Object} traceData - Données de la trace
 * @param {number} traceData.userId - ID de l'utilisateur
 * @param {string} traceData.module - Module concerné
 * @param {string} traceData.action - Type d'action
 * @param {string} traceData.details - Détails de l'action
 * @param {string} traceData.table - Table affectée
 * @param {number} traceData.recordId - ID de l'enregistrement
 * @param {Object} traceData.before - Données avant modification
 * @param {Object} traceData.after - Données après modification
 * @param {string} traceData.ipAddress - Adresse IP
 * @param {string} traceData.userAgent - User agent
 * @param {string} traceData.niveau - Niveau (info, warning, error, critical)
 */
async function logTrace(traceData) {
  try {
    const {
      userId,
      module,
      action,
      details,
      table = null,
      recordId = null,
      before = null,
      after = null,
      ipAddress = null,
      userAgent = null,
      niveau = 'info'
    } = traceData;

    // Calculer les différences si before et after sont fournis
    let differences = null;
    if (before && after) {
      differences = calculateDifferences(before, after);
    }

    const sql = `
      INSERT INTO traces (
        id_utilisateur, module, type_action, action_details,
        table_affectee, id_enregistrement,
        donnees_avant, donnees_apres, differences,
        ip_address, user_agent, niveau
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      userId,
      module,
      action,
      details,
      table,
      recordId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      differences ? JSON.stringify(differences) : null,
      ipAddress,
      userAgent,
      niveau
    ]);

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la création de la trace:', error);
    // Ne pas bloquer l'opération principale si la trace échoue
    return { success: false, error: error.message };
  }
}

/**
 * Calcule les différences entre deux objets
 */
function calculateDifferences(before, after) {
  const differences = {};

  // Parcourir toutes les clés de l'objet "after"
  Object.keys(after).forEach(key => {
    if (before[key] !== after[key]) {
      differences[key] = {
        before: before[key],
        after: after[key]
      };
    }
  });

  // Vérifier les clés supprimées
  Object.keys(before).forEach(key => {
    if (!(key in after)) {
      differences[key] = {
        before: before[key],
        after: null
      };
    }
  });

  return Object.keys(differences).length > 0 ? differences : null;
}

/**
 * Récupère l'historique des traces pour un utilisateur
 */
async function getUserTraces(userId, options = {}) {
  const {
    module = null,
    action = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0
  } = options;

  let sql = `
    SELECT 
      t.*,
      u.nom_complet as utilisateur_nom,
      u.role as utilisateur_role
    FROM traces t
    LEFT JOIN utilisateurs u ON t.id_utilisateur = u.id
    WHERE t.id_utilisateur = ?
  `;
  const params = [userId];

  if (module) {
    sql += ' AND t.module = ?';
    params.push(module);
  }

  if (action) {
    sql += ' AND t.type_action = ?';
    params.push(action);
  }

  if (startDate) {
    sql += ' AND t.date_action >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND t.date_action <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY t.date_action DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await db.query(sql, params);
}

/**
 * Récupère l'historique des traces pour un enregistrement spécifique
 */
async function getRecordTraces(table, recordId) {
  const sql = `
    SELECT 
      t.*,
      u.nom_complet as utilisateur_nom,
      u.role as utilisateur_role
    FROM traces t
    LEFT JOIN utilisateurs u ON t.id_utilisateur = u.id
    WHERE t.table_affectee = ?
    AND t.id_enregistrement = ?
    ORDER BY t.date_action DESC
  `;

  return await db.query(sql, [table, recordId]);
}

/**
 * Middleware pour enregistrer automatiquement les requêtes
 */
function autoTrace(options = {}) {
  return async (req, res, next) => {
    const {
      module,
      excludeActions = [],
      includeBody = false
    } = options;

    // Enregistrer la méthode et le path originaux
    const originalMethod = req.method;
    const originalPath = req.path;

    // Hook sur res.send pour capturer la réponse
    const originalSend = res.send;
    res.send = function(data) {
      // Déterminer l'action
      let action = `${originalMethod}_${originalPath}`;
      
      // Ne pas tracer si dans les exclusions
      if (excludeActions.includes(action)) {
        return originalSend.call(this, data);
      }

      // Extraire les détails de la requête
      const details = {
        method: originalMethod,
        path: originalPath,
        params: req.params,
        query: req.query
      };

      if (includeBody && ['POST', 'PUT', 'PATCH'].includes(originalMethod)) {
        details.body = req.body;
      }

      // Enregistrer la trace
      if (req.userId) {
        logTrace({
          userId: req.userId,
          module: module || 'api',
          action: action,
          details: JSON.stringify(details),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          niveau: res.statusCode >= 400 ? 'error' : 'info'
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

module.exports = {
  logTrace,
  getUserTraces,
  getRecordTraces,
  autoTrace,
  calculateDifferences
};