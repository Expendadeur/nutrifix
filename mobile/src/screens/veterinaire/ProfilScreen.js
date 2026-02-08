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

const ProfilScreen = ({ navigation, route, onLogout }) => {
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

  // Helpers responsive
  const getResponsiveValue = useCallback((values) => {
    const {
      mobile = 15,
      mobileLarge,
      tablet,
      laptop,
      desktop,
      desktopLarge
    } = values;

    switch (getResponsiveLayout()) {
      case 'three-column':
        return desktopLarge ?? desktop ?? laptop ?? tablet ?? mobileLarge ?? mobile;
      case 'two-column':
        return tablet ?? mobileLarge ?? mobile;
      default:
        return mobile;
    }
  }, [getResponsiveLayout]);

  // === COMPOSANTS DE RENDU === //

  // En-tête
  const renderHeader = () => (
    <View style={[
      styles.header,
      isTablet && styles.headerTablet
    ]}>
      <View style={styles.headerContent}>
        <View style={styles.profileImageWrapper}>
          <View style={styles.avatarContainer}>
            <Avatar.Image
              size={isTablet ? 120 : 90}
              source={{
                uri: userData?.photo_identite || 'https://via.placeholder.com/120?text=User'
              }}
              style={styles.avatar}
            />
            <View style={styles.onlineIndicator} />
          </View>
        </View>

        <View style={styles.profileMainInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>
              {userData?.nom_complet || 'Utilisateur'}
            </Text>
            <TouchableOpacity
              style={styles.qrIconBadge}
              onPress={() => setQrModalVisible(true)}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={24} color="#3498DB" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userProfessionalTitle}>
            Docteur Vétérinaire • {userData?.type_employe || 'Titulaire'}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="card-account-details-outline" size={16} color="#7F8C8D" />
              <Text style={styles.metaText}>{userData?.matricule || 'VET-000'}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="domain" size={16} color="#7F8C8D" />
              <Text style={styles.metaText}>{userData?.departement_nom || 'Service Elevage'}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Chip
              icon="calendar-account"
              style={styles.statusChip}
              textStyle={styles.statusChipText}
            >
              En poste
            </Chip>
            <Chip
              icon="star"
              style={styles.loyaltyChip}
              textStyle={styles.loyaltyChipText}
            >
              Vétérinaire Senior
            </Chip>
          </View>
        </View>
      </View>
    </View>
  );

  // Cartes de statistiques
  const renderStatsCards = () => {
    return (
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#3B82F6" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.jours_presence || 0}</Text>
                <Text style={styles.statLabel}>Présence (jours)</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="medical-bag" size={24} color="#10B981" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.interventions_mois || 0}</Text>
                <Text style={styles.statLabel}>Interventions</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <View style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="beach" size={24} color="#F97316" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.solde_conges || 0}</Text>
                <Text style={styles.statLabel}>Solde Congés</Text>
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
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="account-details-outline" size={24} color="#3B82F6" />
            <Title style={styles.cardTitle}>Informations Personnelles</Title>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <MaterialIcons name="alternate-email" size={20} color="#94A3B8" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Email Professionnel</Text>
              <Text style={styles.infoValue}>{userData?.email || 'Non renseigné'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="phone-iphone" size={20} color="#94A3B8" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{userData?.telephone || 'Non renseigné'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="map" size={20} color="#94A3B8" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Adresse de Résidence</Text>
              <Text style={styles.infoValue}>{userData?.adresse || 'Non renseignée'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="event-available" size={20} color="#94A3B8" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Date d'embauche</Text>
              <Text style={styles.infoValue}>
                {formatDate(userData?.date_embauche)}
              </Text>
            </View>
          </View>
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
            <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="#10B981" />
            <Title style={styles.cardTitle}>Présences Récentes</Title>
          </View>
          <Badge style={styles.headerChip}>{presences.length}</Badge>
        </View>

        {presences.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#E2E8F0" />
            <Text style={styles.emptyText}>Aucun pointage ce mois</Text>
          </View>
        ) : (
          <View style={[styles.presenceList, { marginTop: 16 }]}>
            {presences.slice(0, 5).map((presence, index) => {
              const date = new Date(presence.date);

              return (
                <View key={index} style={styles.presenceItem}>
                  <View style={styles.presenceDate}>
                    <Text style={styles.presenceDateDay}>{date.getDate()}</Text>
                    <Text style={styles.presenceDateMonth}>{getMonthName(date.getMonth())}</Text>
                  </View>

                  <View style={styles.presenceInfo}>
                    <Text style={styles.presenceTimeText}>
                      {presence.heure_entree || '--:--'} • {presence.heure_sortie || '--:--'}
                    </Text>
                    <Text style={[styles.infoLabel, { marginTop: 2 }]}>
                      Total: {presence.duree_travail || '0h'}
                    </Text>
                  </View>

                  <Chip
                    style={[
                      styles.presenceStatusChip,
                      { backgroundColor: getPresenceStatusColor(presence.statut) + '20' }
                    ]}
                    textStyle={{ color: getPresenceStatusColor(presence.statut), fontSize: 10, fontWeight: '700' }}
                    compact
                  >
                    {presence.statut.toUpperCase()}
                  </Chip>
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
            <MaterialCommunityIcons name="palm-tree" size={24} color="#F97316" />
            <Title style={styles.cardTitle}>Planning Congés</Title>
          </View>
        </View>

        {conges.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="island" size={48} color="#E2E8F0" />
            <Text style={styles.emptyText}>Aucun congé récent</Text>
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            {conges.slice(0, 3).map((conge, index) => (
              <View key={index} style={styles.congeItem}>
                <View style={[
                  styles.congeIcon,
                  { backgroundColor: getCongeColor(conge.statut) + '15' }
                ]}>
                  <MaterialCommunityIcons
                    name={getCongeIcon(conge.type_conge)}
                    size={22}
                    color={getCongeColor(conge.statut)}
                  />
                </View>

                <View style={styles.congeInfo}>
                  <Text style={styles.congeType}>{conge.type_conge}</Text>
                  <Text style={styles.congeDates}>
                    {formatDate(conge.date_debut)} au {formatDate(conge.date_fin)}
                  </Text>
                </View>

                <Chip
                  style={{ backgroundColor: getCongeColor(conge.statut) + '20' }}
                  textStyle={{ color: getCongeColor(conge.statut), fontSize: 10, fontWeight: '700' }}
                >
                  {getCongeStatusLabel(conge.statut).toUpperCase()}
                </Chip>
              </View>
            ))}
          </View>
        )}

        <Button
          mode="contained"
          onPress={() => navigation.navigate('DemandeConge')}
          style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
          icon="plus-circle"
        >
          Nouvelle Demande
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
              <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#8B5CF6" />
              <Title style={styles.cardTitle}>Alertes & Notifications</Title>
            </View>
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color="#E2E8F0" />
              <Text style={styles.emptyText}>Aucun message reçu</Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              {notifications.slice(0, 5).map((notification, index) => (
                <TouchableOpacity
                  key={notification.id || index}
                  style={[
                    styles.notificationItem,
                    notification.statut === 'non_lu' && styles.notificationUnread
                  ]}
                  onPress={() => markNotificationAsRead(notification.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.notificationIcon,
                    { backgroundColor: getNotificationColor(notification.type_notification) + '20' }
                  ]}>
                    <MaterialIcons
                      name={getNotificationIcon(notification.type_notification)}
                      size={20}
                      color={getNotificationColor(notification.type_notification)}
                    />
                  </View>

                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>
                      {notification.titre}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {notification.time_ago}
                    </Text>
                  </View>
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
              Voir tout le centre d'aide
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
    switch (statut) {
      case 'present': return '#2ECC71';
      case 'retard': return '#F39C12';
      case 'absent': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getCongeIcon = (type) => {
    switch (type) {
      case 'annuel': return 'beach';
      case 'maladie': return 'hospital-box';
      case 'maternite':
      case 'paternite': return 'baby-carriage';
      case 'exceptionnel': return 'calendar-star';
      default: return 'calendar';
    }
  };

  const getCongeColor = (statut) => {
    switch (statut) {
      case 'approuve': return '#2ECC71';
      case 'en_attente': return '#F39C12';
      case 'rejete': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getCongeStatusLabel = (statut) => {
    switch (statut) {
      case 'approuve': return 'Approuvé';
      case 'en_attente': return 'En attente';
      case 'rejete': return 'Rejeté';
      default: return 'Inconnu';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'alerte_sanitaire': return 'warning';
      case 'vaccination': return 'vaccines';
      case 'intervention': return 'medical-services';
      case 'rappel': return 'notifications-active';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
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

  const getResponsiveLayout = () => {
    if (isExtraLargeScreen) return 'three-column';
    if (isLargeScreen) return 'two-column';
    return 'single-column';
  };

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
        <View style={styles.mainWrapper}>
          {renderHeader()}

          <View style={[
            styles.mainContentContainer,
            isTablet && styles.mainContentTablet
          ]}>
            {renderStatsCards()}

            {/* Layout Grid Adaptatif */}
            <View style={[
              styles.responsiveGrid,
              layout === 'two-column' && styles.responsiveGridTwo,
              layout === 'three-column' && styles.responsiveGridThree
            ]}>

              {/* Colonne 1: Infos & Présence */}
              <View style={[
                styles.gridColumn,
                layout !== 'single-column' && styles.gridColumnCompact
              ]}>
                {renderInformationsPersonnelles()}
                {renderPresences()}
              </View>

              {/* Colonne 2: Congés & Actions (ou suite de liste) */}
              <View style={[
                styles.gridColumn,
                layout !== 'single-column' && styles.gridColumnCompact
              ]}>
                {renderConges()}
                {layout === 'two-column' && renderActionsMenu()}
                {layout === 'three-column' && renderNotifications()}
              </View>

              {/* Colonne 3: Notifications & Paramètres (Large Only) */}
              {layout === 'three-column' && (
                <View style={[styles.gridColumn, styles.gridColumnCompact]}>
                  {renderActionsMenu()}
                </View>
              )}

              {/* Pour mobile, Notifications et Menu à la fin */}
              {layout === 'single-column' && (
                <>
                  {renderNotifications()}
                  {renderActionsMenu()}
                </>
              )}

              {/* Pour Tablet, Notifications à la fin de la 2ème col si pas déjà rendu */}
              {layout === 'two-column' && (
                <View style={[styles.gridColumn, styles.gridColumnCompact]}>
                  {renderNotifications()}
                </View>
              )}
            </View>
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
    backgroundColor: '#F8FAFC',
  },
  mainWrapper: {
    paddingBottom: 40,
  },
  mainContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  mainContentTablet: {
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },

  // Header Redesign
  header: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTablet: {
    paddingHorizontal: 40,
    paddingVertical: 50,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageWrapper: {
    marginRight: 20,
  },
  avatarContainer: {
    position: 'relative',
    padding: 4,
    borderRadius: 65,
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    backgroundColor: '#E2E8F0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  profileMainInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  qrIconBadge: {
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 12,
  },
  userProfessionalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  statusChipText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },
  loyaltyChip: {
    backgroundColor: '#F5F3FF',
    borderColor: '#EDE9FE',
  },
  loyaltyChipText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats Card Redesign
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },

  // Grid System
  responsiveGrid: {
    gap: 20,
  },
  responsiveGridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  responsiveGridThree: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridColumn: {
    width: '100%',
    gap: 20,
  },
  gridColumnCompact: {
    flex: 1,
    minWidth: 300,
  },

  // Card Content
  card: {
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerChip: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },

  // Informations Personnelles List
  infoGrid: {
    paddingVertical: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoText: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },

  // Presence List
  presenceList: {
    gap: 12,
  },
  presenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  presenceDate: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 12,
    width: 60,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  presenceDateDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  presenceDateMonth: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  presenceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  presenceTimeText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  presenceStatusChip: {
    borderRadius: 8,
  },

  // Conges
  congeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginBottom: 12,
  },
  congeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  congeInfo: {
    flex: 1,
  },
  congeType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  congeDates: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // Notifications
  notificationItem: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notificationUnread: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  notificationTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Buttons
  actionButton: {
    borderRadius: 12,
    marginTop: 10,
  },
  viewAllButton: {
    marginTop: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: '92%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalContent: {
    padding: 24,
  },

  // QR Modal Card
  employeeCard: {
    borderRadius: 24,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    marginBottom: 24,
  },
  employeeCardHeader: {
    backgroundColor: '#3B82F6',
    padding: 24,
    alignItems: 'center',
  },
  companyName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  employeeCardBody: {
    padding: 32,
    alignItems: 'center',
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 24,
  },

  bottomSpacing: {
    height: 40,
  },
});

export default ProfilScreen;