// frontend/src/services/adminService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// CONFIGURATION DE L'API
// ============================================

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

console.log('🌐 API_URL configurée:', API_URL);

// ============================================
// CONFIGURATION AXIOS
// ============================================

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
                console.log('🔐 Token ajouté à la requête');
            } else {
                console.warn('⚠️ Aucun token trouvé');
            }
            
            console.log('📡 Requête:', config.method?.toUpperCase(), config.url, config.params);
            return config;
        } catch (error) {
            console.error('❌ Erreur lors de la récupération du token:', error);
            return Promise.reject(error);
        }
    },
    (error) => {
        console.error('❌ Erreur intercepteur requête:', error);
        return Promise.reject(error);
    }
);

// Intercepteur pour gérer les erreurs de réponse
apiClient.interceptors.response.use(
    (response) => {
        console.log('✅ Réponse reçue:', response.config.url, response.status);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        console.error('❌ Erreur réponse:', {
            url: originalRequest?.url,
            status: error.response?.status,
            message: error.message
        });

        // Gérer l'expiration du token (401)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                console.log('🔒 Session expirée - Nettoyage des données');
                // Supprimer les données d'authentification
                await AsyncStorage.multiRemove(['userToken', 'userData']);
                
                console.log('🔄 Redirection vers la connexion nécessaire');
                
            } catch (err) {
                console.error('❌ Erreur lors de la déconnexion:', err);
            }
        }

        // Gérer les erreurs réseau
        if (!error.response) {
            console.error('🌐 Erreur réseau détectée');
            error.isNetworkError = true;
            error.message = 'Impossible de contacter le serveur. Vérifiez votre connexion internet.';
        }

        return Promise.reject(error);
    }
);

// ============================================
// SERVICE ADMIN
// ============================================

const adminService = {
    
    // ============================================
    // MÉTHODES DE RÉCUPÉRATION DES DONNÉES
    // ============================================
    
    /**
     * Récupère toutes les données du dashboard
     * @param {string} period - Période: 'day', 'week', 'month', 'year'
     * @returns {Promise<Object>} Données complètes du dashboard
     */
    async getDashboardData(period = 'month') {
        try {
            console.log('📊 Récupération dashboard pour période:', period);
            
            // Valider la période
            if (!this.isValidPeriod(period)) {
                throw new Error(`Période invalide: ${period}`);
            }
            
            const response = await apiClient.get('/admin/dashboard', {
                params: { period }
            });
            
            console.log('📦 Réponse dashboard:', {
                success: response.data.success,
                hasData: !!response.data.data,
                period: response.data.data?.period
            });
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération du dashboard');
        } catch (error) {
            console.error('❌ Erreur getDashboardData:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère uniquement les KPIs
     * @param {string} period - Période
     * @returns {Promise<Object>} KPIs
     */
    async getKPIs(period = 'month') {
        try {
            console.log('📈 Récupération KPIs pour période:', period);
            
            if (!this.isValidPeriod(period)) {
                throw new Error(`Période invalide: ${period}`);
            }
            
            const response = await apiClient.get('/admin/kpis', {
                params: { period }
            });
            
            if (response.data.success) {
                console.log('✅ KPIs récupérés');
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération des KPIs');
        } catch (error) {
            console.error('❌ Erreur getKPIs:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère les alertes critiques
     * @returns {Promise<Array>} Liste des alertes
     */
    async getAlerts() {
        try {
            console.log('🔔 Récupération des alertes');
            
            const response = await apiClient.get('/admin/alerts');
            
            if (response.data.success) {
                const alertCount = response.data.data?.length || 0;
                console.log(`✅ ${alertCount} alerte(s) récupérée(s)`);
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération des alertes');
        } catch (error) {
            console.error('❌ Erreur getAlerts:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère les données des graphiques
     * @param {string} period - Période
     * @returns {Promise<Object>} Données des graphiques
     */
    async getChartData(period = 'month') {
        try {
            console.log('📊 Récupération graphiques pour période:', period);
            
            if (!this.isValidPeriod(period)) {
                throw new Error(`Période invalide: ${period}`);
            }
            
            const response = await apiClient.get('/admin/charts', {
                params: { period }
            });
            
            if (response.data.success) {
                console.log('✅ Données graphiques récupérées');
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération des graphiques');
        } catch (error) {
            console.error('❌ Erreur getChartData:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère les top performers (clients et produits)
     * @param {string} period - Période
     * @returns {Promise<Object>} Top performers
     */
    async getTopPerformers(period = 'month') {
        try {
            console.log('🏆 Récupération top performers pour période:', period);
            
            if (!this.isValidPeriod(period)) {
                throw new Error(`Période invalide: ${period}`);
            }
            
            const response = await apiClient.get('/admin/top-performers', {
                params: { period }
            });
            
            if (response.data.success) {
                console.log('✅ Top performers récupérés');
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération des top performers');
        } catch (error) {
            console.error('❌ Erreur getTopPerformers:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère les statistiques par module
     * @param {string} period - Période
     * @returns {Promise<Array>} Statistiques des modules
     */
    async getModuleStatistics(period = 'month') {
        try {
            console.log('📋 Récupération stats modules pour période:', period);
            
            if (!this.isValidPeriod(period)) {
                throw new Error(`Période invalide: ${period}`);
            }
            
            const response = await apiClient.get('/admin/module-stats', {
                params: { period }
            });
            
            if (response.data.success) {
                console.log('✅ Statistiques modules récupérées');
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération des statistiques');
        } catch (error) {
            console.error('❌ Erreur getModuleStatistics:', error);
            throw this.handleError(error);
        }
    },

    /**
     * Récupère un résumé rapide du système
     * @returns {Promise<Object>} Résumé du système
     */
    async getSummary() {
        try {
            console.log('📝 Récupération résumé système');
            
            const response = await apiClient.get('/admin/summary');
            
            if (response.data.success) {
                console.log('✅ Résumé système récupéré');
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Erreur de récupération du résumé');
        } catch (error) {
            console.error('❌ Erreur getSummary:', error);
            throw this.handleError(error);
        }
    },

    // ============================================
    // GESTION DES ERREURS
    // ============================================
    
    /**
     * Gère les erreurs de manière uniforme
     * @param {Error} error - Erreur à gérer
     * @returns {Error} Erreur formatée
     */
    handleError(error) {
        console.error('🔥 Gestion erreur adminService:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            isNetworkError: error.isNetworkError
        });

        if (error.response) {
            // Erreur de réponse du serveur
            const message = error.response.data?.message || 'Erreur serveur';
            const statusCode = error.response.status;
            
            const formattedError = new Error(message);
            formattedError.statusCode = statusCode;
            formattedError.response = error.response.data;
            
            console.error(`❌ Erreur HTTP ${statusCode}:`, message);
            
            return formattedError;
        } else if (error.request || error.isNetworkError) {
            // Pas de réponse du serveur
            const networkError = new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
            networkError.isNetworkError = true;
            
            console.error('🌐 Erreur réseau:', networkError.message);
            
            return networkError;
        } else {
            // Autre erreur
            console.error('⚠️ Erreur inconnue:', error.message);
            return new Error(error.message || 'Une erreur est survenue');
        }
    },

    // ============================================
    // UTILITAIRES DE FORMATAGE
    // ============================================
    
    /**
     * Formate un montant en BIF (sans décimales)
     * @param {number} montant - Montant à formater
     * @returns {string} Montant formaté
     */
    formatMontant(montant) {
        if (typeof montant !== 'number' || isNaN(montant)) {
            return '0 BIF';
        }

        return new Intl.NumberFormat('fr-BI', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(montant) + ' BIF';
    },

    /**
     * Formate un nombre simple
     * @param {number} nombre - Nombre à formater
     * @returns {string} Nombre formaté
     */
    formatNumber(nombre) {
        if (typeof nombre !== 'number' || isNaN(nombre)) {
            return '0';
        }

        return new Intl.NumberFormat('fr-BI', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(nombre);
    },

    /**
     * Formate une date
     * @param {string|Date} date - Date à formater
     * @returns {string} Date formatée
     */
    formatDate(date) {
        if (!date) return '';

        try {
            return new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(new Date(date));
        } catch (error) {
            console.error('Erreur formatage date:', error);
            return '';
        }
    },

    /**
     * Formate une date avec heure
     * @param {string|Date} date - Date à formater
     * @returns {string} Date et heure formatées
     */
    formatDateTime(date) {
        if (!date) return '';

        try {
            return new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(date));
        } catch (error) {
            console.error('Erreur formatage date-heure:', error);
            return '';
        }
    },

    /**
     * Obtient le label d'une période
     * @param {string} period - Code période
     * @returns {string} Label de la période
     */
    getPeriodLabel(period) {
        const labels = {
            'day': 'Aujourd\'hui',
            'week': 'Cette semaine',
            'month': 'Ce mois',
            'year': 'Cette année'
        };
        return labels[period] || 'Période';
    },

    /**
     * Calcule le pourcentage de variation
     * @param {number} current - Valeur actuelle
     * @param {number} previous - Valeur précédente
     * @returns {number} Pourcentage de variation
     */
    calculateVariation(current, previous) {
        if (!previous || previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    },

    /**
     * Détermine la couleur selon le type de tendance
     * @param {number} tendance - Valeur de tendance
     * @param {boolean} inverse - Si true, inverse les couleurs (bon = négatif)
     * @returns {string} Code couleur
     */
    getTrendColor(tendance, inverse = false) {
        if (tendance === 0) return '#95A5A6';
        
        const isPositive = tendance > 0;
        const shouldBeGreen = inverse ? !isPositive : isPositive;
        
        return shouldBeGreen ? '#27AE60' : '#E74C3C';
    },

    /**
     * Obtient l'icône de tendance
     * @param {number} tendance - Valeur de tendance
     * @returns {string} Nom de l'icône
     */
    getTrendIcon(tendance) {
        if (tendance > 0) return 'trending-up';
        if (tendance < 0) return 'trending-down';
        return 'trending-flat';
    },

    // ============================================
    // GESTION DU CACHE
    // ============================================
    
    /**
     * Sauvegarde des données dans le cache local
     * @param {string} key - Clé du cache
     * @param {*} data - Données à sauvegarder
     * @param {number} ttl - Durée de vie en millisecondes
     */
    async cacheData(key, data, ttl = 300000) { // 5 minutes par défaut
        try {
            const cacheItem = {
                data,
                timestamp: Date.now(),
                ttl
            };
            await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
            console.log(`💾 Cache sauvegardé: cache_${key} (TTL: ${ttl}ms)`);
        } catch (error) {
            console.error('❌ Erreur sauvegarde cache:', error);
        }
    },

    /**
     * Récupère des données du cache
     * @param {string} key - Clé du cache
     * @returns {Promise<*|null>} Données du cache ou null
     */
    async getCachedData(key) {
        try {
            const cached = await AsyncStorage.getItem(`cache_${key}`);
            if (!cached) {
                console.log(`📭 Cache vide: cache_${key}`);
                return null;
            }

            const cacheItem = JSON.parse(cached);
            const now = Date.now();
            const age = now - cacheItem.timestamp;

            // Vérifier si le cache est encore valide
            if (age < cacheItem.ttl) {
                console.log(`📦 Cache valide: cache_${key} (age: ${Math.round(age/1000)}s)`);
                return cacheItem.data;
            }

            // Cache expiré, le supprimer
            console.log(`⏰ Cache expiré: cache_${key}`);
            await AsyncStorage.removeItem(`cache_${key}`);
            return null;
        } catch (error) {
            console.error('❌ Erreur récupération cache:', error);
            return null;
        }
    },

    /**
     * Efface tout le cache
     */
    async clearCache() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(key => key.startsWith('cache_'));
            if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys);
                console.log(`🗑️ ${cacheKeys.length} cache(s) effacé(s)`);
            } else {
                console.log('📭 Aucun cache à effacer');
            }
        } catch (error) {
            console.error('❌ Erreur effacement cache:', error);
        }
    },

    /**
     * Efface le cache d'une clé spécifique
     * @param {string} key - Clé du cache à effacer
     */
    async clearCacheKey(key) {
        try {
            await AsyncStorage.removeItem(`cache_${key}`);
            console.log(`🗑️ Cache effacé: cache_${key}`);
        } catch (error) {
            console.error('❌ Erreur effacement cache key:', error);
        }
    },

    // ============================================
    // VALIDATIONS
    // ============================================
    
    /**
     * Valide une période
     * @param {string} period - Période à valider
     * @returns {boolean} True si valide
     */
    isValidPeriod(period) {
        const validPeriods = ['day', 'week', 'month', 'year'];
        const isValid = validPeriods.includes(period);
        
        if (!isValid) {
            console.warn(`⚠️ Période invalide: ${period}. Valeurs acceptées:`, validPeriods);
        }
        
        return isValid;
    },

    /**
     * Obtient la période par défaut
     * @returns {string} Période par défaut
     */
    getDefaultPeriod() {
        return 'month';
    },

    // ============================================
    // DIAGNOSTICS & DEBUG
    // ============================================
    
    /**
     * Teste la connexion à l'API
     * @returns {Promise<boolean>} True si connexion OK
     */
    async testConnection() {
        try {
            console.log('🔍 Test de connexion à l\'API...');
            const response = await apiClient.get('/admin/summary');
            console.log('✅ Connexion API réussie');
            return true;
        } catch (error) {
            console.error('❌ Échec connexion API:', error.message);
            return false;
        }
    },

    /**
     * Obtient les informations de configuration
     * @returns {Object} Configuration actuelle
     */
    getConfig() {
        return {
            apiUrl: API_URL,
            timeout: apiClient.defaults.timeout,
            headers: apiClient.defaults.headers
        };
    },

    /**
     * Affiche les informations de diagnostic
     */
    async showDiagnostics() {
        console.group('🔧 DIAGNOSTICS ADMIN SERVICE');
        
        console.log('Configuration:', this.getConfig());
        
        try {
            const token = await AsyncStorage.getItem('userToken');
            console.log('Token présent:', !!token);
        } catch (error) {
            console.error('Erreur lecture token:', error);
        }
        
        const connected = await this.testConnection();
        console.log('API accessible:', connected);
        
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith('cache_'));
        console.log('Cache keys:', cacheKeys.length);
        
        console.groupEnd();
    }
};

// ============================================
// EXPORT
// ============================================

export default adminService;