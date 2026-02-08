// frontend/src/services/financeService.js

import api from './api';

const financeService = {
  // ============================================
  // DASHBOARD
  // ============================================
  async getDashboard(params = {}) {
    try {
      const response = await api.get('/finance/dashboard', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get dashboard error:', error);
      throw error;
    }
  },

  // ============================================
  // CRÉANCES
  // ============================================
  async getCreances(params = {}) {
    try {
      const response = await api.get('/finance/creances', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get creances error:', error);
      throw error;
    }
  },

  async relancerClient(creanceId, messagePersonnalise = '') {
    try {
      const response = await api.post(`/finance/creances/${creanceId}/relancer`, {
        message_personnalise: messagePersonnalise
      });
      return response.data;
    } catch (error) {
      console.error('Relancer client error:', error);
      throw error;
    }
  },

  // ============================================
  // DETTES
  // ============================================
  async getDettes(params = {}) {
    try {
      const response = await api.get('/finance/dettes', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get dettes error:', error);
      throw error;
    }
  },

  // ============================================
  // PAIEMENTS
  // ============================================
  async getPaiements(params = {}) {
    try {
      const response = await api.get('/finance/paiements', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get paiements error:', error);
      throw error;
    }
  },

  async createPaiement(paiementData) {
    try {
      const response = await api.post('/finance/paiements', paiementData);
      return response.data;
    } catch (error) {
      console.error('Create paiement error:', error);
      throw error;
    }
  },

  async updatePaiement(paiementId, updateData) {
    try {
      const response = await api.put(`/finance/paiements/${paiementId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Update paiement error:', error);
      throw error;
    }
  },

  async deletePaiement(paiementId) {
    try {
      const response = await api.delete(`/finance/paiements/${paiementId}`);
      return response.data;
    } catch (error) {
      console.error('Delete paiement error:', error);
      throw error;
    }
  },

  // ============================================
  // JOURNAL COMPTABLE
  // ============================================
  async getJournalComptableComplet(params = {}) {
    try {
      const response = await api.get('/finance/journal-comptable', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get journal comptable error:', error);
      throw error;
    }
  },

  async exportJournalComptable(params = {}) {
    try {
      const response = await api.get('/finance/journal-comptable/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Export journal error:', error);
      throw error;
    }
  },

  // ============================================
  // RAPPORTS
  // ============================================
  async getRapportFinancier(params = {}) {
    try {
      const response = await api.get('/finance/rapports', { params });
      return response.data.data;
    } catch (error) {
      console.error('Get rapport error:', error);
      throw error;
    }
  },

  async exportRapport(params = {}) {
    try {
      const response = await api.get('/finance/rapports/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Export rapport error:', error);
      throw error;
    }
  },

  // ============================================
  // RAPPROCHEMENT BANCAIRE
  // ============================================
  async getReleveBancaire() {
    try {
      const response = await api.get('/finance/rapprochement/releve-bancaire');
      return response.data.data;
    } catch (error) {
      console.error('Get relevé bancaire error:', error);
      throw error;
    }
  },

  async getMouvementsComptables() {
    try {
      const response = await api.get('/finance/rapprochement/mouvements-comptables');
      return response.data.data;
    } catch (error) {
      console.error('Get mouvements comptables error:', error);
      throw error;
    }
  },

  async getStatutRapprochement() {
    try {
      const response = await api.get('/finance/rapprochement/statut');
      return response.data.data;
    } catch (error) {
      console.error('Get statut rapprochement error:', error);
      throw error;
    }
  },

  async calculerEcarts() {
    try {
      const response = await api.get('/finance/rapprochement/ecarts');
      return response.data.data;
    } catch (error) {
      console.error('Calculer écarts error:', error);
      throw error;
    }
  },

  async rapprocherMouvement(mouvementId, table = 'journal_comptable') {
    try {
      const response = await api.put(`/finance/rapprochement/${mouvementId}`, null, {
        params: { table }
      });
      return response.data;
    } catch (error) {
      console.error('Rapprocher mouvement error:', error);
      throw error;
    }
  },

  async validerRapprochement() {
    try {
      const response = await api.post('/finance/rapprochement/valider');
      return response.data;
    } catch (error) {
      console.error('Valider rapprochement error:', error);
      throw error;
    }
  },

  // ============================================
  // DÉPARTEMENTS
  // ============================================
  async getDepartements() {
    try {
      const response = await api.get('/finance/departements');
      return response.data.data;
    } catch (error) {
      console.error('Get departements error:', error);
      throw error;
    }
  },

  // ============================================
  // UTILITAIRES
  // ============================================
  formatMontant(montant) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(montant);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  formatDateCourte(date) {
    return new Date(date).toLocaleDateString('fr-FR');
  },

  calculerJoursRetard(dateEcheance) {
    const aujourdhui = new Date();
    const echeance = new Date(dateEcheance);
    const diffTime = aujourdhui - echeance;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  },

  getStatutColor(statut) {
    const colors = {
      'payee': '#27AE60',
      'impayee': '#E74C3C',
      'partiellement_payee': '#F39C12',
      'en_retard': '#E74C3C',
      'effectue': '#27AE60',
      'en_attente': '#F39C12',
      'annule': '#95A5A6'
    };
    return colors[statut] || '#95A5A6';
  },

  getCategorieIcon(categorie) {
    const icons = {
      'vente': 'shopping-cart',
      'achat': 'shopping-bag',
      'salaire': 'attach-money',
      'production': 'agriculture',
      'stock': 'inventory',
      'maintenance': 'build',
      'autre': 'receipt'
    };
    return icons[categorie] || 'receipt';
  },

  getCategorieColor(categorie) {
    const colors = {
      'vente': '#27AE60',
      'achat': '#E74C3C',
      'salaire': '#F39C12',
      'production': '#9B59B6',
      'stock': '#3498DB',
      'maintenance': '#E67E22',
      'autre': '#95A5A6'
    };
    return colors[categorie] || '#95A5A6';
  }
};

export default financeService;