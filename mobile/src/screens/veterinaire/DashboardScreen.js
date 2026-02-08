// frontend/src/screens/veterinaire/DashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Badge,
  Avatar,
  IconButton,
  ActivityIndicator,
  Chip,
  List,
  Divider
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';

// Configuration de l'API
const API_BASE_URL = __DEV__ 
  ? Platform.select({
      ios: 'http://localhost:5000',
      android: 'http://10.0.2.2:5000',
      default: 'http://localhost:5000'
    })
  : 'https://your-production-api.com';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // États
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [veterinaire, setVeterinaire] = useState(null);
  const [stats, setStats] = useState({
    animauxSurveillance: 0,
    interventionsToday: 0,
    vaccinationsDues: 0,
    animauxSains: 0,
    totalInterventions: 0
  });
  const [interventionsToday, setInterventionsToday] = useState([]);
  const [vaccinationsDues, setVaccinationsDues] = useState([]);
  const [animauxSurveillance, setAnimauxSurveillance] = useState([]);
  const [alertes, setAlertes] = useState([]);

  // Déterminer si c'est un écran large (tablette/desktop)
  const isLargeScreen = windowWidth >= 768;
  const isExtraLargeScreen = windowWidth >= 1024;

  // Charger les données au focus de l'écran
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  useEffect(() => {
    loadDashboardData();
    setupNotificationListener();
  }, []);

  // Configuration Axios avec token
  const getAxiosConfig = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  
const socket = io(API_BASE_URL, {
  transports: ['websocket'],
  autoConnect: false,
  withCredentials: true,
});

const setupNotificationListener = (userId, onNotification) => {
  if (!userId) return;

  // Connexion au serveur WebSocket
  if (!socket.connected) {
    socket.connect();
  }

  // Rejoindre la room utilisateur (EXACTEMENT comme ton backend)
  socket.emit('join-room', `user-${userId}`);

  // Réception des notifications
  socket.on('new-notification', (data) => {
    console.log('🔔 Notification temps réel reçue:', data);

    if (typeof onNotification === 'function') {
      onNotification(data);
    }
  });

  // Ping / Pong (optionnel mais propre)
  socket.on('pong', () => {
    console.log('🏓 Pong reçu du serveur');
  });

  socket.emit('ping');

  // Gestion erreurs
  socket.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
  });

  // =========================
  // CLEANUP (OBLIGATOIRE)
  // =========================
  return () => {
    socket.off('new-notification');
    socket.emit('leave-room', `user-${userId}`);
    socket.disconnect();
  };
};

  // Charger toutes les données du dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(!refreshing);
      const config = await getAxiosConfig();

      // Appel API principal pour le dashboard
      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/dashboard`,
        config
      );

      if (response.data.success) {
        const data = response.data.data;
        
        setVeterinaire(data.veterinaire || {});
        setStats(data.stats || {});
        setInterventionsToday(data.interventionsToday || []);
        setVaccinationsDues(data.vaccinationsDues || []);
        setAnimauxSurveillance(data.animauxSurveillance || []);
        setAlertes(data.alertes || []);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les données du dashboard. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Rafraîchir les données
  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  // Marquer une notification comme lue
  const markNotificationAsRead = async (notificationId) => {
    try {
      const config = await getAxiosConfig();
      await axios.put(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {},
        config
      );
      loadDashboardData();
    } catch (error) {
      console.error('Erreur marquage notification:', error);
    }
  };

  // Afficher une alerte et naviguer
  const handleAlertPress = async (alerte) => {
    await markNotificationAsRead(alerte.id);
    
    if (alerte.animal_id) {
      navigation.navigate('AnimalDetails', { animalId: alerte.animal_id });
    }
  };

  // === COMPOSANTS DE RENDU === //

  // En-tête du dashboard
  const renderHeader = () => (
    <View style={[
      styles.header,
      isLargeScreen && styles.headerLarge
    ]}>
      <View style={styles.headerLeft}>
        <Avatar.Icon 
          size={isLargeScreen ? 60 : 50} 
          icon="account" 
          style={styles.avatar} 
        />
        <View style={styles.headerInfo}>
          <Text style={[
            styles.headerTitle,
            isLargeScreen && styles.headerTitleLarge
          ]}>
            Dr. {veterinaire?.nom_complet || 'Vétérinaire'}
          </Text>
          <Text style={styles.headerSubtitle}>
            <MaterialIcons name="circle" size={10} color="#2ECC71" />
            {' '}En service - {veterinaire?.departement_nom || 'Service vétérinaire'}
          </Text>
        </View>
      </View>
      
      <View style={styles.headerActions}>
        <IconButton
          icon="refresh"
          size={24}
          onPress={onRefresh}
          style={styles.headerButton}
        />
        <IconButton
          icon="bell"
          size={24}
          onPress={() => navigation.navigate('Notifications')}
          style={styles.headerButton}
        />
      </View>
    </View>
  );

  // Cartes KPI (indicateurs clés)
  const renderKPICards = () => {
    const kpiData = [
      {
        icon: 'alert-circle',
        value: stats?.animauxSurveillance || 0,
        label: 'Sous surveillance',
        color: '#3498DB',
        onPress: () => navigation.navigate('Animaux', { filter: 'surveillance' })
      },
      {
        icon: 'medical-bag',
        value: stats?.interventionsToday || 0,
        label: "Interventions aujourd'hui",
        color: '#E74C3C',
        onPress: () => navigation.navigate('Interventions', { filter: 'today' })
      },
      {
        icon: 'needle',
        value: stats?.vaccinationsDues || 0,
        label: 'Vaccinations à venir',
        color: '#F39C12',
        onPress: () => navigation.navigate('Interventions', { filter: 'vaccinations' })
      },
      {
        icon: 'check-circle',
        value: stats?.animauxSains || 0,
        label: 'Animaux en bonne santé',
        color: '#2ECC71',
        onPress: () => navigation.navigate('Animaux', { filter: 'healthy' })
      }
    ];

    // Calculer le nombre de colonnes selon la taille de l'écran
    const numColumns = isExtraLargeScreen ? 4 : isLargeScreen ? 2 : 2;
    const cardWidth = isExtraLargeScreen 
      ? '24%' 
      : isLargeScreen 
        ? '48%' 
        : '48%';

    return (
      <View style={[
        styles.kpiContainer,
        isLargeScreen && styles.kpiContainerLarge
      ]}>
        {kpiData.map((kpi, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.kpiCard,
              { 
                backgroundColor: kpi.color,
                width: cardWidth,
                minHeight: isLargeScreen ? 140 : 120
              }
            ]}
            onPress={kpi.onPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name={kpi.icon} 
              size={isLargeScreen ? 36 : 30} 
              color="#FFF" 
            />
            <Text style={[
              styles.kpiValue,
              isLargeScreen && styles.kpiValueLarge
            ]}>
              {kpi.value}
            </Text>
            <Text style={[
              styles.kpiLabel,
              isLargeScreen && styles.kpiLabelLarge
            ]}>
              {kpi.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Alertes sanitaires
  const renderAlertes = () => {
    if (!alertes || alertes.length === 0) {
      return null;
    }

    return (
      <Card style={[
        styles.card,
        isLargeScreen && styles.cardLarge
      ]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialIcons name="warning" size={24} color="#E74C3C" />
              <Title style={styles.cardTitle}>Alertes sanitaires</Title>
            </View>
            <Badge style={[styles.badge, { backgroundColor: '#E74C3C' }]}>
              {alertes.length}
            </Badge>
          </View>

          <Divider style={styles.divider} />

          {alertes.map((alerte, index) => (
            <TouchableOpacity
              key={alerte.id || index}
              style={[
                styles.alerteItem,
                { borderLeftColor: getAlertePriorityColor(alerte.priorite) }
              ]}
              onPress={() => handleAlertPress(alerte)}
              activeOpacity={0.7}
            >
              <View style={styles.alerteIconContainer}>
                <MaterialIcons
                  name="warning"
                  size={24}
                  color={getAlertePriorityColor(alerte.priorite)}
                />
              </View>
              <View style={styles.alerteInfo}>
                <Text style={styles.alerteTitle}>{alerte.titre}</Text>
                <Text style={styles.alerteMessage} numberOfLines={2}>
                  {alerte.message}
                </Text>
                <Text style={styles.alerteTime}>
                  <MaterialIcons name="access-time" size={12} />
                  {' '}{alerte.time_ago}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#BDC3C7" />
            </TouchableOpacity>
          ))}

          {alertes.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.viewAllText}>Voir toutes les alertes</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#3498DB" />
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Interventions du jour
  const renderInterventionsToday = () => {
    const hasInterventions = interventionsToday && interventionsToday.length > 0;

    return (
      <Card style={[
        styles.card,
        isLargeScreen && styles.cardLarge
      ]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="calendar-today" size={24} color="#3498DB" />
              <Title style={styles.cardTitle}>Interventions du jour</Title>
            </View>
            {hasInterventions && (
              <Badge style={styles.badge}>{interventionsToday.length}</Badge>
            )}
          </View>

          <Divider style={styles.divider} />

          {!hasInterventions ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name="calendar-check" 
                size={isLargeScreen ? 60 : 50} 
                color="#BDC3C7" 
              />
              <Text style={styles.emptyText}>
                Aucune intervention prévue aujourd'hui
              </Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => navigation.navigate('Interventions')}
              >
                <Text style={styles.emptyActionText}>Planifier une intervention</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {interventionsToday.map((intervention, index) => (
                <TouchableOpacity
                  key={intervention.id || index}
                  style={styles.interventionItem}
                  onPress={() => navigation.navigate('InterventionDetails', {
                    interventionId: intervention.id
                  })}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.interventionIcon,
                    { backgroundColor: getInterventionColor(intervention.type_intervention) + '20' }
                  ]}>
                    <MaterialCommunityIcons
                      name={getInterventionIcon(intervention.type_intervention)}
                      size={24}
                      color={getInterventionColor(intervention.type_intervention)}
                    />
                  </View>

                  <View style={styles.interventionInfo}>
                    <View style={styles.interventionHeader}>
                      <Text style={styles.interventionTitle} numberOfLines={1}>
                        {intervention.animal_nom} ({intervention.animal_numero})
                      </Text>
                      {intervention.urgent && (
                        <Chip 
                          style={styles.urgentChip} 
                          textStyle={styles.urgentChipText}
                          compact
                        >
                          URGENT
                        </Chip>
                      )}
                    </View>
                    
                    <View style={styles.interventionDetails}>
                      <Text style={styles.interventionType}>
                        {intervention.type_label || intervention.type_intervention}
                      </Text>
                      <Text style={styles.interventionSeparator}> • </Text>
                      <Text style={styles.interventionEspece}>
                        {intervention.animal_espece}
                      </Text>
                    </View>

                    <Text style={styles.interventionTime}>
                      <MaterialIcons name="access-time" size={12} color="#7F8C8D" />
                      {' '}{intervention.heure_prevue || 'Non planifié'}
                    </Text>
                  </View>

                  <MaterialIcons name="chevron-right" size={24} color="#BDC3C7" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => navigation.navigate('Interventions', { filter: 'today' })}
              >
                <Text style={styles.viewAllText}>Voir toutes les interventions</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#3498DB" />
              </TouchableOpacity>
            </>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Vaccinations à venir
  const renderVaccinationsDues = () => {
    if (!vaccinationsDues || vaccinationsDues.length === 0) {
      return null;
    }

    return (
      <Card style={[
        styles.card,
        isLargeScreen && styles.cardLarge
      ]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="needle" size={24} color="#F39C12" />
              <Title style={styles.cardTitle}>Vaccinations à venir (30 jours)</Title>
            </View>
            <Badge style={[styles.badge, { backgroundColor: '#F39C12' }]}>
              {vaccinationsDues.length}
            </Badge>
          </View>

          <Divider style={styles.divider} />

          {vaccinationsDues.slice(0, 10).map((vaccination, index) => {
            const isUrgent = vaccination.jours_restants <= 7;
            
            return (
              <TouchableOpacity
                key={vaccination.animal_id || index}
                style={[
                  styles.vaccinationItem,
                  isUrgent && styles.vaccinationItemUrgent
                ]}
                onPress={() => navigation.navigate('AnimalDetails', {
                  animalId: vaccination.animal_id
                })}
                activeOpacity={0.7}
              >
                <View style={styles.vaccinationLeft}>
                  <View style={styles.vaccinationIconContainer}>
                    <MaterialCommunityIcons name="needle" size={20} color="#F39C12" />
                  </View>
                  
                  <View style={styles.vaccinationInfo}>
                    <Text style={styles.vaccinationAnimal} numberOfLines={1}>
                      {vaccination.animal_nom} - {vaccination.animal_numero}
                    </Text>
                    <View style={styles.vaccinationDetailsRow}>
                      <Text style={styles.vaccinationEspece}>
                        {vaccination.espece}
                      </Text>
                      <Text style={styles.vaccinationSeparator}> • </Text>
                      <Text style={styles.vaccinationType}>
                        {vaccination.vaccin}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.vaccinationRight}>
                  <Text style={[
                    styles.vaccinationDate,
                    isUrgent && styles.vaccinationDateUrgent
                  ]}>
                    {formatDateRelative(vaccination.date_prevue)}
                  </Text>
                  {isUrgent && (
                    <Chip
                      style={styles.joursRestantsChip}
                      textStyle={styles.joursRestantsText}
                      compact
                    >
                      {vaccination.jours_restants}j
                    </Chip>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {vaccinationsDues.length > 10 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Interventions', { filter: 'vaccinations' })}
            >
              <Text style={styles.viewAllText}>
                Voir toutes les vaccinations ({vaccinationsDues.length})
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color="#3498DB" />
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Animaux sous surveillance
  const renderAnimauxSurveillance = () => {
    if (!animauxSurveillance || animauxSurveillance.length === 0) {
      return null;
    }

    return (
      <Card style={[
        styles.card,
        isLargeScreen && styles.cardLarge
      ]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color="#E74C3C" />
              <Title style={styles.cardTitle}>Animaux sous surveillance</Title>
            </View>
            <Badge style={[styles.badge, { backgroundColor: '#E74C3C' }]}>
              {animauxSurveillance.length}
            </Badge>
          </View>

          <Divider style={styles.divider} />

          {animauxSurveillance.slice(0, 10).map((animal, index) => (
            <TouchableOpacity
              key={animal.id || index}
              style={styles.animalItem}
              onPress={() => navigation.navigate('AnimalDetails', { animalId: animal.id })}
              activeOpacity={0.7}
            >
              <Avatar.Image
                size={50}
                source={{
                  uri: animal.photo || 'https://via.placeholder.com/50?text=Animal'
                }}
                style={styles.animalAvatar}
              />

              <View style={styles.animalInfo}>
                <Text style={styles.animalName} numberOfLines={1}>
                  {animal.nom_animal || animal.numero_identification}
                </Text>
                <View style={styles.animalDetailsRow}>
                  <Text style={styles.animalEspece}>{animal.espece}</Text>
                  <Text style={styles.animalSeparator}> • </Text>
                  <Text style={styles.animalRace}>{animal.race}</Text>
                </View>
                {animal.raison_surveillance && (
                  <Text style={styles.animalReason} numberOfLines={2}>
                    {animal.raison_surveillance}
                  </Text>
                )}
                {animal.derniere_intervention && (
                  <Text style={styles.animalLastIntervention}>
                    <MaterialIcons name="history" size={12} />
                    {' '}Dernière visite: {formatDate(animal.derniere_intervention)}
                  </Text>
                )}
              </View>

              <View style={styles.animalStatus}>
                <View style={[
                  styles.healthIndicator,
                  { backgroundColor: getHealthColor(animal.statut_sante) }
                ]}>
                  <MaterialCommunityIcons
                    name={getHealthIcon(animal.statut_sante)}
                    size={24}
                    color="#FFF"
                  />
                </View>
                <Text style={[
                  styles.healthLabel,
                  { color: getHealthColor(animal.statut_sante) }
                ]}>
                  {getHealthLabel(animal.statut_sante)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {animauxSurveillance.length > 10 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Animaux', { filter: 'surveillance' })}
            >
              <Text style={styles.viewAllText}>
                Voir tous les animaux ({animauxSurveillance.length})
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color="#3498DB" />
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Statistiques mensuelles
  const renderStatistiques = () => {
    if (!stats) {
      return null;
    }

    return (
      <Card style={[
        styles.card,
        isLargeScreen && styles.cardLarge
      ]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="chart-bar" size={24} color="#9B59B6" />
              <Title style={styles.cardTitle}>Statistiques du mois</Title>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Grille de statistiques */}
          <View style={[
            styles.statsGrid,
            isLargeScreen && styles.statsGridLarge
          ]}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="medical-bag" size={32} color="#3498DB" />
              <Text style={styles.statValue}>{stats.totalInterventions || 0}</Text>
              <Text style={styles.statLabel}>Interventions</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <MaterialCommunityIcons name="needle" size={32} color="#F39C12" />
              <Text style={styles.statValue}>
                {interventionsToday.filter(i => i.type_intervention === 'vaccination').length}
              </Text>
              <Text style={styles.statLabel}>Vaccinations</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <MaterialCommunityIcons name="pill" size={32} color="#E74C3C" />
              <Text style={styles.statValue}>
                {interventionsToday.filter(i => i.type_intervention === 'traitement').length}
              </Text>
              <Text style={styles.statLabel}>Traitements</Text>
            </View>
          </View>

          {/* Graphique circulaire si données disponibles */}
          {stats.interventionsParType && stats.interventionsParType.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Répartition des interventions</Text>
              <PieChart
                data={stats.interventionsParType.map((item, index) => ({
                  name: item.type_label || item.type,
                  population: item.count,
                  color: getRandomColor(index),
                  legendFontColor: '#7F8C8D',
                  legendFontSize: isLargeScreen ? 14 : 12
                }))}
                width={isLargeScreen ? windowWidth - 120 : windowWidth - 80}
                height={isLargeScreen ? 240 : 200}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Statistiques')}
          >
            <Text style={styles.viewAllText}>Voir toutes les statistiques</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#3498DB" />
          </TouchableOpacity>
        </Card.Content>
      </Card>
    );
  };

  // Actions rapides
  const renderQuickActions = () => (
    <Card style={[
      styles.card,
      isLargeScreen && styles.cardLarge
    ]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#F39C12" />
            <Title style={styles.cardTitle}>Actions rapides</Title>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={[
          styles.quickActionsGrid,
          isLargeScreen && styles.quickActionsGridLarge
        ]}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Interventions', { action: 'create' })}
          >
            <MaterialCommunityIcons name="plus-circle" size={40} color="#3498DB" />
            <Text style={styles.quickActionLabel}>Nouvelle intervention</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Animaux')}
          >
            <MaterialCommunityIcons name="paw" size={40} color="#2ECC71" />
            <Text style={styles.quickActionLabel}>Voir les animaux</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Interventions')}
          >
            <MaterialCommunityIcons name="calendar-month" size={40} color="#E74C3C" />
            <Text style={styles.quickActionLabel}>Planning</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Statistiques')}
          >
            <MaterialCommunityIcons name="chart-line" size={40} color="#9B59B6" />
            <Text style={styles.quickActionLabel}>Rapports</Text>
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );

  // === FONCTIONS UTILITAIRES === //

  const getInterventionIcon = (type) => {
    const icons = {
      vaccination: 'needle',
      traitement: 'pill',
      consultation: 'stethoscope',
      chirurgie: 'hospital-box',
      analyse: 'flask',
      controle: 'clipboard-check'
    };
    return icons[type] || 'medical-bag';
  };

  const getInterventionColor = (type) => {
    const colors = {
      vaccination: '#F39C12',
      traitement: '#E74C3C',
      consultation: '#3498DB',
      chirurgie: '#9B59B6',
      analyse: '#1ABC9C',
      controle: '#2ECC71'
    };
    return colors[type] || '#95A5A6';
  };

  const getHealthIcon = (statut) => {
    const icons = {
      excellent: 'heart-pulse',
      bon: 'heart',
      moyen: 'alert-circle',
      malade: 'alert',
      en_traitement: 'pill',
      critique: 'alert-octagon'
    };
    return icons[statut] || 'help-circle';
  };

  const getHealthColor = (statut) => {
    const colors = {
      excellent: '#2ECC71',
      bon: '#3498DB',
      moyen: '#F39C12',
      malade: '#E74C3C',
      en_traitement: '#9B59B6',
      critique: '#C0392B'
    };
    return colors[statut] || '#95A5A6';
  };

  const getHealthLabel = (statut) => {
    const labels = {
      excellent: 'Excellent',
      bon: 'Bon',
      moyen: 'Moyen',
      malade: 'Malade',
      en_traitement: 'En traitement',
      critique: 'Critique'
    };
    return labels[statut] || 'Inconnu';
  };

  const getAlertePriorityColor = (priorite) => {
    const colors = {
      urgente: '#E74C3C',
      haute: '#F39C12',
      normale: '#3498DB',
      basse: '#95A5A6'
    };
    return colors[priorite] || '#95A5A6';
  };

  const getRandomColor = (index) => {
    const colors = [
      '#3498DB', '#2ECC71', '#F39C12', '#E74C3C', 
      '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'
    ];
    return colors[index % colors.length];
  };

  const formatDateRelative = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays === -1) return 'Hier';
    if (diffDays > 0 && diffDays < 7) return `Dans ${diffDays} jours`;
    if (diffDays < 0 && diffDays > -7) return `Il y a ${Math.abs(diffDays)} jours`;
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // === RENDU PRINCIPAL === //

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  // Layout pour grand écran (desktop/tablette)
  if (isLargeScreen) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderHeader()}
        {renderKPICards()}
        
        <View style={styles.largeScreenLayout}>
          <View style={styles.leftColumn}>
            {renderAlertes()}
            {renderInterventionsToday()}
            {renderVaccinationsDues()}
          </View>
          
          <View style={styles.rightColumn}>
            {renderQuickActions()}
            {renderAnimauxSurveillance()}
            {renderStatistiques()}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    );
  }

  // Layout pour mobile
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderHeader()}
      {renderKPICards()}
      {renderAlertes()}
      {renderInterventionsToday()}
      {renderVaccinationsDues()}
      {renderAnimauxSurveillance()}
      {renderQuickActions()}
      {renderStatistiques()}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

// === STYLES === //

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
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  headerLarge: {
    padding: 30,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    backgroundColor: '#3498DB',
  },
  headerInfo: {
    marginLeft: 15,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerTitleLarge: {
    fontSize: 22,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    margin: 0,
  },

  // KPI Cards
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  kpiContainerLarge: {
    padding: 20,
  },
  kpiCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      },
    }),
  },
  kpiValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
  kpiValueLarge: {
    fontSize: 42,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#FFF',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  kpiLabelLarge: {
    fontSize: 15,
  },

  // Cards
  card: {
    margin: 15,
    borderRadius: 12,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      },
    }),
  },
  cardLarge: {
    margin: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  badge: {
    backgroundColor: '#3498DB',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 15,
    backgroundColor: '#ECF0F1',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 15,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  emptyActionButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Alertes
  alerteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF9F9',
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  alerteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alerteInfo: {
    flex: 1,
  },
  alerteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  alerteMessage: {
    fontSize: 13,
    color: '#7F8C8D',
    lineHeight: 18,
  },
  alerteTime: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 6,
  },

  // Interventions
  interventionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginBottom: 10,
  },
  interventionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  interventionInfo: {
    flex: 1,
  },
  interventionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  interventionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  interventionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  interventionType: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  interventionSeparator: {
    fontSize: 13,
    color: '#BDC3C7',
  },
  interventionEspece: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  interventionTime: {
    fontSize: 12,
    color: '#95A5A6',
  },
  urgentChip: {
    backgroundColor: '#E74C3C',
    height: 24,
  },
  urgentChipText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },

  // Vaccinations
  vaccinationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFBF0',
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  vaccinationItemUrgent: {
    backgroundColor: '#FFF5F5',
    borderLeftColor: '#E74C3C',
  },
  vaccinationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vaccinationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vaccinationInfo: {
    flex: 1,
  },
  vaccinationAnimal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  vaccinationDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaccinationEspece: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  vaccinationType: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  vaccinationRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  vaccinationDate: {
    fontSize: 13,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  vaccinationDateUrgent: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  joursRestantsChip: {
    marginTop: 6,
    backgroundColor: '#E74C3C',
    height: 22,
  },
  joursRestantsText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: 'bold',
  },

  // Animaux
  animalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  animalAvatar: {
    marginRight: 12,
  },
  animalInfo: {
    flex: 1,
  },
  animalName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  animalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  animalEspece: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  animalRace: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  animalReason: {
    fontSize: 12,
    color: '#E74C3C',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  animalLastIntervention: {
    fontSize: 11,
    color: '#95A5A6',
  },
  animalStatus: {
    alignItems: 'center',
    marginLeft: 10,
  },
  healthIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Statistiques
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  statsGridLarge: {
    padding: 25,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 6,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ECF0F1',
    marginHorizontal: 15,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 15,
  },

  // Actions rapides
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionsGridLarge: {
    gap: 15,
  },
  quickActionButton: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quickActionLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
  },

  // Boutons
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
  },
  viewAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },

  // Layout grand écran
  largeScreenLayout: {
    flexDirection: 'row',
    padding: 10,
  },
  leftColumn: {
    flex: 2,
    marginRight: 10,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 10,
  },

  // Spacing
  bottomSpacing: {
    height: 30,
  },
});

export default DashboardScreen;