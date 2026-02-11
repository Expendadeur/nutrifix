// frontend/src/services/comptabiliteService.js

import api from './api';

const comptabiliteService = {
  /**
   * Récupère le journal comptable complet avec filtres
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise} - Données du journal
   */
  getJournalComptableComplet: async (params) => {
    try {
      const response = await api.get('/finance/journal-comptable-complet', {
        params: {
          categorie: params.categorie || 'all',
          type_mouvement: params.type_mouvement || 'all',
          tiers_type: params.tiers_type || null,
          startDate: params.startDate || null,
          endDate: params.endDate || null,
          search: params.search || null,
          exercice: params.exercice || null,
          periode: params.periode || null,
          page: params.page || 1,
          limit: params.limit || 50
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getJournalComptableComplet:', error);
      throw error;
    }
  },

  /**
   * Exporte le journal comptable en Excel
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise} - Fichier Excel en base64
   */
  exportJournalExcel: async (params) => {
    try {
      const response = await api.post('/finance/journal-comptable/export-excel', {
        categorie: params.categorie || 'all',
        type_mouvement: params.type_mouvement || 'all',
        tiers_type: params.tiers_type || null,
        startDate: params.startDate || null,
        endDate: params.endDate || null,
        search: params.search || null,
        exercice: params.exercice || null,
        periode: params.periode || null
      }, {
        responseType: 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Erreur exportJournalExcel:', error);
      throw error;
    }
  },

  /**
   * Exporte le journal comptable en PDF
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise} - Fichier PDF en base64
   */
  exportJournalPDF: async (params) => {
    try {
      const response = await api.post('/finance/journal-comptable/export-pdf', {
        categorie: params.categorie || 'all',
        type_mouvement: params.type_mouvement || 'all',
        tiers_type: params.tiers_type || null,
        startDate: params.startDate || null,
        endDate: params.endDate || null,
        search: params.search || null,
        exercice: params.exercice || null,
        periode: params.periode || null
      }, {
        responseType: 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Erreur exportJournalPDF:', error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques du journal comptable
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise} - Statistiques détaillées
   */
  getStatistiquesJournal: async (params) => {
    try {
      const response = await api.get('/finance/journal-comptable/statistiques', {
        params: {
          categorie: params.categorie || 'all',
          type_mouvement: params.type_mouvement || 'all',
          startDate: params.startDate || null,
          endDate: params.endDate || null,
          exercice: params.exercice || null
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getStatistiquesJournal:', error);
      throw error;
    }
  },

  /**
   * Récupère un mouvement spécifique par ID
   * @param {Number} id - ID du mouvement
   * @returns {Promise} - Détails du mouvement
   */
  getMouvementById: async (id) => {
    try {
      const response = await api.get(`/finance/journal-comptable/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getMouvementById:', error);
      throw error;
    }
  },

  /**
   * Met à jour le statut d'un mouvement
   * @param {Number} id - ID du mouvement
   * @param {String} statut - Nouveau statut
   * @returns {Promise} - Mouvement mis à jour
   */
  updateStatutMouvement: async (id, statut) => {
    try {
      const response = await api.patch(`/finance/journal-comptable/${id}/statut`, { statut });
      return response.data;
    } catch (error) {
      console.error('Erreur updateStatutMouvement:', error);
      throw error;
    }
  },

  /**
   * Lettrer/Rapprocher un mouvement
   * @param {Number} id - ID du mouvement
   * @returns {Promise} - Mouvement rapproché
   */
  rapprocherMouvement: async (id) => {
    try {
      const response = await api.patch(`/finance/journal-comptable/${id}/rapprocher`);
      return response.data;
    } catch (error) {
      console.error('Erreur rapprocherMouvement:', error);
      throw error;
    }
  },

  /**
   * Récupère la balance comptable
   * @param {Object} params - Paramètres
   * @returns {Promise} - Balance comptable
   */
  getBalanceComptable: async (params) => {
    try {
      const response = await api.get('/finance/balance-comptable', {
        params: {
          startDate: params.startDate || null,
          endDate: params.endDate || null,
          exercice: params.exercice || null
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getBalanceComptable:', error);
      throw error;
    }
  },

  /**
   * Récupère le grand livre
   * @param {Object} params - Paramètres
   * @returns {Promise} - Grand livre
   */
  getGrandLivre: async (params) => {
    try {
      const response = await api.get('/finance/grand-livre', {
        params: {
          compte: params.compte || null,
          startDate: params.startDate || null,
          endDate: params.endDate || null,
          exercice: params.exercice || null
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getGrandLivre:', error);
      throw error;
    }
  },

  /**
   * Exporte les transactions de rapprochement bancaire en Excel
   * @param {Object} params - Paramètres de filtrage
   * @returns {Promise} - Fichier Excel en base64
   */
  exportRapprochementExcel: async (params) => {
    try {
      const response = await api.post('/finance/rapprochement-bancaire/export-excel', {
        compte: params.compte || null,
        startDate: params.startDate || null,
        endDate: params.endDate || null,
        statut: params.statut || 'all'
      });
      return response.data;
    } catch (error) {
      console.error('Erreur exportRapprochementExcel:', error);
      throw error;
    }
  }
};

export default comptabiliteService;