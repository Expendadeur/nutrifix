// frontend/src/services/dashboardComptableService.js

import api from './api';

const dashboardComptableService = {
  /**
   * Récupère les données du dashboard comptable
   * @returns {Promise} - Données complètes du dashboard
   */
  getDashboard: async () => {
    try {
      const response = await api.get('/comptabilite/dashboard');
      return response.data;
    } catch (error) {
      console.error('Erreur getDashboard:', error);
      throw error;
    }
  },

  /**
   * Récupère les alertes comptables
   * @returns {Promise} - Liste des alertes
   */
  getAlertes: async () => {
    try {
      const response = await api.get('/comptabilite/dashboard/alertes');
      return response.data;
    } catch (error) {
      console.error('Erreur getAlertes:', error);
      throw error;
    }
  },

  /**
   * Récupère l'évolution de la trésorerie
   * @param {Number} mois - Nombre de mois à récupérer
   * @returns {Promise} - Données d'évolution
   */
  getEvolutionTresorerie: async (mois = 6) => {
    try {
      const response = await api.get('/comptabilite/dashboard/evolution-tresorerie', {
        params: { mois }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getEvolutionTresorerie:', error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques rapides
   * @returns {Promise} - Statistiques KPI
   */
  getKPIStats: async () => {
    try {
      const response = await api.get('/comptabilite/dashboard/kpi');
      return response.data;
    } catch (error) {
      console.error('Erreur getKPIStats:', error);
      throw error;
    }
  },

  /**
   * Exporte les données du dashboard
   * @param {String} format - Format d'export (pdf, excel)
   * @returns {Promise} - Fichier exporté
   */
  exportDashboard: async (format = 'pdf') => {
    try {
      const response = await api.post('/comptabilite/dashboard/export', {
        format
      }, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Erreur exportDashboard:', error);
      throw error;
    }
  }
};

export default dashboardComptableService;