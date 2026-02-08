// frontend/src/screens/admin/FinanceComptabiliteScreen.js
// VERSION COMPLÈTE CORRIGÉE - GESTION TOKEN + TOUS LES ENDPOINTS
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  RefreshControl,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  Searchbar,
  Chip,
  Modal,
  Portal,
  TextInput,
  IconButton,
  SegmentedButtons,
  FAB,
  Menu,
  Divider,
  DataTable,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireAuth } from '../../utils/authGuard';
import axios from 'axios';

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};

const getPlatformType = () => {
  if (Platform.OS === 'web') {
    if (SCREEN_WIDTH >= BREAKPOINTS.wide) return 'wide';
    if (SCREEN_WIDTH >= BREAKPOINTS.desktop) return 'desktop';
    if (SCREEN_WIDTH >= BREAKPOINTS.tablet) return 'tablet';
    return 'web_mobile';
  }
  return Platform.OS === 'android' ? 'android' : 'ios';
};

const PLATFORM_TYPE = getPlatformType();
const isWeb = Platform.OS === 'web';
const isMobile = Platform.OS === 'ios' || Platform.OS === 'android' ||
  (isWeb && SCREEN_WIDTH < BREAKPOINTS.tablet);
const isTablet = SCREEN_WIDTH >= BREAKPOINTS.tablet && SCREEN_WIDTH < BREAKPOINTS.desktop;
const isDesktop = SCREEN_WIDTH >= BREAKPOINTS.desktop;
const isWide = SCREEN_WIDTH >= BREAKPOINTS.wide;

const COLORS = {
  primary: '#2E86C1',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  text: '#1F2937',
  subtext: '#6B7280',
  background: '#F3F4F6',
  card: '#FFFFFF',
  border: '#E5E7EB',
  light: '#F9FAFB',
};

// ============================================
// UTILITAIRES
// ============================================
const formatMontant = (montant) => {
  if (!montant && montant !== 0) return '0,00 BIF';
  const num = parseFloat(montant);
  if (isNaN(num)) return '0,00 BIF';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'BIF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatDateCourte = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch (error) {
    return '';
  }
};

const formatDateLongue = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (error) {
    return '';
  }
};

const getCategorieColor = (categorie) => {
  const map = {
    vente: COLORS.success,
    achat: COLORS.danger,
    salaire: COLORS.warning,
    production: '#8B5CF6',
    stock: COLORS.info,
    maintenance: '#F97316',
    autre: COLORS.subtext,
  };
  return map[categorie?.toLowerCase()] || COLORS.subtext;
};

const getCategorieIcon = (categorie) => {
  const icons = {
    vente: 'trending-up',
    achat: 'shopping-cart',
    salaire: 'people',
    production: 'precision-manufacturing',
    stock: 'inventory',
    maintenance: 'build',
    autre: 'info',
  };
  return icons[categorie?.toLowerCase()] || 'info';
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
const FinanceComptabiliteScreen = ({ navigation, route, onLogout }) => {
  const { user, isLoading: authLoading } = requireAuth(navigation, { role: 'admin' });

  // ============================================
  // STATES PRINCIPAUX
  // ============================================
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true); // ✅ NOUVEAU: État de chargement du token
  const [error, setError] = useState(null);

  // Dashboard
  const [dashboardData, setDashboardData] = useState(null);

  // Factures
  const [factures, setFactures] = useState([]);
  const [facturesPagination, setFacturesPagination] = useState({});
  const [factureModalVisible, setFactureModalVisible] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [factureForm, setFactureForm] = useState({
    type_facture: 'vente',
    id_client: null,
    id_fournisseur: null,
    date_echeance: new Date(),
    montant_ht: '',
    montant_tva: '',
    montant_ttc: '',
    mode_reglement: 'virement',
  });

  // Paiements
  const [paiements, setPaiements] = useState([]);
  const [paiementsPagination, setPaiementsPagination] = useState({});
  const [selectedPaiement, setSelectedPaiement] = useState(null);
  const [paiementModalVisible, setPaiementModalVisible] = useState(false);
  const [paiementForm, setPaiementForm] = useState({
    type_paiement: 'recette',
    montant: '',
    mode_paiement: 'especes',
    reference_mode: '',
    source_type: 'client',
    id_source: null,
    description: '',
    date_paiement: new Date(),
  });

  // Journal Comptable
  const [journalMouvements, setJournalMouvements] = useState([]);
  const [journalTotaux, setJournalTotaux] = useState({
    total_entrees: 0,
    total_sorties: 0,
    solde: 0,
    nombre_operations: 0,
  });
  const [journalRepartition, setJournalRepartition] = useState([]);
  const [journalPagination, setJournalPagination] = useState({});
  const [journalFilters, setJournalFilters] = useState({
    categorie: 'all',
    type_mouvement: 'all',
    tiers_type: '',
    exercice: '',
    periode: '',
  });

  // Balance Comptable
  const [balanceComptable, setBalanceComptable] = useState([]);
  const [balancePagination, setBalancePagination] = useState({});

  // Grand Livre
  const [grandLivre, setGrandLivre] = useState([]);
  const [grandLivrePagination, setGrandLivrePagination] = useState({});
  const [compteGrandLivre, setCompteGrandLivre] = useState('');

  // Statistiques
  const [statistiques, setStatistiques] = useState(null);

  // Rapports
  const [rapportType, setRapportType] = useState('synthese');
  const [rapportData, setRapportData] = useState(null);
  const [selectedDepartement, setSelectedDepartement] = useState('all');
  const [selectedPeriode, setSelectedPeriode] = useState('month');
  const [departements, setDepartements] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuType, setMenuType] = useState('');

  // Dates
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(isMobile ? 10 : 20);

const [clientsList, setClientsList] = useState([]);
const [fournisseursList, setFournisseursList] = useState([]);
const [tiersList, setTiersList] = useState([]);
const [sourcesList, setSourcesList] = useState([]);
const [facturesList, setFacturesList] = useState([]);

  // ============================================
  // AUTH & TOKEN - ✅ CORRIGÉ
  // ============================================
  const handleLogout = async () => {
    console.log('Déconnexion initiée');

    try {
      // Nettoyer le stockage local
      await AsyncStorage.clear();
      console.log('Storage nettoyé');

      // Appeler la fonction de déconnexion du parent
      setTimeout(() => {
        if (onLogout && typeof onLogout === 'function') {
          console.log('Appel de onLogout');
          onLogout();
        } else {
          console.error('onLogout non disponible');
          Alert.alert(
            'Erreur',
            'Impossible de se déconnecter. Veuillez redémarrer l\'application.'
          );
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);

      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la déconnexion.'
      );
    }
  };

  const loadToken = async () => {
    try {
      setTokenLoading(true);
      console.log('🔄 Chargement du token depuis AsyncStorage...');

      const storedToken = await AsyncStorage.getItem('userToken');
      const userDataStr = await AsyncStorage.getItem('userData');

      console.log('📦 Token trouvé:', storedToken ? 'Oui ✅' : 'Non ❌');

      if (!storedToken) {
        console.error('❌ Aucun token dans AsyncStorage');
        setError('Session expirée. Veuillez vous reconnecter.');
        setTokenLoading(false);

        await handleLogout();
        return;
      }

      setToken(storedToken);
      console.log('✅ Token chargé avec succès');

      // Vérifier les données utilisateur
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        console.log('👤 Utilisateur:', userData.nom, '- Rôle:', userData.role);
      }

      setTokenLoading(false);
    } catch (error) {
      console.error('❌ Erreur lors du chargement du token:', error);
      setError('Erreur lors du chargement de la session');
      setTokenLoading(false);

      Alert.alert('Erreur', 'Impossible de charger la session', [
        { text: 'Réessayer', onPress: loadToken },
        { text: 'Se reconnecter', onPress: () => navigation.replace('Login') }
      ]);
    }
  };

  const getAxiosConfig = () => {
    if (!token) {
      console.warn('⚠️ Token manquant dans getAxiosConfig');
      return {};
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  };

  // ============================================
  // EFFECTS - ✅ CORRIGÉ
  // ============================================
  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    // ✅ Ne charger les données QUE si le token est présent et chargé
    if (token && !tokenLoading) {
      setCurrentPage(1);
      loadData();
    }
  }, [activeTab, selectedPeriode, startDate, endDate, selectedDepartement, token, tokenLoading, journalFilters]);

  useEffect(() => {
    if (token && !tokenLoading && currentPage > 1) {
      loadData();
    }
  }, [currentPage]);

  // ============================================
  // API CALLS - DASHBOARD
  // ============================================
  const loadDashboard = async () => {
    if (!token) {
      console.warn('⚠️ Tentative de chargement du dashboard sans token');
      return;
    }

    try {
      setError(null);
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };

      console.log('📊 Chargement du dashboard avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/dashboard`, {
        params,
        ...getAxiosConfig(),
      });

      console.log('✅ Réponse dashboard:', response.data);

      if (response.data.success) {
        const data = response.data.data || {};

        setDashboardData({
          ventes_mois: data.ventes_mois || [{ chiffre_affaires_mois: 0, nombre_commandes_mois: 0 }],
          achats_mois: data.achats_mois || [{ total_achats_mois: 0, nombre_achats_mois: 0 }],
          factures_impayees: data.factures_impayees || [{ factures_impayees: 0, montant_impaye: 0 }],
          factures_retard: data.factures_retard || [{ factures_en_retard: 0, montant_retard: 0 }],
          flux_tresorerie: data.flux_tresorerie || [],
          meilleurs_clients: data.meilleurs_clients || [],
          paiements_recents: data.paiements_recents || [],
        });
      } else {
        console.error('❌ Dashboard API a retourné success=false');
        setError('Le serveur a retourné une erreur');
      }
    } catch (error) {
      console.error('❌ Erreur dashboard:', error);
      console.error('Détails:', error.response?.data);

      const errorMessage = error.response?.data?.message || error.message || 'Erreur de chargement';
      setError(errorMessage);

      if (error.response?.status === 401) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter', [
          { text: 'OK', onPress: () => navigation.replace('Login') }
        ]);
      }
    }
  };

  /**
 * ENDPOINT 1: GET /clients - Charger les clients pour les sélecteurs
 */
const loadClients = async () => {
  if (!token) return;
  try {
    const response = await axios.get(`${API_BASE_URL}/finance/clients`, getAxiosConfig());
    if (response.data.success) {
      setClientsList(response.data.data || []);
    } else if (Array.isArray(response.data)) {
      setClientsList(response.data);
    }
  } catch (error) {
    console.error('❌ Erreur clients:', error);
    setClientsList([]);
  }
};

/**
 * ENDPOINT 2: GET /fournisseurs - Charger les fournisseurs pour les sélecteurs
 */
const loadFournisseurs = async () => {
  if (!token) return;
  try {
    const response = await axios.get(`${API_BASE_URL}/finance/fournisseurs`, getAxiosConfig());
    if (response.data.success) {
      setFournisseursList(response.data.data || []);
    } else if (Array.isArray(response.data)) {
      setFournisseursList(response.data);
    }
  } catch (error) {
    console.error('❌ Erreur fournisseurs:', error);
    setFournisseursList([]);
  }
};

/**
 * Charger la liste des tiers (clients ou fournisseurs selon le type)
 */
const loadTiersList = async (typeFacture) => {
  if (typeFacture === 'vente') {
    await loadClients();
    setTiersList(clientsList);
  } else {
    await loadFournisseurs();
    setTiersList(fournisseursList);
  }
};

/**
 * Charger la liste des sources (clients/fournisseurs/employés) pour les paiements
 */
const loadSourceList = async (sourceType) => {
  if (!token) return;
  try {
    let list = [];
    
    if (sourceType === 'client') {
      await loadClients();
      list = clientsList;
    } else if (sourceType === 'fournisseur') {
      await loadFournisseurs();
      list = fournisseursList;
    }
    
    setSourcesList(list);
  } catch (error) {
    console.error('❌ Erreur chargement sources:', error);
    setSourcesList([]);
  }
};

/**
 * Charger les factures non payées pour un client (pour les paiements)
 */
const loadFacturesList = async (idSource) => {
  if (!token || !idSource) return;

  try {
    const response = await axios.get(`${API_BASE_URL}/finance/factures`, {
      params: {
        id_client: idSource,
        statut_paiement: 'impayee',
      },
      ...getAxiosConfig(),
    });

    if (response.data.success) {
      setFacturesList(response.data.data || []);
    }
  } catch (error) {
    console.error('❌ Erreur factures du client:', error);
    setFacturesList([]);
  }
};

useEffect(() => {
  if (token && !tokenLoading) {
    loadClients();
    loadFournisseurs();
  }
}, [token, tokenLoading]);

  // ============================================
  // API CALLS - FACTURES
  // ============================================
  const loadFactures = async () => {
    if (!token) return;

    try {
      setError(null);
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        search: searchQuery,
        page: currentPage,
        limit: itemsPerPage,
      };

      console.log('📄 Chargement des factures avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/factures`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        setFactures(response.data.data || []);
        setFacturesPagination(response.data.pagination || {});
      }
    } catch (error) {
      console.error('❌ Erreur factures:', error);
      setError('Erreur lors du chargement des factures');
    }
  };

  const handleCreateFacture = async () => {
    if (!token) return;

    try {
      if (!factureForm.montant_ttc || parseFloat(factureForm.montant_ttc) <= 0) {
        Alert.alert('Erreur', 'Montant invalide');
        return;
      }

      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/finance/factures`,
        {
          ...factureForm,
          date_echeance: factureForm.date_echeance.toISOString().split('T')[0],
          montant_ht: parseFloat(factureForm.montant_ht) || 0,
          montant_tva: parseFloat(factureForm.montant_tva) || 0,
          montant_ttc: parseFloat(factureForm.montant_ttc),
        },
        getAxiosConfig()
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Facture créée avec succès');
        setFactureModalVisible(false);
        setCurrentPage(1);
        loadFactures();
      }
    } catch (error) {
      console.error('❌ Erreur création facture:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de créer la facture');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // API CALLS - PAIEMENTS
  // ============================================
  const loadPaiements = async () => {
    if (!token) return;

    try {
      setError(null);
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        search: searchQuery,
        page: currentPage,
        limit: itemsPerPage,
      };

      console.log('💳 Chargement des paiements avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/paiements`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        setPaiements(response.data.data || []);
        setPaiementsPagination(response.data.pagination || {});
      }
    } catch (error) {
      console.error('❌ Erreur paiements:', error);
      setError('Erreur lors du chargement des paiements');
    }
  };

  const handleSavePaiement = async () => {
    if (!token) return;

    try {
      if (!paiementForm.montant || parseFloat(paiementForm.montant) <= 0) {
        Alert.alert('Erreur', 'Montant invalide');
        return;
      }

      setLoading(true);

      const paiementData = {
        ...paiementForm,
        montant: parseFloat(paiementForm.montant),
        date_paiement: paiementForm.date_paiement.toISOString().split('T')[0],
      };

      if (selectedPaiement) {
        const response = await axios.put(
          `${API_BASE_URL}/finance/paiements/${selectedPaiement.id}`,
          paiementData,
          getAxiosConfig()
        );

        if (response.data.success) {
          Alert.alert('Succès', 'Paiement modifié');
        }
      } else {
        const response = await axios.post(
          `${API_BASE_URL}/finance/paiements`,
          paiementData,
          getAxiosConfig()
        );

        if (response.data.success) {
          Alert.alert('Succès', 'Paiement enregistré');
        }
      }

      setPaiementModalVisible(false);
      setSelectedPaiement(null);
      setCurrentPage(1);
      loadPaiements();
    } catch (error) {
      console.error('❌ Erreur paiement:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer le paiement');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // API CALLS - JOURNAL COMPTABLE
  // ============================================
  const loadJournalComptable = async () => {
    if (!token) return;

    try {
      setError(null);
      const params = {
        categorie: journalFilters.categorie,
        type_mouvement: journalFilters.type_mouvement,
        tiers_type: journalFilters.tiers_type,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        search: searchQuery,
        exercice: journalFilters.exercice,
        periode: journalFilters.periode,
        page: currentPage,
        limit: itemsPerPage,
      };

      console.log('📖 Chargement du journal avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/journal-comptable-complet`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        const data = response.data.data || {};
        setJournalMouvements(data.mouvements || []);
        setJournalTotaux(data.totaux || {
          total_entrees: 0,
          total_sorties: 0,
          solde: 0,
          nombre_operations: 0,
        });
        setJournalRepartition(data.repartition || []);
        setJournalPagination(data.pagination || {});
      }
    } catch (error) {
      console.error('❌ Erreur journal:', error);
      setError('Erreur lors du chargement du journal');
    }
  };

  // ============================================
  // API CALLS - BALANCE COMPTABLE
  // ============================================
  const loadBalanceComptable = async () => {
    if (!token) return;

    try {
      setError(null);
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        exercice: journalFilters.exercice,
        page: currentPage,
        limit: itemsPerPage,
      };

      console.log('⚖️ Chargement de la balance avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/balance-comptable`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        setBalanceComptable(response.data.data || []);
        setBalancePagination(response.data.pagination || {});
      } else if (Array.isArray(response.data)) {
        setBalanceComptable(response.data);
      }
    } catch (error) {
      console.error('❌ Erreur balance:', error);
      setError('Erreur lors du chargement de la balance');
    }
  };

  // ============================================
  // API CALLS - GRAND LIVRE
  // ============================================
  const loadGrandLivre = async () => {
    if (!token) return;

    try {
      if (!compteGrandLivre) {
        Alert.alert('Info', 'Veuillez entrer un numéro de compte');
        return;
      }

      setError(null);
      const params = {
        compte: compteGrandLivre,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        exercice: journalFilters.exercice,
        page: currentPage,
        limit: itemsPerPage,
      };

      console.log('📚 Chargement du grand livre avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/grand-livre`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        setGrandLivre(response.data.data || []);
        setGrandLivrePagination(response.data.pagination || {});
      } else if (Array.isArray(response.data)) {
        setGrandLivre(response.data);
      }
    } catch (error) {
      console.error('❌ Erreur grand livre:', error);
      setError('Erreur lors du chargement du grand livre');
    }
  };

  // ============================================
  // API CALLS - STATISTIQUES
  // ============================================
  const loadStatistiques = async () => {
    if (!token) return;

    try {
      const params = {
        categorie: journalFilters.categorie,
        type_mouvement: journalFilters.type_mouvement,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        exercice: journalFilters.exercice,
      };

      console.log('📈 Chargement des statistiques avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/journal-comptable/statistiques`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data) {
        setStatistiques(response.data);
      }
    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
    }
  };

  // ============================================
  // API CALLS - RAPPORTS
  // ============================================
  const loadRapports = async () => {
    if (!token) return;

    try {
      setError(null);
      const params = {
        type_periode: selectedPeriode,
        date_debut: startDate.toISOString().split('T')[0],
        date_fin: endDate.toISOString().split('T')[0],
        id_departement: selectedDepartement !== 'all' ? selectedDepartement : null,
        type_rapport: rapportType,
      };

      console.log('📊 Chargement des rapports avec params:', params);

      const response = await axios.get(`${API_BASE_URL}/finance/rapports`, {
        params,
        ...getAxiosConfig(),
      });

      if (response.data.success) {
        setRapportData(response.data.data || null);
      }
    } catch (error) {
      console.error('❌ Erreur rapports:', error);
      setError('Erreur lors du chargement des rapports');
    }
  };

  const loadDepartements = async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/finance/departements`, getAxiosConfig());
      if (response.data.success) {
        setDepartements(response.data.data || []);
      } else if (Array.isArray(response.data)) {
        setDepartements(response.data);
      }
    } catch (error) {
      console.error('❌ Erreur départements:', error);
      setDepartements([]);
    }
  };

  // ============================================
  // LOAD DATA PRINCIPAL - ✅ CORRIGÉ
  // ============================================
  const loadData = async () => {
    if (!token) {
      console.warn('⚠️ loadData appelé sans token');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Chargement des données pour l\'onglet:', activeTab);

      switch (activeTab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'factures':
          await loadFactures();
          break;
        case 'paiements':
          await loadPaiements();
          break;
        case 'journal':
          await loadJournalComptable();
          await loadStatistiques();
          break;
        case 'balance':
          await loadBalanceComptable();
          break;
        case 'grand-livre':
          if (compteGrandLivre) {
            await loadGrandLivre();
          }
          break;
        case 'rapports':
          await loadDepartements();
          await loadRapports();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('❌ Erreur loadData:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    setCurrentPage(1);
    loadData();
  }, [activeTab, token]);

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================
  const handleExportJournalExcel = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/finance/journal-comptable/export-excel`,
        {
          categorie: journalFilters.categorie,
          type_mouvement: journalFilters.type_mouvement,
          tiers_type: journalFilters.tiers_type,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          search: searchQuery,
          exercice: journalFilters.exercice,
          periode: journalFilters.periode,
        },
        {
          ...getAxiosConfig(),
          responseType: 'blob',
        }
      );

      if (isWeb) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Journal_Comptable_${startDate.toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        const filename = `Journal_Comptable_${startDate.toISOString().split('T')[0]}.xlsx`;
        const fileUri = FileSystem.documentDirectory + filename;

        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }

      Alert.alert('Succès', 'Export Excel réussi');
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter en Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJournalPDF = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/finance/journal-comptable/export-pdf`,
        {
          categorie: journalFilters.categorie,
          type_mouvement: journalFilters.type_mouvement,
          tiers_type: journalFilters.tiers_type,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          search: searchQuery,
          exercice: journalFilters.exercice,
          periode: journalFilters.periode,
        },
        {
          ...getAxiosConfig(),
          responseType: 'blob',
        }
      );

      if (isWeb) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Journal_Comptable_${startDate.toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        const filename = `Journal_Comptable_${startDate.toISOString().split('T')[0]}.pdf`;
        const fileUri = FileSystem.documentDirectory + filename;

        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }

      Alert.alert('Succès', 'Export PDF réussi');
    } catch (error) {
      console.error('❌ Erreur export PDF:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter en PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleExportRapport = async (format) => {
    if (!token) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/finance/rapports/export`,
        {
          format,
          type_periode: selectedPeriode,
          date_debut: startDate.toISOString().split('T')[0],
          date_fin: endDate.toISOString().split('T')[0],
          id_departement: selectedDepartement !== 'all' ? selectedDepartement : null,
          type_rapport: rapportType,
        },
        {
          ...getAxiosConfig(),
          responseType: 'blob',
        }
      );

      if (isWeb) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        link.setAttribute('download', `Rapport_${rapportType}_${startDate.toISOString().split('T')[0]}.${extension}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        const filename = `Rapport_${rapportType}_${startDate.toISOString().split('T')[0]}.${extension}`;
        const fileUri = FileSystem.documentDirectory + filename;

        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }

      Alert.alert('Succès', 'Export réussi');
    } catch (error) {
      console.error('❌ Erreur export rapport:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter le rapport');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ACTIONS - FACTURES
  // ============================================
  const handleAddFacture = () => {
    setFactureForm({
      type_facture: 'vente',
      id_client: null,
      id_fournisseur: null,
      date_echeance: new Date(),
      montant_ht: '',
      montant_tva: '',
      montant_ttc: '',
      mode_reglement: 'virement',
    });
    setSelectedFacture(null);
    setFactureModalVisible(true);
  };

  // ============================================
  // ACTIONS - PAIEMENTS
  // ============================================
  const handleAddPaiement = () => {
    setPaiementForm({
      type_paiement: 'recette',
      montant: '',
      mode_paiement: 'especes',
      reference_mode: '',
      source_type: 'client',
      id_source: null,
      description: '',
      date_paiement: new Date(),
    });
    setSelectedPaiement(null);
    setPaiementModalVisible(true);
  };

  const handleEditPaiement = (paiement) => {
    setSelectedPaiement(paiement);
    setPaiementForm({
      type_paiement: paiement.type_paiement,
      montant: paiement.montant.toString(),
      mode_paiement: paiement.mode_paiement,
      reference_mode: paiement.reference_mode || '',
      source_type: paiement.source_type,
      id_source: paiement.id_source,
      description: paiement.description || '',
      date_paiement: new Date(paiement.date_paiement),
    });
    setPaiementModalVisible(true);
  };

  const handleDeletePaiement = (paiement) => {
    Alert.alert(
      'Confirmation',
      'Voulez-vous vraiment annuler ce paiement ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;

            try {
              setLoading(true);
              const response = await axios.delete(
                `${API_BASE_URL}/finance/paiements/${paiement.id}`,
                getAxiosConfig()
              );

              if (response.data.success) {
                Alert.alert('Succès', 'Paiement annulé');
                setCurrentPage(1);
                loadPaiements();
              }
            } catch (error) {
              console.error('❌ Erreur suppression paiement:', error);
              Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'annuler le paiement');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ============================================
  // ACTIONS - JOURNAL
  // ============================================
  const handleRapprocherMouvement = async (mouvementId) => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.patch(
        `${API_BASE_URL}/finance/journal-comptable/${mouvementId}/rapprocher`,
        {},
        getAxiosConfig()
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Mouvement rapproché');
        loadJournalComptable();
      }
    } catch (error) {
      console.error('❌ Erreur rapprochement:', error);
      Alert.alert('Erreur', 'Impossible de rapprocher');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatut = async (mouvementId, statut) => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.patch(
        `${API_BASE_URL}/finance/journal-comptable/${mouvementId}/statut`,
        { statut },
        getAxiosConfig()
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Statut mis à jour');
        loadJournalComptable();
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER - DASHBOARD
  // ============================================
  const renderDashboard = () => {
    if (loading && !refreshing && !dashboardData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
        </View>
      );
    }

    if (error && !dashboardData) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={COLORS.danger} />
          <Text style={styles.emptyText}>{error}</Text>
          <Button
            mode="contained"
            onPress={loadDashboard}
            style={{ marginTop: 20 }}
            buttonColor={COLORS.primary}
          >
            Réessayer
          </Button>
        </View>
      );
    }

    if (!dashboardData) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="dashboard" size={64} color={COLORS.subtext} />
          <Text style={styles.emptyText}>Aucune donnée disponible</Text>
          <Button
            mode="contained"
            onPress={loadDashboard}
            style={{ marginTop: 20 }}
            buttonColor={COLORS.primary}
          >
            Charger les données
          </Button>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Cartes Principales */}
        <View style={[
          styles.cardGrid,
          isMobile && styles.mobileCardGrid,
          isTablet && styles.tabletCardGrid,
          isDesktop && styles.desktopCardGrid,
        ]}>
          {[
            {
              icon: 'arrow-downward',
              label: 'CA du Mois',
              color: COLORS.success,
              value: dashboardData?.ventes_mois?.[0]?.chiffre_affaires_mois || 0
            },
            {
              icon: 'shopping-cart',
              label: 'Achats du Mois',
              color: COLORS.danger,
              value: dashboardData?.achats_mois?.[0]?.total_achats_mois || 0
            },
            {
              icon: 'account-balance-wallet',
              label: 'Factures Impayées',
              color: COLORS.warning,
              value: dashboardData?.factures_impayees?.[0]?.montant_impaye || 0
            },
            {
              icon: 'warning',
              label: 'Factures Retard',
              color: COLORS.danger,
              value: dashboardData?.factures_retard?.[0]?.montant_retard || 0
            },
          ].map((item, idx) => (
            <Card key={idx} style={styles.dashboardCard}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: item.color + '20' }]}>
                    <MaterialIcons name={item.icon} size={24} color={item.color} />
                  </View>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                </View>
                <Text style={[styles.cardValue, { color: item.color }]}>
                  {formatMontant(item.value)}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Flux de Trésorerie */}
        {dashboardData?.flux_tresorerie && dashboardData.flux_tresorerie.length > 0 && (
          <Card style={styles.graphCard}>
            <Card.Content>
              <Title style={styles.graphTitle}>Flux de Trésorerie (6 mois)</Title>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={{
                    labels: dashboardData.flux_tresorerie.map(f => {
                      const mois = f.mois.split('-')[1];
                      return mois;
                    }),
                    datasets: [
                      {
                        data: dashboardData.flux_tresorerie.map(f => parseFloat(f.recettes) || 0),
                        color: () => COLORS.success,
                      },
                      {
                        data: dashboardData.flux_tresorerie.map(f => parseFloat(f.depenses) || 0),
                        color: () => COLORS.danger,
                      },
                    ],
                    legend: ['Recettes', 'Dépenses'],
                  }}
                  width={Math.max(SCREEN_WIDTH - 40, 600)}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(46, 134, 193, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    style: {
                      borderRadius: 8
                    },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        {/* Top Clients */}
        {dashboardData?.meilleurs_clients && dashboardData.meilleurs_clients.length > 0 && (
          <Card style={styles.graphCard}>
            <Card.Content>
              <Title style={styles.graphTitle}>Top 5 Clients</Title>
              {dashboardData.meilleurs_clients.map((client, idx) => (
                <View key={idx} style={styles.clientRow}>
                  <View style={styles.clientInfo}>
                    <MaterialIcons name="person" size={20} color={COLORS.primary} />
                    <Text style={styles.clientName}>{client.nom_client}</Text>
                  </View>
                  <View style={styles.clientStats}>
                    <Text style={styles.clientAmount}>{formatMontant(client.total_achats)}</Text>
                    {client.solde_du > 0 && (
                      <Text style={styles.clientDue}>Dû: {formatMontant(client.solde_du)}</Text>
                    )}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Paiements Récents */}
        {dashboardData?.paiements_recents && dashboardData.paiements_recents.length > 0 && (
          <Card style={styles.graphCard}>
            <Card.Content>
              <Title style={styles.graphTitle}>Paiements Récents (7 jours)</Title>
              {dashboardData.paiements_recents.slice(0, 5).map((paiement, idx) => (
                <View key={idx} style={styles.paiementRow}>
                  <View style={styles.paiementInfo}>
                    <View style={[
                      styles.iconBadge,
                      { backgroundColor: paiement.type_paiement === 'recette' ? COLORS.success + '20' : COLORS.danger + '20' }
                    ]}>
                      <MaterialIcons
                        name={paiement.type_paiement === 'recette' ? 'arrow-downward' : 'arrow-upward'}
                        size={16}
                        color={paiement.type_paiement === 'recette' ? COLORS.success : COLORS.danger}
                      />
                    </View>
                    <View>
                      <Text style={styles.paiementSource}>{paiement.source_nom || 'N/A'}</Text>
                      <Text style={styles.paiementDate}>{formatDateCourte(paiement.date_paiement)}</Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.paiementAmount,
                    { color: paiement.type_paiement === 'recette' ? COLORS.success : COLORS.danger }
                  ]}>
                    {paiement.type_paiement === 'recette' ? '+' : '-'}{formatMontant(paiement.montant)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Message si aucune donnée */}
        {(!dashboardData.flux_tresorerie || dashboardData.flux_tresorerie.length === 0) &&
          (!dashboardData.meilleurs_clients || dashboardData.meilleurs_clients.length === 0) &&
          (!dashboardData.paiements_recents || dashboardData.paiements_recents.length === 0) && (
            <Card style={styles.graphCard}>
              <Card.Content>
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="info-outline" size={48} color={COLORS.info} />
                  <Text style={styles.emptyText}>
                    Pas encore de données détaillées pour cette période.
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
      </ScrollView>
    );
  };

  // ============================================
  // RENDER - FACTURES
  // ============================================
  const renderFactures = () => (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <View style={styles.dateButtonsRow}>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('start'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(startDate)}
          </Button>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('end'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(endDate)}
          </Button>
        </View>
        <Searchbar
          placeholder="Rechercher une facture..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des factures...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={factures}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <Card style={styles.listCard}>
                <Card.Content>
                  <View style={styles.factureHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.factureNumero}>{item.numero_facture}</Text>
                      <Text style={styles.factureClient}>
                        {item.nom_client || item.nom_fournisseur || 'N/A'}
                      </Text>
                      <Text style={styles.factureDate}>
                        Échéance: {formatDateCourte(item.date_echeance)}
                      </Text>
                    </View>
                    <View style={styles.factureAmounts}>
                      <Text style={styles.factureMontant}>{formatMontant(item.montant_ttc)}</Text>
                      <Chip
                        style={[
                          styles.factureChip,
                          { backgroundColor: item.statut_paiement === 'payee' ? COLORS.success + '20' : COLORS.warning + '20' }
                        ]}
                        textStyle={{ color: item.statut_paiement === 'payee' ? COLORS.success : COLORS.warning }}
                      >
                        {item.statut_paiement || 'impayée'}
                      </Chip>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="receipt" size={48} color={COLORS.subtext} />
                <Text style={styles.emptyText}>Aucune facture trouvée.</Text>
              </View>
            }
          />

          {/* Pagination */}
          {facturesPagination.pages > 1 && (
            <View style={styles.paginationBar}>
              <Button
                mode="outlined"
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(currentPage - 1)}
                compact
              >
                ← Précédent
              </Button>
              <Text style={styles.paginationText}>
                Page {currentPage} / {facturesPagination.pages}
              </Text>
              <Button
                mode="outlined"
                disabled={currentPage === facturesPagination.pages}
                onPress={() => setCurrentPage(currentPage + 1)}
                compact
              >
                Suivant →
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );

  // ============================================
  // RENDER - PAIEMENTS
  // ============================================
  const renderPaiements = () => (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <View style={styles.dateButtonsRow}>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('start'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(startDate)}
          </Button>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('end'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(endDate)}
          </Button>
        </View>
        <Searchbar
          placeholder="Rechercher un paiement..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des paiements...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={paiements}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <View style={styles.paiementCard}>
                <View style={styles.paiementMainInfo}>
                  <View style={[
                    styles.iconBadge,
                    { backgroundColor: item.type_paiement === 'recette' ? COLORS.success + '20' : COLORS.danger + '20' }
                  ]}>
                    <MaterialIcons
                      name={item.type_paiement === 'recette' ? 'arrow-downward' : 'arrow-upward'}
                      size={20}
                      color={item.type_paiement === 'recette' ? COLORS.success : COLORS.danger}
                    />
                  </View>
                  <View style={styles.paiementDetails}>
                    <Text style={styles.paiementSource}>{item.source_nom || item.source_type || 'N/A'}</Text>
                    <Text style={styles.paiementRef}>{item.reference_paiement || 'Sans réf.'}</Text>
                    <Text style={styles.paiementDate}>{formatDateCourte(item.date_paiement)}</Text>
                  </View>
                </View>
                <View style={styles.paiementActions}>
                  <Text style={[
                    styles.paiementAmount,
                    { color: item.type_paiement === 'recette' ? COLORS.success : COLORS.danger }
                  ]}>
                    {item.type_paiement === 'recette' ? '+' : '-'}{formatMontant(item.montant)}
                  </Text>
                  <View style={styles.paiementButtons}>
                    <IconButton
                      icon="pencil"
                      size={18}
                      iconColor={COLORS.info}
                      onPress={() => handleEditPaiement(item)}
                    />
                    <IconButton
                      icon="delete"
                      size={18}
                      iconColor={COLORS.danger}
                      onPress={() => handleDeletePaiement(item)}
                    />
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="payment" size={48} color={COLORS.subtext} />
                <Text style={styles.emptyText}>Aucun paiement trouvé.</Text>
              </View>
            }
          />

          {/* Pagination */}
          {paiementsPagination.pages > 1 && (
            <View style={styles.paginationBar}>
              <Button
                mode="outlined"
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(currentPage - 1)}
                compact
              >
                ← Précédent
              </Button>
              <Text style={styles.paginationText}>
                Page {currentPage} / {paiementsPagination.pages}
              </Text>
              <Button
                mode="outlined"
                disabled={currentPage === paiementsPagination.pages}
                onPress={() => setCurrentPage(currentPage + 1)}
                compact
              >
                Suivant →
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );

  // ============================================
  // RENDER - JOURNAL COMPTABLE
  // ============================================
  const renderJournalComptable = () => (
    <View style={styles.container}>
      {/* Résumé */}
      <View style={styles.journalSummary}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Entrées</Text>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>
              {formatMontant(journalTotaux.total_entrees)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Sorties</Text>
            <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
              {formatMontant(journalTotaux.total_sorties)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryLabel}>Solde</Text>
            <Text style={[
              styles.summaryValue,
              { color: journalTotaux.solde >= 0 ? COLORS.success : COLORS.danger }
            ]}>
              {formatMontant(journalTotaux.solde)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Filtres */}
      <View style={styles.filterBar}>
        <View style={[styles.filterRow, { flexWrap: 'wrap' }]}>
          <Menu
            visible={menuVisible && menuType === 'categorie'}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => {
                  setMenuType('categorie');
                  setMenuVisible(true);
                }}
                icon="filter-list"
                compact
              >
                Catégories
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setJournalFilters({ ...journalFilters, categorie: 'all' });
                setMenuVisible(false);
                setCurrentPage(1);
              }}
              title="Toutes"
            />
            <Divider />
            {['vente', 'achat', 'salaire', 'production', 'stock', 'maintenance'].map(cat => (
              <Menu.Item
                key={cat}
                onPress={() => {
                  setJournalFilters({ ...journalFilters, categorie: cat });
                  setMenuVisible(false);
                  setCurrentPage(1);
                }}
                title={cat.charAt(0).toUpperCase() + cat.slice(1)}
              />
            ))}
          </Menu>

          <Button
            mode="outlined"
            onPress={handleExportJournalExcel}
            icon="microsoft-excel"
            compact
            style={styles.filterBtn}
            loading={loading}
            disabled={loading}
          >
            Excel
          </Button>
          <Button
            mode="outlined"
            onPress={handleExportJournalPDF}
            icon="file-pdf-box"
            compact
            style={styles.filterBtn}
            loading={loading}
            disabled={loading}
          >
            PDF
          </Button>
        </View>

        <Searchbar
          placeholder="Rechercher..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      {/* Table Journal */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement du journal...</Text>
        </View>
      ) : (
        <>
          <View style={styles.journalTable}>
            {isMobile ? (
              <ScrollView horizontal>
                <View style={{ minWidth: 800 }}>
                  <JournalTableContent />
                </View>
              </ScrollView>
            ) : (
              <JournalTableContent />
            )}
          </View>

          {/* Pagination */}
          {journalPagination.pages > 1 && (
            <View style={styles.paginationBar}>
              <Button
                mode="outlined"
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(currentPage - 1)}
                compact
              >
                ← Précédent
              </Button>
              <Text style={styles.paginationText}>
                Page {currentPage} / {journalPagination.pages}
              </Text>
              <Button
                mode="outlined"
                disabled={currentPage === journalPagination.pages}
                onPress={() => setCurrentPage(currentPage + 1)}
                compact
              >
                Suivant →
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );

  const JournalTableContent = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: 100 }]}>DATE</Text>
        <Text style={[styles.tableHeaderCell, { width: 80 }]}>COMPTE</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>LIBELLÉ</Text>
        <Text style={[styles.tableHeaderCell, { width: 120 }]}>DÉBIT</Text>
        <Text style={[styles.tableHeaderCell, { width: 120 }]}>CRÉDIT</Text>
        <Text style={[styles.tableHeaderCell, { width: 80 }]}>ACTIONS</Text>
      </View>

      <FlatList
        data={journalMouvements}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
        renderItem={({ item, index }) => {
          const isDebit = item.type_mouvement === 'sortie' || item.type_mouvement === 'depense';
          return (
            <View style={[
              styles.tableRow,
              index % 2 === 0 && styles.tableRowAlt,
            ]}>
              <Text style={[styles.tableCell, { width: 100 }]}>
                {formatDateCourte(item.date_operation)}
              </Text>
              <Text style={[styles.tableCell, { width: 80 }]}>
                {item.compte_debit || item.compte_credit || '—'}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={2}>
                {item.libelle || 'N/A'}
              </Text>
              <Text style={[
                styles.tableCell,
                { width: 120, fontWeight: isDebit ? 'bold' : 'normal', color: isDebit ? COLORS.text : COLORS.subtext }
              ]}>
                {isDebit ? formatMontant(item.montant) : '—'}
              </Text>
              <Text style={[
                styles.tableCell,
                { width: 120, fontWeight: !isDebit ? 'bold' : 'normal', color: !isDebit ? COLORS.text : COLORS.subtext }
              ]}>
                {!isDebit ? formatMontant(item.montant) : '—'}
              </Text>
              <View style={[styles.tableCell, { width: 80, flexDirection: 'row' }]}>
                {!item.rapproche && (
                  <IconButton
                    icon="check"
                    size={16}
                    onPress={() => handleRapprocherMouvement(item.id)}
                  />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={48} color={COLORS.subtext} />
            <Text style={styles.emptyText}>Aucune écriture trouvée.</Text>
          </View>
        }
      />
    </>
  );

  // ============================================
  // RENDER - BALANCE COMPTABLE
  // ============================================
  const renderBalanceComptable = () => (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <View style={styles.dateButtonsRow}>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('start'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(startDate)}
          </Button>
          <Button
            mode="outlined"
            onPress={() => { setDatePickerField('end'); setShowDatePicker(true); }}
            style={styles.dateButton}
            icon="calendar-today"
          >
            {formatDateCourte(endDate)}
          </Button>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement de la balance...</Text>
        </View>
      ) : (
        <>
          <Card style={styles.balanceCard}>
            <Card.Content>
              <Title style={styles.balanceTitle}>Balance Comptable</Title>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ width: 150 }}>Compte</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Débit</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Crédit</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Solde</DataTable.Title>
                  </DataTable.Header>

                  {balanceComptable.map((item, index) => (
                    <DataTable.Row key={index}>
                      <DataTable.Cell style={{ width: 150 }}>{item.compte || 'N/A'}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        {formatMontant(item.total_debit)}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        {formatMontant(item.total_credit)}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        <Text style={{ color: item.solde >= 0 ? COLORS.success : COLORS.danger }}>
                          {formatMontant(item.solde)}
                        </Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}

                  {balanceComptable.length === 0 && (
                    <DataTable.Row>
                      <DataTable.Cell style={{ width: 540 }}>
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Aucune donnée disponible</Text>
                        </View>
                      </DataTable.Cell>
                    </DataTable.Row>
                  )}
                </DataTable>
              </ScrollView>
            </Card.Content>
          </Card>

          {/* Pagination Balance */}
          {balancePagination.pages > 1 && (
            <View style={styles.paginationBar}>
              <Button
                mode="outlined"
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(currentPage - 1)}
                compact
              >
                ← Précédent
              </Button>
              <Text style={styles.paginationText}>
                Page {currentPage} / {balancePagination.pages}
              </Text>
              <Button
                mode="outlined"
                disabled={currentPage === balancePagination.pages}
                onPress={() => setCurrentPage(currentPage + 1)}
                compact
              >
                Suivant →
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );

  // ============================================
  // RENDER - GRAND LIVRE
  // ============================================
  const renderGrandLivre = () => (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TextInput
          label="Numéro de compte"
          value={compteGrandLivre}
          onChangeText={setCompteGrandLivre}
          mode="outlined"
          style={styles.compteInput}
        />
        <Button
          mode="contained"
          onPress={() => {
            setCurrentPage(1);
            loadGrandLivre();
          }}
          disabled={!compteGrandLivre || loading}
          loading={loading}
        >
          Rechercher
        </Button>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement du grand livre...</Text>
        </View>
      ) : grandLivre.length > 0 ? (
        <>
          <Card style={styles.grandLivreCard}>
            <Card.Content>
              <Title style={styles.grandLivreTitle}>Grand Livre - Compte {compteGrandLivre}</Title>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ width: 100 }}>Date</DataTable.Title>
                    <DataTable.Title style={{ width: 200 }}>Libellé</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Débit</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Crédit</DataTable.Title>
                    <DataTable.Title numeric style={{ width: 130 }}>Solde</DataTable.Title>
                  </DataTable.Header>

                  {grandLivre.map((item, index) => (
                    <DataTable.Row key={index}>
                      <DataTable.Cell style={{ width: 100 }}>
                        {formatDateCourte(item.date_operation)}
                      </DataTable.Cell>
                      <DataTable.Cell style={{ width: 200 }}>
                        {item.libelle || 'N/A'}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        {formatMontant(item.debit)}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        {formatMontant(item.credit)}
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ width: 130 }}>
                        <Text style={{ color: item.solde_progressif >= 0 ? COLORS.success : COLORS.danger }}>
                          {formatMontant(item.solde_progressif)}
                        </Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </ScrollView>
            </Card.Content>
          </Card>

          {/* Pagination Grand Livre */}
          {grandLivrePagination.pages > 1 && (
            <View style={styles.paginationBar}>
              <Button
                mode="outlined"
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(currentPage - 1)}
                compact
              >
                ← Précédent
              </Button>
              <Text style={styles.paginationText}>
                Page {currentPage} / {grandLivrePagination.pages}
              </Text>
              <Button
                mode="outlined"
                disabled={currentPage === grandLivrePagination.pages}
                onPress={() => setCurrentPage(currentPage + 1)}
                compact
              >
                Suivant →
              </Button>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="library-books" size={48} color={COLORS.subtext} />
          <Text style={styles.emptyText}>
            {compteGrandLivre
              ? 'Aucune écriture trouvée pour ce compte.'
              : 'Entrez un numéro de compte et recherchez.'}
          </Text>
        </View>
      )}
    </View>
  );

  // ============================================
  // RENDER - RAPPORTS
  // ============================================
  const renderRapports = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.rapportsContainer}>
      <Card style={styles.configCard}>
        <Card.Content>
          <Title style={styles.configTitle}>Configuration du Rapport</Title>

          <Text style={styles.selectLabel}>Type de Rapport</Text>
          <SegmentedButtons
            value={rapportType}
            onValueChange={(value) => {
              setRapportType(value);
              setCurrentPage(1);
            }}
            buttons={[
              { value: 'synthese', label: 'Synthèse' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'productivite', label: 'Productivité' },
            ]}
            style={styles.segmentedBtn}
          />

          {rapportType !== 'synthese' && (
            <View style={styles.departementSelector}>
              <Text style={styles.selectLabel}>Département</Text>
              <Menu
                visible={menuVisible && menuType === 'departement'}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setMenuType('departement');
                      setMenuVisible(true);
                    }}
                  >
                    {selectedDepartement === 'all'
                      ? 'Tous les départements'
                      : departements.find(d => d.id === selectedDepartement)?.nom || 'Sélectionner'}
                  </Button>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setSelectedDepartement('all');
                    setMenuVisible(false);
                    setCurrentPage(1);
                  }}
                  title="Tous"
                />
                <Divider />
                {departements.map(d => (
                  <Menu.Item
                    key={d.id}
                    onPress={() => {
                      setSelectedDepartement(d.id);
                      setMenuVisible(false);
                      setCurrentPage(1);
                    }}
                    title={d.nom}
                  />
                ))}
              </Menu>
            </View>
          )}

          <Text style={styles.selectLabel}>Période</Text>
          <SegmentedButtons
            value={selectedPeriode}
            onValueChange={(value) => {
              setSelectedPeriode(value);
              setCurrentPage(1);
            }}
            buttons={[
              { value: 'week', label: 'Semaine' },
              { value: 'month', label: 'Mois' },
              { value: 'year', label: 'Année' },
            ]}
            style={styles.segmentedBtn}
          />

          <View style={styles.exportButtons}>
            <Button
              mode="contained"
              onPress={() => handleExportRapport('pdf')}
              style={styles.exportButton}
              buttonColor={COLORS.danger}
              icon="file-pdf-box"
              loading={loading}
              disabled={loading}
            >
              PDF
            </Button>
            <Button
              mode="contained"
              onPress={() => handleExportRapport('excel')}
              style={styles.exportButton}
              buttonColor={COLORS.success}
              icon="microsoft-excel"
              loading={loading}
              disabled={loading}
            >
              Excel
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Données du Rapport */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Génération du rapport...</Text>
        </View>
      ) : rapportData && rapportData.rapport ? (
        <View style={styles.rapportData}>
          <Card style={styles.rapportCard}>
            <Card.Content>
              <Title>Résumé Financier</Title>
              <View style={styles.rapportResume}>
                <View style={styles.rapportItem}>
                  <Text style={styles.rapportLabel}>Total Recettes</Text>
                  <Text style={[styles.rapportValue, { color: COLORS.success }]}>
                    {formatMontant(rapportData.rapport.total_recettes)}
                  </Text>
                </View>
                <View style={styles.rapportItem}>
                  <Text style={styles.rapportLabel}>Total Dépenses</Text>
                  <Text style={[styles.rapportValue, { color: COLORS.danger }]}>
                    {formatMontant(rapportData.rapport.total_depenses)}
                  </Text>
                </View>
                <View style={styles.rapportItem}>
                  <Text style={styles.rapportLabel}>Résultat Net</Text>
                  <Text style={[
                    styles.rapportValue,
                    { color: rapportData.rapport.resultat_net >= 0 ? COLORS.success : COLORS.danger }
                  ]}>
                    {formatMontant(rapportData.rapport.resultat_net)}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Détails par type de rapport */}
          {rapportType === 'commercial' && rapportData.details?.ventes && rapportData.details.ventes.length > 0 && (
            <Card style={styles.rapportCard}>
              <Card.Content>
                <Title>Détail Commercial</Title>
                <Text style={styles.sectionTitle}>Ventes</Text>
                {rapportData.details.ventes.map((vente, idx) => (
                  <View key={idx} style={styles.detailRow}>
                    <Text style={{ flex: 1 }}>{vente.statut || 'N/A'}</Text>
                    <Text style={{ width: 100 }}>{vente.nombre || 0} commandes</Text>
                    <Text style={{ width: 130, textAlign: 'right' }}>
                      {formatMontant(vente.montant_total)}
                    </Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {rapportType === 'productivite' && rapportData.details?.production && rapportData.details.production.length > 0 && (
            <Card style={styles.rapportCard}>
              <Card.Content>
                <Title>Détail Production</Title>
                {rapportData.details.production.map((prod, idx) => (
                  <View key={idx} style={styles.productionItem}>
                    <Text style={styles.productionDept}>{prod.departement || 'N/A'}</Text>
                    <View style={styles.productionStats}>
                      {prod.production_agricole > 0 && (
                        <Text>Agriculture: {prod.production_agricole} kg</Text>
                      )}
                      {prod.production_lait > 0 && (
                        <Text>Lait: {prod.production_lait} L</Text>
                      )}
                      {prod.production_oeufs > 0 && (
                        <Text>Œufs: {prod.production_oeufs}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="assessment" size={48} color={COLORS.subtext} />
          <Text style={styles.emptyText}>
            Aucune donnée de rapport disponible pour cette période.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  /**
 * MODALE FACTURE COMPLÈTE
 */
const renderFactureModal = () => (
  <Portal>
    <Modal
      visible={factureModalVisible}
      onDismiss={() => {
        setFactureModalVisible(false);
        setSelectedFacture(null);
      }}
      contentContainerStyle={styles.modal}
    >
      <ScrollView>
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Nouvelle Facture</Text>
          <IconButton
            icon="close"
            size={20}
            onPress={() => {
              setFactureModalVisible(false);
              setSelectedFacture(null);
            }}
          />
        </View>

        {/* FORM CONTENT */}
        <View style={styles.modalForm}>
          
          {/* TYPE DE FACTURE */}
          <Text style={styles.selectLabel}>Type de Facture</Text>
          <SegmentedButtons
            value={factureForm.type_facture}
            onValueChange={(value) => {
              setFactureForm({
                ...factureForm,
                type_facture: value,
              });
              loadTiersList(value);
            }}
            buttons={[
              { value: 'vente', label: 'Vente (Client)' },
              { value: 'achat', label: 'Achat (Fournisseur)' },
            ]}
            style={styles.segmentedBtn}
          />

          {/* SÉLECTION CLIENT/FOURNISSEUR */}
          <Text style={styles.selectLabel}>
            {factureForm.type_facture === 'vente' ? 'Sélectionner Client' : 'Sélectionner Fournisseur'}
          </Text>
          <Menu
            visible={menuVisible && menuType === 'tiers'}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => {
                  setMenuType('tiers');
                  setMenuVisible(true);
                  loadTiersList(factureForm.type_facture);
                }}
                icon="account-multiple"
                contentStyle={{ justifyContent: 'flex-start' }}
              >
                {factureForm.client_nom
                  ? `${factureForm.client_nom}`
                  : 'Sélectionner...'}
              </Button>
            }
          >
            {tiersList && tiersList.length > 0 ? (
              tiersList.map((tiers) => (
                <Menu.Item
                  key={tiers.id}
                  onPress={() => {
                    setFactureForm({
                      ...factureForm,
                      [factureForm.type_facture === 'vente' ? 'id_client' : 'id_fournisseur']: tiers.id,
                      client_nom: tiers.nom_client || tiers.nom_fournisseur || tiers.nom,
                      client_adresse: tiers.adresse || '',
                      client_email: tiers.email || '',
                      client_telephone: tiers.telephone || '',
                    });
                    setMenuVisible(false);
                  }}
                  title={`${tiers.nom_client || tiers.nom_fournisseur || tiers.nom}`}
                  description={`${tiers.adresse || 'N/A'}`}
                />
              ))
            ) : (
              <Menu.Item
                onPress={() => setMenuVisible(false)}
                title="Aucun tiers disponible"
                disabled
              />
            )}
          </Menu>

          {/* AFFICHAGE INFOS TIERS SÉLECTIONNÉ */}
          {factureForm.client_nom && (
            <Card style={styles.tierInfoCard}>
              <Card.Content>
                <View style={styles.tierHeader}>
                  <MaterialIcons 
                    name={factureForm.type_facture === 'vente' ? 'person' : 'business'} 
                    size={24} 
                    color={COLORS.success} 
                  />
                  <Text style={styles.tierName}>{factureForm.client_nom}</Text>
                </View>
                
                {factureForm.client_adresse && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.subtext} />
                    <Text style={styles.tierInfo}>{factureForm.client_adresse}</Text>
                  </View>
                )}
                
                {factureForm.client_email && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="email" size={16} color={COLORS.subtext} />
                    <Text style={styles.tierInfo}>{factureForm.client_email}</Text>
                  </View>
                )}
                
                {factureForm.client_telephone && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="phone" size={16} color={COLORS.subtext} />
                    <Text style={styles.tierInfo}>{factureForm.client_telephone}</Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* MONTANTS */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Montants</Text>
          
          <TextInput
            label="Montant HT (BIF)"
            value={factureForm.montant_ht}
            onChangeText={(text) => {
              setFactureForm({ ...factureForm, montant_ht: text });
              const ht = parseFloat(text) || 0;
              const tva = parseFloat(factureForm.montant_tva) || 0;
              setFactureForm((prev) => ({
                ...prev,
                montant_ttc: (ht + tva).toString(),
              }));
            }}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="currency-bif" />}
          />

          <TextInput
            label="Montant TVA (BIF)"
            value={factureForm.montant_tva}
            onChangeText={(text) => {
              setFactureForm({ ...factureForm, montant_tva: text });
              const ht = parseFloat(factureForm.montant_ht) || 0;
              const tva = parseFloat(text) || 0;
              setFactureForm((prev) => ({
                ...prev,
                montant_ttc: (ht + tva).toString(),
              }));
            }}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="percent" />}
          />

          <TextInput
            label="Montant TTC (BIF)"
            value={factureForm.montant_ttc}
            editable={false}
            mode="outlined"
            style={[styles.input, styles.inputDisabled]}
            left={<TextInput.Icon icon="check-circle" color={COLORS.success} />}
          />

          {/* MODE DE PAIEMENT */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Mode de Paiement</Text>
          <SegmentedButtons
            value={factureForm.mode_reglement}
            onValueChange={(value) =>
              setFactureForm({ ...factureForm, mode_reglement: value })
            }
            buttons={[
              { value: 'especes', label: 'Espèces' },
              { value: 'virement', label: 'Virement' },
              { value: 'cheque', label: 'Chèque' },
            ]}
            style={styles.segmentedBtn}
          />

          {/* DATE D'ÉCHÉANCE */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Date d'Échéance</Text>
          <Button
            mode="outlined"
            onPress={() => {
              setDatePickerField('facture_echeance');
              setShowDatePicker(true);
            }}
            icon="calendar-today"
            style={styles.dateButton}
          >
            {formatDateLongue(factureForm.date_echeance)}
          </Button>

          {/* DESCRIPTION */}
          <TextInput
            label="Description (optionnel)"
            value={factureForm.description || ''}
            onChangeText={(text) =>
              setFactureForm({ ...factureForm, description: text })
            }
            multiline
            numberOfLines={2}
            mode="outlined"
            style={styles.input}
          />

          {/* ACTIONS */}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={handleCreateFacture}
              buttonColor={COLORS.success}
              loading={loading}
              disabled={loading || !factureForm.client_nom || !factureForm.montant_ttc}
              style={styles.modalBtn}
              icon="check"
            >
              Créer Facture
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setFactureModalVisible(false);
                setSelectedFacture(null);
              }}
              disabled={loading}
              style={styles.modalBtn}
              icon="close"
            >
              Annuler
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  </Portal>
);

/**
 * MODALE PAIEMENT COMPLÈTE
 */
const renderPaiementModal = () => (
  <Portal>
    <Modal
      visible={paiementModalVisible}
      onDismiss={() => {
        setPaiementModalVisible(false);
        setSelectedPaiement(null);
      }}
      contentContainerStyle={styles.modal}
    >
      <ScrollView>
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedPaiement ? 'Modifier Paiement' : 'Nouveau Paiement'}
          </Text>
          <IconButton
            icon="close"
            size={20}
            onPress={() => {
              setPaiementModalVisible(false);
              setSelectedPaiement(null);
            }}
          />
        </View>

        {/* FORM CONTENT */}
        <View style={styles.modalForm}>
          
          {/* TYPE DE PAIEMENT */}
          <Text style={styles.selectLabel}>Type de Paiement</Text>
          <SegmentedButtons
            value={paiementForm.type_paiement}
            onValueChange={(value) =>
              setPaiementForm({ ...paiementForm, type_paiement: value })
            }
            buttons={[
              { value: 'recette', label: 'Recette (Reçu)' },
              { value: 'depense', label: 'Dépense (Payé)' },
            ]}
            style={styles.segmentedBtn}
          />

          {/* TYPE DE SOURCE */}
          <Text style={styles.selectLabel}>Source du Paiement</Text>
          <SegmentedButtons
            value={paiementForm.source_type}
            onValueChange={(value) => {
              setPaiementForm({
                ...paiementForm,
                source_type: value,
                id_source: null,
                source_nom: '',
              });
              loadSourceList(value);
            }}
            buttons={[
              { value: 'client', label: 'Client' },
              { value: 'fournisseur', label: 'Fournisseur' },
              { value: 'employe', label: 'Employé' },
              { value: 'autre', label: 'Autre' },
            ]}
            style={styles.segmentedBtn}
          />

          {/* SÉLECTION SOURCE SPÉCIFIQUE */}
          <Text style={styles.selectLabel}>
            Sélectionner {paiementForm.source_type.charAt(0).toUpperCase() + paiementForm.source_type.slice(1)}
          </Text>
          <Menu
            visible={menuVisible && menuType === 'source'}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => {
                  setMenuType('source');
                  setMenuVisible(true);
                  loadSourceList(paiementForm.source_type);
                }}
                icon="account"
                contentStyle={{ justifyContent: 'flex-start' }}
              >
                {paiementForm.source_nom || 'Sélectionner...'}
              </Button>
            }
          >
            {sourcesList && sourcesList.length > 0 ? (
              sourcesList.map((source) => (
                <Menu.Item
                  key={source.id}
                  onPress={() => {
                    setPaiementForm({
                      ...paiementForm,
                      id_source: source.id,
                      source_nom: source.nom_client || source.nom_fournisseur || source.nom,
                      source_adresse: source.adresse || '',
                      source_email: source.email || '',
                      source_telephone: source.telephone || '',
                      source_solde_due: source.solde_du || source.solde_actuel || 0,
                    });
                    setMenuVisible(false);
                    if (paiementForm.source_type === 'client') {
                      loadFacturesList(source.id);
                    }
                  }}
                  title={source.nom_client || source.nom_fournisseur || source.nom}
                  description={
                    (source.solde_du || source.solde_actuel) > 0
                      ? `Dû: ${formatMontant(source.solde_du || source.solde_actuel)}`
                      : 'Pas de dette'
                  }
                />
              ))
            ) : (
              <Menu.Item
                onPress={() => setMenuVisible(false)}
                title="Aucune source disponible"
                disabled
              />
            )}
          </Menu>

          {/* AFFICHAGE INFOS SOURCE */}
          {paiementForm.source_nom && (
            <Card style={styles.sourceInfoCard}>
              <Card.Content>
                <View style={styles.tierHeader}>
                  <MaterialIcons 
                    name={paiementForm.source_type === 'client' ? 'person' : 'business'} 
                    size={24} 
                    color={COLORS.info} 
                  />
                  <Text style={styles.sourceName}>{paiementForm.source_nom}</Text>
                </View>
                
                {paiementForm.source_adresse && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.subtext} />
                    <Text style={styles.sourceInfo}>{paiementForm.source_adresse}</Text>
                  </View>
                )}
                
                {paiementForm.source_email && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="email" size={16} color={COLORS.subtext} />
                    <Text style={styles.sourceInfo}>{paiementForm.source_email}</Text>
                  </View>
                )}
                
                {paiementForm.source_telephone && (
                  <View style={styles.tierInfoRow}>
                    <MaterialIcons name="phone" size={16} color={COLORS.subtext} />
                    <Text style={styles.sourceInfo}>{paiementForm.source_telephone}</Text>
                  </View>
                )}

                {paiementForm.source_type === 'client' && paiementForm.source_solde_due > 0 && (
                  <View style={styles.soldeDu}>
                    <Text style={styles.soldeDuLabel}>Solde dû:</Text>
                    <Text style={[styles.soldeDuAmount, { color: COLORS.danger }]}>
                      {formatMontant(paiementForm.source_solde_due)}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* SÉLECTION FACTURE ASSOCIÉE (OPTIONNEL - CLIENTS SEULEMENT) */}
          {paiementForm.source_type === 'client' && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.selectLabel}>Facture Associée (Optionnel)</Text>
              <Menu
                visible={menuVisible && menuType === 'facture'}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setMenuType('facture');
                      setMenuVisible(true);
                      loadFacturesList(paiementForm.id_source);
                    }}
                    icon="receipt"
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {paiementForm.facture_numero || 'Sélectionner facture...'}
                  </Button>
                }
              >
                {facturesList && facturesList.length > 0 ? (
                  facturesList.map((facture) => (
                    <Menu.Item
                      key={facture.id}
                      onPress={() => {
                        setPaiementForm({
                          ...paiementForm,
                          id_facture: facture.id,
                          facture_numero: facture.numero_facture,
                          facture_montant_due: facture.montant_du || facture.montant_ttc,
                        });
                        setMenuVisible(false);
                      }}
                      title={facture.numero_facture}
                      description={`Dû: ${formatMontant(facture.montant_du || facture.montant_ttc)}`}
                    />
                  ))
                ) : (
                  <Menu.Item
                    onPress={() => setMenuVisible(false)}
                    title="Aucune facture à payer"
                    disabled
                  />
                )}
              </Menu>
            </>
          )}

          {/* MONTANT */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Montant (BIF)</Text>
          <TextInput
            label="Montant"
            value={paiementForm.montant}
            onChangeText={(text) =>
              setPaiementForm({ ...paiementForm, montant: text })
            }
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="currency-bif" />}
          />

          {/* AFFICHAGE MONTANT DÛ ET RESTANT */}
          {paiementForm.facture_montant_due > 0 && (
            <Card style={styles.montantInfo}>
              <Card.Content>
                <View style={styles.montantRow}>
                  <Text style={styles.montantLabel}>Montant dû:</Text>
                  <Text style={styles.montantValue}>
                    {formatMontant(paiementForm.facture_montant_due)}
                  </Text>
                </View>
                
                {paiementForm.montant && (
                  <View style={[styles.montantRow, { marginTop: 8 }]}>
                    <Text style={styles.montantLabel}>Montant payé:</Text>
                    <Text style={styles.montantValue}>
                      {formatMontant(parseFloat(paiementForm.montant) || 0)}
                    </Text>
                  </View>
                )}

                {paiementForm.montant && (
                  <View style={[styles.montantRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                    <Text style={styles.montantLabel}>Restant:</Text>
                    <Text
                      style={[
                        styles.montantValue,
                        {
                          color:
                            parseFloat(paiementForm.montant) >= paiementForm.facture_montant_due
                              ? COLORS.success
                              : COLORS.warning,
                        },
                      ]}
                    >
                      {formatMontant(
                        Math.max(0, paiementForm.facture_montant_due - parseFloat(paiementForm.montant || 0))
                      )}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* MODE DE PAIEMENT */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Mode de Paiement</Text>
          <SegmentedButtons
            value={paiementForm.mode_paiement}
            onValueChange={(value) =>
              setPaiementForm({ ...paiementForm, mode_paiement: value })
            }
            buttons={[
              { value: 'especes', label: 'Espèces' },
              { value: 'virement', label: 'Virement' },
              { value: 'cheque', label: 'Chèque' },
              { value: 'mobilebank', label: 'Mobile Money' },
            ]}
            style={styles.segmentedBtn}
          />

          {/* DÉTAILS CONDITIONNELS DU MODE */}
          {paiementForm.mode_paiement === 'cheque' && (
            <TextInput
              label="Numéro de chèque"
              value={paiementForm.reference_mode}
              onChangeText={(text) =>
                setPaiementForm({ ...paiementForm, reference_mode: text })
              }
              mode="outlined"
              style={styles.input}
            />
          )}

          {paiementForm.mode_paiement === 'virement' && (
            <>
              <TextInput
                label="Banque"
                value={paiementForm.banque || ''}
                onChangeText={(text) =>
                  setPaiementForm({ ...paiementForm, banque: text })
                }
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Numéro de virement"
                value={paiementForm.numero_virement || ''}
                onChangeText={(text) =>
                  setPaiementForm({ ...paiementForm, numero_virement: text })
                }
                mode="outlined"
                style={styles.input}
              />
            </>
          )}

          {/*DATE */}
          <Divider style={styles.divider} />
          <Text style={styles.selectLabel}>Date du Paiement</Text>
          <Button
            mode="outlined"
            onPress={() => {
              setDatePickerField('paiement_date');
              setShowDatePicker(true);
            }}
            icon="calendar-today"
            style={styles.dateButton}
          >
            {formatDateLongue(paiementForm.date_paiement)}
          </Button>

          {/* DESCRIPTION */}
          <TextInput
            label="Description/Observations"
            value={paiementForm.description}
            onChangeText={(text) =>
              setPaiementForm({ ...paiementForm, description: text })
            }
            multiline
            numberOfLines={2}
            mode="outlined"
            style={styles.input}
          />

          {/* ACTIONS */}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={handleSavePaiement}
              buttonColor={COLORS.success}
              loading={loading}
              disabled={loading || !paiementForm.source_nom || !paiementForm.montant}
              style={styles.modalBtn}
              icon="check"
            >
              {selectedPaiement ? 'Modifier' : 'Enregistrer'} Paiement
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setPaiementModalVisible(false);
                setSelectedPaiement(null);
              }}
              disabled={loading}
              style={styles.modalBtn}
              icon="close"
            >
              Annuler
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  </Portal>
);

  // ============================================
  // RENDER MAIN - ✅ CORRIGÉ
  // ============================================
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'factures':
        return renderFactures();
      case 'paiements':
        return renderPaiements();
      case 'journal':
        return renderJournalComptable();
      case 'balance':
        return renderBalanceComptable();
      case 'grand-livre':
        return renderGrandLivre();
      case 'rapports':
        return renderRapports();
      default:
        return (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="help-outline" size={64} color={COLORS.subtext} />
            <Text style={styles.emptyText}>Sélectionnez un onglet</Text>
          </View>
        );
    }
  };

  // ============================================
  // RENDER PRINCIPAL - ✅ AVEC GESTION TOKEN
  // ============================================
  if (authLoading || tokenLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {authLoading ? 'Vérification des permissions...' : 'Chargement de la session...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Affichage d'erreur si pas de token
  if (!token && error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={80} color={COLORS.danger} />
          <Text style={[styles.emptyText, { fontSize: 18, marginTop: 20 }]}>
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={loadToken}
            style={{ marginTop: 20 }}
            buttonColor={COLORS.primary}
          >
            Réessayer
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.replace('Login')}
            style={{ marginTop: 12 }}
          >
            Se reconnecter
          </Button>
        </View>
      </SafeAreaView>
    );
  }
return (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

   {/* Header - VERSION CORRIGÉE */}
<View style={[
  styles.headerBar,
  isMobile && styles.headerBarMobile,
]}>
  <View style={styles.headerInfo}>
    <Text style={styles.headerTitle}>Finance & Comptabilité</Text>
    <Text style={styles.headerSubtitle}>Gestion financière complète</Text>
  </View>

  {/* Navigation Tabs - VERSION COMPACTE */}
  <View style={styles.headerActions}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContainer}
      scrollEnabled={true}
      nestedScrollEnabled={true}
    >
      {[
        { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
        { id: 'factures', label: 'Factures', icon: 'receipt' },
        { id: 'paiements', label: 'Paiements', icon: 'payment' },
        { id: 'journal', label: 'Journal', icon: 'book' },
        { id: 'balance', label: 'Balance', icon: 'account-balance' },
        { id: 'grand-livre', label: 'Grand Livre', icon: 'library-books' },
        { id: 'rapports', label: 'Rapports', icon: 'assessment' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabItem,
            activeTab === tab.id && styles.activeTabItem,
          ]}
          onPress={() => {
            setActiveTab(tab.id);
            setCurrentPage(1);
          }}
        >
          <MaterialIcons
            name={tab.icon}
            size={18}
            color={activeTab === tab.id ? '#FFFFFF' : '#64748B'}
          />
          {!isMobile && (
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.activeTabLabel,
            ]}>
              {tab.label}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>

    <IconButton
      icon="refresh"
      size={20}
      iconColor={COLORS.primary}
      onPress={onRefresh}
      disabled={loading || refreshing}
      style={styles.refreshBtn}
    />
  </View>
</View>

    {renderContent()}

    {/* FAB pour ajouts rapides */}
    {(activeTab === 'paiements' || activeTab === 'factures') && (
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={activeTab === 'paiements' ? handleAddPaiement : handleAddFacture}
        color="#FFFFFF"
      />
    )}

    {/* ✅ NOUVELLES MODALES COMPLÈTES */}
    {renderFactureModal()}
    {renderPaiementModal()}

    {/* Date Picker */}
    {showDatePicker && (
      <DateTimePicker
        value={
          datePickerField === 'start' 
            ? startDate 
            : datePickerField === 'end' 
            ? endDate 
            : datePickerField === 'facture_echeance'
            ? factureForm.date_echeance
            : datePickerField === 'paiement_date'
            ? paiementForm.date_paiement
            : new Date()
        }
        mode="date"
        display="default"
        onChange={(event, date) => {
          setShowDatePicker(false);
          if (date) {
            // Gestion des différents types de dates
            switch (datePickerField) {
              case 'start':
                setStartDate(date);
                setCurrentPage(1);
                break;
              
              case 'end':
                setEndDate(date);
                setCurrentPage(1);
                break;
              
              case 'facture_echeance':
                setFactureForm({ 
                  ...factureForm, 
                  date_echeance: date 
                });
                break;
              
              case 'paiement_date':
                setPaiementForm({ 
                  ...paiementForm, 
                  date_paiement: date 
                });
                break;
              
              default:
                console.warn('Type de date non reconnu:', datePickerField);
                break;
            }
          }
        }}
        minimumDate={
          datePickerField === 'end' 
            ? startDate 
            : undefined
        }
        maximumDate={
          datePickerField === 'start' 
            ? endDate 
            : undefined
        }
      />
    )}
  </SafeAreaView>
);

};

// ============================================
// STYLES COMPLETS
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.subtext,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.subtext,
    marginTop: 10,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginVertical: 40,
  },
 headerBar: {
  flexDirection: 'row',
  alignItems: 'flex-start', // IMPORTANT: change de 'center' à 'flex-start'
  justifyContent: 'space-between',
  padding: 16,
  paddingTop: Platform.OS === 'ios' ? 0 : 16,
  backgroundColor: COLORS.card,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
  minHeight: 70, // IMPORTANT: limite la hauteur minimum
  maxHeight: 120, // IMPORTANT: limite la hauteur maximum
  ...(Platform.OS === 'web' && { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }),
  elevation: 2,
},

headerBarMobile: {
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  minHeight: 'auto',
  maxHeight: 'auto',
},

headerInfo: {
  flex: 0,
  minWidth: '25%',
},

headerTitle: {
  fontSize: isDesktop ? 20 : isMobile ? 16 : 18,
  fontWeight: '700',
  color: COLORS.text,
  letterSpacing: -0.5,
},

headerSubtitle: {
  fontSize: 11,
  color: COLORS.subtext,
  marginTop: 2,
},

headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  width: '100%',
  marginTop: isMobile ? 8 : 0,
  marginLeft: isMobile ? 0 : 16,
  gap: 0,
  minHeight: 44, // IMPORTANT: hauteur minimale pour les boutons
},

// TABS - VERSION COMPACTE
tabsContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 8,
  gap: 2,
  flexGrow: 0,
},

tabItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 18,
  marginRight: 2,
  backgroundColor: 'transparent',
  minHeight: 36,
  minWidth: 36,
},

activeTabItem: {
  backgroundColor: COLORS.primary,
  elevation: 2,
  paddingHorizontal: 12,
},

tabLabel: {
  marginLeft: 4,
  fontSize: isMobile ? 10 : 11,
  color: '#64748B',
  fontWeight: '500',
},

activeTabLabel: {
  color: '#FFFFFF',
  fontWeight: '600',
},

refreshBtn: {
  margin: 0,
  padding: 4,
  minHeight: 40,
  minWidth: 40,
},
  // CARDS & GRIDS
  scrollView: {
    flex: 1,
  },
  cardGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mobileCardGrid: {
    justifyContent: 'space-between',
  },
  tabletCardGrid: {
    gap: 16,
  },
  desktopCardGrid: {
    gap: 20,
  },
  dashboardCard: {
    flex: isMobile ? 0 : 1,
    minWidth: isMobile ? '48%' : isTablet ? '32%' : isDesktop ? '23%' : '100%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 0,
    ...(Platform.OS === 'web' && { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }),
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  // GRAPHIQUES
  graphCard: {
    margin: 16,
    marginVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    elevation: 2,
    ...(Platform.OS === 'web' && { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }),
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  chart: {
    borderRadius: 8,
    marginVertical: 8,
  },
  // CLIENT ROWS
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  clientStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  clientAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  clientDue: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '500',
  },
  // PAIEMENT ROWS
  paiementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  paiementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paiementSource: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  paiementDate: {
    fontSize: 11,
    color: COLORS.subtext,
    marginTop: 2,
  },
  paiementAmount: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'right',
  },
  // FILTER BAR
  filterBar: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  dateButton: {
    flex: isMobile ? 1 : 0.5,
    borderColor: COLORS.border,
  },
  searchbar: {
    backgroundColor: COLORS.background,
    elevation: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: {
    marginRight: 0,
  },
  // LISTS
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  listCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    overflow: 'hidden',
  },
  factureHeader: {
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    gap: 12,
  },
  factureNumero: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  factureClient: {
    fontSize: 14,
    color: COLORS.subtext,
    marginTop: 4,
  },
  factureDate: {
    fontSize: 12,
    color: COLORS.subtext,
    marginTop: 2,
  },
  factureAmounts: {
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    gap: 8,
  },
  factureMontant: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  factureChip: {
    height: 28,
    alignSelf: 'flex-start',
  },
  // PAIEMENT CARD
  paiementCard: {
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    overflow: 'hidden',
  },
  paiementMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paiementDetails: {
    flex: 1,
    gap: 2,
  },
  paiementRef: {
    fontSize: 12,
    color: COLORS.subtext,
    marginTop: 2,
  },
  paiementActions: {
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    marginTop: isMobile ? 12 : 0,
    flexDirection: isMobile ? 'column' : 'row',
    width: isMobile ? '100%' : 'auto',
    gap: 8,
  },
  paiementButtons: {
    flexDirection: 'row',
    gap: 0,
  },
  // PAGINATION
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  paginationText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  // JOURNAL SUMMARY
  journalSummary: {
    flexDirection: isMobile ? 'column' : 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
    elevation: 1,
    overflow: 'hidden',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.subtext,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  // TABLE
  journalTable: {
    flex: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tableHeaderCell: {
    fontWeight: '700',
    color: '#64748B',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: COLORS.light,
  },
  tableCell: {
    fontSize: 13,
    color: COLORS.text,
  },
  // BALANCE & GRAND LIVRE
  balanceCard: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    overflow: 'hidden',
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: COLORS.text,
  },
  grandLivreCard: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    overflow: 'hidden',
  },
  grandLivreTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: COLORS.text,
  },
  compteInput: {
    flex: 1,
    marginRight: 12,
    backgroundColor: COLORS.card,
  },
  // RAPPORTS
  rapportsContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  configCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    overflow: 'hidden',
  },
  configTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: COLORS.text,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentedBtn: {
    marginBottom: 16,
  },
  departementSelector: {
    marginBottom: 16,
  },
  exportButtons: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: 12,
    marginTop: 16,
  },
  exportButton: {
    flex: 1,
    borderRadius: 8,
  },
  rapportData: {
    gap: 16,
  },
  rapportCard: {
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    overflow: 'hidden',
  },
  rapportResume: {
    gap: 0,
    marginTop: 12,
  },
  rapportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rapportLabel: {
    fontSize: 14,
    color: COLORS.subtext,
  },
  rapportValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    color: COLORS.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  productionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.light,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  productionDept: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: COLORS.text,
  },
  productionStats: {
    gap: 6,
  },
  // FAB
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
  },
  // MODAL
  modal: {
    backgroundColor: COLORS.card,
    margin: isMobile ? 12 : 40,
    borderRadius: 16,
    maxHeight: '90%',
    elevation: 5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalForm: {
    padding: 20,
    gap: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: COLORS.light,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    borderRadius: 8,
    minHeight: 44,
    flex: isMobile ? 1 : 0.4,
  },
  divider: {
    marginVertical: 16,
    height: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  tierInfoCard: {
    marginVertical: 12,
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    elevation: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  tierInfo: {
    fontSize: 13,
    color: COLORS.subtext,
    flex: 1,
  },
  sourceInfoCard: {
    marginVertical: 12,
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
    elevation: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  sourceInfo: {
    fontSize: 13,
    color: COLORS.subtext,
    flex: 1,
  },
  soldeDu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  soldeDuLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  soldeDuAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  montantInfo: {
    marginVertical: 12,
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    elevation: 1,
  },
  montantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  montantLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  montantValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
  },
});

export default FinanceComptabiliteScreen;