// frontend/src/screens/employe-temps-partiel/AllScreensTempsPartiel.js
import React, { useState, useEffect } from 'react';
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
  Modal
} from 'react-native';
import {
  Card,
  Title,
  ActivityIndicator,
  Chip,
  Button,
  Divider
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as Location from 'expo-location';
import tempsPartielService from '../../services/employeService';

const { width } = Dimensions.get('window');
const Tab = createMaterialTopTabNavigator();

// ============================================
// ÉCRAN 1: DASHBOARD TEMPS PARTIEL
// ============================================
const DashboardTempsPartiel = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [todayPointage, setTodayPointage] = useState(null);
  const [paiementsEnAttente, setPaiementsEnAttente] = useState([]);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashboard, pointage, paiements] = await Promise.all([
        tempsPartielService.getDashboard(),
        tempsPartielService.getTodayPointage(),
        tempsPartielService.getPaiementsEnAttente()
      ]);

      setDashboardData(dashboard);
      setTodayPointage(pointage);
      setPaiementsEnAttente(paiements);
      setIsWorking(pointage?.heure_entree && !pointage?.heure_sortie);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handlePointageEntree = async () => {
    try {
      // Demander la permission de localisation
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La localisation est requise pour le pointage');
        return;
      }

      // Obtenir la localisation
      const location = await Location.getCurrentPositionAsync({});
      
      const result = await tempsPartielService.pointageEntree({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (result.success) {
        Alert.alert('Succès', 'Pointage d\'entrée enregistré');
        loadDashboard();
      }
    } catch (error) {
      console.error('Erreur pointage entrée:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'enregistrer le pointage');
    }
  };

  const handlePointageSortie = async () => {
    Alert.alert(
      'Confirmer la sortie',
      'Voulez-vous enregistrer votre pointage de sortie?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission refusée', 'La localisation est requise');
                return;
              }

              const location = await Location.getCurrentPositionAsync({});
              
              const result = await tempsPartielService.pointageSortie({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });

              if (result.success) {
                Alert.alert(
                  'Bonne journée!',
                  `Vous avez travaillé ${result.duree_travail || '0h'}. À demain!`
                );
                loadDashboard();
              }
            } catch (error) {
              console.error('Erreur pointage sortie:', error);
              Alert.alert('Erreur', 'Impossible d\'enregistrer le pointage');
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const renderContractAlert = () => {
    if (!dashboardData?.jours_restants_contrat) return null;

    const joursRestants = dashboardData.jours_restants_contrat;
    const isUrgent = joursRestants <= 7;

    return (
      <View style={[styles.contractAlert, isUrgent && styles.contractAlertUrgent]}>
        <MaterialIcons
          name={isUrgent ? 'warning' : 'info'}
          size={24}
          color={isUrgent ? '#E74C3C' : '#F39C12'}
        />
        <View style={styles.contractAlertContent}>
          <Text style={styles.contractAlertTitle}>
            {isUrgent ? 'Fin de contrat imminente!' : 'Information contrat'}
          </Text>
          <Text style={styles.contractAlertText}>
            {joursRestants} jour{joursRestants > 1 ? 's' : ''} restant{joursRestants > 1 ? 's' : ''} jusqu'à la fin de votre contrat
          </Text>
        </View>
      </View>
    );
  };

  const renderPointageCard = () => {
    const hasEntry = todayPointage?.heure_entree;
    const hasExit = todayPointage?.heure_sortie;

    return (
      <Card style={styles.pointageCard}>
        <LinearGradient
          colors={['#9B59B6', '#8E44AD']}
          style={styles.pointageGradient}
        >
          <View style={styles.pointageHeader}>
            <Text style={styles.pointageTitle}>Pointage rapide</Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: isWorking ? '#2ECC71' : '#E74C3C' }
            ]}>
              <MaterialIcons
                name={isWorking ? 'schedule' : 'not-interested'}
                size={16}
                color="#FFF"
              />
            </View>
          </View>

          <View style={styles.pointageContent}>
            {!hasEntry && (
              <View style={styles.noPointage}>
                <MaterialIcons name="touch-app" size={40} color="rgba(255,255,255,0.7)" />
                <Text style={styles.noPointageText}>Aucun pointage aujourd'hui</Text>
              </View>
            )}

            {hasEntry && (
              <View style={styles.pointageDetails}>
                <View style={styles.pointageTime}>
                  <MaterialIcons name="login" size={24} color="#2ECC71" />
                  <View style={styles.pointageTimeInfo}>
                    <Text style={styles.pointageTimeLabel}>Entrée</Text>
                    <Text style={styles.pointageTimeValue}>{todayPointage.heure_entree}</Text>
                  </View>
                </View>

                <MaterialIcons name="trending-flat" size={24} color="rgba(255,255,255,0.5)" />

                <View style={styles.pointageTime}>
                  <MaterialIcons name="logout" size={24} color={hasExit ? '#E74C3C' : '#95A5A6'} />
                  <View style={styles.pointageTimeInfo}>
                    <Text style={styles.pointageTimeLabel}>Sortie</Text>
                    <Text style={styles.pointageTimeValue}>
                      {hasExit ? todayPointage.heure_sortie : '--:--'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {isWorking && (
              <View style={styles.workingIndicator}>
                <View style={styles.pulseCircle} />
                <Text style={styles.workingText}>En cours de travail</Text>
              </View>
            )}
          </View>

          <View style={styles.pointageActions}>
            {!hasEntry && (
              <TouchableOpacity
                style={[styles.pointageButton, styles.entreeButton]}
                onPress={handlePointageEntree}
              >
                <MaterialIcons name="login" size={20} color="#FFF" />
                <Text style={styles.pointageButtonText}>Pointer l'entrée</Text>
              </TouchableOpacity>
            )}

            {hasEntry && !hasExit && (
              <TouchableOpacity
                style={[styles.pointageButton, styles.sortieButton]}
                onPress={handlePointageSortie}
              >
                <MaterialIcons name="logout" size={20} color="#FFF" />
                <Text style={styles.pointageButtonText}>Pointer la sortie</Text>
              </TouchableOpacity>
            )}

            {hasExit && (
              <View style={styles.completedBadge}>
                <MaterialIcons name="check-circle" size={20} color="#2ECC71" />
                <Text style={styles.completedText}>Pointage complété</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.historiqueLink}
              onPress={() => navigation.navigate('HeuresPointage')}
            >
              <Text style={styles.historiqueLinkText}>Voir l'historique</Text>
              <MaterialIcons name="chevron-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Card>
    );
  };

  const renderStatsCards = () => {
    if (!dashboardData) return null;

    return (
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#9B59B6' }]}>
            <MaterialIcons name="access-time" size={24} color="#FFF" />
          </View>
          <Text style={styles.statValue}>{dashboardData.heures_ce_mois || 0}h</Text>
          <Text style={styles.statLabel}>Heures ce mois</Text>
          <Text style={styles.statSubtext}>
            {dashboardData.jours_travailles_mois || 0} jours travaillés
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#2ECC71' }]}>
            <MaterialIcons name="attach-money" size={24} color="#FFF" />
          </View>
          <Text style={styles.statValue}>{formatCurrency(dashboardData.total_paye)}</Text>
          <Text style={styles.statLabel}>Total payé</Text>
          <Text style={styles.statSubtext}>
            {dashboardData.nombre_paiements || 0} paiement{dashboardData.nombre_paiements > 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#F39C12' }]}>
            <MaterialIcons name="schedule" size={24} color="#FFF" />
          </View>
          <Text style={styles.statValue}>{formatCurrency(dashboardData.montant_en_attente)}</Text>
          <Text style={styles.statLabel}>En attente</Text>
          <Text style={styles.statSubtext}>
            {dashboardData.paiements_en_attente || 0} paiement{dashboardData.paiements_en_attente > 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#3498DB' }]}>
            <MaterialIcons name="trending-up" size={24} color="#FFF" />
          </View>
          <Text style={styles.statValue}>{dashboardData.heures_supplementaires || 0}h</Text>
          <Text style={styles.statLabel}>Heures sup</Text>
          <Text style={styles.statSubtext}>
            Taux: {dashboardData.taux_horaire || 0}$/h
          </Text>
        </View>
      </View>
    );
  };

  const renderPaiementsEnAttente = () => {
    if (!paiementsEnAttente || paiementsEnAttente.length === 0) return null;

    return (
      <Card style={styles.paiementsCard}>
        <Card.Content>
          <View style={styles.paiementsHeader}>
            <Title style={styles.paiementsTitle}>Paiements en attente</Title>
            <TouchableOpacity onPress={() => navigation.navigate('Paiements')}>
              <Text style={styles.voirToutText}>Tout voir</Text>
            </TouchableOpacity>
          </View>

          {paiementsEnAttente.slice(0, 3).map((paiement, index) => (
            <View key={index} style={styles.paiementItem}>
              <View style={styles.paiementLeft}>
                <View style={[styles.paiementIcon, { backgroundColor: '#F39C1220' }]}>
                  <MaterialIcons name="schedule" size={24} color="#F39C12" />
                </View>
                <View style={styles.paiementInfo}>
                  <Text style={styles.paiementPeriode}>
                    {new Date(paiement.periode_debut).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.paiementHeures}>
                    {paiement.heures_travaillees}h travaillées
                  </Text>
                  <Text style={styles.paiementAttente}>
                    En attente depuis {paiement.jours_attente} jour{paiement.jours_attente > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.paiementMontant}>
                <Text style={styles.paiementValue}>{formatCurrency(paiement.montant)}</Text>
                <Chip
                  style={styles.paiementChip}
                  textStyle={styles.paiementChipText}
                >
                  {paiement.statut}
                </Chip>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const renderQuickActions = () => {
    return (
      <Card style={styles.actionsCard}>
        <Card.Content>
          <Title style={styles.actionsTitle}>Actions rapides</Title>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HeuresPointage')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9B59B6' }]}>
                <MaterialIcons name="access-time" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Mes heures</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Paiements')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2ECC71' }]}>
                <MaterialIcons name="attach-money" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Paiements</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Contrat')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3498DB' }]}>
                <MaterialIcons name="description" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Mon contrat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Profil')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E74C3C' }]}>
                <MaterialIcons name="person" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Profil</Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B59B6" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.userName}>{dashboardData?.nom_complet}</Text>
        </View>
        <Chip
          icon="schedule"
          style={styles.typeChip}
          textStyle={styles.typeChipText}
        >
          Temps Partiel
        </Chip>
      </View>

      {/* Alerte contrat */}
      {renderContractAlert()}

      {/* Carte de pointage */}
      {renderPointageCard()}

      {/* Statistiques */}
      {renderStatsCards()}

      {/* Paiements en attente */}
      {renderPaiementsEnAttente()}

      {/* Actions rapides */}
      {renderQuickActions()}
    </ScrollView>
  );
};

// ============================================
// ÉCRAN 2: HEURES & POINTAGE
// ============================================
const HeuresPointageScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [presences, setPresences] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPresence, setSelectedPresence] = useState(null);

  useEffect(() => {
    loadPresences();
  }, [selectedMonth, selectedYear]);

  const loadPresences = async () => {
    try {
      setLoading(true);
      const data = await tempsPartielService.getHeures({
        mois: selectedMonth + 1,
        annee: selectedYear
      });
      setPresences(data.presences || []);
      setStatistics(data.statistiques);
    } catch (error) {
      console.error('Erreur chargement présences:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPresences();
  };

  const changeMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const viewPresenceDetail = (presence) => {
    setSelectedPresence(presence);
    setShowDetailModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  const calculateDuration = (entree, sortie) => {
    if (!entree || !sortie) return '--';
    
    const [heuresE, minutesE] = entree.split(':').map(Number);
    const [heuresS, minutesS] = sortie.split(':').map(Number);
    
    const totalMinutes = (heuresS * 60 + minutesS) - (heuresE * 60 + minutesE);
    const heures = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${heures}h${minutes > 0 ? minutes : ''}`;
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const renderMonthSelector = () => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    return (
      <View style={styles.monthSelector}>
        <TouchableOpacity
          style={styles.monthButton}
          onPress={() => changeMonth(-1)}
        >
          <MaterialIcons name="chevron-left" size={24} color="#2C3E50" />
        </TouchableOpacity>

        <View style={styles.monthDisplay}>
          <Text style={styles.monthText}>
            {monthNames[selectedMonth]} {selectedYear}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.monthButton}
          onPress={() => changeMonth(1)}
          disabled={
            selectedYear === new Date().getFullYear() &&
            selectedMonth === new Date().getMonth()
          }
        >
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={
              selectedYear === new Date().getFullYear() &&
              selectedMonth === new Date().getMonth()
                ? '#BDC3C7'
                : '#2C3E50'
            }
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSummaryCard = () => {
    if (!statistics) return null;

    return (
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.summaryTitle}>Résumé du mois</Title>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <MaterialIcons name="access-time" size={24} color="#9B59B6" />
              <Text style={styles.summaryValue}>{statistics.total_heures || 0}h</Text>
              <Text style={styles.summaryLabel}>Total heures</Text>
            </View>

            <View style={styles.summaryItem}>
              <MaterialIcons name="event" size={24} color="#2ECC71" />
              <Text style={styles.summaryValue}>{statistics.jours_travailles || 0}</Text>
              <Text style={styles.summaryLabel}>Jours travaillés</Text>
            </View>

            <View style={styles.summaryItem}>
              <MaterialIcons name="trending-up" size={24} color="#3498DB" />
              <Text style={styles.summaryValue}>
                {(statistics.moyenne_heures_par_jour || 0).toFixed(1)}h
              </Text>
              <Text style={styles.summaryLabel}>Moyenne/jour</Text>
            </View>

            <View style={styles.summaryItem}>
              <MaterialIcons name="star" size={24} color="#F39C12" />
              <Text style={styles.summaryValue}>{statistics.heures_supplementaires || 0}h</Text>
              <Text style={styles.summaryLabel}>Heures sup</Text>
            </View>
          </View>

          <Divider style={styles.summaryDivider} />

          <View style={styles.salaryEstimate}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Salaire estimé</Text>
              <Text style={styles.salaryValue}>
                {formatCurrency((statistics.total_heures || 0) * (statistics.taux_horaire || 0))}
              </Text>
            </View>
            <Text style={styles.salaryNote}>
              Taux horaire: {formatCurrency(statistics.taux_horaire || 0)}/h
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderCalendarView = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    
    const calendarDays = [];
    
    // Jours vides avant le premier jour du mois
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({ empty: true, key: `empty-${i}` });
    }
    
    // Jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const presence = presences.find(p => p.date === dateStr);
      calendarDays.push({ day, date: dateStr, presence, key: dateStr });
    }

    return (
      <Card style={styles.calendarCard}>
        <Card.Content>
          <Title style={styles.calendarTitle}>Calendrier de présence</Title>
          
          {/* En-têtes des jours */}
          <View style={styles.calendarHeader}>
            {dayNames.map((name, index) => (
              <Text key={index} style={styles.calendarDayName}>{name}</Text>
            ))}
          </View>

          {/* Grille du calendrier */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((item) => {
              if (item.empty) {
                return <View key={item.key} style={styles.calendarDayEmpty} />;
              }

              const hasPresence = !!item.presence;
              const isToday = item.date === new Date().toISOString().split('T')[0];

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.calendarDay,
                    hasPresence && styles.calendarDayPresent,
                    isToday && styles.calendarDayToday
                  ]}
                  onPress={() => item.presence && viewPresenceDetail(item.presence)}
                  disabled={!hasPresence}
                >
                  <Text style={[
                    styles.calendarDayNumber,
                    hasPresence && styles.calendarDayNumberPresent,
                    isToday && styles.calendarDayNumberToday
                  ]}>
                    {item.day}
                  </Text>
                  {item.presence && (
                    <View style={styles.calendarDayBadge}>
                      <Text style={styles.calendarDayHours}>
                        {item.presence.duree_heures || 0}h
                      </Text>
                    </View>
                  )}
                  {item.presence && (
                    <View style={styles.calendarDayIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Légende */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2ECC71' }]} />
              <Text style={styles.legendText}>Présent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F39C12' }]} />
              <Text style={styles.legendText}>Retard</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPresencesList = () => {
    if (presences.length === 0) {
      return (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <MaterialIcons name="event-busy" size={64} color="#BDC3C7" />
            <Text style={styles.emptyTitle}>Aucune présence</Text>
            <Text style={styles.emptyText}>
              Aucun pointage enregistré pour ce mois
            </Text>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.listCard}>
        <Card.Content>
          <Title style={styles.listTitle}>Détails des présences</Title>
          
          {presences.map((presence, index) => (
            <TouchableOpacity
              key={index}
              style={styles.presenceItem}
              onPress={() => viewPresenceDetail(presence)}
            >
              <View style={styles.presenceLeft}>
                <View style={styles.presenceDateContainer}>
                  <Text style={styles.presenceDay}>
                    {new Date(presence.date).getDate()}
                  </Text>
                  <Text style={styles.presenceMonth}>
                    {new Date(presence.date).toLocaleDateString('fr-FR', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.presenceInfo}>
                  <Text style={styles.presenceDayName}>
                    {formatDate(presence.date)}
                  </Text>
                  <View style={styles.presenceTimes}>
                    <View style={styles.presenceTimeItem}>
                      <MaterialIcons name="login" size={14} color="#2ECC71" />
                      <Text style={styles.presenceTimeText}>
                        {formatTime(presence.heure_entree)}
                      </Text>
                    </View>
                    <MaterialIcons name="trending-flat" size={14} color="#BDC3C7" />
                    <View style={styles.presenceTimeItem}>
                      <MaterialIcons name="logout" size={14} color="#E74C3C" />
                      <Text style={styles.presenceTimeText}>
                        {formatTime(presence.heure_sortie)}
                      </Text>
                    </View>
                  </View>
                  {presence.remarque && (
                    <Text style={styles.presenceRemarque} numberOfLines={1}>
                      {presence.remarque}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.presenceRight}>
                <Text style={styles.presenceDuration}>
                  {(presence.duree_heures || 0).toFixed(1)}h
                </Text>
                {presence.retard && (
                  <Chip
                    style={styles.retardChip}
                    textStyle={styles.retardChipText}
                  >
                    Retard
                  </Chip>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const renderDetailModal = () => {
    if (!selectedPresence) return null;

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détail de la présence</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialIcons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalDate}>
                <MaterialIcons name="event" size={24} color="#9B59B6" />
                <Text style={styles.modalDateText}>
                  {formatDate(selectedPresence.date)}
                </Text>
              </View>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Heure d'entrée</Text>
                <View style={styles.modalTimeValue}>
                  <MaterialIcons name="login" size={20} color="#2ECC71" />
                  <Text style={styles.modalValue}>
                    {formatTime(selectedPresence.heure_entree)}
                  </Text>
                </View>
              </View>

              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Heure de sortie</Text>
                <View style={styles.modalTimeValue}>
                  <MaterialIcons name="logout" size={20} color="#E74C3C" />
                  <Text style={styles.modalValue}>
                    {formatTime(selectedPresence.heure_sortie)}
                  </Text>
                </View>
              </View>

              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Durée de travail</Text>
                <Text style={styles.modalValueHighlight}>
                  {(selectedPresence.duree_heures || 0).toFixed(2)} heures
                </Text>
              </View>

              {selectedPresence.retard && (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Statut</Text>
                  <Chip
                    icon="warning"
                    style={styles.modalRetardChip}
                    textStyle={{ color: '#FFF' }}
                  >
                    Retard
                  </Chip>
                </View>
              )}

              {selectedPresence.remarque && (
                <>
                  <Divider style={styles.modalDivider} />
                  <View>
                    <Text style={styles.modalLabel}>Remarque</Text>
                    <Text style={styles.modalRemarque}>
                      {selectedPresence.remarque}
                    </Text>
                  </View>
                </>
              )}

              {selectedPresence.localisation_entree && (
                <>
                  <Divider style={styles.modalDivider} />
                  <View>
                    <Text style={styles.modalLabel}>Localisation</Text>
                    <View style={styles.locationInfo}>
                      <MaterialIcons name="place" size={16} color="#3498DB" />
                      <Text style={styles.locationText}>
                        Pointage géolocalisé
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <Button
              mode="contained"
              onPress={() => setShowDetailModal(false)}
              style={styles.modalCloseButton}
            >
              Fermer
            </Button>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B59B6" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderMonthSelector()}
      {renderSummaryCard()}
      {renderCalendarView()}
      {renderPresencesList()}
      {renderDetailModal()}
    </ScrollView>
  );
};

// ============================================
// ÉCRAN 3: PAIEMENTS
// ============================================
const PaiementsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paiements, setPaiements] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStatut, setSelectedStatut] = useState('tous');
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    loadPaiements();
  }, [selectedYear, selectedStatut]);

  const loadPaiements = async () => {
    try {
      setLoading(true);
      const filters = { annee: selectedYear };
      if (selectedStatut !== 'tous') {
        filters.statut = selectedStatut;
      }

      const data = await tempsPartielService.getPaiements(filters);
      setPaiements(data.paiements || []);
      setStatistics(data.statistiques);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      Alert.alert('Erreur', 'Impossible de charger les paiements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPaiements();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatutColor = (statut) => {
    switch(statut) {
      case 'paye': return '#2ECC71';
      case 'calcule': return '#3498DB';
      case 'en_attente': return '#F39C12';
      default: return '#95A5A6';
    }
  };

  const getStatutLabel = (statut) => {
    switch(statut) {
      case 'paye': return 'Payé';
      case 'calcule': return 'Calculé';
      case 'en_attente': return 'En attente';
      default: return statut;
    }
  };

  const renderYearSelector = () => {
    return (
      <View style={styles.yearSelector}>
        <TouchableOpacity
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear - 1)}
        >
          <MaterialIcons name="chevron-left" size={24} color="#2C3E50" />
        </TouchableOpacity>

        <View style={styles.yearDisplay}>
          <Text style={styles.yearText}>{selectedYear}</Text>
        </View>

        <TouchableOpacity
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear + 1)}
          disabled={selectedYear >= new Date().getFullYear()}
        >
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={selectedYear >= new Date().getFullYear() ? '#BDC3C7' : '#2C3E50'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilters = () => {
    const statuts = [
      { value: 'tous', label: 'Tous' },
      { value: 'paye', label: 'Payés' },
      { value: 'calcule', label: 'Calculés' },
      { value: 'en_attente', label: 'En attente' }
    ];

    return (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statuts.map((statut) => (
            <Chip
              key={statut.value}
              selected={selectedStatut === statut.value}
              onPress={() => setSelectedStatut(statut.value)}
              style={[
                styles.filterChip,
                selectedStatut === statut.value && styles.filterChipSelected
              ]}
              textStyle={[
                styles.filterChipText,
                selectedStatut === statut.value && styles.filterChipTextSelected
              ]}
            >
              {statut.label}
            </Chip>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <Card style={styles.statsCard}>
        <Card.Content>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialIcons name="attach-money" size={24} color="#2ECC71" />
              <Text style={styles.statBoxValue}>{formatCurrency(statistics.total_paye)}</Text>
              <Text style={styles.statBoxLabel}>Total payé</Text>
            </View>

            <View style={styles.statBox}>
              <MaterialIcons name="schedule" size={24} color="#F39C12" />
              <Text style={styles.statBoxValue}>{formatCurrency(statistics.montant_en_attente)}</Text>
              <Text style={styles.statBoxLabel}>En attente</Text>
            </View>

            <View style={styles.statBox}>
              <MaterialIcons name="access-time" size={24} color="#3498DB" />
              <Text style={styles.statBoxValue}>{statistics.moyenne_heures || 0}h</Text>
              <Text style={styles.statBoxLabel}>Moy/mois</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPaiementCard = (paiement, index) => {
    const statutColor = getStatutColor(paiement.statut);
    const isPaye = paiement.statut === 'paye';

    return (
      <Card key={index} style={styles.paiementCard}>
        <Card.Content>
          <View style={styles.paiementHeader}>
            <View style={styles.paiementPeriode}>
              <MaterialIcons name="event" size={20} color="#9B59B6" />
              <Text style={styles.paiementPeriodeText}>
                {new Date(paiement.periode_debut).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <Chip
              style={[styles.statutChip, { backgroundColor: statutColor }]}
              textStyle={styles.statutChipText}
            >
              {getStatutLabel(paiement.statut)}
            </Chip>
          </View>

          <View style={styles.paiementBody}>
            <View style={styles.heuresRow}>
              <MaterialIcons name="access-time" size={18} color="#7F8C8D" />
              <Text style={styles.heuresText}>
                {paiement.heures_travaillees || 0} heures travaillées
              </Text>
            </View>

            <Divider style={styles.paiementDivider} />

            <View style={styles.montantRow}>
              <Text style={styles.montantLabel}>Salaire brut</Text>
              <Text style={styles.montantValue}>
                {formatCurrency(paiement.salaire_brut)}
              </Text>
            </View>

            {paiement.deductions > 0 && (
              <View style={styles.montantRow}>
                <Text style={styles.montantLabel}>Déductions</Text>
                <Text style={[styles.montantValue, { color: '#E74C3C' }]}>
                  -{formatCurrency(paiement.deductions)}
                </Text>
              </View>
            )}

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net à payer</Text>
              <Text style={styles.netValue}>
                {formatCurrency(paiement.salaire_net)}
              </Text>
            </View>
          </View>

          <View style={styles.paiementFooter}>
            {isPaye ? (
              <View style={styles.paymentInfo}>
                <MaterialIcons name="check-circle" size={18} color="#2ECC71" />
                <Text style={styles.paymentDate}>
                  Payé le {formatDate(paiement.date_paiement)}
                </Text>
              </View>
            ) : (
              <View style={styles.waitingInfo}>
                <MaterialIcons name="schedule" size={18} color="#F39C12" />
                <Text style={styles.waitingText}>
                  En attente depuis {paiement.jours_attente || 0} jour{paiement.jours_attente > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {paiement.mode_paiement && (
              <View style={styles.paymentMode}>
                <MaterialIcons name="payment" size={16} color="#7F8C8D" />
                <Text style={styles.paymentModeText}>{paiement.mode_paiement}</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B59B6" />
        <Text style={styles.loadingText}>Chargement des paiements...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderYearSelector()}
      {renderFilters()}
      {renderStatistics()}

      <View style={styles.paiementsContainer}>
        {paiements.length > 0 ? (
          paiements.map((paiement, index) => renderPaiementCard(paiement, index))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialIcons name="money-off" size={64} color="#BDC3C7" />
              <Text style={styles.emptyTitle}>Aucun paiement</Text>
              <Text style={styles.emptyText}>
                Aucun paiement trouvé pour les critères sélectionnés
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
  );
};

// ============================================
// NAVIGATION PRINCIPALE (Top Tabs)
// ============================================
const AllScreensTempsPartiel = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#9B59B6',
        tabBarInactiveTintColor: '#7F8C8D',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#FFF' },
        tabBarIndicatorStyle: { backgroundColor: '#9B59B6' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardTempsPartiel}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="dashboard" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HeuresPointage"
        component={HeuresPointageScreen}
        options={{
          tabBarLabel: 'Heures',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="access-time" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Paiements"
        component={PaiementsScreen}
        options={{
          tabBarLabel: 'Paiements',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="attach-money" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// ============================================
// STYLES PARTAGÉS
// ============================================
const styles = StyleSheet.create({
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
  loadingText: {
    marginTop: 10,
    color: '#7F8C8D',
    fontSize: 16,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#FFF',
  },
  greeting: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 4,
  },
  typeChip: {
    backgroundColor: '#9B59B6',
  },
  typeChipText: {
    color: '#FFF',
    fontWeight: '600',
  },

  // Contract alert styles
  contractAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    marginBottom: 0,
    padding: 15,
    backgroundColor: '#FFF8DC',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  contractAlertUrgent: {
    backgroundColor: '#FADBD8',
    borderLeftColor: '#E74C3C',
  },
  contractAlertContent: {
    flex: 1,
    marginLeft: 12,
  },
  contractAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  contractAlertText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },

  // Pointage card styles
  pointageCard: {
    margin: 15,
    elevation: 4,
    overflow: 'hidden',
  },
  pointageGradient: {
    padding: 20,
  },
  pointageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pointageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointageContent: {
    marginBottom: 15,
  },
  noPointage: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noPointageText: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    fontSize: 14,
  },
  pointageDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pointageTime: {
    alignItems: 'center',
  },
  pointageTimeInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  pointageTimeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  pointageTimeValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  workingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  pulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
    marginRight: 8,
  },
  workingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pointageActions: {
    marginTop: 10,
  },
  pointageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  entreeButton: {
    backgroundColor: '#2ECC71',
  },
  sortieButton: {
    backgroundColor: '#E74C3C',
  },
  pointageButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: 10,
    marginBottom: 10,
  },
  completedText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  historiqueLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  historiqueLinkText: {
    color: '#FFF',
    fontSize: 14,
  },

  // Stats grid styles
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    paddingTop: 0,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 15,
    margin: '1%',
    elevation: 2,
    alignItems: 'center',
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 10,
    color: '#95A5A6',
    marginTop: 4,
    textAlign: 'center',
  },

  // Paiements styles
  paiementsCard: {
    margin: 15,
    marginTop: 0,
    elevation: 3,
  },
  paiementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  paiementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  voirToutText: {
    fontSize: 14,
    color: '#9B59B6',
    fontWeight: '600',
  },
  paiementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  paiementLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  paiementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paiementInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paiementPeriode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  paiementHeures: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  paiementAttente: {
    fontSize: 11,
    color: '#F39C12',
    marginTop: 2,
  },
  paiementMontant: {
    alignItems: 'flex-end',
  },
  paiementValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  paiementChip: {
    marginTop: 4,
    backgroundColor: '#F39C12',
  },
  paiementChipText: {
    color: '#FFF',
    fontSize: 10,
  },

  // Actions styles
  actionsCard: {
    margin: 15,
    marginTop: 0,
    marginBottom: 30,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 12,
    color: '#2C3E50',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Month/Year selector
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  monthButton: {
    padding: 10,
  },
  yearButton: {
    padding: 10,
  },
  monthDisplay: {
    marginHorizontal: 30,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
  },
  yearDisplay: {
    marginHorizontal: 30,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  yearText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },

  // Summary card
  summaryCard: {
    margin: 15,
    marginTop: 0,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  summaryDivider: {
    marginVertical: 15,
  },
  salaryEstimate: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salaryLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  salaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  salaryNote: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 4,
  },

  // Calendar styles
  calendarCard: {
    margin: 15,
    marginTop: 0,
    elevation: 3,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  calendarDayName: {
    width: (width - 60) / 7,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: (width - 60) / 7,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 1,
    backgroundColor: '#F8F9FA',
    position: 'relative',
  },
  calendarDayEmpty: {
    width: (width - 60) / 7,
    aspectRatio: 1,
  },
  calendarDayPresent: {
    backgroundColor: '#D5F4E6',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#9B59B6',
  },
  calendarDayNumber: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  calendarDayNumberPresent: {
    fontWeight: 'bold',
    color: '#27AE60',
  },
  calendarDayNumberToday: {
    color: '#9B59B6',
  },
  calendarDayBadge: {
    position: 'absolute',
    bottom: 2,
  },
  calendarDayHours: {
    fontSize: 8,
    color: '#27AE60',
    fontWeight: 'bold',
  },
  calendarDayIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#7F8C8D',
  },

  // Presence list styles
  listCard: {
    margin: 15,
    marginTop: 0,
    marginBottom: 30,
    elevation: 3,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  presenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  presenceLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  presenceDateContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#9B59B6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presenceDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  presenceMonth: {
    fontSize: 10,
    color: '#FFF',
    textTransform: 'uppercase',
  },
  presenceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  presenceDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  presenceTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  presenceTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  presenceTimeText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 4,
  },
  presenceRemarque: {
    fontSize: 11,
    color: '#95A5A6',
    fontStyle: 'italic',
    marginTop: 2,
  },
  presenceRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  presenceDuration: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  retardChip: {
    marginTop: 4,
    backgroundColor: '#F39C12',
  },
  retardChipText: {
    color: '#FFF',
    fontSize: 10,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalBody: {
    padding: 20,
  },
  modalDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 10,
    textTransform: 'capitalize',
  },
  modalDivider: {
    marginVertical: 15,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 8,
  },
  modalTimeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalValueHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  modalRetardChip: {
    backgroundColor: '#F39C12',
  },
  modalRemarque: {
    fontSize: 14,
    color: '#2C3E50',
    marginTop: 5,
    fontStyle: 'italic',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  locationText: {
    fontSize: 12,
    color: '#3498DB',
    marginLeft: 5,
  },
  modalCloseButton: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#9B59B6',
  },

  // Filters
  filtersContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  filterChipSelected: {
    backgroundColor: '#9B59B6',
  },
  filterChipText: {
    color: '#7F8C8D',
  },
  filterChipTextSelected: {
    color: '#FFF',
  },

  // Stats row
  statsCard: {
    margin: 15,
    marginTop: 0,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 4,
  },

  // Paiement card
  paiementsContainer: {
    padding: 15,
    paddingTop: 0,
  },
  paiementCard: {
    marginBottom: 15,
    elevation: 2,
  },
  paiementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  paiementPeriode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paiementPeriodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  statutChip: {
    paddingHorizontal: 12,
  },
  statutChipText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  paiementBody: {
    marginBottom: 15,
  },
  heuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  heuresText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  paiementDivider: {
    marginVertical: 12,
  },
  montantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  montantLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  montantValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D5F4E6',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  netLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  netValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  paiementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentDate: {
    fontSize: 12,
    color: '#27AE60',
    marginLeft: 6,
    fontWeight: '500',
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 12,
    color: '#F39C12',
    marginLeft: 6,
    fontWeight: '500',
  },
  paymentMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentModeText: {
    fontSize: 11,
    color: '#7F8C8D',
    marginLeft: 4,
  },

  // Empty state
  emptyCard: {
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AllScreensTempsPartiel;