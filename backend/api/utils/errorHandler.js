// backend/api/utils/errorHandler.js

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Gestionnaire d'erreurs centralisé
 */
function handleError(res, error, defaultMessage = 'Une erreur est survenue') {
  console.error('Erreur:', error);

  // Si c'est une erreur opérationnelle attendue
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      timestamp: error.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  // Erreurs de base de données
  if (error.code) {
    switch (error.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({
          success: false,
          message: 'Cette entrée existe déjà dans la base de données'
        });
      
      case 'ER_NO_REFERENCED_ROW':
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({
          success: false,
          message: 'Référence invalide - l\'enregistrement lié n\'existe pas'
        });
      
      case 'ER_ROW_IS_REFERENCED':
      case 'ER_ROW_IS_REFERENCED_2':
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer - cet enregistrement est utilisé ailleurs'
        });
      
      case 'ER_DATA_TOO_LONG':
        return res.status(400).json({
          success: false,
          message: 'Les données fournies sont trop longues pour le champ'
        });

      case 'ER_BAD_NULL_ERROR':
        return res.status(400).json({
          success: false,
          message: 'Un champ obligatoire est manquant'
        });
    }
  }

  // Erreurs de validation
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: error.message || 'Erreur de validation des données'
    });
  }

  // Erreur par défaut (500)
  return res.status(500).json({
    success: false,
    message: defaultMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    })
  });
}

/**
 * Middleware de gestion d'erreurs global
 */
function globalErrorHandler(err, req, res, next) {
  handleError(res, err);
}

/**
 * Wrapper pour les fonctions async
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  handleError,
  globalErrorHandler,
  asyncHandler
};