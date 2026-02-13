import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Portal,
  Dialog,
  Paragraph,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com/api';

// ============================================
// DESIGN SYSTEM - MODERN LIGHT THEME
// ============================================
const COLORS = {
  // Primary Colors
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#DBEAFE',

  // Background
  bgPrimary: '#F8FAFC',
  bgSecondary: '#FFFFFF',
  bgTertiary: '#F1F5F9',

  // Status Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#0EA5E9',
  infoLight: '#E0F2FE',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',

  // Text Colors
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',

  // Borders
  border: '#E2E8F0',
  borderDark: '#CBD5E1',
};

// ============================================
// GRADIENT COMPONENT FOR WEB
// ============================================
const LinearGradient = ({ colors, style, children }) => {
  const gradientStyle = {
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    ...StyleSheet.flatten(style),
  };
  return <div style={gradientStyle}>{children}</div>;
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
const DemandeCongeScreen = ({ navigation }) => {
  const windowDimensions = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('conges'); // 'conges' | 'salaire'
  const [showCongeModal, setShowCongeModal] = useState(false);
  const [showSalaireModal, setShowSalaireModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [salaireInfo, setSalaireInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const isMobile = windowDimensions.width < 900;

  useEffect(() => {
    loadDashboardData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        await Promise.all([
          loadBalance(),
          loadRecentLeaves(),
          loadSalaireInfo()
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/employe-inss/conges/solde`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setLeaveBalance(data.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadRecentLeaves = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/employe-inss/conges?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setRecentLeaves(data.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadSalaireInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/employe-inss/salaire/info`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setSalaireInfo(data.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // ============================================
  // RENDER HEADER WITH TABS
  // ============================================
  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#2563EB', '#1E40AF']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Espace Employé</Text>
            <Text style={styles.headerSubtitle}>Congés & Salaires</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <MaterialIcons 
              name={activeTab === 'conges' ? 'beach-access' : 'account-balance-wallet'} 
              size={36} 
              color="#FFF" 
            />
          </View>
        </View>

        {/* TABS */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'conges' && styles.tabActive]}
            onPress={() => setActiveTab('conges')}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name="beach-access" 
              size={20} 
              color={activeTab === 'conges' ? '#FFF' : 'rgba(255,255,255,0.7)'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'conges' && styles.tabTextActive
            ]}>
              Congés
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'salaire' && styles.tabActive]}
            onPress={() => setActiveTab('salaire')}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name="account-balance-wallet" 
              size={20} 
              color={activeTab === 'salaire' ? '#FFF' : 'rgba(255,255,255,0.7)'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'salaire' && styles.tabTextActive
            ]}>
              Salaires
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ============================================
  // RENDER CONGES CONTENT
  // ============================================
  const renderCongesContent = () => (
    <View style={styles.tabContent}>
      {/* Balance Card */}
      {leaveBalance && (
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconContainer}>
              <MaterialIcons name="event-available" size={24} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceTitle}>Solde Disponible</Text>
              <Text style={styles.balanceSubtitle}>Jours de congé</Text>
            </View>
          </View>

          <View style={styles.balanceMainValue}>
            <Text style={styles.balanceNumber}>{leaveBalance.jours_disponibles}</Text>
            <Text style={styles.balanceLabel}>jours disponibles</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.balanceDetailsRow}>
            <View style={styles.balanceDetailItem}>
              <View style={[styles.balanceDetailIcon, { backgroundColor: COLORS.successLight }]}>
                <MaterialIcons name="check-circle" size={18} color={COLORS.success} />
              </View>
              <Text style={styles.balanceDetailValue}>{leaveBalance.jours_pris || 0}</Text>
              <Text style={styles.balanceDetailLabel}>Pris</Text>
            </View>

            <View style={styles.balanceDetailItem}>
              <View style={[styles.balanceDetailIcon, { backgroundColor: COLORS.warningLight }]}>
                <MaterialIcons name="schedule" size={18} color={COLORS.warning} />
              </View>
              <Text style={styles.balanceDetailValue}>{leaveBalance.jours_en_attente || 0}</Text>
              <Text style={styles.balanceDetailLabel}>En attente</Text>
            </View>

            <View style={styles.balanceDetailItem}>
              <View style={[styles.balanceDetailIcon, { backgroundColor: COLORS.infoLight }]}>
                <MaterialIcons name="savings" size={18} color={COLORS.info} />
              </View>
              <Text style={styles.balanceDetailValue}>{leaveBalance.jours_acquis || 0}</Text>
              <Text style={styles.balanceDetailLabel}>Acquis</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Action Button */}
      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => setShowCongeModal(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.quickActionGradient}
        >
          <View style={styles.quickActionIconCircle}>
            <MaterialIcons name="add" size={24} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickActionTitle}>Nouvelle demande de congé</Text>
            <Text style={styles.quickActionSubtitle}>Soumettre une demande</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={22} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Recent Leaves */}
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="history" size={22} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Demandes récentes</Text>
        </View>

        {recentLeaves.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyStateText}>Aucune demande récente</Text>
          </View>
        ) : (
          <View style={styles.leavesList}>
            {recentLeaves.map((leave, index) => {
              const statusConfig = getStatusConfig(leave.statut);
              return (
                <View key={leave.id || index} style={styles.leaveCard}>
                  <View style={styles.leaveCardHeader}>
                    <View style={[styles.leaveTypeIcon, { backgroundColor: statusConfig.bg }]}>
                      <MaterialIcons name="event" size={18} color={statusConfig.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaveType}>
                        {leave.type_conge.charAt(0).toUpperCase() + leave.type_conge.slice(1)}
                      </Text>
                      <Text style={styles.leaveDates}>
                        {new Date(leave.date_debut).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })} - {new Date(leave.date_fin).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    <View style={[styles.leaveStatusBadge, { backgroundColor: statusConfig.bg }]}>
                      <MaterialIcons name={statusConfig.icon} size={12} color={statusConfig.color} />
                      <Text style={[styles.leaveStatusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );

  // ============================================
  // RENDER SALAIRE CONTENT
  // ============================================
  const renderSalaireContent = () => (
    <View style={styles.tabContent}>
      {/* Salaire Info Card */}
      {salaireInfo && (
        <View style={styles.salaireCard}>
          <View style={styles.salaireHeader}>
            <View style={[styles.salaireIconContainer, { backgroundColor: COLORS.purpleLight }]}>
              <MaterialIcons name="account-balance-wallet" size={24} color={COLORS.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.salaireTitle}>Informations Salaire</Text>
              <Text style={styles.salaireSubtitle}>Mois en cours</Text>
            </View>
          </View>

          <View style={styles.salaireMainValue}>
            <Text style={styles.salaireNumber}>
              {salaireInfo.montant_net?.toLocaleString('fr-FR') || '0'}
            </Text>
            <Text style={styles.salaireLabel}>FBU - Net à payer</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.salaireDetailsRow}>
            <View style={styles.salaireDetailItem}>
              <Text style={styles.salaireDetailLabel}>Salaire brut</Text>
              <Text style={styles.salaireDetailValue}>
                {salaireInfo.montant_brut?.toLocaleString('fr-FR') || '0'} FBU
              </Text>
            </View>
            <View style={styles.salaireDetailItem}>
              <Text style={styles.salaireDetailLabel}>Statut</Text>
              <View style={[
                styles.statutBadge,
                {
                  backgroundColor: salaireInfo.statut === 'paye' 
                    ? COLORS.successLight 
                    : salaireInfo.statut === 'en_attente'
                    ? COLORS.warningLight
                    : COLORS.errorLight
                }
              ]}>
                <Text style={[
                  styles.statutText,
                  {
                    color: salaireInfo.statut === 'paye' 
                      ? COLORS.success 
                      : salaireInfo.statut === 'en_attente'
                      ? COLORS.warning
                      : COLORS.error
                  }
                ]}>
                  {salaireInfo.statut === 'paye' ? 'Payé' : 
                   salaireInfo.statut === 'en_attente' ? 'En attente' : 'Impayé'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => setShowSalaireModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.actionGradient}
          >
            <View style={styles.actionIconCircle}>
              <MaterialIcons name="request-quote" size={28} color="#FFF" />
            </View>
            <Text style={styles.actionTitle}>Demander mon salaire</Text>
            <Text style={styles.actionSubtitle}>Envoyer une demande</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => setShowConfirmationModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.actionGradient}
          >
            <View style={styles.actionIconCircle}>
              <MaterialIcons name="verified" size={28} color="#FFF" />
            </View>
            <Text style={styles.actionTitle}>Confirmer réception</Text>
            <Text style={styles.actionSubtitle}>Code de vérification</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <MaterialIcons name="info" size={20} color={COLORS.info} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.infoTitle}>Communication par email</Text>
          <Text style={styles.infoText}>
            Toutes vos demandes et confirmations sont automatiquement envoyées par email 
            à votre manager et à l'administration pour un suivi transparent.
          </Text>
        </View>
      </View>
    </View>
  );

  const getStatusConfig = (status) => {
    switch (status) {
      case 'en_attente':
        return {
          color: COLORS.warning,
          bg: COLORS.warningLight,
          label: 'En attente',
          icon: 'schedule'
        };
      case 'approuve':
        return {
          color: COLORS.success,
          bg: COLORS.successLight,
          label: 'Approuvé',
          icon: 'check-circle'
        };
      case 'rejete':
        return {
          color: COLORS.error,
          bg: COLORS.errorLight,
          label: 'Rejeté',
          icon: 'cancel'
        };
      default:
        return {
          color: COLORS.info,
          bg: COLORS.infoLight,
          label: 'Inconnu',
          icon: 'info'
        };
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
      <View style={styles.container}>
        {loading && !leaveBalance && !salaireInfo ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
          >
            {renderHeader()}
            <View style={styles.content}>
              {activeTab === 'conges' ? renderCongesContent() : renderSalaireContent()}
            </View>
          </ScrollView>
        )}
      </View>

      {/* MODALS */}
      <Modal visible={showCongeModal} animationType="slide" transparent={false}>
        <DemandeCongeModal
          onClose={() => setShowCongeModal(false)}
          onSuccess={() => {
            setShowCongeModal(false);
            loadDashboardData();
          }}
        />
      </Modal>

      <Modal visible={showSalaireModal} animationType="slide" transparent={false}>
        <DemandeSalaireModal
          onClose={() => setShowSalaireModal(false)}
          onSuccess={() => {
            setShowSalaireModal(false);
            loadSalaireInfo();
          }}
        />
      </Modal>

      <Modal visible={showConfirmationModal} animationType="slide" transparent={false}>
        <ConfirmationSalaireModal
          onClose={() => setShowConfirmationModal(false)}
          onSuccess={() => {
            setShowConfirmationModal(false);
            loadSalaireInfo();
          }}
        />
      </Modal>
    </>
  );
};

// ============================================
// DEMANDE CONGE MODAL
// ============================================
const DemandeCongeModal = ({ onClose, onSuccess }) => {
  const windowDimensions = useWindowDimensions();
  const [typeConge, setTypeConge] = useState('annuel');
  const [dateDebut, setDateDebut] = useState(new Date());
  const [dateFin, setDateFin] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState(null);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [raison, setRaison] = useState('');
  const [pieceJointe, setPieceJointe] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [joursCalcules, setJoursCalcules] = useState(0);

  const isMobile = windowDimensions.width < 600;

  const typesConge = [
    { value: 'annuel', label: 'Annuel', icon: 'beach-access', color: '#2563EB', bg: '#DBEAFE' },
    { value: 'maladie', label: 'Maladie', icon: 'local-hospital', color: '#EF4444', bg: '#FEE2E2' },
    { value: 'maternite', label: 'Maternité', icon: 'child-care', color: '#EC4899', bg: '#FCE7F3' },
    { value: 'paternite', label: 'Paternité', icon: 'family-restroom', color: '#8B5CF6', bg: '#EDE9FE' },
    { value: 'exceptionnel', label: 'Exceptionnel', icon: 'event-note', color: '#F59E0B', bg: '#FEF3C7' },
    { value: 'sans_solde', label: 'Sans solde', icon: 'money-off', color: '#64748B', bg: '#F1F5F9' },
  ];

  useEffect(() => {
    calculateDays();
  }, [dateDebut, dateFin]);

  const calculateDays = () => {
    if (dateDebut && dateFin) {
      const diffTime = Math.abs(dateFin - dateDebut);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setJoursCalcules(diffDays);
    }
  };

  const openDatePicker = (field, initialValue) => {
    setDatePickerField(field);
    setDatePickerValue(initialValue instanceof Date ? initialValue : new Date(initialValue));
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerField === 'dateDebut') {
        const d = new Date(selectedDate);
        setDateDebut(d);
        if (d > dateFin) setDateFin(d);
      } else if (datePickerField === 'dateFin') {
        setDateFin(new Date(selectedDate));
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });
      if (result.type === 'success') {
        setPieceJointe({
          name: result.name,
          size: result.size,
          uri: result.uri,
          type: result.mimeType
        });
        Alert.alert('✓ Document ajouté', result.name);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
    }
  };

  const submitLeaveRequest = async () => {
    if (!typeConge || !raison.trim() || joursCalcules <= 0) {
      Alert.alert('Attention', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const formData = new FormData();
      formData.append('type_conge', typeConge);
      formData.append('date_debut', dateDebut.toISOString().split('T')[0]);
      formData.append('date_fin', dateFin.toISOString().split('T')[0]);
      formData.append('raison', raison);

      if (pieceJointe) {
        formData.append('piece_jointe', {
          uri: pieceJointe.uri,
          name: pieceJointe.name,
          type: pieceJointe.type
        });
      }

      const response = await fetch(`${API_URL}/employe-inss/conges/demande`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert(
          '✓ Succès', 
          'Votre demande a été soumise avec succès!\n\nUn email de confirmation a été envoyé à votre manager et à l\'administration.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        Alert.alert('Erreur', data.message || 'Une erreur est survenue');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={modalStyles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgSecondary} />

      {/* HEADER */}
      <View style={modalStyles.header}>
        <TouchableOpacity onPress={onClose} disabled={submitting} style={modalStyles.closeButton}>
          <MaterialIcons name="close" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={modalStyles.headerTitle}>Nouvelle demande de congé</Text>
          <Text style={modalStyles.headerSubtitle}>Remplissez le formulaire</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={modalStyles.scroll}
        contentContainerStyle={modalStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TYPE DE CONGÉ */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Type de congé *</Text>
          <View style={modalStyles.typeGrid}>
            {typesConge.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  modalStyles.typeCard,
                  {
                    width: isMobile ? '48%' : '30%',
                    backgroundColor: typeConge === type.value ? type.bg : COLORS.bgSecondary,
                    borderColor: typeConge === type.value ? type.color : COLORS.border,
                  },
                ]}
                onPress={() => setTypeConge(type.value)}
                activeOpacity={0.7}
              >
                <View style={[modalStyles.typeIconCircle, { backgroundColor: type.color }]}>
                  <MaterialIcons name={type.icon} size={20} color="#FFF" />
                </View>
                <Text style={[
                  modalStyles.typeLabel,
                  { color: typeConge === type.value ? type.color : COLORS.textPrimary }
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* PÉRIODE */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Période *</Text>

          <TouchableOpacity
            style={modalStyles.dateCard}
            onPress={() => openDatePicker('dateDebut', dateDebut)}
          >
            <View style={[modalStyles.dateIconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <MaterialIcons name="event" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.dateLabel}>Date de début</Text>
              <Text style={modalStyles.dateValue}>{formatDate(dateDebut)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={COLORS.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.dateCard}
            onPress={() => openDatePicker('dateFin', dateFin)}
          >
            <View style={[modalStyles.dateIconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <MaterialIcons name="event" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.dateLabel}>Date de fin</Text>
              <Text style={modalStyles.dateValue}>{formatDate(dateFin)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              minimumDate={datePickerField === 'dateFin' ? dateDebut : new Date()}
              onChange={handleDateChange}
            />
          )}

          {joursCalcules > 0 && (
            <View style={modalStyles.durationCard}>
              <View style={[modalStyles.durationIcon, { backgroundColor: COLORS.successLight }]}>
                <MaterialIcons name="schedule" size={18} color={COLORS.success} />
              </View>
              <Text style={modalStyles.durationText}>
                Durée totale : <Text style={modalStyles.durationValue}>{joursCalcules} jour{joursCalcules > 1 ? 's' : ''}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* RAISON */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Motif de la demande *</Text>
          <TextInput
            placeholder="Décrivez le motif de votre demande..."
            placeholderTextColor={COLORS.textTertiary}
            value={raison}
            onChangeText={setRaison}
            multiline
            numberOfLines={4}
            mode="outlined"
            style={modalStyles.textInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.textPrimary}
            theme={{
              colors: {
                background: COLORS.bgSecondary,
              }
            }}
          />
        </View>

        {/* DOCUMENT */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Document justificatif (optionnel)</Text>
          {pieceJointe ? (
            <View style={modalStyles.documentPreview}>
              <View style={[modalStyles.documentIcon, { backgroundColor: COLORS.primaryLight }]}>
                <MaterialIcons name="description" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.documentName} numberOfLines={1}>
                  {pieceJointe.name}
                </Text>
                <Text style={modalStyles.documentSize}>
                  {(pieceJointe.size / 1024).toFixed(1)} KB
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPieceJointe(null)}
                style={modalStyles.removeButton}
              >
                <MaterialIcons name="close" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={modalStyles.uploadCard} onPress={pickDocument}>
              <View style={[modalStyles.uploadIcon, { backgroundColor: COLORS.primaryLight }]}>
                <MaterialIcons name="cloud-upload" size={28} color={COLORS.primary} />
              </View>
              <Text style={modalStyles.uploadText}>Ajouter un document</Text>
              <Text style={modalStyles.uploadSubtext}>PDF, JPG, PNG (max 5MB)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ACTIONS */}
        <View style={modalStyles.actions}>
          <TouchableOpacity
            style={[modalStyles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={submitLeaveRequest}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={modalStyles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="send" size={18} color="#FFF" />
                  <Text style={modalStyles.submitText}>Soumettre la demande</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.cancelButton}
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={modalStyles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ============================================
// DEMANDE SALAIRE MODAL
// ============================================
const DemandeSalaireModal = ({ onClose, onSuccess }) => {
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const moisOptions = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const submitSalaireRequest = async () => {
    if (!motif.trim()) {
      Alert.alert('Attention', 'Veuillez indiquer le motif de votre demande');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/employe-inss/salaire/demande`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mois,
          annee,
          motif
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert(
          '✓ Demande envoyée',
          'Votre demande de paiement a été envoyée avec succès!\n\n' +
          '📧 Email envoyé à votre manager\n' +
          '📧 Email envoyé à l\'administration\n\n' +
          'Vous serez notifié dès que le paiement sera effectué.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        Alert.alert('Erreur', data.message || 'Une erreur est survenue');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={modalStyles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgSecondary} />

      {/* HEADER */}
      <View style={modalStyles.header}>
        <TouchableOpacity onPress={onClose} disabled={submitting} style={modalStyles.closeButton}>
          <MaterialIcons name="close" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={modalStyles.headerTitle}>Demande de salaire</Text>
          <Text style={modalStyles.headerSubtitle}>Notification manager & admin</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={modalStyles.scroll}
        contentContainerStyle={modalStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PÉRIODE */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Période concernée *</Text>
          
          <View style={modalStyles.periodeRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={modalStyles.inputLabel}>Mois</Text>
              <View style={modalStyles.selectCard}>
                <MaterialIcons name="calendar-today" size={20} color={COLORS.primary} />
                <Text style={modalStyles.selectText}>{moisOptions[mois - 1]}</Text>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={modalStyles.inputLabel}>Année</Text>
              <View style={modalStyles.selectCard}>
                <MaterialIcons name="event" size={20} color={COLORS.primary} />
                <Text style={modalStyles.selectText}>{annee}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* MOTIF */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Motif de la demande *</Text>
          <TextInput
            placeholder="Expliquez pourquoi vous demandez votre salaire..."
            placeholderTextColor={COLORS.textTertiary}
            value={motif}
            onChangeText={setMotif}
            multiline
            numberOfLines={4}
            mode="outlined"
            style={modalStyles.textInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.textPrimary}
            theme={{
              colors: {
                background: COLORS.bgSecondary,
              }
            }}
          />
        </View>

        {/* INFO BOX */}
        <View style={[modalStyles.infoBox, { backgroundColor: COLORS.warningLight }]}>
          <MaterialIcons name="email" size={20} color={COLORS.warning} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[modalStyles.infoTitle, { color: COLORS.warning }]}>
              Communication automatique
            </Text>
            <Text style={modalStyles.infoText}>
              Votre demande sera envoyée par email à votre manager et à l'administration 
              pour traitement rapide.
            </Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={modalStyles.actions}>
          <TouchableOpacity
            style={[modalStyles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={submitSalaireRequest}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={modalStyles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="send" size={18} color="#FFF" />
                  <Text style={modalStyles.submitText}>Envoyer la demande</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.cancelButton}
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={modalStyles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ============================================
// CONFIRMATION SALAIRE MODAL
// ============================================
const ConfirmationSalaireModal = ({ onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirmReception = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert('Attention', 'Veuillez entrer le code à 6 chiffres reçu par email');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/employe-inss/salaire/confirmer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code_verification: code }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert(
          '✓ Confirmation réussie',
          'Votre réception de salaire a été confirmée avec succès!\n\n' +
          'Notification envoyée au manager\n' +
          'Notification envoyée à l\'administration\n\n' +
          'Merci pour votre confirmation.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        Alert.alert('Erreur', data.message || 'Code invalide ou expiré');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={modalStyles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgSecondary} />

      {/* HEADER */}
      <View style={modalStyles.header}>
        <TouchableOpacity onPress={onClose} disabled={submitting} style={modalStyles.closeButton}>
          <MaterialIcons name="close" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={modalStyles.headerTitle}>Confirmer la réception</Text>
          <Text style={modalStyles.headerSubtitle}>Code de vérification</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={modalStyles.scroll}
        contentContainerStyle={modalStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* INSTRUCTIONS */}
        <View style={[modalStyles.section, { alignItems: 'center' }]}>
          <View style={[modalStyles.iconCircleLarge, { backgroundColor: COLORS.purpleLight }]}>
            <MaterialIcons name="verified" size={48} color={COLORS.purple} />
          </View>
          <Text style={modalStyles.instructionTitle}>
            Vérification de réception
          </Text>
          <Text style={modalStyles.instructionText}>
            Entrez le code à 6 chiffres que vous avez reçu par email pour confirmer 
            la réception de votre salaire.
          </Text>
        </View>

        {/* CODE INPUT */}
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionTitle}>Code de vérification *</Text>
          <TextInput
            placeholder="000000"
            placeholderTextColor={COLORS.textTertiary}
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            mode="outlined"
            style={[modalStyles.textInput, { fontSize: 24, textAlign: 'center', letterSpacing: 8 }]}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.purple}
            textColor={COLORS.textPrimary}
            theme={{
              colors: {
                background: COLORS.bgSecondary,
              }
            }}
          />
        </View>

        {/* WARNING BOX */}
        <View style={[modalStyles.infoBox, { backgroundColor: COLORS.warningLight }]}>
          <MaterialIcons name="info" size={20} color={COLORS.warning} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[modalStyles.infoTitle, { color: COLORS.warning }]}>
              Important
            </Text>
            <Text style={modalStyles.infoText}>
              • Le code est valide pendant 24 heures{'\n'}
              • Ne partagez jamais ce code{'\n'}
              • Vérifiez votre boîte de réception et spams
            </Text>
          </View>
        </View>

        {/* INFO BOX */}
        <View style={[modalStyles.infoBox, { backgroundColor: COLORS.infoLight }]}>
          <MaterialIcons name="email" size={20} color={COLORS.info} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[modalStyles.infoTitle, { color: COLORS.info }]}>
              Notification automatique
            </Text>
            <Text style={modalStyles.infoText}>
              Après confirmation, un email sera automatiquement envoyé à votre manager 
              et à l'administration.
            </Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={modalStyles.actions}>
          <TouchableOpacity
            style={[modalStyles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={confirmReception}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={modalStyles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="verified" size={18} color="#FFF" />
                  <Text style={modalStyles.submitText}>Confirmer la réception</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.cancelButton}
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={modalStyles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ============================================
// MAIN STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    marginBottom: -16,
  },
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // TABS
  tabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#FFF',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabContent: {
    paddingTop: 4,
  },

  // BALANCE CARD
  balanceCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  balanceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  balanceSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  balanceMainValue: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.success,
    letterSpacing: -1,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    marginBottom: 16,
    backgroundColor: COLORS.border,
  },
  balanceDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceDetailItem: {
    alignItems: 'center',
  },
  balanceDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceDetailValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  balanceDetailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // QUICK ACTION BUTTON
  quickActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  quickActionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // RECENT SECTION
  recentSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leavesList: {
    gap: 10,
  },
  leaveCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaveTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leaveDates: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  leaveStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 10,
  },

  // SALAIRE CARD
  salaireCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  salaireHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  salaireIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  salaireTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  salaireSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  salaireMainValue: {
    alignItems: 'center',
    marginBottom: 20,
  },
  salaireNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.purple,
    letterSpacing: -1,
  },
  salaireLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  salaireDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salaireDetailItem: {
    flex: 1,
  },
  salaireDetailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  salaireDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statutText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ACTIONS GRID
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  // INFO BOX
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.infoLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.info,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

// ============================================
// MODAL STYLES
// ============================================
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },

  // TYPE GRID
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  typeCard: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // DATE CARDS
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 3,
  },
  dateValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.successLight,
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
  },
  durationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  durationValue: {
    color: COLORS.success,
    fontWeight: '800',
  },

  // TEXT INPUT
  textInput: {
    backgroundColor: COLORS.bgSecondary,
    fontSize: 14,
    minHeight: 100,
  },

  // DOCUMENT
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  documentSize: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },

  // PERIODE ROW
  periodeRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },

  // INSTRUCTIONS
  iconCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ACTIONS
  actions: {
    gap: 10,
    marginTop: 8,
  },
  submitButton: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  cancelButton: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default DemandeCongeScreen;