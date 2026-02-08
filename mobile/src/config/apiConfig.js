// filepath: mobile/src/config/apiConfig.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Configuration API centralisée
 */

// ============================================
// URL DE BASE SELON L'ENVIRONNEMENT
// ============================================
export const getApiUrl = () => {
    if (__DEV__) {
        // Mode développement
        if (Platform.OS === 'web') {
            return 'http://localhost:5000/api';
        }
        if (Platform.OS === 'android') {
            return 'http://10.0.2.2:5000/api'; // Émulateur Android
        }
        // iOS ou appareil physique
        return 'http://192.168.1.10:5000/api'; // Remplacez par votre IP locale
    }
    // Mode production
    return process.env.REACT_APP_API_URL || 'https://api.nutrifix.com/api';
};

export const API_BASE_URL = getApiUrl();

// ============================================
// GESTION DU TOKEN
// ============================================

/**
 * Récupère le token d'authentification depuis AsyncStorage
 * @returns {Promise<string|null>} Le token JWT ou null
 */
export const getAuthToken = async () => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        
        if (!token) {
            console.warn('⚠️ Aucun token trouvé dans AsyncStorage');
            return null;
        }
        
        // Vérifier si le token est expiré
        const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
        if (tokenExpiry) {
            const expiryDate = new Date(tokenExpiry);
            const now = new Date();
            
            if (expiryDate <= now) {
                console.warn('⚠️ Token expiré');
                await clearAuthData();
                return null;
            }
        }
        
        return token;
    } catch (error) {
        console.error('❌ Erreur récupération token:', error);
        return null;
    }
};

/**
 * Sauvegarde le token d'authentification
 * @param {string} token - Le token JWT
 * @param {number} expiresInHours - Durée de validité en heures (par défaut 24h)
 */
export const saveAuthToken = async (token, expiresInHours = 24) => {
    try {
        await AsyncStorage.setItem('userToken', token);
        
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + expiresInHours);
        await AsyncStorage.setItem('tokenExpiry', expiry.toISOString());
        
        console.log('✅ Token sauvegardé avec succès');
    } catch (error) {
        console.error('❌ Erreur sauvegarde token:', error);
    }
};

/**
 * Nettoie toutes les données d'authentification
 */
export const clearAuthData = async () => {
    try {
        await AsyncStorage.multiRemove([
            'userToken',
            'tokenExpiry',
            'userRole',
            'userData',
            'userMatricule',
            'savedEmail',
            'rememberMe'
        ]);
        console.log('✅ Données d\'authentification nettoyées');
    } catch (error) {
        console.error('❌ Erreur nettoyage auth:', error);
    }
};

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {Promise<boolean>}
 */
export const isAuthenticated = async () => {
    const token = await getAuthToken();
    return token !== null;
};

// ============================================
// HEADERS HTTP
// ============================================

/**
 * Génère les headers pour les requêtes API
 * @param {boolean} includeAuth - Inclure le token d'authentification
 * @returns {Promise<Object>}
 */
export const getApiHeaders = async (includeAuth = true) => {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    if (includeAuth) {
        const token = await getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
};

// ============================================
// CONFIGURATION AXIOS (si vous utilisez Axios)
// ============================================

import axios from 'axios';

/**
 * Instance Axios préconfigurée
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
});

/**
 * Intercepteur de requête pour ajouter automatiquement le token
 */
apiClient.interceptors.request.use(
    async (config) => {
        const token = await getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Intercepteur de réponse pour gérer les erreurs d'authentification
 */
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            console.log('❌ 401 Unauthorized - Token invalide ou expiré');
            
            // Nettoyer les données d'authentification
            await clearAuthData();
            
            // Vous pouvez émettre un événement pour rediriger vers le login
            // Ou utiliser votre système de navigation global
        }
        
        return Promise.reject(error);
    }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Effectue une requête GET authentifiée
 * @param {string} endpoint - L'endpoint de l'API (ex: '/manager/dashboard')
 * @param {Object} params - Paramètres de requête
 * @returns {Promise<Object>}
 */
export const authenticatedGet = async (endpoint, params = {}) => {
    try {
        const response = await apiClient.get(endpoint, { params });
        return response.data;
    } catch (error) {
        console.error(`❌ GET ${endpoint} failed:`, error);
        throw error;
    }
};

/**
 * Effectue une requête POST authentifiée
 * @param {string} endpoint - L'endpoint de l'API
 * @param {Object} data - Données à envoyer
 * @returns {Promise<Object>}
 */
export const authenticatedPost = async (endpoint, data = {}) => {
    try {
        const response = await apiClient.post(endpoint, data);
        return response.data;
    } catch (error) {
        console.error(`❌ POST ${endpoint} failed:`, error);
        throw error;
    }
};

/**
 * Effectue une requête PUT authentifiée
 * @param {string} endpoint - L'endpoint de l'API
 * @param {Object} data - Données à envoyer
 * @returns {Promise<Object>}
 */
export const authenticatedPut = async (endpoint, data = {}) => {
    try {
        const response = await apiClient.put(endpoint, data);
        return response.data;
    } catch (error) {
        console.error(`❌ PUT ${endpoint} failed:`, error);
        throw error;
    }
};

/**
 * Effectue une requête DELETE authentifiée
 * @param {string} endpoint - L'endpoint de l'API
 * @returns {Promise<Object>}
 */
export const authenticatedDelete = async (endpoint) => {
    try {
        const response = await apiClient.delete(endpoint);
        return response.data;
    } catch (error) {
        console.error(`❌ DELETE ${endpoint} failed:`, error);
        throw error;
    }
};

export default {
    getApiUrl,
    API_BASE_URL,
    getAuthToken,
    saveAuthToken,
    clearAuthData,
    isAuthenticated,
    getApiHeaders,
    apiClient,
    authenticatedGet,
    authenticatedPost,
    authenticatedPut,
    authenticatedDelete,
};