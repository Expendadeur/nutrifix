// frontend/src/screens/admin/TraceabiliteParametresScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  Card,
  Title,
  Button,
  Searchbar,
  Chip,
  DataTable,
  Modal,
  Portal,
  TextInput,
  IconButton,
  SegmentedButtons,
  Divider,
  List,
  Avatar,
  FAB,
  ProgressBar
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireAuth } from '../../utils/authGuard';

const API_URL = 'http://localhost:5000/api/admin';

const TraceabiliteParametresScreen = ({ navigation, route }) => {

  const { user, isLoading } = requireAuth(navigation, { role: 'admin' });

  // ============================================
  // RESPONSIVE DIMENSIONS
  // ============================================
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isDesktop = screenWidth > 1024;
  const isTablet = screenWidth > 768 && screenWidth <= 1024;
  const isMobile = screenWidth <= 768;
  const isWeb = Platform.OS === 'web';

  // Calcul des dimensions adaptatives
  const cardPadding = isMobile ? 12 : isTablet ? 16 : 20;
  const fontSize = {
    title: isMobile ? 20 : isTablet ? 22 : 26,
    subtitle: isMobile ? 16 : isTablet ? 18 : 20,
    body: isMobile ? 14 : isTablet ? 15 : 16,
    small: isMobile ? 12 : isTablet ? 13 : 14
  };

  // ============================================
  // ÉTATS PRINCIPAUX
  // ============================================
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'historique');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authToken, setAuthToken] = useState(null);

  // ============================================
  // HISTORIQUE - ÉTATS
  // ============================================
  const [historique, setHistorique] = useState([]);
  const [historiqueStats, setHistoriqueStats] = useState({
    total: 0,
    critiques: 0,
    erreurs: 0,
    warnings: 0,
    infos: 0
  });
  const [historiqueFilters, setHistoriqueFilters] = useState({
    type: 'all',
    module: 'all',
    utilisateur: 'all',
    niveau: 'all',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date()
  });
  const [selectedHistorique, setSelectedHistorique] = useState(null);
  const [historiqueDetailModal, setHistoriqueDetailModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');

  // ============================================
  // UTILISATEURS - ÉTATS
  // ============================================
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [utilisateursStats, setUtilisateursStats] = useState({
    total: 0,
    actifs: 0,
    inactifs: 0,
    admins: 0
  });
  const [utilisateurFilters, setUtilisateurFilters] = useState({
    role: 'all',
    statut: 'all',
    departement: 'all'
  });
  const [selectedUtilisateur, setSelectedUtilisateur] = useState(null);
  const [utilisateurModal, setUtilisateurModal] = useState(false);
  const [utilisateurMode, setUtilisateurMode] = useState('view');
  const [utilisateurForm, setUtilisateurForm] = useState({
    matricule: '',
    email: '',
    nom_complet: '',
    telephone: '',
    mot_de_passe: '',
    type_employe: 'INSS',
    role: 'employe',
    id_departement: null,
    salaire_base: '',
    statut: 'actif',
    photo_identite: null
  });

  // ============================================
  // DÉPARTEMENTS - ÉTATS
  // ============================================
  const [departements, setDepartements] = useState([]);
  const [selectedDepartement, setSelectedDepartement] = useState(null);
  const [departementModal, setDepartementModal] = useState(false);
  const [departementMode, setDepartementMode] = useState('view');
  const [departementForm, setDepartementForm] = useState({
    nom: '',
    type: 'rh',
    budget_annuel: '',
    responsable_id: null,
    statut: 'actif'
  });

  // ============================================
  // PARAMÈTRES - ÉTATS
  // ============================================
  const [notificationSettings, setNotificationSettings] = useState({
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    alertes_stock: true,
    alertes_maintenance: true,
    alertes_echeances: true,
    alertes_salaires: true,
    alertes_conges: true,
    frequence_rapports: 'hebdomadaire'
  });

  const [generalSettings, setGeneralSettings] = useState({
    nom_entreprise: 'NUTRIFIX',
    devise: 'BIF',
    fuseau_horaire: 'Africa/Bujumbura',
    langue: 'fr',
    format_date: 'DD/MM/YYYY',
    tva_defaut: '18',
    backup_auto: true,
    frequence_backup: 'quotidien',
    retention_logs: '90'
  });

  const [systemStats, setSystemStats] = useState(null);
  const [backups, setBackups] = useState([]);

  // ============================================
  // CHARGEMENT DU TOKEN
  // ============================================
  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      setAuthToken(token);
    } catch (error) {
      console.error('Erreur chargement token:', error);
    }
  };

  // ============================================
  // CONFIGURATION AXIOS
  // ============================================
  const getAxiosConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    if (authToken) {
      loadData();
    }
  }, [activeTab, historiqueFilters, utilisateurFilters, authToken]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Vérification des autorisations...</Text>
      </View>
    );
  }

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================
  const loadData = async () => {
    if (!authToken) return;

    try {
      setLoading(true);

      switch (activeTab) {
        case 'historique':
          await loadHistorique();
          break;
        case 'utilisateurs':
          await loadUtilisateurs();
          break;
        case 'departements':
          await loadDepartements();
          break;
        case 'notifications':
          await loadNotificationSettings();
          break;
        case 'general':
          await loadGeneralSettings();
          break;
        case 'backup':
          await loadBackups();
          break;
        case 'stats':
          await loadSystemStats();
          break;
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadHistorique = async () => {
    try {
      const params = {
        type: historiqueFilters.type !== 'all' ? historiqueFilters.type : undefined,
        module: historiqueFilters.module !== 'all' ? historiqueFilters.module : undefined,
        utilisateur: historiqueFilters.utilisateur !== 'all' ? historiqueFilters.utilisateur : undefined,
        niveau: historiqueFilters.niveau !== 'all' ? historiqueFilters.niveau : undefined,
        startDate: historiqueFilters.startDate.toISOString().split('T')[0],
        endDate: historiqueFilters.endDate.toISOString().split('T')[0]
      };

      const response = await axios.get(`${API_URL}/historique`, {
        params,
        ...getAxiosConfig()
      });

      if (response.data.success) {
        setHistorique(response.data.data);
        setHistoriqueStats(response.data.stats || {});
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      throw error;
    }
  };

  const loadUtilisateurs = async () => {
    try {
      const params = {
        role: utilisateurFilters.role !== 'all' ? utilisateurFilters.role : undefined,
        statut: utilisateurFilters.statut !== 'all' ? utilisateurFilters.statut : undefined,
        departement: utilisateurFilters.departement !== 'all' ? utilisateurFilters.departement : undefined
      };

      const response = await axios.get(`${API_URL}/utilisateurs`, {
        params,
        ...getAxiosConfig()
      });

      if (response.data.success) {
        setUtilisateurs(response.data.data);
        setUtilisateursStats(response.data.stats || {});
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      throw error;
    }
  };

  const loadDepartements = async () => {
    try {
      const response = await axios.get(`${API_URL}/departements`, getAxiosConfig());
      if (response.data.success) {
        setDepartements(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement départements:', error);
      throw error;
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/notification-settings`, getAxiosConfig());
      if (response.data.success) {
        setNotificationSettings(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres notification:', error);
      throw error;
    }
  };

  const loadGeneralSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/general-settings`, getAxiosConfig());
      if (response.data.success) {
        setGeneralSettings(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres généraux:', error);
      throw error;
    }
  };

  const loadBackups = async () => {
    try {
      const response = await axios.get(`${API_URL}/backups`, getAxiosConfig());
      if (response.data.success) {
        setBackups(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement backups:', error);
      throw error;
    }
  };

  const loadSystemStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats/system`, getAxiosConfig());
      if (response.data.success) {
        setSystemStats(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement stats système:', error);
      throw error;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ============================================
  // ACTIONS UTILISATEURS
  // ============================================
  const handleAddUtilisateur = () => {
    setUtilisateurMode('add');
    setUtilisateurForm({
      matricule: '',
      email: '',
      nom_complet: '',
      telephone: '',
      mot_de_passe: '',
      type_employe: 'INSS',
      role: 'employe',
      id_departement: null,
      salaire_base: '',
      statut: 'actif',
      photo_identite: null
    });
    setUtilisateurModal(true);
  };

  const handleViewUtilisateur = async (user) => {
    try {
      setActionLoading(true);
      const response = await axios.get(`${API_URL}/utilisateurs/${user.id}`, getAxiosConfig());

      if (response.data.success) {
        setSelectedUtilisateur(response.data.data);
        setUtilisateurMode('view');
        setUtilisateurModal(true);
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUtilisateur = (user) => {
    setSelectedUtilisateur(user);
    setUtilisateurMode('edit');
    setUtilisateurForm({
      matricule: user.matricule,
      email: user.email,
      nom_complet: user.nom_complet,
      telephone: user.telephone,
      mot_de_passe: '',
      type_employe: user.type_employe,
      role: user.role,
      id_departement: user.id_departement,
      salaire_base: user.salaire_base?.toString() || '',
      statut: user.statut,
      photo_identite: user.photo_identite
    });
    setUtilisateurModal(true);
  };

  const handleSaveUtilisateur = async () => {
    try {
      if (!utilisateurForm.matricule || !utilisateurForm.email || !utilisateurForm.nom_complet) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      if (utilisateurMode === 'add' && !utilisateurForm.mot_de_passe) {
        Alert.alert('Erreur', 'Le mot de passe est obligatoire');
        return;
      }

      setActionLoading(true);

      const data = {
        ...utilisateurForm,
        salaire_base: parseFloat(utilisateurForm.salaire_base) || 0
      };

      let response;
      if (utilisateurMode === 'add') {
        response = await axios.post(`${API_URL}/utilisateurs`, data, getAxiosConfig());
        Alert.alert('Succès', 'Utilisateur créé avec succès');
      } else {
        response = await axios.put(`${API_URL}/utilisateurs/${selectedUtilisateur.id}`, data, getAxiosConfig());
        Alert.alert('Succès', 'Utilisateur modifié avec succès');
      }

      setUtilisateurModal(false);
      loadUtilisateurs();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUtilisateur = (user) => {
    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.nom_complet} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await axios.delete(`${API_URL}/utilisateurs/${user.id}`, getAxiosConfig());
              Alert.alert('Succès', 'Utilisateur supprimé');
              loadUtilisateurs();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = (user) => {
    Alert.prompt(
      'Réinitialiser Mot de Passe',
      `Nouveau mot de passe pour ${user.nom_complet}:`,
      async (newPassword) => {
        if (!newPassword || newPassword.length < 6) {
          Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
          return;
        }

        try {
          setActionLoading(true);
          await axios.put(
            `${API_URL}/utilisateurs/${user.id}/reset-password`,
            { newPassword },
            getAxiosConfig()
          );
          Alert.alert('Succès', 'Mot de passe réinitialisé avec succès');
        } catch (error) {
          Alert.alert('Erreur', error.response?.data?.message || error.message);
        } finally {
          setActionLoading(false);
        }
      },
      'secure-text'
    );
  };

  // ============================================
  // ACTIONS DÉPARTEMENTS
  // ============================================
  const handleAddDepartement = () => {
    setDepartementMode('add');
    setDepartementForm({
      nom: '',
      type: 'rh',
      budget_annuel: '',
      responsable_id: null,
      statut: 'actif'
    });
    setDepartementModal(true);
  };

  const handleEditDepartement = (dept) => {
    setSelectedDepartement(dept);
    setDepartementMode('edit');
    setDepartementForm({
      nom: dept.nom,
      type: dept.type,
      budget_annuel: dept.budget_annuel?.toString() || '',
      responsable_id: dept.responsable_id,
      statut: dept.statut
    });
    setDepartementModal(true);
  };

  const handleSaveDepartement = async () => {
    try {
      if (!departementForm.nom || !departementForm.type) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      setActionLoading(true);

      const data = {
        ...departementForm,
        budget_annuel: parseFloat(departementForm.budget_annuel) || 0
      };

      if (departementMode === 'add') {
        await axios.post(`${API_URL}/departements`, data, getAxiosConfig());
        Alert.alert('Succès', 'Département créé avec succès');
      } else {
        await axios.put(`${API_URL}/departements/${selectedDepartement.id}`, data, getAxiosConfig());
        Alert.alert('Succès', 'Département modifié avec succès');
      }

      setDepartementModal(false);
      loadDepartements();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDepartement = (dept) => {
    Alert.alert(
      'Confirmation',
      `Êtes-vous sûr de vouloir supprimer le département ${dept.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await axios.delete(`${API_URL}/departements/${dept.id}`, getAxiosConfig());
              Alert.alert('Succès', 'Département supprimé');
              loadDepartements();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // ACTIONS PARAMÈTRES
  // ============================================
  const handleSaveNotificationSettings = async () => {
    try {
      setActionLoading(true);
      await axios.put(`${API_URL}/notification-settings`, notificationSettings, getAxiosConfig());
      Alert.alert('Succès', 'Paramètres de notification sauvegardés');
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveGeneralSettings = async () => {
    try {
      setActionLoading(true);
      await axios.put(`${API_URL}/general-settings`, generalSettings, getAxiosConfig());
      Alert.alert('Succès', 'Paramètres généraux sauvegardés');
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================
  // ACTIONS BACKUP
  // ============================================
  const handleCreateBackup = () => {
    Alert.alert(
      'Sauvegarde',
      'Créer une sauvegarde complète de la base de données ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setActionLoading(true);
              const response = await axios.post(`${API_URL}/backup`, {}, getAxiosConfig());
              if (response.data.success) {
                Alert.alert('Succès', `Sauvegarde créée: ${response.data.data.filename}`);
                loadBackups();
              }
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteBackup = (backup) => {
    Alert.alert(
      'Confirmation',
      `Supprimer la sauvegarde ${backup.filename} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await axios.delete(`${API_URL}/backups/${backup.filename}`, getAxiosConfig());
              Alert.alert('Succès', 'Sauvegarde supprimée');
              loadBackups();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // HELPERS & UTILITAIRES
  // ============================================
  const getActionColor = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('création') || actionLower.includes('ajout')) return '#27AE60';
    if (actionLower.includes('modification') || actionLower.includes('mise à jour')) return '#F39C12';
    if (actionLower.includes('suppression')) return '#E74C3C';
    if (actionLower.includes('consultation') || actionLower.includes('lecture')) return '#3498DB';
    return '#95A5A6';
  };

  const getActionIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('création') || actionLower.includes('ajout')) return 'add-circle';
    if (actionLower.includes('modification') || actionLower.includes('mise à jour')) return 'edit';
    if (actionLower.includes('suppression')) return 'delete';
    if (actionLower.includes('consultation') || actionLower.includes('lecture')) return 'visibility';
    return 'history';
  };

  const getNiveauColor = (niveau) => {
    switch (niveau) {
      case 'critical': return '#E74C3C';
      case 'error': return '#E67E22';
      case 'warning': return '#F39C12';
      case 'info': return '#3498DB';
      default: return '#95A5A6';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#E74C3C';
      case 'comptable': return '#3498DB';
      case 'manager': return '#F39C12';
      case 'veterinaire': return '#9B59B6';
      case 'chauffeur': return '#1ABC9C';
      case 'agriculteur': return '#27AE60';
      case 'technicien': return '#34495E';
      case 'employe': return '#95A5A6';
      default: return '#BDC3C7';
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'actif': return '#27AE60';
      case 'inactif': return '#E74C3C';
      case 'congé': return '#F39C12';
      case 'suspendu': return '#E67E22';
      default: return '#95A5A6';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // ============================================
  // COMPOSANTS DE RENDU
  // ============================================

  // -------------------- LOADING OVERLAY --------------------
  const LoadingOverlay = () => (
    actionLoading && (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
            Chargement...
          </Text>
        </View>
      </View>
    )
  );

  // -------------------- HISTORIQUE --------------------
  const renderHistoriqueItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.historiqueItem,
        { padding: cardPadding, marginBottom: 12 }
      ]}
      onPress={() => {
        setSelectedHistorique(item);
        setHistoriqueDetailModal(true);
      }}
    >
      <View style={styles.historiqueLeft}>
        <View style={[
          styles.historiqueIcon,
          {
            backgroundColor: getActionColor(item.type_action) + '20',
            width: isMobile ? 42 : 50,
            height: isMobile ? 42 : 50,
            borderRadius: isMobile ? 21 : 25
          }
        ]}>
          <MaterialIcons
            name={getActionIcon(item.type_action)}
            size={isMobile ? 20 : 24}
            color={getActionColor(item.type_action)}
          />
        </View>
        <View style={styles.historiqueInfo}>
          <Text style={[styles.historiqueAction, { fontSize: fontSize.body, fontWeight: '700' }]}>
            {item.type_action}
          </Text>
          <Text style={[styles.historiqueDescription, { fontSize: fontSize.small, marginTop: 4 }]} numberOfLines={2}>
            {item.action_details}
          </Text>
          <View style={styles.historiqueMeta}>
            <Chip
              mode="flat"
              style={[styles.historiqueModuleChip, { height: isMobile ? 24 : 28 }]}
              textStyle={{ fontSize: fontSize.small, fontWeight: '600' }}
            >
              {item.module}
            </Chip>
            {item.niveau && (
              <Chip
                mode="flat"
                style={[
                  styles.niveauChip,
                  {
                    backgroundColor: getNiveauColor(item.niveau) + '20',
                    height: isMobile ? 24 : 28
                  }
                ]}
                textStyle={{
                  fontSize: fontSize.small,
                  color: getNiveauColor(item.niveau),
                  fontWeight: '600'
                }}
              >
                {item.niveau}
              </Chip>
            )}
            <Text style={[styles.historiqueDate, { fontSize: fontSize.small }]}>
              {new Date(item.date_action).toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <Text style={[styles.historiqueUtilisateur, { fontSize: fontSize.small, marginTop: 4 }]}>
            Par: {item.utilisateur_nom} ({item.utilisateur_role})
          </Text>
        </View>
      </View>
      <IconButton icon="chevron-right" size={24} iconColor="#BDC3C7" />
    </TouchableOpacity>
  );

  const renderHistoriqueTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques Rapides */}
      <View style={[
        styles.statsContainer,
        isMobile && styles.statsContainerMobile,
        { padding: cardPadding, gap: 12 }
      ]}>
        <Card style={[styles.statCard, { borderLeftColor: '#3498DB', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {historiqueStats.total || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
              Total Actions
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#E74C3C', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, styles.statValueDanger, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {historiqueStats.critiques || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
              Critiques
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#F39C12', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, styles.statValueWarning, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {historiqueStats.warnings || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
              Warnings
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Filtres */}
      <Card style={[styles.filterCard, { margin: cardPadding, marginTop: 16 }]}>
        <Card.Content style={{ padding: cardPadding }}>
          <Title style={[styles.filterTitle, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
            Filtres
          </Title>

          {/* Type d'action */}
          <View style={[styles.filterGroup, { marginTop: 12 }]}>
            <Text style={[styles.filterLabel, { fontSize: fontSize.body, marginBottom: 8 }]}>
              Type d'Action
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'création', 'modification', 'suppression', 'consultation'].map(type => (
                <Chip
                  key={type}
                  selected={historiqueFilters.type === type}
                  onPress={() => setHistoriqueFilters({ ...historiqueFilters, type })}
                  style={[styles.filterChip, { height: isMobile ? 32 : 36 }]}
                  textStyle={{ fontSize: fontSize.small }}
                >
                  {type === 'all' ? 'Tous' : type}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Module */}
          <View style={[styles.filterGroup, { marginTop: 16 }]}>
            <Text style={[styles.filterLabel, { fontSize: fontSize.body, marginBottom: 8 }]}>
              Module
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'rh', 'flotte', 'agriculture', 'elevage', 'commercial', 'finance', 'parametres'].map(mod => (
                <Chip
                  key={mod}
                  selected={historiqueFilters.module === mod}
                  onPress={() => setHistoriqueFilters({ ...historiqueFilters, module: mod })}
                  style={[styles.filterChip, { height: isMobile ? 32 : 36 }]}
                  textStyle={{ fontSize: fontSize.small }}
                >
                  {mod === 'all' ? 'Tous' : mod.toUpperCase()}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Niveau */}
          <View style={[styles.filterGroup, { marginTop: 16 }]}>
            <Text style={[styles.filterLabel, { fontSize: fontSize.body, marginBottom: 8 }]}>
              Niveau
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'info', 'warning', 'error', 'critical'].map(niv => (
                <Chip
                  key={niv}
                  selected={historiqueFilters.niveau === niv}
                  onPress={() => setHistoriqueFilters({ ...historiqueFilters, niveau: niv })}
                  style={[styles.filterChip, { height: isMobile ? 32 : 36 }]}
                  textStyle={{ fontSize: fontSize.small }}
                >
                  {niv === 'all' ? 'Tous' : niv}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Période */}
          <View style={[styles.periodFilter, isMobile && styles.periodFilterMobile, { marginTop: 16 }]}>
            <TouchableOpacity
              style={[styles.dateButton, { padding: isMobile ? 10 : 12 }]}
              onPress={() => {
                setDatePickerField('start');
                setShowDatePicker(true);
              }}
            >
              <MaterialIcons name="calendar-today" size={18} color="#2E86C1" />
              <Text style={[styles.dateButtonText, { fontSize: fontSize.small }]}>
                {historiqueFilters.startDate.toLocaleDateString('fr-FR')}
              </Text>
            </TouchableOpacity>

            <MaterialIcons name="arrow-forward" size={18} color="#7F8C8D" style={styles.dateArrow} />

            <TouchableOpacity
              style={[styles.dateButton, { padding: isMobile ? 10 : 12 }]}
              onPress={() => {
                setDatePickerField('end');
                setShowDatePicker(true);
              }}
            >
              <MaterialIcons name="calendar-today" size={18} color="#2E86C1" />
              <Text style={[styles.dateButtonText, { fontSize: fontSize.small }]}>
                {historiqueFilters.endDate.toLocaleDateString('fr-FR')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>

      {/* Barre de recherche */}
      <Searchbar
        placeholder="Rechercher dans l'historique..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchBar, { marginHorizontal: cardPadding, marginTop: 16, marginBottom: 8 }]}
        inputStyle={{ fontSize: fontSize.body }}
      />

      {/* Liste avec espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <FlatList
          data={historique}
          renderItem={renderHistoriqueItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: cardPadding, paddingTop: 0 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={isMobile ? 60 : 70} color="#BDC3C7" />
              <Text style={[styles.emptyText, { fontSize: fontSize.body, marginTop: 12 }]}>
                Aucune activité enregistrée
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>
    </View>
  );

  // -------------------- UTILISATEURS --------------------
  const renderUtilisateurItem = ({ item }) => (
    <Card style={[styles.utilisateurCard, { marginBottom: 12 }]}>
      <Card.Content style={{ padding: cardPadding }}>
        <View style={styles.utilisateurHeader}>
          <View style={styles.utilisateurLeft}>
            <Avatar.Text
              size={isMobile ? 48 : isTablet ? 56 : 64}
              label={item.nom_complet.split(' ').map(n => n[0]).join('').substring(0, 2)}
              style={{ backgroundColor: getRoleColor(item.role) }}
              labelStyle={{ fontSize: fontSize.body, fontWeight: '700' }}
            />
            <View style={styles.utilisateurInfo}>
              <Text style={[styles.utilisateurNom, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
                {item.nom_complet}
              </Text>
              <Text style={[styles.utilisateurEmail, { fontSize: fontSize.small, marginTop: 4 }]}>
                {item.email}
              </Text>
              <View style={styles.utilisateurTags}>
                <Chip
                  mode="flat"
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: getRoleColor(item.role) + '20',
                      height: isMobile ? 26 : 30
                    }
                  ]}
                  textStyle={[styles.chipText, { color: getRoleColor(item.role), fontSize: fontSize.small, fontWeight: '600' }]}
                >
                  {item.role}
                </Chip>
                <Chip
                  mode="flat"
                  style={[
                    styles.statutChip,
                    {
                      backgroundColor: getStatutColor(item.statut) + '20',
                      height: isMobile ? 26 : 30,
                      marginLeft: 6
                    }
                  ]}
                  textStyle={[styles.chipText, { color: getStatutColor(item.statut), fontSize: fontSize.small, fontWeight: '600' }]}
                >
                  {item.statut}
                </Chip>
              </View>
            </View>
          </View>
        </View>

        <Divider style={[styles.divider, { marginVertical: 12 }]} />

        <View style={styles.utilisateurDetails}>
          <View style={[styles.detailRow, { marginBottom: 8 }]}>
            <MaterialIcons name="badge" size={18} color="#7F8C8D" />
            <Text style={[styles.detailText, { fontSize: fontSize.small }]}>
              {item.matricule}
            </Text>
          </View>
          <View style={[styles.detailRow, { marginBottom: 8 }]}>
            <MaterialIcons name="phone" size={18} color="#7F8C8D" />
            <Text style={[styles.detailText, { fontSize: fontSize.small }]}>
              {item.telephone}
            </Text>
          </View>
          <View style={[styles.detailRow, { marginBottom: 8 }]}>
            <MaterialIcons name="business" size={18} color="#7F8C8D" />
            <Text style={[styles.detailText, { fontSize: fontSize.small }]}>
              {item.departement_nom || 'N/A'}
            </Text>
          </View>
          {item.nb_actions && (
            <View style={styles.detailRow}>
              <MaterialIcons name="trending-up" size={18} color="#7F8C8D" />
              <Text style={[styles.detailText, { fontSize: fontSize.small }]}>
                {item.nb_actions} actions
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.utilisateurActions, isMobile && styles.actionsMobile]}>
          <Button
            mode="outlined"
            onPress={() => handleViewUtilisateur(item)}
            style={styles.actionButton}
            textColor="#3498DB"
            icon="eye"
            compact={isMobile}
            labelStyle={{ fontSize: fontSize.small }}
          >
            Voir
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleResetPassword(item)}
            style={styles.actionButton}
            textColor="#F39C12"
            icon="lock-reset"
            compact={isMobile}
            labelStyle={{ fontSize: fontSize.small }}
          >
            MDP
          </Button>
          <IconButton
            icon="pencil"
            size={22}
            iconColor="#3498DB"
            onPress={() => handleEditUtilisateur(item)}
          />
          <IconButton
            icon="delete"
            size={22}
            iconColor="#E74C3C"
            onPress={() => handleDeleteUtilisateur(item)}
          />
        </View>
      </Card.Content>
    </Card>
  );

  const renderUtilisateursTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques */}
      <View style={[
        styles.statsContainer,
        isMobile && styles.statsContainerMobile,
        { padding: cardPadding, gap: 12 }
      ]}>
        <Card style={[styles.statCard, { borderLeftColor: '#3498DB', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {utilisateursStats.total || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>Total</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#27AE60', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, styles.statValueSuccess, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {utilisateursStats.actifs || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>Actifs</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#E74C3C', borderLeftWidth: 4 }]}>
          <Card.Content style={{ padding: isMobile ? 12 : 16 }}>
            <Text style={[styles.statValue, styles.statValueDanger, { fontSize: fontSize.title, fontWeight: '800' }]}>
              {utilisateursStats.admins || 0}
            </Text>
            <Text style={[styles.statLabel, { fontSize: fontSize.small, marginTop: 6 }]}>Admins</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Filtres */}
      <View style={[styles.filterRow, { paddingHorizontal: cardPadding, marginTop: 16 }]}>
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { fontSize: fontSize.body, marginBottom: 8 }]}>Rôle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'admin', 'manager', 'comptable', 'employe'].map(role => (
              <Chip
                key={role}
                selected={utilisateurFilters.role === role}
                onPress={() => setUtilisateurFilters({ ...utilisateurFilters, role })}
                style={[styles.filterChip, { height: isMobile ? 32 : 36 }]}
                textStyle={{ fontSize: fontSize.small }}
              >
                {role === 'all' ? 'Tous' : role}
              </Chip>
            ))}
          </ScrollView>
        </View>
      </View>

      <Searchbar
        placeholder="Rechercher un utilisateur..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchBar, { marginHorizontal: cardPadding, marginTop: 16, marginBottom: 8 }]}
        inputStyle={{ fontSize: fontSize.body }}
      />

      {/* Liste avec espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <FlatList
          data={utilisateurs}
          renderItem={renderUtilisateurItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: cardPadding, paddingTop: 0 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="people" size={isMobile ? 60 : 70} color="#BDC3C7" />
              <Text style={[styles.emptyText, { fontSize: fontSize.body, marginTop: 12 }]}>
                Aucun utilisateur
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>
    </View>
  );

  // -------------------- DÉPARTEMENTS --------------------
  const renderDepartementItem = ({ item }) => (
    <Card style={[styles.departementCard, { marginBottom: 12 }]}>
      <Card.Content style={{ padding: cardPadding }}>
        <View style={styles.departementHeader}>
          <View style={styles.departementLeft}>
            <View style={[
              styles.departementIcon,
              {
                width: isMobile ? 52 : 60,
                height: isMobile ? 52 : 60,
                borderRadius: isMobile ? 26 : 30
              }
            ]}>
              <MaterialIcons name="business" size={isMobile ? 28 : 32} color="#2E86C1" />
            </View>
            <View style={styles.departementInfo}>
              <Title style={[styles.departementName, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
                {item.nom}
              </Title>
              <Text style={[styles.departementType, { fontSize: fontSize.small, marginTop: 4 }]}>
                {item.type}
              </Text>
            </View>
          </View>
          <View style={styles.departementActions}>
            <IconButton
              icon="pencil"
              size={22}
              iconColor="#3498DB"
              onPress={() => handleEditDepartement(item)}
            />
            <IconButton
              icon="delete"
              size={22}
              iconColor="#E74C3C"
              onPress={() => handleDeleteDepartement(item)}
            />
          </View>
        </View>

        <Divider style={[styles.divider, { marginVertical: 12 }]} />

        <View style={[styles.departementStats, isMobile && styles.departementStatsMobile]}>
          <View style={styles.statItem}>
            <MaterialIcons name="people" size={22} color="#7F8C8D" />
            <Text style={[styles.statItemValue, { fontSize: fontSize.body, fontWeight: '700', marginTop: 6 }]}>
              {item.nombre_employes || 0}
            </Text>
            <Text style={[styles.statItemLabel, { fontSize: fontSize.small, marginTop: 2 }]}>
              Employés
            </Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="attach-money" size={22} color="#7F8C8D" />
            <Text style={[styles.statItemValue, { fontSize: fontSize.body, fontWeight: '700', marginTop: 6 }]}>
              {parseFloat(item.budget_annuel || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statItemLabel, { fontSize: fontSize.small, marginTop: 2 }]}>
              Budget
            </Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="person" size={22} color="#7F8C8D" />
            <Text style={[styles.statItemValue, { fontSize: fontSize.small, marginTop: 6 }]} numberOfLines={1}>
              {item.responsable_nom || 'N/A'}
            </Text>
            <Text style={[styles.statItemLabel, { fontSize: fontSize.small, marginTop: 2 }]}>
              Responsable
            </Text>
          </View>
        </View>

        {item.budget_utilise && (
          <View style={[styles.budgetProgress, { marginTop: 12 }]}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.budgetLabel, { fontSize: fontSize.small }]}>
                Budget Utilisé
              </Text>
              <Text style={[styles.budgetPercentage, { fontSize: fontSize.small, fontWeight: '700' }]}>
                {((item.budget_utilise / item.budget_annuel) * 100).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={item.budget_utilise / item.budget_annuel}
              color="#3498DB"
              style={[styles.progressBar, { marginTop: 6 }]}
            />
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderDepartementsTab = () => (
    <View style={styles.tabContent}>
      {/* Espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <FlatList
          data={departements}
          renderItem={renderDepartementItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: cardPadding, paddingTop: 0 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="business" size={isMobile ? 60 : 70} color="#BDC3C7" />
              <Text style={[styles.emptyText, { fontSize: fontSize.body, marginTop: 12 }]}>
                Aucun département
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>
    </View>
  );

  // -------------------- NOTIFICATIONS --------------------
  const renderNotificationsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <Card style={[styles.settingsCard, { marginHorizontal: cardPadding, marginBottom: cardPadding }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Title style={[styles.settingsTitle, { fontSize: fontSize.subtitle, fontWeight: '700', marginBottom: 16 }]}>
              Paramètres de Notification
            </Title>

            <List.Section>
              <List.Subheader style={{ fontSize: fontSize.body, fontWeight: '600' }}>
                Canaux de Communication
              </List.Subheader>

              <List.Item
                title="Notifications Email"
                titleStyle={{ fontSize: fontSize.body }}
                description="Recevoir des alertes par email"
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="email" color="#3498DB" />}
                right={() => (
                  <Switch
                    value={notificationSettings.email_enabled}
                    onValueChange={(value) =>
                      setNotificationSettings({ ...notificationSettings, email_enabled: value })
                    }
                    trackColor={{ false: '#BDC3C7', true: '#27AE60' }}
                    thumbColor={notificationSettings.email_enabled ? '#FFFFFF' : '#ECEFF1'}
                  />
                )}
              />

              <List.Item
                title="Notifications SMS"
                titleStyle={{ fontSize: fontSize.body }}
                description="Recevoir des alertes par SMS"
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="message" color="#3498DB" />}
                right={() => (
                  <Switch
                    value={notificationSettings.sms_enabled}
                    onValueChange={(value) =>
                      setNotificationSettings({ ...notificationSettings, sms_enabled: value })
                    }
                    trackColor={{ false: '#BDC3C7', true: '#27AE60' }}
                    thumbColor={notificationSettings.sms_enabled ? '#FFFFFF' : '#ECEFF1'}
                  />
                )}
              />

              <List.Item
                title="Notifications Push"
                titleStyle={{ fontSize: fontSize.body }}
                description="Recevoir des notifications sur l'application"
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="notifications" color="#3498DB" />}
                right={() => (
                  <Switch
                    value={notificationSettings.push_enabled}
                    onValueChange={(value) =>
                      setNotificationSettings({ ...notificationSettings, push_enabled: value })
                    }
                    trackColor={{ false: '#BDC3C7', true: '#27AE60' }}
                    thumbColor={notificationSettings.push_enabled ? '#FFFFFF' : '#ECEFF1'}
                  />
                )}
              />
            </List.Section>

            <Divider style={[styles.divider, { marginVertical: 16 }]} />

            <List.Section>
              <List.Subheader style={{ fontSize: fontSize.body, fontWeight: '600' }}>
                Types d'Alertes
              </List.Subheader>

              {[
                { key: 'alertes_stock', title: 'Alertes Stock', desc: 'Notifications pour stock faible', icon: 'inventory' },
                { key: 'alertes_maintenance', title: 'Alertes Maintenance', desc: 'Rappels maintenance véhicules', icon: 'build' },
                { key: 'alertes_echeances', title: 'Alertes Échéances', desc: 'Rappels paiements et factures', icon: 'event' },
                { key: 'alertes_salaires', title: 'Alertes Salaires', desc: 'Rappels calcul salaires', icon: 'attach-money' },
                { key: 'alertes_conges', title: 'Alertes Congés', desc: 'Demandes de congés en attente', icon: 'beach-access' },
              ].map(alerte => (
                <List.Item
                  key={alerte.key}
                  title={alerte.title}
                  titleStyle={{ fontSize: fontSize.body }}
                  description={alerte.desc}
                  descriptionStyle={{ fontSize: fontSize.small }}
                  left={props => <List.Icon {...props} icon={alerte.icon} />}
                  right={() => (
                    <Switch
                      value={notificationSettings[alerte.key]}
                      onValueChange={(value) =>
                        setNotificationSettings({ ...notificationSettings, [alerte.key]: value })
                      }
                      trackColor={{ false: '#BDC3C7', true: '#27AE60' }}
                      thumbColor={notificationSettings[alerte.key] ? '#FFFFFF' : '#ECEFF1'}
                    />
                  )}
                />
              ))}
            </List.Section>

            <Divider style={[styles.divider, { marginVertical: 16 }]} />

            <View style={styles.settingsGroup}>
              <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>
                Fréquence des Rapports
              </Text>
              <SegmentedButtons
                value={notificationSettings.frequence_rapports}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, frequence_rapports: value })
                }
                buttons={[
                  { value: 'quotidien', label: 'Quotidien', style: { minWidth: isMobile ? 80 : 100 } },
                  { value: 'hebdomadaire', label: 'Hebdo', style: { minWidth: isMobile ? 80 : 100 } },
                  { value: 'mensuel', label: 'Mensuel', style: { minWidth: isMobile ? 80 : 100 } },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSaveNotificationSettings}
              buttonColor="#27AE60"
              style={[styles.saveButton, { marginTop: 20 }]}
              loading={actionLoading}
              disabled={actionLoading}
              labelStyle={{ fontSize: fontSize.body }}
            >
              Sauvegarder les Paramètres
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );

  // -------------------- PARAMÈTRES GÉNÉRAUX --------------------
  const renderGeneralTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <Card style={[styles.settingsCard, { marginHorizontal: cardPadding, marginBottom: cardPadding }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Title style={[styles.settingsTitle, { fontSize: fontSize.subtitle, fontWeight: '700', marginBottom: 16 }]}>
              Paramètres Généraux
            </Title>

            <TextInput
              label="Nom de l'Entreprise"
              value={generalSettings.nom_entreprise}
              onChangeText={(text) => setGeneralSettings({ ...generalSettings, nom_entreprise: text })}
              style={styles.input}
              mode="outlined"
            />

            <View style={[styles.settingsGroup, { marginTop: 12 }]}>
              <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>Devise</Text>
              <SegmentedButtons
                value={generalSettings.devise}
                onValueChange={(value) => setGeneralSettings({ ...generalSettings, devise: value })}
                buttons={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'BIF', label: 'BIF (FBu)' },
                  { value: 'EUR', label: 'EUR (€)' },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            <TextInput
              label="TVA par Défaut (%)"
              value={generalSettings.tva_defaut}
              onChangeText={(text) => setGeneralSettings({ ...generalSettings, tva_defaut: text })}
              style={[styles.input, { marginTop: 12 }]}
              mode="outlined"
              keyboardType="decimal-pad"
            />

            <TextInput
              label="Fuseau Horaire"
              value={generalSettings.fuseau_horaire}
              onChangeText={(text) => setGeneralSettings({ ...generalSettings, fuseau_horaire: text })}
              style={styles.input}
              mode="outlined"
            />

            <Divider style={[styles.divider, { marginVertical: 16 }]} />

            <List.Item
              title="Sauvegarde Automatique"
              titleStyle={{ fontSize: fontSize.body }}
              description="Créer des sauvegardes automatiques de la base"
              descriptionStyle={{ fontSize: fontSize.small }}
              left={props => <List.Icon {...props} icon="backup" color="#3498DB" />}
              right={() => (
                <Switch
                  value={generalSettings.backup_auto}
                  onValueChange={(value) => setGeneralSettings({ ...generalSettings, backup_auto: value })}
                  trackColor={{ false: '#BDC3C7', true: '#27AE60' }}
                  thumbColor={generalSettings.backup_auto ? '#FFFFFF' : '#ECEFF1'}
                />
              )}
            />

            {generalSettings.backup_auto && (
              <View style={[styles.settingsGroup, { marginTop: 12 }]}>
                <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>
                  Fréquence de Sauvegarde
                </Text>
                <SegmentedButtons
                  value={generalSettings.frequence_backup}
                  onValueChange={(value) => setGeneralSettings({ ...generalSettings, frequence_backup: value })}
                  buttons={[
                    { value: 'quotidien', label: 'Quotidien' },
                    { value: 'hebdomadaire', label: 'Hebdo' },
                    { value: 'mensuel', label: 'Mensuel' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>
            )}

            <TextInput
              label="Rétention des Logs (jours)"
              value={generalSettings.retention_logs}
              onChangeText={(text) => setGeneralSettings({ ...generalSettings, retention_logs: text })}
              style={[styles.input, { marginTop: 12 }]}
              mode="outlined"
              keyboardType="numeric"
              helperText="Nombre de jours de conservation des logs d'activité"
            />

            <Button
              mode="contained"
              onPress={handleSaveGeneralSettings}
              buttonColor="#27AE60"
              style={[styles.saveButton, { marginTop: 20 }]}
              loading={actionLoading}
              disabled={actionLoading}
              labelStyle={{ fontSize: fontSize.body }}
            >
              Sauvegarder les Paramètres
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );

  // -------------------- BACKUP --------------------
  const renderBackupTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        <Card style={[styles.settingsCard, { marginHorizontal: cardPadding, marginBottom: cardPadding }]}>
          <Card.Content style={{ padding: cardPadding }}>
            <Title style={[styles.settingsTitle, { fontSize: fontSize.subtitle, fontWeight: '700', marginBottom: 16 }]}>
              Gestion des Sauvegardes
            </Title>

            <View style={styles.backupHeader}>
              <Button
                mode="contained"
                onPress={handleCreateBackup}
                icon="backup"
                buttonColor="#3498DB"
                style={styles.createBackupButton}
                loading={actionLoading}
                disabled={actionLoading}
                labelStyle={{ fontSize: fontSize.body }}
              >
                Créer une Sauvegarde
              </Button>
            </View>

            <Divider style={[styles.divider, { marginVertical: 16 }]} />

            <List.Section>
              <List.Subheader style={{ fontSize: fontSize.body, fontWeight: '600' }}>
                Sauvegardes Disponibles ({backups.length})
              </List.Subheader>

              {backups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="backup" size={isMobile ? 60 : 70} color="#BDC3C7" />
                  <Text style={[styles.emptyText, { fontSize: fontSize.body, marginTop: 12 }]}>
                    Aucune sauvegarde disponible
                  </Text>
                </View>
              ) : (
                backups.map((backup, index) => (
                  <List.Item
                    key={index}
                    title={backup.filename}
                    titleStyle={{ fontSize: fontSize.body }}
                    description={`${formatBytes(backup.size)} • ${new Date(backup.date).toLocaleString('fr-FR')}`}
                    descriptionStyle={{ fontSize: fontSize.small }}
                    left={props => <List.Icon {...props} icon="file-document" color="#3498DB" />}
                    right={props => (
                      <IconButton
                        icon="delete"
                        iconColor="#E74C3C"
                        size={22}
                        onPress={() => handleDeleteBackup(backup)}
                      />
                    )}
                  />
                ))
              )}
            </List.Section>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );

  // -------------------- STATISTIQUES --------------------
  const renderStatsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Espacement de 16px avant le contenu */}
      <View style={{ marginTop: 16 }}>
        {systemStats && (
          <>
            <Card style={[styles.settingsCard, { marginHorizontal: cardPadding, marginBottom: 16 }]}>
              <Card.Content style={{ padding: cardPadding }}>
                <Title style={[styles.settingsTitle, { fontSize: fontSize.subtitle, fontWeight: '700', marginBottom: 16 }]}>
                  Statistiques Utilisateurs
                </Title>

                <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, { fontSize: fontSize.title, fontWeight: '800' }]}>
                      {systemStats.users?.total || 0}
                    </Text>
                    <Text style={[styles.statBoxLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
                      Total Utilisateurs
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, styles.statValueSuccess, { fontSize: fontSize.title, fontWeight: '800' }]}>
                      {systemStats.users?.actifs || 0}
                    </Text>
                    <Text style={[styles.statBoxLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
                      Actifs
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statBoxValue, { fontSize: fontSize.title, fontWeight: '800' }]}>
                      {systemStats.users?.actifs_7j || 0}
                    </Text>
                    <Text style={[styles.statBoxLabel, { fontSize: fontSize.small, marginTop: 6 }]}>
                      Actifs 7 jours
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            <Card style={[styles.settingsCard, { marginHorizontal: cardPadding, marginBottom: cardPadding }]}>
              <Card.Content style={{ padding: cardPadding }}>
                <Title style={[styles.settingsTitle, { fontSize: fontSize.subtitle, fontWeight: '700', marginBottom: 16 }]}>
                  Statistiques Base de Données
                </Title>

                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title textStyle={{ fontSize: fontSize.body, fontWeight: '700' }}>Table</DataTable.Title>
                    <DataTable.Title numeric textStyle={{ fontSize: fontSize.body, fontWeight: '700' }}>Lignes</DataTable.Title>
                    <DataTable.Title numeric textStyle={{ fontSize: fontSize.body, fontWeight: '700' }}>Taille</DataTable.Title>
                  </DataTable.Header>

                  {systemStats.database?.slice(0, 10).map((table, index) => (
                    <DataTable.Row key={index}>
                      <DataTable.Cell textStyle={{ fontSize: fontSize.small }}>{table.table_name}</DataTable.Cell>
                      <DataTable.Cell numeric textStyle={{ fontSize: fontSize.small }}>{table.table_rows}</DataTable.Cell>
                      <DataTable.Cell numeric textStyle={{ fontSize: fontSize.small }}>{table.size_mb} MB</DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </Card.Content>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );

  // ============================================
  // MODALS
  // ============================================

  // Modal Utilisateur
  const renderUtilisateurModal = () => (
    <Portal>
      <Modal
        visible={utilisateurModal}
        onDismiss={() => setUtilisateurModal(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isMobile && styles.modalContainerMobile,
          isWeb && isDesktop && styles.modalContainerWeb
        ]}
      >
        <ScrollView style={styles.modalScrollView}>
          <View style={[styles.modalHeader, { padding: cardPadding }]}>
            <Title style={[styles.modalTitle, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
              {utilisateurMode === 'add' ? 'Nouvel Utilisateur' :
                utilisateurMode === 'edit' ? 'Modifier Utilisateur' : 'Détails Utilisateur'}
            </Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setUtilisateurModal(false)}
            />
          </View>

          {utilisateurMode === 'view' && selectedUtilisateur ? (
            // Mode Visualisation
            <View style={[styles.modalContent, { padding: cardPadding }]}>
              <View style={styles.viewHeader}>
                <Avatar.Text
                  size={isMobile ? 70 : 90}
                  label={selectedUtilisateur.nom_complet.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  style={{ backgroundColor: getRoleColor(selectedUtilisateur.role) }}
                  labelStyle={{ fontSize: fontSize.body, fontWeight: '700' }}
                />
                <View style={styles.viewInfo}>
                  <Title style={{ fontSize: fontSize.subtitle, fontWeight: '700' }}>
                    {selectedUtilisateur.nom_complet}
                  </Title>
                  <Text style={[styles.viewEmail, { fontSize: fontSize.small, marginTop: 4 }]}>
                    {selectedUtilisateur.email}
                  </Text>
                  <View style={[styles.viewTags, { marginTop: 8 }]}>
                    <Chip
                      mode="flat"
                      style={[
                        styles.roleChip,
                        {
                          backgroundColor: getRoleColor(selectedUtilisateur.role) + '20',
                          height: isMobile ? 26 : 30
                        }
                      ]}
                      textStyle={[styles.chipText, { color: getRoleColor(selectedUtilisateur.role), fontSize: fontSize.small, fontWeight: '600' }]}
                    >
                      {selectedUtilisateur.role}
                    </Chip>
                    <Chip
                      mode="flat"
                      style={[
                        styles.statutChip,
                        {
                          backgroundColor: getStatutColor(selectedUtilisateur.statut) + '20',
                          height: isMobile ? 26 : 30,
                          marginLeft: 6
                        }
                      ]}
                      textStyle={[styles.chipText, { color: getStatutColor(selectedUtilisateur.statut), fontSize: fontSize.small, fontWeight: '600' }]}
                    >
                      {selectedUtilisateur.statut}
                    </Chip>
                  </View>
                </View>
              </View>

              <Divider style={[styles.divider, { marginVertical: 16 }]} />

              <View style={styles.viewDetails}>
                {[
                  { icon: 'badge', title: 'Matricule', value: selectedUtilisateur.matricule },
                  { icon: 'phone', title: 'Téléphone', value: selectedUtilisateur.telephone },
                  { icon: 'business', title: 'Département', value: selectedUtilisateur.departement_nom || 'N/A' },
                  { icon: 'work', title: 'Type d\'Employé', value: selectedUtilisateur.type_employe },
                  { icon: 'calendar-today', title: 'Date d\'Embauche', value: new Date(selectedUtilisateur.date_embauche).toLocaleDateString('fr-FR') },
                  { icon: 'attach-money', title: 'Salaire de Base', value: `${parseFloat(selectedUtilisateur.salaire_base || 0).toLocaleString()} ${generalSettings.devise}` },
                ].map((item, index) => (
                  <List.Item
                    key={index}
                    title={item.title}
                    titleStyle={{ fontSize: fontSize.body }}
                    description={item.value}
                    descriptionStyle={{ fontSize: fontSize.small }}
                    left={props => <List.Icon {...props} icon={item.icon} />}
                  />
                ))}
              </View>

              {selectedUtilisateur.dernieresActions && selectedUtilisateur.dernieresActions.length > 0 && (
                <>
                  <Divider style={[styles.divider, { marginVertical: 16 }]} />
                  <List.Subheader style={{ fontSize: fontSize.body, fontWeight: '600' }}>
                    Dernières Actions
                  </List.Subheader>
                  {selectedUtilisateur.dernieresActions.slice(0, 5).map((action, index) => (
                    <List.Item
                      key={index}
                      title={action.type_action}
                      titleStyle={{ fontSize: fontSize.small }}
                      description={`${action.module} • ${new Date(action.date_action).toLocaleString('fr-FR')}`}
                      descriptionStyle={{ fontSize: fontSize.small }}
                      left={props => <List.Icon {...props} icon="history" />}
                    />
                  ))}
                </>
              )}
            </View>
          ) : (
            // Mode Ajout/Édition
            <View style={[styles.modalContent, { padding: cardPadding }]}>
              <TextInput
                label="Matricule *"
                value={utilisateurForm.matricule}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, matricule: text })}
                style={styles.input}
                mode="outlined"
                disabled={utilisateurMode === 'edit'}
              />

              <TextInput
                label="Nom Complet *"
                value={utilisateurForm.nom_complet}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, nom_complet: text })}
                style={styles.input}
                mode="outlined"
              />

              <TextInput
                label="Email *"
                value={utilisateurForm.email}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, email: text })}
                style={styles.input}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                label="Téléphone"
                value={utilisateurForm.telephone}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, telephone: text })}
                style={styles.input}
                mode="outlined"
                keyboardType="phone-pad"
              />

              {utilisateurMode === 'add' && (
                <TextInput
                  label="Mot de Passe *"
                  value={utilisateurForm.mot_de_passe}
                  onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, mot_de_passe: text })}
                  style={styles.input}
                  mode="outlined"
                  secureTextEntry
                />
              )}

              <View style={[styles.settingsGroup, { marginTop: 12 }]}>
                <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>Rôle</Text>
                <SegmentedButtons
                  value={utilisateurForm.role}
                  onValueChange={(value) => setUtilisateurForm({ ...utilisateurForm, role: value })}
                  buttons={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'comptable', label: 'Compta' },
                    { value: 'employe', label: 'Employé' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>

              <View style={[styles.settingsGroup, { marginTop: 12 }]}>
                <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>
                  Type d'Employé
                </Text>
                <SegmentedButtons
                  value={utilisateurForm.type_employe}
                  onValueChange={(value) => setUtilisateurForm({ ...utilisateurForm, type_employe: value })}
                  buttons={[
                    { value: 'INSS', label: 'INSS' },
                    { value: 'temps_partiel', label: 'Temps Partiel' },
                    { value: 'contractuel', label: 'Contractuel' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>

              <TextInput
                label="Salaire de Base"
                value={utilisateurForm.salaire_base}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, salaire_base: text })}
                style={[styles.input, { marginTop: 12 }]}
                mode="outlined"
                keyboardType="decimal-pad"
              />

              <View style={[styles.modalActions, { marginTop: 20 }]}>
                <Button
                  mode="outlined"
                  onPress={() => setUtilisateurModal(false)}
                  style={styles.cancelButton}
                  labelStyle={{ fontSize: fontSize.body }}
                >
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveUtilisateur}
                  buttonColor="#27AE60"
                  loading={actionLoading}
                  disabled={actionLoading}
                  labelStyle={{ fontSize: fontSize.body }}
                >
                  {utilisateurMode === 'add' ? 'Créer' : 'Modifier'}
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );

  // Modal Département
  const renderDepartementModal = () => (
    <Portal>
      <Modal
        visible={departementModal}
        onDismiss={() => setDepartementModal(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isMobile && styles.modalContainerMobile,
          isWeb && isDesktop && styles.modalContainerWeb
        ]}
      >
        <View style={[styles.modalHeader, { padding: cardPadding }]}>
          <Title style={[styles.modalTitle, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
            {departementMode === 'add' ? 'Nouveau Département' : 'Modifier Département'}
          </Title>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setDepartementModal(false)}
          />
        </View>

        <ScrollView style={[styles.modalContent, { padding: cardPadding }]}>
          <TextInput
            label="Nom du Département *"
            value={departementForm.nom}
            onChangeText={(text) => setDepartementForm({ ...departementForm, nom: text })}
            style={styles.input}
            mode="outlined"
          />

          <View style={[styles.settingsGroup, { marginTop: 12 }]}>
            <Text style={[styles.settingsLabel, { fontSize: fontSize.body, marginBottom: 10 }]}>Type</Text>
            <SegmentedButtons
              value={departementForm.type}
              onValueChange={(value) => setDepartementForm({ ...departementForm, type: value })}
              buttons={[
                { value: 'rh', label: 'RH' },
                { value: 'flotte', label: 'Flotte' },
                { value: 'agriculture', label: 'Agri' },
                { value: 'elevage', label: 'Élevage' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          <TextInput
            label="Budget Annuel"
            value={departementForm.budget_annuel}
            onChangeText={(text) => setDepartementForm({ ...departementForm, budget_annuel: text })}
            style={[styles.input, { marginTop: 12 }]}
            mode="outlined"
            keyboardType="decimal-pad"
          />

          <View style={[styles.modalActions, { marginTop: 20 }]}>
            <Button
              mode="outlined"
              onPress={() => setDepartementModal(false)}
              style={styles.cancelButton}
              labelStyle={{ fontSize: fontSize.body }}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveDepartement}
              buttonColor="#27AE60"
              loading={actionLoading}
              disabled={actionLoading}
              labelStyle={{ fontSize: fontSize.body }}
            >
              {departementMode === 'add' ? 'Créer' : 'Modifier'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // Modal Détail Historique
  const renderHistoriqueDetailModal = () => (
    <Portal>
      <Modal
        visible={historiqueDetailModal}
        onDismiss={() => setHistoriqueDetailModal(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isMobile && styles.modalContainerMobile,
          isWeb && isDesktop && styles.modalContainerWeb
        ]}
      >
        {selectedHistorique && (
          <>
            <View style={[styles.modalHeader, { padding: cardPadding }]}>
              <Title style={[styles.modalTitle, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
                Détails de l'Action
              </Title>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setHistoriqueDetailModal(false)}
              />
            </View>

            <ScrollView style={[styles.modalContent, { padding: cardPadding }]}>
              <View style={styles.historiqueDetailHeader}>
                <View style={[
                  styles.historiqueDetailIcon,
                  {
                    backgroundColor: getActionColor(selectedHistorique.type_action) + '20',
                    width: isMobile ? 64 : 72,
                    height: isMobile ? 64 : 72,
                    borderRadius: isMobile ? 32 : 36
                  }
                ]}>
                  <MaterialIcons
                    name={getActionIcon(selectedHistorique.type_action)}
                    size={isMobile ? 32 : 36}
                    color={getActionColor(selectedHistorique.type_action)}
                  />
                </View>
                <View style={styles.historiqueDetailInfo}>
                  <Text style={[styles.historiqueDetailAction, { fontSize: fontSize.subtitle, fontWeight: '700' }]}>
                    {selectedHistorique.type_action}
                  </Text>
                  <Text style={[styles.historiqueDetailModule, { fontSize: fontSize.body, marginTop: 4 }]}>
                    {selectedHistorique.module}
                  </Text>
                </View>
              </View>

              <Divider style={[styles.divider, { marginVertical: 16 }]} />

              <List.Item
                title="Description"
                titleStyle={{ fontSize: fontSize.body }}
                description={selectedHistorique.action_details}
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="description" />}
              />

              <List.Item
                title="Utilisateur"
                titleStyle={{ fontSize: fontSize.body }}
                description={`${selectedHistorique.utilisateur_nom} (${selectedHistorique.utilisateur_role})`}
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="person" />}
              />

              <List.Item
                title="Date et Heure"
                titleStyle={{ fontSize: fontSize.body }}
                description={new Date(selectedHistorique.date_action).toLocaleString('fr-FR')}
                descriptionStyle={{ fontSize: fontSize.small }}
                left={props => <List.Icon {...props} icon="schedule" />}
              />

              {selectedHistorique.niveau && (
                <List.Item
                  title="Niveau"
                  titleStyle={{ fontSize: fontSize.body }}
                  description={selectedHistorique.niveau}
                  descriptionStyle={{ fontSize: fontSize.small }}
                  left={props => <List.Icon {...props} icon="flag" />}
                  right={() => (
                    <Chip
                      mode="flat"
                      style={{
                        backgroundColor: getNiveauColor(selectedHistorique.niveau) + '20',
                        height: isMobile ? 26 : 30
                      }}
                      textStyle={{
                        color: getNiveauColor(selectedHistorique.niveau),
                        fontSize: fontSize.small,
                        fontWeight: '600'
                      }}
                    >
                      {selectedHistorique.niveau}
                    </Chip>
                  )}
                />
              )}

              {selectedHistorique.table_affectee && (
                <List.Item
                  title="Table Affectée"
                  titleStyle={{ fontSize: fontSize.body }}
                  description={selectedHistorique.table_affectee}
                  descriptionStyle={{ fontSize: fontSize.small }}
                  left={props => <List.Icon {...props} icon="table-large" />}
                />
              )}

              {selectedHistorique.donnees_apres && (
                <>
                  <Divider style={[styles.divider, { marginVertical: 16 }]} />
                  <List.Subheader style={{ fontSize: fontSize.body, fontWeight: '600' }}>
                    Données Modifiées
                  </List.Subheader>
                  <View style={styles.jsonContainer}>
                    <Text style={[styles.jsonText, { fontSize: fontSize.small }]}>
                      {JSON.stringify(JSON.parse(selectedHistorique.donnees_apres), null, 2)}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </>
        )}
      </Modal>
    </Portal>
  );
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { padding: cardPadding }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={26}
            onPress={() => navigation.goBack()}
            iconColor="#2C3E50"
          />
          <View>
            <Title style={[styles.headerTitle, { fontSize: fontSize.title, fontWeight: '800' }]}>
              Administration
            </Title>
            <Text style={[styles.headerSubtitle, { fontSize: fontSize.small, marginTop: 2 }]}>
              Gestion du système
            </Text>
          </View>
        </View>
        <IconButton
          icon="refresh"
          size={26}
          iconColor="#2E86C1"
          onPress={onRefresh}
          disabled={loading || refreshing}
        />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={{ paddingHorizontal: cardPadding / 2 }}
      >
        {[
          { id: 'historique', label: 'Historique', icon: 'history' },
          { id: 'utilisateurs', label: 'Utilisateurs', icon: 'people' },
          { id: 'departements', label: 'Départements', icon: 'business' },
          { id: 'notifications', label: 'Notifications', icon: 'notifications' },
          { id: 'general', label: 'Général', icon: 'settings' },
          { id: 'backup', label: 'Backup', icon: 'backup' },
          { id: 'stats', label: 'Stats', icon: 'bar-chart' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab,
              { paddingHorizontal: isMobile ? 14 : 18, paddingVertical: isMobile ? 12 : 14 }
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <MaterialIcons
              name={tab.icon}
              size={isMobile ? 20 : 22}
              color={activeTab === tab.id ? '#2E86C1' : '#7F8C8D'}
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText,
              { fontSize: fontSize.small, marginLeft: 6 }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loader Principal */}
      {loading && !refreshing && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={[styles.loadingText, { fontSize: fontSize.body, marginTop: 12 }]}>
            Chargement des données...
          </Text>
        </View>
      )}

      {/* Contenu avec espacement de 16px */}
      {!loading && (
        <>
          {activeTab === 'historique' && renderHistoriqueTab()}
          {activeTab === 'utilisateurs' && renderUtilisateursTab()}
          {activeTab === 'departements' && renderDepartementsTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'backup' && renderBackupTab()}
          {activeTab === 'stats' && renderStatsTab()}
        </>
      )}

      {/* FAB - Position en bas à droite */}
      {(activeTab === 'utilisateurs' || activeTab === 'departements') && !loading && (
        <FAB
          icon="plus"
          style={[
            styles.fab,
            {
              right: isMobile ? 16 : 20,
              bottom: isMobile ? 16 : 20
            }
          ]}
          onPress={activeTab === 'utilisateurs' ? handleAddUtilisateur : handleAddDepartement}
          color="#FFFFFF"
        />
      )}

      {/* Modals */}
      {renderUtilisateurModal()}
      {renderDepartementModal()}
      {renderHistoriqueDetailModal()}

      {/* Loading Overlay */}
      <LoadingOverlay />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerField === 'start' ? historiqueFilters.startDate : historiqueFilters.endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (datePickerField === 'start') {
                setHistoriqueFilters({ ...historiqueFilters, startDate: selectedDate });
              } else {
                setHistoriqueFilters({ ...historiqueFilters, endDate: selectedDate });
              }
            }
          }}
        />
      )}
    </View>
  );
};

// ============================================
// STYLES AMÉLIORÉS ET RESPONSIVE
// ============================================
const styles = StyleSheet.create({
  // ============================================
  // CONTAINER PRINCIPAL
  // ============================================
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
  },

  // ============================================
  // LOADING OVERLAY
  // ============================================
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loadingText: {
    color: '#2C3E50',
    fontWeight: '700',
  },

  // ============================================
  // HEADER
  // ============================================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#2C3E50',
  },
  headerSubtitle: {
    color: '#7F8C8D',
  },

  // ============================================
  // TABS
  // ============================================
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeTab: {
    borderBottomColor: '#2E86C1',
  },
  tabText: {
    color: '#7F8C8D',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2E86C1',
    fontWeight: '800',
  },

  // ============================================
  // CONTENU
  // ============================================
  tabContent: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // ============================================
  // STATISTIQUES
  // ============================================
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsContainerMobile: {
    flexDirection: 'column',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRadius: 12,
  },
  statValue: {
    color: '#2E86C1',
    textAlign: 'center',
  },
  statValueSuccess: {
    color: '#27AE60',
  },
  statValueWarning: {
    color: '#F39C12',
  },
  statValueDanger: {
    color: '#E74C3C',
  },
  statLabel: {
    color: '#7F8C8D',
    textAlign: 'center',
    fontWeight: '600',
  },

  // ============================================
  // FILTRES
  // ============================================
  filterCard: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  filterTitle: {
    color: '#2C3E50',
  },
  filterGroup: {},
  filterLabel: {
    color: '#2C3E50',
    fontWeight: '700',
  },
  filterRow: {
    paddingVertical: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  periodFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodFilterMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  dateButtonText: {
    color: '#2C3E50',
    marginLeft: 8,
    fontWeight: '600',
  },
  dateArrow: {
    marginHorizontal: 10,
  },

  // ============================================
  // RECHERCHE
  // ============================================
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // ============================================
  // VIDE
  // ============================================
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#BDC3C7',
    fontWeight: '600',
  },

  // ============================================
  // HISTORIQUE
  // ============================================
  historiqueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  historiqueLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  historiqueIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historiqueInfo: {
    flex: 1,
  },
  historiqueAction: {
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  historiqueDescription: {
    color: '#7F8C8D',
    lineHeight: 18,
  },
  historiqueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  historiqueModuleChip: {
    backgroundColor: '#ECF0F1',
  },
  niveauChip: {},
  chipText: {},
  historiqueDate: {
    color: '#95A5A6',
  },
  historiqueUtilisateur: {
    color: '#95A5A6',
  },

  // ============================================
  // UTILISATEURS
  // ============================================
  utilisateurCard: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  utilisateurHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  utilisateurLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  utilisateurInfo: {
    marginLeft: 14,
    flex: 1,
  },
  utilisateurNom: {
    color: '#2C3E50',
  },
  utilisateurEmail: {
    color: '#7F8C8D',
  },
  utilisateurTags: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  roleChip: {},
  statutChip: {},
  utilisateurDetails: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    color: '#2C3E50',
    fontWeight: '500',
  },
  utilisateurActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  actionsMobile: {
    flexWrap: 'wrap',
  },
  actionButton: {},

  // ============================================
  // DÉPARTEMENTS
  // ============================================
  departementCard: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  departementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  departementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  departementIcon: {
    backgroundColor: '#2E86C120',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  departementInfo: {
    flex: 1,
  },
  departementName: {
    color: '#2C3E50',
  },
  departementType: {
    color: '#7F8C8D',
    textTransform: 'uppercase',
  },
  departementActions: {
    flexDirection: 'row',
  },
  departementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  departementStatsMobile: {
    flexDirection: 'column',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statItemValue: {
    color: '#2C3E50',
  },
  statItemLabel: {
    color: '#7F8C8D',
    textAlign: 'center',
  },
  budgetProgress: {},
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetLabel: {
    color: '#7F8C8D',
  },
  budgetPercentage: {
    color: '#2E86C1',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },

  // ============================================
  // PARAMÈTRES
  // ============================================
  settingsCard: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  settingsTitle: {
    color: '#2C3E50',
  },
  settingsGroup: {},
  settingsLabel: {
    color: '#2C3E50',
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  segmentedButtons: {},
  divider: {
    backgroundColor: '#E8ECEF',
  },
  saveButton: {},

  // ============================================
  // BACKUP
  // ============================================
  backupHeader: {},
  createBackupButton: {},

  // ============================================
  // STATISTIQUES SYSTÈME
  // ============================================
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  statsGridMobile: {
    flexDirection: 'column',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statBoxValue: {
    color: '#2E86C1',
  },
  statBoxLabel: {
    color: '#7F8C8D',
    textAlign: 'center',
  },

  // ============================================
  // MODALS
  // ============================================
  modalContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    maxHeight: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContainerMobile: {
    margin: 12,
    maxHeight: '95%',
  },
  modalContainerWeb: {
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEF',
  },
  modalTitle: {
    color: '#2C3E50',
  },
  modalContent: {},
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingBottom: 16,
  },
  cancelButton: {},

  // ============================================
  // Modal Utilisateur - Mode View
  // ============================================
  viewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewInfo: {
    marginLeft: 16,
    flex: 1,
  },
  viewEmail: {
    color: '#7F8C8D',
  },
  viewTags: {
    flexDirection: 'row',
  },
  viewDetails: {},

  // ============================================
  // Modal Historique Detail
  // ============================================
  historiqueDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historiqueDetailIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  historiqueDetailInfo: {
    flex: 1,
  },
  historiqueDetailAction: {
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  historiqueDetailModule: {
    color: '#7F8C8D',
    textTransform: 'uppercase',
  },
  jsonContainer: {
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#2C3E50',
  },

  // ============================================
  // FAB - Position en bas à droite
  // ============================================
  fab: {
    position: 'absolute',
    backgroundColor: '#2E86C1',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

export default TraceabiliteParametresScreen;