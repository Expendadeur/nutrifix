// mobile/src/services/chauffeurService.js - SERVICE COMPLET
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ChauffeurService {
    // ============================================
    // HELPER - GET TOKEN
    // ============================================
    async getToken() {
        try {
            return await AsyncStorage.getItem('userToken');
        } catch (error) {
            console.error('Get token error:', error);
            return null;
        }
    }

    // ============================================
    // HELPER - HEADERS
    // ============================================
    async getHeaders() {
        const token = await this.getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // ============================================
    // 1. DASHBOARD DATA
    // ============================================
    async getDashboardData() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/dashboard`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get dashboard error:', error);
            return { success: false, message: 'Erreur de chargement du dashboard' };
        }
    }

    // ============================================
    // 2. VÉHICULE ASSIGNÉ
    // ============================================
    async getAssignedVehicle() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/vehicle`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get vehicle error:', error);
            return { success: false, message: 'Erreur de récupération du véhicule' };
        }
    }

    // ============================================
    // 3. MISSION EN COURS
    // ============================================
    async getCurrentMission() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/missions/current`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get current mission error:', error);
            return { success: false, message: 'Erreur de récupération de la mission' };
        }
    }

    // ============================================
    // 4. DÉMARRER MISSION
    // ============================================
    async startMission(missionData) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/missions/start`, {
                method: 'POST',
                headers,
                body: JSON.stringify(missionData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Start mission error:', error);
            return { success: false, message: 'Erreur lors du démarrage de la mission' };
        }
    }

    // ============================================
    // 5. TERMINER MISSION
    // ============================================
    async endMission(missionData) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/missions/end`, {
                method: 'POST',
                headers,
                body: JSON.stringify(missionData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('End mission error:', error);
            return { success: false, message: 'Erreur lors de la fin de la mission' };
        }
    }

    // ============================================
    // 6. DÉCLARER INCIDENT
    // ============================================
    async reportIncident(incidentData) {
        try {
            const token = await this.getToken();
            const formData = new FormData();

            // Données textuelles
            formData.append('type', incidentData.type);
            formData.append('description', incidentData.description);
            formData.append('location', incidentData.location);
            formData.append('urgency', incidentData.urgency);
            
            if (incidentData.coordinates) {
                formData.append('coordinates', JSON.stringify(incidentData.coordinates));
            }

            // Images
            if (incidentData.images && incidentData.images.length > 0) {
                incidentData.images.forEach((image, index) => {
                    formData.append('images', {
                        uri: image.uri,
                        type: image.type || 'image/jpeg',
                        name: image.name || `incident_${index}.jpg`
                    });
                });
            }

            const response = await fetch(`${API_URL}/chauffeur/incidents`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                body: formData
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Report incident error:', error);
            return { success: false, message: 'Erreur lors de la déclaration de l\'incident' };
        }
    }

    // ============================================
    // 7. HISTORIQUE INCIDENTS
    // ============================================
    async getIncidents(filters = {}) {
        try {
            const headers = await this.getHeaders();
            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_URL}/chauffeur/incidents?${queryParams}`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get incidents error:', error);
            return { success: false, message: 'Erreur de récupération des incidents' };
        }
    }

    // ============================================
    // 8. SOUMETTRE FRAIS
    // ============================================
    async submitExpense(expenseData) {
        try {
            const token = await this.getToken();
            const formData = new FormData();

            // Données textuelles
            formData.append('type', expenseData.type);
            formData.append('montant', expenseData.montant);
            formData.append('date', expenseData.date);
            formData.append('description', expenseData.description);
            formData.append('paymentMethod', expenseData.paymentMethod);
            
            if (expenseData.missionReference) {
                formData.append('missionReference', expenseData.missionReference);
            }

            if (expenseData.quantite_carburant) {
                formData.append('quantite_carburant', expenseData.quantite_carburant);
            }

            // Justificatifs
            if (expenseData.attachments && expenseData.attachments.length > 0) {
                expenseData.attachments.forEach((file, index) => {
                    formData.append('attachments', {
                        uri: file.uri,
                        type: file.type || 'image/jpeg',
                        name: file.name || `justificatif_${index}.jpg`
                    });
                });
            }

            const response = await fetch(`${API_URL}/chauffeur/expenses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                body: formData
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Submit expense error:', error);
            return { success: false, message: 'Erreur lors de la soumission des frais' };
        }
    }

    // ============================================
    // 9. MAINTENANCES À VENIR
    // ============================================
    async getUpcomingMaintenance() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/maintenance/upcoming`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get maintenance error:', error);
            return { success: false, message: 'Erreur de récupération des maintenances' };
        }
    }

    // ============================================
    // 10. ALERTES ASSURANCE
    // ============================================
    async getInsuranceAlerts() {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/insurance/alerts`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get insurance alerts error:', error);
            return { success: false, message: 'Erreur de récupération des alertes assurance' };
        }
    }

    // ============================================
    // 11. METTRE À JOUR POSITION
    // ============================================
    async updateLocation(coordinates) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/location`, {
                method: 'POST',
                headers,
                body: JSON.stringify(coordinates)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Update location error:', error);
            return { success: false, message: 'Erreur de mise à jour de la position' };
        }
    }

    // ============================================
    // 12. STATISTIQUES
    // ============================================
    async getStatistics(period = 'today') {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/statistics?period=${period}`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, message: 'Erreur de récupération des statistiques' };
        }
    }

    // ============================================
    // 13. NOTIFICATIONS
    // ============================================
    async getNotifications(filters = {}) {
        try {
            const headers = await this.getHeaders();
            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_URL}/chauffeur/notifications?${queryParams}`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get notifications error:', error);
            return { success: false, message: 'Erreur de récupération des notifications' };
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Mark notification error:', error);
            return { success: false, message: 'Erreur lors du marquage de la notification' };
        }
    }

    // ============================================
    // 14. ENREGISTRER MOUVEMENT CARBURANT (pour traçabilité)
    // ============================================
    async recordFuelMovement(fuelData) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/fuel/record`, {
                method: 'POST',
                headers,
                body: JSON.stringify(fuelData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Record fuel error:', error);
            return { success: false, message: 'Erreur d\'enregistrement carburant' };
        }
    }

    // ============================================
    // 15. ENREGISTRER MOUVEMENT MAINTENANCE (pour traçabilité)
    // ============================================
    async recordMaintenanceMovement(maintenanceData) {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${API_URL}/chauffeur/maintenance/record`, {
                method: 'POST',
                headers,
                body: JSON.stringify(maintenanceData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Record maintenance error:', error);
            return { success: false, message: 'Erreur d\'enregistrement maintenance' };
        }
    }
}

export default new ChauffeurService();