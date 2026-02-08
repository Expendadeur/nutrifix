// frontend/src/services/employeService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ============================================
// CLASSE DE BASE POUR LES SERVICES
// ============================================
class BaseEmployeService {
  constructor() {
    this.locationWatcher = null;
    this.currentLocation = null;
  }

  /**
   * Récupère le token d'authentification
   */
  async getAuthToken() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token;
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return null;
    }
  }

  /**
   * Headers par défaut pour les requêtes
   */
  async getHeaders() {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Gère les erreurs des requêtes
   */
  handleError(error) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Erreur serveur');
    } else if (error.request) {
      throw new Error('Pas de réponse du serveur');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }

  /**
   * Effectue une requête GET
   */
  async get(endpoint, params = {}) {
    try {
      const headers = await this.getHeaders();
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${API_URL}${endpoint}?${queryString}` : `${API_URL}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la requête');
      }

      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Effectue une requête POST
   */
  async post(endpoint, body = {}) {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la requête');
      }

      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Effectue une requête PUT
   */
  async put(endpoint, body = {}) {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la requête');
      }

      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Effectue une requête POST avec FormData
   */
  async postFormData(endpoint, formData) {
    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Ne pas définir Content-Type pour FormData
        },
        body: formData
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la requête');
      }

      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Démarre le tracking de localisation
   */
  async startLocationTracking(callback) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission de localisation refusée');
        return;
      }

      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy
          };
          if (callback) {
            callback(this.currentLocation);
          }
        }
      );
    } catch (error) {
      console.error('Erreur tracking localisation:', error);
    }
  }

  /**
   * Arrête le tracking de localisation
   */
  stopLocationTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
  }

  /**
   * Obtient la localisation actuelle
   */
  async getCurrentLocation() {
    try {
      if (this.currentLocation) {
        return this.currentLocation;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { latitude: 0, longitude: 0 };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      };
    } catch (error) {
      console.error('Erreur obtention localisation:', error);
      return { latitude: 0, longitude: 0 };
    }
  }
}

// ============================================
// CLASSE SERVICE EMPLOYÉ INSS - AMÉLIORÉE
// ============================================
class EmployeINSSService extends BaseEmployeService {
  
  // ========== DASHBOARD ==========
  
  /**
   * Dashboard - Récupère les données du dashboard
   */
  async getDashboard() {
    const response = await this.get('/employe-inss/dashboard');
    return response.data;
  }

  // ========== PROFIL ==========
  
  /**
   * Profil - Récupère le profil complet
   */
  async getEmployeeProfile() {
    const response = await this.get('/employe-inss/profil');
    return response.data;
  }

  /**
   * Profil - Met à jour le profil
   */
  async updateProfile(profileData) {
    return await this.put('/employe-inss/profil', profileData);
  }

  // ========== CARTE DIGITALE ==========
  
  /**
   * Carte - Récupère la carte digitale
   */
  async getCarteDigitale() {
    const response = await this.get('/employe-inss/carte');
    return response.data;
  }

  // ========== CONGÉS ==========
  
  /**
   * Congés - Récupère le solde de congés
   */
  async getLeaveBalance() {
    const response = await this.get('/employe-inss/conges/solde');
    return response.data;
  }

  /**
   * Congés - Soumet une demande de congé
   */
  async submitLeaveRequest(leaveData) {
    const formData = new FormData();
    
    // Ajouter les champs texte
    Object.keys(leaveData).forEach(key => {
      if (key !== 'piece_jointe' && leaveData[key] !== null && leaveData[key] !== undefined) {
        formData.append(key, leaveData[key]);
      }
    });

    // Ajouter le fichier si présent
    if (leaveData.piece_jointe) {
      const file = {
        uri: leaveData.piece_jointe,
        type: 'application/pdf',
        name: 'piece_jointe.pdf'
      };
      formData.append('piece_jointe', file);
    }

    return await this.postFormData('/employe-inss/conges/demande', formData);
  }

  /**
   * Congés - Récupère l'historique des congés
   */
  async getConges(filters = {}) {
    const response = await this.get('/employe-inss/conges', filters);
    return response.data;
  }

  /**
   * Congés - Récupère les demandes récentes
   */
  async getRecentLeaves() {
    const conges = await this.getConges();
    return conges.slice(0, 5);
  }

  // ========== SALAIRES ==========
  
  /**
   * Salaires - Récupère les bulletins de salaire
   */
  async getBulletinsSalaire(filters = {}) {
    const response = await this.get('/employe-inss/salaires', filters);
    return response.data;
  }

  /**
   * Salaires - Récupère le détail d'un bulletin
   */
  async getBulletinDetail(bulletinId) {
    const response = await this.get(`/employe-inss/salaires/${bulletinId}`);
    return response.data;
  }

  /**
   * Salaires - Récupère le dernier salaire
   */
  async getDernierSalaire() {
    const bulletins = await this.getBulletinsSalaire();
    return bulletins.bulletins?.[0] || null;
  }

  /**
   * Salaires - Statistiques annuelles
   */
  async getSalaryStatistics(annee) {
    const data = await this.getBulletinsSalaire({ annee });
    return data.statistiques;
  }

  // ========== PRÉSENCES ==========
  
  /**
   * Présences - Récupère l'historique des présences
   */
  async getPresences(filters = {}) {
    const response = await this.get('/employe-inss/presences', filters);
    return response.data;
  }

  /**
   * Présences - Récupère la présence du jour
   */
  async getPresenceToday() {
    const today = new Date();
    const mois = today.getMonth() + 1;
    const annee = today.getFullYear();
    
    const data = await this.getPresences({ mois, annee });
    const todayStr = today.toISOString().split('T')[0];
    
    return data.presences?.find(p => p.date === todayStr) || null;
  }

  // ========== POINTAGE ==========
  
  /**
   * Pointage - Enregistre l'entrée
   */
  async checkIn(pointageData) {
    return await this.post('/employe-inss/pointage/entree', pointageData);
  }

  /**
   * Pointage - Enregistre la sortie
   */
  async checkOut(pointageData) {
    return await this.post('/employe-inss/pointage/sortie', pointageData);
  }

  // ========== NOTIFICATIONS ==========
  
  /**
   * Notifications - Récupère les notifications
   */
  async getNotifications(filters = {}) {
    const response = await this.get('/employe-inss/notifications', filters);
    return response.data;
  }

  /**
   * Notifications - Marque une notification comme lue
   */
  async markNotificationAsRead(notificationId) {
    return await this.put(`/employe-inss/notifications/${notificationId}/marquer-lu`);
  }
}

// ============================================
// CLASSE SERVICE EMPLOYÉ TEMPS PARTIEL - INCHANGÉE
// ============================================
class TempsPartielService extends BaseEmployeService {
  
  // ========== DASHBOARD ==========
  
  /**
   * Dashboard - Récupère les données du dashboard
   */
  async getDashboard() {
    const response = await this.get('/employe-temps-partiel/dashboard');
    return response.data;
  }

  // ========== CARTE DIGITALE ==========
  
  /**
   * Carte - Récupère la carte digitale
   */
  async getCarteDigitale() {
    const response = await this.get('/employe-temps-partiel/carte');
    return response.data;
  }

  // ========== POINTAGE ==========
  
  /**
   * Pointage - Récupère le pointage du jour
   */
  async getTodayPointage() {
    const response = await this.get('/employe-temps-partiel/pointage/today');
    return response.data;
  }

  /**
   * Pointage - Enregistre l'entrée
   */
  async pointageEntree(locationData) {
    return await this.post('/employe-temps-partiel/pointage/entree', locationData);
  }

  /**
   * Pointage - Enregistre la sortie
   */
  async pointageSortie(locationData) {
    return await this.post('/employe-temps-partiel/pointage/sortie', locationData);
  }

  // ========== HEURES ==========
  
  /**
   * Heures - Récupère l'historique des heures
   */
  async getHeures(filters = {}) {
    const response = await this.get('/employe-temps-partiel/heures', filters);
    return response.data;
  }

  /**
   * Heures - Récupère les heures du mois en cours
   */
  async getHeuresMoisActuel() {
    const today = new Date();
    const mois = today.getMonth() + 1;
    const annee = today.getFullYear();
    
    return await this.getHeures({ mois, annee });
  }

  // ========== SALAIRES ==========
  
  /**
   * Salaires - Récupère l'historique des salaires
   */
  async getSalaires(filters = {}) {
    const response = await this.get('/employe-temps-partiel/salaires', filters);
    return response.data;
  }

  /**
   * Salaires - Récupère le détail d'un salaire
   */
  async getSalaireDetail(salaireId) {
    const response = await this.get(`/employe-temps-partiel/salaires/${salaireId}`);
    return response.data;
  }

  /**
   * Salaires - Récupère les salaires du mois
   */
  async getSalairesMois(mois, annee) {
    return await this.getSalaires({ mois, annee });
  }

  /**
   * Salaires - Récupère le dernier salaire
   */
  async getDernierSalaire() {
    const salaires = await this.getSalaires();
    return salaires.salaires?.[0] || null;
  }

  // ========== PROFIL ==========
  
  /**
   * Profil - Récupère les informations du profil
   */
  async getProfil() {
    const response = await this.get('/employe-temps-partiel/profil');
    return response.data;
  }

  // ========== STATISTIQUES ==========
  
  /**
   * Statistiques - Récupère les statistiques détaillées
   */
  async getStatistiques(periode = 'tout') {
    const response = await this.get('/employe-temps-partiel/statistiques', { periode });
    return response.data;
  }

  /**
   * Statistiques - Récupère les statistiques du mois
   */
  async getStatistiquesMois() {
    return await this.getStatistiques('mois');
  }

  /**
   * Statistiques - Récupère les statistiques de l'année
   */
  async getStatistiquesAnnee() {
    return await this.getStatistiques('annee');
  }

  // ========== UTILITAIRES ==========
  
  /**
   * Utilitaire - Calcule le salaire estimé
   */
  calculateEstimatedSalary(heures, tauxHoraire) {
    return Math.round(heures * tauxHoraire);
  }

  /**
   * Utilitaire - Formate la durée en heures
   */
  formatDuration(heures) {
    const h = Math.floor(heures);
    const m = Math.round((heures - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  /**
   * Utilitaire - Obtient la localisation actuelle
   */
  async getCurrentLocation() {
    // Cette fonction doit être implémentée côté composant avec expo-location
    return {
      latitude: 0,
      longitude: 0
    };
  }
}

// ============================================
// CLASSE SERVICE MIXTE (INSS + TEMPS PARTIEL)
// ============================================
class EmployeService extends BaseEmployeService {
  constructor() {
    super();
    this.inss = new EmployeINSSService();
    this.tempsPartiel = new TempsPartielService();
  }

  /**
   * Détermine le type d'employé et retourne le bon service
   */
  async getServiceForCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        throw new Error('Utilisateur non connecté');
      }

      const user = JSON.parse(userData);
      
      if (user.type_employe === 'temps_partiel') {
        return this.tempsPartiel;
      } else if (user.type_employe === 'INSS') {
        return this.inss;
      } else {
        throw new Error('Type d\'employé non reconnu');
      }
    } catch (error) {
      console.error('Erreur détermination service:', error);
      throw error;
    }
  }

  /**
   * Dashboard - Version intelligente qui détecte le type d'employé
   */
  async getDashboard() {
    const service = await this.getServiceForCurrentUser();
    return await service.getDashboard();
  }

  /**
   * Carte - Version intelligente qui détecte le type d'employé
   */
  async getCarteDigitale() {
    const service = await this.getServiceForCurrentUser();
    return await service.getCarteDigitale();
  }

  /**
   * Pointage Entrée - Version intelligente
   */
  async checkIn(locationData) {
    const service = await this.getServiceForCurrentUser();
    
    if (service instanceof TempsPartielService) {
      return await service.pointageEntree(locationData);
    } else {
      return await service.checkIn(locationData);
    }
  }

  /**
   * Pointage Sortie - Version intelligente
   */
  async checkOut(locationData) {
    const service = await this.getServiceForCurrentUser();
    
    if (service instanceof TempsPartielService) {
      return await service.pointageSortie(locationData);
    } else {
      return await service.checkOut(locationData);
    }
  }

  /**
   * Profil - Version intelligente
   */
  async getProfile() {
    const service = await this.getServiceForCurrentUser();
    
    if (service instanceof TempsPartielService) {
      return await service.getProfil();
    } else {
      return await service.getEmployeeProfile();
    }
  }

  /**
   * Obtient le type d'employé actuel
   */
  async getEmployeeType() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) return null;
      
      const user = JSON.parse(userData);
      return user.type_employe;
    } catch (error) {
      console.error('Erreur récupération type employé:', error);
      return null;
    }
  }
}

// ============================================
// EXPORTS
// ============================================

// Exporter les instances des services
export const employeINSSService = new EmployeINSSService();
export const tempsPartielService = new TempsPartielService();
export const employeService = new EmployeService();

// Export par défaut du service mixte
export default employeService;