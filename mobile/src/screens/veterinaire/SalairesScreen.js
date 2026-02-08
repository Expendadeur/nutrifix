// frontend/src/screens/veterinaire/SalairesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  useWindowDimensions,
  Animated,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  Chip,
  SegmentedButtons,
  ActivityIndicator,
  FAB,
  Provider,
  Menu,
  Divider,
  IconButton,
  Badge,
  ProgressBar,
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration de l'API
const API_BASE_URL = __DEV__ 
  ? Platform.select({
      ios: 'http://localhost:5000',
      android: 'http://10.0.2.2:5000',
      default: 'http://localhost:5000'
    })
  : 'https://your-production-api.com';

const SalairesScreen = ({ navigation }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // Responsive
  const isTablet = windowWidth >= 768;
  const isLargeScreen = windowWidth >= 1024;
  const isExtraLargeScreen = windowWidth >= 1440;

  // États principaux
  const [activeTab, setActiveTab] = useState('historique');
  const [salaires, setSalaires] = useState([]);
  const [paiementsRecus, setPaiementsRecus] = useState([]);
  const [paiementsAttente, setPaiementsAttente] = useState([]);
  const [statistiques, setStatistiques] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSalaire, setSelectedSalaire] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalSalaires, setTotalSalaires] = useState(0);

  // Filtres
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [filterStatut, setFilterStatut] = useState('');
  const [menuAnneeVisible, setMenuAnneeVisible] = useState(false);

  // États UI
  const [demandeEnCours, setDemandeEnCours] = useState({});
  const [confirmationEnCours, setConfirmationEnCours] = useState({});
  const [codeVerification, setCodeVerification] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [salaireEnConfirmation, setSalaireEnConfirmation] = useState(null);

  // Animation
  const [fadeAnim] = useState(new Animated.Value(0));

  // Données de référence
  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  
  const statutsOptions = [
    { id: '', label: 'Tous', color: '#3498DB' },
    { id: 'calculé', label: 'Calculés', color: '#F39C12' },
    { id: 'payé', label: 'Payés', color: '#2ECC71' },
    { id: 'reporté', label: 'Reportés', color: '#E74C3C' },
  ];

  const tabs = [
    { value: 'historique', label: 'Historique', icon: 'history' },
    { value: 'recus', label: 'Reçus', icon: 'check-circle' },
    { value: 'attente', label: 'En attente', icon: 'schedule' },
    { value: 'stats', label: 'Statistiques', icon: 'bar-chart' },
  ];

  // Charger au focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [activeTab, filterAnnee, filterStatut])
  );

  // Animation au montage
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Configuration Axios
  const getAxiosConfig = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  // Charger les données selon l'onglet actif
  const loadData = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const config = await getAxiosConfig();
      const currentPage = reset ? 1 : page;

      switch (activeTab) {
        case 'historique':
          await loadHistorique(config, currentPage, reset);
          break;
        case 'recus':
          await loadPaiementsRecus(config, currentPage, reset);
          break;
        case 'attente':
          await loadPaiementsAttente(config, currentPage, reset);
          break;
        case 'stats':
          await loadStatistiques(config);
          break;
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les données. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger l'historique des salaires
  const loadHistorique = async (config, currentPage, reset) => {
    const params = {
      page: currentPage,
      limit: 20,
      ...(filterAnnee && { annee: filterAnnee }),
      ...(filterStatut && { statut: filterStatut })
    };

    const response = await axios.get(
      `${API_BASE_URL}/api/veterinaire/salaires/historique`,
      { ...config, params }
    );

    if (response.data.success) {
      const newSalaires = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setSalaires(newSalaires);
      } else {
        setSalaires(prev => [...prev, ...newSalaires]);
      }

      setTotalSalaires(pagination.total);
      setHasMore(pagination.page < pagination.pages);
      if (!reset) {
        setPage(currentPage + 1);
      }
    }
  };

  // Charger les paiements reçus
  const loadPaiementsRecus = async (config, currentPage, reset) => {
    const params = {
      page: currentPage,
      limit: 20,
      ...(filterAnnee && { annee: filterAnnee })
    };

    const response = await axios.get(
      `${API_BASE_URL}/api/veterinaire/paiements/recus`,
      { ...config, params }
    );

    if (response.data.success) {
      const newPaiements = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setPaiementsRecus(newPaiements);
      } else {
        setPaiementsRecus(prev => [...prev, ...newPaiements]);
      }

      setTotalSalaires(pagination.total);
      setHasMore(pagination.page < pagination.pages);
      if (!reset) {
        setPage(currentPage + 1);
      }
    }
  };

  // Charger les paiements en attente
  const loadPaiementsAttente = async (config, currentPage, reset) => {
    const params = {
      page: currentPage,
      limit: 20
    };

    const response = await axios.get(
      `${API_BASE_URL}/api/veterinaire/paiements/en-attente`,
      { ...config, params }
    );

    if (response.data.success) {
      const newPaiements = response.data.data;
      const pagination = response.data.pagination;

      if (reset) {
        setPaiementsAttente(newPaiements);
      } else {
        setPaiementsAttente(prev => [...prev, ...newPaiements]);
      }

      setTotalSalaires(pagination.total);
      setHasMore(pagination.page < pagination.pages);
      if (!reset) {
        setPage(currentPage + 1);
      }
    }
  };

  // Charger les statistiques
  const loadStatistiques = async (config) => {
    const response = await axios.get(
      `${API_BASE_URL}/api/veterinaire/statistiques/interventions-mensuelles`,
      { 
        ...config, 
        params: { annee: filterAnnee } 
      }
    );

    if (response.data.success) {
      setStatistiques(response.data.data);
    }
  };

  // Charger plus
  const loadMore = () => {
    if (!loading && hasMore && activeTab !== 'stats') {
      loadData(false);
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Voir les détails d'un salaire
  const voirDetails = async (salaireId) => {
    try {
      setLoading(true);
      const config = await getAxiosConfig();

      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/salaires/${salaireId}`,
        config
      );

      if (response.data.success) {
        setSelectedSalaire(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      console.error('Erreur détails salaire:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails.');
    } finally {
      setLoading(false);
    }
  };

  // Demander le paiement
  const demanderPaiement = async (salaireId) => {
    Alert.alert(
      'Demande de paiement',
      'Voulez-vous envoyer une demande de paiement pour ce salaire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setDemandeEnCours(prev => ({ ...prev, [salaireId]: true }));
              const config = await getAxiosConfig();

              const response = await axios.post(
                `${API_BASE_URL}/api/veterinaire/salaires/${salaireId}/demander-paiement`,
                {},
                config
              );

              if (response.data.success) {
                Alert.alert('Succès', 'Demande de paiement envoyée avec succès.');
                loadData(true);
              }
            } catch (error) {
              console.error('Erreur demande paiement:', error);
              Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Impossible d\'envoyer la demande.'
              );
            } finally {
              setDemandeEnCours(prev => ({ ...prev, [salaireId]: false }));
            }
          }
        }
      ]
    );
  };

  // Confirmer la réception
  const confirmerReception = async (salaireId, withCode = false) => {
    try {
      setConfirmationEnCours(prev => ({ ...prev, [salaireId]: true }));
      const config = await getAxiosConfig();

      const data = withCode ? { code_verification: codeVerification } : {};

      const response = await axios.post(
        `${API_BASE_URL}/api/veterinaire/salaires/${salaireId}/confirmer-reception`,
        data,
        config
      );

      if (response.data.success) {
        Alert.alert('Succès', 'Réception confirmée avec succès.');
        setShowCodeModal(false);
        setCodeVerification('');
        setSalaireEnConfirmation(null);
        loadData(true);
      }
    } catch (error) {
      console.error('Erreur confirmation:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Impossible de confirmer la réception.'
      );
    } finally {
      setConfirmationEnCours(prev => ({ ...prev, [salaireId]: false }));
    }
  };

  // Ouvrir modal de confirmation avec code
  const ouvrirModalConfirmation = (salaire) => {
    setSalaireEnConfirmation(salaire);
    setShowCodeModal(true);
  };

  // === COMPOSANTS DE RENDU === //

  // En-tête
  const renderHeader = () => (
    <View style={[
      styles.header,
      isTablet && styles.headerTablet
    ]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="cash-multiple" size={32} color="#FFF" />
          <View style={styles.headerInfo}>
            <Text style={[
              styles.headerTitle,
              isTablet && styles.headerTitleTablet
            ]}>
              Gestion des salaires
            </Text>
            {activeTab !== 'stats' && (
              <Text style={styles.headerSubtitle}>
                {totalSalaires} salaire{totalSalaires > 1 ? 's' : ''} au total
              </Text>
            )}
          </View>
        </View>
      </View>

      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab}
        buttons={tabs.map(tab => ({
          value: tab.value,
          label: isLargeScreen ? tab.label : tab.label.substring(0, 4),
          icon: tab.icon,
        }))}
        style={[
          styles.segmentedButtons,
          isTablet && styles.segmentedButtonsTablet
        ]}
      />
    </View>
  );

  // Filtres
  const renderFilters = () => {
    if (activeTab === 'stats') return null;

    return (
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {/* Filtre année */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Année:</Text>
            <Menu
              visible={menuAnneeVisible}
              onDismiss={() => setMenuAnneeVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setMenuAnneeVisible(true)}
                >
                  <Text style={styles.filterButtonText}>{filterAnnee}</Text>
                  <MaterialIcons name="arrow-drop-down" size={20} color="#2C3E50" />
                </TouchableOpacity>
              }
            >
              {annees.map((annee) => (
                <Menu.Item
                  key={annee}
                  onPress={() => {
                    setFilterAnnee(annee);
                    setMenuAnneeVisible(false);
                    setPage(1);
                  }}
                  title={annee.toString()}
                />
              ))}
            </Menu>
          </View>

          {/* Filtre statut (uniquement pour historique) */}
          {activeTab === 'historique' && (
            <>
              {statutsOptions.map((statut) => (
                <Chip
                  key={statut.id}
                  selected={filterStatut === statut.id}
                  onPress={() => {
                    setFilterStatut(statut.id);
                    setPage(1);
                  }}
                  style={[
                    styles.filterChip,
                    filterStatut === statut.id && {
                      backgroundColor: statut.color
                    }
                  ]}
                  textStyle={
                    filterStatut === statut.id && { color: '#FFF' }
                  }
                >
                  {statut.label}
                </Chip>
              ))}
            </>
          )}
        </ScrollView>

        {(filterStatut || filterAnnee !== new Date().getFullYear()) && (
          <TouchableOpacity
            style={styles.clearFilter}
            onPress={() => {
              setFilterAnnee(new Date().getFullYear());
              setFilterStatut('');
              setPage(1);
            }}
          >
            <MaterialIcons name="close" size={20} color="#7F8C8D" />
            <Text style={styles.clearFilterText}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Carte de salaire
  const renderSalaireCard = ({ item, index }) => {
    const numColumns = isExtraLargeScreen ? 3 : isTablet ? 2 : 1;
    const cardWidth = isExtraLargeScreen 
      ? (windowWidth - 80) / 3 - 20
      : isTablet 
        ? (windowWidth - 60) / 2 - 15
        : windowWidth - 30;

    const getStatutColor = (statut) => {
      switch (statut) {
        case 'payé': return '#2ECC71';
        case 'calculé': return '#F39C12';
        case 'reporté': return '#E74C3C';
        default: return '#95A5A6';
      }
    };

    const getStatutIcon = (statut) => {
      switch (statut) {
        case 'payé': return 'check-circle';
        case 'calculé': return 'schedule';
        case 'reporté': return 'warning';
        default: return 'info';
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.salaireCard,
          isTablet && styles.salaireCardTablet,
          { width: cardWidth }
        ]}
        onPress={() => voirDetails(item.id)}
        activeOpacity={0.7}
      >
        {/* Badge statut */}
        <View style={[
          styles.statutBadge,
          { backgroundColor: getStatutColor(item.statut_paiement) }
        ]}>
          <MaterialIcons 
            name={getStatutIcon(item.statut_paiement)} 
            size={16} 
            color="#FFF" 
          />
          <Text style={styles.statutBadgeText}>
            {item.statut_paiement}
          </Text>
        </View>

        {/* En-tête de carte */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[
              styles.monthIcon,
              { backgroundColor: `${getStatutColor(item.statut_paiement)}20` }
            ]}>
              <Text style={[
                styles.monthIconText,
                { color: getStatutColor(item.statut_paiement) }
              ]}>
                {item.mois}
              </Text>
            </View>
            
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardMonth}>
                {item.mois_nom} {item.annee}
              </Text>
              <Text style={styles.cardDate}>
                Calculé le {formatDate(item.date_calcul)}
              </Text>
            </View>
          </View>

          {item.demande_paiement_envoyee && (
            <Badge 
              style={styles.demandeBadge}
              size={20}
            >
              <MaterialCommunityIcons name="email-check" size={12} color="#FFF" />
            </Badge>
          )}
        </View>

        <Divider style={styles.cardDivider} />

        {/* Corps de carte */}
        <View style={styles.cardBody}>
          {/* Montants */}
          <View style={styles.montantsContainer}>
            <View style={styles.montantRow}>
              <Text style={styles.montantLabel}>Salaire brut</Text>
              <Text style={styles.montantValue}>
                {formatCurrency(item.salaire_brut)}
              </Text>
            </View>
            
            {item.primes_total > 0 && (
              <>
                <Divider style={styles.montantDivider} />
                <View style={styles.montantRow}>
                  <Text style={styles.montantLabel}>Primes</Text>
                  <Text style={[styles.montantValue, styles.montantPositive]}>
                    + {formatCurrency(item.primes_total)}
                  </Text>
                </View>
              </>
            )}

            {item.deductions_total > 0 && (
              <>
                <Divider style={styles.montantDivider} />
                <View style={styles.montantRow}>
                  <Text style={styles.montantLabel}>Déductions</Text>
                  <Text style={[styles.montantValue, styles.montantNegative]}>
                    - {formatCurrency(item.deductions_total)}
                  </Text>
                </View>
              </>
            )}

            <Divider style={styles.montantDividerBold} />
            
            <View style={styles.montantRow}>
              <Text style={styles.montantLabelNet}>Salaire net</Text>
              <Text style={styles.montantValueNet}>
                {formatCurrency(item.salaire_net)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {item.statut_paiement === 'calculé' && !item.demande_paiement_envoyee && (
            <Button
              mode="contained"
              onPress={() => demanderPaiement(item.id)}
              loading={demandeEnCours[item.id]}
              disabled={demandeEnCours[item.id]}
              style={styles.actionButton}
              icon="send"
              labelStyle={styles.actionButtonLabel}
            >
              Demander le paiement
            </Button>
          )}

          {item.statut_paiement === 'payé' && !item.confirme_reception && (
            <Button
              mode="outlined"
              onPress={() => ouvrirModalConfirmation(item)}
              loading={confirmationEnCours[item.id]}
              disabled={confirmationEnCours[item.id]}
              style={styles.actionButtonOutlined}
              icon="check"
            >
              Confirmer réception
            </Button>
          )}

          {item.statut_paiement === 'payé' && item.confirme_reception && (
            <View style={styles.confirmeContainer}>
              <MaterialIcons name="verified" size={20} color="#2ECC71" />
              <Text style={styles.confirmeText}>
                Réception confirmée le {formatDate(item.date_confirmation_reception)}
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        {item.date_paiement && (
          <View style={styles.cardFooter}>
            <MaterialCommunityIcons name="calendar-check" size={16} color="#7F8C8D" />
            <Text style={styles.cardFooterText}>
              Payé le {formatDate(item.date_paiement)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Carte de paiement en attente
  const renderPaiementAttenteCard = ({ item, index }) => {
    const numColumns = isExtraLargeScreen ? 3 : isTablet ? 2 : 1;
    const cardWidth = isExtraLargeScreen 
      ? (windowWidth - 80) / 3 - 20
      : isTablet 
        ? (windowWidth - 60) / 2 - 15
        : windowWidth - 30;

    return (
      <View
        style={[
          styles.salaireCard,
          styles.attenteCard,
          isTablet && styles.salaireCardTablet,
          { width: cardWidth }
        ]}
      >
        {/* En-tête */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.attenteIcon}>
              <MaterialCommunityIcons name="clock-alert" size={24} color="#F39C12" />
            </View>
            
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardMonth}>
                {item.mois_nom} {item.annee}
              </Text>
              <Text style={styles.cardAttenteText}>
                En attente depuis {item.jours_en_attente} jour{item.jours_en_attente > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <Divider style={styles.cardDivider} />

        {/* Corps */}
        <View style={styles.cardBody}>
          <View style={styles.montantRow}>
            <Text style={styles.montantLabel}>Montant dû</Text>
            <Text style={styles.montantValueNet}>
              {formatCurrency(item.salaire_net)}
            </Text>
          </View>

          {item.demande_paiement_envoyee && item.statut_demande && (
            <View style={styles.demandeInfo}>
              <MaterialIcons 
                name={item.statut_demande === 'en_attente' ? 'schedule' : 'check'} 
                size={16} 
                color={item.statut_demande === 'en_attente' ? '#F39C12' : '#2ECC71'} 
              />
              <Text style={styles.demandeInfoText}>
                Demande {item.statut_demande === 'en_attente' ? 'en cours' : 'traitée'}
              </Text>
            </View>
          )}

          {/* Action */}
          {!item.demande_paiement_envoyee && (
            <Button
              mode="contained"
              onPress={() => demanderPaiement(item.id)}
              loading={demandeEnCours[item.id]}
              disabled={demandeEnCours[item.id]}
              style={styles.actionButton}
              icon="send"
            >
              Demander le paiement
            </Button>
          )}
        </View>
      </View>
    );
  };

  // Liste selon l'onglet actif
  const renderListe = () => {
    if (loading && !refreshing && getCurrentData().length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }

    const data = getCurrentData();

    if (data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name={getEmptyIcon()} 
            size={isTablet ? 80 : 60} 
            color="#BDC3C7" 
          />
          <Text style={[
            styles.emptyText,
            isTablet && styles.emptyTextTablet
          ]}>
            {getEmptyMessage()}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={data}
        renderItem={activeTab === 'attente' ? renderPaiementAttenteCard : renderSalaireCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={isExtraLargeScreen ? 3 : isTablet ? 2 : 1}
        key={isExtraLargeScreen ? 'three' : isTablet ? 'two' : 'one'}
        contentContainerStyle={[
          styles.listContent,
          isTablet && styles.listContentTablet
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E86C1']}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => {
          if (!loading || refreshing) return null;
          return (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#2E86C1" />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // Statistiques
  const renderStatistiques = () => {
    if (loading || !statistiques) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.statsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E86C1']}
          />
        }
      >
        {/* Carte totaux annuels */}
        <Card style={[
          styles.statsCard,
          isLargeScreen && styles.statsCardLarge
        ]}>
          <Card.Content>
            <Title style={styles.statsTitle}>
              Totaux année {filterAnnee}
            </Title>
            
            <View style={[
              styles.statsGrid,
              isTablet && styles.statsGridTablet
            ]}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#E8F8F5' }]}>
                  <MaterialCommunityIcons name="calendar-check" size={28} color="#2ECC71" />
                </View>
                <Text style={styles.statValue}>
                  {statistiques.totaux?.total_jours || 0}
                </Text>
                <Text style={styles.statLabel}>Jours d'intervention</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#EBF5FB' }]}>
                  <MaterialCommunityIcons name="medical-bag" size={28} color="#3498DB" />
                </View>
                <Text style={styles.statValue}>
                  {statistiques.totaux?.total_interventions || 0}
                </Text>
                <Text style={styles.statLabel}>Interventions</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#FEF5E7' }]}>
                  <MaterialCommunityIcons name="paw" size={28} color="#F39C12" />
                </View>
                <Text style={styles.statValue}>
                  {statistiques.totaux?.total_animaux || 0}
                </Text>
                <Text style={styles.statLabel}>Animaux traités</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: '#E8F8F5' }]}>
                  <MaterialCommunityIcons name="currency-usd" size={28} color="#2ECC71" />
                </View>
                <Text style={styles.statValue}>
                  {formatCurrency(statistiques.totaux?.cout_total_annuel || 0)}
                </Text>
                <Text style={styles.statLabel}>Coût total</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Stats par mois */}
        <Card style={[
          styles.statsCard,
          isLargeScreen && styles.statsCardLarge
        ]}>
          <Card.Content>
            <Title style={styles.statsTitle}>Détails mensuels</Title>
            
            {statistiques.par_mois?.map((mois, index) => (
              <View key={index}>
                <TouchableOpacity
                  style={styles.monthStatItem}
                  onPress={() => {
                    navigation.navigate('JoursIntervention', {
                      mois: mois.mois,
                      annee: filterAnnee,
                      moisNom: mois.mois_nom
                    });
                  }}
                >
                  <View style={styles.monthStatLeft}>
                    <Text style={styles.monthStatName}>{mois.mois_nom}</Text>
                    <Text style={styles.monthStatDetails}>
                      {mois.jours_intervention} jour{mois.jours_intervention > 1 ? 's' : ''} • {mois.nombre_interventions} intervention{mois.nombre_interventions > 1 ? 's' : ''}
                    </Text>
                  </View>

                  <View style={styles.monthStatRight}>
                    <Text style={styles.monthStatValue}>
                      {formatCurrency(mois.cout_total || 0)}
                    </Text>
                    <MaterialIcons name="chevron-right" size={24} color="#7F8C8D" />
                  </View>
                </TouchableOpacity>

                {/* Types d'interventions */}
                <View style={styles.typeInterventions}>
                  {mois.vaccinations > 0 && (
                    <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                      💉 {mois.vaccinations}
                    </Chip>
                  )}
                  {mois.traitements > 0 && (
                    <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                      💊 {mois.traitements}
                    </Chip>
                  )}
                  {mois.consultations > 0 && (
                    <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                      🩺 {mois.consultations}
                    </Chip>
                  )}
                  {mois.chirurgies > 0 && (
                    <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
                      🔪 {mois.chirurgies}
                    </Chip>
                  )}
                </View>

                {index < statistiques.par_mois.length - 1 && (
                  <Divider style={styles.monthDivider} />
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        <View style={styles.statsBottomSpacing} />
      </ScrollView>
    );
  };

  // Modal détails salaire
  const renderDetailModal = () => {
    if (!selectedSalaire) return null;

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
        presentationStyle={isTablet ? 'pageSheet' : 'fullScreen'}
      >
        <View style={styles.modalContainer}>
          {/* En-tête modal */}
          <View style={[
            styles.modalHeader,
            isTablet && styles.modalHeaderTablet
          ]}>
            <TouchableOpacity 
              onPress={() => setDetailModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={28} color="#2C3E50" />
            </TouchableOpacity>
            
            <Text style={[
              styles.modalTitle,
              isTablet && styles.modalTitleTablet
            ]}>
              Détails du salaire
            </Text>
            
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Card style={styles.detailCard}>
              <Card.Content>
                {/* En-tête */}
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderLeft}>
                    <MaterialCommunityIcons 
                      name="cash-multiple" 
                      size={40} 
                      color="#2E86C1" 
                    />
                    <View style={styles.detailHeaderInfo}>
                      <Text style={styles.detailPeriod}>
                        {selectedSalaire.mois_nom} {selectedSalaire.annee}
                      </Text>
                      <Text style={styles.detailEmploye}>
                        {selectedSalaire.employe_nom}
                      </Text>
                      {selectedSalaire.employe_matricule && (
                        <Text style={styles.detailMatricule}>
                          Matricule: {selectedSalaire.employe_matricule}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <Divider style={styles.modalDivider} />

                {/* Montants détaillés */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Détails du salaire</Text>
                  
                  <View style={styles.detailMontants}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Salaire de base</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(selectedSalaire.salaire_base || selectedSalaire.salaire_brut)}
                      </Text>
                    </View>

                    {selectedSalaire.heures_supplementaires > 0 && (
                      <>
                        <Divider style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>
                            Heures supplémentaires ({selectedSalaire.heures_supplementaires}h)
                          </Text>
                          <Text style={[styles.detailValue, styles.positiveValue]}>
                            + {formatCurrency(selectedSalaire.montant_heures_sup || 0)}
                          </Text>
                        </View>
                      </>
                    )}

                    {selectedSalaire.primes_total > 0 && (
                      <>
                        <Divider style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Primes et bonus</Text>
                          <Text style={[styles.detailValue, styles.positiveValue]}>
                            + {formatCurrency(selectedSalaire.primes_total)}
                          </Text>
                        </View>
                      </>
                    )}

                    <Divider style={styles.detailDividerBold} />
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabelBold}>Salaire brut</Text>
                      <Text style={styles.detailValueBold}>
                        {formatCurrency(selectedSalaire.salaire_brut)}
                      </Text>
                    </View>

                    {selectedSalaire.deductions_total > 0 && (
                      <>
                        <Divider style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Déductions</Text>
                          <Text style={[styles.detailValue, styles.negativeValue]}>
                            - {formatCurrency(selectedSalaire.deductions_total)}
                          </Text>
                        </View>
                      </>
                    )}

                    <Divider style={styles.detailDividerBold} />
                    
                    <View style={styles.detailRowNet}>
                      <Text style={styles.detailLabelNet}>Salaire net à payer</Text>
                      <Text style={styles.detailValueNet}>
                        {formatCurrency(selectedSalaire.salaire_net)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Informations de paiement */}
                {selectedSalaire.statut_paiement === 'payé' && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Informations de paiement</Text>
                    
                    <View style={styles.paiementInfo}>
                      <View style={styles.paiementRow}>
                        <MaterialCommunityIcons name="calendar-check" size={20} color="#2ECC71" />
                        <View style={styles.paiementTextContainer}>
                          <Text style={styles.paiementLabel}>Date de paiement</Text>
                          <Text style={styles.paiementValue}>
                            {formatDate(selectedSalaire.date_paiement)}
                          </Text>
                        </View>
                      </View>

                      {selectedSalaire.mode_paiement && (
                        <View style={styles.paiementRow}>
                          <MaterialCommunityIcons name="cash" size={20} color="#3498DB" />
                          <View style={styles.paiementTextContainer}>
                            <Text style={styles.paiementLabel}>Mode de paiement</Text>
                            <Text style={styles.paiementValue}>
                              {selectedSalaire.mode_paiement}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedSalaire.reference_paiement && (
                        <View style={styles.paiementRow}>
                          <MaterialCommunityIcons name="barcode" size={20} color="#9B59B6" />
                          <View style={styles.paiementTextContainer}>
                            <Text style={styles.paiementLabel}>Référence</Text>
                            <Text style={styles.paiementValue}>
                              {selectedSalaire.reference_paiement}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Validation */}
                {(selectedSalaire.calcule_par_nom || selectedSalaire.valide_par_nom) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Validation</Text>
                    
                    {selectedSalaire.calcule_par_nom && (
                      <View style={styles.validationRow}>
                        <MaterialIcons name="calculate" size={18} color="#7F8C8D" />
                        <Text style={styles.validationText}>
                          Calculé par {selectedSalaire.calcule_par_nom}
                        </Text>
                      </View>
                    )}

                    {selectedSalaire.valide_par_nom && (
                      <View style={styles.validationRow}>
                        <MaterialIcons name="verified" size={18} color="#2ECC71" />
                        <Text style={styles.validationText}>
                          Validé par {selectedSalaire.valide_par_nom}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>

            <View style={styles.modalBottomSpacing} />
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={() => setDetailModalVisible(false)}
              style={styles.modalActionButton}
              icon="check"
            >
              Fermer
            </Button>
          </View>
        </View>
      </Modal>
    );
  };

  // Modal confirmation avec code
  const renderCodeModal = () => (
    <Modal
      visible={showCodeModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {
        setShowCodeModal(false);
        setCodeVerification('');
        setSalaireEnConfirmation(null);
      }}
    >
      <View style={styles.codeModalOverlay}>
        <View style={[
          styles.codeModalContent,
          isTablet && styles.codeModalContentTablet
        ]}>
          <View style={styles.codeModalHeader}>
            <MaterialCommunityIcons name="shield-check" size={40} color="#2E86C1" />
            <Text style={styles.codeModalTitle}>Confirmer la réception</Text>
            <Text style={styles.codeModalSubtitle}>
              Entrez le code de vérification envoyé par email
            </Text>
          </View>

          <TextInput
            mode="outlined"
            label="Code de vérification"
            value={codeVerification}
            onChangeText={setCodeVerification}
            style={styles.codeInput}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <View style={styles.codeModalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowCodeModal(false);
                setCodeVerification('');
                setSalaireEnConfirmation(null);
              }}
              style={styles.codeModalButton}
            >
              Annuler
            </Button>

            <Button
              mode="contained"
              onPress={() => {
                if (salaireEnConfirmation) {
                  confirmerReception(salaireEnConfirmation.id, true);
                }
              }}
              disabled={codeVerification.length !== 6}
              loading={confirmationEnCours[salaireEnConfirmation?.id]}
              style={[styles.codeModalButton, styles.codeModalButtonPrimary]}
            >
              Confirmer
            </Button>
          </View>

          <Divider style={styles.codeModalDivider} />

          <Button
            mode="text"
            onPress={() => {
              if (salaireEnConfirmation) {
                setShowCodeModal(false);
                confirmerReception(salaireEnConfirmation.id, false);
              }
            }}
            style={styles.codeModalTextButton}
          >
            Confirmer sans code
          </Button>
        </View>
      </View>
    </Modal>
  );

  // === FONCTIONS UTILITAIRES === //

  const getCurrentData = () => {
    switch (activeTab) {
      case 'historique': return salaires;
      case 'recus': return paiementsRecus;
      case 'attente': return paiementsAttente;
      default: return [];
    }
  };

  const getEmptyIcon = () => {
    switch (activeTab) {
      case 'historique': return 'file-document-outline';
      case 'recus': return 'cash-check';
      case 'attente': return 'clock-alert-outline';
      default: return 'information-outline';
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'historique': return 'Aucun historique de salaire';
      case 'recus': return 'Aucun paiement reçu';
      case 'attente': return 'Aucun paiement en attente';
      default: return 'Aucune donnée disponible';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-BI', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // === RENDU PRINCIPAL === //

  return (
    <Provider>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {renderHeader()}
        {renderFilters()}

        {activeTab === 'stats' ? renderStatistiques() : renderListe()}

        {renderDetailModal()}
        {renderCodeModal()}
      </Animated.View>
    </Provider>
  );
};

// === STYLES === //

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  // Header
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  headerTablet: {
    paddingHorizontal: 40,
    paddingBottom: 25,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerTitleTablet: {
    fontSize: 26,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentedButtonsTablet: {
    maxWidth: 600,
  },

  // Filtres
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  filtersScroll: {
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  filterLabel: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
    marginRight: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
    marginRight: 4,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  clearFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  clearFilterText: {
    marginLeft: 5,
    fontSize: 13,
    color: '#7F8C8D',
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  emptyTextTablet: {
    fontSize: 18,
  },

  // Liste
  listContent: {
    padding: 15,
  },
  listContentTablet: {
    padding: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // Carte salaire
  salaireCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 15,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  salaireCardTablet: {
    marginHorizontal: 10,
  },
  statutBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 1,
  },
  statutBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  monthIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthIconText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cardMonth: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  cardDate: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 4,
  },
  demandeBadge: {
    backgroundColor: '#3498DB',
  },
  cardDivider: {
    marginVertical: 0,
  },
  cardBody: {
    padding: 16,
  },
  montantsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  montantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  montantLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  montantValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  montantPositive: {
    color: '#2ECC71',
  },
  montantNegative: {
    color: '#E74C3C',
  },
  montantDivider: {
    marginVertical: 5,
    backgroundColor: '#ECF0F1',
  },
  montantDividerBold: {
    marginVertical: 10,
    height: 2,
    backgroundColor: '#BDC3C7',
  },
  montantLabelNet: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  montantValueNet: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E86C1',
  },
  actionButton: {
    backgroundColor: '#2E86C1',
    marginTop: 5,
  },
  actionButtonLabel: {
    fontSize: 14,
  },
  actionButtonOutlined: {
    borderColor: '#2ECC71',
    marginTop: 5,
  },
  confirmeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  confirmeText: {
    fontSize: 13,
    color: '#2ECC71',
    marginLeft: 8,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  cardFooterText: {
    fontSize: 13,
    color: '#7F8C8D',
    marginLeft: 8,
  },

  // Carte attente
  attenteCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  attenteIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF5E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAttenteText: {
    fontSize: 13,
    color: '#F39C12',
    marginTop: 4,
    fontWeight: '600',
  },
  demandeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF5E7',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  demandeInfoText: {
    fontSize: 13,
    color: '#F39C12',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Statistiques
  statsContainer: {
    flex: 1,
    padding: 15,
  },
  statsCard: {
    marginBottom: 15,
    backgroundColor: '#FFF',
  },
  statsCardLarge: {
    marginHorizontal: '10%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statsGridTablet: {
    justifyContent: 'flex-start',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 13,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  monthStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  monthStatLeft: {
    flex: 1,
  },
  monthStatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  monthStatDetails: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 4,
  },
  monthStatRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginRight: 5,
  },
  typeInterventions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
  },
  typeChip: {
    marginRight: 8,
    marginBottom: 5,
    backgroundColor: '#F8F9FA',
  },
  typeChipText: {
    fontSize: 12,
  },
  monthDivider: {
    marginVertical: 12,
    backgroundColor: '#ECF0F1',
  },
  statsBottomSpacing: {
    height: 30,
  },

  // Modal détails
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalHeaderTablet: {
    paddingHorizontal: 30,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalTitleTablet: {
    fontSize: 22,
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  detailCard: {
    backgroundColor: '#FFF',
  },
  detailHeader: {
    marginBottom: 20,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailHeaderInfo: {
    marginLeft: 15,
  },
  detailPeriod: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  detailEmploye: {
    fontSize: 15,
    color: '#7F8C8D',
    marginTop: 4,
  },
  detailMatricule: {
    fontSize: 13,
    color: '#95A5A6',
    marginTop: 2,
  },
  modalDivider: {
    marginVertical: 20,
    backgroundColor: '#ECF0F1',
  },
  detailSection: {
    marginBottom: 25,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailMontants: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  positiveValue: {
    color: '#2ECC71',
  },
  negativeValue: {
    color: '#E74C3C',
  },
  detailDivider: {
    marginVertical: 8,
    backgroundColor: '#ECF0F1',
  },
  detailDividerBold: {
    marginVertical: 12,
    height: 2,
    backgroundColor: '#BDC3C7',
  },
  detailLabelBold: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  detailRowNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#E8F8F5',
    borderRadius: 10,
    marginTop: 10,
  },
  detailLabelNet: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  detailValueNet: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  paiementInfo: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
  },
  paiementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  paiementTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  paiementLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  paiementValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 2,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  validationText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  modalActions: {
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  modalActionButton: {
    backgroundColor: '#2E86C1',
  },
  modalBottomSpacing: {
    height: 30,
  },

  // Modal code
  codeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  codeModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  codeModalContentTablet: {
    maxWidth: 500,
  },
  codeModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  codeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 15,
    textAlign: 'center',
  },
  codeModalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 8,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#FFF',
    fontSize: 18,
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeModalButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  codeModalButtonPrimary: {
    backgroundColor: '#2E86C1',
  },
  codeModalDivider: {
    marginVertical: 20,
    backgroundColor: '#ECF0F1',
  },
  codeModalTextButton: {
    marginTop: 5,
  },
});

export default SalairesScreen;