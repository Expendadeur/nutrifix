// frontend/src/services/NotificationService.js
// VERSION PRODUCTION - COMPLÈTE ET FONCTIONNELLE

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Clés de stockage
const STORAGE_KEYS = {
  PUSH_TOKEN: '@nutrifix_push_token',
  NOTIFICATION_SETTINGS: '@nutrifix_notification_settings',
  UNREAD_COUNT: '@nutrifix_unread_count',
};

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.navigationRef = null;
    this.onNotificationCallback = null;
    this.onBadgeUpdateCallback = null;
  }

  // ============================================
  // INITIALISATION
  // ============================================

  /**
   * Initialise le service de notifications
   * @param {Object} navigationRef - Référence du navigateur React Navigation
   * @param {Function} onNotificationCallback - Callback appelé lors d'une nouvelle notification
   * @param {Function} onBadgeUpdateCallback - Callback appelé lors d'un changement de badge
   */
  async initialize(navigationRef = null, onNotificationCallback = null, onBadgeUpdateCallback = null) {
    try {
      console.log('🔔 Initialisation des notifications...');

      this.navigationRef = navigationRef;
      this.onNotificationCallback = onNotificationCallback;
      this.onBadgeUpdateCallback = onBadgeUpdateCallback;

      // Configuration des notifications
      await this.configureNotifications();

      // Charger le token depuis le stockage
      const savedToken = await this.getStoredPushToken();
      if (savedToken) {
        this.expoPushToken = savedToken;
        console.log('📱 Token push chargé depuis le stockage');
      }

      // Enregistrer pour les push notifications (UNIQUEMENT SUR MOBILE)
      if (Platform.OS !== 'web') {
        await this.registerForPushNotifications();
      } else {
        console.log('⚠️ Push notifications non disponibles sur web (utilisez WebSocket)');
      }

      // Setup des listeners
      this.setupNotificationListeners();

      // Charger et afficher le badge count
      await this.loadAndUpdateBadge();

      console.log('✅ Notifications initialisées avec succès');
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation notifications:', error);
      return false;
    }
  }

  /**
   * Connecte le WebSocket pour les notifications temps réel
   * @param {number} userId - ID de l'utilisateur
   */
  async connectWebSocket(userId) {
    if (this.socketCleanup) {
      this.socketCleanup();
    }

    // Import dynamique pour éviter les cycles ou si le module n'est pas utilisé
    const { setupNotificationListener } = require('./notificationsSocket');

    if (!userId) {
      // Tenter de récupérer l'ID utilisateur stocké si non fourni
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userId = userData.id;
      }
    }

    if (userId) {
      this.socketCleanup = setupNotificationListener(userId, (notification) => {
        this.handleNotificationReceived({
          request: {
            content: {
              title: notification.titre,
              body: notification.message,
              data: notification
            }
          }
        });
      });
      console.log('🔌 WebSocket notifications connecté pour user:', userId);
    } else {
      console.warn('⚠️ Impossible de connecter WebSocket: userId manquant');
    }
  }

  /**
   * Configure le comportement des notifications
   */
  async configureNotifications() {
    await Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const priority = notification.request.content.data?.priority || 'normale';

        return {
          shouldShowAlert: true,
          shouldPlaySound: priority === 'urgente' || priority === 'haute',
          shouldSetBadge: true,
        };
      },
    });
  }

  // ============================================
  // ENREGISTREMENT PUSH NOTIFICATIONS
  // ============================================

  /**
   * Enregistre l'appareil pour les push notifications
   */
  async registerForPushNotifications() {
    try {
      // Vérifier si c'est un device physique
      if (!Device.isDevice) {
        console.warn('⚠️ Push notifications: émulateur détecté');
        return null;
      }

      // Demander la permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Permission de notification refusée');
        await this.saveNotificationSettings({ enabled: false, permissionDenied: true });
        return null;
      }

      // Obtenir le token Expo Push
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID || 'your-project-id',
      });

      this.expoPushToken = tokenData.data;
      console.log('📱 Expo Push Token obtenu:', this.expoPushToken);

      // Sauvegarder le token
      await this.savePushToken(this.expoPushToken);

      // Enregistrer le device sur le serveur
      await this.registerDevice(this.expoPushToken);

      // Configuration spécifique Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notifications NUTRIFIX',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E40AF',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // Canal pour les notifications urgentes
        await Notifications.setNotificationChannelAsync('urgent', {
          name: 'Notifications Urgentes',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#DC2626',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      await this.saveNotificationSettings({ enabled: true, permissionDenied: false });
      return this.expoPushToken;

    } catch (error) {
      console.error('❌ Erreur enregistrement push:', error);
      return null;
    }
  }

  /**
   * Enregistre le device sur le backend
   */
  async registerDevice(pushToken) {
    try {
      if (!pushToken) {
        console.warn('⚠️ Aucun push token à enregistrer');
        return false;
      }

      const deviceInfo = {
        pushToken,
        platform: Platform.OS,
        deviceId: Device.modelName || 'unknown',
        deviceBrand: Device.brand || 'unknown',
        osVersion: Device.osVersion || 'unknown',
      };

      const response = await api.post('/notifications/register-device', deviceInfo);

      if (response.data.success) {
        console.log('✅ Device enregistré sur le serveur');
        return true;
      } else {
        console.error('❌ Échec enregistrement device:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur registerDevice:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Désenregistre le device du serveur
   */
  async unregisterDevice() {
    try {
      if (!this.expoPushToken) {
        return true;
      }

      const response = await api.delete('/notifications/unregister-device', {
        data: { pushToken: this.expoPushToken }
      });

      if (response.data.success) {
        console.log('✅ Device désenregistré du serveur');
        await this.removePushToken();
        this.expoPushToken = null;
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur unregisterDevice:', error);
      return false;
    }
  }

  // ============================================
  // LISTENERS DE NOTIFICATIONS
  // ============================================

  /**
   * Configure les listeners de notifications
   */
  setupNotificationListeners() {
    // Listener pour les notifications reçues pendant que l'app est ouverte
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('🔔 Notification reçue:', notification.request.content);
        this.handleNotificationReceived(notification);
      }
    );

    // Listener pour les interactions utilisateur avec les notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('👆 Notification cliquée:', response.notification.request.content);
        this.handleNotificationResponse(response);
      }
    );

    console.log('✅ Listeners de notifications configurés');
  }

  /**
   * Gère la réception d'une notification (app au premier plan)
   */
  async handleNotificationReceived(notification) {
    const { title, body, data } = notification.request.content;

    // Incrémenter le badge
    await this.incrementBadge();

    // Appeler le callback si défini
    if (this.onNotificationCallback) {
      this.onNotificationCallback({
        title,
        body,
        data,
        isRead: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Afficher une notification locale si l'app est en arrière-plan
    if (data?.showInApp !== false) {
      await this.sendLocalNotification(title, body, data);
    }
  }

  /**
   * Gère la réponse à une notification (clic utilisateur)
   */
  handleNotificationResponse(response) {
    const data = response.notification.request.content.data;

    // Navigation basée sur le type de notification
    if (data?.type && this.navigationRef) {
      this.navigateFromNotification(data);
    }

    // Décrémenter le badge
    this.decrementBadge();
  }

  /**
   * Navigation intelligente basée sur le type de notification
   */
  navigateFromNotification(data) {
    const { type, reference_type, reference_id } = data;

    const navigationMap = {
      // Notifications de tâches et missions
      'mission': { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },
      'mission_terminee': { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },

      // Notifications RH
      'conge_approuve': { screen: 'RHPersonnel', params: { tab: 'conges' } },
      'conge_refuse': { screen: 'RHPersonnel', params: { tab: 'conges' } },
      'nouvelle_absence': { screen: 'RHPersonnel', params: { tab: 'absences' } },
      'salaire': { screen: 'RHPersonnel', params: { tab: 'salaires' } },

      // Notifications commerciales
      'nouvelle_commande': { screen: 'CommercialClients', params: { action: 'viewCommande', commandeId: reference_id } },
      'commande_livree': { screen: 'CommercialClients' },
      'paiement_recu': { screen: 'FinanceComptabilite', params: { tab: 'paiements' } },

      // Notifications stock et agriculture
      'stock_faible': { screen: 'FlouteAgricultureElevage', params: { tab: 'agriculture' } },
      'recolte_prevue': { screen: 'FlouteAgricultureElevage', params: { tab: 'agriculture' } },

      // Notifications élevage
      'naissance': { screen: 'FlouteAgricultureElevage', params: { tab: 'elevage' } },
      'deces': { screen: 'FlouteAgricultureElevage', params: { tab: 'elevage' } },
      'vaccination_prevue': { screen: 'FlouteAgricultureElevage', params: { tab: 'elevage' } },

      // Notifications maintenance
      'maintenance_prevue': { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },
      'maintenance_urgente': { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },
      'assurance_expire': { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },

      // Notifications financières
      'facture': { screen: 'FinanceComptabilite', params: { tab: 'factures' } },
      'facture_impayee': { screen: 'FinanceComptabilite', params: { tab: 'factures' } },
      'budget_depasse': { screen: 'FinanceComptabilite', params: { tab: 'budget' } },

      // Notifications système
      'alerte_systeme': { screen: 'TraceabiliteParametres', params: { tab: 'systeme' } },
      'sauvegarde': { screen: 'TraceabiliteParametres', params: { tab: 'systeme' } },
    };

    const navigation = navigationMap[type] || navigationMap[reference_type];

    if (navigation && this.navigationRef?.current) {
      try {
        this.navigationRef.current.navigate(navigation.screen, navigation.params);
        console.log('✅ Navigation vers:', navigation.screen);
      } catch (error) {
        console.error('❌ Erreur navigation:', error);
      }
    } else {
      // Navigation par défaut vers la liste des notifications
      if (this.navigationRef?.current) {
        this.navigationRef.current.navigate('Notifications');
      }
    }
  }

  // ============================================
  // NOTIFICATIONS LOCALES
  // ============================================

  /**
   * Envoie une notification locale
   */
  async sendLocalNotification(title, body, data = {}) {
    try {
      const channelId = data.priority === 'urgente' ? 'urgent' : 'default';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: data.priority === 'urgente'
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
          badge: await this.getBadgeCount() + 1,
        },
        trigger: null, // Immédiatement
      });

      console.log('✅ Notification locale envoyée');
    } catch (error) {
      console.error('❌ Erreur notification locale:', error);
    }
  }

  /**
   * Planifie une notification locale
   */
  async scheduleLocalNotification(title, body, triggerDate, data = {}) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: {
          date: new Date(triggerDate),
        },
      });

      console.log('✅ Notification planifiée:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Erreur planification notification:', error);
      return null;
    }
  }

  /**
   * Annule une notification planifiée
   */
  async cancelScheduledNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('✅ Notification annulée:', notificationId);
    } catch (error) {
      console.error('❌ Erreur annulation notification:', error);
    }
  }

  /**
   * Annule toutes les notifications planifiées
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ Toutes les notifications annulées');
    } catch (error) {
      console.error('❌ Erreur annulation notifications:', error);
    }
  }

  // ============================================
  // GESTION DU BADGE
  // ============================================

  /**
   * Obtient le badge count
   */
  async getBadgeCount() {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count || 0;
    } catch (error) {
      console.error('❌ Erreur getBadgeCount:', error);
      return 0;
    }
  }

  /**
   * Définit le badge count
   */
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
      await AsyncStorage.setItem(STORAGE_KEYS.UNREAD_COUNT, count.toString());

      if (this.onBadgeUpdateCallback) {
        this.onBadgeUpdateCallback(count);
      }

      console.log('✅ Badge mis à jour:', count);
    } catch (error) {
      console.error('❌ Erreur setBadgeCount:', error);
    }
  }

  /**
   * Incrémente le badge
   */
  async incrementBadge() {
    try {
      const currentCount = await this.getBadgeCount();
      await this.setBadgeCount(currentCount + 1);
    } catch (error) {
      console.error('❌ Erreur incrementBadge:', error);
    }
  }

  /**
   * Décrémente le badge
   */
  async decrementBadge() {
    try {
      const currentCount = await this.getBadgeCount();
      if (currentCount > 0) {
        await this.setBadgeCount(currentCount - 1);
      }
    } catch (error) {
      console.error('❌ Erreur decrementBadge:', error);
    }
  }

  /**
   * Réinitialise le badge
   */
  async clearBadge() {
    try {
      await this.setBadgeCount(0);
      console.log('✅ Badge réinitialisé');
    } catch (error) {
      console.error('❌ Erreur clearBadge:', error);
    }
  }

  /**
   * Charge et met à jour le badge depuis le serveur
   */
  async loadAndUpdateBadge() {
    try {
      const response = await api.get('/notifications/stats');
      if (response.data.success) {
        const unreadCount = response.data.data.unread || 0;
        await this.setBadgeCount(unreadCount);
        return unreadCount;
      }
    } catch (error) {
      console.error('❌ Erreur loadAndUpdateBadge:', error);
    }
    return 0;
  }

  // ============================================
  // STOCKAGE LOCAL
  // ============================================

  /**
   * Sauvegarde le push token
   */
  async savePushToken(token) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
    } catch (error) {
      console.error('❌ Erreur savePushToken:', error);
    }
  }

  /**
   * Récupère le push token sauvegardé
   */
  async getStoredPushToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch (error) {
      console.error('❌ Erreur getStoredPushToken:', error);
      return null;
    }
  }

  /**
   * Supprime le push token sauvegardé
   */
  async removePushToken() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch (error) {
      console.error('❌ Erreur removePushToken:', error);
    }
  }

  /**
   * Sauvegarde les paramètres de notifications
   */
  async saveNotificationSettings(settings) {
    try {
      const current = await this.getNotificationSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATION_SETTINGS,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('❌ Erreur saveNotificationSettings:', error);
    }
  }

  /**
   * Récupère les paramètres de notifications
   */
  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      return settings ? JSON.parse(settings) : {
        enabled: true,
        sound: true,
        vibration: true,
        badge: true,
        permissionDenied: false,
      };
    } catch (error) {
      console.error('❌ Erreur getNotificationSettings:', error);
      return {
        enabled: true,
        sound: true,
        vibration: true,
        badge: true,
        permissionDenied: false,
      };
    }
  }

  // ============================================
  // PERMISSIONS
  // ============================================

  /**
   * Vérifie le statut des permissions
   */
  async checkPermissions() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        status,
      };
    } catch (error) {
      console.error('❌ Erreur checkPermissions:', error);
      return { granted: false, status: 'undetermined' };
    }
  }

  /**
   * Demande les permissions de notifications
   */
  async requestPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status === 'granted') {
        await this.saveNotificationSettings({ enabled: true, permissionDenied: false });
        await this.registerForPushNotifications();
        return true;
      } else {
        await this.saveNotificationSettings({ enabled: false, permissionDenied: true });
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur requestPermissions:', error);
      return false;
    }
  }

  // ============================================
  // NETTOYAGE
  // ============================================

  /**
   * Nettoie les listeners et ressources
   */
  cleanup() {
    try {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
        this.notificationListener = null;
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
        this.responseListener = null;
      }
      console.log('✅ Listeners nettoyés');
    } catch (error) {
      console.error('❌ Erreur cleanup:', error);
    }
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  /**
   * Obtient le token push actuel
   */
  getPushToken() {
    return this.expoPushToken;
  }

  /**
   * Vérifie si les notifications sont activées
   */
  async isEnabled() {
    const settings = await this.getNotificationSettings();
    return settings.enabled && !settings.permissionDenied;
  }
}

export default new NotificationService();