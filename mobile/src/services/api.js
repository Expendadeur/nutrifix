// frontend/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configuration des URLs selon l'environnement
const getApiUrl = () => {
  if (__DEV__) {
    // En développement
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000/api'; // Émulateur Android
    } else if (Platform.OS === 'ios') {
      return 'http://localhost:5000/api'; // Simulateur iOS
    } else {
      return 'http://localhost:5000/api'; // Web
    }
  } else {
    // En production
    return 'https://votre-api.com/api';
  }
};

const API_URL = getApiUrl();

// Création de l'instance axios
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token à chaque requête
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response) {
      // Erreur avec réponse du serveur
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Token invalide ou expiré
          await AsyncStorage.removeItem('authToken');
          // Rediriger vers la page de connexion
          // NavigationService.navigate('Login');
          break;
        case 403:
          console.error('Access forbidden:', data.message);
          break;
        case 404:
          console.error('Resource not found:', data.message);
          break;
        case 500:
          console.error('Server error:', data.message);
          break;
        default:
          console.error('API Error:', data.message);
      }
    } else if (error.request) {
      // Pas de réponse du serveur
      console.error('Network error - no response received');
    } else {
      // Erreur lors de la configuration de la requête
      console.error('Request setup error:', error.message);
    }

    return Promise.reject(error);
  }
);

// ==================== SERVICES MANAGER ====================

export const ManagerAPI = {
  // Dashboard
  getDashboard: (params = {}) => {
    return apiClient.get('/manager/dashboard', { params });
  },

  // Salaires - Vue d'ensemble
  getSalariesOverview: (month, year) => {
    return apiClient.get('/manager/salaries-overview', {
      params: { month, year }
    });
  },

  // Salaires - Liste détaillée
  getSalariesDetailed: (filters = {}) => {
    return apiClient.get('/manager/salaries-detailed', {
      params: filters
    });
  },

  // Salaires non payés
  getSalariesNotPaid: (month, year) => {
    return apiClient.get('/manager/salaries-not-paid', {
      params: { month, year }
    });
  },

  // Salaires payés
  getSalariesPaid: (month, year) => {
    return apiClient.get('/manager/salaries-paid', {
      params: { month, year }
    });
  },

  // Statistiques des salaires
  getSalaryStatistics: (year) => {
    return apiClient.get('/manager/salary-statistics', {
      params: { year }
    });
  },

  // Demandes de paiement
  getPaymentRequests: (month, year, statut = 'en_attente') => {
    return apiClient.get('/manager/payment-requests', {
      params: { month, year, statut }
    });
  },

  // Payer un salaire
  paySalary: (salaryId, paymentData) => {
    return apiClient.post(`/manager/salaries/${salaryId}/pay`, paymentData);
  },

  // Payer plusieurs salaires
  payMultipleSalaries: (salaryIds, paymentData) => {
    return apiClient.post('/manager/salaries/pay-multiple', {
      salary_ids: salaryIds,
      ...paymentData
    });
  },

  // Traiter une demande de paiement
  processPaymentRequest: (requestId, action, data = {}) => {
    return apiClient.post(`/manager/payment-requests/${requestId}/process`, {
      action,
      ...data
    });
  },

  // Générer un rapport
  generateSalaryReport: (reportType, format, month, year) => {
    return apiClient.post('/manager/generate-salary-report', {
      type: reportType,
      format: format,
      month: month,
      year: year
    });
  },

  // Obtenir les détails d'un salaire
  getSalaryDetails: (salaryId) => {
    return apiClient.get(`/manager/salaries/${salaryId}`);
  },

  // Mettre à jour un salaire
  updateSalary: (salaryId, data) => {
    return apiClient.put(`/manager/salaries/${salaryId}`, data);
  },

  // Confirmer la réception d'un salaire
  confirmSalaryReception: (salaryId) => {
    return apiClient.post(`/manager/salaries/${salaryId}/confirm-reception`);
  },

  // Exporter les données
  exportData: (exportType, params = {}) => {
    return apiClient.post('/manager/export', {
      type: exportType,
      ...params
    }, {
      responseType: 'blob'
    });
  },

  // Obtenir les notifications
  getNotifications: (params = {}) => {
    return apiClient.get('/manager/notifications', { params });
  },

  // Marquer une notification comme lue
  markNotificationAsRead: (notificationId) => {
    return apiClient.put(`/manager/notifications/${notificationId}/read`);
  },
};

// ==================== SERVICES AUTH ====================

export const AuthAPI = {
  // Connexion
  login: (credentials) => {
    return apiClient.post('/auth/login', credentials);
  },

  // Déconnexion
  logout: () => {
    return apiClient.post('/auth/logout');
  },

  // Rafraîchir le token
  refreshToken: (refreshToken) => {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken });
  },

  // Obtenir le profil utilisateur
  getProfile: () => {
    return apiClient.get('/auth/profile');
  },

  // Mettre à jour le profil
  updateProfile: (data) => {
    return apiClient.put('/auth/profile', data);
  },

  // Changer le mot de passe
  changePassword: (oldPassword, newPassword) => {
    return apiClient.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    });
  },

  // Réinitialiser le mot de passe
  resetPassword: (email) => {
    return apiClient.post('/auth/reset-password', { email });
  },
};

// ==================== SERVICES RH ====================

export const RHAPI = {
  // Employés
  getEmployees: (params = {}) => {
    return apiClient.get('/rh/employees', { params });
  },

  getEmployeeDetails: (employeeId) => {
    return apiClient.get(`/rh/employees/${employeeId}`);
  },

  createEmployee: (data) => {
    return apiClient.post('/rh/employees', data);
  },

  updateEmployee: (employeeId, data) => {
    return apiClient.put(`/rh/employees/${employeeId}`, data);
  },

  deleteEmployee: (employeeId) => {
    return apiClient.delete(`/rh/employees/${employeeId}`);
  },

  // Présences
  getPresences: (params = {}) => {
    return apiClient.get('/rh/presences', { params });
  },

  markPresence: (data) => {
    return apiClient.post('/rh/presences', data);
  },

  // Congés
  getLeaves: (params = {}) => {
    return apiClient.get('/rh/leaves', { params });
  },

  createLeaveRequest: (data) => {
    return apiClient.post('/rh/leaves', data);
  },

  approveLeave: (leaveId) => {
    return apiClient.put(`/rh/leaves/${leaveId}/approve`);
  },

  rejectLeave: (leaveId, reason) => {
    return apiClient.put(`/rh/leaves/${leaveId}/reject`, { reason });
  },
};

// ==================== UTILITAIRES ====================

// Fonction helper pour gérer les erreurs de manière standardisée
export const handleApiError = (error) => {
  if (error.response) {
    // Erreur avec réponse du serveur
    return {
      success: false,
      message: error.response.data.message || error.response.data.error || 'Une erreur est survenue',
      status: error.response.status,
      data: error.response.data
    };
  } else if (error.request) {
    // Pas de réponse du serveur
    return {
      success: false,
      message: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
      status: 0,
      data: null
    };
  } else {
    // Erreur lors de la configuration de la requête
    return {
      success: false,
      message: 'Une erreur est survenue lors de la requête',
      status: 0,
      data: null
    };
  }
};

// Fonction pour sauvegarder le token
export const saveAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem('userToken', token);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
};

// Fonction pour récupérer le token
export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Fonction pour supprimer le token
export const removeAuthToken = async () => {
  try {
    await AsyncStorage.removeItem('userToken');
    return true;
  } catch (error) {
    console.error('Error removing token:', error);
    return false;
  }
};

// Fonction pour vérifier si l'utilisateur est connecté
export const isAuthenticated = async () => {
  const token = await getAuthToken();
  return !!token;
};

export default apiClient;