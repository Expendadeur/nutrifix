// web/src/services/chauffeurService.js
import api from './api';

class ChauffeurService {
    // ============================================
    // DASHBOARD DATA
    // ============================================
    async getDashboardData() {
        try {
            const response = await api.get('/chauffeur/dashboard');
            return response.data;
        } catch (error) {
            console.error('Get dashboard error:', error);
            return { success: false, message: 'Erreur de chargement du dashboard' };
        }
    }

    // ============================================
    // VÉHICULE ASSIGNÉ
    // ============================================
    async getAssignedVehicle() {
        try {
            const response = await api.get('/chauffeur/vehicle');
            return response.data;
        } catch (error) {
            console.error('Get vehicle error:', error);
            return { success: false, message: 'Erreur de récupération du véhicule' };
        }
    }

    // ============================================
    // MISSIONS
    // ============================================
    async startMission(missionData) {
        try {
            const response = await api.post('/chauffeur/missions/start', missionData);
            return response.data;
        } catch (error) {
            console.error('Start mission error:', error);
            return { success: false, message: 'Erreur lors du démarrage de la mission' };
        }
    }

    async endMission(missionData) {
        try {
            const response = await api.post('/chauffeur/missions/end', missionData);
            return response.data;
        } catch (error) {
            console.error('End mission error:', error);
            return { success: false, message: 'Erreur lors de la fin de la mission' };
        }
    }

    async getCurrentMission() {
        try {
            const response = await api.get('/chauffeur/missions/current');
            return response.data;
        } catch (error) {
            console.error('Get current mission error:', error);
            return { success: false, message: 'Erreur de récupération de la mission' };
        }
    }

    async getMissions(filters = {}) {
        try {
            const response = await api.get('/chauffeur/missions', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Get missions error:', error);
            return { success: false, message: 'Erreur de récupération des missions' };
        }
    }

    // ============================================
    // INCIDENTS
    // ============================================
    async reportIncident(incidentData) {
        try {
            const formData = new FormData();
            
            formData.append('type', incidentData.type);
            formData.append('description', incidentData.description);
            formData.append('location', incidentData.location);
            formData.append('urgency', incidentData.urgency);
            
            if (incidentData.coordinates) {
                formData.append('coordinates', JSON.stringify(incidentData.coordinates));
            }

            if (incidentData.images && incidentData.images.length > 0) {
                incidentData.images.forEach((image) => {
                    formData.append('images', image);
                });
            }

            const response = await api.post('/chauffeur/incidents', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Report incident error:', error);
            return { success: false, message: 'Erreur lors de la déclaration de l\'incident' };
        }
    }

    async getIncidents(filters = {}) {
        try {
            const response = await api.get('/chauffeur/incidents', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Get incidents error:', error);
            return { success: false, message: 'Erreur de récupération des incidents' };
        }
    }

    // ============================================
    // FRAIS
    // ============================================
    async submitExpense(expenseData) {
        try {
            const formData = new FormData();
            
            formData.append('type', expenseData.type);
            formData.append('amount', expenseData.amount);
            formData.append('date', expenseData.date);
            formData.append('description', expenseData.description);
            formData.append('paymentMethod', expenseData.paymentMethod);
            
            if (expenseData.missionReference) {
                formData.append('missionReference', expenseData.missionReference);
            }

            if (expenseData.attachments && expenseData.attachments.length > 0) {
                expenseData.attachments.forEach((file) => {
                    formData.append('attachments', file);
                });
            }

            const response = await api.post('/chauffeur/expenses', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Submit expense error:', error);
            return { success: false, message: 'Erreur lors de la soumission des frais' };
        }
    }

    async getExpenses(filters = {}) {
        try {
            const response = await api.get('/chauffeur/expenses', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Get expenses error:', error);
            return { success: false, message: 'Erreur de récupération des frais' };
        }
    }

    // ============================================
    // MAINTENANCE
    // ============================================
    async getUpcomingMaintenance() {
        try {
            const response = await api.get('/chauffeur/maintenance/upcoming');
            return response.data;
        } catch (error) {
            console.error('Get maintenance error:', error);
            return { success: false, message: 'Erreur de récupération des maintenances' };
        }
    }

    async reportVehicleIssue(issueData) {
        try {
            const response = await api.post('/chauffeur/vehicle/issue', issueData);
            return response.data;
        } catch (error) {
            console.error('Report issue error:', error);
            return { success: false, message: 'Erreur lors de la déclaration du problème' };
        }
    }

    // ============================================
    // NOTIFICATIONS
    // ============================================
    async getNotifications(filters = {}) {
        try {
            const response = await api.get('/chauffeur/notifications', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Get notifications error:', error);
            return { success: false, message: 'Erreur de récupération des notifications' };
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            const response = await api.put(`/chauffeur/notifications/${notificationId}/read`);
            return response.data;
        } catch (error) {
            console.error('Mark notification error:', error);
            return { success: false, message: 'Erreur lors du marquage de la notification' };
        }
    }

    // ============================================
    // STATISTIQUES
    // ============================================
    async getStatistics(period = 'month') {
        try {
            const response = await api.get('/chauffeur/statistics', { params: { period } });
            return response.data;
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, message: 'Erreur de récupération des statistiques' };
        }
    }
}

export default new ChauffeurService();