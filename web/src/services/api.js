// web/src/services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Créer une instance axios
const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Intercepteur de requête - Ajouter le token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Intercepteur de réponse - Gérer les erreurs
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            // Erreur de réponse du serveur
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    // Token expiré ou invalide
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('userData');
                    localStorage.removeItem('userMatricule');
                    localStorage.removeItem('tokenExpiry');
                    window.location.href = '/login';
                    break;

                case 403:
                    // Permission refusée
                    console.error('Permission refusée:', data.message);
                    break;

                case 404:
                    // Ressource non trouvée
                    console.error('Ressource non trouvée:', data.message);
                    break;

                case 422:
                    // Erreur de validation
                    console.error('Erreur de validation:', data.errors);
                    break;

                case 500:
                    // Erreur serveur
                    console.error('Erreur serveur:', data.message);
                    break;

                default:
                    console.error('Erreur API:', data.message);
            }

            return Promise.reject(error.response);
        } else if (error.request) {
            // Pas de réponse du serveur
            console.error('Pas de réponse du serveur');
            return Promise.reject({
                data: {
                    success: false,
                    message: 'Impossible de joindre le serveur. Vérifiez votre connexion internet.'
                }
            });
        } else {
            // Erreur lors de la configuration de la requête
            console.error('Erreur de configuration:', error.message);
            return Promise.reject({
                data: {
                    success: false,
                    message: 'Erreur lors de la requête.'
                }
            });
        }
    }
);

export default api;