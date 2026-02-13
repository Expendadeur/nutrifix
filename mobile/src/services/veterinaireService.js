// frontend/src/services/veterinaireService.js
import api from './api';

class VeterinaireService {

  // ==================== DASHBOARD ====================

  async getDashboardData() {
    try {
      const response = await api.get('/veterinaire/dashboard');
      return response.data.data;
    } catch (error) {
      console.error('Erreur getDashboardData:', error);
      throw error;
    }
  }

  // ==================== ANIMAUX ====================

  async getAnimaux(filters = {}) {
    try {
      const params = new URLSearchParams();

      // Ajouter tous les paramètres de filtrage
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.espece) params.append('espece', filters.espece);
      if (filters.statut) params.append('statut', filters.statut);
      if (filters.search) params.append('search', filters.search);
      if (filters.type_animal) params.append('type_animal', filters.type_animal);

      const response = await api.get(`/veterinaire/animaux?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getAnimaux:', error);
      throw error;
    }
  }

  async getAnimalDetails(animalId) {
    try {
      const response = await api.get(`/veterinaire/animaux/${animalId}`);
      return response.data.data;
    } catch (error) {
      console.error('Erreur getAnimalDetails:', error);
      throw error;
    }
  }

  async searchAnimaux(query) {
    try {
      const response = await api.get(`/veterinaire/animaux/search/${encodeURIComponent(query)}`);
      return response.data.data;
    } catch (error) {
      console.error('Erreur searchAnimaux:', error);
      throw error;
    }
  }

  async getHistoriqueMedical(animalId, page = 1, limit = 20) {
    try {
      const response = await api.get(`/veterinaire/animaux/${animalId}/historique?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getHistoriqueMedical:', error);
      throw error;
    }
  }

  // ==================== INTERVENTIONS ====================

  async getInterventions(filters = {}) {
    try {
      const params = new URLSearchParams();

      // Ajouter tous les paramètres de filtrage
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.filter) params.append('filter', filters.filter);
      if (filters.type_intervention) params.append('type_intervention', filters.type_intervention);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      if (filters.id_animal) params.append('id_animal', filters.id_animal);

      const response = await api.get(`/veterinaire/interventions?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getInterventions:', error);
      throw error;
    }
  }

  async createIntervention(interventionData) {
    try {
      const response = await api.post('/veterinaire/interventions', interventionData);
      return response.data;
    } catch (error) {
      console.error('Erreur createIntervention:', error);
      throw error;
    }
  }

  async getInterventionDetails(interventionId) {
    try {
      const response = await api.get(`/veterinaire/interventions/${interventionId}`);
      return response.data.data;
    } catch (error) {
      console.error('Erreur getInterventionDetails:', error);
      throw error;
    }
  }

  async updateIntervention(interventionId, updateData) {
    try {
      const response = await api.put(`/veterinaire/interventions/${interventionId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Erreur updateIntervention:', error);
      throw error;
    }
  }

  // ==================== PROFIL ====================

  async getProfilData() {
    try {
      const response = await api.get('/veterinaire/profil');
      return response.data.data;
    } catch (error) {
      console.error('Erreur getProfilData:', error);
      throw error;
    }
  }

  async markNotificationRead(notificationId) {
    try {
      const response = await api.put(`/veterinaire/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('Erreur markNotificationRead:', error);
      throw error;
    }
  }

  // ==================== STATISTIQUES ====================

  async getStatistics() {
    try {
      const response = await api.get('/veterinaire/statistiques');
      return response.data.data;
    } catch (error) {
      console.error('Erreur getStatistics:', error);
      throw error;
    }
  }

  // ==================== ALERTES ====================

  async createAlerteSanitaire(alerteData) {
    try {
      // Note: Cette route n'existe pas encore dans le backend
      // Vous devrez l'ajouter si vous en avez besoin
      const response = await api.post('/veterinaire/alertes', alerteData);
      return response.data;
    } catch (error) {
      console.error('Erreur createAlerteSanitaire:', error);
      throw error;
    }
  }

  // ==================== SALAIRES ====================

  /**
   * Salaires - Demander un code de vérification
   */
  async requestCode(salaireId) {
    try {
      const response = await api.post(`/veterinaire/salaires/${salaireId}/demander-code`);
      return response.data;
    } catch (error) {
      console.error('Erreur requestCode:', error);
      throw error;
    }
  }

  /**
   * Salaires - Confirmer la réception avec le code
   */
  async confirmReception(salaireId, data) {
    try {
      const response = await api.post(`/veterinaire/salaires/${salaireId}/confirmer-reception`, data);
      return response.data;
    } catch (error) {
      console.error('Erreur confirmReception:', error);
      throw error;
    }
  }

  // ==================== RAPPORTS ====================

  async generateRapportMedical(animalId, dateDebut, dateFin) {
    try {
      const response = await api.get(`/veterinaire/rapports/${animalId}?dateDebut=${dateDebut}&dateFin=${dateFin}`);
      return response.data;
    } catch (error) {
      console.error('Erreur generateRapportMedical:', error);
      throw error;
    }
  }

  async getAnimauxParStatut() {
    try {
      const response = await api.get('/veterinaire/statistiques/animaux-par-statut');
      return response.data.data;
    } catch (error) {
      console.error('Erreur getAnimauxParStatut:', error);
      throw error;
    }
  }

  async getInterventionsParType(dateDebut, dateFin) {
    try {
      const params = new URLSearchParams();
      if (dateDebut) params.append('dateDebut', dateDebut);
      if (dateFin) params.append('dateFin', dateFin);

      const response = await api.get(`/veterinaire/statistiques/interventions-par-type?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Erreur getInterventionsParType:', error);
      throw error;
    }
  }
}

export default new VeterinaireService();