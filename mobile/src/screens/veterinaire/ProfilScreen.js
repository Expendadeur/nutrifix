// frontend/src/screens/veterinaire/ProfilScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Modal as RNModal
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Avatar,
  List,
  Divider,
  Button,
  TextInput,
  Badge,
  Chip,
  ActivityIndicator,
  Portal,
  Provider,
  IconButton
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
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

const ProfilScreen = ({ navigation,route,onLogout }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // Responsive
  const isTablet = windowWidth >= 768;
  const isLargeScreen = windowWidth >= 1024;
  const isExtraLargeScreen = windowWidth >= 1440;

  // États
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [presences, setPresences] = useState([]);
  const [conges, setConges] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    jours_presence: 0,
    interventions_mois: 0,
    solde_conges: 0
  });

  // Modals
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);

  // Formulaire mot de passe
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Charger au focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

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

  // Charger les données utilisateur
  const loadUserData = async () => {
    try {
      setLoading(!refreshing);
      const config = await getAxiosConfig();

      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/profil`,
        config
      );

      if (response.data.success) {
        const data = response.data.data;
        setUserData(data.user || {});
        setPresences(data.presences || []);
        setConges(data.conges || []);
        setNotifications(data.notifications || []);
        setStats(data.stats || {
          jours_presence: 0,
          interventions_mois: 0,
          solde_conges: 0
        });
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les données du profil. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  // Changer le mot de passe
  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Tous les champs sont requis');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    try {
      setPasswordLoading(true);
      const config = await getAxiosConfig();

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          currentPassword,
          newPassword,
          confirmPassword
        },
        config
      );

      if (response.data.success) {
        Alert.alert(
          'Succès',
          'Votre mot de passe a été modifié avec succès.',
          [
            {
              text: 'OK',
              onPress: () => {
                setPasswordModalVisible(false);
                setPasswordForm({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 
        'Impossible de modifier le mot de passe. Vérifiez votre mot de passe actuel.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

const handleLogout = async () => {
    console.log('Déconnexion initiée');
    
    try {
      // Nettoyer le stockage local
      await AsyncStorage.clear();
      console.log('Storage nettoyé');
      
      // Fermer le dialog
      //setShowLogoutDialog(false);
      
      // Notification de succès
      //showNotification('Déconnexion réussie', 'success');
      
      // Appeler la fonction de déconnexion du parent
      setTimeout(() => {
        if (onLogout && typeof onLogout === 'function') {
          console.log('Appel de onLogout');
          onLogout();
        } else {
          console.error('onLogout non disponible');
          Alert.alert(
            'Erreur',
            'Impossible de se déconnecter. Veuillez redémarrer l\'application.'
          );
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
      //showNotification('Erreur lors de la déconnexion', 'error');
      
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la déconnexion.'
      );
    }
  };

  // Marquer notification comme lue
  const markNotificationAsRead = async (notificationId) => {
    try {
      const config = await getAxiosConfig();
      
      await axios.put(
        `${API_BASE_URL}/api/veterinaire/notifications/${notificationId}/read`,
        {},
        config
      );
      
      loadUserData();
    } catch (error) {
      console.error('Erreur marquage notification:', error);
    }
  };

  // Layout responsive
  const getResponsiveLayout = () => {
    if (isExtraLargeScreen) return 'three-column';
    if (isLargeScreen) return 'two-column';
    return 'single-column';
  };

  // === COMPOSANTS DE RENDU === //

  // En-tête
  const renderHeader = () => (
    <View style={[
      styles.header,
      isTablet && styles.headerTablet
    ]}>
      <View style={styles.headerContent}>
        <View style={styles.profileImageContainer}>
          <Avatar.Image
            size={isTablet ? 100 : 80}
            source={{ 
              uri: userData?.photo_identite || 'https://via.placeholder.com/100?text=User' 
            }}
            style={styles.avatar}
          />
          <Badge
            style={styles.onlineBadge}
            size={isTablet ? 20 : 16}
          >
            ✓
          </Badge>
        </View>
        
        <View style={[
          styles.profileInfo,
          isTablet && styles.profileInfoTablet
        ]}>
          <Text style={[
            styles.userName,
            isTablet && styles.userNameTablet
          ]}>
            {userData?.nom_complet || 'Utilisateur'}
          </Text>
          <Text style={[
            styles.userRole,
            isTablet && styles.userRoleTablet
          ]}>
            Vétérinaire • {userData?.role || 'Employé'}
          </Text>
          <Text style={styles.userMatricule}>
            Matricule: {userData?.matricule || 'N/A'}
          </Text>
          
          <View style={styles.userTags}>
            {userData?.type_employe && (
              <Chip
                icon="briefcase"
                style={styles.userChip}
                textStyle={styles.userChipText}
                compact
              >
                {userData.type_employe}
              </Chip>
            )}
            {userData?.departement_nom && (
              <Chip
                icon="domain"
                style={styles.userChip}
                textStyle={styles.userChipText}
                compact
              >
                {userData.departement_nom}
              </Chip>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setQrModalVisible(true)}
        >
          <MaterialCommunityIcons name="qrcode" size={28} color="#3498DB" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Cartes de statistiques
  const renderStatsCards = () => {
    const layout = getResponsiveLayout();
    
    return (
      <View style={[
        styles.statsContainer,
        isTablet && styles.statsContainerTablet
      ]}>
        <Card style={[
          styles.statCard,
          layout === 'three-column' && styles.statCardThird,
          layout === 'two-column' && styles.statCardHalf
        ]}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#3498DB' }]}>
                <MaterialCommunityIcons name="calendar-check" size={28} color="#FFF" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.jours_presence || 0}</Text>
                <Text style={styles.statLabel}>Jours présence</Text>
                <Text style={styles.statSubLabel}>Ce mois-ci</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[
          styles.statCard,
          layout === 'three-column' && styles.statCardThird,
          layout === 'two-column' && styles.statCardHalf
        ]}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#2ECC71' }]}>
                <MaterialCommunityIcons name="medical-bag" size={28} color="#FFF" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.interventions_mois || 0}</Text>
                <Text style={styles.statLabel}>Interventions</Text>
                <Text style={styles.statSubLabel}>Ce mois-ci</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[
          styles.statCard,
          layout === 'three-column' && styles.statCardThird,
          layout === 'two-column' && styles.statCardHalf
        ]}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#F39C12' }]}>
                <MaterialCommunityIcons name="beach" size={28} color="#FFF" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.solde_conges || 0}</Text>
                <Text style={styles.statLabel}>Jours de congé</Text>
                <Text style={styles.statSubLabel}>Disponibles</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  // Informations personnelles
  const renderInformationsPersonnelles = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="account-circle" size={24} color="#3498DB" />
          <Title style={styles.cardTitle}>Informations personnelles</Title>
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={[
          styles.infoGrid,
          isTablet && styles.infoGridTablet
        ]}>
          <View style={[
            styles.infoItem,
            isTablet && styles.infoItemHalf
          ]}>
            <MaterialIcons name="email" size={22} color="#7F8C8D" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{userData?.email || 'Non renseigné'}</Text>
            </View>
          </View>

          <View style={[
            styles.infoItem,
            isTablet && styles.infoItemHalf
          ]}>
            <MaterialIcons name="phone" size={22} color="#7F8C8D" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{userData?.telephone || 'Non renseigné'}</Text>
            </View>
          </View>

          <View style={[
            styles.infoItem,
            isTablet && styles.infoItemHalf
          ]}>
            <MaterialIcons name="location-on" size={22} color="#7F8C8D" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{userData?.adresse || 'Non renseignée'}</Text>
            </View>
          </View>

          <View style={[
            styles.infoItem,
            isTablet && styles.infoItemHalf
          ]}>
            <MaterialIcons name="work" size={22} color="#7F8C8D" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Date d'embauche</Text>
              <Text style={styles.infoValue}>
                {formatDate(userData?.date_embauche)}
              </Text>
            </View>
          </View>

          {userData?.numero_cnss && (
            <View style={[
              styles.infoItem,
              isTablet && styles.infoItemHalf
            ]}>
              <MaterialCommunityIcons name="card-account-details" size={22} color="#7F8C8D" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Numéro CNSS</Text>
                <Text style={styles.infoValue}>{userData.numero_cnss}</Text>
              </View>
            </View>
          )}

          {userData?.compte_bancaire && (
            <View style={[
              styles.infoItem,
              isTablet && styles.infoItemHalf
            ]}>
              <MaterialCommunityIcons name="bank" size={22} color="#7F8C8D" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Compte bancaire</Text>
                <Text style={styles.infoValue}>
                  {userData.nom_banque ? `${userData.nom_banque} - ` : ''}
                  {userData.compte_bancaire}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  // Historique de présence
  const renderPresences = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="calendar-check" size={24} color="#2ECC71" />
            <Title style={styles.cardTitle}>Historique de présence</Title>
          </View>
          <Chip style={styles.headerChip} textStyle={{ color: '#FFF' }}>
            {presences.length}
          </Chip>
        </View>

        <Divider style={styles.sectionDivider} />

        {presences.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="calendar-today" size={50} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucune présence enregistrée</Text>
          </View>
        ) : (
          <View style={styles.presenceList}>
            {presences.slice(0, 5).map((presence, index) => {
              const date = new Date(presence.date);
              
              return (
                <View key={index} style={styles.presenceItem}>
                  <View style={styles.presenceDate}>
                    <Text style={styles.presenceDateDay}>
                      {date.getDate()}
                    </Text>
                    <Text style={styles.presenceDateMonth}>
                      {getMonthName(date.getMonth())}
                    </Text>
                  </View>
                  
                  <View style={styles.presenceInfo}>
                    <View style={styles.presenceTime}>
                      <MaterialIcons name="login" size={16} color="#2ECC71" />
                      <Text style={styles.presenceTimeText}>
                        {presence.heure_entree || '-'}
                      </Text>
                    </View>
                    <View style={styles.presenceTime}>
                      <MaterialIcons name="logout" size={16} color="#E74C3C" />
                      <Text style={styles.presenceTimeText}>
                        {presence.heure_sortie || '-'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.presenceDuration}>
                    <Text style={styles.durationText}>
                      {presence.duree_travail || '-'}
                    </Text>
                    <Chip
                      style={[
                        styles.presenceStatusChip,
                        { backgroundColor: getPresenceStatusColor(presence.statut) }
                      ]}
                      textStyle={styles.presenceStatusText}
                      compact
                    >
                      {presence.statut}
                    </Chip>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {presences.length > 5 && (
          <Button
            mode="text"
            onPress={() => navigation.navigate('PresenceDetails')}
            style={styles.viewAllButton}
          >
            Voir l'historique complet
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  // Congés
  const renderConges = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="beach" size={24} color="#F39C12" />
            <Title style={styles.cardTitle}>Mes congés</Title>
          </View>
          <Chip
            style={[styles.headerChip, { backgroundColor: '#2ECC71' }]}
            textStyle={{ color: '#FFF' }}
          >
            {stats?.solde_conges || 0} jours
          </Chip>
        </View>

        <Divider style={styles.sectionDivider} />

        {conges.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="beach" size={50} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucun congé enregistré</Text>
          </View>
        ) : (
          <View style={styles.congesList}>
            {conges.slice(0, 3).map((conge, index) => (
              <View key={index} style={styles.congeItem}>
                <View style={[
                  styles.congeIcon,
                  { backgroundColor: getCongeColor(conge.statut) + '20' }
                ]}>
                  <MaterialCommunityIcons
                    name={getCongeIcon(conge.type_conge)}
                    size={26}
                    color={getCongeColor(conge.statut)}
                  />
                </View>
                
                <View style={styles.congeInfo}>
                  <Text style={styles.congeType}>
                    {conge.type_conge.replace('_', ' ')}
                  </Text>
                  <Text style={styles.congeDates}>
                    {formatDate(conge.date_debut)} → {formatDate(conge.date_fin)}
                  </Text>
                  <Text style={styles.congeDuration}>
                    {conge.jours_demandes} jour{conge.jours_demandes > 1 ? 's' : ''}
                  </Text>
                </View>

                <Chip
                  style={[
                    styles.congeStatusChip,
                    { backgroundColor: getCongeColor(conge.statut) }
                  ]}
                  textStyle={styles.congeStatusText}
                  compact
                >
                  {getCongeStatusLabel(conge.statut)}
                </Chip>
              </View>
            ))}
          </View>
        )}

        <Button
          mode="contained"
          icon="plus"
          onPress={() => navigation.navigate('DemandeConge')}
          style={styles.actionButton}
          labelStyle={styles.actionButtonLabel}
        >
          Demander un congé
        </Button>
      </Card.Content>
    </Card>
  );

  // Notifications
  const renderNotifications = () => {
    const unreadCount = notifications.filter(n => n.statut === 'non_lu').length;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="bell" size={24} color="#E67E22" />
              <Title style={styles.cardTitle}>Notifications récentes</Title>
            </View>
            {unreadCount > 0 && (
              <Badge style={styles.notificationBadge}>{unreadCount}</Badge>
            )}
          </View>

          <Divider style={styles.sectionDivider} />

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="notifications-none" size={50} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune notification</Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.slice(0, 5).map((notification, index) => (
                <TouchableOpacity
                  key={notification.id || index}
                  style={[
                    styles.notificationItem,
                    notification.statut === 'non_lu' && styles.notificationUnread
                  ]}
                  onPress={() => {
                    markNotificationAsRead(notification.id);
                    
                    // Navigation selon le type
                    if (notification.type_reference === 'animal') {
                      navigation.navigate('AnimalDetails', { 
                        animalId: notification.id_reference 
                      });
                    } else if (notification.type_reference === 'intervention') {
                      navigation.navigate('InterventionDetails', { 
                        interventionId: notification.id_reference 
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.notificationIcon,
                    { backgroundColor: getNotificationColor(notification.type_notification) }
                  ]}>
                    <MaterialIcons
                      name={getNotificationIcon(notification.type_notification)}
                      size={22}
                      color="#FFF"
                    />
                  </View>
                  
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>
                      {notification.titre}
                    </Text>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {notification.time_ago}
                    </Text>
                  </View>

                  {notification.statut === 'non_lu' && (
                    <View style={styles.unreadDot} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {notifications.length > 5 && (
            <Button
              mode="text"
              onPress={() => navigation.navigate('Notifications')}
              style={styles.viewAllButton}
            >
              Voir toutes les notifications
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Menu paramètres
  const renderActionsMenu = () => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="cog" size={24} color="#95A5A6" />
          <Title style={styles.cardTitle}>Paramètres</Title>
        </View>

        <Divider style={styles.sectionDivider} />

        <List.Section>
          <List.Item
            title="Changer le mot de passe"
            description="Modifier votre mot de passe"
            left={props => <List.Icon {...props} icon="lock" color="#3498DB" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setPasswordModalVisible(true)}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="Carte d'employé"
            description="Afficher votre carte digitale"
            left={props => <List.Icon {...props} icon="card-account-details" color="#2ECC71" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setQrModalVisible(true)}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="Notifications"
            description="Gérer vos notifications"
            left={props => <List.Icon {...props} icon="bell" color="#F39C12" />}
            right={props => (
              <>
                {notifications.filter(n => n.statut === 'non_lu').length > 0 && (
                  <Badge style={styles.menuBadge}>
                    {notifications.filter(n => n.statut === 'non_lu').length}
                  </Badge>
                )}
                <List.Icon {...props} icon="chevron-right" />
              </>
            )}
            onPress={() => navigation.navigate('Notifications')}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="Aide et support"
            description="Obtenir de l'aide"
            left={props => <List.Icon {...props} icon="help-circle" color="#9B59B6" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('Aide', 'Contactez le support technique')}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="Déconnexion"
            description="Se déconnecter de l'application"
            left={props => <List.Icon {...props} icon="logout" color="#E74C3C" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleLogout}
            style={styles.menuItem}
          />
        </List.Section>
      </Card.Content>
    </Card>
  );

  // Modal changement de mot de passe
  const renderPasswordModal = () => (
    <Portal>
      <RNModal
        visible={passwordModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            isTablet && styles.modalContainerTablet
          ]}>
            <View style={styles.modalHeader}>
              <Title>Changer le mot de passe</Title>
              <TouchableOpacity 
                onPress={() => setPasswordModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={26} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <TextInput
                mode="outlined"
                label="Mot de passe actuel *"
                value={passwordForm.currentPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ 
                  ...prev, 
                  currentPassword: text 
                }))}
                secureTextEntry
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
              />

              <TextInput
                mode="outlined"
                label="Nouveau mot de passe *"
                value={passwordForm.newPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ 
                  ...prev, 
                  newPassword: text 
                }))}
                secureTextEntry
                style={styles.input}
                left={<TextInput.Icon icon="lock-plus" />}
              />

              <TextInput
                mode="outlined"
                label="Confirmer le mot de passe *"
                value={passwordForm.confirmPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ 
                  ...prev, 
                  confirmPassword: text 
                }))}
                secureTextEntry
                style={styles.input}
                left={<TextInput.Icon icon="lock-check" />}
              />

              <Text style={styles.passwordHint}>
                💡 Le mot de passe doit contenir au moins 8 caractères
              </Text>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setPasswordModalVisible(false)}
                  style={styles.modalCancelButton}
                  disabled={passwordLoading}
                >
                  Annuler
                </Button>
                
                <Button
                  mode="contained"
                  onPress={handleChangePassword}
                  loading={passwordLoading}
                  disabled={passwordLoading}
                  style={styles.modalSubmitButton}
                  icon="check"
                >
                  Modifier
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </Portal>
  );

  // Modal QR Code
  const renderQRModal = () => (
    <Portal>
      <RNModal
        visible={qrModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            isTablet && styles.modalContainerTablet
          ]}>
            <View style={styles.modalHeader}>
              <Title>Carte d'employé digitale</Title>
              <TouchableOpacity 
                onPress={() => setQrModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={26} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.qrModalContent}>
              <View style={styles.employeeCard}>
                <View style={styles.employeeCardHeader}>
                  <MaterialCommunityIcons name="factory" size={40} color="#FFF" />
                  <Text style={styles.companyName}>NUTRIFIX</Text>
                  <Text style={styles.companySubtitle}>Gestion d'Élevage</Text>
                </View>

                <View style={styles.employeeCardBody}>
                  <Avatar.Image
                    size={90}
                    source={{ 
                      uri: userData?.photo_identite || 
                        'https://via.placeholder.com/90?text=Photo' 
                    }}
                    style={styles.employeePhoto}
                  />

                  <Text style={styles.employeeName}>
                    {userData?.nom_complet || 'Utilisateur'}
                  </Text>
                  <Text style={styles.employeeRole}>
                    {userData?.role || 'Employé'}
                  </Text>
                  <Text style={styles.employeeMatricule}>
                    Matricule: {userData?.matricule || 'N/A'}
                  </Text>

                  <View style={styles.qrCodeContainer}>
                    <QRCode
                      value={userData?.qr_code || userData?.matricule || 'NO_QR'}
                      size={isTablet ? 180 : 150}
                      backgroundColor="white"
                      color="black"
                    />
                  </View>

                  <Text style={styles.qrCodeInfo}>
                    <MaterialCommunityIcons name="information" size={14} />
                    {' '}Présentez ce code pour le pointage
                  </Text>
                </View>

                <View style={styles.employeeCardFooter}>
                  <MaterialCommunityIcons name="shield-check" size={16} color="#7F8C8D" />
                  <Text style={styles.cardFooterText}>
                    {' '}Valide jusqu'au {formatDate(userData?.date_fin_contrat || '2025-12-31')}
                  </Text>
                </View>
              </View>

              <Button
                mode="outlined"
                onPress={() => setQrModalVisible(false)}
                style={styles.modalCloseButton}
                icon="close"
              >
                Fermer
              </Button>
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </Portal>
  );

  // === FONCTIONS UTILITAIRES === //

  const getPresenceStatusColor = (statut) => {
    switch(statut) {
      case 'present': return '#2ECC71';
      case 'retard': return '#F39C12';
      case 'absent': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getCongeIcon = (type) => {
    switch(type) {
      case 'annuel': return 'beach';
      case 'maladie': return 'hospital-box';
      case 'maternite': 
      case 'paternite': return 'baby-carriage';
      case 'exceptionnel': return 'calendar-star';
      default: return 'calendar';
    }
  };

  const getCongeColor = (statut) => {
    switch(statut) {
      case 'approuve': return '#2ECC71';
      case 'en_attente': return '#F39C12';
      case 'rejete': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getCongeStatusLabel = (statut) => {
    switch(statut) {
      case 'approuve': return 'Approuvé';
      case 'en_attente': return 'En attente';
      case 'rejete': return 'Rejeté';
      default: return 'Inconnu';
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'alerte_sanitaire': return 'warning';
      case 'vaccination': return 'vaccines';
      case 'intervention': return 'medical-services';
      case 'rappel': return 'notifications-active';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch(type) {
      case 'alerte_sanitaire': return '#E74C3C';
      case 'vaccination': return '#F39C12';
      case 'intervention': return '#3498DB';
      case 'rappel': return '#9B59B6';
      default: return '#95A5A6';
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

  const getMonthName = (month) => {
    const months = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
      'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    return months[month];
  };

  // === RENDU PRINCIPAL === //

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  const layout = getResponsiveLayout();

  return (
    <Provider>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3498DB']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderStatsCards()}

        {/* Contenu en colonnes responsive */}
        <View style={[
          styles.contentContainer,
          layout === 'two-column' && styles.contentContainerTwoColumn,
          layout === 'three-column' && styles.contentContainerThreeColumn
        ]}>
          {/* Colonne gauche */}
          <View style={[
            styles.column,
            layout === 'two-column' && styles.columnHalf,
            layout === 'three-column' && styles.columnThird
          ]}>
            {renderInformationsPersonnelles()}
            {renderPresences()}
          </View>

          {/* Colonne milieu (large screens uniquement) */}
          {layout === 'three-column' && (
            <View style={styles.columnThird}>
              {renderConges()}
              {renderActionsMenu()}
            </View>
          )}

          {/* Colonne droite */}
          <View style={[
            styles.column,
            layout === 'two-column' && styles.columnHalf,
            layout === 'three-column' && styles.columnThird
          ]}>
            {layout !== 'three-column' && renderConges()}
            {renderNotifications()}
            {layout !== 'three-column' && renderActionsMenu()}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {renderPasswordModal()}
      {renderQRModal()}
    </Provider>
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
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
    }),
  },
  headerTablet: {
    paddingHorizontal: 40,
    paddingVertical: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#ECF0F1',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#2ECC71',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  profileInfoTablet: {
    marginLeft: 25,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  userNameTablet: {
    fontSize: 24,
  },
  userRole: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  userRoleTablet: {
    fontSize: 16,
  },
  userMatricule: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 4,
  },
  userTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  userChip: {
    backgroundColor: '#ECF0F1',
  },
  userChipText: {
    fontSize: 11,
  },
  qrButton: {
    padding: 8,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
  },
  statsContainerTablet: {
    paddingHorizontal: 40,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statCardHalf: {
    width: '48%',
    flex: 0,
  },
  statCardThird: {
    width: '31%',
    flex: 0,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
    marginLeft: 15,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  statLabel: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 2,
  },

  // Content
  contentContainer: {
    padding: 15,
  },
  contentContainerTwoColumn: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    gap: 20,
    alignItems: 'flex-start',
  },
  contentContainerThreeColumn: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    gap: 20,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
  columnHalf: {
    width: '48%',
    flex: 0,
  },
  columnThird: {
    width: '31%',
    flex: 0,
  },

  // Cards
  card: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerChip: {
    backgroundColor: '#3498DB',
  },
  sectionDivider: {
    marginVertical: 15,
    backgroundColor: '#ECF0F1',
  },

  // Infos
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoGridTablet: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  infoItemHalf: {
    width: '50%',
    borderRightWidth: 1,
    borderRightColor: '#F8F9FA',
    paddingRight: 10,
  },
  infoText: {
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
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#95A5A6',
  },

  // Presences
  presenceList: {
    gap: 8,
  },
  presenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  presenceDate: {
    width: 50,
    alignItems: 'center',
    marginRight: 15,
  },
  presenceDateDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  presenceDateMonth: {
    fontSize: 11,
    color: '#7F8C8D',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  presenceInfo: {
    flex: 1,
  },
  presenceTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  presenceTimeText: {
    fontSize: 13,
    color: '#2C3E50',
    marginLeft: 6,
  },
  presenceDuration: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  presenceStatusChip: {
    height: 22,
  },
  presenceStatusText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },

  // Congés
  congesList: {
    gap: 8,
  },
  congeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  congeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  congeInfo: {
    flex: 1,
  },
  congeType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  congeDates: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  congeDuration: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 2,
  },
  congeStatusChip: {
    height: 24,
  },
  congeStatusText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },

  // Notifications
  notificationsList: {
    gap: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  notificationUnread: {
    backgroundColor: '#EBF5FB',
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#7F8C8D',
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498DB',
    marginLeft: 8,
  },
  notificationBadge: {
    backgroundColor: '#E74C3C',
  },

  // Menu
  menuItem: {
    paddingVertical: 4,
  },
  menuBadge: {
    backgroundColor: '#E74C3C',
    marginRight: 8,
  },

  // Buttons
  actionButton: {
    marginTop: 15,
    backgroundColor: '#3498DB',
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  viewAllButton: {
    marginTop: 10,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    maxHeight: '90%',
    width: '90%',
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
  modalContainerTablet: {
    width: '70%',
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalContent: {
    padding: 20,
    maxHeight: 500,
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#FFF',
  },
  passwordHint: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#95A5A6',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#3498DB',
  },

  // QR Modal
  qrModalContent: {
    padding: 20,
    maxHeight: 600,
  },
  employeeCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#3498DB',
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  employeeCardHeader: {
    backgroundColor: '#3498DB',
    padding: 20,
    alignItems: 'center',
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 10,
  },
  companySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  employeeCardBody: {
    padding: 25,
    alignItems: 'center',
  },
  employeePhoto: {
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#ECF0F1',
  },
  employeeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  employeeRole: {
    fontSize: 15,
    color: '#7F8C8D',
    marginTop: 4,
  },
  employeeMatricule: {
    fontSize: 13,
    color: '#95A5A6',
    marginTop: 4,
    marginBottom: 25,
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ECF0F1',
  },
  qrCodeInfo: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 15,
    textAlign: 'center',
  },
  employeeCardFooter: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterText: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  modalCloseButton: {
    borderColor: '#3498DB',
  },

  // Spacing
  bottomSpacing: {
    height: 30,
  },
});

export default ProfilScreen;