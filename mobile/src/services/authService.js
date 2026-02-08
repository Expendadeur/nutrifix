// mobile/src/services/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class AuthService {
    // ============================================
    // CONNEXION EMAIL/PASSWORD
    // ============================================
    async loginWithEmail(email, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                await this.saveUserData(data.token, data.user);
                return { success: true, user: data.user, token: data.token };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Erreur de connexion au serveur' };
        }
    }

    // ============================================
    // CONNEXION MATRICULE/PASSWORD
    // ============================================
    async loginWithMatricule(matricule, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ matricule, password })
            });

            const data = await response.json();

            if (data.success) {
                await this.saveUserData(data.token, data.user);
                return { success: true, user: data.user, token: data.token };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Erreur de connexion au serveur' };
        }
    }

    // ============================================
    // CONNEXION QR CODE
    // ============================================
    async loginWithQR(qrData) {
        try {
            const response = await fetch(`${API_URL}/auth/login-qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ qrData })
            });

            const data = await response.json();

            if (data.success) {
                await this.saveUserData(data.token, data.user);
                return { success: true, user: data.user, token: data.token };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('QR Login error:', error);
            return { success: false, message: 'QR Code invalide' };
        }
    }

    // ============================================
    // CONNEXION EMPREINTE DIGITALE
    // ============================================
    async loginWithFingerprint() {
        try {
            const savedMatricule = await AsyncStorage.getItem('userMatricule');
            
            if (!savedMatricule) {
                return { 
                    success: false, 
                    message: 'Veuillez vous connecter avec vos identifiants une première fois' 
                };
            }

            // Vérifier la disponibilité de la biométrie
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();

            if (!compatible || !enrolled) {
                return { 
                    success: false, 
                    message: 'Authentification biométrique non disponible' 
                };
            }

            // Authentifier localement
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authentification NUTRIFIX',
                fallbackLabel: 'Utiliser le mot de passe',
                disableDeviceFallback: false,
            });

            if (!result.success) {
                return { success: false, message: 'Authentification annulée' };
            }

            // Générer les données d'empreinte
            const fingerprintData = {
                template: this.generateFingerprintTemplate(),
                hash: this.generateFingerprintHash(),
                timestamp: new Date().toISOString()
            };

            // Envoyer au serveur
            const response = await fetch(`${API_URL}/auth/fingerprint/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    matricule: savedMatricule, 
                    fingerprintData 
                })
            });

            const data = await response.json();

            if (data.success) {
                await this.saveUserData(data.token, data.user);
                return { success: true, user: data.user, token: data.token };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Fingerprint login error:', error);
            return { success: false, message: 'Erreur d\'authentification biométrique' };
        }
    }

    // ============================================
    // ENREGISTREMENT EMPREINTE
    // ============================================
    async registerFingerprint(userId) {
        try {
            const token = await this.getToken();
            
            if (!token) {
                return { success: false, message: 'Non authentifié' };
            }

            // Authentifier localement pour capturer l'empreinte
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Enregistrer votre empreinte digitale',
                fallbackLabel: 'Annuler',
            });

            if (!result.success) {
                return { success: false, message: 'Enregistrement annulé' };
            }

            // Générer les données d'empreinte
            const fingerprintData = {
                template: this.generateFingerprintTemplate(),
                hash: this.generateFingerprintHash(),
                quality: 'high',
                timestamp: new Date().toISOString()
            };

            // Envoyer au serveur
            const response = await fetch(`${API_URL}/auth/fingerprint/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    userId, 
                    fingerprintData 
                })
            });

            const data = await response.json();

            return data;
        } catch (error) {
            console.error('Register fingerprint error:', error);
            return { success: false, message: 'Erreur lors de l\'enregistrement' };
        }
    }

    // ============================================
    // DÉCONNEXION
    // ============================================
    async logout() {
        try {
            await AsyncStorage.multiRemove([
                'userToken',
                'userData',
                'userMatricule',
                'loginTimestamp'
            ]);
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'Erreur lors de la déconnexion' };
        }
    }

    // ============================================
    // VÉRIFICATION AUTHENTIFICATION
    // ============================================
    async isAuthenticated() {
        try {
            const token = await AsyncStorage.getItem('userToken');
            return !!token;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    // ============================================
    // RÉCUPÉRATION TOKEN
    // ============================================
    async getToken() {
        try {
            return await AsyncStorage.getItem('userToken');
        } catch (error) {
            console.error('Get token error:', error);
            return null;
        }
    }

    // ============================================
    // RÉCUPÉRATION UTILISATEUR
    // ============================================
    async getUser() {
        try {
            const userData = await AsyncStorage.getItem('userData');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // ============================================
    // RÉINITIALISATION MOT DE PASSE
    // ============================================
    async resetPassword(email) {
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, message: 'Erreur lors de la réinitialisation' };
        }
    }

    // ============================================
    // CHANGEMENT MOT DE PASSE
    // ============================================
    async changePassword(oldPassword, newPassword) {
        try {
            const token = await this.getToken();
            
            if (!token) {
                return { success: false, message: 'Non authentifié' };
            }

            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, message: 'Erreur lors du changement de mot de passe' };
        }
    }

    // ============================================
    // VÉRIFICATION TOKEN
    // ============================================
    async verifyToken() {
        try {
            const token = await this.getToken();
            
            if (!token) {
                return { success: false, message: 'Token manquant' };
            }

            const response = await fetch(`${API_URL}/auth/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Verify token error:', error);
            return { success: false, message: 'Token invalide' };
        }
    }

    // ============================================
    // HELPERS PRIVÉS
    // ============================================
    async saveUserData(token, user) {
        try {
            await AsyncStorage.multiSet([
                ['userToken', token],
                ['userData', JSON.stringify(user)],
                ['userMatricule', user.matricule],
                ['loginTimestamp', new Date().toISOString()]
            ]);
        } catch (error) {
            console.error('Save user data error:', error);
            throw error;
        }
    }

    generateFingerprintTemplate() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return Buffer.from(`${timestamp}-${random}`).toString('base64');
    }

    generateFingerprintHash() {
        const data = `${Date.now()}-${Math.random()}`;
        // En production, utilisez une vraie fonction de hash
        return data;
    }

    // ============================================
    // VÉRIFICATION BIOMÉTRIE DISPONIBLE
    // ============================================
    async checkBiometricAvailability() {
        try {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            const savedMatricule = await AsyncStorage.getItem('userMatricule');

            if (!compatible) {
                return { available: false, reason: 'Hardware non compatible' };
            }

            if (!enrolled) {
                return { available: false, reason: 'Aucune empreinte enregistrée sur l\'appareil' };
            }

            if (!savedMatricule) {
                return { available: false, reason: 'Première connexion requise' };
            }

            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
            const isFaceId = supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
            );
            const isFingerprint = supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FINGERPRINT
            );

            return {
                available: true,
                type: isFaceId ? 'face' : isFingerprint ? 'fingerprint' : 'biometric'
            };
        } catch (error) {
            console.error('Check biometric error:', error);
            return { available: false, reason: 'Erreur de vérification' };
        }
    }
}

export default new AuthService();