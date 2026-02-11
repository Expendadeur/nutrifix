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
  ProgressBar,
  Badge,
  Surface
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireAuth } from '../../utils/authGuard';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'http://localhost:5000/api/parametres';

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

  // Calcul du nombre de colonnes selon la largeur
  const getNumColumns = () => {
    if (screenWidth > 1400) return 4; // Très large
    if (screenWidth > 1024) return 3; // Desktop
    if (screenWidth > 768) return 2;  // Tablet
    return 2; // Mobile (2 colonnes même en mobile pour meilleure utilisation de l'espace)
  };

  const numColumns = getNumColumns();

  // Calcul du nombre de colonnes pour les stats
  const getStatsColumns = () => {
    if (screenWidth > 1024) return 3; // Desktop: 3 colonnes
    if (screenWidth > 600) return 3;  // Tablet: 3 colonnes
    return 3; // Mobile: 3 colonnes (plus compact)
  };

  const statsColumns = getStatsColumns();

  // Calcul des dimensions adaptatives
  const cardPadding = isMobile ? 12 : isTablet ? 16 : 20;
  const fontSize = {
    title: isMobile ? 20 : isTablet ? 22 : 26,
    subtitle: isMobile ? 16 : isTablet ? 18 : 20,
    body: isMobile ? 13 : isTablet ? 14 : 15,
    small: isMobile ? 11 : isTablet ? 12 : 13
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
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  const openDatePicker = (field, initialValue = null) => {
    setDatePickerField(field);
    setDatePickerValue(initialValue instanceof Date ? initialValue : (initialValue ? new Date(initialValue) : new Date()));
    setShowDatePicker(true);
  };

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
        <ActivityIndicator size="large" color="#6366F1" />
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
        Alert.alert('Succès', response.data.message || 'Utilisateur créé avec succès');
      } else {
        response = await axios.put(`${API_URL}/utilisateurs/${selectedUtilisateur.id}`, data, getAxiosConfig());
        Alert.alert('Succès', response.data.message || 'Utilisateur modifié avec succès');
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
    if (actionLower.includes('création') || actionLower.includes('ajout')) return '#10B981';
    if (actionLower.includes('modification') || actionLower.includes('mise à jour')) return '#F59E0B';
    if (actionLower.includes('suppression')) return '#EF4444';
    if (actionLower.includes('consultation') || actionLower.includes('lecture')) return '#3B82F6';
    return '#6B7280';
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
      case 'critical': return '#DC2626';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#DC2626';
      case 'comptable': return '#3B82F6';
      case 'manager': return '#F59E0B';
      case 'veterinaire': return '#8B5CF6';
      case 'chauffeur': return '#06B6D4';
      case 'agriculteur': return '#10B981';
      case 'technicien': return '#475569';
      case 'employe': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'actif': return '#10B981';
      case 'inactif': return '#EF4444';
      case 'congé': return '#F59E0B';
      case 'suspendu': return '#EF4444';
      default: return '#6B7280';
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
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.loadingText, { fontSize: fontSize.body, marginTop: 16 }]}>
            Chargement...
          </Text>
        </View>
      </View>
    )
  );

  // -------------------- HISTORIQUE --------------------
  const renderHistoriqueItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.historiqueCard, { marginBottom: 12 }]}
      onPress={() => {
        setSelectedHistorique(item);
        setHistoriqueDetailModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.historiqueCardContent}>
        <View style={[
          styles.historiqueIconContainer,
          { backgroundColor: getActionColor(item.type_action) + '15' }
        ]}>
          <MaterialIcons
            name={getActionIcon(item.type_action)}
            size={24}
            color={getActionColor(item.type_action)}
          />
        </View>

        <View style={styles.historiqueInfo}>
          <Text style={[styles.historiqueAction, { fontSize: fontSize.body }]}>
            {item.type_action}
          </Text>
          <Text style={[styles.historiqueDescription, { fontSize: fontSize.small }]} numberOfLines={2}>
            {item.action_details}
          </Text>

          <View style={styles.historiqueMeta}>
            <View style={[styles.metaChip, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.metaChipText, { fontSize: fontSize.small }]}>
                {item.module}
              </Text>
            </View>
            {item.niveau && (
              <View style={[styles.metaChip, { backgroundColor: getNiveauColor(item.niveau) + '15' }]}>
                <Text style={[styles.metaChipText, { fontSize: fontSize.small, color: getNiveauColor(item.niveau) }]}>
                  {item.niveau}
                </Text>
              </View>
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

          <Text style={[styles.historiqueUtilisateur, { fontSize: fontSize.small }]}>
            Par: {item.utilisateur_nom}
          </Text>
        </View>

        <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  const renderHistoriqueTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques en Grille 3 colonnes */}
      <View style={[styles.statsGridContainer, { padding: 20, paddingTop: 12 }]}>
        <View style={[
          styles.statsGrid,
          {
            gridTemplateColumns: `repeat(${statsColumns}, 1fr)`,
            gap: 12
          }
        ]}>
          <Surface style={[styles.modernStatCard, { borderLeftColor: '#6366F1' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#6366F1' }]}>
              {historiqueStats.total || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>
              Total Actions
            </Text>
          </Surface>

          <Surface style={[styles.modernStatCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#DC2626' }]}>
              {historiqueStats.critiques || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>
              Critiques
            </Text>
          </Surface>

          <Surface style={[styles.modernStatCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#F59E0B' }]}>
              {historiqueStats.warnings || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>
              Warnings
            </Text>
          </Surface>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Searchbar
          placeholder="Rechercher dans l'historique..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.modernSearchBar}
          inputStyle={{ fontSize: fontSize.body }}
          iconColor="#6366F1"
        />
      </View>

      {/* Filtres de Date */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12 }}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}
          onPress={() => openDatePicker('start', historiqueFilters.startDate)}
        >
          <MaterialIcons name="event" size={20} color="#6366F1" />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600' }}>DEPUIS</Text>
            <Text style={{ fontSize: 13, color: '#111827', fontWeight: '500' }}>
              {historiqueFilters.startDate.toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}
          onPress={() => openDatePicker('end', historiqueFilters.endDate)}
        >
          <MaterialIcons name="event" size={20} color="#6366F1" />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600' }}>JUSQU'À</Text>
            <Text style={{ fontSize: 13, color: '#111827', fontWeight: '500' }}>
              {historiqueFilters.endDate.toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Liste avec espacement de 12px */}
      <FlatList
        data={historique}
        renderItem={renderHistoriqueItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history" size={64} color="#D1D5DB" />
            <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
              Aucune activité enregistrée
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
      />
    </View>
  );

  // -------------------- UTILISATEURS - GRILLE RESPONSIVE --------------------
  const renderUtilisateurCard = ({ item, index }) => {
    const cardWidth = screenWidth > 1400 ? '23%' :
      screenWidth > 1024 ? '31.5%' :
        screenWidth > 768 ? '48%' : '48%';

    return (
      <Surface style={[
        styles.gridCard,
        {
          width: cardWidth,
          marginBottom: 12,
          marginRight: (index % numColumns !== numColumns - 1) ? '2%' : 0
        }
      ]} elevation={1}>
        <View style={styles.gridCardHeader}>
          <View style={[styles.userAvatarSmall, { backgroundColor: getRoleColor(item.role) + '20' }]}>
            <Text style={[styles.userAvatarTextSmall, { fontSize: fontSize.body, color: getRoleColor(item.role) }]}>
              {item.nom_complet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </Text>
          </View>

          <View style={styles.gridCardActions}>
            <TouchableOpacity
              style={[styles.iconActionSmall, { backgroundColor: '#EFF6FF' }]}
              onPress={() => handleViewUtilisateur(item)}
            >
              <MaterialIcons name="visibility" size={16} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconActionSmall, { backgroundColor: '#FEF3C7' }]}
              onPress={() => handleEditUtilisateur(item)}
            >
              <MaterialIcons name="edit" size={16} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconActionSmall, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleDeleteUtilisateur(item)}
            >
              <MaterialIcons name="delete" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.gridCardBody}>
          <Text style={[styles.gridCardName, { fontSize: fontSize.body }]} numberOfLines={1}>
            {item.nom_complet}
          </Text>
          <Text style={[styles.gridCardEmail, { fontSize: fontSize.small }]} numberOfLines={1}>
            {item.email}
          </Text>

          <View style={styles.gridCardBadges}>
            <View style={[styles.smallBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
              <Text style={[styles.smallBadgeText, { fontSize: fontSize.small - 1, color: getRoleColor(item.role) }]}>
                {item.role}
              </Text>
            </View>
            <View style={[styles.smallBadge, { backgroundColor: getStatutColor(item.statut) + '20' }]}>
              <Text style={[styles.smallBadgeText, { fontSize: fontSize.small - 1, color: getStatutColor(item.statut) }]}>
                {item.statut}
              </Text>
            </View>
          </View>

          <View style={styles.gridCardDivider} />

          <View style={styles.gridCardDetails}>
            <View style={styles.gridDetailRow}>
              <MaterialIcons name="badge" size={14} color="#6B7280" />
              <Text style={[styles.gridDetailText, { fontSize: fontSize.small - 1 }]} numberOfLines={1}>
                {item.matricule}
              </Text>
            </View>
            <View style={styles.gridDetailRow}>
              <MaterialIcons name="phone" size={14} color="#6B7280" />
              <Text style={[styles.gridDetailText, { fontSize: fontSize.small - 1 }]} numberOfLines={1}>
                {item.telephone}
              </Text>
            </View>
            <View style={styles.gridDetailRow}>
              <MaterialIcons name="business" size={14} color="#6B7280" />
              <Text style={[styles.gridDetailText, { fontSize: fontSize.small - 1 }]} numberOfLines={1}>
                {item.departement_nom || 'N/A'}
              </Text>
            </View>
          </View>
        </View>
      </Surface>
    );
  };

  const renderUtilisateursTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques en Grille 3 colonnes */}
      <View style={[styles.statsGridContainer, { padding: 20, paddingTop: 12 }]}>
        <View style={[
          styles.statsGrid,
          {
            gridTemplateColumns: `repeat(${statsColumns}, 1fr)`,
            gap: 12
          }
        ]}>
          <Surface style={[styles.modernStatCard, { borderLeftColor: '#6366F1' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#6366F1' }]}>
              {utilisateursStats.total || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>Total</Text>
          </Surface>

          <Surface style={[styles.modernStatCard, { borderLeftColor: '#10B981' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#10B981' }]}>
              {utilisateursStats.actifs || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>Actifs</Text>
          </Surface>

          <Surface style={[styles.modernStatCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={[styles.modernStatValue, { fontSize: fontSize.title, color: '#DC2626' }]}>
              {utilisateursStats.admins || 0}
            </Text>
            <Text style={[styles.modernStatLabel, { fontSize: fontSize.small }]}>Admins</Text>
          </Surface>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Searchbar
          placeholder="Rechercher un utilisateur..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.modernSearchBar}
          inputStyle={{ fontSize: fontSize.body }}
          iconColor="#6366F1"
        />
      </View>

      {/* Grille d'utilisateurs */}
      <FlatList
        data={utilisateurs}
        renderItem={renderUtilisateurCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        key={numColumns} // Force re-render quand numColumns change
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        columnWrapperStyle={{ justifyContent: 'flex-start' }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people" size={64} color="#D1D5DB" />
            <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
              Aucun utilisateur
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
      />
    </View>
  );

  // -------------------- DÉPARTEMENTS - GRILLE RESPONSIVE --------------------
  const renderDepartementCard = ({ item, index }) => {
    const cardWidth = screenWidth > 1400 ? '23%' :
      screenWidth > 1024 ? '31.5%' :
        screenWidth > 768 ? '48%' : '48%';

    return (
      <Surface style={[
        styles.gridCard,
        {
          width: cardWidth,
          marginBottom: 12,
          marginRight: (index % numColumns !== numColumns - 1) ? '2%' : 0
        }
      ]} elevation={1}>
        <View style={styles.gridCardHeader}>
          <View style={styles.deptIconContainerSmall}>
            <MaterialIcons name="business" size={24} color="#6366F1" />
          </View>

          <View style={styles.gridCardActions}>
            <TouchableOpacity
              style={[styles.iconActionSmall, { backgroundColor: '#FEF3C7' }]}
              onPress={() => handleEditDepartement(item)}
            >
              <MaterialIcons name="edit" size={16} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconActionSmall, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleDeleteDepartement(item)}
            >
              <MaterialIcons name="delete" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.gridCardBody}>
          <Text style={[styles.gridCardName, { fontSize: fontSize.body }]} numberOfLines={1}>
            {item.nom}
          </Text>
          <Text style={[styles.gridCardType, { fontSize: fontSize.small }]}>
            {item.type.toUpperCase()}
          </Text>

          <View style={styles.gridCardDivider} />

          <View style={styles.deptGridStats}>
            <View style={styles.deptGridStatItem}>
              <MaterialIcons name="people" size={16} color="#6B7280" />
              <Text style={[styles.deptGridStatValue, { fontSize: fontSize.small }]}>
                {item.nombre_employes || 0}
              </Text>
              <Text style={[styles.deptGridStatLabel, { fontSize: fontSize.small - 2 }]}>
                Employés
              </Text>
            </View>

            <View style={styles.deptGridStatDivider} />

            <View style={styles.deptGridStatItem}>
              <MaterialIcons name="attach-money" size={16} color="#6B7280" />
              <Text style={[styles.deptGridStatValue, { fontSize: fontSize.small }]} numberOfLines={1}>
                {(parseFloat(item.budget_annuel || 0) / 1000000).toFixed(1)}M
              </Text>
              <Text style={[styles.deptGridStatLabel, { fontSize: fontSize.small - 2 }]}>
                Budget
              </Text>
            </View>
          </View>

          {item.budget_utilise && (
            <>
              <View style={styles.gridCardDivider} />
              <View style={styles.deptBudgetContainerSmall}>
                <View style={styles.deptBudgetHeaderSmall}>
                  <Text style={[styles.deptBudgetLabelSmall, { fontSize: fontSize.small - 1 }]}>
                    Utilisé
                  </Text>
                  <Text style={[styles.deptBudgetPercentageSmall, { fontSize: fontSize.small - 1 }]}>
                    {((item.budget_utilise / item.budget_annuel) * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.deptProgressBarSmall}>
                  <View
                    style={[
                      styles.deptProgressFillSmall,
                      { width: `${Math.min((item.budget_utilise / item.budget_annuel) * 100, 100)}%` }
                    ]}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={[styles.gridResponsable, { fontSize: fontSize.small - 1 }]} numberOfLines={1}>
            👤 {item.responsable_nom || 'Sans responsable'}
          </Text>
        </View>
      </Surface>
    );
  };

  const renderDepartementsTab = () => (
    <View style={styles.tabContent}>
      {/* Grille de départements */}
      <FlatList
        data={departements}
        renderItem={renderDepartementCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        key={numColumns} // Force re-render quand numColumns change
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        columnWrapperStyle={{ justifyContent: 'flex-start' }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="business" size={64} color="#D1D5DB" />
            <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
              Aucun département
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
      />
    </View>
  );

  // -------------------- NOTIFICATIONS --------------------
  const renderNotificationsTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingTop: 12 }}>
      <Surface style={[styles.settingsCard, { margin: 20, marginTop: 0 }]} elevation={1}>
        <View style={styles.settingsCardHeader}>
          <MaterialIcons name="notifications" size={24} color="#6366F1" />
          <Text style={[styles.settingsCardTitle, { fontSize: fontSize.subtitle }]}>
            Paramètres de Notification
          </Text>
        </View>

        <View style={styles.settingsDivider} />

        {/* Canaux */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { fontSize: fontSize.body }]}>
            Canaux de Communication
          </Text>

          {[
            { key: 'email_enabled', label: 'Notifications Email', icon: 'email' },
            { key: 'sms_enabled', label: 'Notifications SMS', icon: 'message' },
            { key: 'push_enabled', label: 'Notifications Push', icon: 'notifications-active' },
          ].map((item) => (
            <View key={item.key} style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <MaterialIcons name={item.icon} size={22} color="#6B7280" />
                <Text style={[styles.settingItemLabel, { fontSize: fontSize.body }]}>
                  {item.label}
                </Text>
              </View>
              <Switch
                value={notificationSettings[item.key]}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, [item.key]: value })
                }
                trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
                thumbColor={notificationSettings[item.key] ? '#6366F1' : '#F3F4F6'}
              />
            </View>
          ))}
        </View>

        <View style={styles.settingsDivider} />

        {/* Alertes */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { fontSize: fontSize.body }]}>
            Types d'Alertes
          </Text>

          {[
            { key: 'alertes_stock', label: 'Alertes Stock', icon: 'inventory' },
            { key: 'alertes_maintenance', label: 'Alertes Maintenance', icon: 'build' },
            { key: 'alertes_echeances', label: 'Alertes Échéances', icon: 'event' },
            { key: 'alertes_salaires', label: 'Alertes Salaires', icon: 'attach-money' },
            { key: 'alertes_conges', label: 'Alertes Congés', icon: 'beach-access' },
          ].map((item) => (
            <View key={item.key} style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <MaterialIcons name={item.icon} size={22} color="#6B7280" />
                <Text style={[styles.settingItemLabel, { fontSize: fontSize.body }]}>
                  {item.label}
                </Text>
              </View>
              <Switch
                value={notificationSettings[item.key]}
                onValueChange={(value) =>
                  setNotificationSettings({ ...notificationSettings, [item.key]: value })
                }
                trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
                thumbColor={notificationSettings[item.key] ? '#6366F1' : '#F3F4F6'}
              />
            </View>
          ))}
        </View>

        <View style={styles.settingsDivider} />

        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { fontSize: fontSize.body }]}>
            Fréquence des Rapports
          </Text>
          <SegmentedButtons
            value={notificationSettings.frequence_rapports}
            onValueChange={(value) =>
              setNotificationSettings({ ...notificationSettings, frequence_rapports: value })
            }
            buttons={[
              { value: 'quotidien', label: 'Quotidien' },
              { value: 'hebdomadaire', label: 'Hebdo' },
              { value: 'mensuel', label: 'Mensuel' },
            ]}
            style={{ marginTop: 12 }}
          />
        </View>

        <Button
          mode="contained"
          onPress={handleSaveNotificationSettings}
          buttonColor="#6366F1"
          style={styles.saveButton}
          loading={actionLoading}
          disabled={actionLoading}
          labelStyle={{ fontSize: fontSize.body }}
        >
          Sauvegarder les Paramètres
        </Button>
      </Surface>
    </ScrollView>
  );

  // -------------------- PARAMÈTRES GÉNÉRAUX --------------------
  const renderGeneralTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingTop: 12 }}>
      <Surface style={[styles.settingsCard, { margin: 20, marginTop: 0 }]} elevation={1}>
        <View style={styles.settingsCardHeader}>
          <MaterialIcons name="settings" size={24} color="#6366F1" />
          <Text style={[styles.settingsCardTitle, { fontSize: fontSize.subtitle }]}>
            Paramètres Généraux
          </Text>
        </View>

        <View style={styles.settingsDivider} />

        <View style={styles.settingsSection}>
          <TextInput
            label="Nom de l'Entreprise"
            value={generalSettings.nom_entreprise}
            onChangeText={(text) => setGeneralSettings({ ...generalSettings, nom_entreprise: text })}
            style={styles.modernInput}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#6366F1"
          />

          <View style={{ marginTop: 16 }}>
            <Text style={[styles.inputLabel, { fontSize: fontSize.small }]}>Devise</Text>
            <SegmentedButtons
              value={generalSettings.devise}
              onValueChange={(value) => setGeneralSettings({ ...generalSettings, devise: value })}
              buttons={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'BIF', label: 'BIF (FBu)' },
                { value: 'EUR', label: 'EUR (€)' },
              ]}
              style={{ marginTop: 8 }}
            />
          </View>

          <TextInput
            label="TVA par Défaut (%)"
            value={generalSettings.tva_defaut}
            onChangeText={(text) => setGeneralSettings({ ...generalSettings, tva_defaut: text })}
            style={[styles.modernInput, { marginTop: 16 }]}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#6366F1"
            keyboardType="decimal-pad"
          />

          <TextInput
            label="Rétention des Logs (jours)"
            value={generalSettings.retention_logs}
            onChangeText={(text) => setGeneralSettings({ ...generalSettings, retention_logs: text })}
            style={[styles.modernInput, { marginTop: 16 }]}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#6366F1"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingsDivider} />

        <View style={styles.settingsSection}>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <MaterialIcons name="backup" size={22} color="#6B7280" />
              <Text style={[styles.settingItemLabel, { fontSize: fontSize.body }]}>
                Sauvegarde Automatique
              </Text>
            </View>
            <Switch
              value={generalSettings.backup_auto}
              onValueChange={(value) => setGeneralSettings({ ...generalSettings, backup_auto: value })}
              trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
              thumbColor={generalSettings.backup_auto ? '#6366F1' : '#F3F4F6'}
            />
          </View>

          {generalSettings.backup_auto && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.inputLabel, { fontSize: fontSize.small }]}>
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
                style={{ marginTop: 8 }}
              />
            </View>
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleSaveGeneralSettings}
          buttonColor="#6366F1"
          style={styles.saveButton}
          loading={actionLoading}
          disabled={actionLoading}
          labelStyle={{ fontSize: fontSize.body }}
        >
          Sauvegarder les Paramètres
        </Button>
      </Surface>
    </ScrollView>
  );

  // -------------------- BACKUP --------------------
  const renderBackupTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingTop: 12 }}>
      <Surface style={[styles.settingsCard, { margin: 20, marginTop: 0 }]} elevation={1}>
        <View style={styles.settingsCardHeader}>
          <MaterialIcons name="backup" size={24} color="#6366F1" />
          <Text style={[styles.settingsCardTitle, { fontSize: fontSize.subtitle }]}>
            Gestion des Sauvegardes
          </Text>
        </View>

        <View style={styles.settingsDivider} />

        <Button
          mode="contained"
          onPress={handleCreateBackup}
          icon="backup"
          buttonColor="#10B981"
          style={{ marginBottom: 20 }}
          loading={actionLoading}
          disabled={actionLoading}
          labelStyle={{ fontSize: fontSize.body }}
        >
          Créer une Sauvegarde
        </Button>

        <Text style={[styles.settingsSectionTitle, { fontSize: fontSize.body, marginBottom: 12 }]}>
          Sauvegardes Disponibles ({backups.length})
        </Text>

        {backups.length === 0 ? (
          <View style={[styles.emptyContainer, { paddingVertical: 40 }]}>
            <MaterialIcons name="backup" size={64} color="#D1D5DB" />
            <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
              Aucune sauvegarde disponible
            </Text>
          </View>
        ) : (
          backups.map((backup, index) => (
            <View key={index} style={styles.backupItem}>
              <View style={styles.backupItemLeft}>
                <MaterialIcons name="insert-drive-file" size={24} color="#6366F1" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.backupItemName, { fontSize: fontSize.body }]}>
                    {backup.filename}
                  </Text>
                  <Text style={[styles.backupItemDetails, { fontSize: fontSize.small }]}>
                    {formatBytes(backup.size)} • {new Date(backup.date).toLocaleString('fr-FR')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.iconActionSmall, { backgroundColor: '#FEE2E2' }]}
                onPress={() => handleDeleteBackup(backup)}
              >
                <MaterialIcons name="delete" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Surface>
    </ScrollView>
  );

  // -------------------- STATISTIQUES --------------------
  const renderStatsTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingTop: 12 }}>
      {systemStats && (
        <>
          <Surface style={[styles.settingsCard, { margin: 20, marginTop: 0, marginBottom: 16 }]} elevation={1}>
            <View style={styles.settingsCardHeader}>
              <MaterialIcons name="people" size={24} color="#6366F1" />
              <Text style={[styles.settingsCardTitle, { fontSize: fontSize.subtitle }]}>
                Statistiques Utilisateurs
              </Text>
            </View>

            <View style={styles.settingsDivider} />

            <View style={[styles.statsGridContainer]}>
              <View style={[
                styles.statsGrid,
                {
                  gridTemplateColumns: `repeat(${statsColumns}, 1fr)`,
                  gap: 12
                }
              ]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxValue, { fontSize: fontSize.title, color: '#6366F1' }]}>
                    {systemStats.users?.total || 0}
                  </Text>
                  <Text style={[styles.statBoxLabel, { fontSize: fontSize.small }]}>
                    Total
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxValue, { fontSize: fontSize.title, color: '#10B981' }]}>
                    {systemStats.users?.actifs || 0}
                  </Text>
                  <Text style={[styles.statBoxLabel, { fontSize: fontSize.small }]}>
                    Actifs
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxValue, { fontSize: fontSize.title, color: '#F59E0B' }]}>
                    {systemStats.users?.actifs_7j || 0}
                  </Text>
                  <Text style={[styles.statBoxLabel, { fontSize: fontSize.small }]}>
                    Actifs 7j
                  </Text>
                </View>
              </View>
            </View>
          </Surface>

          <Surface style={[styles.settingsCard, { margin: 20, marginTop: 0 }]} elevation={1}>
            <View style={styles.settingsCardHeader}>
              <MaterialIcons name="storage" size={24} color="#6366F1" />
              <Text style={[styles.settingsCardTitle, { fontSize: fontSize.subtitle }]}>
                Base de Données
              </Text>
            </View>

            <View style={styles.settingsDivider} />

            <DataTable>
              <DataTable.Header>
                <DataTable.Title textStyle={{ fontSize: fontSize.small, fontWeight: '600' }}>
                  Table
                </DataTable.Title>
                <DataTable.Title numeric textStyle={{ fontSize: fontSize.small, fontWeight: '600' }}>
                  Lignes
                </DataTable.Title>
                <DataTable.Title numeric textStyle={{ fontSize: fontSize.small, fontWeight: '600' }}>
                  Taille
                </DataTable.Title>
              </DataTable.Header>

              {systemStats.database?.slice(0, 10).map((table, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell textStyle={{ fontSize: fontSize.small }}>
                    {table.table_name}
                  </DataTable.Cell>
                  <DataTable.Cell numeric textStyle={{ fontSize: fontSize.small }}>
                    {table.table_rows}
                  </DataTable.Cell>
                  <DataTable.Cell numeric textStyle={{ fontSize: fontSize.small }}>
                    {table.size_mb} MB
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Surface>
        </>
      )}
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
          styles.modernModal,
          isMobile && styles.modernModalMobile
        ]}
      >
        <View style={styles.modernModalHeader}>
          <Text style={[styles.modernModalTitle, { fontSize: fontSize.subtitle }]}>
            {utilisateurMode === 'add' ? 'Nouvel Utilisateur' :
              utilisateurMode === 'edit' ? 'Modifier Utilisateur' : 'Détails Utilisateur'}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setUtilisateurModal(false)}
            iconColor="#6B7280"
          />
        </View>

        <ScrollView style={styles.modernModalContent}>
          {utilisateurMode === 'view' && selectedUtilisateur ? (
            // Mode Visualisation
            <View>
              <View style={styles.modalViewHeader}>
                <View style={[styles.modalAvatar, { backgroundColor: getRoleColor(selectedUtilisateur.role) + '20' }]}>
                  <Text style={[styles.modalAvatarText, { fontSize: fontSize.title, color: getRoleColor(selectedUtilisateur.role) }]}>
                    {selectedUtilisateur.nom_complet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.modalViewName, { fontSize: fontSize.title }]}>
                  {selectedUtilisateur.nom_complet}
                </Text>
                <Text style={[styles.modalViewEmail, { fontSize: fontSize.body }]}>
                  {selectedUtilisateur.email}
                </Text>
                <View style={styles.modalViewBadges}>
                  <View style={[styles.modernBadge, { backgroundColor: getRoleColor(selectedUtilisateur.role) + '20' }]}>
                    <Text style={[styles.modernBadgeText, { fontSize: fontSize.small, color: getRoleColor(selectedUtilisateur.role) }]}>
                      {selectedUtilisateur.role}
                    </Text>
                  </View>
                  <View style={[styles.modernBadge, { backgroundColor: getStatutColor(selectedUtilisateur.statut) + '20', marginLeft: 8 }]}>
                    <Text style={[styles.modernBadgeText, { fontSize: fontSize.small, color: getStatutColor(selectedUtilisateur.statut) }]}>
                      {selectedUtilisateur.statut}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalViewDivider} />

              {[
                { icon: 'badge', label: 'Matricule', value: selectedUtilisateur.matricule },
                { icon: 'phone', label: 'Téléphone', value: selectedUtilisateur.telephone },
                { icon: 'business', label: 'Département', value: selectedUtilisateur.departement_nom || 'N/A' },
                { icon: 'work', label: 'Type d\'Employé', value: selectedUtilisateur.type_employe },
              ].map((item, index) => (
                <View key={index} style={styles.modalViewItem}>
                  <MaterialIcons name={item.icon} size={22} color="#6B7280" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={[styles.modalViewItemLabel, { fontSize: fontSize.small }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.modalViewItemValue, { fontSize: fontSize.body }]}>
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            // Mode Ajout/Édition
            <View>
              <TextInput
                label="Matricule *"
                value={utilisateurForm.matricule}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, matricule: text })}
                style={styles.modernInput}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor="#6366F1"
                disabled={utilisateurMode === 'edit'}
              />

              <TextInput
                label="Nom Complet *"
                value={utilisateurForm.nom_complet}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, nom_complet: text })}
                style={[styles.modernInput, { marginTop: 16 }]}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor="#6366F1"
              />

              <TextInput
                label="Email *"
                value={utilisateurForm.email}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, email: text })}
                style={[styles.modernInput, { marginTop: 16 }]}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor="#6366F1"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                label="Téléphone"
                value={utilisateurForm.telephone}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, telephone: text })}
                style={[styles.modernInput, { marginTop: 16 }]}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor="#6366F1"
                keyboardType="phone-pad"
              />

              {utilisateurMode === 'add' && (
                <TextInput
                  label="Mot de Passe *"
                  value={utilisateurForm.mot_de_passe}
                  onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, mot_de_passe: text })}
                  style={[styles.modernInput, { marginTop: 16 }]}
                  mode="outlined"
                  outlineColor="#E5E7EB"
                  activeOutlineColor="#6366F1"
                  secureTextEntry
                />
              )}

              <View style={{ marginTop: 20 }}>
                <Text style={[styles.inputLabel, { fontSize: fontSize.small }]}>Rôle</Text>
                <SegmentedButtons
                  value={utilisateurForm.role}
                  onValueChange={(value) => setUtilisateurForm({ ...utilisateurForm, role: value })}
                  buttons={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'employe', label: 'Employé' },
                  ]}
                  style={{ marginTop: 8 }}
                />
              </View>

              <TextInput
                label="Salaire de Base"
                value={utilisateurForm.salaire_base}
                onChangeText={(text) => setUtilisateurForm({ ...utilisateurForm, salaire_base: text })}
                style={[styles.modernInput, { marginTop: 16 }]}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor="#6366F1"
                keyboardType="decimal-pad"
              />

              <View style={styles.modernModalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setUtilisateurModal(false)}
                  style={{ flex: 1 }}
                  textColor="#6B7280"
                  labelStyle={{ fontSize: fontSize.body }}
                >
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveUtilisateur}
                  buttonColor="#6366F1"
                  style={{ flex: 1, marginLeft: 12 }}
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
          styles.modernModal,
          isMobile && styles.modernModalMobile
        ]}
      >
        <View style={styles.modernModalHeader}>
          <Text style={[styles.modernModalTitle, { fontSize: fontSize.subtitle }]}>
            {departementMode === 'add' ? 'Nouveau Département' : 'Modifier Département'}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setDepartementModal(false)}
            iconColor="#6B7280"
          />
        </View>

        <ScrollView style={styles.modernModalContent}>
          <TextInput
            label="Nom du Département *"
            value={departementForm.nom}
            onChangeText={(text) => setDepartementForm({ ...departementForm, nom: text })}
            style={styles.modernInput}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#6366F1"
          />

          <View style={{ marginTop: 20 }}>
            <Text style={[styles.inputLabel, { fontSize: fontSize.small }]}>Type</Text>
            <SegmentedButtons
              value={departementForm.type}
              onValueChange={(value) => setDepartementForm({ ...departementForm, type: value })}
              buttons={[
                { value: 'rh', label: 'RH' },
                { value: 'flotte', label: 'Flotte' },
                { value: 'agriculture', label: 'Agri' },
              ]}
              style={{ marginTop: 8 }}
            />
          </View>

          <TextInput
            label="Budget Annuel"
            value={departementForm.budget_annuel}
            onChangeText={(text) => setDepartementForm({ ...departementForm, budget_annuel: text })}
            style={[styles.modernInput, { marginTop: 16 }]}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#6366F1"
            keyboardType="decimal-pad"
          />

          <View style={styles.modernModalActions}>
            <Button
              mode="outlined"
              onPress={() => setDepartementModal(false)}
              style={{ flex: 1 }}
              textColor="#6B7280"
              labelStyle={{ fontSize: fontSize.body }}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveDepartement}
              buttonColor="#6366F1"
              style={{ flex: 1, marginLeft: 12 }}
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
          styles.modernModal,
          isMobile && styles.modernModalMobile
        ]}
      >
        {selectedHistorique && (
          <>
            <View style={styles.modernModalHeader}>
              <Text style={[styles.modernModalTitle, { fontSize: fontSize.subtitle }]}>
                Détails de l'Action
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setHistoriqueDetailModal(false)}
                iconColor="#6B7280"
              />
            </View>

            <ScrollView style={styles.modernModalContent}>
              <View style={styles.historiqueDetailHeader}>
                <View style={[
                  styles.historiqueDetailIcon,
                  { backgroundColor: getActionColor(selectedHistorique.type_action) + '15' }
                ]}>
                  <MaterialIcons
                    name={getActionIcon(selectedHistorique.type_action)}
                    size={32}
                    color={getActionColor(selectedHistorique.type_action)}
                  />
                </View>
                <Text style={[styles.historiqueDetailAction, { fontSize: fontSize.subtitle }]}>
                  {selectedHistorique.type_action}
                </Text>
                <Text style={[styles.historiqueDetailModule, { fontSize: fontSize.body }]}>
                  {selectedHistorique.module}
                </Text>
              </View>

              <View style={styles.modalViewDivider} />

              {[
                { icon: 'description', label: 'Description', value: selectedHistorique.action_details },
                { icon: 'person', label: 'Utilisateur', value: `${selectedHistorique.utilisateur_nom} (${selectedHistorique.utilisateur_role})` },
                { icon: 'schedule', label: 'Date et Heure', value: new Date(selectedHistorique.date_action).toLocaleString('fr-FR') },
              ].map((item, index) => (
                <View key={index} style={styles.modalViewItem}>
                  <MaterialIcons name={item.icon} size={22} color="#6B7280" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={[styles.modalViewItemLabel, { fontSize: fontSize.small }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.modalViewItemValue, { fontSize: fontSize.body }]}>
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      {/* Header moderne avec menu en haut à droite */}
      <View style={styles.modernHeader}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            iconColor="#1F2937"
          />
          <View>
            <Text style={[styles.modernHeaderTitle, { fontSize: fontSize.title }]}>
              Administration
            </Text>
            <Text style={[styles.modernHeaderSubtitle, { fontSize: fontSize.small }]}>
              Gestion du système
            </Text>
          </View>
        </View>

        {/* Menu en haut à droite */}
        <View style={styles.headerRight}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topMenuContainer}
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
                  styles.topMenuTab,
                  activeTab === tab.id && styles.topMenuTabActive
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={18}
                  color={activeTab === tab.id ? '#6366F1' : '#6B7280'}
                />
                <Text style={[
                  styles.topMenuTabText,
                  { fontSize: fontSize.small },
                  activeTab === tab.id && styles.topMenuTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <IconButton
            icon="refresh"
            size={24}
            iconColor="#6366F1"
            onPress={onRefresh}
            disabled={loading || refreshing}
          />
        </View>
      </View>

      {/* Loader Principal */}
      {loading && !refreshing && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
            Chargement des données...
          </Text>
        </View>
      )}

      {/* Contenu avec espacement de 12px */}
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

      {/* FAB moderne */}
      {(activeTab === 'utilisateurs' || activeTab === 'departements') && !loading && (
        <FAB
          icon="plus"
          style={styles.modernFab}
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
          value={datePickerValue}
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

const styles = StyleSheet.create({
  // ============================================
  // CONTAINER PRINCIPAL
  // ============================================
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 32,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },

  loadingText: {
    color: '#374151',
    fontWeight: '600',
  },

  // ============================================
  // HEADER MODERNE
  // ============================================
  modernHeader: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  modernHeaderTitle: {
    color: '#111827',
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  modernHeaderSubtitle: {
    color: '#6B7280',
    marginTop: 2,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  topMenuContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },

  topMenuTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },

  topMenuTabActive: {
    backgroundColor: '#EEF2FF',
  },

  topMenuTabText: {
    color: '#6B7280',
    fontWeight: '600',
  },

  topMenuTabTextActive: {
    color: '#6366F1',
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
  // STATISTIQUES EN GRILLE
  // ============================================
  statsGridContainer: {
    width: '100%',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  modernStatCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 12,
  },

  modernStatValue: {
    fontWeight: '800',
    marginBottom: 4,
  },

  modernStatLabel: {
    color: '#6B7280',
    fontWeight: '600',
  },

  // ============================================
  // RECHERCHE MODERNE
  // ============================================
  modernSearchBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // ============================================
  // VIDE
  // ============================================
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },

  emptyText: {
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 16,
  },

  // ============================================
  // CARTES HISTORIQUE MODERNES
  // ============================================
  historiqueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  historiqueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  historiqueIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  historiqueInfo: {
    flex: 1,
  },

  historiqueAction: {
    color: '#111827',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'capitalize',
  },

  historiqueDescription: {
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 8,
  },

  historiqueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },

  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  metaChipText: {
    fontWeight: '600',
  },

  historiqueDate: {
    color: '#9CA3AF',
  },

  historiqueUtilisateur: {
    color: '#9CA3AF',
  },

  // ============================================
  // CARTES GRILLE (UTILISATEURS & DÉPARTEMENTS)
  // ============================================
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  userAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  userAvatarTextSmall: {
    fontWeight: '800',
  },

  gridCardActions: {
    flexDirection: 'row',
    gap: 6,
  },

  iconActionSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  gridCardBody: {
    flex: 1,
  },

  gridCardName: {
    color: '#111827',
    fontWeight: '700',
    marginBottom: 3,
  },

  gridCardEmail: {
    color: '#6B7280',
    marginBottom: 8,
  },

  gridCardType: {
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },

  gridCardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },

  smallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  smallBadgeText: {
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  gridCardDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },

  gridCardDetails: {
    gap: 8,
  },

  gridDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  gridDetailText: {
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },

  gridResponsable: {
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '500',
  },

  // ============================================
  // DÉPARTEMENTS GRILLE - ICÔNE & STATS
  // ============================================
  deptIconContainerSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deptGridStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },

  deptGridStatItem: {
    alignItems: 'center',
    flex: 1,
  },

  deptGridStatValue: {
    color: '#111827',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },

  deptGridStatLabel: {
    color: '#6B7280',
    textAlign: 'center',
  },

  deptGridStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },

  deptBudgetContainerSmall: {
    paddingTop: 10,
  },

  deptBudgetHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  deptBudgetLabelSmall: {
    color: '#6B7280',
    fontWeight: '600',
  },

  deptBudgetPercentageSmall: {
    color: '#6366F1',
    fontWeight: '700',
  },

  deptProgressBarSmall: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },

  deptProgressFillSmall: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },

  // ============================================
  // PARAMÈTRES
  // ============================================
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },

  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  settingsCardTitle: {
    color: '#111827',
    fontWeight: '700',
  },

  settingsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },

  settingsSection: {
    marginBottom: 20,
  },

  settingsSectionTitle: {
    color: '#111827',
    fontWeight: '700',
    marginBottom: 16,
  },

  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },

  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  settingItemLabel: {
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },

  modernInput: {
    backgroundColor: '#FFFFFF',
  },

  inputLabel: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },

  saveButton: {
    marginTop: 24,
    borderRadius: 12,
    elevation: 0,
  },

  // ============================================
  // BACKUP
  // ============================================
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  backupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  backupItemName: {
    color: '#111827',
    fontWeight: '600',
    marginBottom: 4,
  },

  backupItemDetails: {
    color: '#6B7280',
  },

  // ============================================
  // STATISTIQUES
  // ============================================
  statBox: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 12,
  },

  statBoxValue: {
    fontWeight: '800',
    marginBottom: 6,
  },

  statBoxLabel: {
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },

  // ============================================
  // MODALS MODERNES
  // ============================================
  modernModal: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 20,
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },

  modernModalMobile: {
    margin: 16,
    maxHeight: '95%',
  },

  modernModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  modernModalTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  modernModalContent: {
    padding: 20,
    maxHeight: '100%',
  },

  modernModalActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },

  // ============================================
  // MODAL VIEW MODE
  // ============================================
  modalViewHeader: {
    alignItems: 'center',
    paddingBottom: 20,
  },

  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalAvatarText: {
    fontWeight: '800',
  },

  modalViewName: {
    color: '#111827',
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },

  modalViewEmail: {
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },

  modalViewBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  modernBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  modernBadgeText: {
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  modalViewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },

  modalViewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },

  modalViewItemLabel: {
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },

  modalViewItemValue: {
    color: '#111827',
    fontWeight: '600',
  },

  // ============================================
  // HISTORIQUE DETAIL MODAL
  // ============================================
  historiqueDetailHeader: {
    alignItems: 'center',
    paddingBottom: 20,
  },

  historiqueDetailIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  historiqueDetailAction: {
    color: '#111827',
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
    textTransform: 'capitalize',
  },

  historiqueDetailModule: {
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // ============================================
  // FAB MODERNE
  // ============================================
  modernFab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});

export default TraceabiliteParametresScreen;