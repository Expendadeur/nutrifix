// frontend/src/services/managerService.js
import api from './api';

const managerService = {
  // ==================== DASHBOARD ====================
  getDashboardData: async (period = 'month') => {
    try {
      const response = await api.get(`/manager/dashboard?period=${period}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },

  approveRequest: async (requestId, type) => {
    try {
      let endpoint = '';
      if (type === 'conge') {
        endpoint = `/manager/leave-requests/${requestId}/process`;
      } else if (type === 'frais') {
        endpoint = `/manager/frais/${requestId}/validate`;
      }
      
      const response = await api.post(endpoint, { action: 'approve' });
      return response.data;
    } catch (error) {
      console.error('Error approving request:', error);
      throw error;
    }
  },

  rejectRequest: async (requestId, type, reason) => {
    try {
      const response = await api.post(`/manager/leave-requests/${requestId}/process`, {
        action: 'reject',
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error rejecting request:', error);
      throw error;
    }
  },

  // ==================== RH - ÉQUIPE ====================
  getDepartmentEmployees: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/manager/employees?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  getPresences: async (date) => {
    try {
      const response = await api.get(`/manager/presences?date=${date}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching presences:', error);
      throw error;
    }
  },

  validatePresences: async (presenceIds) => {
    try {
      const response = await api.post('/manager/presences/validate', { presenceIds });
      return response.data;
    } catch (error) {
      console.error('Error validating presences:', error);
      throw error;
    }
  },

  getLeaveRequests: async (filter = 'pending') => {
    try {
      const response = await api.get(`/manager/leave-requests?filter=${filter}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      throw error;
    }
  },

  processLeaveRequest: async (leaveId, action, reason = '') => {
    try {
      const response = await api.post(`/manager/leave-requests/${leaveId}/process`, {
        action,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error processing leave request:', error);
      throw error;
    }
  },

  getSalaries: async (month, year) => {
    try {
      const response = await api.get(`/manager/salaries?month=${month}&year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching salaries:', error);
      throw error;
    }
  },

  markSalaryAsPaid: async (salaryId) => {
    try {
      const response = await api.post(`/manager/salaries/${salaryId}/mark-paid`);
      return response.data;
    } catch (error) {
      console.error('Error marking salary as paid:', error);
      throw error;
    }
  },

  getPerformanceData: async () => {
    try {
      const response = await api.get('/manager/performance');
      return response.data;
    } catch (error) {
      console.error('Error fetching performance data:', error);
      throw error;
    }
  },

  // ==================== MODULES OPÉRATIONNELS ====================
  getDepartmentInfo: async () => {
    try {
      const response = await api.get('/manager/department-info');
      return response.data;
    } catch (error) {
      console.error('Error fetching department info:', error);
      throw error;
    }
  },

  // Agriculture
  getParcelles: async () => {
    try {
      const response = await api.get('/manager/parcelles');
      return response.data;
    } catch (error) {
      console.error('Error fetching parcelles:', error);
      throw error;
    }
  },

  getCultures: async () => {
    try {
      const response = await api.get('/manager/cultures');
      return response.data;
    } catch (error) {
      console.error('Error fetching cultures:', error);
      throw error;
    }
  },

  getIntrants: async () => {
    try {
      const response = await api.get('/manager/intrants');
      return response.data;
    } catch (error) {
      console.error('Error fetching intrants:', error);
      throw error;
    }
  },

  getRecoltes: async () => {
    try {
      const response = await api.get('/manager/recoltes');
      return response.data;
    } catch (error) {
      console.error('Error fetching recoltes:', error);
      throw error;
    }
  },

  // Élevage
  getAnimaux: async () => {
    try {
      const response = await api.get('/manager/animaux');
      return response.data;
    } catch (error) {
      console.error('Error fetching animaux:', error);
      throw error;
    }
  },

  getProductionLait: async () => {
    try {
      const response = await api.get('/manager/production-lait');
      return response.data;
    } catch (error) {
      console.error('Error fetching production lait:', error);
      throw error;
    }
  },

  getProductionOeufs: async () => {
    try {
      const response = await api.get('/manager/production-oeufs');
      return response.data;
    } catch (error) {
      console.error('Error fetching production oeufs:', error);
      throw error;
    }
  },

  getAlimentsBetail: async () => {
    try {
      const response = await api.get('/manager/aliments-betail');
      return response.data;
    } catch (error) {
      console.error('Error fetching aliments betail:', error);
      throw error;
    }
  },

  // Flotte
  getVehiculesDepartment: async () => {
    try {
      const response = await api.get('/manager/vehicules-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching vehicules:', error);
      throw error;
    }
  },

  getMissionsDepartment: async () => {
    try {
      const response = await api.get('/manager/missions-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching missions:', error);
      throw error;
    }
  },

  getMaintenancesDepartment: async () => {
    try {
      const response = await api.get('/manager/maintenances-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching maintenances:', error);
      throw error;
    }
  },

  getFraisDepartment: async () => {
    try {
      const response = await api.get('/manager/frais-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching frais:', error);
      throw error;
    }
  },

  validateFrais: async (fraisId) => {
    try {
      const response = await api.post(`/manager/frais/${fraisId}/validate`);
      return response.data;
    } catch (error) {
      console.error('Error validating frais:', error);
      throw error;
    }
  },

  // Commercial
  getCommandesDepartment: async () => {
    try {
      const response = await api.get('/manager/commandes-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching commandes:', error);
      throw error;
    }
  },

  getClientsDepartment: async () => {
    try {
      const response = await api.get('/manager/clients-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  },

  getFournisseursDepartment: async () => {
    try {
      const response = await api.get('/manager/fournisseurs-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching fournisseurs:', error);
      throw error;
    }
  },

  getStocksDepartment: async () => {
    try {
      const response = await api.get('/manager/stocks-department');
      return response.data;
    } catch (error) {
      console.error('Error fetching stocks:', error);
      throw error;
    }
  },

  // ==================== FINANCIER ====================
  getBudgetOverview: async () => {
    try {
      const response = await api.get('/manager/budget-overview');
      return response.data;
    } catch (error) {
      console.error('Error fetching budget overview:', error);
      throw error;
    }
  },

  getMonthlyFinancialTrend: async (months = 6) => {
    try {
      const response = await api.get(`/manager/monthly-financial-trend?months=${months}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching financial trend:', error);
      throw error;
    }
  },

  getBudgetDetails: async () => {
    try {
      const response = await api.get('/manager/budget-details');
      return response.data;
    } catch (error) {
      console.error('Error fetching budget details:', error);
      throw error;
    }
  },

  getBudgetRequests: async () => {
    try {
      const response = await api.get('/manager/budget-requests');
      return response.data;
    } catch (error) {
      console.error('Error fetching budget requests:', error);
      throw error;
    }
  },

  submitBudgetRequest: async (requestData) => {
    try {
      const response = await api.post('/manager/budget-requests', requestData);
      return response.data;
    } catch (error) {
      console.error('Error submitting budget request:', error);
      throw error;
    }
  },

  getDepartmentExpenses: async (month, year) => {
    try {
      const response = await api.get(`/manager/department-expenses?month=${month}&year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  },

  getExpensesByCategory: async (month, year) => {
    try {
      const response = await api.get(`/manager/expenses-by-category?month=${month}&year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expenses by category:', error);
      throw error;
    }
  },

  getDepartmentRevenues: async (month, year) => {
    try {
      const response = await api.get(`/manager/department-revenues?month=${month}&year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching revenues:', error);
      throw error;
    }
  },

  getRevenuesBySource: async (month, year) => {
    try {
      const response = await api.get(`/manager/revenues-by-source?month=${month}&year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching revenues by source:', error);
      throw error;
    }
  },

  generateFinancialReport: async (reportConfig) => {
    try {
      const response = await api.post('/manager/generate-financial-report', reportConfig);
      return response.data;
    } catch (error) {
      console.error('Error generating financial report:', error);
      throw error;
    }
  },
};

export default managerService;