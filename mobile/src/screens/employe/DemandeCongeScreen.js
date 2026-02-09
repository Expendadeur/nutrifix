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
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Portal,
  Dialog,
  Paragraph,
  ProgressBar,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ============================================
// DESIGN SYSTEM - MODERN LIGHT THEME
// ============================================
const COLORS = {
  // Primary Colors
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#DBEAFE',

  // Background - CLAIR ET LUMINEUX
  bgPrimary: '#F8FAFC',        // Blanc cassé léger
  bgSecondary: '#FFFFFF',      // Blanc pur
  bgTertiary: '#F1F5F9',       // Gris très clair
  bgAccent: '#E2E8F0',         // Gris clair doux

  // Status Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#0EA5E9',
  infoLight: '#E0F2FE',

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
const LinearGradient = ({ colors, start, end, style, children }) => {
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
  const [showModal, setShowModal] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
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
        await Promise.all([loadBalance(), loadRecentLeaves()]);
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) setRecentLeaves(data.data || []);
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
  // RENDER HEADER
  // ============================================
  const renderHeader = () => (
    <Animated.View style={[dashboardStyles.header, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#2563EB', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={dashboardStyles.headerGradient}
      >
        <View style={dashboardStyles.headerContent}>
          <View>
            <Text style={dashboardStyles.headerTitle}>Gestion des Congés</Text>
            <Text style={dashboardStyles.headerSubtitle}>Gérez vos demandes facilement</Text>
          </View>
          <View style={dashboardStyles.headerIconContainer}>
            <MaterialIcons name="beach-access" size={42} color="#FFF" />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ============================================
  // RENDER BALANCE CARD
  // ============================================
  const renderBalanceCard = () => {
    if (!leaveBalance) return null;

    return (
      <View style={dashboardStyles.balanceCardWrapper}>
        <View style={dashboardStyles.balanceCard}>
          <View style={dashboardStyles.balanceHeader}>
            <View style={dashboardStyles.balanceIconContainer}>
              <MaterialIcons name="event-available" size={28} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dashboardStyles.balanceTitle}>Solde Disponible</Text>
              <Text style={dashboardStyles.balanceSubtitle}>Jours de congé</Text>
            </View>
          </View>

          <View style={dashboardStyles.balanceMainValue}>
            <Text style={dashboardStyles.balanceNumber}>
              {leaveBalance.jours_disponibles}
            </Text>
            <Text style={dashboardStyles.balanceLabel}>jours disponibles</Text>
          </View>

          <View style={dashboardStyles.balanceDivider} />

          <View style={dashboardStyles.balanceDetailsRow}>
            <View style={dashboardStyles.balanceDetailItem}>
              <View style={[dashboardStyles.balanceDetailIcon, { backgroundColor: COLORS.successLight }]}>
                <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
              </View>
              <Text style={dashboardStyles.balanceDetailValue}>{leaveBalance.jours_pris || 0}</Text>
              <Text style={dashboardStyles.balanceDetailLabel}>Pris</Text>
            </View>

            <View style={dashboardStyles.balanceDetailItem}>
              <View style={[dashboardStyles.balanceDetailIcon, { backgroundColor: COLORS.warningLight }]}>
                <MaterialIcons name="schedule" size={20} color={COLORS.warning} />
              </View>
              <Text style={dashboardStyles.balanceDetailValue}>{leaveBalance.jours_en_attente || 0}</Text>
              <Text style={dashboardStyles.balanceDetailLabel}>En attente</Text>
            </View>

            <View style={dashboardStyles.balanceDetailItem}>
              <View style={[dashboardStyles.balanceDetailIcon, { backgroundColor: COLORS.infoLight }]}>
                <MaterialIcons name="savings" size={20} color={COLORS.info} />
              </View>
              <Text style={dashboardStyles.balanceDetailValue}>{leaveBalance.jours_acquis || 0}</Text>
              <Text style={dashboardStyles.balanceDetailLabel}>Acquis</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ============================================
  // RENDER STATS CARDS
  // ============================================
  const renderStatsCards = () => (
    <View style={dashboardStyles.statsGrid}>
      <View style={[dashboardStyles.statCard, { backgroundColor: COLORS.successLight }]}>
        <View style={[dashboardStyles.statIconCircle, { backgroundColor: COLORS.success }]}>
          <MaterialIcons name="check-circle" size={28} color="#FFF" />
        </View>
        <Text style={[dashboardStyles.statValue, { color: COLORS.success }]}>
          {leaveBalance?.jours_pris || 0}
        </Text>
        <Text style={dashboardStyles.statLabel}>Congés pris</Text>
      </View>

      <View style={[dashboardStyles.statCard, { backgroundColor: COLORS.warningLight }]}>
        <View style={[dashboardStyles.statIconCircle, { backgroundColor: COLORS.warning }]}>
          <MaterialIcons name="schedule" size={28} color="#FFF" />
        </View>
        <Text style={[dashboardStyles.statValue, { color: COLORS.warning }]}>
          {leaveBalance?.jours_en_attente || 0}
        </Text>
        <Text style={dashboardStyles.statLabel}>En attente</Text>
      </View>

      <View style={[dashboardStyles.statCard, { backgroundColor: COLORS.infoLight }]}>
        <View style={[dashboardStyles.statIconCircle, { backgroundColor: COLORS.info }]}>
          <MaterialIcons name="event" size={28} color="#FFF" />
        </View>
        <Text style={[dashboardStyles.statValue, { color: COLORS.info }]}>
          {leaveBalance?.jours_acquis || 0}
        </Text>
        <Text style={dashboardStyles.statLabel}>Jours acquis</Text>
      </View>
    </View>
  );

  // ============================================
  // RENDER QUICK ACTION BUTTON
  // ============================================
  const renderQuickAction = () => (
    <TouchableOpacity
      style={dashboardStyles.newRequestButton}
      onPress={() => setShowModal(true)}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={dashboardStyles.newRequestGradient}
      >
        <View style={dashboardStyles.newRequestIconCircle}>
          <MaterialIcons name="add" size={28} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dashboardStyles.newRequestTitle}>Nouvelle demande</Text>
          <Text style={dashboardStyles.newRequestSubtitle}>Créer une demande de congé</Text>
        </View>
        <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
      </LinearGradient>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER RECENT LEAVES
  // ============================================
  const renderRecentLeaves = () => {
    if (recentLeaves.length === 0) {
      return (
        <View style={dashboardStyles.emptyState}>
          <MaterialIcons name="inbox" size={64} color={COLORS.textTertiary} />
          <Text style={dashboardStyles.emptyStateText}>Aucune demande récente</Text>
        </View>
      );
    }

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
      <View style={dashboardStyles.recentSection}>
        <View style={dashboardStyles.sectionHeader}>
          <MaterialIcons name="history" size={24} color={COLORS.primary} />
          <Text style={dashboardStyles.sectionTitle}>Demandes récentes</Text>
        </View>

        <View style={dashboardStyles.leavesList}>
          {recentLeaves.map((leave, index) => {
            const statusConfig = getStatusConfig(leave.statut);
            return (
              <View key={leave.id || index} style={dashboardStyles.leaveCard}>
                <View style={dashboardStyles.leaveCardHeader}>
                  <View style={[dashboardStyles.leaveTypeIcon, { backgroundColor: statusConfig.bg }]}>
                    <MaterialIcons name="event" size={20} color={statusConfig.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dashboardStyles.leaveType}>
                      {leave.type_conge.charAt(0).toUpperCase() + leave.type_conge.slice(1)}
                    </Text>
                    <Text style={dashboardStyles.leaveDates}>
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
                  <View style={[dashboardStyles.leaveStatusBadge, { backgroundColor: statusConfig.bg }]}>
                    <MaterialIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
                    <Text style={[dashboardStyles.leaveStatusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
      <View style={dashboardStyles.container}>
        {loading && !leaveBalance ? (
          <View style={dashboardStyles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={dashboardStyles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <ScrollView
            style={dashboardStyles.scroll}
            contentContainerStyle={dashboardStyles.scrollContent}
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

            <View style={dashboardStyles.content}>
              {renderBalanceCard()}
              {renderStatsCards()}
              {renderQuickAction()}
              {renderRecentLeaves()}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent={false}>
        <DemandeCongeModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadDashboardData();
          }}
        />
      </Modal>
    </>
  );
};

// ============================================
// MODAL COMPONENT
// ============================================
const DemandeCongeModal = ({ onClose, onSuccess }) => {
  const windowDimensions = useWindowDimensions();
  const [typeConge, setTypeConge] = useState('annuel');
  const [dateDebut, setDateDebut] = useState(new Date());
  const [dateFin, setDateFin] = useState(new Date());
  const [showDateDebutPicker, setShowDateDebutPicker] = useState(false);
  const [showDateFinPicker, setShowDateFinPicker] = useState(false);
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
        Alert.alert('✓ Succès', 'Votre demande a été soumise avec succès!', [
          { text: 'OK', onPress: onSuccess }
        ]);
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
    <View style={modalStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgSecondary} />

      {/* HEADER */}
      <View style={modalStyles.header}>
        <TouchableOpacity onPress={onClose} disabled={submitting} style={modalStyles.closeButton}>
          <MaterialIcons name="close" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={modalStyles.headerTitle}>Nouvelle demande</Text>
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
                  <MaterialIcons name={type.icon} size={24} color="#FFF" />
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
            onPress={() => setShowDateDebutPicker(true)}
          >
            <View style={[modalStyles.dateIconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <MaterialIcons name="event" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.dateLabel}>Date de début</Text>
              <Text style={modalStyles.dateValue}>{formatDate(dateDebut)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {showDateDebutPicker && (
            <DateTimePicker
              value={dateDebut}
              mode="date"
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDateDebutPicker(false);
                if (selectedDate) setDateDebut(selectedDate);
              }}
            />
          )}

          <TouchableOpacity
            style={modalStyles.dateCard}
            onPress={() => setShowDateFinPicker(true)}
          >
            <View style={[modalStyles.dateIconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <MaterialIcons name="event" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.dateLabel}>Date de fin</Text>
              <Text style={modalStyles.dateValue}>{formatDate(dateFin)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {showDateFinPicker && (
            <DateTimePicker
              value={dateFin}
              mode="date"
              minimumDate={dateDebut}
              onChange={(event, selectedDate) => {
                setShowDateFinPicker(false);
                if (selectedDate) setDateFin(selectedDate);
              }}
            />
          )}

          {joursCalcules > 0 && (
            <View style={modalStyles.durationCard}>
              <View style={[modalStyles.durationIcon, { backgroundColor: COLORS.successLight }]}>
                <MaterialIcons name="schedule" size={20} color={COLORS.success} />
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
            numberOfLines={5}
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
                <MaterialIcons name="description" size={24} color={COLORS.primary} />
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
                <MaterialIcons name="close" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={modalStyles.uploadCard} onPress={pickDocument}>
              <View style={[modalStyles.uploadIcon, { backgroundColor: COLORS.primaryLight }]}>
                <MaterialIcons name="cloud-upload" size={32} color={COLORS.primary} />
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
                  <MaterialIcons name="send" size={20} color="#FFF" />
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
    </View>
  );
};

// ============================================
// DASHBOARD STYLES
// ============================================
const dashboardStyles = StyleSheet.create({
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
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: -20,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },

  // Balance Card
  balanceCardWrapper: {
    marginBottom: 20,
  },
  balanceCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  balanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  balanceSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  balanceMainValue: {
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.success,
    letterSpacing: -2,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  balanceDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceDetailItem: {
    alignItems: 'center',
  },
  balanceDetailIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceDetailValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  balanceDetailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // New Request Button
  newRequestButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  newRequestGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  newRequestIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRequestTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  newRequestSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // Recent Leaves
  recentSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leavesList: {
    gap: 12,
  },
  leaveCard: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaveTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leaveDates: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  leaveStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 15,
    color: COLORS.textTertiary,
    marginTop: 12,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  // Type Grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  typeCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  typeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Date Cards
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  durationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  durationValue: {
    color: COLORS.success,
    fontWeight: '800',
  },

  // Text Input
  textInput: {
    backgroundColor: COLORS.bgSecondary,
    fontSize: 14,
    minHeight: 120,
  },

  // Document
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  documentSize: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  uploadSubtext: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },

  // Actions
  actions: {
    gap: 12,
    marginTop: 12,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  cancelButton: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default DemandeCongeScreen;