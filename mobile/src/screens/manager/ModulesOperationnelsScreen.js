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
    ? 'http://localhost:5000/api'
    : 'http://localhost:5000/api'
  : 'https://localhost:5000/api';

// Créer une instance axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
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
  const [departmentType, setDepartmentType] = useState(null);
  const [departmentInfo, setDepartmentInfo] = useState(null);
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
  const [filter, setFilter] = useState('all');
  const [menuVisible, setMenuVisible] = useState(false);
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

  // Statistics
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    alerts: 0,
    value: 0
  });

  // ==================== API CALLS ====================
// Remplacer la fonction loadDepartmentInfo (ligne ~135) par :

const loadDepartmentInfo = async () => {
  try {
    setLoading(true); // ✅ Ajout de setLoading(true)
    const response = await api.get('/manager/department-info');
    const info = response.data;
    setDepartmentInfo(info);
    setDepartmentType(info.type);
    
    // Set default section based on department
    const defaultSections = {
      finance: 'finance',
      agriculture: 'parcelles',
      elevage: 'cheptel',
      flotte: 'vehicules',
      commercial: 'commandes'
    };
    setActiveSection(defaultSections[info.type] || 'overview');
  } catch (error) {
    console.error('Error loading department info:', error);
    Alert.alert('Erreur', error.response?.data?.error || 'Impossible de charger les informations du département');
    
    if (error.response?.status === 401) {
      navigation.replace('Login');
    }
  } finally {
    setLoading(false); // ✅ Ajout de setLoading(false)
  }
};

  const loadAgricultureData = async () => {
    try {
      switch(activeSection) {
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
      switch(activeSection) {
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
      switch(activeSection) {
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
      switch(activeSection) {
        case 'commandes':
          const commandesRes = await api.get('/manager/commandes-department');
          setCommandes(commandesRes.data);
          setData(commandesRes.data);
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

  const loadOverviewData = async (type) => {
    try {
      switch(type) {
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
    
    switch(departmentType) {
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
      
      switch(sortBy) {
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

    switch(departmentType) {
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
          { id: 'stocks', label: 'Stocks', icon: 'inventory' }
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
            <Text style={styles.headerTitle}>
              {departmentInfo?.nom || 'Modules Opérationnels'}
            </Text>
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
        stocks: StockCard
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

  // ==================== RENDER MAIN ====================
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement des modules...</Text>
      </SafeAreaView>
    );
  }

// Remplacer cette partie (vers ligne 1640) :

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
  {...(viewMode === 'grid' && { columnWrapperStyle: styles.gridRow })}
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
      />
    </SafeAreaView>
  );
};

// ==================== CARD COMPONENTS ====================

// Overview Card
const OverviewCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.overviewCard} onPress={onPress} activeOpacity={0.7}>
    <Surface style={styles.overviewCardSurface} elevation={2}>
      <MaterialIcons 
        name={getOverviewIcon(item.type)} 
        size={getResponsiveValue(36, 40, 44, 48)} 
        color="#2E86C1" 
      />
      <Text style={styles.overviewCardTitle}>{item.type}</Text>
      <Text style={styles.overviewCardCount}>{item.count}</Text>
    </Surface>
  </TouchableOpacity>
);

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

        {item.derniere_vaccination && (
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

        {item.prochain_controle && (
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

// ==================== DETAIL MODAL ====================
const DetailModal = ({ visible, onDismiss, item, departmentType, activeSection }) => {
  if (!item) return null;

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
              
              return (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{formatLabel(key)}:</Text>
                  <Text style={styles.detailValue}>{formatValue(value)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <Button mode="contained" onPress={onDismiss}>
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
    commercial: 'shopping-cart'
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
    stocks: 'Gestion des Stocks'
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
    stocks: 'inventory'
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

const formatValue = (value) => {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number' && value > 1000000) return formatCurrency(value);
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