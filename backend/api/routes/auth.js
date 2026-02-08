// backend/api/routes/auth.js
const express = require('express');
const router = express.Router();

const {
    authenticate,
    authorize,
    authenticateQR,
    authenticateGoogle,
    authenticateFingerprint,
    registerFingerprint,
    deleteFingerprint,
    rateLimitByUser,
    auditLog
} = require('../middleware/auth');

const User = require('../models/User');

// ============================================
// UTILITAIRE DE LOGGING SÉCURISÉ
// ============================================
const secureLog = {
    // Logs internes (serveur uniquement)
    internal: (level, message, data = {}) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...data
        };
        
        // En production, envoyer vers un service de logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${level.toUpperCase()}] ${message}`, data);
        } else {
            // TODO: Envoyer vers CloudWatch, Sentry, etc.
            console.log(JSON.stringify(logEntry));
        }
    },
    
    // Log des tentatives de connexion échouées (pour détecter les attaques)
    loginAttempt: async (email, success, reason, req) => {
        const logData = {
            email,
            success,
            reason,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date()
        };
        
        // Log interne
        secureLog.internal(success ? 'info' : 'warning', 
            `Login attempt: ${success ? 'SUCCESS' : 'FAILED'}`, 
            logData
        );
        
        // Stocker en base pour analyse de sécurité
        try {
            await req.db.query(`
                INSERT INTO tentatives_connexion (
                    email, succes, raison, ip_address, 
                    user_agent, date_tentative
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [email, success, reason, req.ip, req.get('user-agent')]);
        } catch (err) {
            // Ne pas bloquer la requête si le log échoue
            console.error('Failed to log login attempt:', err);
        }
    }
};

// ============================================
// DÉLAI ARTIFICIEL (ANTI BRUTE-FORCE)
// ============================================
const secureDelay = () => {
    // Ajouter un délai aléatoire entre 200-500ms pour éviter le timing attack
    const delay = Math.floor(Math.random() * 300) + 200;
    return new Promise(resolve => setTimeout(resolve, delay));
};

// ============================================
// MESSAGES D'ERREUR GÉNÉRIQUES (SÉCURISÉS)
// ============================================
const SECURE_MESSAGES = {
    INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.',
    ACCOUNT_DISABLED: 'Votre compte est temporairement désactivé. Contactez l\'administrateur.',
    MISSING_FIELDS: 'Veuillez fournir tous les champs requis.',
    SERVER_ERROR: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    TOO_MANY_ATTEMPTS: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.',
    SUCCESS: 'Connexion réussie.'
};

// ============================================
// RÔLES AUTORISÉS À SE CONNECTER
// ============================================
const ALLOWED_ROLES = [
    'admin',
    'manager',
    'employe',
    'comptable',
    'veterinaire',
    'chauffeur',
    'agriculteur',
    'technicien'
];

// ======================================================
// AUTHENTIFICATION CLASSIQUE (EMAIL / MOT DE PASSE)
// ======================================================
router.post('/login', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { email, password } = req.body;
        
        secureLog.internal('info', 'Login attempt started', {
            email: email ? email.substring(0, 3) + '***' : 'EMPTY',
            ip: req.ip
        });

        // ✅ VALIDATION DES CHAMPS
        if (!email || !password) {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: missing fields', {
                hasEmail: !!email,
                hasPassword: !!password,
                ip: req.ip
            });
            
            return res.status(400).json({
                success: false,
                message: SECURE_MESSAGES.MISSING_FIELDS
            });
        }

        // ✅ RECHERCHE DE L'UTILISATEUR (avec toutes ses infos)
        const user = await User.findByEmailComplete(email);
        
        // 🔒 JAMAIS révéler si l'utilisateur existe ou non
        if (!user) {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: user not found', {
                email: email.substring(0, 3) + '***',
                ip: req.ip
            });
            
            await secureLog.loginAttempt(email, false, 'USER_NOT_FOUND', req);
            
            return res.status(401).json({
                success: false,
                message: SECURE_MESSAGES.INVALID_CREDENTIALS
            });
        }

        // ⚠️ VÉRIFICATION DYNAMIQUE DU TYPE D'EMPLOYÉ DEPUIS LA BD
        // On vérifie que le type d'employé de cet utilisateur peut se connecter
        const canTypeLogin = await User.canEmployeeTypeLogin(user.type_employe);
        
        if (!canTypeLogin) {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: employee type not allowed (from DB)', {
                userId: user.id,
                type_employe: user.type_employe,
                email: email.substring(0, 3) + '***',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            
            // ⚠️ Enregistrer comme tentative échouée
            await secureLog.loginAttempt(email, false, `EMPLOYEE_TYPE_NOT_ALLOWED_${user.type_employe}`, req);
            
            // ⚠️ IMPORTANT : Message GÉNÉRIQUE
            return res.status(401).json({
                success: false,
                message: SECURE_MESSAGES.INVALID_CREDENTIALS
            });
        }

        // ✅ VÉRIFICATION DU MOT DE PASSE
        const isPasswordValid = await User.verifyPassword(user, password);
        
        if (!isPasswordValid) {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: invalid password', {
                userId: user.id,
                type_employe: user.type_employe,
                email: email.substring(0, 3) + '***',
                ip: req.ip
            });
            
            await secureLog.loginAttempt(email, false, 'INVALID_PASSWORD', req);
            
            return res.status(401).json({
                success: false,
                message: SECURE_MESSAGES.INVALID_CREDENTIALS
            });
        }

        // ✅ VÉRIFICATION DU STATUT DU COMPTE (depuis la BD)
        if (user.statut !== 'actif') {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: account not active', {
                userId: user.id,
                statut: user.statut,
                type_employe: user.type_employe,
                ip: req.ip
            });
            
            await secureLog.loginAttempt(email, false, 'ACCOUNT_NOT_ACTIVE', req);
            
            return res.status(403).json({
                success: false,
                message: SECURE_MESSAGES.ACCOUNT_DISABLED
            });
        }

        // ⚠️ VÉRIFICATION DYNAMIQUE DU RÔLE DEPUIS LA BD
        const canRoleLogin = await User.canRoleLogin(user.role);
        
        if (!canRoleLogin) {
            await secureDelay();
            
            secureLog.internal('warning', 'Login failed: role not allowed (from DB)', {
                userId: user.id,
                role: user.role,
                type_employe: user.type_employe,
                email: email.substring(0, 3) + '***',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            
            await secureLog.loginAttempt(email, false, `ROLE_NOT_ALLOWED_${user.role}`, req);
            
            // ⚠️ IMPORTANT : Message GÉNÉRIQUE
            return res.status(401).json({
                success: false,
                message: SECURE_MESSAGES.INVALID_CREDENTIALS
            });
        }

        // ✅ CONNEXION RÉUSSIE
        await User.updateLastLogin(user.id);
        const token = User.generateToken(user);
        
        secureLog.internal('info', 'Login successful', {
            userId: user.id,
            role: user.role,
            type_employe: user.type_employe,
            ip: req.ip,
            duration: Date.now() - startTime + 'ms'
        });
        
        await secureLog.loginAttempt(email, true, 'SUCCESS', req);

        // ✅ RÉPONSE DE SUCCÈS
        res.status(200).json({
            success: true,
            message: SECURE_MESSAGES.SUCCESS,
            token,
            user: {
                id: user.id,
                matricule: user.matricule,
                email: user.email,
                nom_complet: user.nom_complet,
                role: user.role,
                type_employe: user.type_employe,
                id_departement: user.id_departement,
                departement_nom: user.departement_nom,
                departement_type: user.departement_type,
                telephone: user.telephone,
                photo_profil: user.photo_profil,
                statut: user.statut
            }
        });
        
    } catch (error) {
        secureLog.internal('error', 'Login error', {
            message: error.message,
            stack: error.stack,
            ip: req.ip
        });
        
        res.status(500).json({
            success: false,
            message: SECURE_MESSAGES.SERVER_ERROR
        });
    }
});

// ======================================================
// AUTHENTIFICATION QR CODE
// ======================================================
router.post(
    '/login/qr',
    rateLimitByUser(10),
    authenticateQR,
    auditLog('QR_LOGIN'),
    (req, res) => {
        try {
            // Vérifier le rôle aussi pour QR
            if (!ALLOWED_ROLES.includes(req.user.role)) {
                secureLog.internal('warning', 'QR login failed: unauthorized role', {
                    userId: req.user.id,
                    role: req.user.role,
                    ip: req.ip
                });

                return res.status(401).json({
                    success: false,
                    message: SECURE_MESSAGES.INVALID_CREDENTIALS
                });
            }

            res.status(200).json({
                success: true,
                message: SECURE_MESSAGES.SUCCESS,
                token: req.token,
                user: {
                    id: req.user.id,
                    matricule: req.user.matricule,
                    email: req.user.email,
                    nom_complet: req.user.nom_complet,
                    role: req.user.role,
                    type_employe: req.user.type_employe,
                    id_departement: req.user.id_departement,
                    departement_nom: req.user.departement_nom
                }
            });
        } catch (error) {
            secureLog.internal('error', 'QR login response error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// AUTHENTIFICATION GOOGLE (EMPLOYÉS TEMPS PARTIEL)
// ======================================================
router.post(
    '/login/google',
    rateLimitByUser(10),
    authenticateGoogle,
    auditLog('GOOGLE_LOGIN'),
    (req, res) => {
        try {
            // Vérifier le rôle
            if (!ALLOWED_ROLES.includes(req.user.role)) {
                secureLog.internal('warning', 'Google login failed: unauthorized role', {
                    userId: req.user.id,
                    role: req.user.role,
                    ip: req.ip
                });

                return res.status(401).json({
                    success: false,
                    message: SECURE_MESSAGES.INVALID_CREDENTIALS
                });
            }

            res.status(200).json({
                success: true,
                message: SECURE_MESSAGES.SUCCESS,
                token: req.token,
                user: {
                    id: req.user.id,
                    matricule: req.user.matricule,
                    email: req.user.email,
                    nom_complet: req.user.nom_complet,
                    role: req.user.role,
                    type_employe: req.user.type_employe,
                    id_departement: req.user.id_departement
                }
            });
        } catch (error) {
            secureLog.internal('error', 'Google login response error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// AUTHENTIFICATION PAR EMPREINTE DIGITALE
// ======================================================
router.post(
    '/login/fingerprint',
    rateLimitByUser(5),
    authenticateFingerprint,
    auditLog('FINGERPRINT_LOGIN'),
    (req, res) => {
        try {
            // Vérifier le rôle
            if (!ALLOWED_ROLES.includes(req.user.role)) {
                secureLog.internal('warning', 'Fingerprint login failed: unauthorized role', {
                    userId: req.user.id,
                    role: req.user.role,
                    ip: req.ip
                });

                return res.status(401).json({
                    success: false,
                    message: SECURE_MESSAGES.INVALID_CREDENTIALS
                });
            }

            res.status(200).json({
                success: true,
                message: SECURE_MESSAGES.SUCCESS,
                token: req.token,
                user: {
                    id: req.user.id,
                    matricule: req.user.matricule,
                    email: req.user.email,
                    nom_complet: req.user.nom_complet,
                    role: req.user.role,
                    type_employe: req.user.type_employe,
                    id_departement: req.user.id_departement,
                    departement_nom: req.user.departement_nom
                }
            });
        } catch (error) {
            secureLog.internal('error', 'Fingerprint login response error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// PROFIL UTILISATEUR CONNECTÉ
// ======================================================
router.get(
    '/me',
    authenticate,
    auditLog('GET_PROFILE'),
    async (req, res) => {
        try {
            res.status(200).json({
                success: true,
                user: {
                    id: req.user.id,
                    matricule: req.user.matricule,
                    email: req.user.email,
                    nom_complet: req.user.nom_complet,
                    role: req.user.role,
                    type_employe: req.user.type_employe,
                    id_departement: req.user.id_departement,
                    departement_nom: req.user.departement_nom,
                    departement_type: req.user.departement_type,
                    telephone: req.user.telephone,
                    photo_profil: req.user.photo_profil,
                    statut: req.user.statut,
                    derniere_connexion: req.user.derniere_connexion
                }
            });
        } catch (error) {
            secureLog.internal('error', 'Get profile error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// RAFRAÎCHISSEMENT TOKEN
// ======================================================
router.post(
    '/refresh',
    authenticate,
    auditLog('REFRESH_TOKEN'),
    async (req, res) => {
        try {
            const token = User.generateToken(req.user);

            res.status(200).json({
                success: true,
                token,
                user: {
                    id: req.user.id,
                    matricule: req.user.matricule,
                    email: req.user.email,
                    nom_complet: req.user.nom_complet,
                    role: req.user.role,
                    type_employe: req.user.type_employe,
                    id_departement: req.user.id_departement
                }
            });
        } catch (error) {
            secureLog.internal('error', 'Refresh token error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// ENREGISTREMENT EMPREINTE DIGITALE
// ======================================================
router.post(
    '/fingerprint/register',
    authenticate,
    authorize('admin', 'manager'),
    auditLog('FINGERPRINT_REGISTER'),
    registerFingerprint
);

// ======================================================
// SUPPRESSION EMPREINTE DIGITALE
// ======================================================
router.delete(
    '/fingerprint/:userId',
    authenticate,
    authorize('admin'),
    auditLog('FINGERPRINT_DELETE'),
    deleteFingerprint
);

// ======================================================
// DÉCONNEXION (LOGIQUE API)
// ======================================================
router.post(
    '/logout',
    authenticate,
    auditLog('LOGOUT'),
    async (req, res) => {
        try {
            secureLog.internal('info', 'User logged out', { userId: req.userId });
            
            res.status(200).json({
                success: true,
                message: 'Déconnexion réussie.'
            });
        } catch (error) {
            secureLog.internal('error', 'Logout error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

// ======================================================
// VÉRIFICATION STATUT SERVEUR (PUBLIC)
// ======================================================
router.get('/status', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Service d\'authentification opérationnel',
        timestamp: new Date().toISOString()
    });
});

// ======================================================
// DEMANDE DE RÉINITIALISATION MOT DE PASSE
// ======================================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: SECURE_MESSAGES.MISSING_FIELDS
            });
        }

        const user = await User.findByEmail(email);

        // 🔒 TOUJOURS retourner le même message (sécurité)
        // Ne JAMAIS révéler si l'email existe ou non
        
        if (user) {
            secureLog.internal('info', 'Password reset requested', { userId: user.id });
            // TODO: Générer token et envoyer email
        } else {
            secureLog.internal('warning', 'Password reset for non-existent email', { 
                email: email.substring(0, 3) + '***' 
            });
        }

        // ⚠️ MÊME MESSAGE dans tous les cas
        res.status(200).json({
            success: true,
            message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.'
        });
    } catch (error) {
        secureLog.internal('error', 'Forgot password error', { error: error.message });
        res.status(500).json({
            success: false,
            message: SECURE_MESSAGES.SERVER_ERROR
        });
    }
});

// ======================================================
// CHANGEMENT MOT DE PASSE (UTILISATEUR CONNECTÉ)
// ======================================================
router.post(
    '/change-password',
    authenticate,
    auditLog('CHANGE_PASSWORD'),
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: SECURE_MESSAGES.MISSING_FIELDS
                });
            }

            const isCurrentPasswordValid = await User.verifyPassword(req.user, currentPassword);

            if (!isCurrentPasswordValid) {
                secureLog.internal('warning', 'Password change failed: invalid current password', {
                    userId: req.userId
                });
                
                return res.status(401).json({
                    success: false,
                    message: 'Mot de passe actuel incorrect.'
                });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nouveau mot de passe doit être différent de l\'ancien.'
                });
            }

            await User.updatePassword(req.user.id, newPassword);
            
            secureLog.internal('info', 'Password changed successfully', { userId: req.userId });

            res.status(200).json({
                success: true,
                message: 'Mot de passe modifié avec succès.'
            });
        } catch (error) {
            secureLog.internal('error', 'Change password error', { error: error.message });
            res.status(500).json({
                success: false,
                message: SECURE_MESSAGES.SERVER_ERROR
            });
        }
    }
);

module.exports = router;