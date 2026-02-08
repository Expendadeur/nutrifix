// frontend/src/services/personnelService.js

import api from './api';

const personnelService = {
  // ============================================
  // EMPLOYÉS
  // ============================================

  /**
   * Récupérer la liste des employés
   */
  async getEmployes(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.type_employe) params.append('type_employe', filters.type_employe);
      if (filters.id_departement) params.append('id_departement', filters.id_departement);
      if (filters.statut) params.append('statut', filters.statut);

      const response = await api.get(`/personnel/employes?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching employes:', error);
      throw error;
    }
  },

  /**
   * Récupérer un employé spécifique
   */
  async getEmploye(id) {
    try {
      const response = await api.get(`/personnel/employes/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching employe:', error);
      throw error;
    }
  },

  /**
   * Créer un employé
   */
  async createEmploye(employeData) {
    try {
      const response = await api.post('/personnel/employes', employeData);
      return response.data;
    } catch (error) {
      console.error('Error creating employe:', error);
      throw error;
    }
  },

  /**
   * Modifier un employé
   */
  async updateEmploye(id, employeData) {
    try {
      const response = await api.put(`/personnel/employes/${id}`, employeData);
      return response.data;
    } catch (error) {
      console.error('Error updating employe:', error);
      throw error;
    }
  },

  /**
   * Supprimer un employé
   */
  async deleteEmploye(id) {
    try {
      const response = await api.delete(`/personnel/employes/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting employe:', error);
      throw error;
    }
  },

  /**
   * Générer la carte digitale d'un employé
   */
  async getEmployeCarte(id) {
    try {
      const response = await api.get(`/personnel/employes/${id}/carte`);
      return response.data.data;
    } catch (error) {
      console.error('Error generating carte:', error);
      throw error;
    }
  },

  // ============================================
  // DÉPARTEMENTS
  // ============================================

  /**
   * Récupérer la liste des départements
   */
  async getDepartements() {
    try {
      const response = await api.get('/personnel/departements');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching departements:', error);
      throw error;
    }
  },

  /**
   * Créer un département
   */
  async createDepartement(departementData) {
    try {
      const response = await api.post('/personnel/departements', departementData);
      return response.data;
    } catch (error) {
      console.error('Error creating departement:', error);
      throw error;
    }
  },

  /**
   * Modifier un département
   */
  async updateDepartement(id, departementData) {
    try {
      const response = await api.put(`/personnel/departements/${id}`, departementData);
      return response.data;
    } catch (error) {
      console.error('Error updating departement:', error);
      throw error;
    }
  },

  /**
   * Supprimer un département
   */
  async deleteDepartement(id) {
    try {
      const response = await api.delete(`/personnel/departements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting departement:', error);
      throw error;
    }
  },

  // ============================================
  // PRÉSENCES
  // ============================================

  /**
   * Récupérer les présences
   */
  async getPresences(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.date) params.append('date', filters.date);
      if (filters.id_utilisateur) params.append('id_utilisateur', filters.id_utilisateur);

      const response = await api.get(`/personnel/presences?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching presences:', error);
      throw error;
    }
  },

  /**
   * Enregistrer une présence
   */
  async createPresence(presenceData) {
    try {
      const response = await api.post('/personnel/presences', presenceData);
      return response.data;
    } catch (error) {
      console.error('Error creating presence:', error);
      throw error;
    }
  },

  // ============================================
  // SALAIRES
  // ============================================

  /**
   * Récupérer les salaires
   */
  async getSalaires(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.mois) params.append('mois', filters.mois);
      if (filters.annee) params.append('annee', filters.annee);
      if (filters.statut) params.append('statut', filters.statut);

      const response = await api.get(`/personnel/salaires?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching salaires:', error);
      throw error;
    }
  },

  /**
   * Calculer les salaires du mois
   */
  async calculerSalaires(data) {
    try {
      const response = await api.post('/personnel/salaires/calculer', data);
      return response.data;
    } catch (error) {
      console.error('Error calculating salaires:', error);
      throw error;
    }
  },

  /**
   * Valider un salaire
   */
  async validerSalaire(id) {
    try {
      const response = await api.put(`/personnel/salaires/${id}/valider`);
      return response.data;
    } catch (error) {
      console.error('Error validating salaire:', error);
      throw error;
    }
  },

  /**
   * Exporter les bulletins de paie
   */
  async exportBulletinsPaie(filters = {}) {
    try {
      // Cette fonction devra générer un PDF côté frontend
      // Pour l'instant, on récupère juste les données
      const salaires = await this.getSalaires(filters);
      
      // TODO: Implémenter la génération PDF avec react-native-html-to-pdf
      // ou expo-print
      
      return { salaires };
    } catch (error) {
      console.error('Error exporting bulletins:', error);
      throw error;
    }
  },

  // ============================================
  // CONGÉS
  // ============================================

  /**
   * Récupérer les congés
   */
  async getConges(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.statut) params.append('statut', filters.statut);

      const response = await api.get(`/personnel/conges?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching conges:', error);
      throw error;
    }
  },

  /**
   * Approuver un congé
   */
  async approuverConge(id) {
    try {
      const response = await api.put(`/personnel/conges/${id}/approuver`);
      return response.data;
    } catch (error) {
      console.error('Error approving conge:', error);
      throw error;
    }
  },

  /**
   * Rejeter un congé
   */
  async rejeterConge(id, commentaire) {
    try {
      const response = await api.put(`/personnel/conges/${id}/rejeter`, {
        commentaire_validation: commentaire
      });
      return response.data;
    } catch (error) {
      console.error('Error rejecting conge:', error);
      throw error;
    }
  },

  // ============================================
  // HISTORIQUE
  // ============================================

  /**
   * Récupérer l'historique personnel
   */
  async getHistoriquepersonnel(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.type && filters.type !== 'all') params.append('type', filters.type);

      const response = await api.get(`/personnel/historique?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching historique:', error);
      throw error;
    }
  },

  // ============================================
  // STATISTIQUES
  // ============================================

  /**
   * Récupérer les statistiques personnel
   */
  async getStatistiques() {
    try {
      const response = await api.get('/personnel/statistiques');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching statistiques:', error);
      throw error;
    }
  },
};

export default personnelService;