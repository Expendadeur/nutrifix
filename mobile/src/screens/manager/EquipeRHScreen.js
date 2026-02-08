// frontend/src/screens/manager/EquipeRHScreen.js
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
  FlatList
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
  Checkbox,
  RadioButton,
  ActivityIndicator,
  Menu,
  Divider,
  ProgressBar,
  Badge,
  Surface
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;
const isMobile = screenWidth < 768;

// Configuration API
const API_BASE_URL = 'http://localhost:5000/api'; // À adapter selon votre configuration

const EquipeRHScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const initialTab = route.params?.tab || 'employes';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authToken, setAuthToken] = useState(null);
  
  // Employés
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('actif');

  // Présences
  const [presences, setPresences] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPresences, setSelectedPresences] = useState([]);
  const [validationMode, setValidationMode] = useState(false);

  // Congés
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState('pending');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  // Salaires
  const [salaries, setSalaries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [selectedSalaries, setSelectedSalaries] = useState([]); // Pour paiement groupé
  const [bulkPaymentMode, setBulkPaymentMode] = useState(false);
  const [paymentMode, setPaymentMode] = useState('virement');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Demandes de paiement
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentRequestsFilter, setPaymentRequestsFilter] = useState('en_attente');
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [paymentRequestModalVisible, setPaymentRequestModalVisible] = useState(false);

  // Performance
  const [performanceData, setPerformanceData] = useState([]);
  const [performanceFilter, setPerformanceFilter] = useState('all');

  // Menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  // Récupérer le token au montage
  useEffect(() => {
    loadAuthToken();
  }, []);

  useEffect(() => {
    if (authToken) {
      loadData();
    }
  }, [activeTab, selectedDate, selectedMonth, selectedYear, leaveFilter, paymentRequestsFilter, authToken]);

  useEffect(() => {
    filterEmployees();
  }, [searchQuery, filterRole, filterStatus, employees]);

  const loadAuthToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      setAuthToken(token);
    } catch (error) {
      console.error('Error loading auth token:', error);
      Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
    }
  };

  // Configuration axios avec token
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Intercepteur pour ajouter le token
  apiClient.interceptors.request.use(
    (config) => {
      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Intercepteur pour gérer les erreurs
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        // Navigation vers login
      }
      return Promise.reject(error);
    }
  );

const loadData = async () => {
  try {
    setLoading(true);
    
    switch(activeTab) {
      case 'employes':
        await loadEmployees();
        break;
      case 'presences':
        await loadPresences();
        break;
      case 'conges':
        await loadLeaveRequests();
        break;
      case 'salaires':
        await loadSalaries();
        await loadPaymentRequests();
        break;
      case 'performance':
        await loadPerformance();
        break;
    }
  } catch (error) {
    console.error('Error loading data:', error);
    // Don't show alert on every error to avoid spamming
    // Alert.alert('Erreur', 'Impossible de charger les données');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

const loadEmployees = async () => {
  try {
    const response = await apiClient.get('/manager/employees', {
      params: { role: filterRole, statut: filterStatus, search: searchQuery }
    });
    setEmployees(Array.isArray(response.data) ? response.data : []);
    setFilteredEmployees(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading employees:', error);
    setEmployees([]);
    setFilteredEmployees([]);
    throw error;
  }
};

const loadPresences = async () => {
  try {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const response = await apiClient.get('/manager/presences', {
      params: { date: dateStr }
    });
    setPresences(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading presences:', error);
    setPresences([]); // Ensure presences is always an array
    throw error;
  }
};

const loadLeaveRequests = async () => {
  try {
    const response = await apiClient.get('/manager/leave-requests', {
      params: { filter: leaveFilter }
    });
    setLeaveRequests(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading leave requests:', error);
    setLeaveRequests([]);
    throw error;
  }
};

 const loadSalaries = async () => {
  try {
    const response = await apiClient.get('/manager/salaries', {
      params: { month: selectedMonth, year: selectedYear }
    });
    setSalaries(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading salaries:', error);
    setSalaries([]);
    throw error;
  }
};

  // NOUVELLE FONCTIONNALITÉ : Charger les demandes de paiement
 const loadPaymentRequests = async () => {
  try {
    const response = await apiClient.get('/manager/payment-requests', {
      params: { 
        statut: paymentRequestsFilter,
        month: selectedMonth,
        year: selectedYear
      }
    });
    setPaymentRequests(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading payment requests:', error);
    setPaymentRequests([]);
    throw error;
  }
};


const loadPerformance = async () => {
  try {
    const response = await apiClient.get('/manager/performance');
    setPerformanceData(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    console.error('Error loading performance:', error);
    setPerformanceData([]);
    throw error;
  }
};

  const filterEmployees = () => {
    let filtered = employees;

    if (searchQuery) {
      filtered = filtered.filter(emp => 
        emp.nom_complet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(emp => emp.role === filterRole);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(emp => emp.statut === filterStatus);
    }

    setFilteredEmployees(filtered);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [activeTab, selectedDate, selectedMonth, selectedYear, leaveFilter, paymentRequestsFilter]);

  // =============== EMPLOYÉS ===============
  const renderEmployeeCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.employeeCard,
        isDesktop && styles.employeeCardDesktop,
        isTablet && !isDesktop && styles.employeeCardTablet,
        isMobile && styles.employeeCardMobile
      ]}
      onPress={() => {
        setSelectedEmployee(item);
        setEmployeeModalVisible(true);
      }}
    >
      <View style={styles.employeeHeader}>
        <Avatar.Image 
          size={isMobile ? 40 : isTablet ? 45 : 50}
          source={{ uri: item.photo_identite || 'https://via.placeholder.com/50' }}
        />
        <View style={styles.employeeInfo}>
          <Text style={[styles.employeeName, isMobile && styles.employeeNameMobile]}>
            {item.nom_complet}
          </Text>
          <Text style={styles.employeeMatricule}>{item.matricule}</Text>
          <Text style={styles.employeeRole}>{getRoleLabel(item.role)}</Text>
        </View>
        <View style={styles.employeeBadges}>
          <Chip 
            style={[styles.statusChip, { 
              backgroundColor: getStatusColor(item.statut) 
            }]}
            textStyle={styles.chipText}
          >
            {item.statut}
          </Chip>
          <Text style={styles.employeeType}>{item.type_employe}</Text>
        </View>
      </View>
      
      <Divider style={styles.divider} />
      
      <View style={[
        styles.employeeStats,
        isMobile && styles.employeeStatsMobile
      ]}>
        <View style={styles.statItem}>
          <MaterialIcons name="event-available" size={isMobile ? 16 : 18} color="#3498DB" />
          <Text style={[styles.statText, isMobile && styles.statTextMobile]}>
            {Math.round(item.presence_rate || 0)}% présence
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons name="star" size={isMobile ? 16 : 18} color="#F39C12" />
          <Text style={[styles.statText, isMobile && styles.statTextMobile]}>
            {(item.performance_score || 0).toFixed(1)}/10
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons name="schedule" size={isMobile ? 16 : 18} color="#9B59B6" />
          <Text style={[styles.statText, isMobile && styles.statTextMobile]}>
            {Math.round(item.hours_worked || 0)}h ce mois
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmployeeDetailModal = () => (
    <Portal>
      <Modal
        visible={employeeModalVisible}
        onDismiss={() => setEmployeeModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isWeb && styles.modalContainerWeb,
          isDesktop && styles.modalContainerDesktop,
          isMobile && styles.modalContainerMobile
        ]}
      >
        {selectedEmployee && (
          <ScrollView showsVerticalScrollIndicator={!isWeb}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Avatar.Image 
                size={isMobile ? 50 : 60}
                source={{ uri: selectedEmployee.photo_identite || 'https://via.placeholder.com/60' }}
              />
              <View style={styles.modalHeaderInfo}>
                <Title style={isMobile && styles.modalTitleMobile}>
                  {selectedEmployee.nom_complet}
                </Title>
                <Paragraph>{selectedEmployee.matricule}</Paragraph>
              </View>
              <TouchableOpacity onPress={() => setEmployeeModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Informations personnelles */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Informations Personnelles</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{selectedEmployee.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Téléphone:</Text>
                <Text style={styles.infoValue}>{selectedEmployee.telephone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date embauche:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(selectedEmployee.date_embauche)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type:</Text>
                <Text style={styles.infoValue}>{selectedEmployee.type_employe}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rôle:</Text>
                <Text style={styles.infoValue}>{getRoleLabel(selectedEmployee.role)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Statut:</Text>
                <Chip style={{ 
                  backgroundColor: getStatusColor(selectedEmployee.statut) 
                }}>
                  {selectedEmployee.statut}
                </Chip>
              </View>
            </View>

            <Divider />

            {/* Performance */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={[
                styles.performanceGrid,
                isMobile && styles.performanceGridMobile
              ]}>
                <View style={styles.performanceItem}>
                  <MaterialIcons name="event-available" size={isMobile ? 24 : 30} color="#2ECC71" />
                  <Text style={styles.performanceValue}>
                    {Math.round(selectedEmployee.presence_rate || 0)}%
                  </Text>
                  <Text style={styles.performanceLabel}>Présence</Text>
                </View>
                <View style={styles.performanceItem}>
                  <MaterialIcons name="star" size={isMobile ? 24 : 30} color="#F39C12" />
                  <Text style={styles.performanceValue}>
                    {(selectedEmployee.performance_score || 0).toFixed(1)}/10
                  </Text>
                  <Text style={styles.performanceLabel}>Score</Text>
                </View>
                <View style={styles.performanceItem}>
                  <MaterialIcons name="schedule" size={isMobile ? 24 : 30} color="#3498DB" />
                  <Text style={styles.performanceValue}>
                    {Math.round(selectedEmployee.hours_worked || 0)}h
                  </Text>
                  <Text style={styles.performanceLabel}>Heures</Text>
                </View>
                <View style={styles.performanceItem}>
                  <MaterialIcons name="event-busy" size={isMobile ? 24 : 30} color="#E74C3C" />
                  <Text style={styles.performanceValue}>
                    {selectedEmployee.absences || 0}
                  </Text>
                  <Text style={styles.performanceLabel}>Absences</Text>
                </View>
              </View>
            </View>

            <Divider />

            {/* Congés */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Solde Congés</Text>
              <View style={[styles.leaveBalance, isMobile && styles.leaveBalanceMobile]}>
                <View style={styles.leaveItem}>
                  <Text style={styles.leaveValue}>
                    {selectedEmployee.leave_balance?.total || 0}
                  </Text>
                  <Text style={styles.leaveLabel}>Jours totaux</Text>
                </View>
                <View style={styles.leaveItem}>
                  <Text style={[styles.leaveValue, { color: '#E74C3C' }]}>
                    {selectedEmployee.leave_balance?.used || 0}
                  </Text>
                  <Text style={styles.leaveLabel}>Jours pris</Text>
                </View>
                <View style={styles.leaveItem}>
                  <Text style={[styles.leaveValue, { color: '#2ECC71' }]}>
                    {selectedEmployee.leave_balance?.remaining || 0}
                  </Text>
                  <Text style={styles.leaveLabel}>Jours restants</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setEmployeeModalVisible(false);
                }}
                style={styles.actionButton}
                icon="close"
              >
                Fermer
              </Button>
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  const renderEmployeesTab = () => (
    <View style={styles.tabContainer}>
      {/* Filtres et recherche */}
      <View style={styles.filtersContainer}>
        <Searchbar
          placeholder="Rechercher un employé..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.chipsContainer}
        >
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.filterChip}
          >
            Tous
          </Chip>
          <Chip
            selected={filterStatus === 'actif'}
            onPress={() => setFilterStatus('actif')}
            style={styles.filterChip}
            selectedColor="#2ECC71"
          >
            Actifs
          </Chip>
          <Chip
            selected={filterStatus === 'congé'}
            onPress={() => setFilterStatus('congé')}
            style={styles.filterChip}
            selectedColor="#F39C12"
          >
            En congé
          </Chip>
          <Chip
            selected={filterStatus === 'inactif'}
            onPress={() => setFilterStatus('inactif')}
            style={styles.filterChip}
            selectedColor="#E74C3C"
          >
            Inactifs
          </Chip>
          
          <Divider style={styles.chipDivider} />
          
          <Chip
            selected={filterRole === 'all'}
            onPress={() => setFilterRole('all')}
            style={styles.filterChip}
          >
            Tous rôles
          </Chip>
          <Chip
            selected={filterRole === 'employe'}
            onPress={() => setFilterRole('employe')}
            style={styles.filterChip}
          >
            Employés
          </Chip>
          <Chip
            selected={filterRole === 'chauffeur'}
            onPress={() => setFilterRole('chauffeur')}
            style={styles.filterChip}
          >
            Chauffeurs
          </Chip>
          <Chip
            selected={filterRole === 'veterinaire'}
            onPress={() => setFilterRole('veterinaire')}
            style={styles.filterChip}
          >
            Vétérinaires
          </Chip>
        </ScrollView>
      </View>

      {/* Stats rapides */}
      <View style={[styles.quickStats, isMobile && styles.quickStatsMobile]}>
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatValue, isMobile && styles.quickStatValueMobile]}>
            {employees.length}
          </Text>
          <Text style={styles.quickStatLabel}>Total</Text>
        </View>
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatValue, { color: '#2ECC71' }, isMobile && styles.quickStatValueMobile]}>
            {employees.filter(e => e.statut === 'actif').length}
          </Text>
          <Text style={styles.quickStatLabel}>Actifs</Text>
        </View>
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatValue, { color: '#F39C12' }, isMobile && styles.quickStatValueMobile]}>
            {employees.filter(e => e.statut === 'congé').length}
          </Text>
          <Text style={styles.quickStatLabel}>Congés</Text>
        </View>
        <View style={styles.quickStatItem}>
          <Text style={[styles.quickStatValue, { color: '#3498DB' }, isMobile && styles.quickStatValueMobile]}>
            {employees.filter(e => e.type_employe === 'INSS').length}
          </Text>
          <Text style={styles.quickStatLabel}>INSS</Text>
        </View>
      </View>

      {/* Liste des employés */}
      <FlatList
        data={filteredEmployees}
        renderItem={renderEmployeeCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.employeeList}
        numColumns={isDesktop ? 2 : 1}
        key={isDesktop ? 'desktop' : 'mobile'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="people-outline" size={60} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucun employé trouvé</Text>
          </View>
        }
      />
    </View>
  );

  // =============== PRÉSENCES ===============
  const renderPresenceItem = ({ item }) => {
    const isSelected = selectedPresences.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.presenceCard,
          isSelected && styles.presenceCardSelected,
          isMobile && styles.presenceCardMobile
        ]}
        onPress={() => {
          if (validationMode) {
            togglePresenceSelection(item.id);
          }
        }}
      >
        {validationMode && (
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => togglePresenceSelection(item.id)}
          />
        )}
        
        <Avatar.Image 
          size={isMobile ? 35 : 40}
          source={{ uri: item.employee_photo || 'https://via.placeholder.com/40' }}
        />
        
        <View style={styles.presenceInfo}>
          <Text style={[styles.presenceName, isMobile && styles.presenceNameMobile]}>
            {item.employee_name}
          </Text>
          <Text style={styles.presenceMatricule}>{item.matricule}</Text>
        </View>
        
        <View style={styles.presenceTimes}>
          <View style={styles.timeItem}>
            <MaterialIcons name="login" size={isMobile ? 14 : 16} color="#2ECC71" />
            <Text style={[styles.timeText, isMobile && styles.timeTextMobile]}>
              {item.heure_entree ? item.heure_entree.substring(0, 5) : '--:--'}
            </Text>
          </View>
          <View style={styles.timeItem}>
            <MaterialIcons name="logout" size={isMobile ? 14 : 16} color="#E74C3C" />
            <Text style={[styles.timeText, isMobile && styles.timeTextMobile]}>
              {item.heure_sortie ? item.heure_sortie.substring(0, 5) : '--:--'}
            </Text>
          </View>
        </View>
        
        <Chip 
          style={[styles.presenceStatus, { 
            backgroundColor: getPresenceStatusColor(item.statut) 
          }]}
          textStyle={{ color: '#FFF', fontSize: isMobile ? 10 : 11 }}
        >
          {item.statut}
        </Chip>
        
        {item.statut_validation === 'en_attente' && (
          <MaterialIcons name="pending" size={isMobile ? 18 : 20} color="#F39C12" />
        )}
      </TouchableOpacity>
    );
  };

  const togglePresenceSelection = (id) => {
    setSelectedPresences(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const validateSelectedPresences = async () => {
    if (selectedPresences.length === 0) {
      Alert.alert('Aucune sélection', 'Veuillez sélectionner des présences à valider');
      return;
    }

    Alert.alert(
      'Confirmer la validation',
      `Valider ${selectedPresences.length} présence(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await apiClient.post('/manager/presences/validate', {
                presenceIds: selectedPresences
              });
              Alert.alert('Succès', 'Présences validées');
              setSelectedPresences([]);
              setValidationMode(false);
              loadPresences();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de valider les présences');
            }
          }
        }
      ]
    );
  };

  const getPresenceStatusColor = (status) => {
    switch(status) {
      case 'present': return '#2ECC71';
      case 'absent': return '#E74C3C';
      case 'retard': return '#F39C12';
      case 'congé': return '#3498DB';
      case 'mission': return '#9B59B6';
      default: return '#95A5A6';
    }
  };

  const renderPresencesTab = () => (
    <View style={styles.tabContainer}>
      {/* Date selector et actions */}
      <View style={styles.presenceHeader}>
        <TouchableOpacity
          style={[styles.dateSelector, isMobile && styles.dateSelectorMobile]}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialIcons name="calendar-today" size={isMobile ? 18 : 20} color="#3498DB" />
          <Text style={[styles.dateText, isMobile && styles.dateTextMobile]}>
            {selectedDate.toLocaleDateString('fr-FR', {
              weekday: isMobile ? 'short' : 'long',
              day: 'numeric',
              month: isMobile ? 'short' : 'long',
              year: 'numeric'
            })}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#7F8C8D" />
        </TouchableOpacity>

        <View style={[styles.presenceActions, isMobile && styles.presenceActionsMobile]}>
          {!validationMode ? (
            <Button
              mode="contained"
              onPress={() => setValidationMode(true)}
              icon="check-circle"
              style={styles.validateButton}
              compact={isMobile}
            >
              {isMobile ? 'Valider' : 'Valider présences'}
            </Button>
          ) : (
            <>
              <Button
                mode="outlined"
                onPress={() => {
                  setValidationMode(false);
                  setSelectedPresences([]);
                }}
                style={styles.cancelButton}
                compact={isMobile}
              >
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={validateSelectedPresences}
                icon="check-all"
                style={styles.confirmButton}
                disabled={selectedPresences.length === 0}
                compact={isMobile}
              >
                Valider ({selectedPresences.length})
              </Button>
            </>
          )}
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {/* Résumé du jour */}
      <Card style={styles.presenceSummary}>
        <Card.Content>
          <View style={[styles.summaryGrid, isMobile && styles.summaryGridMobile]}>
            <View style={styles.summaryItem}>
              <MaterialIcons name="people" size={isMobile ? 20 : 24} color="#3498DB" />
              <Text style={[styles.summaryValue, isMobile && styles.summaryValueMobile]}>
                {presences.length}
              </Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <MaterialIcons name="check-circle" size={isMobile ? 20 : 24} color="#2ECC71" />
              <Text style={[styles.summaryValue, isMobile && styles.summaryValueMobile]}>
                {presences.filter(p => p.statut === 'present').length}
              </Text>
              <Text style={styles.summaryLabel}>Présents</Text>
            </View>
            <View style={styles.summaryItem}>
              <MaterialIcons name="cancel" size={isMobile ? 20 : 24} color="#E74C3C" />
              <Text style={[styles.summaryValue, isMobile && styles.summaryValueMobile]}>
                {presences.filter(p => p.statut === 'absent').length}
              </Text>
              <Text style={styles.summaryLabel}>Absents</Text>
            </View>
            <View style={styles.summaryItem}>
              <MaterialIcons name="access-time" size={isMobile ? 20 : 24} color="#F39C12" />
              <Text style={[styles.summaryValue, isMobile && styles.summaryValueMobile]}>
                {presences.filter(p => p.statut === 'retard').length}
              </Text>
              <Text style={styles.summaryLabel}>Retards</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Liste des présences */}
      <FlatList
        data={presences}
        renderItem={renderPresenceItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.presenceList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="event-busy" size={60} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucune présence pour cette date</Text>
          </View>
        }
      />
    </View>
  );

  // =============== CONGÉS ===============
  const renderLeaveRequestCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.leaveRequestCard, isMobile && styles.leaveRequestCardMobile]}
      onPress={() => {
        setSelectedLeave(item);
        setLeaveModalVisible(true);
      }}
    >
      <View style={styles.leaveHeader}>
        <Avatar.Image 
          size={isMobile ? 35 : 40}
          source={{ uri: item.employee_photo || 'https://via.placeholder.com/40' }}
        />
        <View style={styles.leaveEmployeeInfo}>
          <Text style={[styles.leaveName, isMobile && styles.leaveNameMobile]}>
            {item.employee_name}
          </Text>
          <Text style={styles.leaveMatricule}>{item.matricule}</Text>
        </View>
        <Chip 
          style={[styles.leaveStatusChip, { 
            backgroundColor: getLeaveStatusColor(item.statut) 
          }]}
          textStyle={{ color: '#FFF', fontSize: isMobile ? 10 : 11 }}
        >
          {item.statut}
        </Chip>
      </View>

      <View style={styles.leaveDetails}>
        <View style={styles.leaveDetailRow}>
          <MaterialIcons name="event" size={isMobile ? 14 : 16} color="#3498DB" />
          <Text style={[styles.leaveDetailText, isMobile && styles.leaveDetailTextMobile]}>
            {getLeaveTypeLabel(item.type_conge)} • {item.jours_demandes} jour(s)
          </Text>
        </View>
        <View style={styles.leaveDetailRow}>
          <MaterialIcons name="date-range" size={isMobile ? 14 : 16} color="#7F8C8D" />
          <Text style={[styles.leaveDetailText, isMobile && styles.leaveDetailTextMobile]}>
            Du {formatDate(item.date_debut)} au {formatDate(item.date_fin)}
          </Text>
        </View>
        <View style={styles.leaveDetailRow}>
          <MaterialIcons name="access-time" size={isMobile ? 14 : 16} color="#95A5A6" />
          <Text style={[styles.leaveDetailText, isMobile && styles.leaveDetailTextMobile]}>
            Demandé le {formatDate(item.date_creation)}
          </Text>
        </View>
        {item.motif && (
          <View style={styles.leaveDetailRow}>
            <MaterialIcons name="description" size={isMobile ? 14 : 16} color="#95A5A6" />
            <Text style={[styles.leaveDetailText, isMobile && styles.leaveDetailTextMobile]} numberOfLines={2}>
              {item.motif}
            </Text>
          </View>
        )}
      </View>

      {item.statut === 'en_attente' && (
        <View style={[styles.leaveActions, isMobile && styles.leaveActionsMobile]}>
          <TouchableOpacity
            style={[styles.leaveActionButton, styles.approveLeaveButton]}
            onPress={() => handleLeaveAction(item.id, 'approve')}
          >
            <MaterialIcons name="check" size={isMobile ? 18 : 20} color="#FFF" />
            <Text style={[styles.leaveActionText, isMobile && styles.leaveActionTextMobile]}>
              Approuver
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.leaveActionButton, styles.rejectLeaveButton]}
            onPress={() => {
              setSelectedLeave(item);
              setRejectModalVisible(true);
            }}
          >
            <MaterialIcons name="close" size={isMobile ? 18 : 20} color="#FFF" />
            <Text style={[styles.leaveActionText, isMobile && styles.leaveActionTextMobile]}>
              Rejeter
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderRejectModal = () => (
    <Portal>
      <Modal
        visible={rejectModalVisible}
        onDismiss={() => {
          setRejectModalVisible(false);
          setRejectReason('');
        }}
        contentContainerStyle={[
          styles.modalContainer, 
          styles.rejectModal,
          isMobile && styles.modalContainerMobile
        ]}
      >
        <View style={styles.rejectModalContent}>
          <Text style={styles.rejectModalTitle}>Rejeter la demande</Text>
          <Text style={styles.rejectModalSubtitle}>
            Demande de {selectedLeave?.employee_name}
          </Text>
          
          <TextInput
            label="Raison du rejet (optionnel)"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            numberOfLines={4}
            style={styles.rejectReasonInput}
            mode="outlined"
          />

          <View style={[styles.rejectModalActions, isMobile && styles.rejectModalActionsMobile]}>
            <Button
              mode="outlined"
              onPress={() => {
                setRejectModalVisible(false);
                setRejectReason('');
              }}
              style={styles.rejectModalButton}
              compact={isMobile}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                handleLeaveAction(selectedLeave.id, 'reject', rejectReason);
                setRejectModalVisible(false);
                setRejectReason('');
              }}
              style={[styles.rejectModalButton, styles.rejectConfirmButton]}
              buttonColor="#E74C3C"
              compact={isMobile}
            >
              Confirmer
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  const handleLeaveAction = async (leaveId, action, reason = '') => {
    const leave = leaveRequests.find(l => l.id === leaveId);
    
    if (action === 'approve') {
      Alert.alert(
        'Approuver la demande',
        `Approuver la demande de ${leave.employee_name} (${leave.jours_demandes} jours) ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Approuver',
            onPress: () => processLeaveAction(leaveId, action, reason)
          }
        ]
      );
    } else {
      processLeaveAction(leaveId, action, reason);
    }
  };

  const processLeaveAction = async (leaveId, action, reason = '') => {
    try {
      await apiClient.post(`/manager/leave-requests/${leaveId}/process`, {
        action,
        reason
      });
      Alert.alert(
        'Succès',
        `Demande ${action === 'approve' ? 'approuvée' : 'rejetée'}`
      );
      loadLeaveRequests();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de traiter la demande');
      console.error('Error processing leave:', error);
    }
  };

  const getLeaveStatusColor = (status) => {
    switch(status) {
      case 'en_attente': return '#F39C12';
      case 'approuve': return '#2ECC71';
      case 'rejete': return '#E74C3C';
      case 'annule': return '#95A5A6';
      default: return '#7F8C8D';
    }
  };

  const getLeaveTypeLabel = (type) => {
    const types = {
      'annuel': 'Congé annuel',
      'maladie': 'Maladie',
      'maternite': 'Maternité',
      'exceptionnel': 'Exceptionnel',
      'sans_solde': 'Sans solde'
    };
    return types[type] || type;
  };

  const renderCongesTab = () => (
    <View style={styles.tabContainer}>
      {/* Filtres */}
      <View style={styles.leaveFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip
            selected={leaveFilter === 'pending'}
            onPress={() => setLeaveFilter('pending')}
            style={styles.filterChip}
            selectedColor="#F39C12"
          >
            En attente
          </Chip>
          <Chip
            selected={leaveFilter === 'approved'}
            onPress={() => setLeaveFilter('approved')}
            style={styles.filterChip}
            selectedColor="#2ECC71"
          >
            Approuvés
          </Chip>
          <Chip
            selected={leaveFilter === 'rejected'}
            onPress={() => setLeaveFilter('rejected')}
            style={styles.filterChip}
            selectedColor="#E74C3C"
          >
            Rejetés
          </Chip>
          <Chip
            selected={leaveFilter === 'all'}
            onPress={() => setLeaveFilter('all')}
            style={styles.filterChip}
          >
            Tous
          </Chip>
        </ScrollView>
      </View>

      {/* Statistiques congés */}
      <Card style={styles.leaveSummaryCard}>
        <Card.Content>
          <View style={[styles.leaveSummaryGrid, isMobile && styles.leaveSummaryGridMobile]}>
            <View style={styles.leaveSummaryItem}>
              <Text style={[styles.leaveSummaryValue, { color: '#F39C12' }]}>
                {leaveRequests.filter(l => l.statut === 'en_attente').length}
              </Text>
              <Text style={styles.leaveSummaryLabel}>En attente</Text>
            </View>
            <View style={styles.leaveSummaryItem}>
              <Text style={[styles.leaveSummaryValue, { color: '#2ECC71' }]}>
                {leaveRequests.filter(l => l.statut === 'approuve').length}
              </Text>
              <Text style={styles.leaveSummaryLabel}>Approuvés</Text>
            </View>
            <View style={styles.leaveSummaryItem}>
              <Text style={[styles.leaveSummaryValue, { color: '#3498DB' }]}>
                {leaveRequests.reduce((sum, l) => sum + (l.statut === 'approuve' ? l.jours_demandes : 0), 0)}
              </Text>
              <Text style={styles.leaveSummaryLabel}>Jours total</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Liste des demandes */}
      <FlatList
        data={leaveRequests}
        renderItem={renderLeaveRequestCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.leaveList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="event-available" size={60} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucune demande de congé</Text>
          </View>
        }
      />

      {renderRejectModal()}
    </View>
  );

  // =============== SALAIRES (AVEC NOUVELLES FONCTIONNALITÉS) ===============
  
  // NOUVELLE FONCTIONNALITÉ : Render de la carte salaire avec sélection
  const renderSalaryCard = ({ item }) => {
    const isSelected = selectedSalaries.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.salaryCard,
          isSelected && bulkPaymentMode && styles.salaryCardSelected,
          isMobile && styles.salaryCardMobile
        ]}
        onPress={() => {
          if (bulkPaymentMode && item.statut_paiement === 'calculé') {
            toggleSalarySelection(item.id);
          } else {
            setSelectedSalary(item);
            setPaymentModalVisible(true);
          }
        }}
      >
        {/* Checkbox pour sélection multiple */}
        {bulkPaymentMode && item.statut_paiement === 'calculé' && (
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => toggleSalarySelection(item.id)}
          />
        )}

        <View style={styles.salaryHeader}>
          <Avatar.Image 
            size={isMobile ? 35 : 40}
            source={{ uri: item.employee_photo || 'https://via.placeholder.com/40' }}
          />
          <View style={styles.salaryEmployeeInfo}>
            <Text style={[styles.salaryName, isMobile && styles.salaryNameMobile]}>
              {item.employee_name}
            </Text>
            <Text style={styles.salaryMatricule}>{item.matricule}</Text>
          </View>
          <Chip 
            style={[styles.salaryStatusChip, { 
              backgroundColor: getSalaryStatusColor(item.statut_paiement) 
            }]}
            textStyle={{ color: '#FFF', fontSize: isMobile ? 10 : 11 }}
          >
            {item.statut_paiement}
          </Chip>
        </View>

        <Divider style={styles.salaryDivider} />

        <View style={styles.salaryDetails}>
          <View style={styles.salaryRow}>
            <Text style={[styles.salaryLabel, isMobile && styles.salaryLabelMobile]}>
              Salaire brut:
            </Text>
            <Text style={[styles.salaryValue, isMobile && styles.salaryValueMobile]}>
              {formatCurrency(item.salaire_brut)}
            </Text>
          </View>
          <View style={styles.salaryRow}>
            <Text style={[styles.salaryLabel, isMobile && styles.salaryLabelMobile]}>
              Déductions:
            </Text>
            <Text style={[styles.salaryValue, { color: '#E74C3C' }, isMobile && styles.salaryValueMobile]}>
              - {formatCurrency(item.total_deductions)}
            </Text>
          </View>
          <View style={styles.salaryRow}>
            <Text style={[styles.salaryLabel, isMobile && styles.salaryLabelMobile]}>
              Additions:
            </Text>
            <Text style={[styles.salaryValue, { color: '#2ECC71' }, isMobile && styles.salaryValueMobile]}>
              + {formatCurrency(item.total_additions)}
            </Text>
          </View>
          <Divider style={styles.salaryDivider} />
          <View style={styles.salaryRow}>
            <Text style={[
              styles.salaryLabel, 
              { fontWeight: 'bold', fontSize: isMobile ? 14 : 16 }
            ]}>
              Salaire net:
            </Text>
            <Text style={[
              styles.salaryValue, 
              { fontWeight: 'bold', fontSize: isMobile ? 16 : 18, color: '#2ECC71' }
            ]}>
              {formatCurrency(item.salaire_net)}
            </Text>
          </View>
        </View>

        {/* Actions individuelles */}
        {item.statut_paiement === 'calculé' && !bulkPaymentMode && (
          <View style={styles.salaryActions}>
            <Button
              mode="contained"
              onPress={() => handlePaySingleSalary(item.id)}
              icon="check-circle"
              style={styles.paySalaryButton}
              compact={isMobile}
            >
              {isMobile ? 'Payer' : 'Marquer comme payé'}
            </Button>
          </View>
        )}

        {/* NOUVELLE: Afficher si confirmation manquante */}
        {item.statut_paiement === 'payé' && !item.confirme_reception && (
          <View style={styles.salaryWarning}>
            <MaterialIcons name="warning" size={16} color="#F39C12" />
            <Text style={styles.salaryWarningText}>Confirmation en attente</Text>
            <Button
              mode="text"
              onPress={() => handleSendReminder(item.id)}
              compact
              labelStyle={{ fontSize: 11 }}
            >
              Rappeler
            </Button>
          </View>
        )}

        <View style={[styles.salaryFooter, isMobile && styles.salaryFooterMobile]}>
          <Text style={styles.salaryFooterText}>
            Heures: {parseFloat(item.heures_travaillees || 0).toFixed(1)}h
          </Text>
          <Text style={styles.salaryFooterText}>
            Mode: {getPaymentModeLabel(item.mode_paiement)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // NOUVELLE FONCTIONNALITÉ : Toggle sélection salaire
  const toggleSalarySelection = (id) => {
    setSelectedSalaries(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // NOUVELLE FONCTIONNALITÉ : Payer un salaire individuel
  const handlePaySingleSalary = async (salaryId) => {
    Alert.alert(
      'Confirmer le paiement',
      'Marquer ce salaire comme payé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await apiClient.post(`/manager/salaries/${salaryId}/pay`, {
                mode_paiement: 'virement',
                date_paiement: new Date().toISOString().split('T')[0]
              });
              Alert.alert('Succès', 'Salaire payé avec succès');
              loadSalaries();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de payer le salaire');
            }
          }
        }
      ]
    );
  };

  // NOUVELLE FONCTIONNALITÉ : Payer plusieurs salaires
  const handlePayMultipleSalaries = async () => {
    if (selectedSalaries.length === 0) {
      Alert.alert('Aucune sélection', 'Veuillez sélectionner des salaires à payer');
      return;
    }

    const totalAmount = salaries
      .filter(s => selectedSalaries.includes(s.id))
      .reduce((sum, s) => sum + parseFloat(s.salaire_net), 0);

    Alert.alert(
      'Paiement groupé',
      `Payer ${selectedSalaries.length} salaire(s) pour un total de ${formatCurrency(totalAmount)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.post('/manager/salaries/pay-multiple', {
                salary_ids: selectedSalaries,
                mode_paiement: paymentMode,
                date_paiement: new Date().toISOString().split('T')[0],
                notes: paymentNotes
              });
              Alert.alert('Succès', `${selectedSalaries.length} salaire(s) payé(s) avec succès`);
              setSelectedSalaries([]);
              setBulkPaymentMode(false);
              setPaymentNotes('');
              loadSalaries();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de payer les salaires');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // NOUVELLE FONCTIONNALITÉ : Envoyer un rappel de confirmation
  const handleSendReminder = async (salaryId) => {
    try {
      await apiClient.post(`/manager/salaries/${salaryId}/send-reminder`);
      Alert.alert('Succès', 'Rappel envoyé à l\'employé');
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Impossible d\'envoyer le rappel');
    }
  };

  // NOUVELLE FONCTIONNALITÉ : Render des demandes de paiement
  const renderPaymentRequestCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.paymentRequestCard, isMobile && styles.paymentRequestCardMobile]}
      onPress={() => {
        setSelectedPaymentRequest(item);
        setPaymentRequestModalVisible(true);
      }}
    >
      <View style={styles.paymentRequestHeader}>
        <Avatar.Image 
          size={isMobile ? 35 : 40}
          source={{ uri: item.employe_photo || 'https://via.placeholder.com/40' }}
        />
        <View style={styles.paymentRequestInfo}>
          <Text style={[styles.paymentRequestName, isMobile && styles.paymentRequestNameMobile]}>
            {item.employe_nom}
          </Text>
          <Text style={styles.paymentRequestMatricule}>{item.matricule}</Text>
          <Text style={styles.paymentRequestAmount}>
            {formatCurrency(item.montant)}
          </Text>
        </View>
        <View style={styles.paymentRequestBadges}>
          <Chip 
            style={[styles.paymentRequestStatusChip, { 
              backgroundColor: getPaymentRequestStatusColor(item.statut) 
            }]}
            textStyle={{ color: '#FFF', fontSize: isMobile ? 10 : 11 }}
          >
            {item.statut}
          </Chip>
          {item.jours_attente > 2 && (
            <Badge style={styles.urgentBadge} size={isMobile ? 18 : 20}>
              {item.jours_attente}j
            </Badge>
          )}
        </View>
      </View>

      <Divider style={{ marginVertical: 8 }} />

      <View style={styles.paymentRequestDetails}>
        <View style={styles.paymentRequestRow}>
          <MaterialIcons name="calendar-today" size={14} color="#7F8C8D" />
          <Text style={[styles.paymentRequestText, isMobile && styles.paymentRequestTextMobile]}>
            Demandé le {formatDate(item.date_demande)}
          </Text>
        </View>
        <View style={styles.paymentRequestRow}>
          <MaterialIcons name="attach-money" size={14} color="#2ECC71" />
          <Text style={[styles.paymentRequestText, isMobile && styles.paymentRequestTextMobile]}>
            Salaire net: {formatCurrency(item.salaire_net)}
          </Text>
        </View>
        {item.motif && (
          <View style={styles.paymentRequestRow}>
            <MaterialIcons name="comment" size={14} color="#95A5A6" />
            <Text 
              style={[styles.paymentRequestText, isMobile && styles.paymentRequestTextMobile]} 
              numberOfLines={2}
            >
              {item.motif}
            </Text>
          </View>
        )}
      </View>

      {/* Actions pour demandes en attente */}
      {item.statut === 'en_attente' && (
        <View style={[styles.paymentRequestActions, isMobile && styles.paymentRequestActionsMobile]}>
          <Button
            mode="contained"
            onPress={() => handleProcessPaymentRequest(item.id, 'approve')}
            icon="check"
            style={[styles.paymentRequestButton, { backgroundColor: '#2ECC71' }]}
            compact={isMobile}
          >
            Approuver & Payer
          </Button>
          <Button
            mode="outlined"
            onPress={() => handleProcessPaymentRequest(item.id, 'reject')}
            icon="close"
            style={[styles.paymentRequestButton, { borderColor: '#E74C3C' }]}
            textColor="#E74C3C"
            compact={isMobile}
          >
            Rejeter
          </Button>
        </View>
      )}
    </TouchableOpacity>
  );

  // NOUVELLE FONCTIONNALITÉ : Traiter une demande de paiement
  const handleProcessPaymentRequest = async (requestId, action) => {
    const request = paymentRequests.find(r => r.id === requestId);
    
    const title = action === 'approve' 
      ? 'Approuver et payer' 
      : 'Rejeter la demande';
    
    const message = action === 'approve'
      ? `Approuver et payer le salaire de ${request.employe_nom} (${formatCurrency(request.montant)}) ?`
      : `Rejeter la demande de ${request.employe_nom} ?`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approuver & Payer' : 'Rejeter',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.post(`/manager/payment-requests/${requestId}/process`, {
                action,
                mode_paiement: 'virement',
                commentaire: action === 'reject' ? 'Demande rejetée' : undefined
              });
              Alert.alert(
                'Succès', 
                action === 'approve' 
                  ? 'Demande approuvée et salaire payé' 
                  : 'Demande rejetée'
              );
              loadPaymentRequests();
              loadSalaries();
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.error || 'Impossible de traiter la demande');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getPaymentRequestStatusColor = (status) => {
    switch(status) {
      case 'en_attente': return '#F39C12';
      case 'approuve': return '#2ECC71';
      case 'rejete': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const renderPaymentModal = () => (
    <Portal>
      <Modal
        visible={paymentModalVisible}
        onDismiss={() => setPaymentModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer, 
          styles.paymentModal,
          isMobile && styles.modalContainerMobile
        ]}
      >
        {selectedSalary && (
          <ScrollView>
            <View style={styles.paymentModalContent}>
              <Text style={styles.paymentModalTitle}>Détails du Salaire</Text>
              <Text style={styles.paymentModalSubtitle}>
                {selectedSalary.employee_name}
              </Text>

              <View style={styles.paymentDetailSection}>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Salaire brut:</Text>
                  <Text style={styles.paymentDetailValue}>
                    {formatCurrency(selectedSalary.salaire_brut)}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <Text style={styles.paymentSectionTitle}>Déductions</Text>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>INSS:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#E74C3C' }]}>
                    - {formatCurrency(selectedSalary.deduction_inss)}
                  </Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Impôts:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#E74C3C' }]}>
                    - {formatCurrency(selectedSalary.deduction_impots)}
                  </Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Autres déductions:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#E74C3C' }]}>
                    - {formatCurrency(selectedSalary.autres_deductions)}
                  </Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Avances:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#E74C3C' }]}>
                    - {formatCurrency(selectedSalary.avances)}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <Text style={styles.paymentSectionTitle}>Additions</Text>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Primes:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#2ECC71' }]}>
                    + {formatCurrency(selectedSalary.primes)}
                  </Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Indemnités:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#2ECC71' }]}>
                    + {formatCurrency(selectedSalary.indemnites)}
                  </Text>
                </View>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Commissions:</Text>
                  <Text style={[styles.paymentDetailValue, { color: '#2ECC71' }]}>
                    + {formatCurrency(selectedSalary.commissions)}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.paymentDetailRow}>
                  <Text style={[styles.paymentDetailLabel, { fontWeight: 'bold', fontSize: 16 }]}>
                    Salaire Net:
                  </Text>
                  <Text style={[styles.paymentDetailValue, { fontWeight: 'bold', fontSize: 18, color: '#2ECC71' }]}>
                    {formatCurrency(selectedSalary.salaire_net)}
                  </Text>
                </View>
              </View>

              <View style={[styles.paymentModalActions, isMobile && styles.paymentModalActionsMobile]}>
                <Button
                  mode="outlined"
                  onPress={() => setPaymentModalVisible(false)}
                  style={styles.paymentModalButton}
                  compact={isMobile}
                >
                  Fermer
                </Button>
                {selectedSalary.statut_paiement === 'calculé' && (
                  <Button
                    mode="contained"
                    onPress={() => {
                      setPaymentModalVisible(false);
                      handlePaySingleSalary(selectedSalary.id);
                    }}
                    style={[styles.paymentModalButton, styles.paymentConfirmButton]}
                    buttonColor="#2ECC71"
                    compact={isMobile}
                  >
                    Payer
                  </Button>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  // Ajouter cette fonction de rendu après renderPaymentModal()

const renderPaymentRequestModal = () => (
  <Portal>
    <Modal
      visible={paymentRequestModalVisible}
      onDismiss={() => {
        setPaymentRequestModalVisible(false);
        setSelectedPaymentRequest(null);
      }}
      contentContainerStyle={[
        styles.modalContainer,
        styles.paymentRequestModal,
        isMobile && styles.modalContainerMobile
      ]}
    >
      {selectedPaymentRequest && (
        <ScrollView showsVerticalScrollIndicator={!isWeb}>
          {/* Header */}
          <View style={styles.paymentRequestModalHeader}>
            <View style={styles.paymentRequestModalHeaderLeft}>
              <Avatar.Image 
                size={isMobile ? 50 : 60}
                source={{ uri: selectedPaymentRequest.employe_photo || 'https://via.placeholder.com/60' }}
              />
              <View style={styles.paymentRequestModalHeaderInfo}>
                <Title style={isMobile && styles.modalTitleMobile}>
                  {selectedPaymentRequest.employe_nom}
                </Title>
                <Paragraph>{selectedPaymentRequest.matricule}</Paragraph>
                <Chip 
                  style={[
                    styles.paymentRequestModalStatusChip, 
                    { backgroundColor: getPaymentRequestStatusColor(selectedPaymentRequest.statut) }
                  ]}
                  textStyle={{ color: '#FFF', fontSize: 12 }}
                >
                  {selectedPaymentRequest.statut}
                </Chip>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setPaymentRequestModalVisible(false);
                setSelectedPaymentRequest(null);
              }}
            >
              <MaterialIcons name="close" size={24} color="#7F8C8D" />
            </TouchableOpacity>
          </View>

          <Divider />

          {/* Informations de la demande */}
          <View style={styles.modalSection}>
            <Text style={styles.sectionTitle}>Informations de la Demande</Text>
            
            <View style={styles.paymentRequestModalInfoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="calendar-today" size={20} color="#3498DB" />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Date de demande</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(selectedPaymentRequest.date_demande)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="access-time" size={20} color="#F39C12" />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Délai d'attente</Text>
                  <Text style={[
                    styles.infoValue,
                    selectedPaymentRequest.jours_attente > 5 && { color: '#E74C3C' }
                  ]}>
                    {selectedPaymentRequest.jours_attente} jour(s)
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="event" size={20} color="#9B59B6" />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoLabel}>Période</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedPaymentRequest.annee, selectedPaymentRequest.mois - 1).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </View>

              {selectedPaymentRequest.motif && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="comment" size={20} color="#95A5A6" />
                  <View style={styles.infoRowContent}>
                    <Text style={styles.infoLabel}>Motif</Text>
                    <Text style={[styles.infoValue, { fontStyle: 'italic' }]}>
                      {selectedPaymentRequest.motif}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <Divider />

          {/* Détails du salaire */}
          <View style={styles.modalSection}>
            <Text style={styles.sectionTitle}>Détails du Salaire</Text>
            
            <View style={styles.paymentRequestModalSalaryCard}>
              <View style={styles.salaryDetailRow}>
                <Text style={styles.salaryDetailLabel}>Salaire brut:</Text>
                <Text style={styles.salaryDetailValue}>
                  {formatCurrency(selectedPaymentRequest.salaire_brut)}
                </Text>
              </View>

              <View style={styles.salaryDetailRow}>
                <Text style={styles.salaryDetailLabel}>Total déductions:</Text>
                <Text style={[styles.salaryDetailValue, { color: '#E74C3C' }]}>
                  - {formatCurrency(selectedPaymentRequest.total_deductions)}
                </Text>
              </View>

              <View style={styles.salaryDetailRow}>
                <Text style={styles.salaryDetailLabel}>Total additions:</Text>
                <Text style={[styles.salaryDetailValue, { color: '#2ECC71' }]}>
                  + {formatCurrency(selectedPaymentRequest.total_additions)}
                </Text>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              <View style={styles.salaryDetailRow}>
                <Text style={[styles.salaryDetailLabel, styles.salaryNetLabel]}>
                  Salaire net (montant demandé):
                </Text>
                <Text style={[styles.salaryDetailValue, styles.salaryNetValue]}>
                  {formatCurrency(selectedPaymentRequest.montant)}
                </Text>
              </View>
            </View>
          </View>

          <Divider />

          {/* Historique et notes */}
          {selectedPaymentRequest.commentaire && (
            <>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Commentaires</Text>
                <View style={styles.commentaireCard}>
                  <MaterialIcons name="info" size={20} color="#3498DB" />
                  <Text style={styles.commentaireText}>
                    {selectedPaymentRequest.commentaire}
                  </Text>
                </View>
              </View>
              <Divider />
            </>
          )}

          {/* Actions selon le statut */}
          <View style={styles.modalSection}>
            {selectedPaymentRequest.statut === 'en_attente' ? (
              <View style={styles.paymentRequestModalActions}>
                <Text style={styles.sectionTitle}>Actions</Text>
                
                <View style={[
                  styles.paymentRequestModalButtonsContainer,
                  isMobile && styles.paymentRequestModalButtonsContainerMobile
                ]}>
                  <Button
                    mode="contained"
                    onPress={() => {
                      setPaymentRequestModalVisible(false);
                      handleProcessPaymentRequest(selectedPaymentRequest.id, 'approve');
                    }}
                    icon="check-circle"
                    style={[styles.paymentRequestModalButton, styles.approveButton]}
                    buttonColor="#2ECC71"
                    contentStyle={styles.buttonContent}
                    labelStyle={isMobile && styles.buttonLabelMobile}
                  >
                    Approuver & Payer
                  </Button>

                  <Button
                    mode="outlined"
                    onPress={() => {
                      setPaymentRequestModalVisible(false);
                      Alert.alert(
                        'Rejeter la demande',
                        `Voulez-vous vraiment rejeter la demande de ${selectedPaymentRequest.employe_nom} ?`,
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Rejeter',
                            style: 'destructive',
                            onPress: () => handleProcessPaymentRequest(selectedPaymentRequest.id, 'reject')
                          }
                        ]
                      );
                    }}
                    icon="close-circle"
                    style={[styles.paymentRequestModalButton, styles.rejectButton]}
                    textColor="#E74C3C"
                    contentStyle={styles.buttonContent}
                    labelStyle={isMobile && styles.buttonLabelMobile}
                  >
                    Rejeter
                  </Button>
                </View>

                {/* Alert si urgence */}
                {selectedPaymentRequest.jours_attente > 5 && (
                  <Surface style={styles.urgencyAlert}>
                    <MaterialIcons name="warning" size={20} color="#E74C3C" />
                    <Text style={styles.urgencyAlertText}>
                      Cette demande est en attente depuis {selectedPaymentRequest.jours_attente} jours. 
                      Veuillez la traiter rapidement.
                    </Text>
                  </Surface>
                )}
              </View>
            ) : (
              <View style={styles.paymentRequestModalStatusInfo}>
                <MaterialIcons 
                  name={selectedPaymentRequest.statut === 'approuve' ? 'check-circle' : 'cancel'} 
                  size={48} 
                  color={selectedPaymentRequest.statut === 'approuve' ? '#2ECC71' : '#E74C3C'} 
                />
                <Text style={styles.statusInfoText}>
                  {selectedPaymentRequest.statut === 'approuve' 
                    ? 'Cette demande a été approuvée et le salaire a été payé.'
                    : 'Cette demande a été rejetée.'}
                </Text>
                {selectedPaymentRequest.date_traitement && (
                  <Text style={styles.statusInfoDate}>
                    Traitée le {formatDate(selectedPaymentRequest.date_traitement)}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Bouton fermer en bas */}
          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={() => {
                setPaymentRequestModalVisible(false);
                setSelectedPaymentRequest(null);
              }}
              style={styles.closeButton}
              icon="close"
            >
              Fermer
            </Button>
          </View>
        </ScrollView>
      )}
    </Modal>
  </Portal>
);

// Appeler ce modal dans le return du composant principal, après renderPaymentModal()
// {renderPaymentRequestModal()}

  const getSalaryStatusColor = (status) => {
    switch(status) {
      case 'calculé': return '#F39C12';
      case 'payé': return '#2ECC71';
      case 'reporté': return '#3498DB';
      case 'annulé': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getPaymentModeLabel = (mode) => {
    const modes = {
      'virement': 'Virement',
      'cheque': 'Chèque',
      'especes': 'Espèces'
    };
    return modes[mode] || mode || '-';
  };

  const renderSalairesTab = () => (
    <View style={styles.tabContainer}>
      {/* Sélecteur de période */}
      <View style={[styles.periodSelector, isMobile && styles.periodSelectorMobile]}>
        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
            const newYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
            setSelectedMonth(newMonth);
            setSelectedYear(newYear);
          }}
        >
          <MaterialIcons name="chevron-left" size={24} color="#3498DB" />
        </TouchableOpacity>

        <View style={styles.periodDisplay}>
          <Text style={[styles.periodText, isMobile && styles.periodTextMobile]}>
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric'
            })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const currentDate = new Date();
            const maxMonth = currentDate.getMonth() + 1;
            const maxYear = currentDate.getFullYear();
            
            if (selectedYear < maxYear || (selectedYear === maxYear && selectedMonth < maxMonth)) {
              const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
              const newYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
              setSelectedMonth(newMonth);
              setSelectedYear(newYear);
            }
          }}
        >
          <MaterialIcons name="chevron-right" size={24} color="#3498DB" />
        </TouchableOpacity>
      </View>

      {/* NOUVELLE: Barre d'actions pour paiement groupé */}
      <Surface style={[styles.bulkPaymentBar, isMobile && styles.bulkPaymentBarMobile]}>
        {!bulkPaymentMode ? (
          <View style={styles.bulkPaymentBarContent}>
            <Button
              mode="contained"
              onPress={() => setBulkPaymentMode(true)}
              icon="checkbox-multiple-marked"
              compact={isMobile}
            >
              {isMobile ? 'Paiement groupé' : 'Activer paiement groupé'}
            </Button>
          </View>
        ) : (
          <View style={[styles.bulkPaymentBarContent, styles.bulkPaymentBarActive]}>
            <Text style={styles.bulkPaymentBarText}>
              {selectedSalaries.length} sélectionné(s)
            </Text>
            <View style={styles.bulkPaymentBarActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setBulkPaymentMode(false);
                  setSelectedSalaries([]);
                }}
                compact={isMobile}
              >
                Annuler
              </Button>
              <Button
                mode="contained"
                onPress={handlePayMultipleSalaries}
                icon="check-all"
                disabled={selectedSalaries.length === 0}
                buttonColor="#2ECC71"
                compact={isMobile}
              >
                Payer ({selectedSalaries.length})
              </Button>
            </View>
          </View>
        )}
      </Surface>

      {/* Tabs: Salaires / Demandes de paiement */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeTab === 'salaires' && !paymentRequestsFilter && styles.activeSubTab
          ]}
          onPress={() => setPaymentRequestsFilter(null)}
        >
          <Text style={[
            styles.subTabText,
            activeTab === 'salaires' && !paymentRequestsFilter && styles.activeSubTabText
          ]}>
            Salaires
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.subTab,
            paymentRequestsFilter && styles.activeSubTab
          ]}
          onPress={() => setPaymentRequestsFilter('en_attente')}
        >
          <Text style={[
            styles.subTabText,
            paymentRequestsFilter && styles.activeSubTabText
          ]}>
            Demandes de paiement
          </Text>
          {paymentRequests.filter(r => r.statut === 'en_attente').length > 0 && (
            <Badge style={styles.subTabBadge}>
              {paymentRequests.filter(r => r.statut === 'en_attente').length}
            </Badge>
          )}
        </TouchableOpacity>
      </View>

      {/* Affichage conditionnel: Salaires ou Demandes */}
      {!paymentRequestsFilter ? (
        <>
          {/* Résumé des salaires */}
          <Card style={styles.salarySummaryCard}>
            <Card.Content>
              <View style={[styles.salarySummaryGrid, isMobile && styles.salarySummaryGridMobile]}>
                <View style={styles.salarySummaryItem}>
                  <MaterialIcons name="people" size={isMobile ? 20 : 24} color="#3498DB" />
                  <Text style={[styles.salarySummaryValue, isMobile && styles.salarySummaryValueMobile]}>
                    {salaries.length}
                  </Text>
                  <Text style={styles.salarySummaryLabel}>Employés</Text>
                </View>
                <View style={styles.salarySummaryItem}>
                  <MaterialIcons name="attach-money" size={isMobile ? 20 : 24} color="#2ECC71" />
                  <Text style={[styles.salarySummaryValue, isMobile && styles.salarySummaryValueMobile]}>
                    {formatCurrency(salaries.reduce((sum, s) => sum + parseFloat(s.salaire_net || 0), 0))}
                  </Text>
                  <Text style={styles.salarySummaryLabel}>Total net</Text>
                </View>
                <View style={styles.salarySummaryItem}>
                  <MaterialIcons name="check-circle" size={isMobile ? 20 : 24} color="#2ECC71" />
                  <Text style={[styles.salarySummaryValue, isMobile && styles.salarySummaryValueMobile]}>
                    {salaries.filter(s => s.statut_paiement === 'payé').length}
                  </Text>
                  <Text style={styles.salarySummaryLabel}>Payés</Text>
                </View>
                <View style={styles.salarySummaryItem}>
                  <MaterialIcons name="pending" size={isMobile ? 20 : 24} color="#F39C12" />
                  <Text style={[styles.salarySummaryValue, isMobile && styles.salarySummaryValueMobile]}>
                    {salaries.filter(s => s.statut_paiement === 'calculé').length}
                  </Text>
                  <Text style={styles.salarySummaryLabel}>En attente</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Liste des salaires */}
          <FlatList
            data={salaries}
            renderItem={renderSalaryCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.salaryList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="money-off" size={60} color="#BDC3C7" />
                <Text style={styles.emptyText}>Aucun salaire pour cette période</Text>
              </View>
            }
          />
        </>
      ) : (
        <>
          {/* Filtres demandes de paiement */}
          <View style={styles.paymentRequestFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip
                selected={paymentRequestsFilter === 'en_attente'}
                onPress={() => setPaymentRequestsFilter('en_attente')}
                style={styles.filterChip}
                selectedColor="#F39C12"
              >
                En attente
              </Chip>
              <Chip
                selected={paymentRequestsFilter === 'approuve'}
                onPress={() => setPaymentRequestsFilter('approuve')}
                style={styles.filterChip}
                selectedColor="#2ECC71"
              >
                Approuvées
              </Chip>
              <Chip
                selected={paymentRequestsFilter === 'rejete'}
                onPress={() => setPaymentRequestsFilter('rejete')}
                style={styles.filterChip}
                selectedColor="#E74C3C"
              >
                Rejetées
              </Chip>
              <Chip
                selected={paymentRequestsFilter === 'all'}
                onPress={() => setPaymentRequestsFilter('all')}
                style={styles.filterChip}
              >
                Toutes
              </Chip>
            </ScrollView>
          </View>

          {/* Liste des demandes de paiement */}
          <FlatList
            data={paymentRequests}
            renderItem={renderPaymentRequestCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.paymentRequestList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="request-page" size={60} color="#BDC3C7" />
                <Text style={styles.emptyText}>Aucune demande de paiement</Text>
              </View>
            }
          />
        </>
      )}

      {renderPaymentModal()}
    </View>
  );

  // =============== PERFORMANCE ===============
  const renderPerformanceChart = () => {
    if (!performanceData || performanceData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="bar-chart" size={60} color="#BDC3C7" />
          <Text style={styles.emptyText}>Aucune donnée de performance disponible</Text>
        </View>
      );
    }

    const filteredData = performanceFilter === 'all' 
      ? performanceData 
      : performanceData.filter(item => {
          if (performanceFilter === 'top') {
            return (item.avg_score || 0) >= 7;
          } else if (performanceFilter === 'low') {
            return (item.avg_score || 0) < 5;
          }
          return true;
        });

    const chartData = {
      labels: filteredData.slice(0, 10).map(item => 
        item.nom_complet.split(' ')[0].substring(0, 8)
      ),
      datasets: [{
        data: filteredData.slice(0, 10).map(item => item.avg_score || 0)
      }]
    };

    const chartWidth = isMobile 
      ? screenWidth - 40 
      : Math.max(screenWidth - 60, filteredData.length * 50);

    return (
      <View>
        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={isMobile && styles.chartTitleMobile}>Score de Performance</Title>
            <Paragraph style={isMobile && styles.chartParagraphMobile}>
              Top 10 employés par score moyen
            </Paragraph>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={!isWeb}>
              <BarChart
                data={chartData}
                width={chartWidth}
                height={isMobile ? 180 : 220}
                yAxisLabel=""
                yAxisSuffix="/10"
                chartConfig={{
                  backgroundColor: '#FFF',
                  backgroundGradientFrom: '#FFF',
                  backgroundGradientTo: '#FFF',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(46, 134, 193, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForLabels: {
                    fontSize: isMobile ? 8 : 10
                  }
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
                fromZero
              />
            </ScrollView>
          </Card.Content>
        </Card>

        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={isMobile && styles.chartTitleMobile}>Taux de Présence</Title>
            <Paragraph style={isMobile && styles.chartParagraphMobile}>
              Répartition des taux de présence
            </Paragraph>
            
            <View style={styles.presenceDistribution}>
              {filteredData.slice(0, 5).map((item, index) => (
                <View key={index} style={styles.presenceDistributionItem}>
                  <Avatar.Image 
                    size={isMobile ? 35 : 40}
                    source={{ uri: item.photo_identite || 'https://via.placeholder.com/40' }}
                  />
                  <View style={styles.presenceDistributionInfo}>
                    <Text style={[
                      styles.presenceDistributionName,
                      isMobile && styles.presenceDistributionNameMobile
                    ]}>
                      {item.nom_complet}
                    </Text>
                    <ProgressBar 
                      progress={(item.presence_rate || 0) / 100} 
                      color={getPresenceRateColor(item.presence_rate)}
                      style={styles.progressBar}
                    />
                    <Text style={styles.presenceDistributionValue}>
                      {Math.round(item.presence_rate || 0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderPerformanceCards = () => {
    if (!performanceData || performanceData.length === 0) {
      return null;
    }

    const filteredData = performanceFilter === 'all' 
      ? performanceData 
      : performanceData.filter(item => {
          if (performanceFilter === 'top') {
            return (item.avg_score || 0) >= 7;
          } else if (performanceFilter === 'low') {
            return (item.avg_score || 0) < 5;
          }
          return true;
        });

    return (
      <View style={styles.performanceCardsContainer}>
        {filteredData.map((item, index) => (
          <Card key={index} style={[styles.performanceEmployeeCard, isMobile && styles.performanceEmployeeCardMobile]}>
            <Card.Content>
              <View style={styles.performanceEmployeeHeader}>
                <Avatar.Image 
                  size={isMobile ? 40 : 50}
                  source={{ uri: item.photo_identite || 'https://via.placeholder.com/50' }}
                />
                <View style={styles.performanceEmployeeInfo}>
                  <Text style={[styles.performanceEmployeeName, isMobile && styles.performanceEmployeeNameMobile]}>
                    {item.nom_complet}
                  </Text>
                  <View style={styles.performanceScoreBadge}>
                    <MaterialIcons name="star" size={isMobile ? 14 : 16} color="#F39C12" />
                    <Text style={[styles.performanceScoreText, isMobile && styles.performanceScoreTextMobile]}>
                      {(item.avg_score || 0).toFixed(1)}/10
                    </Text>
                  </View>
                </View>
                <View style={styles.performanceRank}>
                  <Text style={[styles.performanceRankText, isMobile && styles.performanceRankTextMobile]}>
                    #{index + 1}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              <View style={styles.performanceMetrics}>
                <View style={styles.performanceMetric}>
                  <MaterialIcons name="event-available" size={isMobile ? 18 : 20} color="#2ECC71" />
                  <Text style={[styles.performanceMetricLabel, isMobile && styles.performanceMetricLabelMobile]}>
                    Présence
                  </Text>
                  <Text style={[styles.performanceMetricValue, isMobile && styles.performanceMetricValueMobile]}>
                    {Math.round(item.presence_rate || 0)}%
                  </Text>
                </View>
                <View style={styles.performanceMetric}>
                  <MaterialIcons name="schedule" size={isMobile ? 18 : 20} color="#3498DB" />
                  <Text style={[styles.performanceMetricLabel, isMobile && styles.performanceMetricLabelMobile]}>
                    Heures
                  </Text>
                  <Text style={[styles.performanceMetricValue, isMobile && styles.performanceMetricValueMobile]}>
                    {Math.round(item.total_hours || 0)}h
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  };

  const getPresenceRateColor = (rate) => {
    if (rate >= 90) return '#2ECC71';
    if (rate >= 75) return '#F39C12';
    return '#E74C3C';
  };

  const renderPerformanceTab = () => (
    <ScrollView 
      style={styles.tabContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Filtres */}
      <View style={styles.performanceFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip
            selected={performanceFilter === 'all'}
            onPress={() => setPerformanceFilter('all')}
            style={styles.filterChip}
          >
            Tous
          </Chip>
          <Chip
            selected={performanceFilter === 'top'}
            onPress={() => setPerformanceFilter('top')}
            style={styles.filterChip}
            selectedColor="#2ECC71"
          >
            Performants (≥7)
          </Chip>
          <Chip
            selected={performanceFilter === 'low'}
            onPress={() => setPerformanceFilter('low')}
            style={styles.filterChip}
            selectedColor="#E74C3C"
          >
            À améliorer (&lt;5)
          </Chip>
        </ScrollView>
      </View>

      {/* Stats globales */}
      <Card style={styles.performanceStatsCard}>
        <Card.Content>
          <Title style={isMobile && styles.performanceStatsTitleMobile}>
            Statistiques de l'Équipe
          </Title>
          <View style={[styles.performanceStatsGrid, isMobile && styles.performanceStatsGridMobile]}>
            <View style={styles.performanceStatItem}>
              <MaterialIcons name="star" size={isMobile ? 24 : 30} color="#F39C12" />
              <Text style={[styles.performanceStatValue, isMobile && styles.performanceStatValueMobile]}>
                {performanceData.length > 0 
                  ? (performanceData.reduce((sum, item) => sum + (item.avg_score || 0), 0) / performanceData.length).toFixed(1)
                  : '0.0'
                }
              </Text>
              <Text style={styles.performanceStatLabel}>Score Moyen</Text>
            </View>
            <View style={styles.performanceStatItem}>
              <MaterialIcons name="event-available" size={isMobile ? 24 : 30} color="#2ECC71" />
              <Text style={[styles.performanceStatValue, isMobile && styles.performanceStatValueMobile]}>
                {performanceData.length > 0 
                  ? Math.round(performanceData.reduce((sum, item) => sum + (item.presence_rate || 0), 0) / performanceData.length)
                  : 0
                }%
              </Text>
              <Text style={styles.performanceStatLabel}>Présence Moyenne</Text>
            </View>
            <View style={styles.performanceStatItem}>
              <MaterialIcons name="schedule" size={isMobile ? 24 : 30} color="#3498DB" />
              <Text style={[styles.performanceStatValue, isMobile && styles.performanceStatValueMobile]}>
                {performanceData.length > 0 
                  ? Math.round(performanceData.reduce((sum, item) => sum + (item.total_hours || 0), 0) / performanceData.length)
                  : 0
                }h
              </Text>
              <Text style={styles.performanceStatLabel}>Heures Moyennes</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Graphiques */}
      {renderPerformanceChart()}

      {/* Cartes individuelles */}
      {renderPerformanceCards()}
    </ScrollView>
  );

  // =============== HELPERS ===============
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' BIF';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'actif': return '#2ECC71';
      case 'congé': return '#F39C12';
      case 'inactif': return '#E74C3C';
      case 'suspendu': return '#95A5A6';
      default: return '#7F8C8D';
    }
  };

  const getRoleLabel = (role) => {
    const roles = {
      'admin': 'Administrateur',
      'manager': 'Manager',
      'employe': 'Employé',
      'comptable': 'Comptable',
      'veterinaire': 'Vétérinaire',
      'chauffeur': 'Chauffeur',
      'agriculteur': 'Agriculteur',
      'technicien': 'Technicien'
    };
    return roles[role] || role;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      isWeb && styles.containerWeb,
      isDesktop && styles.containerDesktop
    ]}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'employes' && styles.activeTab]}
            onPress={() => setActiveTab('employes')}
          >
            <MaterialIcons 
              name="people" 
              size={isMobile ? 18 : 20} 
              color={activeTab === 'employes' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'employes' && styles.activeTabText,
              isMobile && styles.tabTextMobile
            ]}>
              Employés
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'presences' && styles.activeTab]}
            onPress={() => setActiveTab('presences')}
          >
            <MaterialIcons 
              name="event-available" 
              size={isMobile ? 18 : 20} 
              color={activeTab === 'presences' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'presences' && styles.activeTabText,
              isMobile && styles.tabTextMobile
            ]}>
              Présences
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'conges' && styles.activeTab]}
            onPress={() => setActiveTab('conges')}
          >
            <MaterialIcons 
              name="beach-access" 
              size={isMobile ? 18 : 20} 
              color={activeTab === 'conges' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'conges' && styles.activeTabText,
              isMobile && styles.tabTextMobile
            ]}>
              Congés
            </Text>
            {leaveRequests.filter(l => l.statut === 'en_attente').length > 0 && (
              <Badge style={styles.tabBadge}>
                {leaveRequests.filter(l => l.statut === 'en_attente').length}
              </Badge>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'salaires' && styles.activeTab]}
            onPress={() => setActiveTab('salaires')}
          >
            <MaterialIcons 
              name="attach-money" 
              size={isMobile ? 18 : 20} 
              color={activeTab === 'salaires' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'salaires' && styles.activeTabText,
              isMobile && styles.tabTextMobile
            ]}>
              Salaires
            </Text>
            {/* NOUVELLE: Badge pour demandes de paiement */}
            {paymentRequests.filter(r => r.statut === 'en_attente').length > 0 && (
              <Badge style={[styles.tabBadge, { backgroundColor: '#F39C12' }]}>
                {paymentRequests.filter(r => r.statut === 'en_attente').length}
              </Badge>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'performance' && styles.activeTab]}
            onPress={() => setActiveTab('performance')}
          >
            <MaterialIcons 
              name="bar-chart" 
              size={isMobile ? 18 : 20} 
              color={activeTab === 'performance' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'performance' && styles.activeTabText,
              isMobile && styles.tabTextMobile
            ]}>
              Performance
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      {activeTab === 'employes' && renderEmployeesTab()}
      {activeTab === 'presences' && renderPresencesTab()}
      {activeTab === 'conges' && renderCongesTab()}
      {activeTab === 'salaires' && renderSalairesTab()}
      {activeTab === 'performance' && renderPerformanceTab()}

      {/* Modals */}
      {renderEmployeeDetailModal()}
         {renderPaymentModal()}
      {renderPaymentRequestModal()}
    </View>
  );
};

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
  containerDesktop: {
    maxWidth: 1600,
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
    fontSize: 14,
  },
  tabBar: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2E86C1',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  tabTextMobile: {
    fontSize: 12,
    marginLeft: 6,
  },
  activeTabText: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },
  tabBadge: {
    backgroundColor: '#E74C3C',
    marginLeft: 8,
  },
  tabContainer: {
    flex: 1,
  },
  
  // Employés
  filtersContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  searchBar: {
    backgroundColor: '#F8F9F9',
    elevation: 0,
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 5,
  },
  chipDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 10,
    alignSelf: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 15,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  quickStatsMobile: {
    paddingVertical: 12,
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  quickStatValueMobile: {
    fontSize: 18,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  employeeList: {
    padding: 10,
  },
  employeeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  employeeCardDesktop: {
    flex: 1,
    marginHorizontal: 5,
  },
  employeeCardTablet: {
    marginHorizontal: 5,
  },
  employeeCardMobile: {
    padding: 12,
    marginBottom: 8,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  employeeNameMobile: {
    fontSize: 14,
  },
  employeeMatricule: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  employeeRole: {
    fontSize: 12,
    color: '#3498DB',
    marginTop: 2,
  },
  employeeBadges: {
    alignItems: 'flex-end',
  },
  statusChip: {
    height: 24,
  },
  chipText: {
    color: '#FFF',
    fontSize: 11,
  },
  employeeType: {
    fontSize: 10,
    color: '#95A5A6',
    marginTop: 4,
  },
  divider: {
    marginVertical: 10,
  },
  employeeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  employeeStatsMobile: {
    flexDirection: 'column',
    gap: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#2C3E50',
    marginLeft: 4,
  },
  statTextMobile: {
    fontSize: 11,
  },
  
  // Modal
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
  },
  modalContainerWeb: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  modalContainerDesktop: {
    maxWidth: 800,
  },
  modalContainerMobile: {
    margin: 10,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  modalHeaderInfo: {
    flex: 1,
    marginLeft: 15,
  },
  modalTitleMobile: {
    fontSize: 16,
  },
  modalSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  infoValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceGridMobile: {
    gap: 8,
  },
  performanceItem: {
    width: '48%',
    backgroundColor: '#F8F9F9',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  leaveBalance: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  leaveBalanceMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  leaveItem: {
    alignItems: 'center',
  },
  leaveValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  leaveLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  modalActions: {
    padding: 20,
    gap: 10,
  },
  actionButton: {
    marginBottom: 10,
  },
  
  // Présences
  presenceHeader: {
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  dateSelectorMobile: {
    padding: 10,
  },
  dateText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  dateTextMobile: {
    fontSize: 12,
    marginLeft: 8,
  },
  presenceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  presenceActionsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  validateButton: {
    backgroundColor: '#2ECC71',
  },
  cancelButton: {
    borderColor: '#E74C3C',
  },
  confirmButton: {
    backgroundColor: '#2ECC71',
  },
  presenceSummary: {
    margin: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryGridMobile: {
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 5,
  },
  summaryValueMobile: {
    fontSize: 16,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  presenceList: {
    padding: 10,
  },
  presenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  presenceCardSelected: {
    backgroundColor: '#E8F8F5',
    borderWidth: 2,
    borderColor: '#2ECC71',
  },
  presenceCardMobile: {
    padding: 10,
  },
  presenceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  presenceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  presenceNameMobile: {
    fontSize: 13,
  },
  presenceMatricule: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  presenceTimes: {
    marginRight: 10,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#2C3E50',
  },
  timeTextMobile: {
    fontSize: 11,
  },
  presenceStatus: {
    height: 24,
    marginRight: 8,
  },
  
  // Congés
  leaveFilters: {
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  leaveSummaryCard: {
    margin: 10,
  },
  leaveSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  leaveSummaryGridMobile: {
    flexDirection: 'column',
    gap: 15,
  },
  leaveSummaryItem: {
    alignItems: 'center',
  },
  leaveSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  leaveSummaryLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  leaveList: {
    padding: 10,
  },
  leaveRequestCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  leaveRequestCardMobile: {
    padding: 12,
  },
  leaveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveEmployeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaveName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  leaveNameMobile: {
    fontSize: 13,
  },
  leaveMatricule: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  leaveStatusChip: {
    height: 24,
  },
  leaveDetails: {
    marginBottom: 12,
  },
  leaveDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  leaveDetailText: {
    fontSize: 12,
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
  leaveDetailTextMobile: {
    fontSize: 11,
  },
  leaveActions: {
    flexDirection: 'row',
    gap: 10,
  },
  leaveActionsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  leaveActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  approveLeaveButton: {
    backgroundColor: '#2ECC71',
  },
  rejectLeaveButton: {
    backgroundColor: '#E74C3C',
  },
  leaveActionText: {
    color: '#FFF',
    marginLeft: 6,
    fontWeight: '600',
  },
  leaveActionTextMobile: {
    fontSize: 13,
  },
  rejectModal: {
    maxWidth: 400,
  },
  rejectModalContent: {
    padding: 20,
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 5,
  },
  rejectModalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 15,
  },
  rejectReasonInput: {
    marginBottom: 15,
  },
  rejectModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectModalActionsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  rejectModalButton: {
    flex: 1,
  },
  rejectConfirmButton: {
    backgroundColor: '#E74C3C',
  },
  
  // Salaires
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  periodSelectorMobile: {
    padding: 12,
  },
  periodButton: {
    padding: 8,
  },
  periodDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  periodTextMobile: {
    fontSize: 14,
  },
  
  // NOUVELLES: Styles pour paiement groupé
  bulkPaymentBar: {
    backgroundColor: '#FFF',
    padding: 12,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    elevation: 2,
  },
  bulkPaymentBarMobile: {
    padding: 10,
    marginHorizontal: 5,
  },
  bulkPaymentBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkPaymentBarActive: {
    backgroundColor: '#E8F8F5',
  },
  bulkPaymentBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  bulkPaymentBarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  
  // Sous-tabs (Salaires / Demandes)
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    paddingHorizontal: 10,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeSubTab: {
    borderBottomColor: '#2E86C1',
  },
  subTabText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  activeSubTabText: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },
  subTabBadge: {
    backgroundColor: '#F39C12',
    marginLeft: 8,
  },
  
  salarySummaryCard: {
    margin: 10,
  },
  salarySummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  salarySummaryGridMobile: {
    flexWrap: 'wrap',
    gap: 10,
  },
  salarySummaryItem: {
    alignItems: 'center',
  },
  salarySummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 5,
  },
  salarySummaryValueMobile: {
    fontSize: 12,
  },
  salarySummaryLabel: {
    fontSize: 10,
    color: '#7F8C8D',
    marginTop: 2,
    textAlign: 'center',
  },
  salaryList: {
    padding: 10,
  },
  salaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  salaryCardSelected: {
    backgroundColor: '#E8F8F5',
    borderWidth: 2,
    borderColor: '#2ECC71',
  },
  salaryCardMobile: {
    padding: 12,
  },
  salaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  salaryEmployeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  salaryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  salaryNameMobile: {
    fontSize: 13,
  },
  salaryMatricule: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  salaryStatusChip: {
    height: 24,
  },
  salaryDivider: {
    marginVertical: 8,
  },
  salaryDetails: {
    marginBottom: 10,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  salaryLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  salaryLabelMobile: {
    fontSize: 12,
  },
  salaryValue: {
    fontSize: 13,
    color: '#2C3E50',
    fontWeight: '500',
  },
  salaryValueMobile: {
    fontSize: 12,
  },
  salaryActions: {
    marginTop: 10,
  },
  paySalaryButton: {
    backgroundColor: '#2ECC71',
  },
  
  // NOUVELLE: Warning confirmation
  salaryWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 8,
  },
  salaryWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
  },
  
  salaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  salaryFooterMobile: {
    flexDirection: 'column',
    gap: 4,
  },
  salaryFooterText: {
    fontSize: 11,
    color: '#95A5A6',
  },
  paymentModal: {
    maxWidth: 500,
  },
  paymentModalContent: {
    padding: 20,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 5,
  },
  paymentModalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 15,
  },
  paymentDetailSection: {
    backgroundColor: '#F8F9F9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  paymentSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
    marginBottom: 8,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentDetailLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  paymentDetailValue: {
    fontSize: 13,
    color: '#2C3E50',
    fontWeight: '500',
  },
  paymentModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentModalActionsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  paymentModalButton: {
    flex: 1,
  },
  paymentConfirmButton: {
    backgroundColor: '#2ECC71',
  },
  
  // NOUVELLES: Styles demandes de paiement
  paymentRequestFilters: {
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  paymentRequestList: {
    padding: 10,
  },
  paymentRequestCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  paymentRequestCardMobile: {
    padding: 12,
  },
  paymentRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentRequestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentRequestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  paymentRequestNameMobile: {
    fontSize: 13,
  },
  paymentRequestMatricule: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  paymentRequestAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginTop: 4,
  },
  paymentRequestBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentRequestStatusChip: {
    height: 24,
  },
urgentBadge: {
    backgroundColor: '#E74C3C',
  },
  
  // DEMANDES DE PAIEMENT (suite)
  paymentRequestDetails: {
    marginVertical: 8,
  },
  paymentRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentRequestText: {
    fontSize: 12,
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
  paymentRequestTextMobile: {
    fontSize: 11,
  },
  paymentRequestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  paymentRequestActionsMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  paymentRequestButton: {
    flex: 1,
  },
// MODAL DEMANDE DE PAIEMENT
  paymentRequestModal: {
    maxWidth: 600,
    maxHeight: '90%',
  },
  paymentRequestModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
  },
  paymentRequestModalHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  paymentRequestModalHeaderInfo: {
    marginLeft: 15,
    flex: 1,
  },
  paymentRequestModalStatusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  
  paymentRequestModalInfoCard: {
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  infoRowContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
  
  paymentRequestModalSalaryCard: {
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
    padding: 15,
  },
  salaryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  salaryDetailLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  salaryDetailValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
  salaryNetLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  salaryNetValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  
  commentaireCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F4F8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  commentaireText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#2C3E50',
    fontStyle: 'italic',
  },
  
  paymentRequestModalActions: {
    marginTop: 10,
  },
  paymentRequestModalButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
  },
  paymentRequestModalButtonsContainerMobile: {
    flexDirection: 'column',
  },
  paymentRequestModalButton: {
    flex: 1,
  },
  approveButton: {
    backgroundColor: '#2ECC71',
  },
  rejectButton: {
    borderColor: '#E74C3C',
    borderWidth: 2,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabelMobile: {
    fontSize: 13,
  },
  
  urgencyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEAA7',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  urgencyAlertText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    color: '#2C3E50',
    fontWeight: '500',
  },
  
  paymentRequestModalStatusInfo: {
    alignItems: 'center',
    padding: 20,
  },
  statusInfoText: {
    fontSize: 14,
    color: '#2C3E50',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  statusInfoDate: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 8,
  },
  
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  closeButton: {
    borderColor: '#95A5A6',
  },
  
  // ANIMATIONS (optionnel avec Animated)
  paymentRequestModalVisible: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  paymentRequestModalHidden: {
    transform: [{ scale: 0.9 }],
    opacity: 0,
  },

  // PERFORMANCE
  performanceFilters: {
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
    marginBottom: 10,
  },
  performanceStatsCard: {
    margin: 10,
    elevation: 3,
  },
  performanceStatsTitleMobile: {
    fontSize: 16,
  },
  performanceStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  performanceStatsGridMobile: {
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceStatItem: {
    alignItems: 'center',
    minWidth: 100,
  },
  performanceStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  performanceStatValueMobile: {
    fontSize: 22,
  },
  performanceStatLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // GRAPHIQUES DE PERFORMANCE
  chartCard: {
    margin: 10,
    elevation: 2,
    marginBottom: 15,
  },
  chartTitleMobile: {
    fontSize: 16,
  },
  chartParagraphMobile: {
    fontSize: 12,
  },
  presenceDistribution: {
    marginTop: 15,
  },
  presenceDistributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
  },
  presenceDistributionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  presenceDistributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  presenceDistributionNameMobile: {
    fontSize: 13,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  presenceDistributionValue: {
    fontSize: 12,
    color: '#2ECC71',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  
  // CARTES EMPLOYÉS PERFORMANCE
  performanceCardsContainer: {
    padding: 10,
  },
  performanceEmployeeCard: {
    marginBottom: 12,
    elevation: 2,
  },
  performanceEmployeeCardMobile: {
    marginBottom: 10,
  },
  performanceEmployeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceEmployeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  performanceEmployeeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  performanceEmployeeNameMobile: {
    fontSize: 14,
  },
  performanceScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  performanceScoreText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F39C12',
    marginLeft: 4,
  },
  performanceScoreTextMobile: {
    fontSize: 12,
  },
  performanceRank: {
    backgroundColor: '#3498DB',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  performanceRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  performanceRankTextMobile: {
    fontSize: 13,
  },
  performanceMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  performanceMetric: {
    alignItems: 'center',
    flex: 1,
  },
  performanceMetricLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 6,
  },
  performanceMetricLabelMobile: {
    fontSize: 11,
  },
  performanceMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 4,
  },
  performanceMetricValueMobile: {
    fontSize: 14,
  },
  
  // EMPTY STATES
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#95A5A6',
    marginTop: 15,
    textAlign: 'center',
  },
  
  // ÉTATS GLOBAUX
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#3498DB',
  },
  
  // OVERLAYS & MODALS
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // RESPONSIVE BREAKPOINTS
  // Desktop (> 1024px)
  desktopContainer: {
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
  },
  desktopColumn: {
    flex: 1,
  },
  
  // Tablet (768px - 1024px)
  tabletContainer: {
    maxWidth: 1024,
    alignSelf: 'center',
    width: '100%',
  },
  tabletRow: {
    flexDirection: 'row',
    gap: 15,
  },
  
  // Mobile (< 768px)
  mobileContainer: {
    paddingHorizontal: 10,
  },
  mobileFullWidth: {
    width: '100%',
  },
  
  // UTILITAIRES
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shadowMedium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  shadowHeavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  
  // SPACING
  p5: { padding: 5 },
  p10: { padding: 10 },
  p15: { padding: 15 },
  p20: { padding: 20 },
  
  mt5: { marginTop: 5 },
  mt10: { marginTop: 10 },
  mt15: { marginTop: 15 },
  mt20: { marginTop: 20 },
  
  mb5: { marginBottom: 5 },
  mb10: { marginBottom: 10 },
  mb15: { marginBottom: 15 },
  mb20: { marginBottom: 20 },
  
  mx5: { marginHorizontal: 5 },
  mx10: { marginHorizontal: 10 },
  mx15: { marginHorizontal: 15 },
  mx20: { marginHorizontal: 20 },
  
  my5: { marginVertical: 5 },
  my10: { marginVertical: 10 },
  my15: { marginVertical: 15 },
  my20: { marginVertical: 20 },
  
  // FLEX UTILITIES
  flexRow: {
    flexDirection: 'row',
  },
  flexColumn: {
    flexDirection: 'column',
  },
  flexCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexBetween: {
    justifyContent: 'space-between',
  },
  flexAround: {
    justifyContent: 'space-around',
  },
  flexWrap: {
    flexWrap: 'wrap',
  },
  
  // TEXT UTILITIES
  textCenter: {
    textAlign: 'center',
  },
  textRight: {
    textAlign: 'right',
  },
  textBold: {
    fontWeight: 'bold',
  },
  textSemiBold: {
    fontWeight: '600',
  },
  
  // COLOR UTILITIES
  bgWhite: { backgroundColor: '#FFF' },
  bgGray: { backgroundColor: '#F8F9F9' },
  bgPrimary: { backgroundColor: '#2E86C1' },
  bgSuccess: { backgroundColor: '#2ECC71' },
  bgWarning: { backgroundColor: '#F39C12' },
  bgDanger: { backgroundColor: '#E74C3C' },
  bgInfo: { backgroundColor: '#3498DB' },
  
  textPrimary: { color: '#2C3E50' },
  textSecondary: { color: '#7F8C8D' },
  textSuccess: { color: '#2ECC71' },
  textWarning: { color: '#F39C12' },
  textDanger: { color: '#E74C3C' },
  textInfo: { color: '#3498DB' },
  textMuted: { color: '#95A5A6' },
  
  // BORDER UTILITIES
  borderRadius5: { borderRadius: 5 },
  borderRadius8: { borderRadius: 8 },
  borderRadius10: { borderRadius: 10 },
  borderRadius12: { borderRadius: 12 },
  borderRadiusCircle: { borderRadius: 9999 },
  
  // ANIMATIONS (pour future implémentation)
  fadeIn: {
    opacity: 1,
  },
  fadeOut: {
    opacity: 0,
  },
  
  // WEB SPECIFIC
  ...(Platform.OS === 'web' && {
    webScrollbar: {
      '::-webkit-scrollbar': {
        width: 8,
      },
      '::-webkit-scrollbar-track': {
        background: '#f1f1f1',
      },
      '::-webkit-scrollbar-thumb': {
        background: '#888',
        borderRadius: 4,
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: '#555',
      },
    },
  }),
});

export default EquipeRHScreen;