// frontend/src/screens/manager/ModulesOperationnelsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FlatList,
  StatusBar,
  SafeAreaView,
  Image,
  ActivityIndicator as RNActivityIndicator
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Searchbar,
  Chip,
  Avatar,
  Button,
  Modal,
  Portal,
  TextInput,
  DataTable,
  ActivityIndicator,
  FAB,
  ProgressBar,
  Divider,
  Badge,
  Surface,
  Menu,
  IconButton
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== API CONFIGURATION ====================
const API_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'https://nutrifix-1-twdf.onrender.com/api'
    : 'https://nutrifix-1-twdf.onrender.com/api'
  : 'https://nutrifix-1-twdf.onrender.com/api';

// Créer une instance axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});


// Intercepteur pour ajouter le token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Rediriger vers login si non autorisé
      AsyncStorage.removeItem('userToken');
      // Navigation sera gérée dans le composant
    }
    return Promise.reject(error);
  }
);

// ==================== RESPONSIVE UTILITIES ====================
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;
const isLargeDesktop = screenWidth >= 1440;

// Responsive breakpoints
const getResponsiveValue = (mobile, tablet, desktop, largeDesktop) => {
  if (isLargeDesktop && largeDesktop !== undefined) return largeDesktop;
  if (isDesktop && desktop !== undefined) return desktop;
  if (isTablet && tablet !== undefined) return tablet;
  return mobile;
};

// Grid columns calculation
const getGridColumns = () => {
  return getResponsiveValue(1, 2, 3, 4);
};

// Card width calculation
const getCardWidth = () => {
  const columns = getGridColumns();
  const padding = getResponsiveValue(15, 20, 25, 30);
  const gap = 10;
  return (screenWidth - (padding * 2) - (gap * (columns - 1))) / columns;
};

const ModulesOperationnelsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // ==================== STATE MANAGEMENT ====================
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [departmentType, setDepartmentType] = useState(null);
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('grid'); // grid or list

  // Common states
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [operationModalVisible, setOperationModalVisible] = useState(false);
  const [operationMode, setOperationMode] = useState('create'); // 'create' or 'edit'
  const [filter, setFilter] = useState('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [deptMenuVisible, setDeptMenuVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Agriculture specific
  const [parcelles, setParcelles] = useState([]);
  const [cultures, setCultures] = useState([]);
  const [intrants, setIntrants] = useState([]);
  const [recoltes, setRecoltes] = useState([]);

  // Elevage specific
  const [animaux, setAnimaux] = useState([]);
  const [productionLait, setProductionLait] = useState([]);
  const [productionOeufs, setProductionOeufs] = useState([]);
  const [alimentsBetail, setAlimentsBetail] = useState([]);

  // Flotte specific
  const [vehicules, setVehicules] = useState([]);
  const [missions, setMissions] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [frais, setFrais] = useState([]);

  // Commercial specific
  const [commandes, setCommandes] = useState([]);
  const [clients, setClients] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [factures, setFactures] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [companySettings, setCompanySettings] = useState(null);


  // Finance specific
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);

  // Statistics
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    alerts: 0,
    value: 0
  });

  // Transaction States
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('vente'); // 'vente' or 'achat'
  const [transactionItem, setTransactionItem] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    montant: '',
    client_id: '',
    fournisseur_id: '',
    mode_paiement: 'especes',
    description: ''
  });

  // ==================== API CALLS ====================
  // Remplacer la fonction loadDepartmentInfo (ligne ~135) par :

  const loadDepartmentInfo = async () => {
    try {
      setLoading(true);

      // Fetch user role and primary department info
      const [infoResponse, userRoleFromStorage] = await Promise.all([
        api.get('/manager/department-info'),
        AsyncStorage.getItem('userRole')
      ]);

      const info = infoResponse.data;
      const role = userRoleFromStorage || 'manager'; // Default to manager if not found

      setDepartmentInfo(info);
      setDepartmentType(info.type);
      setUserRole(role);

      // If manager or admin, fetch all departments for switcher
      if (role === 'manager' || role === 'admin') {
        try {
          const deptsResponse = await api.get('/personnel/departements');
          if (deptsResponse.data.success) {
            setAvailableDepartments(deptsResponse.data.data);
          }
        } catch (deptsError) {
          console.error('Error fetching departments:', deptsError);
        }
      }

      // Set default section based on department
      const defaultSections = {
        finance: 'finance',
        agriculture: 'parcelles',
        elevage: 'cheptel',
        flotte: 'vehicules',
        commercial: 'commandes'
      };

      if (!activeSection || activeSection === 'overview') {
        setActiveSection(defaultSections[info.type] || 'overview');
      }

    } catch (error) {
      console.error('Error loading department info:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations du département');

      if (error.response?.status === 401) {
        navigation.replace('Login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const response = await api.get('/admin/company-settings');
      if (response.data.success) {
        setCompanySettings(response.data.data);
        console.log('✅ Paramètres entreprise chargés:', response.data.data.nom_entreprise);
      }
    } catch (error) {
      console.error('❌ Erreur chargement paramètres entreprise:', error);
      // Ne pas bloquer l'application si les paramètres ne sont pas disponibles
    }
  };


  const switchDepartment = (dept) => {
    setDepartmentInfo(dept);
    setDepartmentType(dept.type);
    setDeptMenuVisible(false);

    // Reset section for new department
    const defaultSections = {
      finance: 'finance',
      agriculture: 'parcelles',
      elevage: 'cheptel',
      flotte: 'vehicules',
      commercial: 'commandes'
    };
    setActiveSection(defaultSections[dept.type] || 'overview');
  };

  const loadAgricultureData = async () => {
    try {
      switch (activeSection) {
        case 'parcelles':
          const parcellesRes = await api.get('/manager/parcelles');
          setParcelles(parcellesRes.data);
          setData(parcellesRes.data);
          break;
        case 'cultures':
          const culturesRes = await api.get('/manager/cultures');
          setCultures(culturesRes.data);
          setData(culturesRes.data);
          break;
        case 'intrants':
          const intrantsRes = await api.get('/manager/intrants');
          setIntrants(intrantsRes.data);
          setData(intrantsRes.data);
          break;
        case 'production':
          const recoltesRes = await api.get('/manager/recoltes');
          setRecoltes(recoltesRes.data);
          setData(recoltesRes.data);
          break;
        case 'overview':
          await loadOverviewData('agriculture');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading agriculture data:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les données agricoles');
    }
  };

  const loadElevageData = async () => {
    try {
      switch (activeSection) {
        case 'cheptel':
          const animauxRes = await api.get('/manager/animaux');
          setAnimaux(animauxRes.data);
          setData(animauxRes.data);
          break;
        case 'production':
          const [laitRes, oeufsRes] = await Promise.all([
            api.get('/manager/production-lait'),
            api.get('/manager/production-oeufs')
          ]);
          setProductionLait(laitRes.data);
          setProductionOeufs(oeufsRes.data);
          setData([...laitRes.data, ...oeufsRes.data]);
          break;
        case 'aliments':
          const alimentsRes = await api.get('/manager/aliments-betail');
          setAlimentsBetail(alimentsRes.data);
          setData(alimentsRes.data);
          break;
        case 'overview':
          await loadOverviewData('elevage');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading elevage data:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les données d\'élevage');
    }
  };

  const loadFlotteData = async () => {
    try {
      switch (activeSection) {
        case 'vehicules':
          const vehiculesRes = await api.get('/manager/vehicules-department');
          setVehicules(vehiculesRes.data);
          setData(vehiculesRes.data);
          break;
        case 'missions':
          const missionsRes = await api.get('/manager/missions-department');
          setMissions(missionsRes.data);
          setData(missionsRes.data);
          break;
        case 'maintenance':
          const maintenancesRes = await api.get('/manager/maintenances-department');
          setMaintenances(maintenancesRes.data);
          setData(maintenancesRes.data);
          break;
        case 'frais':
          const fraisRes = await api.get('/manager/frais-department');
          setFrais(fraisRes.data);
          setData(fraisRes.data);
          break;
        case 'overview':
          await loadOverviewData('flotte');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading flotte data:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les données de flotte');
    }
  };

  const loadCommercialData = async () => {
    try {
      switch (activeSection) {
        case 'commandes':
          const commandesRes = await api.get('/manager/commandes-department');
          setCommandes(commandesRes.data);
          setData(commandesRes.data);
          break;
        case 'factures':
          await loadFactures();
          break;
        case 'clients':
          const clientsRes = await api.get('/manager/clients-department');
          setClients(clientsRes.data);
          setData(clientsRes.data);
          break;
        case 'fournisseurs':
          const fournisseursRes = await api.get('/manager/fournisseurs-department');
          setFournisseurs(fournisseursRes.data);
          setData(fournisseursRes.data);
          break;
        case 'factures':
          await loadFactures();
          break;
        case 'stocks':
          const stocksRes = await api.get('/manager/stocks-department');
          setStocks(stocksRes.data);
          setData(stocksRes.data);
          break;
        case 'overview':
          await loadOverviewData('commercial');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading commercial data:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les données commerciales');
    }
  };

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      switch (activeSection) {
        case 'budgets':
          const budgetsRes = await api.get('/manager/budget-details');
          const budgetData = budgetsRes.data ? [budgetsRes.data] : [];
          setBudgets(budgetData);
          setData(budgetData);
          break;
        case 'expenses':
          const expensesRes = await api.get('/manager/department-expenses');
          setExpenses(expensesRes.data);
          setData(expensesRes.data);
          break;
        case 'revenues':
          const revenuesRes = await api.get('/manager/department-revenues');
          setRevenues(revenuesRes.data);
          setData(revenuesRes.data);
          break;
        case 'overview':
          await loadOverviewData('finance');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading finance data:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les données financières');
    } finally {
      setLoading(false);
    }
  };

  const loadFactures = async () => {
    try {
      setLoading(true);
      const response = await api.get('/finance/factures');
      const data = response.data.data || response.data;
      setFactures(data);
      setData(data);
    } catch (error) {
      console.error('Error loading factures:', error);
      Alert.alert('Erreur', 'Impossible de charger les factures');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFacture = async (facture) => {
    try {
      setLoading(true);
      const response = await api.get(`/finance/factures/${facture.id}`);
      setSelectedInvoice(response.data.data || response.data);
      setInvoiceModalVisible(true);
    } catch (error) {
      console.error('Error viewing invoice:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la facture');
    } finally {
      setLoading(false);
    }
  };

  // Transaction Handlers
  const handleOpenTransaction = (type, item = null) => {
    setTransactionType(type);
    setTransactionItem(item);

    // Pré-remplir description et montant si possible
    let description = '';
    let montant = '';

    if (item) {
      if (departmentType === 'agriculture') {
        description = type === 'vente' ? `Vente ${item.nom_parcelle || item.nom_culture}` : `Achat pour ${item.nom_parcelle}`;
      } else if (departmentType === 'elevage') {
        if (item.numero_identification) description = `Vente animal ${item.numero_identification}`;
        else if (item.type) description = `Vente production ${item.type}`;
        else description = `Vente ${item.nom_aliment}`;
      } else if (departmentType === 'flotte') {
        description = `Vente véhicule ${item.immatriculation}`;
      }
    }

    setTransactionForm({
      montant: montant,
      client_id: '',
      fournisseur_id: '',
      mode_paiement: 'especes',
      description: description
    });

    setTransactionModalVisible(true);
  };

  const handleSubmitTransaction = async () => {
    try {
      if (!transactionForm.montant || !transactionForm.description) {
        Alert.alert('Erreur', 'Veuillez remplir le montant et la description');
        return;
      }

      setTransactionLoading(true);

      const payload = {
        type: transactionType,
        montant: parseFloat(transactionForm.montant),
        mode_paiement: transactionForm.mode_paiement,
        description: transactionForm.description,
        client_id: transactionForm.client_id,
        fournisseur_id: transactionForm.fournisseur_id,
        date_transaction: new Date().toISOString() // Utiliser date du jour
      };

      // Ajouter infos spécifiques à l'article
      if (transactionItem) {
        if (departmentType === 'agriculture') {
          payload.article_type = 'parcelle'; // Simplification, à affiner selon l'item réel
          payload.article_id = transactionItem.id;
        } else if (departmentType === 'elevage') {
          if (transactionItem.numero_identification) payload.article_type = 'animal';
          else if (transactionItem.type === 'lait') payload.article_type = 'produit_lait'; // ou autre identifiant
          else if (transactionItem.type === 'oeuf') payload.article_type = 'produit_oeuf';

          payload.article_id = transactionItem.id;
        } else if (departmentType === 'flotte') {
          payload.article_type = 'vehicule';
          payload.article_id = transactionItem.id;
        }
      }

      const response = await api.post('/manager/finances/transaction-rapide', payload);

      if (response.data.success) {
        setTransactionModalVisible(false);
        Alert.alert('Succès', 'Transaction enregistrée !');
        // Recharger les données
        if (activeSection === 'parcelles') loadAgricultureData();
        else if (activeSection === 'cheptel') loadElevageData();
        else if (activeSection === 'vehicules') loadFlotteData();

        // Optionnel: Afficher la facture
        // Afficher la facture générée
        if (response.data.commandeId) {
          handleViewFacture({ id: response.data.commandeId });
        }
      }

    } catch (error) {
      console.error('Error submitting transaction:', error);
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible d\'enregistrer la transaction');
    } finally {
      setTransactionLoading(false);
    }
  };

  const loadOverviewData = async (type) => {
    try {
      switch (type) {
        case 'agriculture':
          const [p, c, i, r] = await Promise.all([
            api.get('/manager/parcelles'),
            api.get('/manager/cultures'),
            api.get('/manager/intrants'),
            api.get('/manager/recoltes')
          ]);
          setData([
            { type: 'parcelles', count: p.data.length, data: p.data },
            { type: 'cultures', count: c.data.length, data: c.data },
            { type: 'intrants', count: i.data.length, data: i.data },
            { type: 'recoltes', count: r.data.length, data: r.data }
          ]);
          break;
        case 'elevage':
          const [a, pl, po, ab] = await Promise.all([
            api.get('/manager/animaux'),
            api.get('/manager/production-lait'),
            api.get('/manager/production-oeufs'),
            api.get('/manager/aliments-betail')
          ]);
          setData([
            { type: 'animaux', count: a.data.length, data: a.data },
            { type: 'lait', count: pl.data.length, data: pl.data },
            { type: 'oeufs', count: po.data.length, data: po.data },
            { type: 'aliments', count: ab.data.length, data: ab.data }
          ]);
          break;
        case 'flotte':
          const [v, m, mt, f] = await Promise.all([
            api.get('/manager/vehicules-department'),
            api.get('/manager/missions-department'),
            api.get('/manager/maintenances-department'),
            api.get('/manager/frais-department')
          ]);
          setData([
            { type: 'vehicules', count: v.data.length, data: v.data },
            { type: 'missions', count: m.data.length, data: m.data },
            { type: 'maintenances', count: mt.data.length, data: mt.data },
            { type: 'frais', count: f.data.length, data: f.data }
          ]);
          break;
        case 'commercial':
          const [cmd, cl, fr, st] = await Promise.all([
            api.get('/manager/commandes-department'),
            api.get('/manager/clients-department'),
            api.get('/manager/fournisseurs-department'),
            api.get('/manager/stocks-department')
          ]);
          setData([
            { type: 'commandes', count: cmd.data.length, data: cmd.data },
            { type: 'clients', count: cl.data.length, data: cl.data },
            { type: 'fournisseurs', count: fr.data.length, data: fr.data },
            { type: 'stocks', count: st.data.length, data: st.data }
          ]);
          break;
        case 'finance':
          const [bo, bd, de, dr] = await Promise.all([
            api.get('/manager/budget-overview'),
            api.get('/manager/budget-details'),
            api.get('/manager/department-expenses'),
            api.get('/manager/department-revenues')
          ]);
          setData([
            { type: 'overview_finance', ...bo.data },
            { type: 'budgets', count: bd.data ? 1 : 0, data: bd.data ? [bd.data] : [] },
            { type: 'expenses', count: de.data.length, data: de.data },
            { type: 'revenues', count: dr.data.length, data: dr.data }
          ]);
          break;
      }
    } catch (error) {
      console.error('Error loading overview:', error);
      Alert.alert('Erreur', 'Impossible de charger la vue d\'ensemble');
    }
  };

  // Remplacer loadData (ligne ~390) par :

  const loadData = async () => {
    try {
      setLoading(true);

      // Vérifier que departmentType existe
      if (!departmentType) {
        console.warn('Department type not set yet');
        return;
      }

      switch (departmentType) {
        case 'agriculture':
          await loadAgricultureData();
          break;
        case 'elevage':
          await loadElevageData();
          break;
        case 'flotte':
          await loadFlotteData();
          break;
        case 'commercial':
          await loadCommercialData();
          break;
        case 'finance':
          await loadFinanceData();
          break;
        default:
          console.warn('Unknown department type:', departmentType);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    loadDepartmentInfo();
  }, []);

  useEffect(() => {
    if (departmentType) {
      loadData();
    }
  }, [departmentType, activeSection]);

  useEffect(() => {
    filterAndSortData();
  }, [searchQuery, filter, sortBy, sortOrder, data]);

  useEffect(() => {
    calculateStatistics();
  }, [filteredData]);

  // ==================== FILTER AND SORT ====================
  const handleDeleteItem = (item) => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cet élément ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const endpointMap = {
                parcelles: '/agriculture/parcelles',
                cultures: '/agriculture/cultures',
                intrants: '/agriculture/intrants',
                production: '/agriculture/recoltes',
                cheptel: '/elevage/animaux',
                'prod-lait': '/elevage/productions-lait',
                'prod-oeufs': '/elevage/productions-oeufs',
                aliments: '/elevage/aliments',
                vehicules: '/operations/vehicules',
                missions: '/operations/missions',
                maintenance: '/operations/maintenance',
                frais: '/operations/frais',
                commandes: '/commercial/commandes',
                stocks: '/commercial/stocks',
                clients: '/commercial/clients',
                fournisseurs: '/commercial/fournisseurs',
                finance: '/finance/budgets',
                revenues: '/manager/department-revenues',
                expenses: '/manager/department-expenses'
              };

              const endpoint = endpointMap[activeSection];
              if (!endpoint) throw new Error('Endpoint non défini pour cette section');

              await api.delete(`${endpoint}/${item.id}`);
              Alert.alert('Succès', 'Élément supprimé avec succès');
              loadData();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'élément');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const filterAndSortData = () => {
    let filtered = [...data];

    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => {
        const searchableFields = Object.values(item)
          .filter(val => typeof val === 'string' || typeof val === 'number')
          .join(' ')
          .toLowerCase();
        return searchableFields.includes(searchQuery.toLowerCase());
      });
    }

    // Apply filters
    if (filter !== 'all') {
      filtered = filtered.filter(item => {
        if (item.statut) return item.statut === filter;
        if (item.status) return item.status === filter;
        if (item.type) return item.type === filter;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.date_creation || a.date || a.date_commande || 0);
          const dateB = new Date(b.date_creation || b.date || b.date_commande || 0);
          comparison = dateA - dateB;
          break;
        case 'name':
          const nameA = (a.nom || a.nom_complet || a.designation || a.numero_identification || '').toLowerCase();
          const nameB = (b.nom || b.nom_complet || b.designation || b.numero_identification || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'amount':
          const amountA = parseFloat(a.montant_total || a.montant || a.prix || a.valeur_stock || 0);
          const amountB = parseFloat(b.montant_total || b.montant || b.prix || b.valeur_stock || 0);
          comparison = amountA - amountB;
          break;
        case 'quantity':
          const qtyA = parseFloat(a.quantite_disponible || a.quantite || a.nombre || 0);
          const qtyB = parseFloat(b.quantite_disponible || b.quantite || b.nombre || 0);
          comparison = qtyA - qtyB;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredData(filtered);
  };

  const calculateStatistics = () => {
    const stats = {
      total: filteredData.length,
      active: 0,
      inactive: 0,
      alerts: 0,
      value: 0
    };

    filteredData.forEach(item => {
      // Count active/inactive
      if (item.statut === 'actif' || item.statut === 'active' || item.statut === 'en_cours') {
        stats.active++;
      } else {
        stats.inactive++;
      }

      // Count alerts
      if (item.quantite_disponible && item.seuil_alerte && item.quantite_disponible <= item.seuil_alerte) {
        stats.alerts++;
      }
      if (item.statut_sante === 'malade' || item.statut_sante === 'en_traitement') {
        stats.alerts++;
      }

      // Calculate total value
      stats.value += parseFloat(item.montant_total || item.montant || item.valeur_stock || 0);
    });

    setStatistics(stats);
  };

  // ==================== EVENT HANDLERS ====================
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [activeSection, departmentType]);

  const handleItemPress = (item) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  const handleValidateFrais = async (fraisId) => {
    Alert.alert(
      'Valider les frais',
      'Confirmer la validation de ces frais ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await api.post(`/manager/frais/${fraisId}/validate`);
              Alert.alert('Succès', 'Frais validés');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de valider les frais');
            }
          }
        }
      ]
    );
  };

  const handleExport = () => {
    Alert.alert(
      'Exporter les données',
      'Choisissez le format d\'exportation',
      [
        { text: 'PDF', onPress: () => exportData('pdf') },
        { text: 'Excel', onPress: () => exportData('excel') },
        { text: 'CSV', onPress: () => exportData('csv') },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  };

  const exportData = async (format) => {
    try {
      Alert.alert('Exportation', `Export en ${format.toUpperCase()} en cours...`);
      // À implémenter selon les besoins
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'exporter les données');
    }
  };

  // ==================== RENDER SECTIONS ====================
  const renderSectionsNav = () => {
    let sections = [];

    switch (departmentType) {
      case 'agriculture':
        sections = [
          { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { id: 'parcelles', label: 'Parcelles', icon: 'terrain' },
          { id: 'cultures', label: 'Cultures', icon: 'agriculture' },
          { id: 'intrants', label: 'Intrants', icon: 'science' },
          { id: 'production', label: 'Récoltes', icon: 'inventory' }
        ];
        break;
      case 'elevage':
        sections = [
          { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { id: 'cheptel', label: 'Cheptel', icon: 'pets' },
          { id: 'production', label: 'Production', icon: 'local-drink' },
          { id: 'aliments', label: 'Aliments', icon: 'restaurant' }
        ];
        break;
      case 'flotte':
        sections = [
          { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { id: 'vehicules', label: 'Véhicules', icon: 'directions-car' },
          { id: 'missions', label: 'Missions', icon: 'navigation' },
          { id: 'maintenance', label: 'Maintenance', icon: 'build' },
          { id: 'frais', label: 'Frais', icon: 'attach-money' }
        ];
        break;
      case 'commercial':
        sections = [
          { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { id: 'commandes', label: 'Commandes', icon: 'shopping-cart' },
          { id: 'clients', label: 'Clients', icon: 'people' },
          { id: 'fournisseurs', label: 'Fournisseurs', icon: 'store' },
          { id: 'factures', label: 'Factures', icon: 'receipt' },
          { id: 'stocks', label: 'Stocks', icon: 'inventory' }
        ];
        break;
      case 'finance':
        sections = [
          { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
          { id: 'budgets', label: 'Budgets', icon: 'account-balance-wallet' },
          { id: 'revenues', label: 'Entrées', icon: 'trending-up' },
          { id: 'expenses', label: 'Sorties', icon: 'trending-down' }
        ];
        break;
      default:
        sections = [];
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionsBar}
        contentContainerStyle={styles.sectionsBarContent}
      >
        {sections.map(section => (
          <TouchableOpacity
            key={section.id}
            style={[
              styles.sectionButton,
              activeSection === section.id && styles.sectionButtonActive
            ]}
            onPress={() => setActiveSection(section.id)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={section.icon}
              size={getResponsiveValue(18, 20, 22, 24)}
              color={activeSection === section.id ? '#FFF' : '#7F8C8D'}
            />
            <Text style={[
              styles.sectionText,
              activeSection === section.id && styles.sectionTextActive
            ]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderHeader = () => (
    <Surface style={styles.headerContainer} elevation={2}>
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <MaterialIcons
            name={getDepartmentIcon(departmentType)}
            size={getResponsiveValue(28, 30, 32, 36)}
            color="#2E86C1"
          />
          <View style={styles.headerInfo}>
            {(userRole === 'manager' || userRole === 'admin') ? (
              <Menu
                visible={deptMenuVisible}
                onDismiss={() => setDeptMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    onPress={() => setDeptMenuVisible(true)}
                    style={styles.deptSelector}
                  >
                    <Text style={styles.headerTitle}>
                      {departmentInfo?.nom || 'Modules Opérationnels'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color="#2C3E50" />
                  </TouchableOpacity>
                }
              >
                {availableDepartments.map((dept) => (
                  <Menu.Item
                    key={dept.id}
                    onPress={() => switchDepartment(dept)}
                    title={dept.nom}
                    leadingIcon={getDepartmentIcon(dept.type)}
                  />
                ))}
              </Menu>
            ) : (
              <Text style={styles.headerTitle}>
                {departmentInfo?.nom || 'Modules Opérationnels'}
              </Text>
            )}
            <Text style={styles.headerSubtitle}>
              {getSectionTitle(activeSection)}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <IconButton
            icon="refresh"
            size={getResponsiveValue(22, 24, 26, 28)}
            onPress={onRefresh}
            disabled={refreshing}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={getResponsiveValue(22, 24, 26, 28)}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                handleExport();
              }}
              title="Exporter"
              leadingIcon="download"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setViewMode(viewMode === 'grid' ? 'list' : 'grid');
              }}
              title={viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
              leadingIcon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('Settings');
              }}
              title="Paramètres"
              leadingIcon="cog"
            />
          </Menu>
        </View>
      </View>

      {/* Statistics Row */}
      {activeSection !== 'overview' && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>{statistics.active}</Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#95A5A6' }]}>{statistics.inactive}</Text>
            <Text style={styles.statLabel}>Inactifs</Text>
          </View>
          {statistics.alerts > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#E74C3C' }]}>{statistics.alerts}</Text>
              <Text style={styles.statLabel}>Alertes</Text>
            </View>
          )}
        </View>
      )}
    </Surface>
  );



  const renderFiltersBar = () => (
    <View style={styles.filtersContainer}>
      <Searchbar
        placeholder="Rechercher..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor="#7F8C8D"
      />

      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          <Chip
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
            style={styles.filterChip}
            textStyle={styles.filterChipText}
          >
            Tous
          </Chip>
          {getFilterOptions().map(option => (
            <Chip
              key={option.value}
              selected={filter === option.value}
              onPress={() => setFilter(option.value)}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
              icon={option.icon}
            >
              {option.label}
            </Chip>
          ))}
        </ScrollView>

        <Menu
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          anchor={
            <IconButton
              icon="sort"
              size={getResponsiveValue(22, 24, 26, 28)}
              onPress={() => setFilterMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setSortBy('date');
              setFilterMenuVisible(false);
            }}
            title="Trier par date"
            leadingIcon="calendar"
          />
          <Menu.Item
            onPress={() => {
              setSortBy('name');
              setFilterMenuVisible(false);
            }}
            title="Trier par nom"
            leadingIcon="alphabetical"
          />
          <Menu.Item
            onPress={() => {
              setSortBy('amount');
              setFilterMenuVisible(false);
            }}
            title="Trier par montant"
            leadingIcon="currency-usd"
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              setFilterMenuVisible(false);
            }}
            title={sortOrder === 'asc' ? 'Décroissant' : 'Croissant'}
            leadingIcon={sortOrder === 'asc' ? 'arrow-down' : 'arrow-up'}
          />
        </Menu>
      </View>
    </View>
  );

  // ==================== RENDER CARDS ====================
  const renderCard = ({ item, index }) => {
    const CardComponent = getCardComponent();

    if (!CardComponent) {
      return null;
    }

    const cardWidth = viewMode === 'grid' ? getCardWidth() : screenWidth - (getResponsiveValue(30, 40, 50, 60));

    return (
      <View
        style={[
          styles.cardWrapper,
          viewMode === 'grid' && { width: cardWidth },
          viewMode === 'list' && { width: '100%' }
        ]}
      >
        <CardComponent item={item} onPress={() => handleItemPress(item)} />
      </View>
    );
  };

  const getCardComponent = () => {
    if (activeSection === 'overview') return OverviewCard;

    const componentMap = {
      agriculture: {
        parcelles: ParcelleCard,
        cultures: CultureCard,
        intrants: IntrantCard,
        production: RecolteCard
      },
      elevage: {
        cheptel: AnimalCard,
        production: ProductionCard,
        aliments: AlimentCard
      },
      flotte: {
        vehicules: VehiculeCard,
        missions: MissionCard,
        maintenance: MaintenanceCard,
        frais: FraisCard
      },
      commercial: {
        commandes: CommandeCard,
        clients: ClientCard,
        fournisseurs: FournisseurCard,
        factures: FactureCard,
        stocks: StockCard
      },
      finance: {
        budgets: BudgetCard,
        expenses: DepenseCard,
        revenues: RevenuCard
      }
    };

    return componentMap[departmentType]?.[activeSection];
  };

  const getFilterOptions = () => {
    const options = {
      agriculture: {
        parcelles: [
          { value: 'active', label: 'Active', icon: 'check-circle' },
          { value: 'en_culture', label: 'En culture', icon: 'agriculture' },
          { value: 'en_jachere', label: 'En jachère', icon: 'pause-circle' }
        ],
        cultures: [
          { value: 'en_cours', label: 'En cours', icon: 'play-circle' },
          { value: 'recoltee', label: 'Récoltée', icon: 'check-circle' }
        ],
        intrants: [
          { value: 'actif', label: 'Actif', icon: 'check-circle' },
          { value: 'epuise', label: 'Épuisé', icon: 'cancel' }
        ]
      },
      elevage: {
        cheptel: [
          { value: 'vivant', label: 'Vivant', icon: 'favorite' },
          { value: 'en_production', label: 'En production', icon: 'check-circle' }
        ]
      },
      flotte: {
        vehicules: [
          { value: 'actif', label: 'Actif', icon: 'check-circle' },
          { value: 'maintenance', label: 'Maintenance', icon: 'build' }
        ],
        missions: [
          { value: 'en_cours', label: 'En cours', icon: 'play-circle' },
          { value: 'termine', label: 'Terminée', icon: 'check-circle' }
        ]
      },
      commercial: {
        commandes: [
          { value: 'confirmee', label: 'Confirmée', icon: 'check' },
          { value: 'livree_complete', label: 'Livrée', icon: 'local-shipping' }
        ],
        stocks: [
          { value: 'disponible', label: 'Disponible', icon: 'check-circle' },
          { value: 'reserve', label: 'Réservé', icon: 'lock' }
        ]
      }
    };

    return options[departmentType]?.[activeSection] || [];
  };


  const renderInvoiceModal = () => {
    if (!selectedInvoice) return null;

    // Charger les paramètres de l'entreprise si pas encore chargés
    React.useEffect(() => {
      if (!companySettings) {
        loadCompanySettings();
      }
    }, []);

    // Utiliser les paramètres de l'entreprise ou des valeurs par défaut
    const company = companySettings || {
      nom_entreprise: 'NUTRIFIX',
      nif: '4001234567',
      numero_rc: 'RC/ Bujumbura / 1234',
      boite_postale: '1234 Bujumbura',
      telephone: '+257 22 22 22 22',
      commune: 'Mukaza',
      quartier: 'Rohero I',
      avenue: 'de la France',
      rue: 'n/a',
      numero_batiment: '10',
      assujetti_tva: 1,
      centre_fiscal: 'DMC',
      secteur_activite: 'Commerce'
    };

    return (
      <Portal>
        <Modal
          visible={invoiceModalVisible}
          onDismiss={() => setInvoiceModalVisible(false)}
          contentContainerStyle={[styles.modalLarge, { backgroundColor: 'white', padding: 0 }]}
        >
          <ScrollView contentContainerStyle={styles.obrInvoiceScroll}>
            <View style={styles.obrHeader}>
              <View style={styles.obrVendorSection}>
                <Text style={styles.obrMainTitle}>A. Identification du vendeur</Text>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>Nom et prénom ou Raison sociale* : </Text>
                  <Text style={styles.obrValue}>{company.nom_entreprise}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>NIF* : </Text>
                  <Text style={styles.obrValue}>{company.nif || 'N/A'}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>Registre de Commerce N°: </Text>
                  <Text style={styles.obrValue}>{company.numero_rc || 'N/A'}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>B.P : </Text>
                  <Text style={styles.obrValue}>{company.boite_postale || 'N/A'}</Text>
                  <Text style={styles.obrLabel}>, Tél : </Text>
                  <Text style={styles.obrValue}>{company.telephone || 'N/A'}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>Commune : </Text>
                  <Text style={styles.obrValue}>{company.commune || 'N/A'}</Text>
                  <Text style={styles.obrLabel}>, Quartier : </Text>
                  <Text style={styles.obrValue}>{company.quartier || 'N/A'}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>Av. : </Text>
                  <Text style={styles.obrValue}>{company.avenue || 'N/A'}</Text>
                  <Text style={styles.obrLabel}>, Rue : </Text>
                  <Text style={styles.obrValue}>{company.rue || 'N/A'}</Text>
                  <Text style={styles.obrLabel}>, N° : </Text>
                  <Text style={styles.obrValue}>{company.numero_batiment || 'N/A'}</Text>
                </View>
                <View style={styles.obrDetailRow}>
                  <Text style={styles.obrLabel}>Assujetti à la TVA* : </Text>
                  <Text style={styles.obrValue}>{company.assujetti_tva ? '[x] Oui [ ] Non' : '[ ] Oui [x] Non'}</Text>
                </View>
              </View>

              <View style={styles.obrInvoiceMeta}>
                <Text style={styles.obrInvoiceTitle}>Facture n° {selectedInvoice.numero_facture}</Text>
                <Text style={styles.obrInvoiceDate}>du {formatDate(selectedInvoice.date_facture)}</Text>
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.obrLabel}>Centre fiscal : </Text>
                  <Text style={styles.obrValue}>{company.centre_fiscal || 'N/A'}</Text>
                  <Text style={styles.obrLabel}>Secteur d’activités : </Text>
                  <Text style={styles.obrValue}>{company.secteur_activite || 'N/A'}</Text>
                </View>
              </View>
            </View>

            <Divider style={styles.obrDivider} />

            <View style={styles.obrClientSection}>
              <Text style={styles.obrMainTitle}>B. Le client:</Text>
              <View style={styles.obrDetailRow}>
                <Text style={styles.obrLabel}>Nom et prénom ou Raison sociale* : </Text>
                <Text style={styles.obrValue}>{selectedInvoice.nom_client || selectedInvoice.tiers_nom}</Text>
              </View>
              <View style={styles.obrDetailRow}>
                <Text style={styles.obrLabel}>NIF : </Text>
                <Text style={styles.obrValue}>{selectedInvoice.client_nif || '................'}</Text>
              </View>
            </View>

            <View style={styles.obrTable}>
              <View style={styles.obrTableHeader}>
                <Text style={[styles.obrTableHeaderCell, { flex: 2 }]}>Nature de l’article ou service*</Text>
                <Text style={[styles.obrTableHeaderCell, { flex: 0.5 }]}>Qté*</Text>
                <Text style={[styles.obrTableHeaderCell, { flex: 0.8 }]}>PU*</Text>
                <Text style={[styles.obrTableHeaderCell, { flex: 1 }]}>PVHTVA</Text>
              </View>

              {selectedInvoice.lignes && selectedInvoice.lignes.map((item, index) => (
                <View key={index} style={styles.obrTableRow}>
                  <Text style={[styles.obrTableCell, { flex: 2 }]}>{index + 1}. {item.designation}</Text>
                  <Text style={[styles.obrTableCell, { flex: 0.5, textAlign: 'center' }]}>{item.quantite}</Text>
                  <Text style={[styles.obrTableCell, { flex: 0.8, textAlign: 'right' }]}>{formatCurrency(item.prix_unitaire)}</Text>
                  <Text style={[styles.obrTableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.total_ht)}</Text>
                </View>
              ))}

              <View style={styles.obrTotalRow}>
                <Text style={[styles.obrTableCell, { flex: 3.3, fontWeight: 'bold' }]}>PVT HTVA</Text>
                <Text style={[styles.obrTableCell, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>{formatCurrency(selectedInvoice.montant_ht)}</Text>
              </View>
              <View style={styles.obrTotalRow}>
                <Text style={[styles.obrTableCell, { flex: 3.3, fontWeight: 'bold' }]}>TVA</Text>
                <Text style={[styles.obrTableCell, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>{formatCurrency(selectedInvoice.montant_tva)}</Text>
              </View>
              <View style={styles.obrTotalRow}>
                <Text style={[styles.obrTableCell, { flex: 3.3, fontWeight: 'bold' }]}>Total TVAC</Text>
                <Text style={[styles.obrTableCell, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>{formatCurrency(selectedInvoice.montant_ttc)}</Text>
              </View>
            </View>
          </ScrollView>
          <Button mode="contained" onPress={() => setInvoiceModalVisible(false)} style={{ margin: 10 }}>Fermer</Button>
        </Modal>
      </Portal>
    );
  };

  // ==================== CARD COMPONENTS ====================

  // Overview Card
  const OverviewCard = ({ item, onPress }) => {
    const isFinance = item.type === 'overview_finance';

    return (
      <TouchableOpacity style={styles.overviewCard} onPress={onPress} activeOpacity={0.7}>
        <Surface style={styles.overviewCardSurface} elevation={2}>
          <MaterialIcons
            name={getOverviewIcon(isFinance ? 'budgets' : item.type)}
            size={getResponsiveValue(36, 40, 44, 48)}
            color="#2E86C1"
          />
          <Text style={styles.overviewCardTitle}>
            {isFinance ? 'Résumé Financier' : getSectionTitle(item.type)}
          </Text>

          {isFinance ? (
            <View style={styles.overviewFinanceContent}>
              <Text style={styles.overviewFinLabel}>Total Fonds: <Text style={styles.overviewFinValue}>{formatCurrency((item.budget_alloue || 0) + (item.total_revenus || 0))}</Text></Text>
              <Text style={[styles.overviewFinLabel, { color: '#E74C3C' }]}>Dépenses: <Text style={styles.overviewFinValue}>{formatCurrency(item.total_depenses)}</Text></Text>
              <View style={styles.soldeContainer}>
                <Text style={styles.soldeLabel}>Solde Actuel</Text>
                <Text style={[styles.soldeValue, { color: (item.budget_disponible || 0) <= 0 ? '#E74C3C' : '#27AE60' }]}>
                  {formatCurrency(item.budget_disponible)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.overviewCardCount}>{item.count}</Text>
          )}
        </Surface>
      </TouchableOpacity>
    );
  };

  // Parcelle Card
  const ParcelleCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="terrain" size={getResponsiveValue(24, 26, 28, 30)} color="#27AE60" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_parcelle}</Text>
                <Text style={styles.cardSubtitle}>{item.reference}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getParcelleStatusColor(item.statut) }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="straighten" text={`${item.superficie_hectares} ha`} />
            <CardRow icon="place" text={item.localisation} />
            <CardRow icon="grass" text={item.type_sol} />
            {item.culture_actuelle_nom && (
              <CardRow icon="agriculture" text={item.culture_actuelle_nom} color="#27AE60" />
            )}
          </View>

          {item.productivite_moyenne && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="trending-up" size={14} color="#2ECC71" />
              <Text style={styles.cardFooterText}>
                {item.productivite_moyenne} kg/ha
              </Text>
            </View>
          )}

          {(userRole === 'manager' || userRole === 'admin') && item.statut !== 'vendue' && (
            <View style={[styles.cardFooter, { justifyContent: 'flex-end', borderTopWidth: 0, marginTop: 5, paddingTop: 0 }]}>
              <Button
                mode="contained"
                compact
                uppercase={false}
                labelStyle={{ fontSize: 12 }}
                style={{ backgroundColor: '#27AE60' }}
                icon="cash"
                onPress={() => handleOpenTransaction('vente', item)}
              >
                Vendre
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Culture Card
  const CultureCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="agriculture" size={getResponsiveValue(24, 26, 28, 30)} color="#16A085" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_culture}</Text>
                <Text style={styles.cardSubtitle}>{item.parcelle_nom}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getCultureStatusColor(item.stade_croissance) }]}
              textStyle={styles.chipText}
            >
              {item.stade_croissance}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date_semaison)} />
            <CardRow icon="calendar-today" text={formatDate(item.date_recolte_prevue)} />
            {item.rendement_obtenu_kg && (
              <CardRow icon="inventory" text={`${item.rendement_obtenu_kg} kg`} color="#2ECC71" />
            )}
          </View>

          <ProgressBar
            progress={calculateCultureProgress(item)}
            color="#27AE60"
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {Math.round(calculateCultureProgress(item) * 100)}% du cycle
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Intrant Card
  const IntrantCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons
                name={getIntrantIcon(item.type)}
                size={getResponsiveValue(24, 26, 28, 30)}
                color={getIntrantColor(item.type)}
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_intrant}</Text>
                <Text style={styles.cardSubtitle}>{item.code_intrant}</Text>
              </View>
            </View>
            {item.quantite_stock <= item.seuil_alerte && (
              <Badge style={styles.alertBadge} size={20}>!</Badge>
            )}
          </View>

          <View style={styles.cardContent}>
            <CardRow
              icon="inventory-2"
              text={`${item.quantite_stock} ${item.unite_mesure}`}
              color={item.quantite_stock <= item.seuil_alerte ? '#E74C3C' : '#2C3E50'}
              bold={item.quantite_stock <= item.seuil_alerte}
            />
            <CardRow icon="attach-money" text={formatCurrency(item.prix_unitaire_achat)} />
            {item.emplacement && (
              <CardRow icon="place" text={item.emplacement} />
            )}
          </View>

          <ProgressBar
            progress={Math.min(item.quantite_stock / (item.seuil_alerte * 2), 1)}
            color={item.quantite_stock <= item.seuil_alerte ? '#E74C3C' : '#2ECC71'}
            style={styles.stockProgressBar}
          />

          {(userRole === 'manager' || userRole === 'admin') && (
            <View style={[styles.cardFooter, { justifyContent: 'flex-end', borderTopWidth: 0, marginTop: 10, paddingTop: 0 }]}>
              <Button
                mode="contained"
                compact
                uppercase={false}
                labelStyle={{ fontSize: 12 }}
                style={{ backgroundColor: '#E74C3C' }}
                icon="cart-plus"
                onPress={() => handleOpenTransaction('achat', item)}
              >
                Acheter Stock
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Recolte Card
  const RecolteCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="inventory" size={getResponsiveValue(24, 26, 28, 30)} color="#16A085" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_culture}</Text>
                <Text style={styles.cardSubtitle}>{item.parcelle_nom}</Text>
              </View>
            </View>
            {item.qualite && (
              <Chip
                style={[styles.qualityChip, { backgroundColor: getQualityColor(item.qualite) }]}
                textStyle={styles.chipText}
              >
                {item.qualite}
              </Chip>
            )}
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date_recolte_reelle)} />
            <CardRow icon="scale" text={`${item.rendement_obtenu_kg} kg`} color="#2ECC71" />
            {item.taux_perte > 0 && (
              <CardRow icon="trending-down" text={`Pertes: ${item.taux_perte}%`} color="#E74C3C" />
            )}
            <CardRow icon="attach-money" text={formatCurrency(item.revenu_estime)} color="#27AE60" />
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Animal Card
  const AnimalCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              {item.photo ? (
                <Avatar.Image size={36} source={{ uri: item.photo }} />
              ) : (
                <MaterialIcons name="pets" size={getResponsiveValue(24, 26, 28, 30)} color="#8E44AD" />
              )}
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.nom_animal || item.numero_identification}
                </Text>
                <Text style={styles.cardSubtitle}>{item.espece} - {item.race}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getAnimalHealthColor(item.statut_sante) }]}
              textStyle={styles.chipText}
            >
              {item.statut_sante}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="wc" text={item.sexe} />
            <CardRow icon="cake" text={calculateAge(item.date_naissance)} />
            {item.poids_actuel && (
              <CardRow icon="fitness-center" text={`${item.poids_actuel} kg`} />
            )}
            {item.statut_production && (
              <CardRow
                icon={item.statut_production === 'en_production' ? 'check-circle' : 'cancel'}
                text={item.statut_production}
                color={item.statut_production === 'en_production' ? '#2ECC71' : '#E74C3C'}
              />
            )}
          </View>

          {(userRole === 'manager' || userRole === 'admin') && item.statut !== 'vendu' && (
            <View style={styles.cardFooterActions}>
              {item.derniere_vaccination && (
                <View style={[styles.cardFooter, { borderTopWidth: 0, marginTop: 0, paddingTop: 0 }]}>
                  <MaterialIcons name="medical-services" size={14} color="#3498DB" />
                  <Text style={styles.cardFooterText}>
                    Vac: {formatDate(item.derniere_vaccination)}
                  </Text>
                </View>
              )}
              <Button
                mode="contained"
                compact
                uppercase={false}
                labelStyle={{ fontSize: 12 }}
                style={{ backgroundColor: '#8E44AD' }}
                icon="cash"
                onPress={() => handleOpenTransaction('vente', item)}
              >
                Vendre
              </Button>
            </View>
          )}
          {!((userRole === 'manager' || userRole === 'admin') && item.statut !== 'vendu') && item.derniere_vaccination && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="medical-services" size={14} color="#3498DB" />
              <Text style={styles.cardFooterText}>
                Vaccination: {formatDate(item.derniere_vaccination)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Production Card
  const ProductionCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons
                name={item.type === 'lait' ? 'local-drink' : 'egg'}
                size={getResponsiveValue(24, 26, 28, 30)}
                color={item.type === 'lait' ? '#3498DB' : '#F39C12'}
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle}>
                  {item.type === 'lait' ? 'Lait' : 'Œufs'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {formatDate(item.date_production || item.date_recolte)}
                </Text>
              </View>
            </View>
            {item.qualite && (
              <Chip
                style={[styles.qualityChip, { backgroundColor: getQualityGradeColor(item.qualite) }]}
                textStyle={styles.chipText}
              >
                {item.qualite}
              </Chip>
            )}
          </View>

          <View style={styles.cardContent}>
            {item.type === 'lait' ? (
              <>
                <CardRow icon="opacity" text={`${item.quantite_litres} L`} color="#3498DB" />
                {item.animal_numero && (
                  <CardRow icon="pets" text={item.animal_numero} />
                )}
                {item.taux_matiere_grasse && (
                  <CardRow icon="science" text={`MG: ${item.taux_matiere_grasse}% | P: ${item.taux_proteine}%`} />
                )}
              </>
            ) : (
              <>
                <CardRow icon="egg" text={`${item.nombre_oeufs} œufs`} color="#F39C12" />
                {item.oeufs_casses > 0 && (
                  <CardRow icon="broken-image" text={`Cassés: ${item.oeufs_casses}`} color="#E74C3C" />
                )}
                <CardRow icon="category" text={`M: ${item.calibre_moyen} | G: ${item.calibre_gros}`} />
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Aliment Card
  const AlimentCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="restaurant" size={getResponsiveValue(24, 26, 28, 30)} color="#E67E22" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_aliment}</Text>
                <Text style={styles.cardSubtitle}>{item.code_aliment}</Text>
              </View>
            </View>
            {item.quantite_stock <= item.seuil_alerte && (
              <Badge style={styles.alertBadge} size={20}>!</Badge>
            )}
          </View>

          <View style={styles.cardContent}>
            <CardRow
              icon="inventory-2"
              text={`${item.quantite_stock} ${item.unite_mesure}`}
              color={item.quantite_stock <= item.seuil_alerte ? '#E74C3C' : '#2C3E50'}
              bold={item.quantite_stock <= item.seuil_alerte}
            />
            <CardRow icon="category" text={item.type} />
            <CardRow icon="attach-money" text={formatCurrency(item.prix_unitaire_achat)} />
          </View>

          <ProgressBar
            progress={Math.min(item.quantite_stock / (item.seuil_alerte * 2), 1)}
            color={item.quantite_stock <= item.seuil_alerte ? '#E74C3C' : '#2ECC71'}
            style={styles.stockProgressBar}
          />

          {(userRole === 'manager' || userRole === 'admin') && (
            <View style={[styles.cardFooter, { justifyContent: 'flex-end', borderTopWidth: 0, marginTop: 10, paddingTop: 0 }]}>
              <Button
                mode="contained"
                compact
                uppercase={false}
                labelStyle={{ fontSize: 12 }}
                style={{ backgroundColor: '#E74C3C' }}
                icon="cart-plus"
                onPress={() => handleOpenTransaction('achat', item)}
              >
                Acheter Stock
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Vehicule Card
  const VehiculeCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons
                name={getVehicleIcon(item.type_vehicule)}
                size={getResponsiveValue(24, 26, 28, 30)}
                color="#E67E22"
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle}>{item.immatriculation}</Text>
                <Text style={styles.cardSubtitle}>{item.marque} {item.modele}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getVehicleStatusColor(item.statut) }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="speed" text={`${item.kilometrage_actuel?.toLocaleString() || 0} km`} />
            {item.chauffeur_nom && (
              <CardRow icon="person" text={item.chauffeur_nom} color="#3498DB" />
            )}
            <CardRow
              icon={item.disponible ? 'check-circle' : 'cancel'}
              text={item.disponible ? 'Disponible' : 'En mission'}
              color={item.disponible ? '#2ECC71' : '#E74C3C'}
            />
          </View>

          {(userRole === 'manager' || userRole === 'admin') && item.statut !== 'vendu' && (
            <View style={styles.cardFooter}>
              {item.prochain_controle && (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="event" size={14} color="#F39C12" />
                  <Text style={styles.cardFooterText}>
                    Contrôle: {formatDate(item.prochain_controle)}
                  </Text>
                </View>
              )}
              <Button
                mode="contained"
                compact
                uppercase={false}
                labelStyle={{ fontSize: 12 }}
                style={{ backgroundColor: '#E67E22' }}
                icon="cash"
                onPress={() => handleOpenTransaction('vente', item)}
              >
                Vendre
              </Button>
            </View>
          )}
          {!((userRole === 'manager' || userRole === 'admin') && item.statut !== 'vendu') && item.prochain_controle && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="event" size={14} color="#F39C12" />
              <Text style={styles.cardFooterText}>
                Contrôle: {formatDate(item.prochain_controle)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Mission Card
  const MissionCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="navigation" size={getResponsiveValue(24, 26, 28, 30)} color="#2980B9" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.destination}</Text>
                <Text style={styles.cardSubtitle}>{item.vehicule_immatriculation}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getMissionStatusColor(item.statut) }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="person" text={item.chauffeur_nom} />
            <CardRow icon="event" text={formatDate(item.date_mission)} />
            {item.distance_parcourue && (
              <CardRow icon="straighten" text={`${item.distance_parcourue} km`} color="#2ECC71" />
            )}
            {item.total_frais > 0 && (
              <CardRow icon="attach-money" text={formatCurrency(item.total_frais)} color="#E67E22" />
            )}
          </View>

          {item.motif && (
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText} numberOfLines={2}>{item.motif}</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Maintenance Card
  const MaintenanceCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="build" size={getResponsiveValue(24, 26, 28, 30)} color="#F39C12" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.type_maintenance}</Text>
                <Text style={styles.cardSubtitle}>{item.vehicule_immatriculation}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getMaintenanceStatusColor(item.statut) }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date_intervention)} />
            <CardRow icon="speed" text={`${item.kilometrage?.toLocaleString() || 0} km`} />
            <CardRow icon="attach-money" text={formatCurrency(item.cout_maintenance)} color="#E67E22" />
            {item.fournisseur && (
              <CardRow icon="store" text={item.fournisseur} />
            )}
          </View>

          {item.date_prochaine_maintenance && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="event" size={14} color="#3498DB" />
              <Text style={styles.cardFooterText}>
                Prochaine: {formatDate(item.date_prochaine_maintenance)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Frais Card
  const FraisCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="attach-money" size={getResponsiveValue(24, 26, 28, 30)} color="#E67E22" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.cardSubtitle}>{item.chauffeur_nom}</Text>
              </View>
            </View>
            <Text style={styles.amountText}>{formatCurrency(item.montant)}</Text>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date)} />
            <CardRow icon="directions-car" text={item.vehicule_immatriculation} />
            {item.mission_ref && (
              <CardRow icon="navigation" text={item.mission_ref} color="#3498DB" />
            )}
          </View>

          <View style={styles.cardFooter}>
            <Chip
              style={[styles.validationChip, {
                backgroundColor: item.valide ? '#2ECC71' : '#F39C12'
              }]}
              textStyle={styles.chipText}
            >
              {item.valide ? 'Validé' : 'En attente'}
            </Chip>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Commande Card
  const CommandeCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons
                name={item.type === 'vente' ? 'shopping-cart' : 'shopping-basket'}
                size={getResponsiveValue(24, 26, 28, 30)}
                color={item.type === 'vente' ? '#2ECC71' : '#E74C3C'}
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.numero_commande}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.type === 'vente' ? item.client_nom : item.fournisseur_nom}
                </Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, { backgroundColor: getCommandeStatusColor(item.statut) }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date_commande)} />
            <CardRow icon="local-shipping" text={formatDate(item.date_livraison_prevue)} color="#3498DB" />
            <CardRow icon="attach-money" text={formatCurrency(item.montant_total)} color="#2ECC71" />
            <CardRow icon="payment" text={item.mode_paiement} />
          </View>

          {item.nombre_lignes && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="format-list-numbered" size={14} color="#7F8C8D" />
              <Text style={styles.cardFooterText}>{item.nombre_lignes} article(s)</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Facture Card
  const FactureCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="receipt" size={getResponsiveValue(24, 26, 28, 30)} color="#9B59B6" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.numero_facture}</Text>
                <Text style={styles.cardSubtitle}>{item.tiers_nom || item.nom_client}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, {
                backgroundColor: item.statut_paiement === 'paye' ? '#2ECC71' :
                  item.statut_paiement === 'partiel' ? '#F1C40F' : '#E74C3C'
              }]}
              textStyle={styles.chipText}
            >
              {item.statut_paiement}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="event" text={formatDate(item.date_facture)} />
            <CardRow icon="attach-money" text={formatCurrency(item.montant_ttc)} color="#2ECC71" bold />
            <CardRow icon="payment" text={item.mode_reglement} />
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Client Card
  const ClientCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Avatar.Text
                size={36}
                label={item.nom_client?.substring(0, 2).toUpperCase() || 'CL'}
                style={{ backgroundColor: '#3498DB' }}
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_client}</Text>
                <Text style={styles.cardSubtitle}>{item.code_client}</Text>
              </View>
            </View>
            <Chip
              style={[styles.fideliteChip, { backgroundColor: getFideliteColor(item.niveau_fidelite) }]}
              textStyle={styles.chipText}
            >
              {item.niveau_fidelite}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="phone" text={item.telephone} />
            {item.email && (
              <CardRow icon="email" text={item.email} numberOfLines={1} />
            )}
            <CardRow icon="shopping-basket" text={`${item.nombre_achats || 0} commande(s)`} color="#2ECC71" />
            <CardRow icon="attach-money" text={formatCurrency(item.montant_total_achats)} color="#27AE60" />
          </View>

          {item.solde_du > 0 && (
            <View style={[styles.cardFooter, { backgroundColor: '#FDEDEC' }]}>
              <MaterialIcons name="warning" size={14} color="#E74C3C" />
              <Text style={[styles.cardFooterText, { color: '#E74C3C' }]}>
                Solde dû: {formatCurrency(item.solde_du)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Fournisseur Card
  const FournisseurCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="store" size={getResponsiveValue(24, 26, 28, 30)} color="#E67E22" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nom_fournisseur}</Text>
                <Text style={styles.cardSubtitle}>{item.code_fournisseur}</Text>
              </View>
            </View>
            <Chip
              style={[styles.statusChip, {
                backgroundColor: item.statut === 'actif' ? '#2ECC71' : '#E74C3C'
              }]}
              textStyle={styles.chipText}
            >
              {item.statut}
            </Chip>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="phone" text={item.telephone} />
            <CardRow icon="category" text={item.type} />
            <CardRow icon="shopping-cart" text={`${item.nombre_achats || 0} commande(s)`} color="#3498DB" />
            <CardRow icon="attach-money" text={formatCurrency(item.montant_total_achats)} color="#27AE60" />
          </View>

          {item.note_evaluation && (
            <View style={styles.cardFooter}>
              <MaterialIcons name="star" size={14} color="#F39C12" />
              <Text style={styles.cardFooterText}>Évaluation: {item.note_evaluation}/5</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Stock Card
  const StockCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="inventory" size={getResponsiveValue(24, 26, 28, 30)} color="#16A085" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.designation}</Text>
                <Text style={styles.cardSubtitle}>{item.type_article}</Text>
              </View>
            </View>
            {item.quantite_disponible <= item.seuil_alerte && (
              <Badge style={styles.alertBadge} size={20}>!</Badge>
            )}
          </View>

          <View style={styles.cardContent}>
            <CardRow
              icon="inventory-2"
              text={`Stock: ${item.quantite_disponible} ${item.unite_mesure}`}
              color={item.quantite_disponible <= item.seuil_alerte ? '#E74C3C' : '#2C3E50'}
              bold={item.quantite_disponible <= item.seuil_alerte}
            />
            <CardRow icon="lock" text={`Réservé: ${item.quantite_reservee || 0} ${item.unite_mesure}`} color="#F39C12" />
            <CardRow icon="place" text={item.emplacement} />
            {item.valeur_stock && (
              <CardRow icon="attach-money" text={formatCurrency(item.valeur_stock)} color="#2ECC71" />
            )}
          </View>

          <ProgressBar
            progress={Math.min(item.quantite_disponible / ((item.quantite_disponible || 0) + (item.seuil_alerte || 1)), 1)}
            color={item.quantite_disponible <= item.seuil_alerte ? '#E74C3C' : '#2ECC71'}
            style={styles.stockProgressBar}
          />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Budget Card
  const BudgetCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="account-balance-wallet" size={getResponsiveValue(24, 26, 28, 30)} color="#2980B9" />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.categorie}</Text>
                <Text style={styles.cardSubtitle}>Budget Annuel {item.annee}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardContent}>
            <CardRow
              icon="monetization-on"
              text={`Dotation + Revenus: ${formatCurrency((item.budget_alloue || 0) + (item.total_revenus || 0))}`}
              color="#2C3E50"
              bold
            />
            <CardRow
              icon="trending-down"
              text={`Dépenses cumulées: ${formatCurrency(item.total_depenses || 0)}`}
              color="#E74C3C"
            />
            <CardRow
              icon="account-balance"
              text={`Solde disponible: ${formatCurrency(item.budget_disponible)}`}
              color={(item.budget_disponible || 0) <= 0 ? '#E74C3C' : '#27AE60'}
              bold
            />

            {(item.budget_disponible || 0) <= (item.budget_alloue * 0.1) && (
              <View style={styles.alertRefinancement}>
                <MaterialIcons name="warning" size={16} color="#E67E22" />
                <Text style={styles.alertRefinancementText}>
                  {(item.budget_disponible || 0) <= 0 ? "Budget dépassé ! Refinancement urgent." : "Fonds bas : Pensez au refinancement."}
                </Text>
              </View>
            )}
          </View>

          <ProgressBar
            progress={Math.min((item.total_depenses || 0) / (((item.budget_alloue || 0) + (item.total_revenus || 0)) || 1), 1)}
            color={(item.total_depenses || 0) > ((item.budget_alloue || 0) + (item.total_revenus || 0)) ? '#E74C3C' : '#2980B9'}
            style={styles.stockProgressBar}
          />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Depense Card (Sortie)
  const DepenseCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.card, { borderLeftColor: '#E74C3C', borderLeftWidth: 4 }]} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="trending-down" size={getResponsiveValue(24, 26, 28, 30)} color="#E74C3C" />
              <View style={styles.cardHeaderInfo}>
                <Text style={[styles.cardTitle, { color: '#E74C3C' }]} numberOfLines={1}>-{formatCurrency(item.montant)}</Text>
                <Text style={styles.cardSubtitle}>{item.categorie}</Text>
              </View>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{formatDate(item.date_depense)}</Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="description" text={item.description || item.libelle} numberOfLines={2} />
            {item.source_type && item.id_source && (
              <CardRow icon="link" text={`Lié à: ${item.source_type} #${item.id_source}`} color="#3498DB" />
            )}
            {item.paye_par_nom && (
              <CardRow icon="person" text={`Payé par: ${item.paye_par_nom}`} />
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Revenu Card (Entrée)
  const RevenuCard = ({ item, onPress }) => (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.card, { borderLeftColor: '#27AE60', borderLeftWidth: 4 }]} elevation={2}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialIcons name="trending-up" size={getResponsiveValue(24, 26, 28, 30)} color="#27AE60" />
              <View style={styles.cardHeaderInfo}>
                <Text style={[styles.cardTitle, { color: '#27AE60' }]} numberOfLines={1}>+{formatCurrency(item.montant)}</Text>
                <Text style={styles.cardSubtitle}>{item.source}</Text>
              </View>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{formatDate(item.date_revenu)}</Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <CardRow icon="receipt" text={item.description || item.libelle} numberOfLines={2} />
            {item.source_type && item.id_source && (
              <CardRow icon="link" text={`Source: ${item.source_type} #${item.id_source}`} color="#3498DB" />
            )}
            {item.reference_paiement && (
              <CardRow icon="tag" text={`Réf: ${item.reference_paiement}`} />
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Reusable CardRow Component
  const CardRow = ({ icon, text, color = '#7F8C8D', bold = false, numberOfLines = 1 }) => (
    <View style={styles.cardRow}>
      <MaterialIcons name={icon} size={getResponsiveValue(14, 15, 16, 17)} color={color} />
      <Text
        style={[
          styles.cardRowText,
          { color },
          bold && { fontWeight: 'bold' }
        ]}
        numberOfLines={numberOfLines}
      >
        {text}
      </Text>
    </View>
  );

  const REVENUE_CATEGORIES = [
    { label: 'Vente de Lait', value: 'vente_lait', entityType: 'animal', endpoint: '/manager/animaux' },
    { label: 'Vente d\'Oeufs', value: 'vente_oeufs', entityType: 'animal', endpoint: '/manager/animaux' },
    { label: 'Vente d\'Animaux', value: 'vente_animaux', entityType: 'animal', endpoint: '/manager/animaux' },
    { label: 'Vente de Récolte', value: 'vente_recolte', entityType: 'culture', endpoint: '/manager/cultures' },
    { label: 'Location de Véhicule', value: 'location_vehicule', entityType: 'vehicule', endpoint: '/manager/vehicules-department' },
    { label: 'Services Commercial', value: 'service_comm', entityType: 'client', endpoint: '/manager/clients-department' },
    { label: 'Autre (Saisie Manuelle)', value: 'manuel', entityType: null }
  ];

  const EXPENSE_CATEGORIES = [
    { label: 'Paiement de Salaire', value: 'salaire', entityType: 'employe', endpoint: '/rh/employes' },
    { label: 'Achat d\'Animaux', value: 'achat_animal', entityType: 'fournisseur', endpoint: '/manager/fournisseurs-department' },
    { label: 'Achat d\'Intrants', value: 'achat_intrant', entityType: 'fournisseur', endpoint: '/manager/fournisseurs-department' },
    { label: 'Maintenance Véhicule', value: 'maintenance_vehicule', entityType: 'vehicule', endpoint: '/manager/vehicules-department' },
    { label: 'Achat de Carburant', value: 'carburant', entityType: 'vehicule', endpoint: '/manager/vehicules-department' },
    { label: 'Achat Matériel Commercial', value: 'achat_comm', entityType: 'fournisseur', endpoint: '/manager/fournisseurs-department' },
    { label: 'Autre (Saisie Manuelle)', value: 'manuel', entityType: null }
  ];

  const PAYMENT_MODES = [
    { label: 'Comptant (Cash)', value: 'comptant' },
    { label: 'Virement / Mobile Money', value: 'virement' },
    { label: 'À Crédit', value: 'credit' }
  ];

  // ==================== OPERATION MODAL ====================
  const OperationModal = ({ visible, onDismiss, mode, item, departmentType, departmentId, activeSection, onSuccess }) => {
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [availableEntities, setAvailableEntities] = useState([]);
    const [availableClients, setAvailableClients] = useState([]);
    const [loadingEntities, setLoadingEntities] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);
    const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
    const [entityMenuVisible, setEntityMenuVisible] = useState(false);
    const [clientMenuVisible, setClientMenuVisible] = useState(false);
    const [paymentMenuVisible, setPaymentMenuVisible] = useState(false);
    const [selectedEntityDetails, setSelectedEntityDetails] = useState(null);

    const isFinanceMovement = activeSection === 'revenues' || activeSection === 'expenses';
    const categories = activeSection === 'revenues' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

    useEffect(() => {
      if (visible) {
        if (mode === 'edit' && item) {
          setFormData({ ...item });
          if (isFinanceMovement) {
            const cat = categories.find(c => c.value === item.categorie_mouvement);
            if (cat) {
              setSelectedCategory(cat);
              handleCategorySelect(cat, true);
            }
          }
        } else {
          setFormData({});
          setSelectedCategory(null);
          setAvailableEntities([]);
        }
      }
    }, [visible, mode, item]);

    const handleCategorySelect = async (category, isEdit = false) => {
      setSelectedCategory(category);
      setCategoryMenuVisible(false);

      if (!isEdit) {
        setFormData({
          ...formData,
          categorie_mouvement: category.value,
          source_type: category.entityType,
          id_source: null,
          libelle: category.label,
          source: category.label, // For RevenuCard
          categorie: category.label // For DepenseCard
        });
      }

      if (category.entityType && category.endpoint) {
        try {
          setLoadingEntities(true);
          const response = await api.get(category.endpoint);
          // Handle both {success, data} and direct array formats
          const data = response.data.data || response.data.results || (Array.isArray(response.data) ? response.data : []);
          setAvailableEntities(data);

          // Fetch specific stock if it's a milk/egg sale
          if (['vente_lait', 'vente_oeufs'].includes(category.value)) {
            const type = category.value === 'vente_lait' ? 'lait' : 'oeufs';
            const stockRes = await api.get(`/manager/stock-info?type=${type}`);
            setSelectedEntityDetails(stockRes.data);
          } else {
            setSelectedEntityDetails(null);
          }
        } catch (error) {
          console.error('Error fetching entities:', error);
          setAvailableEntities([]);
          setSelectedEntityDetails(null);
        } finally {
          setLoadingEntities(false);
        }
      } else {
        setAvailableEntities([]);
        setSelectedEntityDetails(null);
      }

      // Always fetch clients for revenues to allow linking
      if (activeSection === 'revenues') {
        try {
          setLoadingClients(true);
          const response = await api.get('/manager/clients-department');
          const data = Array.isArray(response.data) ? response.data : (response.data.data || []);
          setAvailableClients(data);
        } catch (error) {
          console.error('Error fetching clients:', error);
        } finally {
          setLoadingClients(false);
        }
      }
    };

    const handleSubmit = async () => {
      try {
        setSubmitting(true);

        // Budget Validation for Expenses
        if (activeSection === 'expenses') {
          const budgetRes = await api.get('/manager/budget-overview');
          const budgetAvailable = budgetRes.data.budget_disponible || 0;
          const requestedAmount = parseFloat(formData.montant || 0);

          if (requestedAmount > budgetAvailable) {
            Alert.alert(
              'Budget Insuffisant',
              `Le montant (${requestedAmount.toLocaleString()} BIF) dépasse le budget disponible (${budgetAvailable.toLocaleString()} BIF).`
            );
            setSubmitting(false);
            return;
          }
        }

        const endpointMap = {
          parcelles: '/agriculture/parcelles',
          cultures: '/agriculture/cultures',
          intrants: '/agriculture/intrants',
          production: '/agriculture/recoltes',
          cheptel: '/elevage/animaux',
          'prod-lait': '/elevage/productions-lait',
          'prod-oeufs': '/elevage/productions-oeufs',
          aliments: '/elevage/aliments',
          vehicules: '/operations/vehicules',
          missions: '/operations/missions',
          maintenance: '/operations/maintenance',
          frais: '/operations/frais',
          commandes: '/commercial/commandes',
          stocks: '/commercial/stocks',
          clients: '/commercial/clients',
          fournisseurs: '/commercial/fournisseurs',
          finance: '/finance/budgets',
          revenues: '/manager/department-revenues',
          expenses: '/manager/department-expenses'
        };

        const endpoint = endpointMap[activeSection];
        if (!endpoint) throw new Error('Endpoint non défini pour cette section');

        const payload = {
          ...formData,
          id_departement: departmentId
        };
        if (isFinanceMovement) {
          payload.type_mouvement = activeSection === 'revenues' ? 'entree' : 'sortie';
        }

        if (mode === 'edit') {
          await api.put(`${endpoint}/${item.id}`, payload);
        } else {
          await api.post(endpoint, payload);
        }

        Alert.alert('Succès', `Élément ${mode === 'edit' ? 'modifié' : 'ajouté'} avec succès`);
        onSuccess();
      } catch (error) {
        console.error('Operation error:', error);
        Alert.alert('Erreur', `Impossible d'${mode === 'edit' ? 'modifier' : 'ajouter'} l'élément`);
      } finally {
        setSubmitting(false);
      }
    };

    const renderFields = () => {
      const commonStyle = { marginBottom: 15 };

      if (isFinanceMovement) {
        return (
          <View>
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setCategoryMenuVisible(true)}
                  style={commonStyle}
                  icon="chevron-down"
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {selectedCategory ? selectedCategory.label : 'Choisir une catégorie'}
                </Button>
              }
            >
              {categories.map((cat) => (
                <Menu.Item
                  key={cat.value}
                  onPress={() => handleCategorySelect(cat)}
                  title={cat.label}
                />
              ))}
            </Menu>

            {selectedCategory && selectedCategory.entityType && (
              <Menu
                visible={entityMenuVisible}
                onDismiss={() => setEntityMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setEntityMenuVisible(true)}
                    style={commonStyle}
                    icon="chevron-down"
                    contentStyle={{ flexDirection: 'row-reverse' }}
                    disabled={loadingEntities}
                    loading={loadingEntities}
                  >
                    {formData.id_source ?
                      (availableEntities.find(e => e.id === formData.id_source)?.nom_animal ||
                        availableEntities.find(e => e.id === formData.id_source)?.numero_identification ||
                        availableEntities.find(e => e.id === formData.id_source)?.nom_complet ||
                        availableEntities.find(e => e.id === formData.id_source)?.immatriculation ||
                        availableEntities.find(e => e.id === formData.id_source)?.nom_fournisseur ||
                        availableEntities.find(e => e.id === formData.id_source)?.nom_culture ||
                        'Élément sélectionné') :
                      `Choisir ${selectedCategory.entityType}`}
                  </Button>
                }
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {availableEntities
                    .filter(entity => {
                      if (selectedCategory.value === 'vente_animaux') return entity.statut === 'vivant';
                      return true;
                    })
                    .map((entity) => (
                      <Menu.Item
                        key={entity.id}
                        onPress={() => {
                          setFormData({ ...formData, id_source: entity.id });
                          setEntityMenuVisible(false);
                        }}
                        title={entity.nom_animal || entity.numero_identification || entity.nom_complet || entity.immatriculation || entity.nom_fournisseur || entity.nom_culture || `ID: ${entity.id}`}
                      />
                    ))}
                </ScrollView>
              </Menu>
            )}

            {selectedEntityDetails && (
              <View style={{ backgroundColor: '#F0F9FF', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={{ fontSize: 13, color: '#0369A1', fontWeight: '600', marginBottom: 4 }}>
                  📦 État du Stock
                </Text>
                <Text style={{ fontSize: 12, color: '#0C4A6E' }}>
                  Disponible: {selectedEntityDetails.quantite_disponible} {selectedEntityDetails.unite_mesure}
                  {selectedEntityDetails.emplacement ? ` | Emplacement: ${selectedEntityDetails.emplacement}` : ''}
                </Text>
              </View>
            )}

            {formData.id_source && availableEntities.find(e => e.id === formData.id_source) && (
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 13, color: '#475569', fontWeight: '600', marginBottom: 4 }}>
                  ℹ️ Détails de l'élément
                </Text>
                <Text style={{ fontSize: 12, color: '#1E293B' }}>
                  {(() => {
                    const e = availableEntities.find(ent => ent.id === formData.id_source);
                    const details = [];
                    if (e.statut) details.push(`Statut: ${e.statut}`);
                    if (e.poids) details.push(`Poids: ${e.poids} kg`);
                    if (e.race) details.push(`Race: ${e.race}`);
                    if (e.prix_unitaire) details.push(`Prix: ${e.prix_unitaire} BIF`);
                    return details.join(' | ') || 'Aucun détail supplémentaire';
                  })()}
                </Text>
              </View>
            )}

            {selectedCategory && (['vente_lait', 'vente_oeufs'].includes(selectedCategory.value)) && (
              <TextInput
                label={`Quantité à vendre (${selectedEntityDetails?.unite_mesure || ''})`}
                value={formData.quantite?.toString()}
                onChangeText={(text) => setFormData({ ...formData, quantite: text })}
                keyboardType="numeric"
                mode="outlined"
                style={commonStyle}
              />
            )}

            {activeSection === 'revenues' && (
              <Menu
                visible={clientMenuVisible}
                onDismiss={() => setClientMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setClientMenuVisible(true)}
                    style={commonStyle}
                    icon="account"
                    contentStyle={{ flexDirection: 'row-reverse' }}
                    disabled={loadingClients}
                    loading={loadingClients}
                  >
                    {formData.id_client ?
                      (availableClients.find(c => c.id === formData.id_client)?.nom_client || 'Client sélectionné') :
                      'Sélectionner un Client'}
                  </Button>
                }
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {availableClients.map((client) => (
                    <Menu.Item
                      key={client.id}
                      onPress={() => {
                        setFormData({ ...formData, id_client: client.id });
                        setClientMenuVisible(false);
                      }}
                      title={client.nom_client || client.nom_complet}
                    />
                  ))}
                </ScrollView>
              </Menu>
            )}

            <Menu
              visible={paymentMenuVisible}
              onDismiss={() => setPaymentMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setPaymentMenuVisible(true)}
                  style={commonStyle}
                  icon="credit-card"
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  {formData.mode_paiement ?
                    PAYMENT_MODES.find(m => m.value === formData.mode_paiement)?.label :
                    'Mode de Paiement'}
                </Button>
              }
            >
              {PAYMENT_MODES.map((mode) => (
                <Menu.Item
                  key={mode.value}
                  onPress={() => {
                    setFormData({ ...formData, mode_paiement: mode.value });
                    setPaymentMenuVisible(false);
                  }}
                  title={mode.label}
                />
              ))}
            </Menu>

            <TextInput
              label="Libellé / Description"
              value={formData.libelle || ''}
              onChangeText={(text) => setFormData({ ...formData, libelle: text })}
              mode="outlined"
              style={commonStyle}
            />
            <TextInput
              label="Montant (BIF)"
              value={formData.montant?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, montant: text })}
              mode="outlined"
              style={commonStyle}
              keyboardType="numeric"
            />
            <TextInput
              label="Date (YYYY-MM-DD)"
              value={formData.date_operation || new Date().toISOString().split('T')[0]}
              onChangeText={(text) => setFormData({ ...formData, date_operation: text })}
              mode="outlined"
              style={commonStyle}
            />
          </View>
        );
      }

      const fields = getFieldsForSection(activeSection);

      return fields.map(field => (
        <TextInput
          key={field.key}
          label={field.label}
          value={formData[field.key]?.toString() || ''}
          onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
          mode="outlined"
          style={commonStyle}
          keyboardType={field.keyboard || 'default'}
        />
      ));
    };

    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === 'edit' ? 'Modifier' : 'Ajouter'} - {getSectionTitle(activeSection)}
              </Text>
              <IconButton icon="close" size={24} onPress={onDismiss} />
            </View>
            <Divider />
            <View style={styles.modalBody}>
              {renderFields()}
            </View>
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                style={styles.modalActionBtn}
              >
                {mode === 'edit' ? 'Enregistrer' : 'Ajouter'}
              </Button>
              <Button mode="outlined" onPress={onDismiss} style={styles.modalActionBtn}>
                Annuler
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  const getFieldsForSection = (section) => {
    const fieldMap = {
      parcelles: [
        { key: 'nom_parcelle', label: 'Nom de la parcelle' },
        { key: 'reference', label: 'Référence' },
        { key: 'superficie_hectares', label: 'Superficie (ha)', keyboard: 'numeric' },
        { key: 'localisation', label: 'Localisation' },
        { key: 'type_sol', label: 'Type de sol' }
      ],
      cultures: [
        { key: 'nom_culture', label: 'Nom de la culture' },
        { key: 'id_parcelle', label: 'ID Parcelle', keyboard: 'numeric' },
        { key: 'id_type_culture', label: 'ID Type Culture', keyboard: 'numeric' },
        { key: 'variete', label: 'Variété' },
        { key: 'date_semaison', label: 'Date de semaison (YYYY-MM-DD)' }
      ],
      production: [
        { key: 'id_culture', label: 'ID Culture', keyboard: 'numeric' },
        { key: 'quantite', label: 'Quantité', keyboard: 'numeric' },
        { key: 'unite', label: 'Unité (kg, litres, etc.)' },
        { key: 'qualite', label: 'Qualité' },
        { key: 'date_recolte', label: 'Date (YYYY-MM-DD)' }
      ],
      cheptel: [
        { key: 'numero_identification', label: 'N° Identification' },
        { key: 'nom_animal', label: 'Nom' },
        { key: 'espece', label: 'Espèce' },
        { key: 'race', label: 'Race' },
        { key: 'sexe', label: 'Sexe (M/F)' },
        { key: 'date_naissance', label: 'Date naissance (YYYY-MM-DD)' }
      ],
      'prod-lait': [
        { key: 'id_animal', label: 'ID Animal', keyboard: 'numeric' },
        { key: 'quantite_litres', label: 'Quantité (Litres)', keyboard: 'numeric' },
        { key: 'date_production', label: 'Date (YYYY-MM-DD)' }
      ],
      'prod-oeufs': [
        { key: 'id_groupe', label: 'ID Groupe', keyboard: 'numeric' },
        { key: 'quantite', label: 'Quantité', keyboard: 'numeric' },
        { key: 'date_production', label: 'Date (YYYY-MM-DD)' }
      ],
      vehicules: [
        { key: 'immatriculation', label: 'Immatriculation' },
        { key: 'marque', label: 'Marque' },
        { key: 'modele', label: 'Modèle' },
        { key: 'type_vehicule', label: 'Type' },
        { key: 'prix_achat', label: 'Prix d\'achat', keyboard: 'numeric' },
        { key: 'date_achat', label: 'Date (YYYY-MM-DD)' }
      ],
      commandes: [
        { key: 'id_client', label: 'ID Client', keyboard: 'numeric' },
        { key: 'montant_total', label: 'Montant Total', keyboard: 'numeric' },
        { key: 'statut', label: 'Statut' }
      ],
      stocks: [
        { key: 'designation', label: 'Désignation' },
        { key: 'quantite_disponible', label: 'Quantité', keyboard: 'numeric' },
        { key: 'unite_mesure', label: 'Unité' }
      ],
      clients: [
        { key: 'nom_complet', label: 'Nom complet' },
        { key: 'telephone', label: 'Téléphone', keyboard: 'phone-pad' },
        { key: 'email', label: 'Email', keyboard: 'email-address' }
      ],
      fournisseurs: [
        { key: 'nom_societe', label: 'Société' },
        { key: 'contact_nom', label: 'Contact' },
        { key: 'telephone', label: 'Téléphone', keyboard: 'phone-pad' }
      ]
    };

    return fieldMap[section] || [
      { key: 'nom', label: 'Nom/Libellé' },
      { key: 'description', label: 'Description' },
      { key: 'montant', label: 'Montant', keyboard: 'numeric' },
      { key: 'date', label: 'Date (YYYY-MM-DD)' }
    ];
  };

  // ==================== DETAIL MODAL ====================
  const DetailModal = ({ visible, onDismiss, item, departmentType, activeSection, onEdit, onDelete, userRole }) => {
    if (!item) return null;

    const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin';

    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {item.nom || item.nom_complet || item.designation || item.numero_identification || 'Détails'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={onDismiss}
              />
            </View>

            <Divider />

            <View style={styles.modalBody}>
              {Object.entries(item).map(([key, value]) => {
                if (key === 'id' || key === 'photo' || value === null || value === undefined) return null;
                if (typeof value === 'object') return null; // Skip complex objects for now

                return (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{formatLabel(key)}:</Text>
                    <Text style={styles.detailValue}>{formatValue(value, key)}</Text>
                  </View>
                );
              })}

              {(activeSection === 'factures' || (activeSection === 'commandes' && item.type === 'vente')) && (
                <Button
                  mode="contained"
                  onPress={() => handleViewFacture(item)}
                  icon="file-document"
                  style={{ marginTop: 20 }}
                  buttonColor="#6200EE"
                >
                  Voir Facture OBR
                </Button>
              )}
            </View>

            <View style={[styles.modalActions, isManagerOrAdmin && styles.modalActionsMulti]}>
              {isManagerOrAdmin && (
                <>
                  <Button
                    mode="outlined"
                    onPress={() => onEdit(item)}
                    style={styles.modalActionBtn}
                    icon="pencil"
                  >
                    Modifier
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => onDelete(item)}
                    style={[styles.modalActionBtn, { borderColor: '#E74C3C' }]}
                    labelStyle={{ color: '#E74C3C' }}
                    icon="delete"
                  >
                    Supprimer
                  </Button>
                </>
              )}
              <Button mode="contained" onPress={onDismiss} style={styles.modalActionBtn}>
                Fermer
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  // ==================== HELPER FUNCTIONS ====================
  const getDepartmentIcon = (type) => {
    const icons = {
      agriculture: 'agriculture',
      elevage: 'pets',
      flotte: 'directions-car',
      commercial: 'shopping-cart',
      finance: 'attach-money'
    };
    return icons[type] || 'business';
  };

  const getSectionTitle = (section) => {
    const titles = {
      overview: 'Vue d\'ensemble',
      parcelles: 'Gestion des Parcelles',
      cultures: 'Gestion des Cultures',
      intrants: 'Gestion des Intrants',
      production: 'Production et Récoltes',
      cheptel: 'Gestion du Cheptel',
      aliments: 'Gestion des Aliments',
      vehicules: 'Gestion des Véhicules',
      missions: 'Gestion des Missions',
      maintenance: 'Maintenance',
      frais: 'Gestion des Frais',
      commandes: 'Gestion des Commandes',
      clients: 'Gestion des Clients',
      fournisseurs: 'Gestion des Fournisseurs',
      stocks: 'Gestion des Stocks',
      budgets: 'Gestion des Budgets',
      revenues: 'Mouvements d\'Entrées',
      expenses: 'Mouvements de Sorties'
    };
    return titles[section] || 'Modules Opérationnels';
  };

  const getOverviewIcon = (type) => {
    const icons = {
      parcelles: 'terrain',
      cultures: 'agriculture',
      intrants: 'science',
      recoltes: 'inventory',
      animaux: 'pets',
      lait: 'local-drink',
      oeufs: 'egg',
      aliments: 'restaurant',
      vehicules: 'directions-car',
      missions: 'navigation',
      maintenances: 'build',
      frais: 'attach-money',
      commandes: 'shopping-cart',
      clients: 'people',
      fournisseurs: 'store',
      stocks: 'inventory',
      budgets: 'account-balance-wallet',
      revenues: 'trending-up',
      expenses: 'trending-down'
    };
    return icons[type] || 'dashboard';
  };

  const calculateCultureProgress = (culture) => {
    if (!culture.date_semaison || !culture.date_recolte_prevue) return 0;
    const start = new Date(culture.date_semaison);
    const end = new Date(culture.date_recolte_prevue);
    const now = new Date();
    const total = end - start;
    const current = now - start;
    return Math.min(Math.max(current / total, 0), 1);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const now = new Date();
    const diffYears = now.getFullYear() - birth.getFullYear();
    const diffMonths = now.getMonth() - birth.getMonth();

    if (diffYears > 0) {
      return `${diffYears} an(s)`;
    } else if (diffMonths > 0) {
      return `${diffMonths} mois`;
    } else {
      const diffDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
      return `${diffDays} jour(s)`;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0 BIF';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  const formatLabel = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value, key = '') => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('date')) return formatDate(value);
    if (lowerKey.includes('montant') || lowerKey.includes('prix') || lowerKey.includes('cout') || lowerKey.includes('solde') || lowerKey.includes('budget')) {
      return formatCurrency(value);
    }

    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Color helper functions
  const getParcelleStatusColor = (status) => {
    const colors = {
      active: '#2ECC71',
      en_culture: '#3498DB',
      en_jachere: '#F39C12',
      recoltee: '#95A5A6'
    };
    return colors[status] || '#95A5A6';
  };

  const getCultureStatusColor = (status) => {
    const colors = {
      semis: '#3498DB',
      levage: '#16A085',
      croissance: '#27AE60',
      floraison: '#9B59B6',
      maturation: '#F39C12',
      recolte: '#2ECC71',
      en_cours: '#3498DB',
      recoltee: '#2ECC71',
      abandonnee: '#E74C3C'
    };
    return colors[status] || '#95A5A6';
  };

  const getIntrantIcon = (type) => {
    const icons = {
      engrais_chimique: 'science',
      engrais_organique: 'science',
      pesticide: 'bug-report',
      herbicide: 'bug-report',
      fongicide: 'bug-report',
      semence: 'grass'
    };
    return icons[type] || 'science';
  };

  const getIntrantColor = (type) => {
    const colors = {
      engrais_chimique: '#27AE60',
      engrais_organique: '#27AE60',
      pesticide: '#E74C3C',
      herbicide: '#E74C3C',
      fongicide: '#E74C3C',
      semence: '#16A085'
    };
    return colors[type] || '#95A5A6';
  };

  const getQualityColor = (quality) => {
    const colors = {
      excellente: '#2ECC71',
      bonne: '#3498DB',
      moyenne: '#F39C12',
      faible: '#E74C3C'
    };
    return colors[quality] || '#95A5A6';
  };

  const getAnimalHealthColor = (health) => {
    const colors = {
      excellent: '#2ECC71',
      bon: '#2ECC71',
      moyen: '#F39C12',
      malade: '#E74C3C',
      en_traitement: '#E74C3C'
    };
    return colors[health] || '#95A5A6';
  };

  const getQualityGradeColor = (grade) => {
    const colors = {
      A: '#2ECC71',
      B: '#3498DB',
      C: '#F39C12',
      D: '#E74C3C'
    };
    return colors[grade] || '#95A5A6';
  };

  const getVehicleIcon = (type) => {
    const icons = {
      camion: 'local-shipping',
      pickup: 'airport-shuttle',
      voiture: 'directions-car',
      moto: 'motorcycle',
      engin: 'construction'
    };
    return icons[type] || 'directions-car';
  };

  const getVehicleStatusColor = (status) => {
    const colors = {
      actif: '#2ECC71',
      maintenance: '#F39C12',
      hors_service: '#E74C3C',
      vendu: '#95A5A6'
    };
    return colors[status] || '#95A5A6';
  };

  const getMissionStatusColor = (status) => {
    const colors = {
      en_cours: '#3498DB',
      termine: '#2ECC71',
      annule: '#E74C3C'
    };
    return colors[status] || '#95A5A6';
  };

  const getMaintenanceStatusColor = (status) => {
    const colors = {
      planifie: '#3498DB',
      en_cours: '#F39C12',
      termine: '#2ECC71',
      annule: '#E74C3C'
    };
    return colors[status] || '#95A5A6';
  };

  const getCommandeStatusColor = (status) => {
    const colors = {
      brouillon: '#95A5A6',
      confirmee: '#3498DB',
      envoyee: '#3498DB',
      en_preparation: '#F39C12',
      livree_partielle: '#F39C12',
      livree_complete: '#2ECC71',
      facturee: '#9B59B6',
      payee: '#27AE60',
      annulee: '#E74C3C'
    };
    return colors[status] || '#95A5A6';
  };

  const getFideliteColor = (niveau) => {
    const colors = {
      vip: '#9B59B6',
      fidele: '#3498DB',
      regulier: '#2ECC71',
      occasionnel: '#F39C12',
      nouveau: '#95A5A6'
    };
    return colors[niveau] || '#95A5A6';
  };

  // ==================== RENDER MAIN ====================

  const renderTransactionModal = () => (
    <Portal>
      <Modal
        visible={transactionModalVisible}
        onDismiss={() => setTransactionModalVisible(false)}
        contentContainerStyle={styles.modalLarge}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title style={styles.modalTitle}>
              {transactionType === 'vente' ? 'Nouvelle Vente' : 'Nouvel Achat'}
            </Title>
            <IconButton icon="close" onPress={() => setTransactionModalVisible(false)} />
          </View>

          <View style={styles.modalBody}>
            {transactionItem && (
              <Paragraph style={{ marginBottom: 15, color: '#666', fontStyle: 'italic' }}>
                Concerne: {transactionForm.description}
              </Paragraph>
            )}

            <TextInput
              label="Montant (BIF)"
              value={transactionForm.montant}
              onChangeText={(text) => setTransactionForm({ ...transactionForm, montant: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="cash" />}
            />

            <TextInput
              label="Description"
              value={transactionForm.description}
              onChangeText={(text) => setTransactionForm({ ...transactionForm, description: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.label, { marginTop: 15, marginBottom: 5 }]}>Mode de Paiement</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['especes', 'mobile_money', 'virement', 'cheque', 'credit'].map((mode) => (
                <Chip
                  key={mode}
                  selected={transactionForm.mode_paiement === mode}
                  onPress={() => setTransactionForm({ ...transactionForm, mode_paiement: mode })}
                  style={{ backgroundColor: transactionForm.mode_paiement === mode ? '#E8F6F3' : '#F2F3F4' }}
                  selectedColor="#16A085"
                >
                  {mode.replace('_', ' ').toUpperCase()}
                </Chip>
              ))}
            </View>

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <Button
                onPress={() => setTransactionModalVisible(false)}
                style={{ marginRight: 10 }}
                disabled={transactionLoading}
              >
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmitTransaction}
                loading={transactionLoading}
                disabled={transactionLoading}
                style={{ backgroundColor: transactionType === 'vente' ? '#27AE60' : '#E74C3C' }}
              >
                Confirmer {transactionType === 'vente' ? 'Vente' : 'Achat'}
              </Button>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement des modules...</Text>
      </SafeAreaView>
    );
  }

  if (!departmentType) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={60} color="#E74C3C" />
        <Text style={styles.errorText}>Type de département non reconnu</Text>
        <Text style={styles.errorText}>Type reçu: {JSON.stringify(departmentInfo)}</Text>
        <Button
          mode="contained"
          onPress={() => {
            console.log('🔄 Rechargement des informations...');
            loadDepartmentInfo();
          }}
          style={{ marginTop: 20 }}
        >
          Réessayer
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        >
          Retour
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* Header */}
      {renderHeader()}

      {/* Sections Navigation */}
      {renderSectionsNav()}

      {/* Filters */}
      {renderFiltersBar()}

      {/* Content */}
      <FlatList
        data={filteredData}
        renderItem={renderCard}
        keyExtractor={(item, index) => item.id?.toString() || `item-${index}`}
        numColumns={viewMode === 'grid' ? getGridColumns() : 1}
        key={viewMode === 'grid' ? `grid-${getGridColumns()}` : 'list'}
        contentContainerStyle={styles.listContainer}
        {...(viewMode === 'grid' && getGridColumns() > 1 && { columnWrapperStyle: styles.gridRow })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E86C1']}
            tintColor="#2E86C1"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={getResponsiveValue(60, 70, 80, 90)} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Essayez de modifier vos critères de recherche' : 'Les données apparaîtront ici'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Detail Modal */}
      <DetailModal
        visible={detailModalVisible}
        onDismiss={() => setDetailModalVisible(false)}
        item={selectedItem}
        departmentType={departmentType}
        activeSection={activeSection}
        onEdit={(item) => {
          setDetailModalVisible(false);
          setSelectedItem(item);
          setOperationMode('edit');
          setOperationModalVisible(true);
        }}
        onDelete={(item) => {
          setDetailModalVisible(false);
          handleDeleteItem(item);
        }}
        userRole={userRole}
      />

      {/* Operation Form Modal */}
      <OperationModal
        visible={operationModalVisible}
        onDismiss={() => setOperationModalVisible(false)}
        mode={operationMode}
        item={selectedItem}
        departmentType={departmentType}
        departmentId={departmentInfo?.id}
        activeSection={activeSection}
        onSuccess={() => {
          setOperationModalVisible(false);
          loadData();
        }}
      />

      {/* Floating Action Button for Adding */}
      {(userRole === 'manager' || userRole === 'admin') && activeSection !== 'overview' && (
        <FAB
          style={styles.fab}
          icon="plus"
          color="#FFF"
          onPress={() => {
            setSelectedItem(null);
            setOperationMode('create');
            setOperationModalVisible(true);
          }}
        />
      )}

      {renderInvoiceModal()}
      {renderTransactionModal()}
    </SafeAreaView>
  );
};





// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  loadingText: {
    marginTop: 15,
    fontSize: getResponsiveValue(14, 15, 16, 17),
    color: '#7F8C8D',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 15,
    fontSize: getResponsiveValue(14, 15, 16, 17),
    color: '#E74C3C',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  // Header
  headerContainer: {
    backgroundColor: '#FFF',
    paddingVertical: getResponsiveValue(12, 15, 18, 20),
    paddingHorizontal: getResponsiveValue(15, 20, 25, 30),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: getResponsiveValue(12, 14, 15, 16),
    flex: 1,
  },
  headerTitle: {
    fontSize: getResponsiveValue(18, 20, 22, 24),
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  deptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerSubtitle: {
    fontSize: getResponsiveValue(13, 14, 15, 16),
    color: '#7F8C8D',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: getResponsiveValue(20, 22, 24, 26),
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  statLabel: {
    fontSize: getResponsiveValue(11, 12, 13, 14),
    color: '#7F8C8D',
    marginTop: 4,
  },

  // Sections Bar
  sectionsBar: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  sectionsBarContent: {
    paddingHorizontal: 5,
  },
  sectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveValue(15, 18, 20, 22),
    paddingVertical: getResponsiveValue(12, 13, 14, 15),
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 2,
  },
  sectionButtonActive: {
    borderBottomColor: '#2E86C1',
    backgroundColor: '#E8F4F8',
  },
  sectionText: {
    marginLeft: 8,
    fontSize: getResponsiveValue(13, 14, 15, 16),
    color: '#7F8C8D',
    fontWeight: '500',
  },
  sectionTextActive: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },

  // Filters
  filtersContainer: {
    backgroundColor: '#FFF',
    padding: getResponsiveValue(12, 15, 18, 20),
  },
  searchBar: {
    backgroundColor: '#F8F9F9',
    elevation: 0,
    borderRadius: 8,
    marginBottom: 12,
  },
  searchInput: {
    fontSize: getResponsiveValue(14, 15, 16, 17),
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    height: 32,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
  },

  // List
  listContainer: {
    padding: getResponsiveValue(10, 12, 15, 20),
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 10,
  },
  cardWrapper: {
    marginBottom: 10,
  },

  // Cards
  itemCard: {
    width: '100%',
  },
  card: {
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cardHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: getResponsiveValue(15, 16, 17, 18),
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  cardSubtitle: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    color: '#7F8C8D',
    marginTop: 2,
  },
  cardContent: {
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardRowText: {
    fontSize: getResponsiveValue(13, 14, 14, 15),
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
    marginTop: 8,
  },
  cardFooterText: {
    fontSize: getResponsiveValue(12, 13, 13, 14),
    color: '#7F8C8D',
    marginLeft: 8,
    flex: 1,
  },

  // Chips & Badges
  statusChip: {
    height: 24,
  },
  qualityChip: {
    height: 24,
  },
  fideliteChip: {
    height: 24,
  },
  validationChip: {
    height: 24,
  },
  chipText: {
    color: '#FFF',
    fontSize: getResponsiveValue(10, 11, 11, 12),
    fontWeight: '600',
  },
  alertBadge: {
    backgroundColor: '#E74C3C',
    color: '#FFF',
  },

  // Progress
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  progressText: {
    fontSize: getResponsiveValue(11, 12, 12, 13),
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  stockProgressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },

  // Overview
  overviewCard: {
    flex: 1,
    margin: 5,
  },
  overviewCardSurface: {
    padding: getResponsiveValue(18, 20, 22, 24),
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  overviewCardTitle: {
    fontSize: getResponsiveValue(14, 15, 16, 17),
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 10,
    textTransform: 'capitalize',
  },
  overviewCardCount: {
    fontSize: getResponsiveValue(24, 26, 28, 30),
    fontWeight: 'bold',
    color: '#2E86C1',
    marginTop: 5,
  },

  overviewFinLabel: {
    fontSize: getResponsiveValue(11, 12, 13, 14),
    color: '#34495E',
    marginBottom: 4,
    fontWeight: '500',
  },
  overviewFinValue: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  overviewFinanceContent: {
    width: '100%',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  dateBadge: {
    backgroundColor: '#ECF0F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateBadgeText: {
    fontSize: getResponsiveValue(10, 11, 12, 13),
    color: '#7F8C8D',
    fontWeight: '600',
  },
  stockProgressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalActionsMulti: {
    justifyContent: 'space-between',
  },
  modalActionBtn: {
    minWidth: 100,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
    marginLeft: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2E86C1',
    borderRadius: 28,
  },
  soldeLabel: {
    fontSize: getResponsiveValue(10, 11, 12, 12),
    color: '#7F8C8D',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  soldeValue: {
    fontSize: getResponsiveValue(16, 18, 20, 22),
    fontWeight: 'bold',
    marginTop: 2,
  },
  alertRefinancement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9E7',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F9E79F',
  },
  alertRefinancementText: {
    fontSize: getResponsiveValue(11, 12, 12, 13),
    color: '#D68910',
    marginLeft: 6,
    fontWeight: '600',
    flex: 1,
  },

  // Other
  amountText: {
    fontSize: getResponsiveValue(15, 16, 17, 18),
    fontWeight: 'bold',
    color: '#27AE60',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: getResponsiveValue(60, 70, 80, 90),
    paddingHorizontal: 30,
  },
  emptyText: {
    marginTop: 15,
    fontSize: getResponsiveValue(16, 17, 18, 19),
    fontWeight: '600',
    color: '#95A5A6',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: getResponsiveValue(13, 14, 15, 15),
    color: '#BDC3C7',
    textAlign: 'center',
  },

  // Modal
  modalContainer: {
    backgroundColor: '#FFF',
    margin: getResponsiveValue(20, 30, 40, 50),
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalContent: {
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: getResponsiveValue(16, 18, 20, 22),
  },
  modalTitle: {
    fontSize: getResponsiveValue(18, 20, 22, 24),
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  modalBody: {
    padding: getResponsiveValue(16, 18, 20, 22),
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  detailLabel: {
    fontSize: getResponsiveValue(13, 14, 15, 15),
    fontWeight: '600',
    color: '#7F8C8D',
    width: '40%',
  },
  // OBR Invoice Styles
  obrInvoiceScroll: {
    padding: 25,
    backgroundColor: '#FFFFFF',
  },
  obrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  obrVendorSection: {
    flex: 2,
  },
  obrInvoiceMeta: {
    flex: 1,
    alignItems: 'flex-end',
  },
  obrMainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
    textDecorationLine: 'underline',
  },
  obrInvoiceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6200EE',
    marginBottom: 5,
  },
  obrInvoiceDate: {
    fontSize: 14,
    color: '#000',
  },
  obrDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  obrLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  obrValue: {
    fontSize: 12,
    color: '#333',
    fontStyle: 'italic',
  },
  obrDivider: {
    marginVertical: 15,
    height: 1,
  },
  obrClientSection: {
    marginBottom: 20,
  },
  obrTable: {
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 10,
  },
  obrTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  obrTableHeaderCell: {
    padding: 8,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#000',
  },
  obrTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 30,
  },
  obrTableCell: {
    padding: 8,
    fontSize: 12,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  obrTotalRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  detailValue: {
    fontSize: getResponsiveValue(13, 14, 15, 15),
    color: '#2C3E50',
    width: '60%',
  },
  modalActions: {
    padding: getResponsiveValue(16, 18, 20, 22),
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
});

export default ModulesOperationnelsScreen;