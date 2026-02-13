// frontend/src/services/operationsService.js

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com/api';
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const operationsService = {
  // ============================================
  // FLOTTE - VÉHICULES
  // ============================================
  async getVehicules(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/vehicules`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getVehicules:', error);
      throw error;
    }
  },

  async getVehiculeDetails(id) {
    try {
      const response = await axios.get(`${API_URL}/operations/vehicules/${id}`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getVehiculeDetails:', error);
      throw error;
    }
  },

  async createVehicule(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/vehicules`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createVehicule:', error);
      throw error;
    }
  },

  async updateVehicule(id, data) {
    try {
      const response = await axios.put(`${API_URL}/operations/vehicules/${id}`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateVehicule:', error);
      throw error;
    }
  },

  async deleteVehicule(id) {
    try {
      const response = await axios.delete(`${API_URL}/operations/vehicules/${id}`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur deleteVehicule:', error);
      throw error;
    }
  },

  // ============================================
  // FLOTTE - MOUVEMENTS VÉHICULES
  // ============================================
  async getMouvementsVehicules(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/mouvements-vehicules`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getMouvementsVehicules:', error);
      throw error;
    }
  },

  async createMouvementVehicule(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/mouvements-vehicules`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createMouvementVehicule:', error);
      throw error;
    }
  },

  async updateMouvementVehicule(id, data) {
    try {
      const response = await axios.put(`${API_URL}/operations/mouvements-vehicules/${id}`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateMouvementVehicule:', error);
      throw error;
    }
  },

  // ============================================
  // FLOTTE - MAINTENANCES
  // ============================================
  async getMaintenances(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/maintenances`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getMaintenances:', error);
      throw error;
    }
  },

  async createMaintenance(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/maintenances`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createMaintenance:', error);
      throw error;
    }
  },

  // ============================================
  // FLOTTE - ASSURANCES
  // ============================================
  async getAssurances(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/assurances`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getAssurances:', error);
      throw error;
    }
  },

  async createAssurance(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/assurances`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createAssurance:', error);
      throw error;
    }
  },

  // ============================================
  // AGRICULTURE - PARCELLES
  // ============================================
  async getParcelles(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/parcelles`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getParcelles:', error);
      throw error;
    }
  },

  async createParcelle(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/parcelles`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createParcelle:', error);
      throw error;
    }
  },

  async updateParcelle(id, data) {
    try {
      const response = await axios.put(`${API_URL}/operations/parcelles/${id}`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateParcelle:', error);
      throw error;
    }
  },

  async deleteParcelle(id) {
    try {
      const response = await axios.delete(`${API_URL}/operations/parcelles/${id}`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur deleteParcelle:', error);
      throw error;
    }
  },

  // ============================================
  // AGRICULTURE - CULTURES
  // ============================================
  async getCultures(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/cultures`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getCultures:', error);
      throw error;
    }
  },

  async createCulture(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/cultures`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createCulture:', error);
      throw error;
    }
  },

  async updateStageCulture(id, data) {
    try {
      const response = await axios.put(`${API_URL}/operations/cultures/${id}/stade`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateStageCulture:', error);
      throw error;
    }
  },

  // ============================================
  // ÉLEVAGE - ANIMAUX
  // ============================================
  async getAnimaux(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/animaux`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getAnimaux:', error);
      throw error;
    }
  },

  async createAnimal(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/animaux`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createAnimal:', error);
      throw error;
    }
  },

  async updateAnimal(id, data) {
    try {
      const response = await axios.put(`${API_URL}/operations/animaux/${id}`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateAnimal:', error);
      throw error;
    }
  },

  async deleteAnimal(id, data) {
    try {
      const response = await axios.delete(`${API_URL}/operations/animaux/${id}`, {
        data: data,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur deleteAnimal:', error);
      throw error;
    }
  },

  // ============================================
  // ÉLEVAGE - SUIVIS SANITAIRES
  // ============================================
  async getSuivisSanitaires(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/suivis-sanitaires`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getSuivisSanitaires:', error);
      throw error;
    }
  },

  async createSuiviSanitaire(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/suivis-sanitaires`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createSuiviSanitaire:', error);
      throw error;
    }
  },

  // ============================================
  // ÉLEVAGE - PRODUCTIONS LAIT
  // ============================================
  async getProductionsLait(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/productions-lait`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getProductionsLait:', error);
      throw error;
    }
  },

  async createProductionLait(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/productions-lait`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createProductionLait:', error);
      throw error;
    }
  },

  // ============================================
  // ÉLEVAGE - PRODUCTIONS OEUFS
  // ============================================
  async getProductionsOeufs(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/operations/productions-oeufs`, {
        params: filters,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getProductionsOeufs:', error);
      throw error;
    }
  },

  async createProductionOeufs(data) {
    try {
      const response = await axios.post(`${API_URL}/operations/productions-oeufs`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createProductionOeufs:', error);
      throw error;
    }
  },

  // ============================================
  // STATISTIQUES & DASHBOARDS
  // ============================================
  async getStatsFlotte() {
    try {
      const response = await axios.get(`${API_URL}/operations/stats/flotte`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getStatsFlotte:', error);
      throw error;
    }
  },

  async getStatsAgriculture() {
    try {
      const response = await axios.get(`${API_URL}/operations/stats/agriculture`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getStatsAgriculture:', error);
      throw error;
    }
  },

  async getStatsElevage() {
    try {
      const response = await axios.get(`${API_URL}/operations/stats/elevage`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getStatsElevage:', error);
      throw error;
    }
  },

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Récupérer tous les chauffeurs disponibles
   */
  async getChauffeurs() {
    try {
      const response = await axios.get(`${API_URL}/rh/employes`, {
        params: { role: 'chauffeur', statut: 'actif' },
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getChauffeurs:', error);
      throw error;
    }
  },

  /**
   * Récupérer tous les vétérinaires disponibles
   */
  async getVeterinaires() {
    try {
      const response = await axios.get(`${API_URL}/rh/employes`, {
        params: { role: 'veterinaire', statut: 'actif' },
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getVeterinaires:', error);
      throw error;
    }
  },

  /**
   * Récupérer tous les agriculteurs disponibles
   */
  async getAgriculteurs() {
    try {
      const response = await axios.get(`${API_URL}/rh/employes`, {
        params: { role: 'agriculteur', statut: 'actif' },
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getAgriculteurs:', error);
      throw error;
    }
  },

  /**
   * Récupérer les types de cultures disponibles
   */
  async getTypesCultures() {
    try {
      const response = await axios.get(`${API_URL}/operations/types-cultures`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getTypesCultures:', error);
      throw error;
    }
  },

  /**
   * Récupérer les fournisseurs pour achats
   */
  async getFournisseurs(type = null) {
    try {
      const params = type ? { type } : {};
      const response = await axios.get(`${API_URL}/commercial/fournisseurs`, {
        params,
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getFournisseurs:', error);
      throw error;
    }
  },

  /**
   * Récupérer les départements
   */
  async getDepartements() {
    try {
      const response = await axios.get(`${API_URL}/rh/departements`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getDepartements:', error);
      throw error;
    }
  },

  /**
   * Calculer l'âge d'un animal
   */
  calculateAge(dateNaissance) {
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },

  /**
   * Formater un numéro d'identification
   */
  formatNumeroIdentification(numero) {
    return numero ? numero.toUpperCase().trim() : '';
  },

  /**
   * Valider les données d'un véhicule
   */
  validateVehiculeData(data) {
    const errors = {};

    if (!data.immatriculation) {
      errors.immatriculation = 'Immatriculation requise';
    }
    if (!data.marque) {
      errors.marque = 'Marque requise';
    }
    if (!data.modele) {
      errors.modele = 'Modèle requis';
    }
    if (!data.type_vehicule) {
      errors.type_vehicule = 'Type de véhicule requis';
    }
    if (!data.id_departement) {
      errors.id_departement = 'Département requis';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Valider les données d'un animal
   */
  validateAnimalData(data) {
    const errors = {};

    if (!data.numero_identification) {
      errors.numero_identification = 'Numéro d\'identification requis';
    }
    if (!data.espece) {
      errors.espece = 'Espèce requise';
    }
    if (!data.race) {
      errors.race = 'Race requise';
    }
    if (!data.sexe) {
      errors.sexe = 'Sexe requis';
    }
    if (!data.date_naissance) {
      errors.date_naissance = 'Date de naissance requise';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Valider les données d'une parcelle
   */
  validateParcelleData(data) {
    const errors = {};

    if (!data.reference) {
      errors.reference = 'Référence requise';
    }
    if (!data.nom_parcelle) {
      errors.nom_parcelle = 'Nom de parcelle requis';
    }
    if (!data.superficie_hectares || data.superficie_hectares <= 0) {
      errors.superficie_hectares = 'Superficie valide requise';
    }
    if (!data.localisation) {
      errors.localisation = 'Localisation requise';
    }
    if (!data.type_sol) {
      errors.type_sol = 'Type de sol requis';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Valider les données d'un mouvement de véhicule
   */
  validateMouvementData(data) {
    const errors = {};

    if (!data.id_vehicule) {
      errors.id_vehicule = 'Véhicule requis';
    }
    if (!data.id_chauffeur) {
      errors.id_chauffeur = 'Chauffeur requis';
    }
    if (!data.type_mouvement) {
      errors.type_mouvement = 'Type de mouvement requis';
    }
    if (!data.kilometrage_depart) {
      errors.kilometrage_depart = 'Kilométrage de départ requis';
    }
    if (!data.destination) {
      errors.destination = 'Destination requise';
    }
    if (!data.motif) {
      errors.motif = 'Motif requis';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Calculer le total des frais d'un mouvement
   */
  calculateTotalFraisMouvement(cout_carburant = 0, cout_peages = 0, autres_frais = 0) {
    return parseFloat(cout_carburant || 0) + 
           parseFloat(cout_peages || 0) + 
           parseFloat(autres_frais || 0);
  },

  /**
   * Formater une date pour l'affichage
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR');
  },

  /**
   * Formater une date et heure pour l'affichage
   */
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('fr-FR');
  },

  /**
   * Formater un montant en devise
   */
  formatCurrency(amount, currency = 'BIF') {
    if (!amount && amount !== 0) return '';
    return new Intl.NumberFormat('fr-BI', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  /**
   * Obtenir le statut de santé avec couleur
   */
  getStatutSanteColor(statut) {
    const colors = {
      'excellent': 'success',
      'bon': 'primary',
      'moyen': 'warning',
      'malade': 'danger',
      'en_traitement': 'info'
    };
    return colors[statut] || 'secondary';
  },

  /**
   * Obtenir le statut de véhicule avec couleur
   */
  getStatutVehiculeColor(statut) {
    const colors = {
      'actif': 'success',
      'maintenance': 'warning',
      'hors_service': 'danger',
      'vendu': 'secondary'
    };
    return colors[statut] || 'secondary';
  },

  /**
   * Obtenir le statut de culture avec couleur
   */
  getStatutCultureColor(statut) {
    const colors = {
      'en_cours': 'primary',
      'recoltee': 'success',
      'abandonnee': 'danger'
    };
    return colors[statut] || 'secondary';
  },

  /**
   * Obtenir le stade de croissance avec couleur
   */
  getStadeCroissanceColor(stade) {
    const colors = {
      'semis': 'info',
      'levage': 'primary',
      'croissance': 'success',
      'floraison': 'warning',
      'maturation': 'orange',
      'recolte': 'danger'
    };
    return colors[stade] || 'secondary';
  }
};

export default operationsService;