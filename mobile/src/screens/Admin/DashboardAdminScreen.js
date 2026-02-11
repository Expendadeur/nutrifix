// frontend/src/screens/admin/DashboardAdminScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
  StatusBar,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Avatar,
  IconButton,
  Chip,
  ActivityIndicator,
  DataTable,
  Button,
  Snackbar,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { requireAuth } from '../../utils/authGuard';

// Configuration API
const API_URL = 'http://localhost:5000/api';

// ============================================
// PALETTE DE COULEURS
// ============================================

const COLORS = {
  primary: '#1E40AF',
  primaryDark: '#1E3A8A',
  primaryLight: '#3B82F6',
  success: '#16A34A',
  successMedium: '#22C55E',
  successLight: '#4ADE80',
  danger: '#DC2626',
  dangerMedium: '#EF4444',
  dangerLight: '#F87171',
  warning: '#EA580C',
  warningMedium: '#F97316',
  purple: '#7C3AED',
  purpleMedium: '#8B5CF6',
  black: '#000000',
  blackSoft: '#1F2937',
  blackLight: '#374151',
  white: '#FFFFFF',
  grayBg: '#F3F4F6',
  grayCard: '#FAFAFA',
  grayBorder: '#E5E7EB',
  grayMedium: '#9CA3AF',
  grayDark: '#6B7280',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textLight: '#9CA3AF',
  textWhite: '#FFFFFF',
  successBg: 'rgba(22, 163, 74, 0.10)',
  dangerBg: 'rgba(220, 38, 38, 0.10)',
  warningBg: 'rgba(234, 88, 12, 0.10)',
  infoBg: 'rgba(59, 130, 246, 0.10)',
  purpleBg: 'rgba(124, 58, 237, 0.10)',
};

// ============================================
// UTILITAIRES DE VALIDATION
// ============================================

const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const safeGetString = (value, defaultValue = '') => {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
};

const safeGetArray = (value, defaultValue = []) => {
  if (!Array.isArray(value)) return defaultValue;
  return value;
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const DashboardAdminScreen = ({ navigation }) => {
  const { user, isLoading } = requireAuth(navigation, { role: 'admin' });


  // ============================================
  // ÉTATS
  // ============================================

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [error, setError] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // États pour les demandes de paiement
  const [demandesPaiement, setDemandesPaiement] = useState([]);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [selectedDemande, setSelectedDemande] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [commentaireValidation, setCommentaireValidation] = useState('');

  // États pour les notifications
  const [notificationDialogVisible, setNotificationDialogVisible] = useState(false);
  const [notificationSubject, setNotificationSubject] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState('all'); // 'all' or specific email (future)

  const { width: windowWidth } = useWindowDimensions();

  // ============================================
  // CONFIGURATION RESPONSIVE
  // ============================================

  const deviceType = useMemo(() => {
    const isWeb = Platform.OS === 'web';
    if (windowWidth >= 1440) return { type: 'desktop', cols: 6, isWeb };
    if (windowWidth >= 1024) return { type: 'laptop', cols: 4, isWeb };
    if (windowWidth >= 768) return { type: 'tablet', cols: 3, isWeb };
    if (windowWidth >= 480) return { type: 'mobile-landscape', cols: 2, isWeb };
    return { type: 'mobile', cols: 2, isWeb };
  }, [windowWidth]);

  const spacing = useMemo(() => {
    switch (deviceType.type) {
      case 'desktop': return { outer: 24, inner: 16, card: 20 };
      case 'laptop': return { outer: 20, inner: 14, card: 18 };
      case 'tablet': return { outer: 16, inner: 12, card: 16 };
      default: return { outer: 12, inner: 10, card: 14 };
    }
  }, [deviceType.type]);

  // ============================================
  // FONCTIONS UTILITAIRES API
  // ============================================

  const getAuthToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token;
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return null;
    }
  }, []);

  const createApiInstance = useCallback(async () => {
    const token = await getAuthToken();
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      timeout: 30000 // Augmenté à 30 secondes
    });
  }, [getAuthToken]);

  // ============================================
  // FONCTIONS UTILITAIRES LOCALES
  // ============================================

  const formatMontantLocal = useCallback((montant) => {
    const value = safeParseFloat(montant, 0);
    return new Intl.NumberFormat('fr-BI', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' BIF';
  }, []);

  const formatNumberLocal = useCallback((number) => {
    const value = safeParseInt(number, 0);
    return new Intl.NumberFormat('fr-BI').format(value);
  }, []);

  const getPeriodLabelLocal = useCallback((period) => {
    const labels = {
      day: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois',
      year: 'Cette année'
    };
    return labels[period] || labels.month;
  }, []);

  const isValidPeriodLocal = useCallback((period) => {
    return ['day', 'week', 'month', 'year'].includes(period);
  }, []);

  const getMoisNom = useCallback((mois) => {
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return moisNoms[mois - 1] || 'Inconnu';
  }, []);

  // ============================================
  // FONCTIONS DE CHARGEMENT
  // ============================================

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Chargement dashboard pour période:', selectedPeriod);

      const api = await createApiInstance();
      const response = await api.get('/admin/dashboard', {
        params: { period: selectedPeriod }
      });

      console.log('✅ Données dashboard reçues:', response.data);

      if (response.data && response.data.success) {
        // Validation et nettoyage des données
        const cleanData = {
          kpis: response.data.data?.kpis || {
            chiffre_affaires: { valeur: 0, tendance: 0, evolution: 'stable', precedent: 0 },
            benefice_net: { valeur: 0, recettes: 0, depenses: 0, evolution: 'positif', tendance: 0 },
            employes: { total: 0, actifs: 0 },
            vehicules: { total: 0, actifs: 0, disponibles: 0 },
            animaux: { total: 0, vivants: 0 },
            commandes: { en_cours: 0, livrees: 0 }
          },
          alertes: safeGetArray(response.data.data?.alertes, []),
          charts: response.data.data?.charts || {
            evolutionCA: { labels: [], datasets: [{ data: [] }] },
            repartitionRevenus: []
          },
          topPerformers: response.data.data?.topPerformers || { clients: [], produits: [] },
          moduleStats: safeGetArray(response.data.data?.moduleStats, []),
          period: response.data.data?.period || selectedPeriod,
          lastUpdate: response.data.data?.lastUpdate || new Date()
        };

        setDashboardData(cleanData);
      } else {
        throw new Error(response.data?.message || 'Erreur lors du chargement');
      }

    } catch (err) {
      console.error('❌ Erreur dashboard:', err);

      let errorMessage = 'Une erreur est survenue lors du chargement des données';

      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Délai d\'attente dépassé. Vérifiez votre connexion.';
      } else if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        } else if (err.response.status === 403) {
          errorMessage = 'Accès refusé. Permissions insuffisantes.';
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.request) {
        errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setSnackbarVisible(true);

      // Données par défaut en cas d'erreur
      setDashboardData({
        kpis: {
          chiffre_affaires: { valeur: 0, tendance: 0, evolution: 'stable', precedent: 0 },
          benefice_net: { valeur: 0, recettes: 0, depenses: 0, evolution: 'positif', tendance: 0 },
          employes: { total: 0, actifs: 0 },
          vehicules: { total: 0, actifs: 0, disponibles: 0 },
          animaux: { total: 0, vivants: 0 },
          commandes: { en_cours: 0, livrees: 0 }
        },
        alertes: [],
        charts: {
          evolutionCA: { labels: [], datasets: [{ data: [] }] },
          repartitionRevenus: []
        },
        topPerformers: { clients: [], produits: [] },
        moduleStats: [],
        period: selectedPeriod,
        lastUpdate: new Date()
      });

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, createApiInstance]);

  const loadDemandesPaiement = useCallback(async () => {
    try {
      setLoadingDemandes(true);

      const api = await createApiInstance();
      const response = await api.get('/admin/demandes-paiement-salaire', {
        params: {
          statut: 'en_attente',
          page: 1,
          limit: 5
        }
      });

      console.log('✅ Demandes paiement reçues:', response.data);

      if (response.data && response.data.success) {
        setDemandesPaiement(safeGetArray(response.data.data?.demandes, []));
      }

    } catch (error) {
      console.error('❌ Erreur chargement demandes:', error);
      setDemandesPaiement([]);
    } finally {
      setLoadingDemandes(false);
    }
  }, [createApiInstance]);

  const handleValiderDemande = useCallback(async (demande) => {
    if (!demande) return;

    try {
      Alert.alert(
        'Confirmer la validation',
        `Valider le paiement de ${formatMontantLocal(demande.montant)} pour ${safeGetString(demande.employe_nom, 'Employé')} ?\n\nUn code de vérification sera envoyé à l'employé.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Valider',
            onPress: async () => {
              try {
                const api = await createApiInstance();
                const response = await api.post(
                  `/admin/demandes-paiement-salaire/${demande.id}/valider`,
                  { commentaire: commentaireValidation }
                );

                if (response.data && response.data.success) {
                  Alert.alert(
                    'Succès',
                    `Paiement validé avec succès.\n\nCode de vérification: ${response.data.data?.codeVerification || 'N/A'}\n\nCe code a été envoyé à l'employé.`,
                    [{
                      text: 'OK',
                      onPress: () => {
                        setCommentaireValidation('');
                        loadDemandesPaiement();
                        loadDashboard();
                      }
                    }]
                  );
                } else {
                  throw new Error(response.data?.message || 'Erreur de validation');
                }

              } catch (error) {
                console.error('Erreur validation:', error);
                Alert.alert(
                  'Erreur',
                  error.response?.data?.message || error.message || 'Impossible de valider la demande'
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erreur validation:', error);
    }
  }, [formatMontantLocal, commentaireValidation, createApiInstance, loadDemandesPaiement, loadDashboard]);

  const handleRejeterDemande = useCallback(async (demande) => {
    if (!demande) return;
    setSelectedDemande(demande);
    setRejectDialogVisible(true);
  }, []);

  const confirmerRejet = useCallback(async () => {
    if (!motifRejet.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un motif de rejet');
      return;
    }

    if (!selectedDemande) return;

    try {
      const api = await createApiInstance();
      const response = await api.post(
        `/admin/demandes-paiement-salaire/${selectedDemande.id}/rejeter`,
        {
          motif_rejet: motifRejet,
          commentaire: commentaireValidation
        }
      );

      if (response.data && response.data.success) {
        setRejectDialogVisible(false);
        setMotifRejet('');
        setCommentaireValidation('');
        Alert.alert('Succès', 'Demande rejetée avec succès');
        loadDemandesPaiement();
        loadDashboard();
      } else {
        throw new Error(response.data?.message || 'Erreur de rejet');
      }

    } catch (error) {
      console.error('Erreur rejet:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || error.message || 'Impossible de rejeter la demande'
      );
    }
  }, [selectedDemande, motifRejet, commentaireValidation, createApiInstance, loadDemandesPaiement, loadDashboard]);

  const handleOpenNotificationDialog = useCallback(() => {
    setNotificationSubject('');
    setNotificationMessage('');
    setNotificationTarget('all');
    setNotificationDialogVisible(true);
  }, []);

  const handleSendNotification = useCallback(async () => {
    if (!notificationSubject.trim() || !notificationMessage.trim()) {
      Alert.alert('Erreur', 'Le sujet et le message sont obligatoires');
      return;
    }

    try {
      setNotificationLoading(true);
      const api = await createApiInstance();
      const response = await api.post('/admin/notify', {
        recipients: notificationTarget,
        subject: notificationSubject,
        message: notificationMessage
      });

      if (response.data && response.data.success) {
        setNotificationDialogVisible(false);
        Alert.alert('Succès', response.data.message || 'Notification envoyée avec succès');
      } else {
        throw new Error(response.data?.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Erreur notification:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || error.message || 'Impossible d\'envoyer la notification'
      );
    } finally {
      setNotificationLoading(false);
    }
  }, [notificationSubject, notificationMessage, notificationTarget, createApiInstance]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadDashboard(), loadDemandesPaiement()]);
  }, [loadDashboard, loadDemandesPaiement]);

  const handlePeriodChange = useCallback((newPeriod) => {
    if (isValidPeriodLocal(newPeriod)) {
      console.log('📅 Changement période:', newPeriod);
      setSelectedPeriod(newPeriod);
    } else {
      console.warn('⚠️ Période invalide:', newPeriod);
      setError('Période invalide sélectionnée');
      setSnackbarVisible(true);
    }
  }, [isValidPeriodLocal]);

  // ============================================
  // HANDLERS DE NAVIGATION
  // ============================================

  const handleNavigateToNotifications = useCallback(() => {
    try {
      console.log('📬 Navigation vers Notifications');
      if (navigation && navigation.navigate) {
        navigation.navigate('Notifications');
      } else {
        console.error('Navigation non disponible');
        Alert.alert('Erreur', 'Impossible de naviguer vers les notifications');
      }
    } catch (error) {
      console.error('Erreur navigation notifications:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la navigation');
    }
  }, [navigation]);

  const handleNavigateToSettings = useCallback(() => {
    try {
      console.log('⚙️ Navigation vers Paramètres');
      if (navigation && navigation.navigate) {
        navigation.navigate('TraceabiliteParametres', { tab: 'parametres' });
      } else {
        console.error('Navigation non disponible');
        Alert.alert('Erreur', 'Impossible de naviguer vers les paramètres');
      }
    } catch (error) {
      console.error('Erreur navigation paramètres:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la navigation');
    }
  }, [navigation]);

  const handleAlertClick = useCallback((alert) => {
    if (!alert) return;

    try {
      console.log('🔔 Clic sur alerte:', alert.type);

      const navigationMap = {
        maintenance: { screen: 'Flotte', params: { tab: 'flotte' } },
        stock: { screen: 'Flotte', params: { tab: 'agriculture' } },
        salaire: { screen: 'RH' },
        paiement: { screen: 'Finance' },
        conges: { screen: 'RH', params: { tab: 'conges' } },
        assurance: { screen: 'Flotte', params: { tab: 'flotte' } },
        notification: { action: handleOpenNotificationDialog } // Action spéciale pour notification
      };

      const nav = navigationMap[alert.type];
      if (nav) {
        if (nav.action) {
          nav.action();
        } else if (navigation && navigation.navigate) {
          navigation.navigate(nav.screen, nav.params || {});
        }
      } else {
        console.warn('Navigation non configurée pour:', alert.type);
      }
    } catch (error) {
      console.error('Erreur navigation alerte:', error);
      Alert.alert('Erreur', 'Impossible de naviguer vers cette section');
    }
  }, [navigation, handleOpenNotificationDialog]);

  const handleQuickAction = useCallback((screen, params = {}) => {
    if (screen === 'OPEN_NOTIFICATION_DIALOG') {
      handleOpenNotificationDialog();
      return;
    }

    try {
      console.log('⚡ Action rapide:', screen, params);
      if (navigation && navigation.navigate) {
        navigation.navigate(screen, params);
      } else {
        console.error('Navigation non disponible');
        Alert.alert('Erreur', 'Impossible de naviguer');
      }
    } catch (error) {
      console.error('Erreur action rapide:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  }, [navigation, handleOpenNotificationDialog]);

  // ============================================
  // CALCULS DYNAMIQUES DE DIMENSIONS
  // ============================================

  const getKPICardWidth = useCallback(() => {
    const cols = deviceType.cols;
    const totalSpacing = spacing.outer * 2 + spacing.inner * (cols - 1);
    const availableWidth = windowWidth - totalSpacing;
    return availableWidth / cols;
  }, [deviceType.cols, spacing, windowWidth]);

  const getChartWidth = useCallback(() => {
    if (deviceType.type === 'desktop' || deviceType.type === 'laptop') {
      return (windowWidth - spacing.outer * 3 - spacing.inner) / 2;
    }
    return windowWidth - spacing.outer * 2 - 40;
  }, [deviceType.type, windowWidth, spacing]);

  const getQuickActionCols = useCallback(() => {
    if (deviceType.type === 'desktop') return 6;
    if (deviceType.type === 'laptop') return 4;
    if (deviceType.type === 'tablet') return 3;
    return 3;
  }, [deviceType.type]);

  // ============================================
  // EFFETS
  // ============================================

  useEffect(() => {
    loadDashboard();
    loadDemandesPaiement();
  }, [selectedPeriod]);

  // ============================================
  // EARLY RETURN - MOVED AFTER ALL HOOKS
  // ============================================

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // ============================================
  // COMPOSANTS DE RENDU
  // ============================================

  const renderKPICard = (title, value, icon, color, trend, iconFamily = 'MaterialIcons') => {
    const IconComponent = iconFamily === 'FontAwesome5' ? FontAwesome5 : MaterialIcons;
    const cardWidth = getKPICardWidth();

    const getTrendColorLocal = (trendValue) => {
      const trendNum = safeParseFloat(trendValue, 0);
      if (trendNum === 0) return COLORS.grayMedium;
      return trendNum > 0 ? COLORS.success : COLORS.danger;
    };

    const safeTrend = safeParseFloat(trend, null);

    return (
      <Card style={[styles.kpiCard, { width: cardWidth, marginBottom: spacing.inner }]}>
        <Card.Content style={{ padding: spacing.card }}>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIcon, { backgroundColor: color + '20' }]}>
              <IconComponent name={icon} size={deviceType.type === 'mobile' ? 24 : 28} color={color} />
            </View>
            {safeTrend !== null && (
              <View style={[styles.trendContainer, {
                backgroundColor: getTrendColorLocal(safeTrend) + '20'
              }]}>
                <MaterialIcons
                  name={safeTrend > 0 ? 'trending-up' : safeTrend < 0 ? 'trending-down' : 'trending-flat'}
                  size={deviceType.type === 'mobile' ? 14 : 16}
                  color={getTrendColorLocal(safeTrend)}
                />
                <Text style={[styles.trendText, {
                  color: getTrendColorLocal(safeTrend),
                  fontSize: deviceType.type === 'mobile' ? 11 : 13
                }]}>
                  {Math.abs(safeTrend).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.kpiTitle, {
            fontSize: deviceType.type === 'mobile' ? 12 : 13
          }]}>
            {title}
          </Text>
          <Text style={[styles.kpiValue, {
            fontSize: deviceType.type === 'mobile' ? 20 : deviceType.type === 'tablet' ? 22 : 24
          }]}>
            {value}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  const renderAlertCard = (alert) => {
    if (!alert) return null;

    return (
      <TouchableOpacity
        key={alert.id}
        style={[styles.alertCard, { padding: spacing.card }]}
        onPress={() => handleAlertClick(alert)}
        activeOpacity={0.7}
      >
        <View style={styles.alertLeft}>
          <View style={[styles.alertIcon, { backgroundColor: (alert.color || COLORS.grayMedium) + '20' }]}>
            <MaterialIcons name={alert.icon || 'info'} size={24} color={alert.color || COLORS.grayMedium} />
          </View>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, {
              fontSize: deviceType.type === 'mobile' ? 14 : 15
            }]}>
              {safeGetString(alert.title, 'Alerte')}
            </Text>
            <Text style={[styles.alertDescription, {
              fontSize: deviceType.type === 'mobile' ? 12 : 13
            }]}>
              {safeGetString(alert.description, '')}
            </Text>
            <Text style={[styles.alertTime, {
              fontSize: deviceType.type === 'mobile' ? 11 : 12
            }]}>
              {safeGetString(alert.time, '')}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={COLORS.grayMedium} />
      </TouchableOpacity>
    );
  };

  const renderQuickAction = (title, icon, color, screen, params = {}) => {
    const cols = getQuickActionCols();
    const totalSpacing = spacing.outer * 2 + spacing.inner * (cols - 1);
    const actionWidth = (windowWidth - totalSpacing) / cols;

    return (
      <TouchableOpacity
        key={title}
        style={[styles.quickActionCard, {
          width: actionWidth,
          marginBottom: spacing.inner,
          padding: deviceType.type === 'mobile' ? 14 : 16
        }]}
        onPress={() => handleQuickAction(screen, params)}
        activeOpacity={0.7}
      >
        <View style={[styles.quickActionIcon, {
          backgroundColor: color + '20',
          width: deviceType.type === 'mobile' ? 56 : 64,
          height: deviceType.type === 'mobile' ? 56 : 64,
          borderRadius: deviceType.type === 'mobile' ? 28 : 32
        }]}>
          <MaterialIcons name={icon} size={deviceType.type === 'mobile' ? 28 : 32} color={color} />
        </View>
        <Text style={[styles.quickActionText, {
          fontSize: deviceType.type === 'mobile' ? 12 : 13
        }]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDemandePaiement = (demande) => {
    if (!demande) return null;

    return (
      <Card key={demande.id} style={[styles.demandeCard, { padding: spacing.card, marginBottom: spacing.inner }]}>
        <View style={styles.demandeHeader}>
          <View style={styles.demandeLeft}>
            <Avatar.Text
              size={48}
              label={safeGetString(demande.employe_nom, 'XX').substring(0, 2).toUpperCase()}
              style={{ backgroundColor: COLORS.primaryLight }}
            />
            <View style={styles.demandeInfo}>
              <Text style={styles.demandeNom}>{safeGetString(demande.employe_nom, 'Employé')}</Text>
              <Text style={styles.demandeMatricule}>{safeGetString(demande.employe_matricule, 'N/A')}</Text>
              <Text style={styles.demandePeriode}>
                {getMoisNom(safeParseInt(demande.mois, 1))} {safeParseInt(demande.annee, new Date().getFullYear())}
              </Text>
              <Text style={styles.demandeDepartement}>{safeGetString(demande.departement_nom, '')}</Text>
            </View>
          </View>
          <View style={styles.demandeRight}>
            <Text style={styles.demandeMontant}>{formatMontantLocal(demande.montant)}</Text>
            <Chip
              style={{ backgroundColor: COLORS.warningBg, marginTop: 4 }}
              textStyle={{ color: COLORS.warning, fontSize: 11, fontWeight: '700' }}
            >
              {safeParseInt(demande.jours_attente, 0)} jour{safeParseInt(demande.jours_attente, 0) > 1 ? 's' : ''}
            </Chip>
          </View>
        </View>

        <View style={styles.demandeDetails}>
          <View style={styles.detailRow}>
            <MaterialIcons name="work" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{safeGetString(demande.type_employe, 'N/A')}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="email" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{safeGetString(demande.employe_email, 'N/A')}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="phone" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{safeGetString(demande.employe_telephone, 'N/A')}</Text>
          </View>
        </View>

        <View style={styles.demandeActions}>
          <Button
            mode="contained"
            onPress={() => handleValiderDemande(demande)}
            style={[styles.actionButton, { backgroundColor: COLORS.success }]}
            labelStyle={{ fontSize: 13, fontWeight: '700' }}
            icon="check-circle"
          >
            Valider
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleRejeterDemande(demande)}
            style={styles.actionButton}
            textColor={COLORS.danger}
            labelStyle={{ fontSize: 13, fontWeight: '700' }}
            icon="close-circle"
          >
            Rejeter
          </Button>
        </View>
      </Card>
    );
  };

  // ============================================
  // CONFIGURATION DES GRAPHIQUES
  // ============================================

  const chartConfig = {
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
    style: { borderRadius: 12 },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: COLORS.primaryLight
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: COLORS.grayBorder,
      strokeWidth: 1
    }
  };

  // ============================================
  // CONFIGURATIONS LAYOUT
  // ============================================

  const showChartsInRow = deviceType.type === 'desktop' || deviceType.type === 'laptop';
  const showPerformersInRow = deviceType.type === 'desktop' || deviceType.type === 'laptop';

  const hasEvolutionCAData = dashboardData?.charts?.evolutionCA?.datasets?.[0]?.data?.length > 0;
  const hasRepartitionData = dashboardData?.charts?.repartitionRevenus?.length > 0;

  // ============================================
  // ÉCRAN DE CHARGEMENT
  // ============================================

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
      </View>
    );
  }

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primary}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.outer * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* EN-TÊTE */}
        <View style={[styles.header, { padding: spacing.outer }]}>
          <View style={{ flex: 1 }}>
            <Title style={[styles.headerTitle, {
              fontSize: deviceType.type === 'mobile' ? 24 : 28
            }]}>
              Tableau de Bord
            </Title>
            <Text style={[styles.headerSubtitle, {
              fontSize: deviceType.type === 'mobile' ? 13 : 14
            }]}>
              {getPeriodLabelLocal(selectedPeriod)} • NUTRIFIX
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleNavigateToNotifications}
              activeOpacity={0.7}
            >
              <MaterialIcons name="notifications" size={deviceType.type === 'mobile' ? 24 : 26} color={COLORS.white} />
              {dashboardData?.alertes?.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{dashboardData.alertes.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleNavigateToSettings}
              activeOpacity={0.7}
            >
              <MaterialIcons name="settings" size={deviceType.type === 'mobile' ? 24 : 26} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTRES DE PÉRIODE */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodFilter}
          contentContainerStyle={{ paddingHorizontal: spacing.outer }}
        >
          {['day', 'week', 'month', 'year'].map(period => (
            <Chip
              key={period}
              selected={selectedPeriod === period}
              onPress={() => handlePeriodChange(period)}
              style={[
                styles.periodChip,
                { marginRight: spacing.inner },
                selectedPeriod === period && styles.periodChipSelected
              ]}
              selectedColor={COLORS.white}
              textStyle={{
                fontSize: deviceType.type === 'mobile' ? 13 : 14,
                color: selectedPeriod === period ? COLORS.white : COLORS.textSecondary,
                fontWeight: selectedPeriod === period ? '700' : '500'
              }}
            >
              {getPeriodLabelLocal(period)}
            </Chip>
          ))}
        </ScrollView>

        {/* KPIs PRINCIPAUX */}
        <View style={[styles.kpiContainer, {
          padding: spacing.outer,
          gap: spacing.inner,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }]}>
          {renderKPICard(
            'Chiffre d\'Affaires',
            formatMontantLocal(dashboardData?.kpis?.chiffre_affaires?.valeur),
            'attach-money',
            COLORS.success,
            dashboardData?.kpis?.chiffre_affaires?.tendance
          )}
          {renderKPICard(
            'Bénéfice Net',
            formatMontantLocal(dashboardData?.kpis?.benefice_net?.valeur),
            'trending-up',
            COLORS.success,
            dashboardData?.kpis?.benefice_net?.tendance
          )}
          {renderKPICard(
            'Employés Actifs',
            `${safeParseInt(dashboardData?.kpis?.employes?.actifs, 0)}/${safeParseInt(dashboardData?.kpis?.employes?.total, 0)}`,
            'people',
            COLORS.primaryLight,
            null
          )}
          {renderKPICard(
            'Véhicules',
            `${safeParseInt(dashboardData?.kpis?.vehicules?.actifs, 0)}/${safeParseInt(dashboardData?.kpis?.vehicules?.total, 0)}`,
            'local-shipping',
            COLORS.warning,
            null
          )}
          {renderKPICard(
            'Animaux',
            `${safeParseInt(dashboardData?.kpis?.animaux?.vivants, 0)}`,
            'cow',
            COLORS.purple,
            null,
            'FontAwesome5'
          )}
          {renderKPICard(
            'Commandes',
            `${safeParseInt(dashboardData?.kpis?.commandes?.en_cours, 0)}`,
            'shopping-cart',
            COLORS.danger,
            null
          )}
        </View>

        {/* DEMANDES DE PAIEMENT SALAIRE */}
        <Card style={[styles.demandesCard, {
          marginHorizontal: spacing.outer,
          marginBottom: spacing.outer
        }]}>
          <Card.Content style={{ padding: spacing.card }}>
            <View style={styles.sectionHeader}>
              <View>
                <Title style={[styles.sectionTitle, {
                  fontSize: deviceType.type === 'mobile' ? 18 : 20
                }]}>
                  Demandes de Paiement
                </Title>
                <Text style={styles.sectionSubtitle}>
                  {demandesPaiement.length} demande{demandesPaiement.length > 1 ? 's' : ''} en attente
                </Text>
              </View>
              <Button
                mode="text"
                onPress={() => navigation.navigate('RHPersonnel', { tab: 'salaires' })}
                textColor={COLORS.primaryLight}
                labelStyle={{ fontSize: deviceType.type === 'mobile' ? 13 : 14, fontWeight: '600' }}
              >
                Voir tout
              </Button>
            </View>

            {loadingDemandes ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : demandesPaiement.length > 0 ? (
              demandesPaiement.map(demande => renderDemandePaiement(demande))
            ) : (
              <View style={styles.noDemandesContainer}>
                <MaterialIcons name="check-circle" size={64} color={COLORS.success} />
                <Text style={styles.noDemandesText}>Aucune demande en attente</Text>
                <Text style={styles.noDemandesSubtext}>
                  Toutes les demandes de paiement ont été traitées
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* GRAPHIQUES */}
        <View style={[
          styles.chartsContainer,
          {
            padding: spacing.outer,
            flexDirection: showChartsInRow ? 'row' : 'column',
            gap: spacing.inner
          }
        ]}>
          {/* Évolution CA */}
          <Card style={[styles.chartCard, showChartsInRow && { flex: 1 }]}>
            <Card.Content style={{ padding: spacing.card }}>
              <Title style={[styles.chartTitle, {
                fontSize: deviceType.type === 'mobile' ? 16 : 18
              }]}>
                Évolution Chiffre d'Affaires
              </Title>
              {hasEvolutionCAData ? (
                <LineChart
                  data={dashboardData.charts.evolutionCA}
                  width={getChartWidth()}
                  height={deviceType.type === 'mobile' ? 220 : 260}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <MaterialIcons name="show-chart" size={64} color={COLORS.grayMedium} />
                  <Text style={styles.noDataText}>Aucune donnée disponible</Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Répartition Revenus */}
          <Card style={[styles.chartCard, showChartsInRow && { flex: 1 }]}>
            <Card.Content style={{ padding: spacing.card }}>
              <Title style={[styles.chartTitle, {
                fontSize: deviceType.type === 'mobile' ? 16 : 18
              }]}>
                Répartition Revenus
              </Title>
              {hasRepartitionData ? (
                <PieChart
                  data={dashboardData.charts.repartitionRevenus}
                  width={getChartWidth()}
                  height={deviceType.type === 'mobile' ? 220 : 260}
                  chartConfig={chartConfig}
                  accessor="montant"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  style={styles.chart}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <MaterialIcons name="pie-chart" size={64} color={COLORS.grayMedium} />
                  <Text style={styles.noDataText}>Aucune donnée disponible</Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* ALERTES CRITIQUES */}
        <Card style={[styles.alertsCard, {
          marginHorizontal: spacing.outer,
          marginBottom: spacing.outer
        }]}>
          <Card.Content style={{ padding: spacing.card }}>
            <View style={styles.sectionHeader}>
              <Title style={[styles.sectionTitle, {
                fontSize: deviceType.type === 'mobile' ? 18 : 20
              }]}>
                Alertes Critiques
              </Title>
              <Button
                mode="text"
                onPress={handleNavigateToNotifications}
                textColor={COLORS.primaryLight}
                labelStyle={{ fontSize: deviceType.type === 'mobile' ? 13 : 14, fontWeight: '600' }}
              >
                Voir tout
              </Button>
            </View>
            {dashboardData?.alertes && dashboardData.alertes.length > 0 ? (
              dashboardData.alertes.slice(0, 5).map(alert => renderAlertCard(alert))
            ) : (
              <View style={styles.noAlertsContainer}>
                <MaterialIcons name="check-circle" size={64} color={COLORS.success} />
                <Text style={styles.noAlertsText}>Aucune alerte critique</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* ACTIONS RAPIDES */}
        <Card style={[styles.quickActionsCard, {
          marginHorizontal: spacing.outer,
          marginBottom: spacing.outer
        }]}>
          <Card.Content style={{ padding: spacing.card }}>
            <Title style={[styles.sectionTitle, {
              fontSize: deviceType.type === 'mobile' ? 18 : 20,
              marginBottom: spacing.inner
            }]}>
              Actions Rapides
            </Title>
            <View style={[styles.quickActionsGrid, {
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.inner,
              justifyContent: 'space-between'
            }]}>
              {renderQuickAction('Ajouter Employé', 'person-add', COLORS.primaryLight, 'RH', { action: 'add' })}
              {renderQuickAction('Nouveau Véhicule', 'add-circle', COLORS.warning, 'Flotte', { tab: 'flotte', action: 'add' })}
              {renderQuickAction('Enregistrer Animal', 'pets', COLORS.purple, 'Flotte', { tab: 'elevage', action: 'add' })}
              {renderQuickAction('Nouvelle Commande', 'shopping-bag', COLORS.success, 'Commercial', { action: 'addCommande' })}
              {renderQuickAction('Paiement', 'payment', COLORS.danger, 'Finance', { action: 'addPaiement' })}
              {renderQuickAction('Voir Journal', 'receipt', COLORS.primaryLight, 'Finance', { tab: 'journal' })}
              {renderQuickAction('Envoyer Annonce', 'campaign', COLORS.purple, 'OPEN_NOTIFICATION_DIALOG')}
            </View>
          </Card.Content>
        </Card>

        {/* STATISTIQUES PAR MODULE */}
        <Card style={[styles.statsCard, {
          marginHorizontal: spacing.outer,
          marginBottom: spacing.outer
        }]}>
          <Card.Content style={{ padding: spacing.card }}>
            <Title style={[styles.sectionTitle, {
              fontSize: deviceType.type === 'mobile' ? 18 : 20,
              marginBottom: spacing.inner
            }]}>
              Statistiques par Module
            </Title>
            {dashboardData?.moduleStats && dashboardData.moduleStats.length > 0 ? (
              <DataTable>
                <DataTable.Header style={{ backgroundColor: COLORS.grayCard, borderRadius: 8 }}>
                  <DataTable.Title textStyle={{
                    fontSize: deviceType.type === 'mobile' ? 13 : 14,
                    fontWeight: '700',
                    color: COLORS.blackSoft
                  }}>
                    Module
                  </DataTable.Title>
                  <DataTable.Title numeric textStyle={{
                    fontSize: deviceType.type === 'mobile' ? 13 : 14,
                    fontWeight: '700',
                    color: COLORS.blackSoft
                  }}>
                    Opérations
                  </DataTable.Title>
                  <DataTable.Title numeric textStyle={{
                    fontSize: deviceType.type === 'mobile' ? 13 : 14,
                    fontWeight: '700',
                    color: COLORS.blackSoft
                  }}>
                    Montant
                  </DataTable.Title>
                </DataTable.Header>

                {dashboardData.moduleStats.map((stat, index) => (
                  <DataTable.Row
                    key={index}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.grayBorder
                    }}
                  >
                    <DataTable.Cell textStyle={{
                      fontSize: deviceType.type === 'mobile' ? 13 : 14,
                      color: COLORS.blackSoft,
                      fontWeight: '500'
                    }}>
                      {safeGetString(stat?.module, 'N/A')}
                    </DataTable.Cell>
                    <DataTable.Cell numeric textStyle={{
                      fontSize: deviceType.type === 'mobile' ? 13 : 14,
                      color: COLORS.textSecondary
                    }}>
                      {formatNumberLocal(stat?.operations)}
                    </DataTable.Cell>
                    <DataTable.Cell numeric textStyle={{
                      fontSize: deviceType.type === 'mobile' ? 13 : 14,
                      color: COLORS.success,
                      fontWeight: '700'
                    }}>
                      {formatMontantLocal(stat?.montant)}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </Card.Content>
        </Card>

        {/* TOP PERFORMERS */}
        <View style={[
          styles.performersContainer,
          {
            paddingHorizontal: spacing.outer,
            flexDirection: showPerformersInRow ? 'row' : 'column',
            gap: spacing.inner
          }
        ]}>
          {/* Top Clients */}
          <Card style={[styles.performerCard, showPerformersInRow && { flex: 1 }]}>
            <Card.Content style={{ padding: spacing.card }}>
              <Title style={[styles.sectionTitle, {
                fontSize: deviceType.type === 'mobile' ? 18 : 20,
                marginBottom: spacing.inner
              }]}>
                Top Clients
              </Title>
              {dashboardData?.topPerformers?.clients && dashboardData.topPerformers.clients.length > 0 ? (
                dashboardData.topPerformers.clients.map((client, index) => (
                  <View key={client?.id || index} style={styles.performerItem}>
                    <View style={styles.performerLeft}>
                      <Avatar.Text
                        size={deviceType.type === 'mobile' ? 44 : 48}
                        label={safeGetString(client?.nom, 'XX').substring(0, 2).toUpperCase()}
                        style={{ backgroundColor: COLORS.primaryLight }}
                        labelStyle={{
                          fontSize: deviceType.type === 'mobile' ? 16 : 18,
                          fontWeight: '700',
                          color: COLORS.white
                        }}
                      />
                      <View style={styles.performerInfo}>
                        <Text style={[styles.performerName, {
                          fontSize: deviceType.type === 'mobile' ? 15 : 16
                        }]}>
                          {safeGetString(client?.nom, 'Client')}
                        </Text>
                        <Text style={[styles.performerSubtitle, {
                          fontSize: deviceType.type === 'mobile' ? 12 : 13
                        }]}>
                          {safeParseInt(client?.achats, 0)} achat{safeParseInt(client?.achats, 0) > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.performerValue, {
                      fontSize: deviceType.type === 'mobile' ? 15 : 16
                    }]}>
                      {formatMontantLocal(client?.montant)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Aucun client</Text>
              )}
            </Card.Content>
          </Card>

          {/* Top Produits */}
          <Card style={[styles.performerCard, showPerformersInRow && { flex: 1 }]}>
            <Card.Content style={{ padding: spacing.card }}>
              <Title style={[styles.sectionTitle, {
                fontSize: deviceType.type === 'mobile' ? 18 : 20,
                marginBottom: spacing.inner
              }]}>
                Top Produits
              </Title>
              {dashboardData?.topPerformers?.produits && dashboardData.topPerformers.produits.length > 0 ? (
                dashboardData.topPerformers.produits.map((produit, index) => (
                  <View key={index} style={styles.performerItem}>
                    <View style={styles.performerLeft}>
                      <Avatar.Icon
                        size={deviceType.type === 'mobile' ? 44 : 48}
                        icon="local-offer"
                        style={{ backgroundColor: COLORS.success }}
                        color={COLORS.white}
                      />
                      <View style={styles.performerInfo}>
                        <Text style={[styles.performerName, {
                          fontSize: deviceType.type === 'mobile' ? 15 : 16
                        }]}>
                          {safeGetString(produit?.nom, 'Produit')}
                        </Text>
                        <Text style={[styles.performerSubtitle, {
                          fontSize: deviceType.type === 'mobile' ? 12 : 13
                        }]}>
                          {safeParseInt(produit?.ventes, 0)} vente{safeParseInt(produit?.ventes, 0) > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.performerValue, {
                      fontSize: deviceType.type === 'mobile' ? 15 : 16
                    }]}>
                      {formatMontantLocal(produit?.montant)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Aucun produit</Text>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* DIALOGS */}
      <Portal>
        <Dialog
          visible={rejectDialogVisible}
          onDismiss={() => {
            setRejectDialogVisible(false);
            setMotifRejet('');
            setCommentaireValidation('');
          }}
          style={{ backgroundColor: COLORS.white }}
        >
          <Dialog.Title style={{ color: COLORS.blackSoft, fontWeight: '700' }}>
            Rejeter la demande
          </Dialog.Title>
          <Dialog.Content>
            {selectedDemande && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>
                  Employé: <Text style={{ fontWeight: '700', color: COLORS.blackSoft }}>{safeGetString(selectedDemande.employe_nom, 'N/A')}</Text>
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>
                  Période: <Text style={{ fontWeight: '700', color: COLORS.blackSoft }}>{getMoisNom(safeParseInt(selectedDemande.mois, 1))} {safeParseInt(selectedDemande.annee, new Date().getFullYear())}</Text>
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>
                  Montant: <Text style={{ fontWeight: '700', color: COLORS.success }}>{formatMontantLocal(selectedDemande.montant)}</Text>
                </Text>
              </View>
            )}

            <TextInput
              label="Motif du rejet *"
              value={motifRejet}
              onChangeText={setMotifRejet}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Expliquez la raison du rejet..."
              outlineColor={COLORS.grayBorder}
              activeOutlineColor={COLORS.danger}
              style={{ marginBottom: 12 }}
            />

            <TextInput
              label="Commentaire (optionnel)"
              value={commentaireValidation}
              onChangeText={setCommentaireValidation}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Ajoutez un commentaire si nécessaire..."
              outlineColor={COLORS.grayBorder}
              activeOutlineColor={COLORS.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setRejectDialogVisible(false);
                setMotifRejet('');
                setCommentaireValidation('');
              }}
              textColor={COLORS.textSecondary}
            >
              Annuler
            </Button>
            <Button
              onPress={confirmerRejet}
              textColor={COLORS.danger}
              mode="contained"
              buttonColor={COLORS.danger}
            >
              Confirmer le rejet
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* DIALOG NOTIFICATION */}
        <Dialog
          visible={notificationDialogVisible}
          onDismiss={() => setNotificationDialogVisible(false)}
          style={{ backgroundColor: COLORS.white }}
        >
          <Dialog.Title style={{ color: COLORS.primary, fontWeight: '700' }}>
            Envoyer une notification
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 16, color: COLORS.textSecondary }}>
              Envoyez une annonce importante à tous les employés par email.
            </Text>

            <TextInput
              label="Sujet"
              value={notificationSubject}
              onChangeText={setNotificationSubject}
              mode="outlined"
              placeholder="Ex: Maintenance système..."
              outlineColor={COLORS.grayBorder}
              activeOutlineColor={COLORS.primary}
              style={{ marginBottom: 12 }}
            />

            <TextInput
              label="Message"
              value={notificationMessage}
              onChangeText={setNotificationMessage}
              mode="outlined"
              multiline
              numberOfLines={6}
              placeholder="Votre message ici..."
              outlineColor={COLORS.grayBorder}
              activeOutlineColor={COLORS.primary}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <MaterialIcons name="people" size={20} color={COLORS.primary} />
              <Text style={{ marginLeft: 8, color: COLORS.primary, fontWeight: '600' }}>
                Destinataires: Tous les employés actifs
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setNotificationDialogVisible(false)}
              textColor={COLORS.textSecondary}
              disabled={notificationLoading}
            >
              Annuler
            </Button>
            <Button
              onPress={handleSendNotification}
              mode="contained"
              buttonColor={COLORS.primary}
              loading={notificationLoading}
              disabled={notificationLoading}
              icon="send"
            >
              Envoyer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* SNACKBAR */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{
          label: 'Fermer',
          labelStyle: { color: COLORS.white, fontWeight: '700' },
          onPress: () => setSnackbarVisible(false),
        }}
        style={{ backgroundColor: COLORS.danger }}
      >
        <Text style={{ color: COLORS.white, fontWeight: '500' }}>{error}</Text>
      </Snackbar>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.grayBg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.grayBg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.grayBg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primaryDark,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  headerTitle: {
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: COLORS.white,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.9,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  periodFilter: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.grayBorder,
    paddingVertical: 14,
  },
  periodChip: {
    marginVertical: 0,
    backgroundColor: COLORS.grayCard,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
  },
  periodChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  kpiContainer: {
    backgroundColor: 'transparent',
  },
  kpiCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  trendText: {
    fontWeight: '800',
    marginLeft: 4,
  },
  kpiTitle: {
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 13,
  },
  kpiValue: {
    fontWeight: '900',
    color: COLORS.blackSoft,
    letterSpacing: -0.5,
  },
  demandesCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)' }
    }),
  },
  demandeCard: {
    backgroundColor: COLORS.grayCard,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
  },
  demandeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  demandeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  demandeInfo: {
    marginLeft: 14,
    flex: 1,
  },
  demandeNom: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.blackSoft,
  },
  demandeMatricule: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  demandePeriode: {
    fontSize: 13,
    color: COLORS.primaryLight,
    fontWeight: '600',
    marginTop: 4,
  },
  demandeDepartement: {
    fontSize: 11,
    color: COLORS.grayDark,
    marginTop: 2,
  },
  demandeRight: {
    alignItems: 'flex-end',
  },
  demandeMontant: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.success,
  },
  demandeDetails: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  demandeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  noDemandesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDemandesText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  noDemandesSubtext: {
    fontSize: 13,
    color: COLORS.grayMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  chartsContainer: {
    backgroundColor: 'transparent',
  },
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  chartTitle: {
    fontWeight: '800',
    color: COLORS.blackSoft,
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  alertsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '800',
    color: COLORS.blackSoft,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.grayCard,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontWeight: '700',
    color: COLORS.blackSoft,
  },
  alertDescription: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  alertTime: {
    color: COLORS.grayMedium,
    marginTop: 4,
  },
  noAlertsContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  noAlertsText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  quickActionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  quickActionsGrid: {
    backgroundColor: 'transparent',
  },
  quickActionCard: {
    backgroundColor: COLORS.grayCard,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
  },
  quickActionIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  quickActionText: {
    color: COLORS.blackSoft,
    textAlign: 'center',
    fontWeight: '700',
  },
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  performersContainer: {
    backgroundColor: 'transparent',
  },
  performerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  performerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  performerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  performerInfo: {
    marginLeft: 14,
    flex: 1,
  },
  performerName: {
    fontWeight: '700',
    color: COLORS.blackSoft,
  },
  performerSubtitle: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  performerValue: {
    fontWeight: '800',
    color: COLORS.success,
  },
  noDataText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
    fontWeight: '600',
  },
});

export default DashboardAdminScreen;