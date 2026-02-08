// mobile/src/utils/authGuard.js

/**
 * ═══════════════════════════════════════════════════════════════
 * 🛡️ AUTH GUARD - PROTECTION D'AUTHENTIFICATION SIMPLE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Système de protection simple comme en PHP
 * À importer au début de chaque page pour vérifier l'authentification
 * 
 * USAGE SIMPLE :
 * 
 * import { requireAuth } from '../utils/authGuard';
 * 
 * const MyScreen = ({ navigation }) => {
 *   requireAuth(navigation);  // ← UNE SEULE LIGNE !
 *   
 *   // Votre code normal...
 * }
 * 
 * AVEC RÔLE :
 * 
 * requireAuth(navigation, { role: 'admin' });
 * requireAuth(navigation, { role: 'chauffeur' });
 * 
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * Vérifier si l'utilisateur est authentifié
 * Redirige automatiquement vers LoginScreen si non connecté
 * 
 * @param {Object} navigation - Navigation object
 * @param {Object} options - Options de configuration
 * @param {string} options.role - Rôle requis (optionnel)
 * @param {boolean} options.silent - Ne pas afficher d'alerte (défaut: false)
 * @param {string} options.redirectTo - Écran de redirection (défaut: 'LoginScreen')
 * 
 * @returns {Object} { user, token, isLoading }
 */
export const requireAuth = (navigation, options = {}) => {
  const [authState, setAuthState] = useState({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false
  });

  const {
    role = null,
    silent = false,
    redirectTo = 'LoginScreen'
  } = options;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔐 Vérification authentification...');

      // Récupérer les données de session
      const token = await AsyncStorage.getItem('userToken');
      const userDataString = await AsyncStorage.getItem('userData');

      // Pas de token = pas connecté
      if (!token || !userDataString) {
        console.log('❌ Non authentifié - Redirection');
        
        if (!silent) {
          Alert.alert(
            'Authentification requise',
            'Veuillez vous connecter pour accéder à cette page.',
            [{ text: 'OK' }]
          );
        }

        // Redirection vers LoginScreen
        navigation.replace(redirectTo);
        return;
      }

      const userData = JSON.parse(userDataString);
      console.log('✅ Utilisateur connecté:', userData.nom_complet);

      // Vérifier le rôle si spécifié
      if (role) {
        const userRole = userData.role?.toLowerCase();
        const requiredRole = role.toLowerCase();

        if (userRole !== requiredRole) {
          console.log('❌ Rôle insuffisant:', {
            userRole,
            requiredRole
          });

          if (!silent) {
            Alert.alert(
              'Accès refusé',
              `Cette page nécessite le rôle "${role}".`,
              [
                {
                  text: 'Retour',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }

          // Rediriger vers l'accueil ou la page précédente
          setTimeout(() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('Home');
            }
          }, 100);
          
          return;
        }
      }

      console.log('✅ Authentification valide');

      // Mettre à jour l'état
      setAuthState({
        user: userData,
        token: token,
        isLoading: false,
        isAuthenticated: true
      });

    } catch (error) {
      console.error('❌ Erreur vérification auth:', error);
      
      // En cas d'erreur, déconnecter par sécurité
      if (!silent) {
        Alert.alert(
          'Erreur',
          'Erreur de vérification. Veuillez vous reconnecter.',
          [{ text: 'OK' }]
        );
      }
      
      navigation.replace(redirectTo);
    }
  };

  return authState;
};

/**
 * Hook simple pour obtenir l'utilisateur connecté
 * Ne redirige PAS automatiquement
 * 
 * @returns {Object} { user, token, isLoading }
 */
export const useCurrentUser = () => {
  const [authState, setAuthState] = useState({
    user: null,
    token: null,
    isLoading: true
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userDataString = await AsyncStorage.getItem('userData');

      if (token && userDataString) {
        const userData = JSON.parse(userDataString);
        setAuthState({
          user: userData,
          token: token,
          isLoading: false
        });
      } else {
        setAuthState({
          user: null,
          token: null,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      setAuthState({
        user: null,
        token: null,
        isLoading: false
      });
    }
  };

  return authState;
};

/**
 * Fonction de déconnexion
 * À utiliser dans vos écrans
 */
export const logout = async (navigation) => {
  try {
    console.log('🚪 Déconnexion...');

    // Supprimer les données de session
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('userMatricule');
    await AsyncStorage.removeItem('userRole');

    console.log('✅ Déconnexion réussie');

    // Rediriger vers LoginScreen
    navigation.replace('LoginScreen');
  } catch (error) {
    console.error('❌ Erreur déconnexion:', error);
  }
};

/**
 * Vérifier si l'utilisateur a un rôle spécifique
 * 
 * @param {string} role - Le rôle à vérifier
 * @returns {Promise<boolean>}
 */
export const hasRole = async (role) => {
  try {
    const userDataString = await AsyncStorage.getItem('userData');
    if (!userDataString) return false;

    const userData = JSON.parse(userDataString);
    const userRole = userData.role?.toLowerCase();
    const checkRole = role.toLowerCase();

    return userRole === checkRole;
  } catch (error) {
    console.error('Erreur vérification rôle:', error);
    return false;
  }
};

/**
 * Obtenir l'utilisateur connecté de manière synchrone dans un composant
 * 
 * @returns {Promise<Object|null>}
 */
export const getCurrentUser = async () => {
  try {
    const userDataString = await AsyncStorage.getItem('userData');
    if (!userDataString) return null;
    
    return JSON.parse(userDataString);
  } catch (error) {
    console.error('Erreur récupération utilisateur:', error);
    return null;
  }
};

/**
 * Obtenir le token d'authentification
 * 
 * @returns {Promise<string|null>}
 */
export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('userToken');
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

/**
 * Obtenir les headers pour les requêtes API
 * 
 * @returns {Promise<Object>}
 */
export const getAuthHeaders = async () => {
  const token = await getAuthToken();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'Accept': 'application/json'
  };
};

export default {
  requireAuth,
  useCurrentUser,
  logout,
  hasRole,
  getCurrentUser,
  getAuthToken,
  getAuthHeaders
};