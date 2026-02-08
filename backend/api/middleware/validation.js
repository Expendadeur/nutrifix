// backend/api/middleware/validation.js
const { body, validationResult } = require('express-validator');

const validateInput = (rules) => {
  return async (req, res, next) => {
    const errors = [];

    for (const rule of rules) {
      const { field, type, required, min, max } = rule;
      const value = req.body[field];

      // Vérifier si requis
      if (required && (value === undefined || value === null || value === '')) {
        errors.push(`Le champ ${field} est requis`);
        continue;
      }

      // Si pas requis et pas de valeur, passer
      if (!required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Validation par type
      switch (type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Le champ ${field} doit être une chaîne de caractères`);
          }
          if (min && value.length < min) {
            errors.push(`Le champ ${field} doit contenir au moins ${min} caractères`);
          }
          if (max && value.length > max) {
            errors.push(`Le champ ${field} ne doit pas dépasser ${max} caractères`);
          }
          break;

        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`Le champ ${field} doit être un nombre`);
          }
          if (min !== undefined && Number(value) < min) {
            errors.push(`Le champ ${field} doit être supérieur ou égal à ${min}`);
          }
          if (max !== undefined && Number(value) > max) {
            errors.push(`Le champ ${field} doit être inférieur ou égal à ${max}`);
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`Le champ ${field} doit être une adresse email valide`);
          }
          break;

        case 'date':
          if (isNaN(Date.parse(value))) {
            errors.push(`Le champ ${field} doit être une date valide`);
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Le champ ${field} doit être un booléen`);
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Le champ ${field} doit être un tableau`);
          }
          if (min && value.length < min) {
            errors.push(`Le champ ${field} doit contenir au moins ${min} éléments`);
          }
          if (max && value.length > max) {
            errors.push(`Le champ ${field} ne doit pas dépasser ${max} éléments`);
          }
          break;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    next();
  };
};

module.exports = { validateInput };