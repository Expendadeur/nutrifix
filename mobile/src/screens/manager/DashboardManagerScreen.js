// frontend/src/screens/manager/DashboardManagerScreen.js
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
  Image
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
  TextInput
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;

const API_URL = 'http://localhost:5000/api/manager';

const DashboardManagerScreen = () => {
  const navigation = useNavigation();

  // États principaux
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // États pour les salaires
  const [salariesData, setSalariesData] = useState({
    overview: null,
    detailed: [],
    notPaid: [],
    paid: [],
    statistics: null,
    paymentRequests: []
  });

  // États pour les filtres
  const [filters, setFilters] = useState({
    search: '',
    type_employe: 'all',
    statut_paiement: 'all',
    confirme_reception: 'all',
    demande_paiement: 'all'
  });

  // États pour les modales
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showSalaryDetailsModal, setShowSalaryDetailsModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // États pour la sélection multiple
  const [selectedSalaries, setSelectedSalaries] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // États pour les onglets
  const [activeTab, setActiveTab] = useState('overview'); // overview, salaries, analytics, reports
  const [activeSalaryTab, setActiveSalaryTab] = useState('all'); // all, paid, notPaid, requests

  // États pour la communication
  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadAllData();

    const interval = setInterval(() => {
      loadAllData(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedPeriod, filters]);

  // Chargement de toutes les données
  const loadAllData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      await Promise.all([
        loadDashboardData(),
        loadSalariesOverview(),
        loadSalariesDetailed(),
        loadSalaryStatistics()
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

  // Charger les données du dashboard
  const loadDashboardData = async () => {
    try {
      const token = await getAuthToken(); // À implémenter
      const response = await axios.get(`${API_URL}/dashboard`, {
        params: { period: selectedPeriod },
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      throw error;
    }
  };

  // Charger vue d'ensemble des salaires
  const loadSalariesOverview = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salaries-overview`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, overview: response.data }));
    } catch (error) {
      console.error('Error loading salaries overview:', error);
    }
  };

  // Charger liste détaillée des salaires
  const loadSalariesDetailed = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salaries-detailed`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          ...filters
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, detailed: response.data }));

      // Charger aussi les listes spécifiques
      await loadNotPaidSalaries();
      await loadPaidSalaries();
      await loadPaymentRequests();
    } catch (error) {
      console.error('Error loading detailed salaries:', error);
    }
  };

  // Charger salaires non payés
  const loadNotPaidSalaries = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salaries-not-paid`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, notPaid: response.data }));
    } catch (error) {
      console.error('Error loading unpaid salaries:', error);
    }
  };

  // Charger salaires payés
  const loadPaidSalaries = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salaries-paid`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, paid: response.data }));
    } catch (error) {
      console.error('Error loading paid salaries:', error);
    }
  };

  // Charger demandes de paiement
  const loadPaymentRequests = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/payment-requests`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          statut: 'en_attente'
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, paymentRequests: response.data }));
    } catch (error) {
      console.error('Error loading payment requests:', error);
    }
  };

  // Charger statistiques des salaires
  const loadSalaryStatistics = async () => {
    try {
      const token = await getAuthToken();
      const currentDate = new Date();
      const response = await axios.get(`${API_URL}/salary-statistics`, {
        params: { year: currentDate.getFullYear() },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalariesData(prev => ({ ...prev, statistics: response.data }));
    } catch (error) {
      console.error('Error loading salary statistics:', error);
    }
  };

  // Payer un salaire
  const handlePaySalary = async (salaryId, paymentData) => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/salaries/${salaryId}/pay`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Salaire payé avec succès');
        loadAllData(true);
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors du paiement');
    }
  };

  // Payer plusieurs salaires
  const handlePayMultipleSalaries = async (paymentData) => {
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
        loadAllData(true);
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors du paiement');
    }
  };

  // Générer un rapport
  const handleGenerateReport = async (reportType, format) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const currentDate = new Date();

      const response = await axios.post(
        `${API_URL}/generate-salary-report`,
        {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          type: reportType,
          format: format
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Télécharger le fichier
        const { fileName, data } = response.data;

        if (isWeb) {
          // Web - télécharger via blob
          const blob = base64ToBlob(data, format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);
        } else {
          // Mobile - sauvegarder et partager
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, data, {
            encoding: FileSystem.EncodingType.Base64
          });
          await Sharing.shareAsync(fileUri);
        }

        Alert.alert('Succès', 'Rapport généré avec succès');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la génération du rapport');
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
      setShowReportModal(false);
    }
  };

  // Fonction utilitaire pour convertir base64 en blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, [selectedPeriod, filters]);

  // Fonction pour obtenir le token (à implémenter selon votre système d'auth)
  const getAuthToken = async () => {
    // ✅ CORRECTION: Récupérer le token depuis AsyncStorage
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.warn('⚠️ Aucun token d\'authentification trouvé');
        return null;
      }
      return token;
    } catch (error) {
      console.error('❌ Erreur récupération token:', error);
      return null;
    }
  };

  // ==================== COMPOSANTS DE RENDU ====================

  // En-tête avec navigation par onglets
  const renderHeader = () => (
    <View style={[styles.header, isWeb && styles.headerWeb]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            Dashboard - {dashboardData?.department_name || 'Département'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="filter-variant"
            size={24}
            onPress={() => setShowFiltersModal(true)}
            color="#FFF"
          />
          <IconButton
            icon="refresh"
            size={24}
            onPress={() => loadAllData()}
            color="#FFF"
          />
          <IconButton
            icon="bell"
            size={24}
            onPress={() => navigation.navigate('Notifications')}
            iconColor="#FFF"
          />
          <IconButton
            icon="message-draw"
            size={24}
            onPress={() => setCommunicationModalVisible(true)}
            iconColor="#FFF"
          />
        </View>
      </View>

      {/* Onglets de navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {[
          { key: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { key: 'salaries', label: 'Salaires', icon: 'payments' },
          { key: 'analytics', label: 'Analytiques', icon: 'analytics' },
          { key: 'reports', label: 'Rapports', icon: 'description' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? '#FFF' : 'rgba(255,255,255,0.7)'}
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
    </View>
  );

  // Vue d'ensemble des KPIs
  const renderKPICards = () => {
    if (!dashboardData) return null;

    const kpis = [
      {
        title: 'Employés Actifs',
        value: dashboardData.kpis.active_employees || 0,
        total: dashboardData.kpis.total_employees || 0,
        icon: 'people',
        color: '#2ECC71',
        trend: dashboardData.kpis.employee_trend,
        onPress: () => navigation.navigate('EquipeRH')
      },
      {
        title: 'Présences Aujourd\'hui',
        value: dashboardData.kpis.present_today || 0,
        total: dashboardData.kpis.total_employees || 0,
        icon: 'check-circle',
        color: '#3498DB',
        trend: dashboardData.kpis.presence_trend,
        percentage: dashboardData.kpis.total_employees > 0
          ? Math.round((dashboardData.kpis.present_today / dashboardData.kpis.total_employees) * 100)
          : 0,
        onPress: () => navigation.navigate('EquipeRH', { tab: 'presences' })
      },
      {
        title: 'Demandes en Attente',
        value: dashboardData.kpis.pending_requests || 0,
        icon: 'pending-actions',
        color: '#F39C12',
        badge: dashboardData.kpis.urgent_requests > 0 ? dashboardData.kpis.urgent_requests : null,
        onPress: () => navigation.navigate('Notifications', { filter: 'pending' })
      },
      {
        title: 'Budget Utilisé',
        value: `${dashboardData.kpis.budget_used_percent || 0}%`,
        subtitle: `${formatCurrency(dashboardData.kpis.budget_used || 0)} / ${formatCurrency(dashboardData.kpis.budget_total || 0)}`,
        icon: 'account-balance-wallet',
        color: (dashboardData.kpis.budget_used_percent || 0) > 90 ? '#E74C3C' : '#9B59B6',
        progress: dashboardData.kpis.budget_used_percent || 0,
        onPress: () => navigation.navigate('FinancierDept')
      }
    ];

    // Ajouter KPIs spécifiques au département
    if (dashboardData.department_type === 'agriculture') {
      kpis.push(
        {
          title: 'Parcelles en Culture',
          value: dashboardData.kpis.parcelles_active || 0,
          total: dashboardData.kpis.parcelles_total || 0,
          icon: 'grass',
          color: '#27AE60',
          onPress: () => navigation.navigate('ModulesOp', { section: 'parcelles' })
        },
        {
          title: 'Production ce Mois',
          value: `${dashboardData.kpis.production_month || 0} kg`,
          icon: 'agriculture',
          color: '#16A085',
          trend: dashboardData.kpis.production_trend,
          onPress: () => navigation.navigate('ModulesOp', { section: 'production' })
        }
      );
    }

    const columns = getGridColumns();
    const cardWidth = isWeb
      ? `${(100 / columns) - 2}%`
      : (screenWidth / columns) - 20;

    return (
      <View style={[styles.kpiContainer, isWeb && styles.kpiContainerWeb]}>
        {kpis.map((kpi, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.kpiCard,
              isWeb ? { width: cardWidth } : { width: cardWidth },
              { backgroundColor: kpi.color }
            ]}
            onPress={kpi.onPress}
          >
            <View style={styles.kpiHeader}>
              <MaterialIcons name={kpi.icon} size={30} color="#FFF" />
              {kpi.badge && (
                <Badge style={styles.kpiBadge}>{kpi.badge}</Badge>
              )}
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>
                {kpi.value}
                {kpi.total && <Text style={styles.kpiTotal}>/{kpi.total}</Text>}
              </Text>
              <Text style={styles.kpiTitle}>{kpi.title}</Text>
              {kpi.subtitle && (
                <Text style={styles.kpiSubtitle}>{kpi.subtitle}</Text>
              )}
              {kpi.percentage !== undefined && (
                <View style={styles.kpiPercentage}>
                  <Text style={styles.kpiPercentageText}>{kpi.percentage}%</Text>
                </View>
              )}
              {kpi.trend !== undefined && (
                <View style={styles.kpiTrend}>
                  <MaterialIcons
                    name={kpi.trend >= 0 ? 'trending-up' : 'trending-down'}
                    size={16}
                    color="#FFF"
                  />
                  <Text style={styles.kpiTrendText}>
                    {Math.abs(kpi.trend)}%
                  </Text>
                </View>
              )}
              {kpi.progress !== undefined && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${kpi.progress}%` }
                    ]}
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Vue d'ensemble des salaires
  const renderSalariesOverview = () => {
    if (!salariesData.overview) return null;

    const { stats, repartition, demandes_en_attente } = salariesData.overview;

    return (
      <Card style={[styles.card, isWeb && styles.cardWeb]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Vue d'ensemble Salaires</Title>
            <Chip
              icon="calendar"
              mode="outlined"
              style={styles.periodChip}
            >
              {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Chip>
          </View>

          {/* Statistiques globales */}
          <View style={[styles.statsGrid, isWeb && styles.statsGridWeb]}>
            <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="people" size={32} color="#27AE60" />
              <Text style={styles.statValue}>{stats.total_employes || 0}</Text>
              <Text style={styles.statLabel}>Total Employés</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcons name="check-circle" size={32} color="#2196F3" />
              <Text style={styles.statValue}>{stats.employes_payes || 0}</Text>
              <Text style={styles.statLabel}>Payés</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="pending" size={32} color="#FF9800" />
              <Text style={styles.statValue}>{stats.employes_non_payes || 0}</Text>
              <Text style={styles.statLabel}>En Attente</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#FCE4EC' }]}>
              <MaterialIcons name="notification-important" size={32} color="#E91E63" />
              <Text style={styles.statValue}>{demandes_en_attente || 0}</Text>
              <Text style={styles.statLabel}>Demandes</Text>
            </View>
          </View>

          {/* Montants */}
          <View style={styles.amountsContainer}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Brut:</Text>
              <Text style={[styles.amountValue, { color: '#5E35B1' }]}>
                {formatCurrency(stats.total_brut || 0)}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Net:</Text>
              <Text style={[styles.amountValue, { color: '#27AE60' }]}>
                {formatCurrency(stats.total_net || 0)}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>INSS:</Text>
              <Text style={[styles.amountValue, { color: '#E74C3C' }]}>
                {formatCurrency(stats.total_inss || 0)}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Montant Payé:</Text>
              <Text style={[styles.amountValue, { color: '#2ECC71', fontWeight: 'bold' }]}>
                {formatCurrency(stats.montant_paye || 0)}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Montant Restant:</Text>
              <Text style={[styles.amountValue, { color: '#F39C12', fontWeight: 'bold' }]}>
                {formatCurrency(stats.montant_restant || 0)}
              </Text>
            </View>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>
              Progression des paiements ({stats.total_employes > 0
                ? Math.round((stats.employes_payes / stats.total_employes) * 100)
                : 0}%)
            </Text>
            <ProgressBar
              progress={stats.total_employes > 0 ? stats.employes_payes / stats.total_employes : 0}
              color="#2ECC71"
              style={styles.progressBarLarge}
            />
          </View>

          {/* Répartition par type */}
          {repartition && repartition.length > 0 && (
            <View style={styles.repartitionSection}>
              <Text style={styles.sectionSubtitle}>Répartition par Type d'Employé</Text>
              {repartition.map((item, index) => (
                <View key={index} style={styles.repartitionItem}>
                  <View style={styles.repartitionLeft}>
                    <Text style={styles.repartitionType}>{item.type_employe}</Text>
                    <Text style={styles.repartitionCount}>
                      {item.nombre} employé{item.nombre > 1 ? 's' : ''} •
                      Payés: {item.payes} • En attente: {item.non_payes}
                    </Text>
                  </View>
                  <Text style={styles.repartitionAmount}>
                    {formatCurrency(item.total_net || 0)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Onglets pour les salaires
  const renderSalaryTabs = () => (
    <View style={styles.subTabsContainer}>
      {[
        { key: 'all', label: 'Tous', count: salariesData.detailed.length },
        { key: 'notPaid', label: 'Non Payés', count: salariesData.notPaid.length },
        { key: 'paid', label: 'Payés', count: salariesData.paid.length },
        { key: 'requests', label: 'Demandes', count: salariesData.paymentRequests.length }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.subTab,
            activeSalaryTab === tab.key && styles.subTabActive
          ]}
          onPress={() => setActiveSalaryTab(tab.key)}
        >
          <Text style={[
            styles.subTabLabel,
            activeSalaryTab === tab.key && styles.subTabLabelActive
          ]}>
            {tab.label}
          </Text>
          {tab.count > 0 && (
            <Badge style={[
              styles.subTabBadge,
              activeSalaryTab === tab.key && styles.subTabBadgeActive
            ]}>
              {tab.count}
            </Badge>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // Liste des salaires (responsive)
  const renderSalariesList = () => {
    let dataToDisplay = [];

    switch (activeSalaryTab) {
      case 'all':
        dataToDisplay = salariesData.detailed;
        break;
      case 'notPaid':
        dataToDisplay = salariesData.notPaid;
        break;
      case 'paid':
        dataToDisplay = salariesData.paid;
        break;
      case 'requests':
        return renderPaymentRequests();
      default:
        dataToDisplay = salariesData.detailed;
    }

    if (dataToDisplay.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={64} color="#BDC3C7" />
          <Text style={styles.emptyStateText}>Aucun salaire à afficher</Text>
        </View>
      );
    }

    // Affichage tableau pour web/desktop
    if (isWeb || isDesktop) {
      return renderSalariesTable(dataToDisplay);
    }

    // Affichage cartes pour mobile/tablette
    return renderSalariesCards(dataToDisplay);
  };

  // Tableau des salaires (web/desktop)
  const renderSalariesTable = (data) => (
    <Card style={[styles.card, styles.tableCard]}>
      <Card.Content>
        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>
            Liste des Salaires ({data.length})
          </Text>
          <View style={styles.tableActions}>
            {selectionMode && selectedSalaries.length > 0 && (
              <>
                <Button
                  mode="contained"
                  icon="cash-multiple"
                  onPress={() => handleBatchPayment()}
                  style={styles.batchButton}
                >
                  Payer ({selectedSalaries.length})
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setSelectionMode(false);
                    setSelectedSalaries([]);
                  }}
                >
                  Annuler
                </Button>
              </>
            )}
            {!selectionMode && activeSalaryTab === 'notPaid' && (
              <Button
                mode="outlined"
                icon="checkbox-marked"
                onPress={() => setSelectionMode(true)}
              >
                Sélectionner
              </Button>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <DataTable>
            <DataTable.Header>
              {selectionMode && (
                <DataTable.Title style={styles.checkboxColumn}>
                  <TouchableOpacity onPress={toggleSelectAll}>
                    <MaterialIcons
                      name={selectedSalaries.length === data.length ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color="#2E86C1"
                    />
                  </TouchableOpacity>
                </DataTable.Title>
              )}
              <DataTable.Title style={styles.tableColumnSmall}>Matricule</DataTable.Title>
              <DataTable.Title style={styles.tableColumnLarge}>Nom Complet</DataTable.Title>
              <DataTable.Title style={styles.tableColumnMedium}>Type</DataTable.Title>
              <DataTable.Title numeric style={styles.tableColumnMedium}>Salaire Brut</DataTable.Title>
              <DataTable.Title numeric style={styles.tableColumnMedium}>Salaire Net</DataTable.Title>
              <DataTable.Title style={styles.tableColumnMedium}>Statut</DataTable.Title>
              {activeSalaryTab === 'paid' && (
                <>
                  <DataTable.Title style={styles.tableColumnMedium}>Date Paiement</DataTable.Title>
                  <DataTable.Title style={styles.tableColumnMedium}>Référence</DataTable.Title>
                </>
              )}
              <DataTable.Title style={styles.tableColumnSmall}>Actions</DataTable.Title>
            </DataTable.Header>

            {data.map((salary) => (
              <DataTable.Row
                key={salary.id}
                style={selectedSalaries.includes(salary.id) ? styles.selectedRow : null}
              >
                {selectionMode && (
                  <DataTable.Cell style={styles.checkboxColumn}>
                    <TouchableOpacity onPress={() => toggleSelectSalary(salary.id)}>
                      <MaterialIcons
                        name={selectedSalaries.includes(salary.id) ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color="#2E86C1"
                      />
                    </TouchableOpacity>
                  </DataTable.Cell>
                )}
                <DataTable.Cell style={styles.tableColumnSmall}>
                  {salary.matricule}
                </DataTable.Cell>
                <DataTable.Cell style={styles.tableColumnLarge}>
                  <View style={styles.employeeCell}>
                    {salary.employee_photo && (
                      <Image
                        source={{ uri: salary.employee_photo }}
                        style={styles.employeePhoto}
                      />
                    )}
                    <Text style={styles.employeeName}>{salary.employee_name}</Text>
                  </View>
                </DataTable.Cell>
                <DataTable.Cell style={styles.tableColumnMedium}>
                  <Chip mode="outlined" compact>
                    {salary.type_employe}
                  </Chip>
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.tableColumnMedium}>
                  {formatCurrency(salary.salaire_brut)}
                </DataTable.Cell>
                <DataTable.Cell numeric style={styles.tableColumnMedium}>
                  <Text style={styles.netSalary}>
                    {formatCurrency(salary.salaire_net)}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell style={styles.tableColumnMedium}>
                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(salary.statut_paiement) }
                    ]}
                    textStyle={{ color: '#FFF' }}
                  >
                    {salary.statut_paiement}
                  </Chip>
                </DataTable.Cell>
                {activeSalaryTab === 'paid' && (
                  <>
                    <DataTable.Cell style={styles.tableColumnMedium}>
                      {salary.date_paiement
                        ? new Date(salary.date_paiement).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.tableColumnMedium}>
                      {salary.reference_paiement || '-'}
                    </DataTable.Cell>
                  </>
                )}
                <DataTable.Cell style={styles.tableColumnSmall}>
                  <View style={styles.actionsCell}>
                    <IconButton
                      icon="eye"
                      size={20}
                      onPress={() => handleViewSalaryDetails(salary)}
                    />
                    {activeSalaryTab === 'notPaid' && (
                      <IconButton
                        icon="cash"
                        size={20}
                        color="#2ECC71"
                        onPress={() => handleQuickPay(salary)}
                      />
                    )}
                  </View>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </ScrollView>
      </Card.Content>
    </Card>
  );

  // Cartes des salaires (mobile/tablette)
  const renderSalariesCards = (data) => (
    <View style={styles.cardsContainer}>
      {data.map((salary) => (
        <Card key={salary.id} style={styles.salaryCard}>
          <Card.Content>
            <View style={styles.salaryCardHeader}>
              <View style={styles.salaryCardEmployee}>
                {salary.employee_photo && (
                  <Image
                    source={{ uri: salary.employee_photo }}
                    style={styles.employeePhotoCard}
                  />
                )}
                <View style={styles.employeeInfo}>
                  <Text style={styles.employeeNameCard}>{salary.employee_name}</Text>
                  <Text style={styles.employeeMatricule}>{salary.matricule}</Text>
                  <Chip mode="outlined" compact style={styles.typeChip}>
                    {salary.type_employe}
                  </Chip>
                </View>
              </View>
              <Chip
                mode="flat"
                style={[
                  styles.statusChipCard,
                  { backgroundColor: getStatusColor(salary.statut_paiement) }
                ]}
                textStyle={{ color: '#FFF', fontSize: 11 }}
              >
                {salary.statut_paiement}
              </Chip>
            </View>

            <View style={styles.salaryCardAmounts}>
              <View style={styles.amountItem}>
                <Text style={styles.amountItemLabel}>Brut</Text>
                <Text style={styles.amountItemValue}>
                  {formatCurrency(salary.salaire_brut)}
                </Text>
              </View>
              <View style={styles.amountItem}>
                <Text style={styles.amountItemLabel}>Net</Text>
                <Text style={[styles.amountItemValue, styles.netAmount]}>
                  {formatCurrency(salary.salaire_net)}
                </Text>
              </View>
            </View>

            {activeSalaryTab === 'paid' && salary.date_paiement && (
              <View style={styles.salaryCardFooter}>
                <View style={styles.paymentInfo}>
                  <MaterialIcons name="event" size={16} color="#7F8C8D" />
                  <Text style={styles.paymentInfoText}>
                    Payé le {new Date(salary.date_paiement).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                {salary.reference_paiement && (
                  <Text style={styles.paymentReference}>
                    Réf: {salary.reference_paiement}
                  </Text>
                )}
              </View>
            )}

            {activeSalaryTab === 'notPaid' && salary.jours_attente && (
              <View style={styles.waitingInfo}>
                <MaterialIcons name="schedule" size={16} color="#F39C12" />
                <Text style={styles.waitingText}>
                  En attente depuis {salary.jours_attente} jour{salary.jours_attente > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <View style={styles.salaryCardActions}>
              <Button
                mode="outlined"
                icon="eye"
                onPress={() => handleViewSalaryDetails(salary)}
                style={styles.cardButton}
              >
                Détails
              </Button>
              {activeSalaryTab === 'notPaid' && (
                <Button
                  mode="contained"
                  icon="cash"
                  onPress={() => handleQuickPay(salary)}
                  style={styles.cardButton}
                  buttonColor="#2ECC71"
                >
                  Payer
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  // Demandes de paiement
  const renderPaymentRequests = () => {
    if (salariesData.paymentRequests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={64} color="#BDC3C7" />
          <Text style={styles.emptyStateText}>Aucune demande en attente</Text>
        </View>
      );
    }

    return (
      <View style={styles.requestsContainer}>
        {salariesData.paymentRequests.map((request) => (
          <Card key={request.id} style={styles.requestCard}>
            <Card.Content>
              <View style={styles.requestHeader}>
                <View style={styles.requestEmployee}>
                  {request.employe_photo && (
                    <Image
                      source={{ uri: request.employe_photo }}
                      style={styles.employeePhotoRequest}
                    />
                  )}
                  <View>
                    <Text style={styles.requestEmployeeName}>{request.employe_nom}</Text>
                    <Text style={styles.requestMatricule}>{request.matricule}</Text>
                  </View>
                </View>
                <View style={styles.requestWaiting}>
                  <MaterialIcons name="schedule" size={20} color="#F39C12" />
                  <Text style={styles.requestDays}>{request.jours_attente}j</Text>
                </View>
              </View>

              <View style={styles.requestBody}>
                <View style={styles.requestAmount}>
                  <Text style={styles.requestAmountLabel}>Montant demandé</Text>
                  <Text style={styles.requestAmountValue}>
                    {formatCurrency(request.montant)}
                  </Text>
                </View>

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
                    Demandé le {new Date(request.date_demande).toLocaleDateString('fr-FR')}
                  </Text>
                  <Chip mode="outlined" compact>
                    {request.urgence}
                  </Chip>
                </View>
              </View>

              <View style={styles.requestActions}>
                <Button
                  mode="outlined"
                  icon="close"
                  onPress={() => handleRejectRequest(request)}
                  style={styles.requestButton}
                  textColor="#E74C3C"
                >
                  Rejeter
                </Button>
                <Button
                  mode="contained"
                  icon="check"
                  onPress={() => handleApproveRequest(request)}
                  style={styles.requestButton}
                  buttonColor="#2ECC71"
                >
                  Approuver & Payer
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  };

  // Analytiques - Statistiques annuelles
  const renderAnalytics = () => {
    if (!salariesData.statistics) return null;

    const { evolution_mensuelle, par_type_employe, taux_confirmation } = salariesData.statistics;

    return (
      <ScrollView style={styles.analyticsContainer}>
        {/* Évolution mensuelle */}
        <Card style={[styles.card, styles.chartCard]}>
          <Card.Content>
            <Title style={styles.cardTitle}>Évolution Mensuelle des Salaires</Title>

            {evolution_mensuelle && evolution_mensuelle.length > 0 && (
              <LineChart
                data={{
                  labels: evolution_mensuelle.map(m => `M${m.mois}`),
                  datasets: [{
                    data: evolution_mensuelle.map(m => parseFloat(m.total_net)),
                    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
                    strokeWidth: 2
                  }]
                }}
                width={isWeb ? Math.min(screenWidth - 100, 800) : screenWidth - 70}
                height={250}
                chartConfig={{
                  backgroundColor: '#FFF',
                  backgroundGradientFrom: '#FFF',
                  backgroundGradientTo: '#FFF',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: '#2ECC71'
                  }
                }}
                bezier
                style={styles.chart}
              />
            )}

            <View style={styles.monthlyStatsGrid}>
              {evolution_mensuelle && evolution_mensuelle.map((month, index) => (
                <View key={index} style={styles.monthlyStatCard}>
                  <Text style={styles.monthlyStatMonth}>Mois {month.mois}</Text>
                  <Text style={styles.monthlyStatEmployees}>
                    {month.nombre_employes} employés
                  </Text>
                  <Text style={styles.monthlyStatAmount}>
                    {formatCurrency(month.total_net)}
                  </Text>
                  <View style={styles.monthlyStatDetails}>
                    <Text style={styles.monthlyStatDetail}>
                      Payés: {month.payes}
                    </Text>
                    {month.delai_moyen_paiement && (
                      <Text style={styles.monthlyStatDetail}>
                        Délai: {Math.round(month.delai_moyen_paiement)}j
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Par type d'employé */}
        <Card style={[styles.card, styles.chartCard]}>
          <Card.Content>
            <Title style={styles.cardTitle}>Répartition par Type d'Employé</Title>

            {par_type_employe && par_type_employe.length > 0 && (
              <>
                <PieChart
                  data={par_type_employe.map((type, index) => ({
                    name: type.type_employe,
                    population: parseFloat(type.total_annuel),
                    color: getPieChartColor(index),
                    legendFontColor: '#7F8C8D',
                    legendFontSize: 12
                  }))}
                  width={isWeb ? Math.min(screenWidth - 100, 800) : screenWidth - 70}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />

                <View style={styles.typeStatsTable}>
                  {par_type_employe.map((type, index) => (
                    <View key={index} style={styles.typeStatRow}>
                      <View style={styles.typeStatLeft}>
                        <View style={[
                          styles.typeStatColor,
                          { backgroundColor: getPieChartColor(index) }
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
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Taux de confirmation */}
        <Card style={[styles.card]}>
          <Card.Content>
            <Title style={styles.cardTitle}>Taux de Confirmation des Réceptions</Title>

            <View style={styles.confirmationStats}>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Salaires Payés</Text>
                <Text style={styles.confirmationStatValue}>
                  {taux_confirmation.total_salaires_payes || 0}
                </Text>
              </View>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Confirmés</Text>
                <Text style={[styles.confirmationStatValue, { color: '#2ECC71' }]}>
                  {taux_confirmation.total_confirmes || 0}
                </Text>
              </View>
              <View style={styles.confirmationStatItem}>
                <Text style={styles.confirmationStatLabel}>Taux</Text>
                <Text style={[styles.confirmationStatValue, { color: '#3498DB' }]}>
                  {taux_confirmation.taux_confirmation || 0}%
                </Text>
              </View>
            </View>

            <ProgressBar
              progress={(taux_confirmation.taux_confirmation || 0) / 100}
              color="#2ECC71"
              style={styles.confirmationProgressBar}
            />
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  // Section Rapports
  const renderReports = () => (
    <View style={styles.reportsContainer}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Générer un Rapport</Title>
          <Paragraph style={styles.cardSubtitle}>
            Sélectionnez le type de rapport à générer
          </Paragraph>

          <View style={styles.reportOptions}>
            <TouchableOpacity
              style={styles.reportOption}
              onPress={() => handleGenerateReport('complete', 'excel')}
            >
              <MaterialIcons name="insert-drive-file" size={48} color="#27AE60" />
              <Text style={styles.reportOptionTitle}>Rapport Complet</Text>
              <Text style={styles.reportOptionDesc}>
                Tous les salaires avec détails
              </Text>
              <Button mode="contained" icon="download" buttonColor="#27AE60">
                Excel
              </Button>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportOption}
              onPress={() => handleGenerateReport('salaires', 'excel')}
            >
              <MaterialIcons name="table-chart" size={48} color="#3498DB" />
              <Text style={styles.reportOptionTitle}>Liste Salaires</Text>
              <Text style={styles.reportOptionDesc}>
                Liste simple des salaires
              </Text>
              <Button mode="contained" icon="download" buttonColor="#3498DB">
                Excel
              </Button>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportOption}
              onPress={() => handleGenerateReport('statistiques', 'excel')}
            >
              <MaterialIcons name="pie-chart" size={48} color="#9B59B6" />
              <Text style={styles.reportOptionTitle}>Statistiques</Text>
              <Text style={styles.reportOptionDesc}>
                Analyses et graphiques
              </Text>
              <Button mode="contained" icon="download" buttonColor="#9B59B6">
                Excel
              </Button>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportOption}
              onPress={() => handleGenerateReport('paiements', 'excel')}
            >
              <MaterialIcons name="payment" size={48} color="#E67E22" />
              <Text style={styles.reportOptionTitle}>Paiements</Text>
              <Text style={styles.reportOptionDesc}>
                Historique des paiements
              </Text>
              <Button mode="contained" icon="download" buttonColor="#E67E22">
                Excel
              </Button>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>

      {/* Rapports récents */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Rapports Récents</Title>
          <Paragraph style={styles.emptyStateText}>
            Les rapports générés apparaîtront ici
          </Paragraph>
        </Card.Content>
      </Card>
    </View>
  );

  // ==================== FONCTIONS UTILITAIRES ====================

  const getGridColumns = () => {
    if (isDesktop) return 4;
    if (isTablet) return 3;
    return 2;
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
      case 'payé': return '#2ECC71';
      case 'calculé': return '#F39C12';
      case 'reporté': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getPieChartColor = (index) => {
    const colors = ['#2ECC71', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#1ABC9C'];
    return colors[index % colors.length];
  };

  const toggleSelectSalary = (salaryId) => {
    setSelectedSalaries(prev =>
      prev.includes(salaryId)
        ? prev.filter(id => id !== salaryId)
        : [...prev, salaryId]
    );
  };

  const toggleSelectAll = () => {
    const currentData = activeSalaryTab === 'notPaid'
      ? salariesData.notPaid
      : salariesData.detailed;

    if (selectedSalaries.length === currentData.length) {
      setSelectedSalaries([]);
    } else {
      setSelectedSalaries(currentData.map(s => s.id));
    }
  };

  const handleViewSalaryDetails = (salary) => {
    setSelectedSalary(salary);
    setShowSalaryDetailsModal(true);
  };

  const handleQuickPay = (salary) => {
    Alert.alert(
      'Payer le salaire',
      `Confirmer le paiement de ${formatCurrency(salary.salaire_net)} à ${salary.employee_name}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Payer',
          onPress: () => {
            // Ouvrir modale de paiement avec les détails
            handlePaySalary(salary.id, {
              mode_paiement: 'virement',
              date_paiement: new Date().toISOString().split('T')[0]
            });
          }
        }
      ]
    );
  };

  const handleBatchPayment = () => {
    Alert.alert(
      'Paiement Groupé',
      `Payer ${selectedSalaries.length} salaire(s)?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Payer',
          onPress: () => {
            handlePayMultipleSalaries({
              mode_paiement: 'virement',
              date_paiement: new Date().toISOString().split('T')[0]
            });
          }
        }
      ]
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
      Alert.alert('Erreur', error.response?.data?.error || 'Erreur lors du traitement');
    }
  };

  const handleRejectRequest = async (request) => {
    Alert.prompt(
      'Rejeter la demande',
      'Raison du rejet:',
      async (reason) => {
        try {
          const token = await getAuthToken();
          await axios.post(
            `${API_URL}/payment-requests/${request.id}/process`,
            {
              action: 'reject',
              commentaire: reason
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          Alert.alert('Succès', 'Demande rejetée');
          loadAllData(true);
        } catch (error) {
          Alert.alert('Erreur', 'Erreur lors du rejet');
        }
      }
    );
  };

  const handleSendMessage = async () => {
    if (!messageSubject.trim() || !messageBody.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
      return;
    }

    try {
      setIsSending(true);
      const token = await getAuthToken();

      const response = await axios.post(`${API_URL.replace('/api/manager', '')}/api/notifications/contact-admin`, {
        sujet: messageSubject,
        message: messageBody
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alert.alert('Succès', 'Votre message a été envoyé à l\'administration');
        setCommunicationModalVisible(false);
        setMessageSubject('');
        setMessageBody('');
      } else {
        Alert.alert('Erreur', response.data.message || 'Impossible d\'envoyer le message');
      }
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  // ==================== RENDU PRINCIPAL ====================

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isWeb && styles.containerWeb]}>
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
        {/* Modale Filtres */}
        <Modal
          visible={showFiltersModal}
          onDismiss={() => setShowFiltersModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title>Filtres</Title>
          {/* Implémenter les filtres ici */}
          <Button onPress={() => setShowFiltersModal(false)}>Fermer</Button>
        </Modal>

        {/* Modale Détails Salaire */}
        <Modal
          visible={showSalaryDetailsModal}
          onDismiss={() => setShowSalaryDetailsModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedSalary && (
            <>
              <Title>Détails du Salaire</Title>
              {/* Afficher les détails complets */}
              <Button onPress={() => setShowSalaryDetailsModal(false)}>Fermer</Button>
            </>
          )}
        </Modal>

        {/* Modale Communication Admin */}
        <Modal
          visible={communicationModalVisible}
          onDismiss={() => setCommunicationModalVisible(false)}
          contentContainerStyle={[styles.commModalContainer, isWeb && { width: 500 }]}
        >
          <View style={styles.commModalHeader}>
            <View style={styles.commModalIconWrapper}>
              <MaterialIcons name="contact-support" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.commModalTitle}>Contacter l'Admin</Text>
              <Text style={styles.commModalSubtitle}>Envoyez un message à l'administration</Text>
            </View>
            <IconButton
              icon="close"
              onPress={() => setCommunicationModalVisible(false)}
            />
          </View>

          <ScrollView style={styles.commModalBody}>
            <Text style={styles.commInputLabel}>Sujet</Text>
            <TextInput
              mode="outlined"
              placeholder="Sujet de votre message..."
              value={messageSubject}
              onChangeText={setMessageSubject}
              style={styles.commInput}
            />

            <Text style={styles.commInputLabel}>Message</Text>
            <TextInput
              mode="outlined"
              placeholder="Votre message détaillé..."
              value={messageBody}
              onChangeText={setMessageBody}
              multiline
              numberOfLines={6}
              style={[styles.commInput, { height: 120 }]}
            />
          </ScrollView>

          <View style={styles.commModalFooter}>
            <Button
              mode="outlined"
              onPress={() => setCommunicationModalVisible(false)}
              style={styles.commFooterBtn}
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSendMessage}
              style={[styles.commFooterBtn, { flex: 2 }]}
              loading={isSending}
              disabled={isSending || !messageSubject.trim() || !messageBody.trim()}
              icon="send"
            >
              Envoyer
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  containerWeb: {
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  loadingText: {
    marginTop: 10,
    color: '#7F8C8D',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerWeb: {
    borderRadius: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  kpiContainerWeb: {
    padding: 20,
  },
  kpiCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  kpiContent: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  kpiTotal: {
    fontSize: 18,
    fontWeight: 'normal',
    opacity: 0.8,
  },
  kpiTitle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 5,
    opacity: 0.9,
  },
  kpiSubtitle: {
    fontSize: 11,
    color: '#FFF',
    marginTop: 2,
    opacity: 0.7,
  },
  kpiPercentage: {
    marginTop: 8,
  },
  kpiPercentageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  kpiTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  kpiTrendText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 15,
    borderRadius: 15,
    elevation: 2,
  },
  cardWeb: {
    marginHorizontal: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    color: '#7F8C8D',
    marginTop: 5,
  },
  periodChip: {
    backgroundColor: '#F8F9F9',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsGridWeb: {
    gap: 15,
  },
  statCard: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  amountsContainer: {
    backgroundColor: '#F8F9F9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  amountLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  progressSection: {
    marginTop: 15,
  },
  progressLabel: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarLarge: {
    height: 10,
    borderRadius: 5,
  },
  repartitionSection: {
    marginTop: 20,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 10,
  },
  repartitionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
    marginBottom: 8,
  },
  repartitionLeft: {
    flex: 1,
  },
  repartitionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  repartitionCount: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  repartitionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  subTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9F9',
  },
  subTabActive: {
    backgroundColor: '#2E86C1',
  },
  subTabLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  subTabLabelActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  subTabBadge: {
    marginLeft: 8,
    backgroundColor: '#E74C3C',
  },
  subTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyStateText: {
    marginTop: 15,
    fontSize: 16,
    color: '#95A5A6',
    textAlign: 'center',
  },
  tableCard: {
    marginHorizontal: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tableActions: {
    flexDirection: 'row',
    gap: 10,
  },
  batchButton: {
    marginRight: 10,
  },
  checkboxColumn: {
    width: 50,
  },
  tableColumnSmall: {
    minWidth: 100,
  },
  tableColumnMedium: {
    minWidth: 150,
  },
  tableColumnLarge: {
    minWidth: 200,
  },
  selectedRow: {
    backgroundColor: '#E3F2FD',
  },
  employeeCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeePhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  netSalary: {
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  actionsCell: {
    flexDirection: 'row',
  },
  cardsContainer: {
    padding: 10,
  },
  salaryCard: {
    marginBottom: 15,
    borderRadius: 12,
    elevation: 2,
  },
  salaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  salaryCardEmployee: {
    flexDirection: 'row',
    flex: 1,
  },
  employeePhotoCard: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeNameCard: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  employeeMatricule: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  typeChip: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  statusChipCard: {
    alignSelf: 'flex-start',
  },
  salaryCardAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
    marginBottom: 10,
  },
  amountItem: {
    alignItems: 'center',
  },
  amountItemLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  amountItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  netAmount: {
    color: '#2ECC71',
  },
  salaryCardFooter: {
    marginTop: 10,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  paymentInfoText: {
    fontSize: 13,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  paymentReference: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 5,
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  waitingText: {
    fontSize: 13,
    color: '#F39C12',
    marginLeft: 8,
    fontWeight: '500',
  },
  salaryCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  cardButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  requestsContainer: {
    padding: 10,
  },
  requestCard: {
    marginBottom: 15,
    borderRadius: 12,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  requestEmployee: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  employeePhotoRequest: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },
  requestEmployeeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  requestMatricule: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  requestWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  requestDays: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F39C12',
    marginLeft: 5,
  },
  requestBody: {
    marginBottom: 15,
  },
  requestAmount: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  requestAmountLabel: {
    fontSize: 12,
    color: '#27AE60',
    marginBottom: 5,
  },
  requestAmountValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  requestJustification: {
    marginBottom: 10,
  },
  requestJustificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 5,
  },
  requestJustificationText: {
    fontSize: 13,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDate: {
    fontSize: 12,
    color: '#95A5A6',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  requestButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  analyticsContainer: {
    flex: 1,
  },
  chartCard: {
    marginBottom: 20,
  },
  chart: {
    marginVertical: 10,
    borderRadius: 16,
  },
  monthlyStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  monthlyStatCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#F8F9F9',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2ECC71',
  },
  monthlyStatMonth: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 5,
  },
  monthlyStatEmployees: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  monthlyStatAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginBottom: 8,
  },
  monthlyStatDetails: {
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
    paddingTop: 8,
  },
  monthlyStatDetail: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 2,
  },
  typeStatsTable: {
    marginTop: 20,
  },
  typeStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
    marginBottom: 8,
  },
  typeStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeStatColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  typeStatName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  typeStatCount: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  typeStatRight: {
    alignItems: 'flex-end',
  },
  typeStatAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  typeStatAverage: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  confirmationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    marginBottom: 15,
  },
  confirmationStatItem: {
    alignItems: 'center',
  },
  confirmationStatLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  confirmationStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  confirmationProgressBar: {
    height: 10,
    borderRadius: 5,
  },
  reportsContainer: {
    padding: 10,
  },
  reportOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginTop: 20,
  },
  reportOption: {
    flex: 1,
    minWidth: 250,
    backgroundColor: '#F8F9F9',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  reportOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  reportOptionDesc: {
    fontSize: 13,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
});

export default DashboardManagerScreen;