// frontend/src/services/adminService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com/api';

class parametresService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_URL}/parametres`,
      timeout: 30000,
    });

    // Intercepteur pour ajouter le token à chaque requête
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Intercepteur pour gérer les erreurs
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userData');
          // Rediriger vers login si nécessaire
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // HISTORIQUE & TRAÇABILITÉ
  // ============================================

  /**
   * Récupérer l'historique avec filtres
   */
  async getHistorique(filters = {}) {
    try {
      const response = await this.api.get('/historique', { params: filters });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching historique:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupérer les détails d'une entrée d'historique
   */
  async getHistoriqueDetail(id) {
    try {
      const response = await this.api.get(`/historique/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching historique detail:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupérer les statistiques résumées de l'historique
   */
  async getHistoriqueStats(periode = 30) {
    try {
      const response = await this.api.get('/historique/stats/resume', {
        params: { periode }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching historique stats:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // GESTION DES UTILISATEURS
  // ============================================

  /**
   * Récupérer la liste des utilisateurs
   */
  async getUtilisateurs(filters = {}) {
    try {
      const response = await this.api.get('/utilisateurs', { params: filters });
      return {
        utilisateurs: response.data.data,
        stats: response.data.stats
      };
    } catch (error) {
      console.error('Error fetching utilisateurs:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupérer les détails d'un utilisateur
   */
  async getUtilisateurDetail(id) {
    try {
      const response = await this.api.get(`/utilisateurs/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching utilisateur detail:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUtilisateur(data) {
    try {
      const response = await this.api.post('/utilisateurs', data);
      return response.data;
    } catch (error) {
      console.error('Error creating utilisateur:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Modifier un utilisateur
   */
  async updateUtilisateur(id, data) {
    try {
      const response = await this.api.put(`/utilisateurs/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating utilisateur:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUtilisateur(id) {
    try {
      const response = await this.api.delete(`/utilisateurs/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting utilisateur:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Réinitialiser le mot de passe d'un utilisateur
   */
  async resetPassword(id, newPassword) {
    try {
      const response = await this.api.put(`/utilisateurs/${id}/reset-password`, {
        newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // GESTION DES DÉPARTEMENTS
  // ============================================

  /**
   * Récupérer la liste des départements
   */
  async getDepartements(filters = {}) {
    try {
      const response = await this.api.get('/departements', { params: filters });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching departements:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Créer un département
   */
  async createDepartement(data) {
    try {
      const response = await this.api.post('/departements', data);
      return response.data;
    } catch (error) {
      console.error('Error creating departement:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Modifier un département
   */
  async updateDepartement(id, data) {
    try {
      const response = await this.api.put(`/departements/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating departement:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Supprimer un département
   */
  async deleteDepartement(id) {
    try {
      const response = await this.api.delete(`/departements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting departement:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // PARAMÈTRES DE NOTIFICATION
  // ============================================

  /**
   * Récupérer les paramètres de notification
   */
  async getNotificationSettings() {
    try {
      const response = await this.api.get('/notification-settings');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Mettre à jour les paramètres de notification
   */
  async updateNotificationSettings(data) {
    try {
      const response = await this.api.put('/notification-settings', data);
      return response.data;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // PARAMÈTRES GÉNÉRAUX
  // ============================================

  /**
   * Récupérer les paramètres généraux
   */
  async getGeneralSettings() {
    try {
      const response = await this.api.get('/general-settings');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching general settings:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Mettre à jour les paramètres généraux
   */
  async updateGeneralSettings(data) {
    try {
      const response = await this.api.put('/general-settings', data);
      return response.data;
    } catch (error) {
      console.error('Error updating general settings:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // BACKUP & MAINTENANCE
  // ============================================

  /**
   * Créer une sauvegarde manuelle
   */
  async createBackup() {
    try {
      const response = await this.api.post('/backup');
      return response.data;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupérer la liste des sauvegardes
   */
  async getBackups() {
    try {
      const response = await this.api.get('/backups');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching backups:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Supprimer une sauvegarde
   */
  async deleteBackup(filename) {
    try {
      const response = await this.api.delete(`/backups/${filename}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // STATISTIQUES SYSTÈME
  // ============================================

  /**
   * Récupérer les statistiques système
   */
  async getSystemStats() {
    try {
      const response = await this.api.get('/stats/system');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw this.handleError(error);
    }
  }

  // ============================================
  // GESTION DES ERREURS
  // ============================================

  handleError(error) {
    if (error.response) {
      // Erreur avec réponse du serveur
      const message = error.response.data?.message || 'Une erreur est survenue';
      return new Error(message);
    } else if (error.request) {
      // Pas de réponse du serveur
      return new Error('Impossible de contacter le serveur');
    } else {
      // Erreur lors de la configuration de la requête
      return new Error(error.message || 'Une erreur est survenue');
    }
  }
}

export default new parametresService();