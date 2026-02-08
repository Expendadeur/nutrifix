// web/src/services/authService.js
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
                this.saveUserData(data.token, data.user);
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
                this.saveUserData(data.token, data.user);
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
    // CONNEXION EMPREINTE (WebAuthn)
    // ============================================
    async loginWithFingerprint() {
        try {
            const savedMatricule = localStorage.getItem('userMatricule');
            
            if (!savedMatricule) {
                return { 
                    success: false, 
                    message: 'Veuillez vous connecter avec vos identifiants une première fois' 
                };
            }

            // WebAuthn API
            const publicKey = {
                challenge: new Uint8Array(32),
                timeout: 60000,
                userVerification: 'required'
            };

            const credential = await navigator.credentials.get({ publicKey });

            if (!credential) {
                return { success: false, message: 'Authentification annulée' };
            }

            // Préparer les données d'empreinte
            const fingerprintData = {
                credentialId: credential.id,
                response: {
                    authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
                    signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
                },
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
                this.saveUserData(data.token, data.user);
                return { success: true, user: data.user, token: data.token };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Fingerprint login error:', error);
            return { success: false, message: 'Authentification biométrique impossible' };
        }
    }

    // ============================================
    // DÉCONNEXION
    // ============================================
    logout() {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('userMatricule');
        localStorage.removeItem('tokenExpiry');
    }

    // ============================================
    // VÉRIFICATION AUTHENTIFICATION
    // ============================================
    isAuthenticated() {
        const token = localStorage.getItem('userToken');
        const expiry = localStorage.getItem('tokenExpiry');

        if (!token || !expiry) {
            return false;
        }

        const expiryDate = new Date(expiry);
        if (expiryDate <= new Date()) {
            this.logout();
            return false;
        }

        return true;
    }

    // ============================================
    // RÉCUPÉRATION TOKEN
    // ============================================
    getToken() {
        return localStorage.getItem('userToken');
    }

    // ============================================
    // RÉCUPÉRATION UTILISATEUR
    // ============================================
    getUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
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
            const token = this.getToken();
            
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
            const token = this.getToken();
            
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
            
            if (!data.success) {
                this.logout();
            }
            
            return data;
        } catch (error) {
            console.error('Verify token error:', error);
            this.logout();
            return { success: false, message: 'Token invalide' };
        }
    }

    // ============================================
    // HELPERS PRIVÉS
    // ============================================
    saveUserData(token, user) {
        const tokenExpiry = new Date();
        tokenExpiry.setDate(tokenExpiry.getDate() + 7); // Token valide 7 jours

        localStorage.setItem('userToken', token);
        localStorage.setItem('userData', JSON.stringify(user));
        localStorage.setItem('userMatricule', user.matricule);
        localStorage.setItem('tokenExpiry', tokenExpiry.toISOString());
    }

    // ============================================
    // VÉRIFICATION BIOMÉTRIE DISPONIBLE
    // ============================================
    async checkBiometricAvailability() {
        try {
            if (!window.PublicKeyCredential) {
                return { available: false, reason: 'WebAuthn non supporté' };
            }

            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            const savedMatricule = localStorage.getItem('userMatricule');

            if (!available) {
                return { available: false, reason: 'Authenticateur non disponible' };
            }

            if (!savedMatricule) {
                return { available: false, reason: 'Première connexion requise' };
            }

            return { available: true };
        } catch (error) {
            console.error('Check biometric error:', error);
            return { available: false, reason: 'Erreur de vérification' };
        }
    }

    // ============================================
    // ENREGISTREMENT EMPREINTE
    // ============================================
    async registerFingerprint(userId) {
        try {
            const token = this.getToken();
            
            if (!token) {
                return { success: false, message: 'Non authentifié' };
            }

            // Créer les credentials WebAuthn
            const publicKey = {
                challenge: new Uint8Array(32),
                rp: {
                    name: "NUTRIFIX"
                },
                user: {
                    id: new Uint8Array(16),
                    name: userId.toString(),
                    displayName: userId.toString()
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                timeout: 60000,
                attestation: "direct"
            };

            const credential = await navigator.credentials.create({ publicKey });

            if (!credential) {
                return { success: false, message: 'Enregistrement annulé' };
            }

            // Envoyer au serveur
            const fingerprintData = {
                credentialId: credential.id,
                response: {
                    attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
                    clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
                },
                timestamp: new Date().toISOString()
            };

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
}

export default new AuthService();