// backend/api/utils/permissionValidator.js
const db = require('../../database/db');

/**
 * Vérifie si un utilisateur a la permission requise
 */
async function validatePermission(userId, requiredRole) {
  const sql = `
    SELECT role, statut 
    FROM utilisateurs 
    WHERE id = ?
  `;

  const [user] = await db.query(sql, [userId]);

  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  if (user.statut !== 'actif') {
    throw new Error('Compte désactivé');
  }

  // Si c'est un tableau de rôles
  if (Array.isArray(requiredRole)) {
    if (!requiredRole.includes(user.role)) {
      throw new Error('Permission refusée');
    }
  } else {
    // Si c'est un seul rôle
    if (user.role !== requiredRole && user.role !== 'admin') {
      throw new Error('Permission refusée');
    }
  }

  return true;
}

/**
 * Vérifie si un utilisateur peut accéder à un département
 */
async function validateDepartmentAccess(userId, departmentId) {
  const sql = `
    SELECT 
      u.role,
      u.id_departement,
      u.statut
    FROM utilisateurs u
    WHERE u.id = ?
  `;

  const [user] = await db.query(sql, [userId]);

  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  if (user.statut !== 'actif') {
    throw new Error('Compte désactivé');
  }

  // Admin a accès à tous les départements
  if (user.role === 'admin') {
    return true;
  }

  // Manager ne peut accéder qu'à son département
  if (user.role === 'manager' && user.id_departement !== departmentId) {
    throw new Error('Accès refusé à ce département');
  }

  return true;
}

/**
 * Vérifie si un utilisateur peut modifier un enregistrement
 */
async function validateRecordOwnership(userId, table, recordId, ownerField = 'cree_par') {
  const sql = `SELECT ${ownerField}, statut FROM ${table} WHERE id = ?`;
  const [record] = await db.query(sql, [recordId]);

  if (!record) {
    throw new Error('Enregistrement non trouvé');
  }

  // Vérifier si l'utilisateur est admin
  const userSql = `SELECT role FROM utilisateurs WHERE id = ?`;
  const [user] = await db.query(userSql, [userId]);

  if (user.role === 'admin') {
    return true;
  }

  // Vérifier si l'utilisateur est le propriétaire
  if (record[ownerField] !== userId) {
    throw new Error('Vous n\'êtes pas autorisé à modifier cet enregistrement');
  }

  return true;
}

module.exports = {
  validatePermission,
  validateDepartmentAccess,
  validateRecordOwnership
};