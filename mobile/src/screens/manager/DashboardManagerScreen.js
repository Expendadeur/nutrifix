// frontend/src/screens/manager/DashboardManagerScreen.js
// VERSION COMPLÈTE AVEC TOUTES LES FONCTIONNALITÉS IMPLÉMENTÉES
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
  Image,
  StatusBar
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Badge,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
  IconButton,
  Searchbar,
  Chip,
  DataTable,
  ProgressBar,
  TextInput,
  Avatar,
  Divider,
  Surface,
  Menu,
  RadioButton,
  Checkbox
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;

// Facteur de scale pour adapter les tailles
const scale = screenWidth / 375; // Base iPhone 11 (375px)
const moderateScale = (size, factor = 0.5) => size + (scale - 1) * size * factor;

const API_URL = 'https://nutrifix-1-twdf.onrender.com/api/manager';
const COLORS = {
  // Couleurs principales - Bleu professionnel
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#3B82F6',

  // Couleurs neutres - Base grise
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',

  // Textes
  text: '#0F172A',
  textSecondary: '#64748B',
  textLight: '#94A3B8',

  // Bordures et séparateurs
  border: '#E2E8F0',
  divider: '#F1F5F9',

  // États
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Statuts de paiement
  statusPaid: '#10B981',
  statusPending: '#F59E0B',

  // Couleurs pour graphiques
  chart1: '#2563EB',
  chart2: '#10B981',
  chart3: '#F59E0B',
  chart4: '#EF4444',
  chart5: '#8B5CF6',
  chart6: '#EC4899',

  // Ombres
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.15)',

  // Gradients
  gradientStart: '#2563EB',
  gradientEnd: '#1E40AF',
};

// ==================== CALCULS RESPONSIFS ====================
// Fonction pour calculer la largeur des cartes en fonction de l'écran
const getCardWidth = () => {
  if (screenWidth >= 1200) {
    // Desktop large - 4 cartes
    return (screenWidth - 80) / 4; // 80 = padding + gaps
  } else if (screenWidth >= 768) {
    // Tablet - 3 cartes
    return (screenWidth - 68) / 3; // 68 = padding + gaps
  } else if (screenWidth >= 480) {
    // Mobile large - 2 cartes
    return (screenWidth - 56) / 2; // 56 = padding + gaps
  } else {
    // Mobile small - 1.5 cartes (pour indiquer le scroll)
    return (screenWidth - 40) / 1.5; // 40 = padding
  }
};

const getStatCardWidth = () => {
  if (screenWidth >= 1200) {
    return (screenWidth - 100) / 5; // 5 cartes sur desktop
  } else if (screenWidth >= 768) {
    return (screenWidth - 80) / 4; // 4 cartes sur tablet
  } else if (screenWidth >= 480) {
    return (screenWidth - 60) / 3; // 3 cartes sur mobile large
  } else {
    return (screenWidth - 50) / 2.5; // 2.5 cartes sur mobile
  }
};

const getMonthlyStatCardWidth = () => {
  if (screenWidth >= 1200) {
    return (screenWidth - 100) / 4; // 4 cartes
  } else if (screenWidth >= 768) {
    return (screenWidth - 80) / 3; // 3 cartes
  } else if (screenWidth >= 480) {
    return (screenWidth - 60) / 2.5; // 2.5 cartes
  } else {
    return (screenWidth - 50) / 2; // 2 cartes
  }
};

const DashboardManagerScreen = () => {
  const navigation = useNavigation();

  // ==================== ÉTATS ====================
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const [salariesData, setSalariesData] = useState({
    overview: null,
    detailed: [],
    notPaid: [],
    paid: [],
    withoutConfirmation: [],
    statistics: null,
    paymentRequests: []
  });

  const [filters, setFilters] = useState({
    search: '',
    type_employe: 'all',
    statut_paiement: 'all',
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [activeSalaryTab, setActiveSalaryTab] = useState('all');
  const [selectedSalaries, setSelectedSalaries] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showSalaryDetailsModal, setShowSalaryDetailsModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('complete');
  const [reportFormat, setReportFormat] = useState('excel');
  const [generatingReport, setGeneratingReport] = useState(false);

  const [paymentData, setPaymentData] = useState({
    mode_paiement: 'virement',
    date_paiement: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [financialTrend, setFinancialTrend] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [revenuesBySource, setRevenuesBySource] = useState([]);

  // ==================== FUNCTIONS ====================

  const getAuthToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token;
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedPeriod, filters]);

  const loadAllData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      await Promise.all([
        loadDashboardData(),
        loadSalariesOverview(),
        loadSalariesDetailed(),
        loadSalaryStatistics(),
        loadFinancialData()
      ]);

    } catch (error) {
      if (!silent) {
        Alert.alert('Erreur', 'Impossible de charger les données');
      }
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/dashboard`, {
        params: {
          period: selectedPeriod,
          _t: Date.now()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      throw error;
    }
  };

  const loadSalariesOverview = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salaries-overview`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          _t: Date.now()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, overview: response.data }));
    } catch (error) {
      console.error('Error loading salaries overview:', error);
    }
  };

  const loadSalariesDetailed = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();

      const [detailedRes, notPaidRes, paidRes, requestsRes, withoutConfRes] = await Promise.all([
        axios.get(`${API_URL}/salaries-detailed`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            ...filters,
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/salaries-not-paid`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/salaries-paid`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/payment-requests`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            statut: 'en_attente',
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/salaries-without-confirmation`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSalariesData(prev => ({
        ...prev,
        detailed: detailedRes.data,
        notPaid: notPaidRes.data,
        paid: paidRes.data,
        paymentRequests: requestsRes.data,
        withoutConfirmation: withoutConfRes.data
      }));
    } catch (error) {
      console.error('Error loading detailed salaries:', error);
    }
  };

  const loadSalaryStatistics = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salary-statistics`, {
        params: {
          year: currentDate.getFullYear(),
          _t: Date.now()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, statistics: response.data }));
    } catch (error) {
      console.error('Error loading salary statistics:', error);
    }
  };

  const loadFinancialData = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();

      const [trendRes, expensesRes, revenuesRes] = await Promise.all([
        axios.get(`${API_URL}/monthly-financial-trend`, {
          params: { months: 6, _t: Date.now() },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/expenses-by-category`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/revenues-by-source`, {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            _t: Date.now()
          },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setFinancialTrend(trendRes.data);
      setExpensesByCategory(expensesRes.data);
      setRevenuesBySource(revenuesRes.data);
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  };

  const handlePaySalary = async (salaryId, data) => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/salaries/${salaryId}/pay`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Salaire payé avec succès');
        setShowPaymentModal(false);
        setSelectedSalary(null);
        loadAllData(true);
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors du paiement');
    }
  };

  const handlePayMultipleSalaries = async () => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/salaries/pay-multiple`,
        {
          salary_ids: selectedSalaries,
          ...paymentData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Succès', `${selectedSalaries.length} salaire(s) payé(s)`);
        setSelectedSalaries([]);
        setSelectionMode(false);
        setShowPaymentModal(false);
        loadAllData(true);
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors du paiement');
    }
  };

  const handleMarkAsDebt = async (salaryId) => {
    Alert.alert(
      'Marquer comme dette',
      'Voulez-vous marquer ce salaire comme dette non payée (Temps Partiel)?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await axios.post(
                `${API_URL}/salaries/${salaryId}/mark-unpaid-debt`,
                { notes: 'Marqué comme dette impayée' },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data.success) {
                Alert.alert('Succès', 'Salaire marqué comme dette');
                loadAllData(true);
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de marquer comme dette');
            }
          }
        }
      ]
    );
  };

  const handleSendReminder = async (salaryId) => {
    try {
      const token = await getAuthToken();
      await axios.post(
        `${API_URL}/salaries/${salaryId}/send-reminder`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Succès', 'Rappel envoyé');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le rappel');
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const token = await getAuthToken();
      const currentDate = new Date();

      const response = await axios.post(
        `${API_URL}/generate-salary-report`,
        {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          type: reportType,
          format: reportFormat
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { fileName, data } = response.data;

        if (isWeb) {
          const blob = base64ToBlob(
            data,
            reportFormat === 'excel'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'application/pdf'
          );
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);
        } else {
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, data, {
            encoding: FileSystem.EncodingType.Base64
          });
          await Sharing.shareAsync(fileUri);
        }

        Alert.alert('Succès', 'Rapport généré avec succès');
        setShowReportModal(false);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la génération du rapport');
    } finally {
      setGeneratingReport(false);
    }
  };

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const handleSendMessage = async () => {
    if (!messageSubject.trim() || !messageBody.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setIsSending(true);
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL.replace('/manager', '')}/notifications/contact-admin`,
        {
          sujet: messageSubject,
          message: messageBody
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Message envoyé à l\'administration');
        setCommunicationModalVisible(false);
        setMessageSubject('');
        setMessageBody('');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'payé': return COLORS.statusPaid;
      case 'calculé': return COLORS.statusPending;
      case 'reporté': return COLORS.error;
      default: return COLORS.textLight;
    }
  };

  const getPieChartColors = (index) => {
    const colors = [COLORS.chart1, COLORS.chart2, COLORS.chart3, COLORS.chart4, COLORS.chart5, COLORS.chart6];
    return colors[index % colors.length];
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, [selectedPeriod]);

  // ==================== RENDER COMPONENTS ====================

  const renderHeader = () => (
    <LinearGradient
      colors={[COLORS.gradientStart, COLORS.gradientEnd]}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.gradientStart} />

      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <Avatar.Icon
            size={45}
            icon="view-dashboard"
            style={styles.headerIcon}
            color={COLORS.primary}
          />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Dashboard Manager</Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Menu
            visible={showPeriodMenu}
            onDismiss={() => setShowPeriodMenu(false)}
            anchor={
              <IconButton
                icon="calendar-range"
                iconColor="#FFF"
                size={24}
                onPress={() => setShowPeriodMenu(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => { setSelectedPeriod('week'); setShowPeriodMenu(false); }}
              title="Cette semaine"
            />
            <Menu.Item
              onPress={() => { setSelectedPeriod('month'); setShowPeriodMenu(false); }}
              title="Ce mois"
            />
            <Menu.Item
              onPress={() => { setSelectedPeriod('year'); setShowPeriodMenu(false); }}
              title="Cette année"
            />
          </Menu>
          <IconButton
            icon="bell-outline"
            iconColor="#FFF"
            size={24}
            onPress={() => navigation.navigate('Notifications')}
          />
          <IconButton
            icon="email-outline"
            iconColor="#FFF"
            size={24}
            onPress={() => setCommunicationModalVisible(true)}
          />
          <IconButton
            icon="refresh"
            iconColor="#FFF"
            size={24}
            onPress={() => loadAllData()}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {[
          { key: 'overview', label: 'Vue d\'ensemble', icon: 'view-dashboard' },
          { key: 'salaries', label: 'Salaires', icon: 'cash-multiple' },
          { key: 'analytics', label: 'Statistiques', icon: 'chart-line' },
          { key: 'reports', label: 'Rapports', icon: 'file-document' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? COLORS.primary : 'rgba(255,255,255,0.8)'}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.key && styles.tabLabelActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </LinearGradient>
  );

  const renderKPICards = () => {
    if (!dashboardData) return null;

    const kpis = [
      {
        title: 'Employés Actifs',
        value: dashboardData.kpis?.employes_actifs || 0,
        icon: 'group',
        gradient: ['#66BB6A', '#43A047'],
        onPress: () => navigation.navigate('EquipeRH')
      },
      {
        title: 'Présences Aujourd\'hui',
        value: dashboardData.kpis?.presences_aujourdhui || 0,
        icon: 'check-circle',
        gradient: ['#42A5F5', '#1E88E5'],
        percentage: dashboardData.kpis?.employes_actifs > 0
          ? Math.round((dashboardData.kpis?.presences_aujourdhui / dashboardData.kpis?.employes_actifs) * 100)
          : 0,
        onPress: () => navigation.navigate('EquipeRH', { tab: 'presences' })
      },
      {
        title: 'Demandes en Attente',
        value: dashboardData.kpis?.demandes_en_attente || 0,
        icon: 'access-time',
        gradient: ['#FFA726', '#FB8C00'],
        onPress: () => navigation.navigate('Notifications')
      },
      {
        title: 'Budget Utilisé',
        value: `${dashboardData.kpis?.budget_utilise || 0}%`,
        icon: 'account-balance-wallet',
        gradient: ['#FF6F00', '#E65100'],
        progress: dashboardData.kpis?.budget_utilise || 0,
        onPress: () => navigation.navigate('FinancierDept')
      }
    ];

    return (
      <View style={styles.kpiContainer}>
        {kpis.map((kpi, index) => (
          <TouchableOpacity
            key={index}
            style={styles.kpiCard}
            onPress={kpi.onPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={kpi.gradient}
              style={styles.kpiGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.kpiHeader}>
                <View style={styles.kpiIconContainer}>
                  <MaterialIcons name={kpi.icon} size={28} color="#FFF" />
                </View>
              </View>

              <View style={styles.kpiBody}>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                <Text style={styles.kpiTitle}>{kpi.title}</Text>

                {kpi.percentage !== undefined && (
                  <View style={styles.kpiPercentageContainer}>
                    <Text style={styles.kpiPercentage}>{kpi.percentage}% présent</Text>
                  </View>
                )}

                {kpi.progress !== undefined && (
                  <View style={styles.kpiProgressContainer}>
                    <View style={styles.kpiProgressBar}>
                      <View
                        style={[
                          styles.kpiProgressFill,
                          { width: `${kpi.progress}%` }
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSalariesOverview = () => {
    if (!salariesData.overview) return null;

    const { stats, repartition } = salariesData.overview;
    const paymentProgress = stats?.total_employes > 0
      ? (stats?.employes_payes / stats?.total_employes) * 100
      : 0;

    return (
      <Card style={styles.overviewCard}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="account-balance-wallet" size={24} color={COLORS.primary} />
              <Title style={styles.cardTitle}>Aperçu des Salaires</Title>
            </View>
            <Chip
              icon="calendar"
              mode="outlined"
              style={styles.periodChip}
              textStyle={styles.periodChipText}
            >
              {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Chip>
          </View>

          <View style={styles.statsGrid}>
            <Surface style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="people" size={32} color={COLORS.success} />
              <Text style={styles.statValue}>{stats?.total_employes || 0}</Text>
              <Text style={styles.statLabel}>Total Employés</Text>
            </Surface>

            <Surface style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcons name="check-circle" size={32} color={COLORS.info} />
              <Text style={styles.statValue}>{stats?.employes_payes || 0}</Text>
              <Text style={styles.statLabel}>Payés</Text>
            </Surface>

            <Surface style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="pending" size={32} color={COLORS.warning} />
              <Text style={styles.statValue}>{stats?.employes_non_payes || 0}</Text>
              <Text style={styles.statLabel}>En Attente</Text>
            </Surface>

            <Surface style={[styles.statCard, { backgroundColor: '#FCE4EC' }]}>
              <MaterialIcons name="notifications-active" size={32} color={COLORS.error} />
              <Text style={styles.statValue}>{salariesData.overview?.demandes_en_attente || 0}</Text>
              <Text style={styles.statLabel}>Demandes</Text>
            </Surface>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.amountsSection}>
            <View style={styles.amountRow}>
              <View style={styles.amountLabelContainer}>
                <MaterialIcons name="trending-up" size={20} color={COLORS.textSecondary} />
                <Text style={styles.amountLabel}>Total Brut</Text>
              </View>
              <Text style={[styles.amountValue, { color: COLORS.primary }]}>
                {formatCurrency(stats?.total_brut || 0)}
              </Text>
            </View>

            <View style={styles.amountRow}>
              <View style={styles.amountLabelContainer}>
                <MaterialIcons name="account-balance" size={20} color={COLORS.textSecondary} />
                <Text style={styles.amountLabel}>Total Net</Text>
              </View>
              <Text style={[styles.amountValue, { color: COLORS.success }]}>
                {formatCurrency(stats?.total_net || 0)}
              </Text>
            </View>

            <View style={styles.amountRow}>
              <View style={styles.amountLabelContainer}>
                <MaterialIcons name="remove-circle" size={20} color={COLORS.textSecondary} />
                <Text style={styles.amountLabel}>INSS</Text>
              </View>
              <Text style={[styles.amountValue, { color: COLORS.error }]}>
                {formatCurrency(stats?.total_inss || 0)}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.amountRow}>
              <View style={styles.amountLabelContainer}>
                <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
                <Text style={[styles.amountLabel, { fontWeight: 'bold' }]}>Montant Payé</Text>
              </View>
              <Text style={[styles.amountValue, styles.amountHighlight, { color: COLORS.success }]}>
                {formatCurrency(stats?.montant_paye || 0)}
              </Text>
            </View>

            <View style={styles.amountRow}>
              <View style={styles.amountLabelContainer}>
                <MaterialIcons name="pending" size={20} color={COLORS.warning} />
                <Text style={[styles.amountLabel, { fontWeight: 'bold' }]}>Montant Restant</Text>
              </View>
              <Text style={[styles.amountValue, styles.amountHighlight, { color: COLORS.warning }]}>
                {formatCurrency(stats?.montant_restant || 0)}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progression des paiements</Text>
              <Text style={styles.progressPercentage}>{Math.round(paymentProgress)}%</Text>
            </View>
            <ProgressBar
              progress={paymentProgress / 100}
              color={COLORS.success}
              style={styles.progressBar}
            />
            <Text style={styles.progressSubtext}>
              {stats?.employes_payes || 0} sur {stats?.total_employes || 0} employés payés
            </Text>
          </View>

          {repartition && repartition.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.repartitionSection}>
                <Text style={styles.sectionTitle}>Répartition par Type</Text>
                {repartition.map((item, index) => (
                  <Surface key={index} style={styles.repartitionCard} elevation={1}>
                    <View style={styles.repartitionHeader}>
                      <Chip mode="outlined" compact textStyle={{ fontSize: 12 }}>
                        {item.type_employe}
                      </Chip>
                      <Text style={styles.repartitionCount}>
                        {item.nombre} employé{item.nombre > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.repartitionBody}>
                      <View style={styles.repartitionStats}>
                        <View style={styles.repartitionStat}>
                          <Text style={styles.repartitionStatLabel}>Payés</Text>
                          <Text style={[styles.repartitionStatValue, { color: COLORS.success }]}>
                            {item.payes}
                          </Text>
                        </View>
                        <View style={styles.repartitionStat}>
                          <Text style={styles.repartitionStatLabel}>En attente</Text>
                          <Text style={[styles.repartitionStatValue, { color: COLORS.warning }]}>
                            {item.non_payes}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.repartitionAmount}>
                        {formatCurrency(item.total_net || 0)}
                      </Text>
                    </View>
                  </Surface>
                ))}
              </View>
            </>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderSalaryTabs = () => (
    <View style={styles.salaryTabsContainer}>
      {[
        { key: 'all', label: 'Tous', count: salariesData.detailed.length, icon: 'format-list-bulleted' },
        { key: 'notPaid', label: 'Non Payés', count: salariesData.notPaid.length, icon: 'clock-alert-outline' },
        { key: 'paid', label: 'Payés', count: salariesData.paid.length, icon: 'check-circle-outline' },
        { key: 'requests', label: 'Demandes', count: salariesData.paymentRequests.length, icon: 'message-alert-outline' },
        { key: 'noConfirm', label: 'Sans Confirm.', count: salariesData.withoutConfirmation.length, icon: 'alert-circle-outline' }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.salaryTab,
            activeSalaryTab === tab.key && styles.salaryTabActive
          ]}
          onPress={() => setActiveSalaryTab(tab.key)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={tab.icon}
            size={18}
            color={activeSalaryTab === tab.key ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[
            styles.salaryTabLabel,
            activeSalaryTab === tab.key && styles.salaryTabLabelActive
          ]}>
            {tab.label}
          </Text>
          {tab.count > 0 && (
            <Badge
              style={[
                styles.salaryTabBadge,
                activeSalaryTab === tab.key && styles.salaryTabBadgeActive
              ]}
            >
              {tab.count}
            </Badge>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSalariesList = () => {
    let dataToDisplay = [];

    switch (activeSalaryTab) {
      case 'all': dataToDisplay = salariesData.detailed; break;
      case 'notPaid': dataToDisplay = salariesData.notPaid; break;
      case 'paid': dataToDisplay = salariesData.paid; break;
      case 'requests': return renderPaymentRequests();
      case 'noConfirm': dataToDisplay = salariesData.withoutConfirmation; break;
      default: dataToDisplay = salariesData.detailed;
    }

    if (dataToDisplay.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyStateText}>Aucun salaire à afficher</Text>
        </View>
      );
    }

    return (
      <View style={styles.salariesListContainer}>
        {selectionMode && selectedSalaries.length > 0 && (
          <Surface style={styles.selectionBar} elevation={2}>
            <Text style={styles.selectionCount}>{selectedSalaries.length} sélectionné(s)</Text>
            <View style={styles.selectionActions}>
              <Button
                mode="contained"
                icon="cash-multiple"
                onPress={() => setShowPaymentModal(true)}
                style={styles.selectionButton}
                buttonColor={COLORS.success}
                compact
              >
                Payer
              </Button>
              <Button
                mode="outlined"
                onPress={() => {
                  setSelectionMode(false);
                  setSelectedSalaries([]);
                }}
                compact
              >
                Annuler
              </Button>
            </View>
          </Surface>
        )}

        <ScrollView style={styles.salariesScroll}>
          {dataToDisplay.map((salary) => (
            <Card key={salary.id} style={styles.salaryItemCard}>
              <Card.Content>
                <View style={styles.salaryItemHeader}>
                  {selectionMode && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedSalaries(prev =>
                          prev.includes(salary.id)
                            ? prev.filter(id => id !== salary.id)
                            : [...prev, salary.id]
                        );
                      }}
                      style={styles.salaryCheckbox}
                    >
                      <MaterialIcons
                        name={selectedSalaries.includes(salary.id) ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  )}

                  <View style={styles.salaryEmployee}>
                    <Avatar.Text
                      size={50}
                      label={salary.employee_name?.substring(0, 2).toUpperCase() || 'EM'}
                      style={{ backgroundColor: COLORS.primaryLight }}
                    />
                    <View style={styles.salaryEmployeeInfo}>
                      <Text style={styles.salaryEmployeeName}>{salary.employee_name}</Text>
                      <Text style={styles.salaryEmployeeMatricule}>{salary.matricule}</Text>
                      <Chip mode="outlined" compact style={styles.typeChip}>
                        {salary.type_employe}
                      </Chip>
                    </View>
                  </View>

                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(salary.statut_paiement) }
                    ]}
                    textStyle={{ color: '#FFF', fontSize: 11 }}
                  >
                    {salary.statut_paiement}
                  </Chip>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.salaryAmounts}>
                  <View style={styles.salaryAmount}>
                    <Text style={styles.salaryAmountLabel}>Salaire Brut</Text>
                    <Text style={styles.salaryAmountValue}>
                      {formatCurrency(salary.salaire_brut)}
                    </Text>
                  </View>
                  <View style={styles.salaryAmount}>
                    <Text style={styles.salaryAmountLabel}>Salaire Net</Text>
                    <Text style={[styles.salaryAmountValue, styles.salaryNetAmount]}>
                      {formatCurrency(salary.salaire_net)}
                    </Text>
                  </View>
                </View>

                {activeSalaryTab === 'paid' && salary.date_paiement && (
                  <View style={styles.salaryPaymentInfo}>
                    <MaterialIcons name="event" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.salaryPaymentText}>
                      Payé le {new Date(salary.date_paiement).toLocaleDateString('fr-FR')}
                    </Text>
                    {salary.reference_paiement && (
                      <Text style={styles.salaryReference}>• Réf: {salary.reference_paiement}</Text>
                    )}
                  </View>
                )}

                {activeSalaryTab === 'noConfirm' && (
                  <View style={styles.noConfirmInfo}>
                    <MaterialIcons name="info-outline" size={16} color={COLORS.warning} />
                    <Text style={styles.noConfirmText}>
                      En attente de confirmation de réception
                    </Text>
                    <Button
                      mode="text"
                      onPress={() => handleSendReminder(salary.id)}
                      compact
                      textColor={COLORS.primary}
                    >
                      Rappeler
                    </Button>
                  </View>
                )}

                {activeSalaryTab === 'notPaid' && (
                  <View style={styles.salaryActions}>
                    <Button
                      mode="outlined"
                      icon="eye"
                      onPress={() => {
                        setSelectedSalary(salary);
                        setShowSalaryDetailsModal(true);
                      }}
                      style={styles.salaryActionButton}
                      compact
                    >
                      Détails
                    </Button>
                    <Button
                      mode="text"
                      icon="alert"
                      onPress={() => handleMarkAsDebt(salary.id)}
                      style={styles.salaryActionButton}
                      textColor={COLORS.warning}
                      compact
                    >
                      Marquer Dette
                    </Button>
                    <Button
                      mode="contained"
                      icon="cash"
                      onPress={() => {
                        setSelectedSalary(salary);
                        setShowPaymentModal(true);
                      }}
                      style={styles.salaryActionButton}
                      buttonColor={COLORS.success}
                      compact
                    >
                      Payer
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))}
        </ScrollView>

        {!selectionMode && activeSalaryTab === 'notPaid' && dataToDisplay.length > 0 && (
          <Button
            mode="outlined"
            icon="checkbox-marked"
            onPress={() => setSelectionMode(true)}
            style={styles.selectModeButton}
          >
            Sélectionner Multiple
          </Button>
        )}
      </View>
    );
  };

  const renderPaymentRequests = () => {
    if (salariesData.paymentRequests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyStateText}>Aucune demande en attente</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.requestsScroll}>
        {salariesData.paymentRequests.map((request) => (
          <Card key={request.id} style={styles.requestCard}>
            <Card.Content>
              <View style={styles.requestHeader}>
                <View style={styles.requestEmployee}>
                  <Avatar.Text
                    size={45}
                    label={request.employe_nom?.substring(0, 2).toUpperCase() || 'EM'}
                    style={{ backgroundColor: COLORS.warning }}
                  />
                  <View style={styles.requestEmployeeInfo}>
                    <Text style={styles.requestEmployeeName}>{request.employe_nom}</Text>
                    <Text style={styles.requestMatricule}>{request.matricule}</Text>
                  </View>
                </View>
                <View style={styles.requestBadge}>
                  <MaterialIcons name="schedule" size={18} color={COLORS.warning} />
                  <Text style={styles.requestDays}>{request.jours_attente}j</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.requestBody}>
                <Surface style={styles.requestAmount} elevation={0}>
                  <Text style={styles.requestAmountLabel}>Montant demandé</Text>
                  <Text style={styles.requestAmountValue}>
                    {formatCurrency(request.montant)}
                  </Text>
                </Surface>

                {request.justification && (
                  <View style={styles.requestJustification}>
                    <Text style={styles.requestJustificationLabel}>Justification:</Text>
                    <Text style={styles.requestJustificationText}>
                      {request.justification}
                    </Text>
                  </View>
                )}

                <View style={styles.requestMeta}>
                  <Text style={styles.requestDate}>
                    {new Date(request.date_demande).toLocaleDateString('fr-FR')}
                  </Text>
                  <Chip mode="outlined" compact>
                    {request.urgence}
                  </Chip>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.requestActions}>
                <Button
                  mode="outlined"
                  icon="close"
                  onPress={() => handleRejectRequest(request)}
                  style={styles.requestButton}
                  textColor={COLORS.error}
                  compact
                >
                  Rejeter
                </Button>
                <Button
                  mode="contained"
                  icon="check"
                  onPress={() => handleApproveRequest(request)}
                  style={styles.requestButton}
                  buttonColor={COLORS.success}
                  compact
                >
                  Approuver
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    );
  };

  const handleApproveRequest = async (request) => {
    try {
      const token = await getAuthToken();
      await axios.post(
        `${API_URL}/payment-requests/${request.id}/process`,
        {
          action: 'approve',
          mode_paiement: 'virement',
          date_paiement: new Date().toISOString().split('T')[0]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Succès', 'Demande approuvée et salaire payé');
      loadAllData(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de traiter la demande');
    }
  };

  const handleRejectRequest = (request) => {
    Alert.prompt(
      'Rejeter la demande',
      'Raison du rejet:',
      async (reason) => {
        try {
          const token = await getAuthToken();
          await axios.post(
            `${API_URL}/payment-requests/${request.id}/process`,
            { action: 'reject', commentaire: reason },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          Alert.alert('Succès', 'Demande rejetée');
          loadAllData(true);
        } catch (error) {
          Alert.alert('Erreur', 'Impossible de rejeter');
        }
      }
    );
  };

  const renderAnalytics = () => {
    if (!salariesData.statistics) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyStateText}>Chargement des statistiques...</Text>
        </View>
      );
    }

    const { evolution_mensuelle, par_type_employe, taux_confirmation } = salariesData.statistics;

    return (
      <ScrollView style={styles.analyticsContainer}>
        {/* Évolution Mensuelle */}
        {evolution_mensuelle && evolution_mensuelle.length > 0 && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialIcons name="trending-up" size={24} color={COLORS.primary} />
                <Title style={styles.cardTitle}>Évolution Mensuelle des Salaires</Title>
              </View>

              <LineChart
                data={{
                  labels: evolution_mensuelle.map(m => `M${m.mois}`),
                  datasets: [{
                    data: evolution_mensuelle.map(m => parseFloat(m.total_net) || 0)
                  }]
                }}
                width={screenWidth - 70}
                height={220}
                chartConfig={{
                  backgroundColor: COLORS.surface,
                  backgroundGradientFrom: COLORS.surface,
                  backgroundGradientTo: COLORS.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(33, 33, 33, ${opacity})`,
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: COLORS.primary
                  }
                }}
                bezier
                style={styles.chart}
              />

              <Divider style={styles.divider} />

              <View style={styles.monthlyStatsGrid}>
                {evolution_mensuelle.slice(0, 6).map((month, index) => (
                  <Surface key={index} style={styles.monthlyStatCard} elevation={1}>
                    <Text style={styles.monthlyStatMonth}>Mois {month.mois}</Text>
                    <Text style={styles.monthlyStatEmployees}>
                      {month.nombre_employes} employés
                    </Text>
                    <Text style={styles.monthlyStatAmount}>
                      {formatCurrency(month.total_net)}
                    </Text>
                    <View style={styles.monthlyStatDetails}>
                      <Text style={styles.monthlyStatDetail}>Payés: {month.payes}</Text>
                      {month.delai_moyen_paiement && (
                        <Text style={styles.monthlyStatDetail}>
                          Délai: {Math.round(month.delai_moyen_paiement)}j
                        </Text>
                      )}
                    </View>
                  </Surface>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Par Type d'Employé */}
        {par_type_employe && par_type_employe.length > 0 && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialIcons name="pie-chart" size={24} color={COLORS.primary} />
                <Title style={styles.cardTitle}>Répartition par Type d'Employé</Title>
              </View>

              <PieChart
                data={par_type_employe.map((type, index) => ({
                  name: type.type_employe,
                  population: parseFloat(type.total_annuel) || 0,
                  color: getPieChartColors(index),
                  legendFontColor: COLORS.textSecondary,
                  legendFontSize: 12
                }))}
                width={screenWidth - 70}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />

              <Divider style={styles.divider} />

              <View style={styles.typeStatsTable}>
                {par_type_employe.map((type, index) => (
                  <Surface key={index} style={styles.typeStatRow} elevation={1}>
                    <View style={styles.typeStatLeft}>
                      <View style={[
                        styles.typeStatColor,
                        { backgroundColor: getPieChartColors(index) }
                      ]} />
                      <View>
                        <Text style={styles.typeStatName}>{type.type_employe}</Text>
                        <Text style={styles.typeStatCount}>
                          {type.nombre_employes} employé{type.nombre_employes > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.typeStatRight}>
                      <Text style={styles.typeStatAmount}>
                        {formatCurrency(type.total_annuel)}
                      </Text>
                      <Text style={styles.typeStatAverage}>
                        Moy: {formatCurrency(type.salaire_net_moyen)}
                      </Text>
                    </View>
                  </Surface>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Taux de Confirmation */}
        <Card style={styles.chartCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="verified" size={24} color={COLORS.primary} />
              <Title style={styles.cardTitle}>Taux de Confirmation</Title>
            </View>

            <View style={styles.confirmationStats}>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Salaires Payés</Text>
                <Text style={styles.confirmationStatValue}>
                  {taux_confirmation?.total_salaires_payes || 0}
                </Text>
              </View>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Confirmés</Text>
                <Text style={[styles.confirmationStatValue, { color: COLORS.success }]}>
                  {taux_confirmation?.total_confirmes || 0}
                </Text>
              </View>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Taux</Text>
                <Text style={[styles.confirmationStatValue, { color: COLORS.info }]}>
                  {taux_confirmation?.taux_confirmation || 0}%
                </Text>
              </View>
            </View>

            <ProgressBar
              progress={(taux_confirmation?.taux_confirmation || 0) / 100}
              color={COLORS.success}
              style={styles.confirmationProgressBar}
            />
          </Card.Content>
        </Card>

        {/* Tendance Financière */}
        {financialTrend && financialTrend.length > 0 && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialIcons name="show-chart" size={24} color={COLORS.primary} />
                <Title style={styles.cardTitle}>Tendance Financière (6 mois)</Title>
              </View>

              <BarChart
                data={{
                  labels: financialTrend.map(t => t.mois.substring(5)),
                  datasets: [
                    {
                      data: financialTrend.map(t => parseFloat(t.depenses) || 0),
                      color: (opacity = 1) => `rgba(239, 83, 80, ${opacity})`
                    },
                    {
                      data: financialTrend.map(t => parseFloat(t.revenus) || 0),
                      color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
                    }
                  ],
                  legend: ['Dépenses', 'Revenus']
                }}
                width={screenWidth - 70}
                height={220}
                chartConfig={{
                  backgroundColor: COLORS.surface,
                  backgroundGradientFrom: COLORS.surface,
                  backgroundGradientTo: COLORS.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(30, 136, 229, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(33, 33, 33, ${opacity})`
                }}
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Dépenses par Catégorie */}
        {expensesByCategory && expensesByCategory.length > 0 && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialIcons name="category" size={24} color={COLORS.primary} />
                <Title style={styles.cardTitle}>Dépenses par Catégorie</Title>
              </View>

              <PieChart
                data={expensesByCategory.map((cat, index) => ({
                  name: cat.categorie,
                  population: parseFloat(cat.total) || 0,
                  color: getPieChartColors(index),
                  legendFontColor: COLORS.textSecondary,
                  legendFontSize: 12
                }))}
                width={screenWidth - 70}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </Card.Content>
          </Card>
        )}

        {/* Revenus par Source */}
        {revenuesBySource && revenuesBySource.length > 0 && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialIcons name="attach-money" size={24} color={COLORS.primary} />
                <Title style={styles.cardTitle}>Revenus par Source</Title>
              </View>

              <PieChart
                data={revenuesBySource.map((src, index) => ({
                  name: src.source,
                  population: parseFloat(src.total) || 0,
                  color: getPieChartColors(index),
                  legendFontColor: COLORS.textSecondary,
                  legendFontSize: 12
                }))}
                width={screenWidth - 70}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    );
  };

  const renderReports = () => {
    return (
      <ScrollView style={styles.reportsContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="description" size={24} color={COLORS.primary} />
              <Title style={styles.cardTitle}>Générer un Rapport</Title>
            </View>

            <Paragraph style={styles.cardSubtitle}>
              Sélectionnez le type et le format du rapport à générer
            </Paragraph>

            <Divider style={styles.divider} />

            <Text style={styles.reportSectionTitle}>Type de Rapport</Text>
            <RadioButton.Group
              onValueChange={value => setReportType(value)}
              value={reportType}
            >
              <View style={styles.radioItem}>
                <RadioButton value="complete" color={COLORS.primary} />
                <Text style={styles.radioLabel}>Rapport Complet (tous les détails)</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="salaires" color={COLORS.primary} />
                <Text style={styles.radioLabel}>Liste des Salaires</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="statistiques" color={COLORS.primary} />
                <Text style={styles.radioLabel}>Statistiques & Analyses</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="paiements" color={COLORS.primary} />
                <Text style={styles.radioLabel}>Historique des Paiements</Text>
              </View>
            </RadioButton.Group>

            <Divider style={styles.divider} />

            <Text style={styles.reportSectionTitle}>Format</Text>
            <View style={styles.formatButtons}>
              <Button
                mode={reportFormat === 'excel' ? 'contained' : 'outlined'}
                icon="file-excel"
                onPress={() => setReportFormat('excel')}
                style={styles.formatButton}
                buttonColor={reportFormat === 'excel' ? COLORS.success : undefined}
              >
                Excel (.xlsx)
              </Button>
              <Button
                mode={reportFormat === 'pdf' ? 'contained' : 'outlined'}
                icon="file-pdf"
                onPress={() => setReportFormat('pdf')}
                style={styles.formatButton}
                buttonColor={reportFormat === 'pdf' ? COLORS.error : undefined}
              >
                PDF
              </Button>
            </View>

            <Button
              mode="contained"
              icon="download"
              onPress={handleGenerateReport}
              loading={generatingReport}
              disabled={generatingReport}
              style={styles.generateButton}
              buttonColor={COLORS.primary}
            >
              Générer le Rapport
            </Button>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Actions Rapides</Title>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('FinancierDept')}
            >
              <MaterialIcons name="analytics" size={24} color={COLORS.primary} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Voir Budget Département</Text>
                <Text style={styles.quickActionSubtitle}>Consulter les finances</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
            </TouchableOpacity>

            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => navigation.navigate('EquipeRH')}
            >
              <MaterialIcons name="people" size={24} color={COLORS.success} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Gérer l'Équipe</Text>
                <Text style={styles.quickActionSubtitle}>RH & Présences</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
            </TouchableOpacity>

            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => setShowReportModal(true)}
            >
              <MaterialIcons name="file-download" size={24} color={COLORS.accent} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Exporter les Données</Text>
                <Text style={styles.quickActionSubtitle}>Télécharger un rapport</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.textLight} />
            </TouchableOpacity>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  // ==================== MAIN RENDER ====================

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeTab === 'overview' && (
          <>
            {renderKPICards()}
            {renderSalariesOverview()}
          </>
        )}

        {activeTab === 'salaries' && (
          <>
            {renderSalaryTabs()}
            {renderSalariesList()}
          </>
        )}

        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'reports' && renderReports()}
      </ScrollView>

      {/* Modales */}
      <Portal>
        {/* Modale Communication */}
        <Modal
          visible={communicationModalVisible}
          onDismiss={() => setCommunicationModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Title>Contacter l'Administration</Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setCommunicationModalVisible(false)}
            />
          </View>

          <TextInput
            mode="outlined"
            label="Sujet"
            value={messageSubject}
            onChangeText={setMessageSubject}
            style={styles.modalInput}
          />

          <TextInput
            mode="outlined"
            label="Message"
            value={messageBody}
            onChangeText={setMessageBody}
            multiline
            numberOfLines={5}
            style={styles.modalInput}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setCommunicationModalVisible(false)}
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSendMessage}
              loading={isSending}
              disabled={isSending || !messageSubject.trim() || !messageBody.trim()}
            >
              Envoyer
            </Button>
          </View>
        </Modal>

        {/* Modale Paiement */}
        <Modal
          visible={showPaymentModal}
          onDismiss={() => setShowPaymentModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Title>
              {selectedSalaries.length > 0
                ? `Payer ${selectedSalaries.length} salaire(s)`
                : 'Payer le salaire'
              }
            </Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowPaymentModal(false)}
            />
          </View>

          <TextInput
            mode="outlined"
            label="Mode de paiement"
            value={paymentData.mode_paiement}
            onChangeText={(text) => setPaymentData(prev => ({ ...prev, mode_paiement: text }))}
            style={styles.modalInput}
          />

          <TextInput
            mode="outlined"
            label="Date de paiement"
            value={paymentData.date_paiement}
            onChangeText={(text) => setPaymentData(prev => ({ ...prev, date_paiement: text }))}
            style={styles.modalInput}
          />

          <TextInput
            mode="outlined"
            label="Notes (optionnel)"
            value={paymentData.notes}
            onChangeText={(text) => setPaymentData(prev => ({ ...prev, notes: text }))}
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowPaymentModal(false)}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              icon="cash"
              onPress={() => {
                if (selectedSalaries.length > 0) {
                  handlePayMultipleSalaries();
                } else if (selectedSalary) {
                  handlePaySalary(selectedSalary.id, paymentData);
                }
              }}
              buttonColor={COLORS.success}
            >
              Confirmer
            </Button>
          </View>
        </Modal>

        {/* Modale Détails Salaire */}
        <Modal
          visible={showSalaryDetailsModal}
          onDismiss={() => setShowSalaryDetailsModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedSalary && (
            <>
              <View style={styles.modalHeader}>
                <Title>Détails du Salaire</Title>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setShowSalaryDetailsModal(false)}
                />
              </View>

              <View style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employé:</Text>
                  <Text style={styles.detailValue}>{selectedSalary.employee_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Matricule:</Text>
                  <Text style={styles.detailValue}>{selectedSalary.matricule}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedSalary.type_employe}</Text>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Salaire Brut:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(selectedSalary.salaire_brut)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>INSS:</Text>
                  <Text style={[styles.detailValue, { color: COLORS.error }]}>
                    {formatCurrency(selectedSalary.deduction_inss)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Salaire Net:</Text>
                  <Text style={[styles.detailValue, { color: COLORS.success, fontWeight: 'bold' }]}>
                    {formatCurrency(selectedSalary.salaire_net)}
                  </Text>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut:</Text>
                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(selectedSalary.statut_paiement) }
                    ]}
                    textStyle={{ color: '#FFF' }}
                  >
                    {selectedSalary.statut_paiement}
                  </Chip>
                </View>
              </View>

              <Button
                mode="contained"
                onPress={() => setShowSalaryDetailsModal(false)}
                style={{ marginTop: 20 }}
              >
                Fermer
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  // ========================================
  // 1. CONTENEURS DE BASE
  // ========================================
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // ========================================
  // 2. HEADER MINIMALISTE
  // ========================================
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerIcon: {
    backgroundColor: COLORS.surfaceAlt,
  },

  headerTitleContainer: {
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '400',
  },

  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },

  // ========================================
  // 3. ONGLETS (TABS) PRINCIPAUX
  // ========================================
  tabsContainer: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
  },

  tabsContent: {
    paddingHorizontal: 20,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },

  tabActive: {
    backgroundColor: COLORS.primary,
  },

  tabLabel: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  tabLabelActive: {
    color: '#FFFFFF',
  },

  // ========================================
  // 4. CONTENU PRINCIPAL
  // ========================================
  content: {
    flex: 1,
  },

  contentContainer: {
    paddingBottom: 30,
  },

  // ========================================
  // 5. CARTES KPI - AFFICHAGE HORIZONTAL RESPONSIVE
  // ========================================
  kpiContainer: {
    flexDirection: 'row',        // ✅ HORIZONTAL FORCÉ
    flexWrap: 'nowrap',          // ✅ PAS DE RETOUR À LA LIGNE
    paddingVertical: 20,
    paddingLeft: 20,
    gap: 16,
    paddingRight: 20,            // ✅ ESPACE À DROITE
  },

  kpiCard: {
    width: getCardWidth(),       // ✅ LARGEUR CALCULÉE DYNAMIQUEMENT
    minWidth: screenWidth < 480 ? screenWidth * 0.65 : 200, // Min pour mobile
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },

  kpiGradient: {
    borderRadius: 12,
    padding: 0,
  },

  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },

  kpiBody: {
    flex: 1,
  },

  kpiValue: {
    fontSize: screenWidth < 480 ? 28 : 32, // ✅ Taille adaptative
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    letterSpacing: -1,
  },

  kpiTitle: {
    fontSize: screenWidth < 480 ? 12 : 13, // ✅ Taille adaptative
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  kpiPercentageContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  kpiPercentage: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },

  kpiProgressContainer: {
    marginTop: 8,
  },

  kpiProgressBar: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },

  kpiProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // ========================================
  // 6. CARTE D'APERÇU
  // ========================================
  overviewCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  cardTitle: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  cardSubtitle: {
    color: COLORS.textSecondary,
    marginTop: 4,
    fontSize: 14,
  },

  periodChip: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 0,
  },

  periodChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // ========================================
  // 7. GRILLE DE STATISTIQUES - HORIZONTAL RESPONSIVE
  // ========================================
  statsGrid: {
    flexDirection: 'row',        // ✅ HORIZONTAL FORCÉ
    flexWrap: 'nowrap',          // ✅ PAS DE RETOUR À LA LIGNE
    gap: 12,
    marginBottom: 20,
    paddingRight: 20,            // ✅ ESPACE À DROITE
  },

  statCard: {
    width: getStatCardWidth(),   // ✅ LARGEUR CALCULÉE DYNAMIQUEMENT
    minWidth: screenWidth < 480 ? screenWidth * 0.35 : 120, // Min pour mobile
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statValue: {
    fontSize: screenWidth < 480 ? 24 : 28, // ✅ Taille adaptative
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    letterSpacing: -0.5,
  },

  statLabel: {
    fontSize: screenWidth < 480 ? 11 : 12, // ✅ Taille adaptative
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ========================================
  // 8. SÉPARATEUR
  // ========================================
  divider: {
    marginVertical: 16,
    backgroundColor: COLORS.divider,
    height: 1,
  },

  // ========================================
  // 9. SECTION DES MONTANTS
  // ========================================
  amountsSection: {
    marginBottom: 16,
  },

  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },

  amountLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  amountLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    fontWeight: '500',
  },

  amountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  amountHighlight: {
    fontSize: 17,
    fontWeight: '700',
  },

  // ========================================
  // 10. SECTION DE PROGRESSION
  // ========================================
  progressSection: {
    marginTop: 8,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },

  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceAlt,
  },

  progressSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
  },

  // ========================================
  // 11. SECTION DE RÉPARTITION
  // ========================================
  repartitionSection: {
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },

  repartitionCard: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  repartitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  repartitionCount: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },

  repartitionBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  repartitionStats: {
    flexDirection: 'row',
    gap: 24,
  },

  repartitionStat: {
    alignItems: 'center',
  },

  repartitionStatLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },

  repartitionStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  repartitionAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },

  // ========================================
  // 12. ONGLETS DE SALAIRES
  // ========================================
  salaryTabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
    gap: 8,
  },

  salaryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  salaryTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  salaryTabLabel: {
    fontSize: 13,
    marginLeft: 6,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  salaryTabLabelActive: {
    color: '#FFFFFF',
  },

  salaryTabBadge: {
    marginLeft: 8,
    backgroundColor: COLORS.error,
  },

  salaryTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // ========================================
  // 13. ÉTAT VIDE
  // ========================================
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },

  emptyStateText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
  },

  // ========================================
  // 14. LISTE DES SALAIRES
  // ========================================
  salariesListContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  selectionCount: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },

  selectionButton: {
    marginLeft: 8,
  },

  salariesScroll: {
    flex: 1,
    padding: 20,
  },

  // ========================================
  // 15. CARTE D'ÉLÉMENT DE SALAIRE
  // ========================================
  salaryItemCard: {
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  salaryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  salaryCheckbox: {
    marginRight: 12,
  },

  salaryEmployee: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  salaryEmployeeInfo: {
    marginLeft: 12,
    flex: 1,
  },

  salaryEmployeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  salaryEmployeeMatricule: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },

  typeChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statusChip: {
    alignSelf: 'flex-start',
  },

  salaryAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    marginTop: 12,
  },

  salaryAmount: {
    alignItems: 'center',
  },

  salaryAmountLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  salaryAmountValue: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },

  salaryNetAmount: {
    color: COLORS.primary,
  },

  salaryPaymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
  },

  salaryPaymentText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },

  salaryReference: {
    fontSize: 11,
    color: COLORS.textLight,
  },

  noConfirmInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },

  noConfirmText: {
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },

  salaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },

  salaryActionButton: {
    flex: 1,
    minWidth: screenWidth < 375 ? '100%' : 100,
  },

  selectModeButton: {
    margin: 20,
  },

  // ========================================
  // 16. DEMANDES DE PAIEMENT
  // ========================================
  requestsScroll: {
    padding: 20,
  },

  requestCard: {
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  requestEmployee: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  requestEmployeeInfo: {
    marginLeft: 12,
  },

  requestEmployeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  requestMatricule: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },

  requestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  requestDays: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },

  requestBody: {
    marginBottom: 12,
  },

  requestAmount: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },

  requestAmountLabel: {
    fontSize: 11,
    color: '#065F46',
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  requestAmountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065F46',
  },

  requestJustification: {
    marginBottom: 10,
  },

  requestJustificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },

  requestJustificationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  requestDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  requestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },

  requestButton: {
    flex: 1,
  },

  // ========================================
  // 17. ANALYTIQUES - HORIZONTAL RESPONSIVE
  // ========================================
  analyticsContainer: {
    padding: 20,
  },

  chartCard: {
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  chart: {
    marginVertical: 12,
    borderRadius: 10,
  },

  // ✅ GRILLE MENSUELLE - HORIZONTAL RESPONSIVE
  monthlyStatsGrid: {
    flexDirection: 'row',        // ✅ HORIZONTAL FORCÉ
    flexWrap: 'nowrap',          // ✅ PAS DE RETOUR À LA LIGNE
    gap: 12,
    paddingRight: 20,            // ✅ ESPACE À DROITE
  },

  monthlyStatCard: {
    width: getMonthlyStatCardWidth(), // ✅ LARGEUR CALCULÉE DYNAMIQUEMENT
    minWidth: screenWidth < 480 ? screenWidth * 0.45 : 160, // Min pour mobile
    backgroundColor: COLORS.surfaceAlt,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },

  monthlyStatMonth: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },

  monthlyStatEmployees: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 8,
  },

  monthlyStatAmount: {
    fontSize: screenWidth < 480 ? 14 : 16, // ✅ Taille adaptative
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },

  monthlyStatDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 8,
  },

  monthlyStatDetail: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },

  typeStatsTable: {
    gap: 10,
  },

  typeStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  typeStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  typeStatColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },

  typeStatName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  typeStatCount: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },

  typeStatRight: {
    alignItems: 'flex-end',
  },

  typeStatAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  typeStatAverage: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },

  confirmationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },

  confirmationStatItem: {
    alignItems: 'center',
  },

  confirmationStatLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  confirmationStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },

  confirmationProgressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: COLORS.surfaceAlt,
  },

  // ========================================
  // 18. RAPPORTS
  // ========================================
  reportsContainer: {
    padding: 20,
  },

  card: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  reportSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },

  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  radioLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 8,
    flex: 1,
  },

  formatButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },

  formatButton: {
    flex: 1,
  },

  generateButton: {
    marginTop: 24,
    paddingVertical: 4,
  },

  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  quickActionText: {
    flex: 1,
    marginLeft: 12,
  },

  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  quickActionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ========================================
  // 19. MODALES
  // ========================================
  modalContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: screenWidth < 768 ? 20 : '20%',
    marginVertical: screenWidth < 768 ? 50 : '10%',
    padding: 24,
    borderRadius: 16,
    maxHeight: screenWidth < 768 ? screenHeight * 0.85 : '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  modalInput: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  detailsContent: {
    marginBottom: 16,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  detailValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },

  // ========================================
  // 20. UTILITAIRES
  // ========================================
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 10,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },

  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '500',
  },

  successContainer: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 10,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },

  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DashboardManagerScreen;