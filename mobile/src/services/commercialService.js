// frontend/src/services/commercialService.js

import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const commercialService = {
  // ============================================
  // CLIENTS
  // ============================================
  async getClients(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/clients`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getClients:', error);
      throw error;
    }
  },

  async getClientById(id) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/clients/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getClientById:', error);
      throw error;
    }
  },

  async createClient(data) {
    try {
      const response = await axios.post(`${API_URL}/api/commercial/clients`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createClient:', error);
      throw error;
    }
  },

  async updateClient(id, data) {
    try {
      const response = await axios.put(`${API_URL}/api/commercial/clients/${id}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateClient:', error);
      throw error;
    }
  },

  async deleteClient(id) {
    try {
      const response = await axios.delete(`${API_URL}/api/commercial/clients/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur deleteClient:', error);
      throw error;
    }
  },

  // ============================================
  // FOURNISSEURS
  // ============================================
  async getFournisseurs(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/fournisseurs`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getFournisseurs:', error);
      throw error;
    }
  },

  async getFournisseurById(id) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/fournisseurs/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getFournisseurById:', error);
      throw error;
    }
  },

  async createFournisseur(data) {
    try {
      const response = await axios.post(`${API_URL}/api/commercial/fournisseurs`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createFournisseur:', error);
      throw error;
    }
  },

  async updateFournisseur(id, data) {
    try {
      const response = await axios.put(`${API_URL}/api/commercial/fournisseurs/${id}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateFournisseur:', error);
      throw error;
    }
  },

  async deleteFournisseur(id) {
    try {
      const response = await axios.delete(`${API_URL}/api/commercial/fournisseurs/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur deleteFournisseur:', error);
      throw error;
    }
  },

  // ============================================
  // COMMANDES VENTE
  // ============================================
  async getCommandesVente(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/commandes-vente`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getCommandesVente:', error);
      throw error;
    }
  },

  async getCommandeVenteById(id) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/commandes-vente/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getCommandeVenteById:', error);
      throw error;
    }
  },

  async createCommandeVente(data) {
    try {
      const response = await axios.post(`${API_URL}/api/commercial/commandes-vente`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createCommandeVente:', error);
      throw error;
    }
  },

  async updateCommandeVente(id, data) {
    try {
      const response = await axios.put(`${API_URL}/api/commercial/commandes-vente/${id}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateCommandeVente:', error);
      throw error;
    }
  },

  async updateStatutCommandeVente(id, statut) {
    try {
      const response = await axios.put(
        `${API_URL}/api/commercial/commandes-vente/${id}/statut`,
        { statut },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur updateStatutCommandeVente:', error);
      throw error;
    }
  },

  // ============================================
  // COMMANDES ACHAT
  // ============================================
  async getCommandesAchat(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/commandes-achat`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getCommandesAchat:', error);
      throw error;
    }
  },

  async getCommandeAchatById(id) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/commandes-achat/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getCommandeAchatById:', error);
      throw error;
    }
  },

  async createCommandeAchat(data) {
    try {
      const response = await axios.post(`${API_URL}/api/commercial/commandes-achat`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createCommandeAchat:', error);
      throw error;
    }
  },

  async updateCommandeAchat(id, data) {
    try {
      const response = await axios.put(`${API_URL}/api/commercial/commandes-achat/${id}`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateCommandeAchat:', error);
      throw error;
    }
  },

  async updateStatutCommandeAchat(id, statut) {
    try {
      const response = await axios.put(
        `${API_URL}/api/commercial/commandes-achat/${id}/statut`,
        { statut },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur updateStatutCommandeAchat:', error);
      throw error;
    }
  },

  // ============================================
  // FACTURES
  // ============================================
  async getFactures(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/factures`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getFactures:', error);
      throw error;
    }
  },

  async getFactureById(id) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/factures/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getFactureById:', error);
      throw error;
    }
  },

  // ============================================
  // PAIEMENTS
  // ============================================
  async getPaiements(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/paiements`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getPaiements:', error);
      throw error;
    }
  },

  async createPaiement(data) {
    try {
      const response = await axios.post(`${API_URL}/api/commercial/paiements`, data, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur createPaiement:', error);
      throw error;
    }
  },

  async validerPaiement(id) {
    try {
      const response = await axios.put(
        `${API_URL}/api/commercial/paiements/${id}/valider`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur validerPaiement:', error);
      throw error;
    }
  },

  // ============================================
  // STATISTIQUES
  // ============================================
  async getStatistiques(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/statistiques`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getStatistiques:', error);
      throw error;
    }
  },

  // ============================================
  // RAPPORTS
  // ============================================
  async getRapportVentes(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/rapports/ventes`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getRapportVentes:', error);
      throw error;
    }
  },

  async getRapportAchats(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/rapports/achats`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getRapportAchats:', error);
      throw error;
    }
  },

  async getRapportCreances(filters = {}) {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/rapports/creances`, {
        params: filters,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur getRapportCreances:', error);
      throw error;
    }
  },

  // ============================================
  // EXPORT
  // ============================================
  async exportCommandesVente(filters = {}, format = 'csv') {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/export/commandes-vente`, {
        params: { ...filters, format },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `commandes-vente-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      return response.data;
    } catch (error) {
      console.error('Erreur exportCommandesVente:', error);
      throw error;
    }
  },

  async exportFactures(filters = {}, format = 'csv') {
    try {
      const response = await axios.get(`${API_URL}/api/commercial/export/factures`, {
        params: { ...filters, format },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `factures-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      return response.data;
    } catch (error) {
      console.error('Erreur exportFactures:', error);
      throw error;
    }
  },

  // ============================================
  // IMPRESSION
  // ============================================
  async printCommande(id, type = 'vente') {
    try {
      const response = await axios.get(
        `${API_URL}/api/commercial/print/commande-${type}/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          responseType: 'blob'
        }
      );

      // Ouvrir dans une nouvelle fenêtre pour impression
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      return response.data;
    } catch (error) {
      console.error('Erreur printCommande:', error);
      throw error;
    }
  },

  async printFacture(id) {
    try {
      const response = await axios.get(
        `${API_URL}/api/commercial/print/facture/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      return response.data;
    } catch (error) {
      console.error('Erreur printFacture:', error);
      throw error;
    }
  },

  // ============================================
  // UTILITAIRES
  // ============================================
  async verifierCreditClient(clientId, montant) {
    try {
      const response = await axios.post(
        `${API_URL}/api/commercial/clients/${clientId}/verifier-credit`,
        { montant },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur verifierCreditClient:', error);
      throw error;
    }
  },

  async calculerRemise(clientId, montant) {
    try {
      const response = await axios.post(
        `${API_URL}/api/commercial/clients/${clientId}/calculer-remise`,
        { montant },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur calculerRemise:', error);
      throw error;
    }
  },

  async getHistoriqueClient(clientId, filters = {}) {
    try {
      const response = await axios.get(
        `${API_URL}/api/commercial/clients/${clientId}/historique`,
        {
          params: filters,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur getHistoriqueClient:', error);
      throw error;
    }
  },

  async getHistoriqueFournisseur(fournisseurId, filters = {}) {
    try {
      const response = await axios.get(
        `${API_URL}/api/commercial/fournisseurs/${fournisseurId}/historique`,
        {
          params: filters,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Erreur getHistoriqueFournisseur:', error);
      throw error;
    }
  }
};

export default commercialService;