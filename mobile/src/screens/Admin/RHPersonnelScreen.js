import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Card,
  Title,
  Button,
  Searchbar,
  Chip,
  TextInput,
  IconButton,
  SegmentedButtons,
  FAB,
  Portal,
  Divider,
  Avatar,
  Badge,
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';
import { requireAuth } from '../../utils/authGuard';

// ============================================
// API CONFIG
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Interceptor error:', error);
  }
  return config;
});

// ============================================
// DEVICE TYPE DETECTION
// ============================================
const getDeviceType = (width) => {
  if (width < 480) return 'mobile-small';
  if (width < 768) return 'mobile';
  if (width >= 768 && width < 1024) return 'tablet';
  if (width >= 1024 && width < 1440) return 'laptop';
  return 'desktop';
};

const getLayoutConfig = (deviceType, width) => {
  const configs = {
    'mobile-small': {
      numColumns: 1,
      cardPadding: 12,
      modalWidth: '98%',
      modalHeight: '95%',
      fontSize: {
        title: 20,
        subtitle: 14,
        body: 14,
        small: 12,
      },
      spacing: 12,
      cardWidth: width - 32,
    },
    'mobile': {
      numColumns: 2,
      cardPadding: 14,
      modalWidth: '95%',
      modalHeight: '90%',
      fontSize: {
        title: 22,
        subtitle: 15,
        body: 15,
        small: 13,
      },
      spacing: 14,
      cardWidth: (width - 48) / 2,
    },
    'tablet': {
      numColumns: 3,
      cardPadding: 16,
      modalWidth: '80%',
      modalHeight: '85%',
      fontSize: {
        title: 24,
        subtitle: 16,
        body: 16,
        small: 14,
      },
      spacing: 16,
      cardWidth: (width - 64) / 3,
    },
    'laptop': {
      numColumns: 4,
      cardPadding: 18,
      modalWidth: '70%',
      modalHeight: '80%',
      fontSize: {
        title: 26,
        subtitle: 17,
        body: 17,
        small: 15,
      },
      spacing: 18,
      cardWidth: (width - 90) / 4,
    },
    'desktop': {
      numColumns: 5,
      cardPadding: 20,
      modalWidth: '60%',
      modalHeight: '80%',
      fontSize: {
        title: 28,
        subtitle: 18,
        body: 18,
        small: 16,
      },
      spacing: 20,
      cardWidth: (width - 120) / 5,
    },
  };
  return configs[deviceType] || configs['mobile'];
};

// ============================================
// MAIN COMPONENT
// ============================================
const RHPersonnelScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const deviceType = useMemo(() => getDeviceType(width), [width]);
  const layout = useMemo(() => getLayoutConfig(deviceType, width), [deviceType, width]);

  const { user, isLoading } = requireAuth(navigation, { role: 'admin' });

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [activeTab, setActiveTab] = useState('employes');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [error, setError] = useState(null);

  // EMPLOYÉS
  const [employes, setEmployes] = useState([]);
  const [filteredEmployes, setFilteredEmployes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeEmploye, setSelectedTypeEmploye] = useState('all');
  const [selectedDepartement, setSelectedDepartement] = useState('all');
  const [selectedEmploye, setSelectedEmploye] = useState(null);
  const [employeModalVisible, setEmployeModalVisible] = useState(false);
  const [employeMode, setEmployeMode] = useState('view');
  const [carteModalVisible, setCarteModalVisible] = useState(false);
const [showDatePickerField, setShowDatePickerField] = useState(null);
const [datePickerValue, setDatePickerValue] = useState(new Date());

  // DEPARTEMENTS
  const [departements, setDepartements] = useState([]);
  const [selectedDepartementData, setSelectedDepartementData] = useState(null);
  const [departementModalVisible, setDepartementModalVisible] = useState(false);
  const [departementMode, setDepartementMode] = useState('view');

  // PRESENCES
  const [presences, setPresences] = useState([]);
  const [selectedDatePresence, setSelectedDatePresence] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // SALAIRES
  const [salaires, setSalaires] = useState([]);
  const [selectedMoisSalaire, setSelectedMoisSalaire] = useState(new Date());

  // CONGÉS
  const [conges, setConges] = useState([]);
  const [congesPendingCount, setCongesPendingCount] = useState(0);

  // HISTORIQUE
  const [historique, setHistorique] = useState([]);

  // FORMS
  const [employeForm, setEmployeForm] = useState(getEmptyEmployeForm());
  const [departementForm, setDepartementForm] = useState(getEmptyDepartementForm());

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  function getEmptyEmployeForm() {
    return {
      matricule: '',
      email: '',
      nom_complet: '',
      telephone: '',
      type_employe: 'INSS',
      role: 'employe',
      id_departement: null,
      date_embauche: new Date().toISOString().split('T')[0],
      date_naissance: new Date().toISOString().split('T')[0],
      adresse: '',
      ville: '',
      pays: 'Burundi',
      numero_cnss: '',
      numero_cni: '',
      salaire_base: '',
      jours_conges_annuels: 20,
      compte_bancaire: '',
      nom_banque: '',
      photo_identite: null,
      statut: 'actif',
    };
  }

  function getEmptyDepartementForm() {
    return {
      nom: '',
      id_parent: null,
      type: 'standard',
      budget_annuel: '',
      responsable_id: null,
      statut: 'actif',
    };
  }

  // ============================================
  // API CALLS
  // ============================================
  const loadEmployes = useCallback(async () => {
    try {
      const params = {};
      if (selectedTypeEmploye !== 'all') params.type_employe = selectedTypeEmploye;
      if (selectedDepartement !== 'all') params.id_departement = selectedDepartement;

      const response = await api.get('/personnel/employes', { params });
      setEmployes(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des employés');
      console.error('Load employes error:', err);
    }
  }, [selectedTypeEmploye, selectedDepartement]);

  const loadDepartements = useCallback(async () => {
    try {
      const response = await api.get('/personnel/departements');
      setDepartements(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des départements');
      console.error('Load departements error:', err);
    }
  }, []);

  const loadPresences = useCallback(async () => {
    try {
      const dateStr = selectedDatePresence.toISOString().split('T')[0];
      const response = await api.get('/personnel/presences', { params: { date: dateStr } });
      setPresences(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des présences');
      console.error('Load presences error:', err);
    }
  }, [selectedDatePresence]);

  const loadSalaires = useCallback(async () => {
    try {
      const mois = selectedMoisSalaire.getMonth() + 1;
      const annee = selectedMoisSalaire.getFullYear();
      const response = await api.get('/personnel/salaires', { params: { mois, annee } });
      setSalaires(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des salaires');
      console.error('Load salaires error:', err);
    }
  }, [selectedMoisSalaire]);

  const loadConges = useCallback(async () => {
    try {
      const response = await api.get('/personnel/conges');
      setConges(response.data.data || []);
      setCongesPendingCount(
        (response.data.data || []).filter(c => c.statut === 'en_attente').length
      );
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des congés');
      console.error('Load conges error:', err);
    }
  }, []);

  const loadHistorique = useCallback(async () => {
    try {
      const response = await api.get('/personnel/historique');
      setHistorique(response.data.data || []);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement de l\'historique');
      console.error('Load historique error:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'employes':
          await Promise.all([loadEmployes(), loadDepartements()]);
          break;
        case 'departements':
          await loadDepartements();
          break;
        case 'presences':
          await loadPresences();
          break;
        case 'salaires':
          await loadSalaires();
          break;
        case 'conges':
          await loadConges();
          break;
        case 'historique':
          await loadHistorique();
          break;
        default:
          break;
      }
    } catch (err) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, loadEmployes, loadDepartements, loadPresences, loadSalaires, loadConges, loadHistorique]);

  // ============================================
  // ACTIONS - EMPLOYÉS
  // ============================================
  const filterEmployes = useCallback(() => {
    let filtered = [...employes];

    if (searchQuery) {
      filtered = filtered.filter(emp =>
        emp.nom_complet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.matricule?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.telephone?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEmployes(filtered);
  }, [employes, searchQuery]);

  const handleCreateEmploye = async () => {
    try {
      if (!employeForm.matricule || !employeForm.email || !employeForm.nom_complet) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      setActionInProgress('create_employe');
      const response = await api.post('/personnel/employes', employeForm);

      Alert.alert('Succès', 'Employé créé avec succès');
      setEmployeModalVisible(false);
      setEmployeForm(getEmptyEmployeForm());
      await loadEmployes();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateEmploye = async () => {
    try {
      setActionInProgress('update_employe');
      await api.put(`/personnel/employes/${selectedEmploye.id}`, employeForm);

      Alert.alert('Succès', 'Employé modifié avec succès');
      setEmployeModalVisible(false);
      setEmployeForm(getEmptyEmployeForm());
      await loadEmployes();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors de la modification');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteEmploye = (employe) => {
    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir supprimer ${employe.nom_complet} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionInProgress('delete_employe');
              await api.delete(`/personnel/employes/${employe.id}`);
              Alert.alert('Succès', 'Employé supprimé');
              await loadEmployes();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer l\'employé');
            } finally {
              setActionInProgress(null);
            }
          }
        }
      ]
    );
  };

  const handleGenerateCarte = async (employe) => {
    try {
      setActionInProgress('generate_carte');
      const response = await api.get(`/personnel/employes/${employe.id}/carte`);
      setSelectedEmploye({
        ...employe,
        ...response.data.data.employe,
        carte: response.data.data.carte,
      });
      setCarteModalVisible(true);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger la carte');
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePrintCarte = async () => {
    try {
      setActionInProgress('print_carte');

      const carteHTML = generateCarteHTML(selectedEmploye);
      const { uri } = await Print.printToFileAsync({ html: carteHTML });

      if (Platform.OS !== 'web') {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Carte_${selectedEmploye.nom_complet}.pdf`
        });
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de générer la carte');
    } finally {
      setActionInProgress(null);
    }
  };

  // ============================================
  // ACTIONS - DÉPARTEMENTS
  // ============================================
  const handleCreateDepartement = async () => {
    try {
      if (!departementForm.nom) {
        Alert.alert('Erreur', 'Le nom du département est obligatoire');
        return;
      }

      setActionInProgress('create_departement');
      await api.post('/personnel/departements', departementForm);

      Alert.alert('Succès', 'Département créé');
      setDepartementModalVisible(false);
      setDepartementForm(getEmptyDepartementForm());
      await loadDepartements();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdateDepartement = async () => {
    try {
      setActionInProgress('update_departement');
      await api.put(`/personnel/departements/${selectedDepartementData.id}`, departementForm);

      Alert.alert('Succès', 'Département modifié');
      setDepartementModalVisible(false);
      setDepartementForm(getEmptyDepartementForm());
      await loadDepartements();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors de la modification');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteDepartement = (dept) => {
    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir supprimer ${dept.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionInProgress('delete_departement');
              await api.delete(`/personnel/departements/${dept.id}`);
              Alert.alert('Succès', 'Département supprimé');
              await loadDepartements();
            } catch (err) {
              Alert.alert('Erreur', err.response?.data?.message || 'Impossible de supprimer');
            } finally {
              setActionInProgress(null);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // ACTIONS - SALAIRES
  // ============================================
  const handleCalculerSalaires = async () => {
    const mois = selectedMoisSalaire.getMonth() + 1;
    const annee = selectedMoisSalaire.getFullYear();

    Alert.alert(
      'Calcul des salaires',
      `Calculer les salaires pour ${selectedMoisSalaire.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Calculer',
          onPress: async () => {
            try {
              setActionInProgress('calculer_salaires');
              await api.post('/personnel/salaires/calculer', { mois, annee });
              Alert.alert('Succès', 'Salaires calculés');
              await loadSalaires();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de calculer les salaires');
            } finally {
              setActionInProgress(null);
            }
          }
        }
      ]
    );
  };

  const handleValiderSalaire = async (salaireId) => {
    try {
      setActionInProgress('valider_salaire');
      await api.put(`/personnel/salaires/${salaireId}/valider`);
      Alert.alert('Succès', 'Salaire validé');
      await loadSalaires();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de valider');
    } finally {
      setActionInProgress(null);
    }
  };

  // ============================================
  // ACTIONS - CONGÉS
  // ============================================
  const handleApprouverConge = async (congeId) => {
    try {
      setActionInProgress('approuver_conge');
      await api.put(`/personnel/conges/${congeId}/approuver`);
      Alert.alert('Succès', 'Congé approuvé');
      await loadConges();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'approuver');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRejeterConge = async (congeId, raison) => {
    try {
      setActionInProgress('rejeter_conge');
      await api.put(`/personnel/conges/${congeId}/rejeter`, { commentaire_validation: raison });
      Alert.alert('Succès', 'Congé rejeté');
      await loadConges();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de rejeter');
    } finally {
      setActionInProgress(null);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    loadData();
  }, [activeTab, selectedTypeEmploye, selectedDepartement, selectedDatePresence, selectedMoisSalaire]);

  useEffect(() => {
    filterEmployes();
  }, [employes, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Vérification des autorisations...</Text>
      </View>
    );
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  const LoadingOverlay = () => (
    <View style={styles.loadingOverlay}>
      <View style={[styles.loadingBox, { padding: 16 * 2 }]}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={[styles.loadingText, { fontSize: 18, marginTop: 16 }]}>
          Chargement en cours...
        </Text>
      </View>
    </View>
  );

  const ErrorBanner = () =>
    error ? (
      <View style={[styles.errorBanner, { paddingHorizontal: 16, paddingVertical: 16 / 2 }]}>
        <MaterialIcons name="error" size={20} color="#E74C3C" />
        <Text style={[styles.errorText, { fontSize: 16, marginLeft: 16 / 2, flex: 1 }]}>
          {error}
        </Text>
        <TouchableOpacity onPress={() => setError(null)}>
          <MaterialIcons name="close" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    ) : null;

  // ============================================
  // RENDER EMPLOYÉS - CARD STYLE
  // ============================================
  const EmployeCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.employeCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      onPress={() => {
        setSelectedEmploye(item);
        setEmployeMode('view');
        setEmployeModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.employeCardHeader}>
        <Avatar.Image
          size={28 * 3.5}
          source={item.photo_identite ? { uri: item.photo_identite } : require('../../../assets/images/default-avatar.png')}
        />
        {item.statut === 'actif' && (
          <Badge
            size={12}
            style={styles.statusBadge}
          />
        )}
      </View>

      <View style={styles.employeCardBody}>
        <Text
          style={[styles.employeCardName, { fontSize: 18, marginTop: 16 }]}
          numberOfLines={2}
        >
          {item.nom_complet}
        </Text>

        <View style={[styles.employeInfoRow, { marginTop: 16 / 2 }]}>
          <MaterialIcons name="phone" size={16} color="#7F8C8D" />
          <Text style={[styles.employeInfoText, { fontSize: 16, marginLeft: 4 }]}>
            {item.telephone || 'N/A'}
          </Text>
        </View>

        <View style={[styles.employeInfoRow, { marginTop: 4 }]}>
          <MaterialIcons name="badge" size={16} color="#7F8C8D" />
          <Text style={[styles.employeInfoText, { fontSize: 16, marginLeft: 4 }]}>
            {item.numero_cni || item.numero_cnss || 'N/A'}
          </Text>
        </View>

        <Chip
          mode="flat"
          textStyle={{ fontSize: 16 - 2 }}
          style={[styles.employeTypeChip, { marginTop: 16 }]}
        >
          {item.type_employe}
        </Chip>
      </View>

      <View style={[styles.employeCardActions, { marginTop: 16 }]}>
        <TouchableOpacity
          style={[styles.cardActionBtn, { padding: 16 / 2 }]}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedEmploye(item);
            setEmployeForm(item);
            setEmployeMode('edit');
            setEmployeModalVisible(true);
          }}
        >
          <MaterialIcons name="edit" size={18} color="#3498DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cardActionBtn, { padding: 16 / 2 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleGenerateCarte(item);
          }}
        >
          <MaterialIcons name="credit-card" size={18} color="#9B59B6" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cardActionBtn, { padding: 16 / 2 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteEmploye(item);
          }}
        >
          <MaterialIcons name="delete" size={18} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const EmployeListView = () => (
    <FlatList
      data={filteredEmployes}
      renderItem={({ item }) => <EmployeCard item={item} />}
      keyExtractor={item => item.id?.toString()}
      numColumns={layout.numColumns}
      key={layout.numColumns}
      contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialIcons name="people" size={80} color="#BDC3C7" />
          <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
            Aucun employé trouvé
          </Text>
        </View>
      }
    />
  );

  // ============================================
  // RENDER DÉPARTEMENTS - CLICKABLE CARDS
  // ============================================
  const DepartementCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deptCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      onPress={() => {
        setSelectedDepartementData(item);
        setDepartementForm(item);
        setDepartementMode('view');
        setDepartementModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.deptCardIcon}>
        <MaterialIcons name="business" size={28 * 2} color="#3498DB" />
      </View>

      <Text style={[styles.deptCardTitle, { fontSize: 18, marginTop: 16 }]} numberOfLines={2}>
        {item.nom}
      </Text>

      <View style={[styles.deptCardInfo, { marginTop: 16 }]}>
        <View style={styles.deptInfoItem}>
          <MaterialIcons name="people" size={16} color="#7F8C8D" />
          <Text style={[styles.deptInfoText, { fontSize: 16, marginLeft: 4 }]}>
            {item.nombre_employes || 0} employés
          </Text>
        </View>

        <View style={[styles.deptInfoItem, { marginTop: 6 }]}>
          <MaterialIcons name="attach-money" size={16} color="#7F8C8D" />
          <Text style={[styles.deptInfoText, { fontSize: 16, marginLeft: 4 }]}>
            ${item.budget_annuel || 0}
          </Text>
        </View>
      </View>

      <View style={[styles.deptCardActions, { marginTop: 16 }]}>
        <TouchableOpacity
          style={[styles.cardActionBtn, { padding: 16 / 2 }]}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedDepartementData(item);
            setDepartementForm(item);
            setDepartementMode('edit');
            setDepartementModalVisible(true);
          }}
        >
          <MaterialIcons name="edit" size={18} color="#3498DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cardActionBtn, { padding: 16 / 2 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteDepartement(item);
          }}
        >
          <MaterialIcons name="delete" size={18} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const DepartementListView = () => (
    <FlatList
      data={departements}
      renderItem={({ item }) => <DepartementCard item={item} />}
      keyExtractor={item => item.id?.toString()}
      numColumns={layout.numColumns}
      key={layout.numColumns}
      contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialIcons name="business" size={80} color="#BDC3C7" />
          <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
            Aucun département
          </Text>
        </View>
      }
    />
  );

  // ============================================
  // RENDER PRESENCES - CLICKABLE CARDS
  // ============================================
  const PresenceCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.presenceCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.presenceCardHeader}>
        <Avatar.Image
          size={50}
          source={item.photo ? { uri: item.photo } : require('../../../assets/images/default-avatar.png')}
        />
        <Chip
          mode="flat"
          textStyle={{ fontSize: 16 - 2 }}
          style={styles.presenceStatusChip}
        >
          {item.statut}
        </Chip>
      </View>

      <Text style={[styles.presenceCardName, { fontSize: 18, marginTop: 16 }]}>
        {item.employe_nom}
      </Text>

      <View style={[styles.presenceTimeInfo, { marginTop: 16 }]}>
        <View style={styles.presenceTimeRow}>
          <MaterialIcons name="login" size={16} color="#27AE60" />
          <Text style={[styles.presenceTimeText, { fontSize: 16, marginLeft: 4 }]}>
            {item.heure_entree}
          </Text>
        </View>

        <View style={[styles.presenceTimeRow, { marginTop: 4 }]}>
          <MaterialIcons name="logout" size={16} color="#E74C3C" />
          <Text style={[styles.presenceTimeText, { fontSize: 16, marginLeft: 4 }]}>
            {item.heure_sortie || 'En cours'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const PresenceListView = () => (
    <>
      <View style={[styles.sectionHeader, { paddingHorizontal: 16, paddingVertical: 16 }]}>
        <TouchableOpacity
          style={[styles.datePickerBtn, { paddingHorizontal: 16, paddingVertical: 16 / 2 }]}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
          <Text style={[styles.datePickerText, { fontSize: 18, marginLeft: 16 / 2 }]}>
            {selectedDatePresence.toLocaleDateString('fr-FR')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={presences}
        renderItem={({ item }) => <PresenceCard item={item} />}
        keyExtractor={item => item.id?.toString()}
        numColumns={layout.numColumns}
        key={layout.numColumns}
        contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="assignment-turned-in" size={80} color="#BDC3C7" />
            <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
              Aucune présence
            </Text>
          </View>
        }
      />
    </>
  );

  // ============================================
  // RENDER SALAIRES - CLICKABLE CARDS
  // ============================================
  const SalaireCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.salaireCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.salaireCardHeader}>
        <Avatar.Text
          size={50}
          label={item.employe_nom?.substring(0, 2).toUpperCase()}
          style={{ backgroundColor: '#3498DB' }}
        />
        {item.statut_paiement === 'calculé' && (
          <Badge size={8} style={styles.salaireStatusBadge} />
        )}
      </View>

      <Text style={[styles.salaireCardName, { fontSize: 18, marginTop: 16 }]} numberOfLines={2}>
        {item.employe_nom}
      </Text>

      <View style={[styles.salaireInfo, { marginTop: 16 }]}>
        <Text style={[styles.salaireLabel, { fontSize: 16 }]}>Salaire net</Text>
        <Text style={[styles.salaireAmount, { fontSize: 28 }]}>
          ${item.salaire_net}
        </Text>
      </View>

      {item.statut_paiement === 'calculé' && (
        <Button
          mode="contained"
          onPress={() => handleValiderSalaire(item.id)}
          buttonColor="#27AE60"
          style={{ marginTop: 16 }}
          labelStyle={{ fontSize: 16 }}
        >
          Valider
        </Button>
      )}

      <Chip
        mode="flat"
        textStyle={{ fontSize: 16 - 2 }}
        style={[styles.salaireStatusChip, { marginTop: 16 / 2 }]}
      >
        {item.statut_paiement}
      </Chip>
    </TouchableOpacity>
  );

  const SalaireListView = () => (
    <>
      <View style={[styles.sectionHeader, { paddingHorizontal: 16, paddingVertical: 16 }]}>
        <TouchableOpacity
          style={[styles.datePickerBtn, { paddingHorizontal: 16, paddingVertical: 16 / 2 }]}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
          <Text style={[styles.datePickerText, { fontSize: 18, marginLeft: 16 / 2 }]}>
            {selectedMoisSalaire.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          onPress={handleCalculerSalaires}
          buttonColor="#27AE60"
          labelStyle={{ fontSize: 16 }}
          icon="calculator"
        >
          Calculer
        </Button>
      </View>

      <FlatList
        data={salaires}
        renderItem={({ item }) => <SalaireCard item={item} />}
        keyExtractor={item => item.id?.toString()}
        numColumns={layout.numColumns}
        key={layout.numColumns}
        contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="attach-money" size={80} color="#BDC3C7" />
            <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
              Aucun salaire
            </Text>
          </View>
        }
      />
    </>
  );

  // ============================================
  // RENDER CONGÉS - CLICKABLE CARDS
  // ============================================
  const CongeCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.congeCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.congeCardHeader}>
        <Text style={[styles.congeCardName, { fontSize: 18 }]} numberOfLines={1}>
          {item.employe_nom}
        </Text>
        <Chip
          mode="flat"
          textStyle={{ fontSize: 16 - 2 }}
          style={styles.congeStatusChip}
        >
          {item.statut}
        </Chip>
      </View>

      <View style={[styles.congeDateInfo, { marginTop: 16 }]}>
        <View style={styles.congeDateRow}>
          <MaterialIcons name="event" size={16} color="#7F8C8D" />
          <Text style={[styles.congeDateText, { fontSize: 16, marginLeft: 4 }]}>
            Début: {new Date(item.date_debut).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        <View style={[styles.congeDateRow, { marginTop: 4 }]}>
          <MaterialIcons name="event" size={16} color="#7F8C8D" />
          <Text style={[styles.congeDateText, { fontSize: 16, marginLeft: 4 }]}>
            Fin: {new Date(item.date_fin).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </View>

      {item.statut === 'en_attente' && (
        <View style={[styles.congeActions, { marginTop: 16 }]}>
          <Button
            mode="contained"
            onPress={() => handleApprouverConge(item.id)}
            buttonColor="#27AE60"
            style={{ flex: 1, marginRight: 16 / 2 }}
            labelStyle={{ fontSize: 16 }}
          >
            Approuver
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleRejeterConge(item.id, 'Raison de rejet')}
            style={{ flex: 1, marginLeft: 16 / 2 }}
            labelStyle={{ fontSize: 16 }}
          >
            Rejeter
          </Button>
        </View>
      )}
    </TouchableOpacity>
  );

  const CongeListView = () => (
    <>
      {congesPendingCount > 0 && (
        <View style={[styles.alertBanner, { marginHorizontal: 16, marginTop: 16, padding: 16 }]}>
          <MaterialIcons name="pending-actions" size={24} color="#F39C12" />
          <Text style={[styles.alertText, { fontSize: 16, marginLeft: 16 }]}>
            {congesPendingCount} demande(s) en attente de validation
          </Text>
        </View>
      )}

      <FlatList
        data={conges}
        renderItem={({ item }) => <CongeCard item={item} />}
        keyExtractor={item => item.id?.toString()}
        numColumns={layout.numColumns}
        key={layout.numColumns}
        contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="event" size={80} color="#BDC3C7" />
            <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
              Aucun congé
            </Text>
          </View>
        }
      />
    </>
  );

  // ============================================
  // RENDER HISTORIQUE - CLICKABLE CARDS
  // ============================================
  const HistoriqueCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.historiqueCard,
        {
          width: layout.cardWidth,
          margin: 16 / 2,
          padding: layout.cardPadding,
        }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.historiqueIconContainer}>
        <MaterialIcons name="history" size={28 * 1.5} color="#3498DB" />
      </View>

      <Text style={[styles.historiqueType, { fontSize: 18, marginTop: 16 }]}>
        {item.type_action}
      </Text>

      <Text
        style={[styles.historiqueDetails, { fontSize: 16, marginTop: 16 / 2 }]}
        numberOfLines={3}
      >
        {item.action_details}
      </Text>

      <Text style={[styles.historiqueDate, { fontSize: 16 - 2, marginTop: 16 }]}>
        {new Date(item.date_action).toLocaleString('fr-FR')}
      </Text>
    </TouchableOpacity>
  );

  const HistoriqueListView = () => (
    <FlatList
      data={historique}
      renderItem={({ item }) => <HistoriqueCard item={item} />}
      keyExtractor={item => item.id?.toString()}
      numColumns={layout.numColumns}
      key={layout.numColumns}
      contentContainerStyle={[styles.gridContent, { padding: 16 / 2 }]}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={80} color="#BDC3C7" />
          <Text style={[styles.emptyText, { fontSize: 18, marginTop: 16 }]}>
            Aucun historique
          </Text>
        </View>
      }
    />
  );

  // ============================================
  // MODALS (same as before but with improved styling)
  // ============================================

const EmployeModal = () => (
  <Portal>
    <Modal
      visible={employeModalVisible}
      onDismiss={() => setEmployeModalVisible(false)}
      transparent
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          {
            width: '60%',
            maxWidth: '95%',
            maxHeight: '95%',
            paddingHorizontal: 16,
            paddingVertical: 32,
          }
        ]}>
          <View style={styles.modalHeader}>
            <Title style={[styles.modalTitle, { fontSize: 28 }]}>
              {employeMode === 'add' ? 'Ajouter Employé' : employeMode === 'edit' ? 'Modifier Employé' : 'Détails Employé'}
            </Title>
            <IconButton
              icon="close"
              size={28}
              onPress={() => setEmployeModalVisible(false)}
            />
          </View>

          <ScrollView style={{ maxHeight: '75%' }} showsVerticalScrollIndicator={true}>
            {employeMode === 'view' ? (
              // ============================================
              // MODE VIEW
              // ============================================
              <View>
                <View style={styles.modalViewSection}>
                  <Avatar.Image
                    size={100}
                    source={selectedEmploye?.photo_identite ? { uri: selectedEmploye.photo_identite } : require('../../../assets/images/default-avatar.png')}
                    style={{ alignSelf: 'center', marginBottom: 32 }}
                  />

                  {/* SECTION 1 - INFORMATIONS DE BASE */}
                  <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                  Informations de base
                  </Text>
                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Matricule</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.matricule}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>CNI</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.CNI || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Nom complet</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.nom_complet}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Téléphone</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.telephone}</Text>
                    </View>
                  </View>

                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Email</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.email}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Date de naissance</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.date_naissance ? new Date(selectedEmploye.date_naissance).toLocaleDateString('fr-FR') : 'N/A'}</Text>
                    </View>
                  </View>

                  {/* SECTION 2 - STATUT ET RÔLE */}
                  <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                  Statut et rôle
                  </Text>
                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Type d'employé</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.type_employe}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Rôle</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.role}</Text>
                    </View>
                  </View>

                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Statut</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.statut}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Département</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>
                        {departements.find(d => d.id === selectedEmploye?.id_departement)?.nom || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* SECTION 3 - INFORMATIONS PROFESSIONNELLES */}
                  <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                  Informations professionnelles
                  </Text>
                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Date d'embauche</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.date_embauche ? new Date(selectedEmploye.date_embauche).toLocaleDateString('fr-FR') : 'N/A'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Salaire de base</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>${selectedEmploye?.salaire_base}</Text>
                    </View>
                  </View>

                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>N° CNSS</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.numero_cnss || 'N/A'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Jours de congés annuels</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.jours_conges_annuels || 20}</Text>
                    </View>
                  </View>

                  {/* SECTION 4 - ADRESSE */}
                  <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                  Adresse
                  </Text>
                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Adresse</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.adresse || 'N/A'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Ville</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.ville || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Pays</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.pays || 'Burundi'}</Text>
                    </View>
                  </View>

                  {/* SECTION 5 - INFORMATIONS BANCAIRES */}
                  <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                  Informations bancaires
                  </Text>
                  <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Compte bancaire</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.compte_bancaire || 'N/A'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.viewLabel, { fontSize: 16 }]}>Nom de la banque</Text>
                      <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.nom_banque || 'N/A'}</Text>
                    </View>
                  </View>

                  {/* SECTION 7 - DÉPART */}
                  {selectedEmploye?.statut === 'inactif' && (
                    <>
                      <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 32 }]}>
                        👋 Information de départ
                      </Text>
                      <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.viewLabel, { fontSize: 16 }]}>Date de départ</Text>
                          <Text style={[styles.viewValue, { fontSize: 18 }]}>
                            {selectedEmploye?.date_depart ? new Date(selectedEmploye.date_depart).toLocaleDateString('fr-FR') : 'N/A'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.viewLabel, { fontSize: 16 }]}>Raison du départ</Text>
                          <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedEmploye?.raison_depart || 'N/A'}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ) : (
              // ============================================
              // MODE EDIT/ADD
              // ============================================
              <View>
                {/* SECTION 1 */}
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                Informations de base
                </Text>

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Matricule *"
                      value={employeForm.matricule}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, matricule: text })}
                      style={styles.input}
                      mode="outlined"
                      editable={employeMode === 'add'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      label="CNI"
                      value={employeForm.CNI || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, CNI: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                </View>

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Nom Complet *"
                      value={employeForm.nom_complet}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, nom_complet: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      label="Téléphone"
                      value={employeForm.telephone}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, telephone: text })}
                      style={styles.input}
                      mode="outlined"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Email *"
                      value={employeForm.email}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, email: text })}
                      style={styles.input}
                      mode="outlined"
                      keyboardType="email-address"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    {employeMode === 'add' && (
                      <TextInput
                        label="Mot de passe *"
                        value={employeForm.mot_de_passe || ''}
                        onChangeText={(text) => setEmployeForm({ ...employeForm, mot_de_passe: text })}
                        style={styles.input}
                        mode="outlined"
                        secureTextEntry
                      />
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.dateInput, { marginBottom: 16 }]}
                  onPress={() => {
                    setShowDatePickerField('date_naissance');
                    setDatePickerValue(new Date(employeForm.date_naissance || new Date()));
                  }}
                >
                  <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
                  <Text style={[styles.dateInputText, { marginLeft: 8 }]}>
                    Date de naissance: {employeForm.date_naissance ? new Date(employeForm.date_naissance).toLocaleDateString('fr-FR') : 'Non définie'}
                  </Text>
                </TouchableOpacity>

                {/* SECTION 2 */}
                <Divider style={{ marginVertical: 24 }} />
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                Statut et rôle
                </Text>

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8 }]}>Type d'employé</Text>
                <SegmentedButtons
                  value={employeForm.type_employe}
                  onValueChange={(value) => setEmployeForm({ ...employeForm, type_employe: value })}
                  buttons={[
                    { value: 'INSS', label: 'INSS' },
                    { value: 'temps_partiel', label: 'Temps partiel' },
                    { value: 'contractuel', label: 'Contractuel' }
                  ]}
                  style={{ marginBottom: 16 }}
                />

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8 }]}>Rôle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {['admin', 'manager', 'employe', 'comptable', 'veterinaire', 'chauffeur', 'agriculteur', 'technicien'].map(role => (
                    <Chip
                      key={role}
                      selected={employeForm.role === role}
                      onPress={() => setEmployeForm({ ...employeForm, role })}
                      style={{ marginRight: 8 }}
                    >
                      {role}
                    </Chip>
                  ))}
                </ScrollView>

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8 }]}>Statut</Text>
                <SegmentedButtons
                  value={employeForm.statut}
                  onValueChange={(value) => setEmployeForm({ ...employeForm, statut: value })}
                  buttons={[
                    { value: 'actif', label: 'Actif' },
                    { value: 'inactif', label: 'Inactif' },
                    { value: 'congé', label: 'Congé' },
                    { value: 'suspendu', label: 'Suspendu' }
                  ]}
                  style={{ marginBottom: 16 }}
                />

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8 }]}>Département</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {departements.map(dept => (
                    <Chip
                      key={dept.id}
                      selected={employeForm.id_departement === dept.id}
                      onPress={() => setEmployeForm({ ...employeForm, id_departement: dept.id })}
                      style={{ marginRight: 8 }}
                    >
                      {dept.nom}
                    </Chip>
                  ))}
                </ScrollView>

                {/* SECTION 3 */}
                <Divider style={{ marginVertical: 24 }} />
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                Informations professionnelles
                </Text>

                <TouchableOpacity
                  style={[styles.dateInput, { marginBottom: 16 }]}
                  onPress={() => {
                    setShowDatePickerField('date_embauche');
                    setDatePickerValue(new Date(employeForm.date_embauche || new Date()));
                  }}
                >
                  <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
                  <Text style={[styles.dateInputText, { marginLeft: 8 }]}>
                    Date d'embauche: {employeForm.date_embauche ? new Date(employeForm.date_embauche).toLocaleDateString('fr-FR') : 'Non définie'}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Salaire de base *"
                      value={employeForm.salaire_base?.toString() || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, salaire_base: parseFloat(text) || '' })}
                      style={styles.input}
                      mode="outlined"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      label="N° CNSS"
                      value={employeForm.numero_cnss || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, numero_cnss: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                </View>

                <TextInput
                  label="Jours de congés annuels"
                  value={employeForm.jours_conges_annuels?.toString() || '20'}
                  onChangeText={(text) => setEmployeForm({ ...employeForm, jours_conges_annuels: parseInt(text) || 20 })}
                  style={[styles.input, { marginBottom: 16 }]}
                  mode="outlined"
                  keyboardType="numeric"
                />

                {/* SECTION 4 */}
                <Divider style={{ marginVertical: 24 }} />
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                 Adresse
                </Text>

                <TextInput
                  label="Adresse"
                  value={employeForm.adresse || ''}
                  onChangeText={(text) => setEmployeForm({ ...employeForm, adresse: text })}
                  style={[styles.input, { marginBottom: 16 }]}
                  mode="outlined"
                  multiline
                />

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Ville"
                      value={employeForm.ville || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, ville: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      label="Pays"
                      value={employeForm.pays || 'Burundi'}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, pays: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                </View>

                {/* SECTION 5 */}
                <Divider style={{ marginVertical: 24 }} />
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                  🏦 Informations bancaires
                </Text>

                <View style={[styles.twoColumnRow, { marginBottom: 16 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Compte bancaire"
                      value={employeForm.compte_bancaire || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, compte_bancaire: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      label="Nom de la banque"
                      value={employeForm.nom_banque || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, nom_banque: text })}
                      style={styles.input}
                      mode="outlined"
                    />
                  </View>
                </View>

                {/* SECTION 6 */}
                <Divider style={{ marginVertical: 24 }} />
                <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                  📎 Documents
                </Text>

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8 }]}>Photo d'identité</Text>
                <Button
                  mode="outlined"
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      aspect: [1, 1],
                      quality: 0.8,
                    });
                    if (!result.canceled) {
                      setEmployeForm({ ...employeForm, photo_identite: result.assets[0].uri });
                    }
                  }}
                  icon="image"
                  style={{ marginBottom: 16 }}
                >
                  {employeForm.photo_identite ? 'Changer la photo' : 'Ajouter une photo'}
                </Button>

                {employeForm.photo_identite && (
                  <Image
                    source={{ uri: employeForm.photo_identite }}
                    style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 16 }}
                  />
                )}

                <Text style={[styles.labelText, { fontSize: 16, marginBottom: 8, marginTop: 16 }]}>Document d'identité (PDF)</Text>
                <Button
                  mode="outlined"
                  onPress={async () => {
                    try {
                      const result = await DocumentPicker.getDocumentAsync({
                        type: 'application/pdf',
                      });
                      if (result.type === 'success') {
                        setEmployeForm({ ...employeForm, document_identifiants_pdf: result.uri });
                      }
                    } catch (err) {
                      Alert.alert('Info', 'Sélection PDF en développement.');
                    }
                  }}
                  icon="file-pdf"
                  style={{ marginBottom: 16 }}
                >
                  {employeForm.document_identifiants_pdf ? 'Changer le document' : 'Ajouter un PDF'}
                </Button>

                {employeForm.document_identifiants_pdf && (
                  <View style={{ 
                    backgroundColor: '#F8F9FA', 
                    padding: 16, 
                    borderRadius: 8, 
                    marginBottom: 16,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <MaterialIcons name="picture-as-pdf" size={24} color="#E74C3C" style={{ marginRight: 8 }} />
                    <Text style={{ flex: 1, color: '#2C3E50' }} numberOfLines={1}>
                      Document sélectionné
                    </Text>
                    <TouchableOpacity onPress={() => setEmployeForm({ ...employeForm, document_identifiants_pdf: null })}>
                      <MaterialIcons name="close" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* SECTION 7 */}
                {employeForm.statut === 'inactif' && (
                  <>
                    <Divider style={{ marginVertical: 24 }} />
                    <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 16 }]}>
                     Informations de départ
                    </Text>

                    <TouchableOpacity
                      style={[styles.dateInput, { marginBottom: 16 }]}
                      onPress={() => {
                        setShowDatePickerField('date_depart');
                        setDatePickerValue(employeForm.date_depart ? new Date(employeForm.date_depart) : new Date());
                      }}
                    >
                      <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
                      <Text style={[styles.dateInputText, { marginLeft: 8 }]}>
                        Date de départ: {employeForm.date_depart ? new Date(employeForm.date_depart).toLocaleDateString('fr-FR') : 'Non définie'}
                      </Text>
                    </TouchableOpacity>

                    <TextInput
                      label="Raison du départ"
                      value={employeForm.raison_depart || ''}
                      onChangeText={(text) => setEmployeForm({ ...employeForm, raison_depart: text })}
                      style={[styles.input, { marginBottom: 16 }]}
                      mode="outlined"
                      multiline
                    />
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* ACTIONS */}
          <View style={[styles.modalActions, { marginTop: 32 }]}>
            {employeMode === 'view' ? (
              <>
                <Button
                  mode="contained"
                  onPress={() => {
                    setEmployeMode('edit');
                    setEmployeForm(selectedEmploye);
                  }}
                  buttonColor="#F39C12"
                  style={{ flex: 1, marginRight: 8 }}
                >
                  Éditer
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setEmployeModalVisible(false)}
                  style={{ flex: 1, marginLeft: 8 }}
                >
                  Fermer
                </Button>
              </>
            ) : (
              <>
                <Button
                  mode="contained"
                  onPress={employeMode === 'add' ? handleCreateEmploye : handleUpdateEmploye}
                  buttonColor="#27AE60"
                  style={{ flex: 1, marginRight: 8 }}
                  loading={actionInProgress?.includes('employe')}
                  disabled={!!actionInProgress}
                >
                  {employeMode === 'add' ? 'Créer' : 'Enregistrer'}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setEmployeModalVisible(false)}
                  style={{ flex: 1, marginLeft: 8 }}
                  disabled={!!actionInProgress}
                >
                  Annuler
                </Button>
              </>
            )}
          </View>

          {/* DATE PICKER */}
          {showDatePickerField && Platform.OS === 'ios' && (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  setEmployeForm({ ...employeForm, [showDatePickerField]: dateStr });
                  setShowDatePickerField(null);
                } else if (event.type === 'dismissed') {
                  setShowDatePickerField(null);
                }
              }}
            />
          )}

          {showDatePickerField && Platform.OS === 'android' && (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  setEmployeForm({ ...employeForm, [showDatePickerField]: dateStr });
                }
                setShowDatePickerField(null);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  </Portal>
);
const DepartementModal = () => (
    <Portal>
      <Modal
        visible={departementModalVisible}
        onDismiss={() => setDepartementModalVisible(false)}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
                width: '60%',
                maxWidth: '95%',
                maxHeight: '95%',
                paddingHorizontal: 16,
                paddingVertical: 32,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Title style={[styles.modalTitle, { fontSize: 28 }]}>
                {departementMode === 'add' ? 'Ajouter Département' : departementMode === 'edit' ? 'Modifier Département' : 'Détails Département'}
              </Title>
              <IconButton
                icon="close"
                size={28}
                onPress={() => setDepartementModalVisible(false)}
              />
            </View>

            <ScrollView style={{ maxHeight: height * 0.6 }}>
              {departementMode === 'view' ? (
                <View style={styles.modalViewSection}>
                  <View style={styles.viewField}>
                    <Text style={[styles.viewLabel, { fontSize: 16 }]}>Nom du département</Text>
                    <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedDepartementData?.nom}</Text>
                  </View>

                  <View style={styles.viewField}>
                    <Text style={[styles.viewLabel, { fontSize: 16 }]}>Type</Text>
                    <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedDepartementData?.type}</Text>
                  </View>

                  <View style={styles.viewField}>
                    <Text style={[styles.viewLabel, { fontSize: 16 }]}>Budget annuel</Text>
                    <Text style={[styles.viewValue, { fontSize: 18 }]}>${selectedDepartementData?.budget_annuel}</Text>
                  </View>

                  <View style={styles.viewField}>
                    <Text style={[styles.viewLabel, { fontSize: 16 }]}>Nombre d'employés</Text>
                    <Text style={[styles.viewValue, { fontSize: 18 }]}>{selectedDepartementData?.nombre_employes || 0}</Text>
                  </View>
                </View>
              ) : (
                <View>
                  <TextInput
                    label="Nom du Département *"
                    value={departementForm.nom}
                    onChangeText={(text) => setDepartementForm({ ...departementForm, nom: text })}
                    style={[styles.input, { marginBottom: 16 }]}
                    mode="outlined"
                  />

                  <TextInput
                    label="Type"
                    value={departementForm.type}
                    onChangeText={(text) => setDepartementForm({ ...departementForm, type: text })}
                    style={[styles.input, { marginBottom: 16 }]}
                    mode="outlined"
                  />

                  <TextInput
                    label="Budget Annuel (BIF)"
                    value={departementForm.budget_annuel?.toString()}
                    onChangeText={(text) => setDepartementForm({ ...departementForm, budget_annuel: parseFloat(text) })}
                    style={[styles.input, { marginBottom: 16 }]}
                    mode="outlined"
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 16 * 2 }]}>
              {departementMode === 'view' ? (
                <>
                  <Button
                    mode="contained"
                    onPress={() => {
                      setDepartementMode('edit');
                    }}
                    buttonColor="#F39C12"
                    style={{ flex: 1, marginRight: 16 / 2 }}
                  >
                    Éditer
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => setDepartementModalVisible(false)}
                    style={{ flex: 1, marginLeft: 16 / 2 }}
                  >
                    Fermer
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    mode="contained"
                    onPress={departementMode === 'add' ? handleCreateDepartement : handleUpdateDepartement}
                    buttonColor="#27AE60"
                    style={{ flex: 1, marginRight: 16 / 2 }}
                    loading={actionInProgress?.includes('departement')}
                    disabled={!!actionInProgress}
                  >
                    {departementMode === 'add' ? 'Créer' : 'Enregistrer'}
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => setDepartementModalVisible(false)}
                    style={{ flex: 1, marginLeft: 16 / 2 }}
                    disabled={!!actionInProgress}
                  >
                    Annuler
                  </Button>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  const CarteModal = () => (
    <Portal>
      <Modal
        visible={carteModalVisible}
        onDismiss={() => setCarteModalVisible(false)}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
            width: '60%',
              maxWidth: '95%',
              maxHeight: '95%',
              paddingHorizontal: 16,
              paddingVertical: 32,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Title style={[styles.modalTitle, { fontSize: 28 }]}>
                Carte d'Employé
              </Title>
              <IconButton
                icon="close"
                size={28}
                onPress={() => setCarteModalVisible(false)}
              />
            </View>

            <ScrollView style={{ maxHeight: height * 0.7 }}>
              <View style={[
                styles.carte,
                {
                  marginBottom: 16 * 2,
                  padding: 16 * 2,
                }
              ]}>
                <View style={styles.carteHeader}>
                  <Text style={[styles.carteTitle, { fontSize: 28 * 1.2 }]}>NUTRIFIX</Text>
                  <Text style={[styles.carteSubtitle, { fontSize: 16 }]}>Employee Card</Text>
                </View>

                <View style={[styles.carteBody, { marginTop: 16 * 2 }]}>
                  <Avatar.Image
                    size={80}
                    source={selectedEmploye?.photo_identite ? { uri: selectedEmploye.photo_identite } : require('../../../assets/images/default-avatar.png')}
                  />
                  <View style={{ marginLeft: 16 * 1.5, flex: 1 }}>
                    <Text style={[styles.carteName, { fontSize: 18 + 2 }]}>
                      {selectedEmploye?.nom_complet}
                    </Text>
                    <Text style={[styles.carteInfo, { fontSize: 16, marginTop: 4 }]}>
                    {selectedEmploye?.telephone}
                    </Text>
                    <Text style={[styles.carteInfo, { fontSize: 16, marginTop: 4 }]}>
                    {selectedEmploye?.numero_cni || selectedEmploye?.numero_cnss || 'N/A'}
                    </Text>
                  </View>
                </View>

                <Divider style={{ marginVertical: 16 * 1.5, backgroundColor: 'rgba(255,255,255,0.3)' }} />

                <View style={styles.carteDetails}>
                  <View style={styles.carteDetailItem}>
                    <Text style={[styles.carteLabel, { fontSize: 16 }]}>ID Employé</Text>
                    <Text style={[styles.carteValue, { fontSize: 18 }]}>
                      #{selectedEmploye?.id}
                    </Text>
                  </View>

                  <View style={styles.carteDetailItem}>
                    <Text style={[styles.carteLabel, { fontSize: 16 }]}>Type</Text>
                    <Text style={[styles.carteValue, { fontSize: 18 }]}>
                      {selectedEmploye?.type_employe}
                    </Text>
                  </View>

                  <View style={styles.carteDetailItem}>
                    <Text style={[styles.carteLabel, { fontSize: 16 }]}>Embauche</Text>
                    <Text style={[styles.carteValue, { fontSize: 18 }]}>
                      {selectedEmploye?.date_embauche}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.carteFooter, { fontSize: 16 - 2, marginTop: 16 * 2 }]}>
                  Valide jusqu'au: {new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 16 * 2 }]}>
              <Button
                mode="contained"
                onPress={handlePrintCarte}
                buttonColor="#2E86C1"
                style={{ flex: 1, marginRight: 16 / 2 }}
                icon="download"
                loading={actionInProgress === 'print_carte'}
                disabled={!!actionInProgress}
              >
                Télécharger PDF
              </Button>
              <Button
                mode="outlined"
                onPress={() => setCarteModalVisible(false)}
                style={{ flex: 1, marginLeft: 16 / 2 }}
                disabled={!!actionInProgress}
              >
                Fermer
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  // ============================================
  // GENERATE CARTE HTML
  // ============================================
  const generateCarteHTML = (employe) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 85.6mm 53.98mm; margin: 0; }
        body { 
          font-family: Arial, sans-serif; 
          padding: 10px;
          background: #f5f5f5;
        }
        .card {
          width: 85.6mm;
          height: 53.98mm;
          background: linear-gradient(135deg, #2E86C1 0%, #1A5490 100%);
          border-radius: 10px;
          padding: 15px;
          color: white;
          position: relative;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .card-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          padding-bottom: 8px;
        }
        .logo { 
          font-size: 18px; 
          font-weight: bold; 
          letter-spacing: 2px;
        }
        .subtitle {
          font-size: 9px;
          opacity: 0.8;
        }
        .card-body { 
          display: flex; 
          align-items: center; 
          margin-bottom: 12px; 
        }
        .photo { 
          width: 60px; 
          height: 60px; 
          border-radius: 50%; 
          margin-right: 12px; 
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.3);
        }
        .info { flex: 1; }
        .name { 
          font-size: 15px; 
          font-weight: bold;
          margin-bottom: 4px;
        }
        .contact-info {
          font-size: 10px;
          opacity: 0.9;
          margin-top: 2px;
        }
        .details { 
          display: grid; 
          grid-template-columns: 1fr 1fr 1fr; 
          gap: 8px; 
          font-size: 9px; 
          margin-top: 8px;
        }
        .detail-item {
          background: rgba(255,255,255,0.1);
          padding: 4px 6px;
          border-radius: 4px;
        }
        .detail-label {
          opacity: 0.7;
          font-size: 8px;
          margin-bottom: 2px;
        }
        .detail-value {
          font-weight: bold;
        }
        .footer { 
          font-size: 8px; 
          margin-top: 8px; 
          padding-top: 8px; 
          border-top: 1px solid rgba(255,255,255,0.2);
          text-align: center;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="logo">NUTRIFIX</div>
            <div class="subtitle">Employee Identification</div>
          </div>
        </div>
        <div class="card-body">
          ${employe?.photo_identite
      ? `<img src="${employe.photo_identite}" class="photo" alt="Photo">`
      : '<div class="photo" style="background: rgba(255,255,255,0.2);"></div>'}
          <div class="info">
            <div class="name">${employe?.nom_complet}</div>
            <div class="contact-info">${employe?.telephone}</div>
            <div class="contact-info">${employe?.numero_cni || employe?.numero_cnss || 'N/A'}</div>
          </div>
        </div>
        <div class="details">
          <div class="detail-item">
            <div class="detail-label">ID</div>
            <div class="detail-value">#${employe?.id}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Type</div>
            <div class="detail-value">${employe?.type_employe}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Embauche</div>
            <div class="detail-value">${employe?.date_embauche}</div>
          </div>
        </div>
        <div class="footer">
          Valide jusqu'au: ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </body>
    </html>
  `;

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <View style={styles.container}>
      {/* Loading Overlay */}
      {actionInProgress && <LoadingOverlay />}

      {/* Error Banner */}
      <ErrorBanner />

      {/* Header with Blue Background */}
      <View style={[styles.mainHeader, { paddingHorizontal: 16, paddingVertical: 16 * 1.5 }]}>
        <View>
          <Title style={[styles.headerTitle, { fontSize: 28 }]}>
            📊 Ressources Humaines
          </Title>
          <Text style={[styles.headerSubtitle, { fontSize: 16 }]}>
            Gestion complète du personnel
          </Text>
        </View>
      </View>

      {/* Navigation Tabs - NO SPACING BETWEEN HEADER AND TABS */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsContainer, { paddingHorizontal: 16 / 2 }]}
        >
          {[
            { key: 'employes', label: 'Employés', icon: 'people', count: employes.length },
            { key: 'departements', label: 'Départements', icon: 'business', count: departements.length },
            { key: 'presences', label: 'Présences', icon: 'assignment-turned-in', count: presences.length },
            { key: 'salaires', label: 'Salaires', icon: 'attach-money', count: salaires.length },
            { key: 'conges', label: 'Congés', icon: 'event', count: congesPendingCount },
            { key: 'historique', label: 'Historique', icon: 'history', count: historique.length },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.navTab,
                activeTab === tab.key && styles.activeNavTab,
                { paddingHorizontal: 16, paddingVertical: 16 }
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <MaterialIcons
                name={tab.icon}
                size={28}
                color={activeTab === tab.key ? '#2E86C1' : '#7F8C8D'}
              />
              <Text
                style={[
                  styles.navTabText,
                  activeTab === tab.key && styles.activeNavTabText,
                  { fontSize: 16, marginLeft: 16 / 2 }
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <Badge
                  size={18}
                  style={[styles.navBadge, activeTab === tab.key && styles.activeNavBadge]}
                >
                  {tab.count}
                </Badge>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={[styles.loadingText, { fontSize: 18, marginTop: 16 }]}>
            Chargement...
          </Text>
        </View>
      ) : (
        <View style={styles.contentArea}>
          {/* Filters for Employés */}
          {activeTab === 'employes' && (
            <View style={[styles.filterSection, { paddingHorizontal: 16, paddingVertical: 16 }]}>
              <Searchbar
                placeholder="Rechercher par nom, matricule, téléphone..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={[styles.searchBar, { marginBottom: 16 }]}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chip
                  selected={selectedTypeEmploye === 'all'}
                  onPress={() => setSelectedTypeEmploye('all')}
                  style={{ marginRight: 16 / 2 }}
                >
                  Tous les types
                </Chip>
                <Chip
                  selected={selectedTypeEmploye === 'INSS'}
                  onPress={() => setSelectedTypeEmploye('INSS')}
                  style={{ marginRight: 16 / 2 }}
                >
                  INSS
                </Chip>
                <Chip
                  selected={selectedTypeEmploye === 'Temps Partiel'}
                  onPress={() => setSelectedTypeEmploye('Temps Partiel')}
                  style={{ marginRight: 16 / 2 }}
                >
                  Temps Partiel
                </Chip>
                {departements.map(dept => (
                  <Chip
                    key={dept.id}
                    selected={selectedDepartement === dept.id}
                    onPress={() => setSelectedDepartement(dept.id)}
                    style={{ marginRight: 16 / 2 }}
                  >
                    {dept.nom}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Content by Tab */}
          {activeTab === 'employes' && <EmployeListView />}
          {activeTab === 'departements' && <DepartementListView />}
          {activeTab === 'presences' && <PresenceListView />}
          {activeTab === 'salaires' && <SalaireListView />}
          {activeTab === 'conges' && <CongeListView />}
          {activeTab === 'historique' && <HistoriqueListView />}
        </View>
      )}

      {/* FAB - Floating Action Button */}
      {(activeTab === 'employes' || activeTab === 'departements') && !actionInProgress && (
        <FAB
          icon="plus"
          style={[
            styles.fab,
            {
              bottom: 16 * 2,
              right: 16 * 2,
            }
          ]}
          onPress={() => {
            if (activeTab === 'employes') {
              setEmployeForm(getEmptyEmployeForm());
              setEmployeMode('add');
              setEmployeModalVisible(true);
            } else {
              setDepartementForm(getEmptyDepartementForm());
              setDepartementMode('add');
              setDepartementModalVisible(true);
            }
          }}
          color="#FFFFFF"
        />
      )}

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={activeTab === 'presences' ? selectedDatePresence : selectedMoisSalaire}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (activeTab === 'presences') {
                setSelectedDatePresence(selectedDate);
              } else {
                setSelectedMoisSalaire(selectedDate);
              }
            }
          }}
        />
      )}

      {/* Modals */}
      <EmployeModal />
      <DepartementModal />
      <CarteModal />
    </View>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  mainHeader: {
    backgroundColor: '#2E86C1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tabsContainer: {
    paddingVertical: 0,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeNavTab: {
    borderBottomColor: '#2E86C1',
  },
  navTabText: {
    color: '#7F8C8D',
    fontWeight: '500',
  },
  activeNavTabText: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },
  navBadge: {
    backgroundColor: '#E8E8E8',
    marginLeft: 6,
  },
  activeNavBadge: {
    backgroundColor: '#2E86C1',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  searchBar: {
    backgroundColor: '#F8F9FA',
    elevation: 0,
  },
  contentArea: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  datePickerText: {
    color: '#2C3E50',
    fontWeight: '600',
  },
  alertBanner: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F39C12',
  },
  alertText: {
    color: '#F39C12',
    fontWeight: 'bold',
    flex: 1,
  },

  // EMPLOYÉ CARD STYLES
  employeCard: {
    backgroundColor: '#8f8b8bff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeCardHeader: {
    alignItems: 'center',
    position: 'relative',
  },
  statusBadge: {
    position: 'absolute',
    top: 0,
    right: '30%',
    backgroundColor: '#27AE60',
  },
  employeCardBody: {
    alignItems: 'center',
  },
  employeCardName: {
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  employeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeInfoText: {
    color: '#7F8C8D',
  },
  employeTypeChip: {
    alignSelf: 'center',
  },
  employeCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  cardActionBtn: {
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },

  // DÉPARTEMENT CARD STYLES
  deptCard: {
    backgroundColor: '#9b9898ff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deptCardIcon: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EBF5FB',
    borderRadius: 8,
  },
  deptCardTitle: {
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  deptCardInfo: {
    paddingTop: 8,
  },
  deptInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptInfoText: {
    color: '#060707ff',
  },
  deptCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },

  // PRESENCE CARD STYLES
  presenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  presenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presenceStatusChip: {
    height: 24,
  },
  presenceCardName: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  presenceTimeInfo: {},
  presenceTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceTimeText: {
    color: '#7F8C8D',
  },

  // SALAIRE CARD STYLES
  salaireCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  salaireCardHeader: {
    alignItems: 'center',
    position: 'relative',
  },
  salaireStatusBadge: {
    position: 'absolute',
    top: 0,
    right: '30%',
    backgroundColor: '#F39C12',
  },
  salaireCardName: {
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  salaireInfo: {
    alignItems: 'center',
  },
  salaireLabel: {
    color: '#7F8C8D',
    marginBottom: 4,
  },
  salaireAmount: {
    fontWeight: 'bold',
    color: '#27AE60',
  },
  salaireStatusChip: {
    alignSelf: 'center',
  },

  // CONGÉ CARD STYLES
  congeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  congeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  congeCardName: {
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  congeStatusChip: {
    height: 24,
  },
  congeDateInfo: {},
  congeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  congeDateText: {
    color: '#7F8C8D',
  },
  congeActions: {
    flexDirection: 'row',
  },

  // HISTORIQUE CARD STYLES
  historiqueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historiqueIconContainer: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#EBF5FB',
    borderRadius: 8,
  },
  historiqueType: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  historiqueDetails: {
    color: '#7F8C8D',
  },
  historiqueDate: {
    color: '#95A5A6',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#BDC3C7',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#7F8C8D',
  },
  errorBanner: {
    backgroundColor: '#FADBD8',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5B7B1',
  },
  errorText: {
    color: '#E74C3C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    paddingBottom: 12,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalViewSection: {},
  viewField: {
    marginBottom: 16,
  },
  viewLabel: {
    color: '#7F8C8D',
    marginBottom: 4,
    fontWeight: '500',
  },
  viewValue: {
    color: '#2C3E50',
    fontWeight: '600',
  },
   input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16, // Ajuster si besoin
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  carte: {
    backgroundColor: '#2E86C1',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  carteHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 12,
  },
  carteTitle: {
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  carteSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  carteBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carteName: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  carteInfo: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  carteDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  carteDetailItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  carteLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  carteValue: {
    color: 'white',
    fontWeight: 'bold',
  },
  carteFooter: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    backgroundColor: '#2E86C1',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 12,
    marginBottom: 8,
  },

  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  // Amélioration du style input pour les 2 colonnes
  inputTwoColumn: {
    backgroundColor: '#FFFFFF',
    marginBottom: 0, // Pas de margin car c'est la row qui gère
  },
  // ====== STYLES MODAL EMPLOYÉ - DATE INPUTS ======
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  dateInputText: {
    color: '#2C3E50',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },

  labelText: {
    color: '#7F8C8D',
    fontWeight: '500',
    marginBottom: 8,
  },

  // ====== STYLES MODAL EMPLOYÉ - DOCUMENTS ======
  documentPreview: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  documentPreviewText: {
    flex: 1,
    color: '#2C3E50',
    marginLeft: 8,
  },

  documentIcon: {
    marginRight: 8,
  },

  documentRemoveBtn: {
    padding: 4,
  },

  // ====== STYLES MODAL EMPLOYÉ - PHOTO ======
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  photoContainer: {
    marginBottom: 12,
  },
});

export default RHPersonnelScreen;