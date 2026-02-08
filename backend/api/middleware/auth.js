// backend/api/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../../database/db');

// ============================================
// AUTHENTICATION PRINCIPALE
// ============================================
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Accès non autorisé. Token manquant.'
            });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        if (user.statut !== 'actif') {
            return res.status(401).json({
                success: false,
                message: 'Compte désactivé.'
            });
        }

        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        req.userDepartement = user.id_departement;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide.'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré.'
            });
        }

        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification.'
        });
    }
};

// ============================================
// AUTHORIZATION PAR ROLE
// ============================================
const authorize = (...roles) => {
    return (req, res, next) => {
        // Aplatir les rôles pour gérer authorize(['admin']) et authorize('admin', 'manager')
        const allowedRoles = roles.flat();

        console.log('🛡️ AUTHORIZE CHECK:', {
            requiredRoles: allowedRoles,
            userRole: req.user.role,
            userId: req.user.id,
            path: req.originalUrl
        });

        if (!allowedRoles.includes(req.user.role)) {
            console.warn('❌ ACCESS DENIED:', {
                required: allowedRoles,
                actual: req.user.role
            });
            return res.status(403).json({
                success: false,
                message: 'Permission refusée. Rôle requis: ' + allowedRoles.join(', ')
            });
        }
        next();
    };
};

// ============================================
// AUTHORIZATION PAR DEPARTEMENT
// ============================================
const authorizeDepartment = (allowedDepartments) => {
    return async (req, res, next) => {
        try {
            // Vérifier que allowedDepartments est défini et est un tableau
            if (!allowedDepartments || !Array.isArray(allowedDepartments)) {
                console.error('authorizeDepartment: allowedDepartments invalide', allowedDepartments);
                return res.status(500).json({
                    success: false,
                    message: 'Configuration de département invalide.'
                });
            }

            const userDepartment = req.user?.id_departement;

            // Vérifier que l'utilisateur a un département assigné
            if (!userDepartment) {
                return res.status(403).json({
                    success: false,
                    message: 'Utilisateur sans département assigné.'
                });
            }

            if (!allowedDepartments.includes(userDepartment)) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé à ce département.'
                });
            }

            next();
        } catch (error) {
            console.error('Department auth error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur de vérification département.'
            });
        }
    };
};

// ============================================
// VERIFICATION ACCES DONNEES UTILISATEUR
// ============================================
const canAccessUserData = async (req, res, next) => {
    try {
        const requestedUserId = parseInt(req.params.id || req.params.userId);

        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role === 'manager') {
            const userSql = 'SELECT id_departement FROM utilisateurs WHERE id = ?';
            const [targetUser] = await db.query(userSql, [requestedUserId]);

            if (targetUser && targetUser.id_departement === req.user.id_departement) {
                return next();
            }
        }

        if (req.user.id === requestedUserId) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à ces données.'
        });
    } catch (error) {
        console.error('User access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès.'
        });
    }
};

// ============================================
// QR CODE AUTHENTICATION
// ============================================
const authenticateQR = async (req, res, next) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({
                success: false,
                message: 'Données QR code manquantes.'
            });
        }

        const data = JSON.parse(qrData);
        const user = await User.findByMatricule(data.matricule);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        if (user.matricule !== data.matricule ||
            user.role !== data.role ||
            user.id_departement !== data.id_departement) {
            return res.status(401).json({
                success: false,
                message: 'QR code invalide.'
            });
        }

        await User.updateLastLogin(user.id);

        const token = User.generateToken(user);

        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        console.error('QR auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification QR code.'
        });
    }
};

// ============================================
// GOOGLE AUTHENTICATION (TEMPS PARTIEL)
// ============================================
const authenticateGoogle = async (req, res, next) => {
    try {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({
                success: false,
                message: 'Token Google manquant.'
            });
        }

        const googleUser = {
            email: req.body.email,
            name: req.body.name
        };

        const user = await User.findByEmail(googleUser.email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Compte temps-partiel non trouvé.'
            });
        }

        if (user.type_employe !== 'temps_partiel') {
            return res.status(401).json({
                success: false,
                message: 'Authentification Google réservée aux employés temps-partiel.'
            });
        }

        await User.updateLastLogin(user.id);

        const token = User.generateToken(user);

        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification Google.'
        });
    }
};

// ============================================
// BIOMETRIC (FINGERPRINT) AUTHENTICATION
// ============================================
const authenticateFingerprint = async (req, res, next) => {
    try {
        const { fingerprintData, matricule } = req.body;

        if (!fingerprintData) {
            return res.status(400).json({
                success: false,
                message: 'Données d\'empreinte digitale manquantes.'
            });
        }

        if (!matricule) {
            return res.status(400).json({
                success: false,
                message: 'Matricule manquant.'
            });
        }

        // Récupérer l'utilisateur avec son empreinte enregistrée
        const userSql = `
            SELECT u.*, d.nom as departement_nom, d.type as departement_type
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.matricule = ? AND u.statut = 'actif'
        `;
        const [user] = await db.query(userSql, [matricule]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé ou compte inactif.'
            });
        }

        // Vérifier si l'empreinte est enregistrée
        if (!user.donnees_biometriques) {
            return res.status(400).json({
                success: false,
                message: 'Aucune empreinte digitale enregistrée pour cet utilisateur.'
            });
        }

        // Comparer les empreintes digitales
        const storedFingerprint = JSON.parse(user.donnees_biometriques);
        const isMatch = compareFingerprintData(fingerprintData, storedFingerprint);

        if (!isMatch) {
            // Enregistrer la tentative d'authentification échouée
            await db.query(`
                INSERT INTO traces (
                    id_utilisateur, module, type_action, action_details,
                    ip_address, niveau
                ) VALUES (?, 'system', 'FAILED_FINGERPRINT_AUTH', ?, ?, 'warning')
            `, [
                user.id,
                JSON.stringify({ matricule, timestamp: new Date() }),
                req.ip
            ]);

            return res.status(401).json({
                success: false,
                message: 'Empreinte digitale non reconnue.'
            });
        }

        // Mise à jour de la dernière connexion
        await db.query(`
            UPDATE utilisateurs 
            SET derniere_connexion = NOW(), 
                nombre_connexions = nombre_connexions + 1 
            WHERE id = ?
        `, [user.id]);

        // Générer le token JWT
        const token = jwt.sign(
            {
                id: user.id,
                matricule: user.matricule,
                email: user.email,
                role: user.role,
                departement: user.id_departement,
                departement_type: user.departement_type
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Enregistrer la connexion réussie
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                ip_address, niveau
            ) VALUES (?, 'system', 'FINGERPRINT_AUTH_SUCCESS', ?, ?, 'info')
        `, [
            user.id,
            JSON.stringify({ matricule, timestamp: new Date() }),
            req.ip
        ]);

        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        console.error('Fingerprint auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur d\'authentification par empreinte digitale.'
        });
    }
};

// ============================================
// ENREGISTREMENT EMPREINTE DIGITALE
// ============================================
const registerFingerprint = async (req, res, next) => {
    try {
        const { userId, fingerprintData } = req.body;

        if (!userId || !fingerprintData) {
            return res.status(400).json({
                success: false,
                message: 'Données manquantes pour l\'enregistrement.'
            });
        }

        // Vérifier que l'utilisateur existe
        const userSql = 'SELECT id, matricule, nom_complet FROM utilisateurs WHERE id = ?';
        const [user] = await db.query(userSql, [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        // Vérifier les permissions (seulement admin ou l'utilisateur lui-même)
        if (req.user.role !== 'admin' && req.userId !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Permission refusée pour enregistrer l\'empreinte.'
            });
        }

        // Convertir et sécuriser les données d'empreinte
        const biometricData = JSON.stringify({
            fingerprint: fingerprintData,
            enrollmentDate: new Date().toISOString(),
            enrollmentBy: req.userId,
            deviceInfo: req.get('user-agent'),
            quality: fingerprintData.quality || 'high'
        });

        // Mettre à jour l'empreinte dans la base de données
        await db.query(`
            UPDATE utilisateurs 
            SET donnees_biometriques = ?,
                date_modification = NOW()
            WHERE id = ?
        `, [biometricData, userId]);

        // Enregistrer l'action dans les traces
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                ip_address, niveau
            ) VALUES (?, 'rh', 'FINGERPRINT_ENROLLMENT', ?, ?, 'info')
        `, [
            userId,
            JSON.stringify({
                enrolledBy: req.userId,
                enrolledFor: user.nom_complet,
                timestamp: new Date()
            }),
            req.ip
        ]);

        res.status(200).json({
            success: true,
            message: 'Empreinte digitale enregistrée avec succès.',
            data: {
                userId: user.id,
                matricule: user.matricule,
                enrollmentDate: new Date()
            }
        });
    } catch (error) {
        console.error('Register fingerprint error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'enregistrement de l\'empreinte.'
        });
    }
};

// ============================================
// COMPARAISON EMPREINTES DIGITALES
// ============================================
function compareFingerprintData(newFingerprint, storedFingerprint) {
    try {
        // Si les données sont des objets JSON
        if (typeof newFingerprint === 'object' && typeof storedFingerprint === 'object') {
            const stored = storedFingerprint.fingerprint || storedFingerprint;
            const current = newFingerprint;

            // Vérifier si c'est un template d'empreinte (format base64 ou array)
            if (stored.template && current.template) {
                return compareTemplates(current.template, stored.template);
            }

            // Vérifier les points minutiae
            if (stored.minutiae && current.minutiae) {
                return compareMinutiae(current.minutiae, stored.minutiae);
            }

            // Comparaison simple de hash si disponible
            if (stored.hash && current.hash) {
                return stored.hash === current.hash;
            }
        }

        // Comparaison directe en dernier recours
        return JSON.stringify(newFingerprint) === JSON.stringify(storedFingerprint.fingerprint || storedFingerprint);
    } catch (error) {
        console.error('Fingerprint comparison error:', error);
        return false;
    }
}

// ============================================
// COMPARAISON DE TEMPLATES D'EMPREINTES
// ============================================
function compareTemplates(template1, template2, threshold = 0.85) {
    try {
        // Si les templates sont des strings base64
        if (typeof template1 === 'string' && typeof template2 === 'string') {
            const buffer1 = Buffer.from(template1, 'base64');
            const buffer2 = Buffer.from(template2, 'base64');

            // Calcul du score de similarité
            let matchingBytes = 0;
            const minLength = Math.min(buffer1.length, buffer2.length);

            for (let i = 0; i < minLength; i++) {
                if (buffer1[i] === buffer2[i]) {
                    matchingBytes++;
                }
            }

            const similarity = matchingBytes / Math.max(buffer1.length, buffer2.length);
            return similarity >= threshold;
        }

        // Si les templates sont des arrays
        if (Array.isArray(template1) && Array.isArray(template2)) {
            let matchingPoints = 0;
            const minLength = Math.min(template1.length, template2.length);

            for (let i = 0; i < minLength; i++) {
                if (JSON.stringify(template1[i]) === JSON.stringify(template2[i])) {
                    matchingPoints++;
                }
            }

            const similarity = matchingPoints / Math.max(template1.length, template2.length);
            return similarity >= threshold;
        }

        return false;
    } catch (error) {
        console.error('Template comparison error:', error);
        return false;
    }
}

// ============================================
// COMPARAISON DES POINTS MINUTIAE
// ============================================
function compareMinutiae(minutiae1, minutiae2, threshold = 12) {
    try {
        // Les minutiae sont des points caractéristiques de l'empreinte
        if (!Array.isArray(minutiae1) || !Array.isArray(minutiae2)) {
            return false;
        }

        let matchingPoints = 0;
        const tolerance = 5; // Tolérance de position en pixels

        for (const point1 of minutiae1) {
            for (const point2 of minutiae2) {
                const distance = Math.sqrt(
                    Math.pow(point1.x - point2.x, 2) +
                    Math.pow(point1.y - point2.y, 2)
                );

                if (distance <= tolerance) {
                    // Vérifier aussi l'angle si disponible
                    if (point1.angle !== undefined && point2.angle !== undefined) {
                        const angleDiff = Math.abs(point1.angle - point2.angle);
                        if (angleDiff <= 15 || angleDiff >= 345) { // Tolérance de 15 degrés
                            matchingPoints++;
                            break;
                        }
                    } else {
                        matchingPoints++;
                        break;
                    }
                }
            }
        }

        // Au moins 12 points minutiae correspondants (norme ISO)
        return matchingPoints >= threshold;
    } catch (error) {
        console.error('Minutiae comparison error:', error);
        return false;
    }
}

// ============================================
// SUPPRESSION EMPREINTE DIGITALE
// ============================================
const deleteFingerprint = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId || req.body.userId);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur manquant.'
            });
        }

        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Permission refusée pour supprimer l\'empreinte.'
            });
        }

        // Vérifier que l'utilisateur existe
        const userSql = 'SELECT id, matricule, nom_complet FROM utilisateurs WHERE id = ?';
        const [user] = await db.query(userSql, [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        // Supprimer l'empreinte
        await db.query(`
            UPDATE utilisateurs 
            SET donnees_biometriques = NULL,
                date_modification = NOW()
            WHERE id = ?
        `, [userId]);

        // Enregistrer l'action
        await db.query(`
            INSERT INTO traces (
                id_utilisateur, module, type_action, action_details,
                ip_address, niveau
            ) VALUES (?, 'rh', 'FINGERPRINT_DELETION', ?, ?, 'warning')
        `, [
            userId,
            JSON.stringify({
                deletedBy: req.userId,
                deletedFor: user.nom_complet,
                timestamp: new Date()
            }),
            req.ip
        ]);

        res.status(200).json({
            success: true,
            message: 'Empreinte digitale supprimée avec succès.'
        });
    } catch (error) {
        console.error('Delete fingerprint error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'empreinte.'
        });
    }
};

// ============================================
// VERIFICATION ACCES VEHICULE
// ============================================
const canAccessVehicle = async (req, res, next) => {
    try {
        const vehicleId = parseInt(req.params.vehicleId || req.params.id || req.body.id_vehicule);

        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                message: 'ID véhicule manquant.'
            });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role === 'manager') {
            const vehicleSql = 'SELECT id_departement FROM vehicules WHERE id = ?';
            const [vehicle] = await db.query(vehicleSql, [vehicleId]);

            if (vehicle && vehicle.id_departement === req.user.id_departement) {
                return next();
            }
        }

        if (req.user.role === 'chauffeur') {
            const assignmentSql = `
                SELECT id FROM vehicules 
                WHERE id = ? AND id_chauffeur_attitre = ?
            `;
            const [vehicle] = await db.query(assignmentSql, [vehicleId, req.userId]);

            if (vehicle) {
                return next();
            }
        }

        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à ce véhicule.'
        });
    } catch (error) {
        console.error('Vehicle access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès véhicule.'
        });
    }
};

// ============================================
// VERIFICATION ACCES MISSION
// ============================================
const canAccessMission = async (req, res, next) => {
    try {
        const missionId = parseInt(req.params.missionId || req.params.id);

        if (!missionId) {
            return res.status(400).json({
                success: false,
                message: 'ID mission manquant.'
            });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role === 'manager') {
            const missionSql = `
                SELECT mv.id 
                FROM mouvements_vehicules mv
                JOIN vehicules v ON mv.id_vehicule = v.id
                WHERE mv.id = ? AND v.id_departement = ?
            `;
            const [mission] = await db.query(missionSql, [missionId, req.user.id_departement]);

            if (mission) {
                return next();
            }
        }

        if (req.user.role === 'chauffeur') {
            const missionSql = `
                SELECT id FROM mouvements_vehicules 
                WHERE id = ? AND id_chauffeur = ?
            `;
            const [mission] = await db.query(missionSql, [missionId, req.userId]);

            if (mission) {
                return next();
            }
        }

        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cette mission.'
        });
    } catch (error) {
        console.error('Mission access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès mission.'
        });
    }
};

// ============================================
// VERIFICATION ACCES ANIMAL (VETERINAIRE)
// ============================================
const canAccessAnimal = async (req, res, next) => {
    try {
        const animalId = parseInt(req.params.animalId || req.params.id);

        if (!animalId) {
            return res.status(400).json({
                success: false,
                message: 'ID animal manquant.'
            });
        }

        if (req.user.role === 'admin' || req.user.role === 'veterinaire') {
            return next();
        }

        if (req.user.role === 'manager') {
            const animalSql = 'SELECT id FROM animaux WHERE id = ?';
            const [animal] = await db.query(animalSql, [animalId]);

            if (animal) {
                return next();
            }
        }

        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cet animal.'
        });
    } catch (error) {
        console.error('Animal access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès animal.'
        });
    }
};

// ============================================
// VERIFICATION ACCES PARCELLE (AGRICULTURE)
// ============================================
const canAccessParcelle = async (req, res, next) => {
    try {
        const parcelleId = parseInt(req.params.parcelleId || req.params.id);

        if (!parcelleId) {
            return res.status(400).json({
                success: false,
                message: 'ID parcelle manquant.'
            });
        }

        if (req.user.role === 'admin' || req.user.role === 'manager' || req.user.role === 'agriculteur') {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cette parcelle.'
        });
    } catch (error) {
        console.error('Parcelle access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès parcelle.'
        });
    }
};

// ============================================
// VERIFICATION PERMISSION VALIDATION
// ============================================
const canValidate = async (req, res, next) => {
    try {
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Permission de validation requise.'
        });
    } catch (error) {
        console.error('Validation permission check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification permission.'
        });
    }
};

// ============================================
// VERIFICATION ACCES FINANCIER
// ============================================
const canAccessFinance = async (req, res, next) => {
    try {
        if (req.user.role === 'admin' || req.user.role === 'comptable') {
            return next();
        }

        if (req.user.role === 'manager') {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Accès financier non autorisé.'
        });
    } catch (error) {
        console.error('Finance access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur de vérification d\'accès financier.'
        });
    }
};

// ============================================
// RATE LIMITING PAR UTILISATEUR
// ============================================
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();

    return (req, res, next) => {
        const userId = req.userId;
        const now = Date.now();

        if (!requests.has(userId)) {
            requests.set(userId, []);
        }

        const userRequests = requests.get(userId);
        const recentRequests = userRequests.filter(time => now - time < windowMs);

        if (recentRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Trop de requêtes. Veuillez réessayer plus tard.'
            });
        }

        recentRequests.push(now);
        requests.set(userId, recentRequests);

        next();
    };
};

// ============================================
// AUDIT LOG MIDDLEWARE
// ============================================
const auditLog = (action) => {
    return async (req, res, next) => {
        try {
            const logData = {
                userId: req.userId,
                action: action,
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                timestamp: new Date()
            };

            await db.query(`
                INSERT INTO traces (
                    id_utilisateur, module, type_action, action_details,
                    ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                logData.userId,
                'system',
                action,
                JSON.stringify(logData),
                logData.ip,
                logData.userAgent
            ]);

            next();
        } catch (error) {
            console.error('Audit log error:', error);
            next();
        }
    };
};

module.exports = {
    authenticate,
    authorize,
    authorizeDepartment,
    canAccessUserData,
    authenticateQR,
    authenticateGoogle,
    authenticateFingerprint,
    registerFingerprint,
    deleteFingerprint,
    canAccessVehicle,
    canAccessMission,
    canAccessAnimal,
    canAccessParcelle,
    canValidate,
    canAccessFinance,
    rateLimitByUser,
    auditLog
};