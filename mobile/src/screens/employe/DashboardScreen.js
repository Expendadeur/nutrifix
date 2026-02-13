// frontend/src/screens/employe/DashboardScreen.js - VERSION OPTIMISÉE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  RefreshControl,
  Animated,
  StatusBar,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import {
  Card,
  ActivityIndicator,
  Modal,
  Portal,
  TextInput,
  Button,
  IconButton
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com/api';

const DashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [carteData, setCarteData] = useState(null);

  // Communication States
  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // États pour le pointage
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadAllData();
    animateEntrance();
  }, []);

  const animateEntrance = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.warn('⚠️ Aucun token trouvé dans AsyncStorage');
        return { 'Content-Type': 'application/json' };
      }
      console.log('📡 Headers construits avec token');
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return { 'Content-Type': 'application/json' };
    }
  };

  // ✅ FONCTION OPTIMISÉE : Charge uniquement les stats de présence
  const loadAttendanceStats = async () => {
    try {
      const headers = await getAuthHeaders();
      console.log('📡 Chargement stats de présence uniquement...');

      const response = await fetch(`${API_URL}/employe-inss/dashboard`, { headers });

      if (response.ok) {
        const dashData = await response.json();
        console.log('✅ Stats de présence mises à jour');
        
        // Met à jour UNIQUEMENT les données de présence
        setDashboardData(prevData => ({
          ...prevData,
          presences_mois: dashData.data.presences_mois || prevData?.presences_mois
        }));
      } else {
        console.warn(`⚠️ Dashboard status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erreur chargement stats présence:', error);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      console.log('📡 Chargement dashboard, profil, carte...');

      const [dashboardRes, profileRes, carteRes] = await Promise.allSettled([
        fetch(`${API_URL}/employe-inss/dashboard`, { headers }),
        fetch(`${API_URL}/employe-inss/profil`, { headers }),
        fetch(`${API_URL}/employe-inss/carte`, { headers })
      ]);

      if (dashboardRes.status === 'fulfilled') {
        const response = dashboardRes.value;

        if (response.status === 401) {
          console.error('❌ 401 Dashboard - Token expiré ou invalide');
          await AsyncStorage.removeItem('userToken');
        } else if (response.status === 403) {
          console.error('❌ 403 Dashboard - Accès refusé');
        } else if (response.ok) {
          const dashData = await response.json();
          console.log('✅ Dashboard reçu');
          setDashboardData(dashData.data);
        } else {
          console.warn(`⚠️ Dashboard status ${response.status}`);
        }
      } else {
        console.error('❌ Dashboard échoué:', dashboardRes.reason?.message);
      }

      if (!dashboardData) {
        setDashboardData({
          presences_mois: { jours_presents: 0, total_heures: 0, moyenne_heures_jour: 0 },
          conges: { jours_disponibles: 0, jours_pris: 0 },
          dernier_salaire: null,
          notifications_non_lues: 0,
          prochains_conges: []
        });
      }

      if (profileRes.status === 'fulfilled') {
        const response = profileRes.value;

        if (response.status === 401) {
          console.error('❌ 401 Profil - Token expiré');
        } else if (response.status === 403) {
          console.error('❌ 403 Profil - Accès refusé');
        } else if (response.ok) {
          const profData = await response.json();
          console.log('✅ Profil reçu');
          setProfileData(profData.data);
        } else {
          console.warn(`⚠️ Profil status ${response.status}`);
        }
      } else {
        console.error('❌ Profil échoué:', profileRes.reason?.message);
      }

      if (!profileData) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setProfileData({
            nom_complet: user.nom_complet || 'Employé',
            role: user.role || 'Employé INSS',
            email: user.email,
            matricule: user.matricule || 'N/A'
          });
        }
      }

      if (carteRes.status === 'fulfilled') {
        const response = carteRes.value;

        if (response.status === 401) {
          console.error('❌ 401 Carte - Token expiré');
        } else if (response.status === 403) {
          console.error('❌ 403 Carte - Accès refusé');
        } else if (response.ok) {
          const carData = await response.json();
          console.log('✅ Carte reçue');
          setCarteData(carData.data);
        } else {
          console.warn(`⚠️ Carte status ${response.status}`);
        }
      } else {
        console.error('❌ Carte échouée:', carteRes.reason?.message);
      }

      if (!carteData) {
        setCarteData({
          carte: {
            id: profileData?.id || 1,
            nom_complet: profileData?.nom_complet || 'NAHIMANA Didier',
            matricule: profileData?.matricule || 'N/A',
            departement_nom: 'NUTRIFIX',
            type_employe: 'INSS',
            numero_cnss: profileData?.numero_cnss || null,
            date_embauche: profileData?.date_embauche || new Date().toISOString(),
            photo_identite: profileData?.photo_identite || null,
            validite: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // ✅ POINTAGE ENTRÉE OPTIMISÉ - Ne recharge QUE les stats de présence
  const handleCheckIn = async () => {
    try {
      setIsCheckingIn(true);
      const headers = await getAuthHeaders();
      console.log('📡 Pointage entrée...');

      const response = await fetch(`${API_URL}/employe-inss/pointage/entree`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ latitude: 0, longitude: 0 })
      });

      if (response.status === 401) {
        console.error('❌ 401 - Token expiré');
        Alert.alert('Erreur', 'Session expirée');
        return;
      }

      if (response.status === 403) {
        console.error('❌ 403 - Accès refusé');
        Alert.alert('Erreur', 'Accès refusé');
        return;
      }

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Pointage enregistré');
        Alert.alert('Succès', 'Pointage d\'entrée enregistré');
        
        // ✅ Recharge UNIQUEMENT les stats de présence (légère animation)
        await loadAttendanceStats();
      } else {
        Alert.alert('Erreur', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur pointage entrée:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le pointage');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // ✅ POINTAGE SORTIE OPTIMISÉ - Ne recharge QUE les stats de présence
  const handleCheckOut = async () => {
    try {
      setIsCheckingOut(true);
      const headers = await getAuthHeaders();
      console.log('📡 Pointage sortie...');

      const response = await fetch(`${API_URL}/employe-inss/pointage/sortie`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ latitude: 0, longitude: 0 })
      });

      if (response.status === 401) {
        console.error('❌ 401 - Token expiré');
        Alert.alert('Erreur', 'Session expirée');
        return;
      }

      if (response.status === 403) {
        console.error('❌ 403 - Accès refusé');
        Alert.alert('Erreur', 'Accès refusé');
        return;
      }

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Pointage enregistré');
        Alert.alert('Succès', 'Pointage de sortie enregistré');
        
        // ✅ Recharge UNIQUEMENT les stats de présence (légère animation)
        await loadAttendanceStats();
      } else {
        Alert.alert('Erreur', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur pointage sortie:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le pointage');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleSendMessage = async () => {
    if (!messageSubject.trim() || !messageBody.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
      return;
    }

    try {
      setIsSending(true);
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL.replace('/api', '')}/api/notifications/contact-admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sujet: messageSubject,
          message: messageBody
        })
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Succès', 'Votre message a été envoyé à l\'administration');
        setCommunicationModalVisible(false);
        setMessageSubject('');
        setMessageBody('');
      } else {
        Alert.alert('Erreur', data.message || 'Impossible d\'envoyer le message');
      }
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const renderHeader = () => {
    if (!profileData) return null;
    return (
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.userName} numberOfLines={1}>{profileData.nom_complet}</Text>
          <View style={styles.userBadge}>
            <MaterialIcons name="verified" size={14} color="#10B981" />
            <Text style={styles.userRole}>{profileData.role}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notificationButton}>
          <View style={styles.notificationIcon}>
            <MaterialIcons name="notifications-none" size={26} color="#1F2937" />
            {dashboardData?.notifications_non_lues > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>
                  {dashboardData.notifications_non_lues > 9 ? '9+' : dashboardData.notifications_non_lues}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderDigitalCard = () => {
    console.log('🔍 renderDigitalCard appelé');
    console.log('🔍 carteData:', carteData);

    if (!carteData?.carte) return null;
    const { carte } = carteData;

    let qrData;
    let useImageQR = false;

    if (carte.qr_code && carte.qr_code.startsWith('data:image')) {
      qrData = carte.qr_code;
      useImageQR = true;
      console.log('✅ Utilisation QR Code du backend (Data URL)');
    } else {
      qrData = JSON.stringify({
        id: carte.id || '000',
        matricule: carte.matricule || 'N/A',
        nom: carte.nom_complet,
        type: carte.type_employe,
        timestamp: Date.now()
      });
      console.log('⚠️ Génération QR Code locale');
    }

    return (
      <Animated.View style={[styles.cardSection, { opacity: fadeAnim }]}>
        <View style={styles.fullCardContainer}>
          <LinearGradient
            colors={['#1E3A8A', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainCard}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardLogoSection}>
                <View style={styles.cardLogoPlaceholder}>
                  <MaterialIcons name="business" size={20} color="#FFF" />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardCompany}>NUTRIFIX</Text>
                  <Text style={styles.cardSubtitle}>Carte d'employé</Text>
                </View>
              </View>
              <View style={styles.cardStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>ACTIF</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.photoColumn}>
                {carte.photo_identite ? (
                  <Image source={{ uri: carte.photo_identite }} style={styles.cardPhoto} resizeMode="cover" />
                ) : (
                  <View style={styles.cardPhotoPlaceholder}>
                    <MaterialIcons name="person" size={40} color="#FFF" />
                  </View>
                )}
              </View>

              <View style={styles.infoColumn}>
                <View style={styles.infoWhiteBox}>
                  <Text style={styles.employeeName} numberOfLines={2}>{carte.nom_complet}</Text>
                  <Text style={styles.employeePosition}>Employé</Text>
                  <Text style={styles.employeeDepartment}>{carte.departement_nom || 'NUTRIFIX'}</Text>

                  <View style={styles.infoDivider} />

                  <View style={styles.detailsList}>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="badge" size={12} color="#2563EB" />
                      <Text style={styles.detailLabel}>Matricule:</Text>
                      <Text style={styles.detailValue}>{carte.matricule || 'N/A'}</Text>
                    </View>

                    {carte.numero_cnss && (
                      <View style={styles.detailRow}>
                        <MaterialIcons name="card-membership" size={12} color="#2563EB" />
                        <Text style={styles.detailLabel}>CNSS:</Text>
                        <Text style={styles.detailValue}>{carte.numero_cnss}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <MaterialIcons name="event" size={12} color="#2563EB" />
                      <Text style={styles.detailLabel}>Depuis:</Text>
                      <Text style={styles.detailValue}>
                        {carte.date_embauche ? new Date(carte.date_embauche).getFullYear() : 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <MaterialIcons name="work" size={12} color="#2563EB" />
                      <Text style={styles.detailLabel}>Type:</Text>
                      <Text style={styles.detailValue}>
                        {carte.type_employe === 'INSS' ? 'Permanent' : 'Temporaire'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.footerLabel}>DATE DE VALIDITÉ</Text>
                <Text style={styles.footerDate}>{formatDate(carte.validite)}</Text>
                <Text style={styles.footerEmission}>Émise le {formatDate(new Date().toISOString())}</Text>
              </View>

              <View style={styles.qrSection}>
                <View style={styles.qrWrapper}>
                  {useImageQR ? (
                    <Image
                      source={{ uri: qrData }}
                      style={{ width: 75, height: 75 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <QRCode
                      value={qrData}
                      size={75}
                      backgroundColor="#FFF"
                      color="#1E3A8A"
                    />
                  )}
                </View>
                <Text style={styles.qrText}>Vérification du code</Text>
              </View>
            </View>

            <View style={styles.serialNumber}>
              <Text style={styles.serialText}>N° {carte.id?.toString().padStart(6, '0') || '000000'}</Text>
            </View>
          </LinearGradient>

          <View style={styles.printNote}>
            <MaterialIcons name="print" size={16} color="#6B7280" />
            <Text style={styles.printNoteText}>
              Cette carte peut être imprimée et utilisée comme badge d'identification
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderAttendanceSection = () => {
    if (!dashboardData?.presences_mois) return null;
    const { jours_presents, total_heures, moyenne_heures_jour } = dashboardData.presences_mois;

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="schedule" size={24} color="#2563EB" />
              <Text style={styles.sectionTitle}>Pointage</Text>
            </View>
            <View style={styles.attendanceGrid}>
              <TouchableOpacity 
                style={[styles.attendanceButton, styles.checkInButton]} 
                onPress={handleCheckIn}
                disabled={isCheckingIn}
              >
                <View style={styles.attendanceIconWrapper}>
                  {isCheckingIn ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialIcons name="login" size={28} color="#FFF" />
                  )}
                </View>
                <Text style={styles.attendanceButtonText}>
                  {isCheckingIn ? 'Pointage...' : 'Pointer Entrée'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.attendanceButton, styles.checkOutButton]} 
                onPress={handleCheckOut}
                disabled={isCheckingOut}
              >
                <View style={styles.attendanceIconWrapper}>
                  {isCheckingOut ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialIcons name="logout" size={28} color="#FFF" />
                  )}
                </View>
                <Text style={styles.attendanceButtonText}>
                  {isCheckingOut ? 'Pointage...' : 'Pointer Sortie'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.attendanceStats}>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="event-available" size={20} color="#2563EB" />
                <Text style={styles.attendanceStatValue}>{jours_presents || 0}</Text>
                <Text style={styles.attendanceStatLabel}>Jours présents</Text>
              </View>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="access-time" size={20} color="#10B981" />
                <Text style={styles.attendanceStatValue}>{total_heures || 0}h</Text>
                <Text style={styles.attendanceStatLabel}>Total heures</Text>
              </View>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="trending-up" size={20} color="#F59E0B" />
                <Text style={styles.attendanceStatValue}>{moyenne_heures_jour || 0}h</Text>
                <Text style={styles.attendanceStatLabel}>Moyenne/jour</Text>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderQuickStats = () => {
    if (!dashboardData) return null;
    const stats = [
      {
        icon: 'beach-access',
        value: dashboardData.conges?.jours_disponibles || 0,
        label: 'Jours de congé',
        color: '#3B82F6',
        onPress: () => navigation.navigate('Conges')
      },
      {
        icon: 'attach-money',
        value: dashboardData.dernier_salaire?.salaire_net
          ? `${Math.round(dashboardData.dernier_salaire.salaire_net).toLocaleString()} FBU`
          : 'N/A',
        label: 'Dernier salaire',
        color: '#10B981',
        onPress: () => navigation.navigate('Salaires')
      },
      {
        icon: 'event-available',
        value: dashboardData.presences_mois?.jours_presents || 0,
        label: 'Présences/mois',
        color: '#F59E0B',
        onPress: () => navigation.navigate('Presences')
      }
    ];

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <TouchableOpacity key={index} style={styles.statCard} onPress={stat.onPress}>
              <View style={[styles.statIcon, { backgroundColor: stat.color }]}>
                <MaterialIcons name={stat.icon} size={24} color="#FFF" />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>{stat.value}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderQuickActions = () => {
    const actions = [
      { icon: 'event', label: 'Demander un congé', color: '#3B82F6', onPress: () => navigation.navigate('DemandeConge') },
      { icon: 'description', label: 'Mes bulletins', color: '#10B981', onPress: () => navigation.navigate('Salaires') },
      { icon: 'person', label: 'Mon profil', color: '#8B5CF6', onPress: () => navigation.navigate('Profil') },
      { icon: 'help', label: 'Aide & Support', color: '#F59E0B', onPress: () => Alert.alert('Support', 'Contactez le service RH') },
      { icon: 'message', label: 'Contacter Admin', color: '#10B981', onPress: () => setCommunicationModalVisible(true) }
    ];

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitleStandalone}>Actions Rapides</Text>
            <View style={styles.actionsGrid}>
              {actions.map((action, index) => (
                <TouchableOpacity key={index} style={styles.actionCard} onPress={action.onPress}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                    <MaterialIcons name={action.icon} size={28} color="#FFF" />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" colors={['#2563EB']} />}
      showsVerticalScrollIndicator={false}
    >
      {renderHeader()}

      {isTablet ? (
        <View style={styles.tabletLayout}>
          <View style={styles.leftColumn}>
            {renderDigitalCard()}
          </View>
          <View style={styles.rightColumn}>
            {renderAttendanceSection()}
            {renderQuickStats()}
            {renderQuickActions()}
          </View>
        </View>
      ) : (
        <>
          {renderDigitalCard()}
          {renderAttendanceSection()}
          {renderQuickStats()}
          {renderQuickActions()}
        </>
      )}

      <Portal>
        <Modal
          visible={communicationModalVisible}
          onDismiss={() => setCommunicationModalVisible(false)}
          contentContainerStyle={[styles.commModalContainer, { width: width > 600 ? 500 : '90%' }]}
        >
          <View style={styles.commModalHeader}>
            <View style={styles.commModalIconWrapper}>
              <MaterialIcons name="contact-support" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.commModalTitle}>Contacter l'Administration</Text>
              <Text style={styles.commModalSubtitle}>Envoyez un message à l'équipe RH/Admin</Text>
            </View>
            <IconButton
              icon="close"
              onPress={() => setCommunicationModalVisible(false)}
              iconColor="#6B7280"
            />
          </View>

          <ScrollView style={styles.commModalBody}>
            <Text style={styles.commInputLabel}>Sujet du message</Text>
            <TextInput
              mode="outlined"
              placeholder="Ex: Demande de renseignement, problème technique..."
              value={messageSubject}
              onChangeText={setMessageSubject}
              outlineColor="#E5E7EB"
              activeOutlineColor="#2563EB"
              style={styles.commInput}
            />

            <Text style={styles.commInputLabel}>Votre message</Text>
            <TextInput
              mode="outlined"
              placeholder="Décrivez votre demande en détail..."
              value={messageBody}
              onChangeText={setMessageBody}
              multiline
              numberOfLines={6}
              outlineColor="#E5E7EB"
              activeOutlineColor="#2563EB"
              style={[styles.commInput, { height: 120 }]}
            />
          </ScrollView>

          <View style={styles.commModalFooter}>
            <Button
              mode="outlined"
              onPress={() => setCommunicationModalVisible(false)}
              style={styles.commFooterBtn}
              textColor="#6B7280"
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSendMessage}
              style={[styles.commFooterBtn, { flex: 2 }]}
              buttonColor="#2563EB"
              loading={isSending}
              disabled={isSending || !messageSubject.trim() || !messageBody.trim()}
              icon="send"
            >
              Envoyer
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { paddingBottom: 30 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280', fontWeight: '500' },

  tabletLayout: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'flex-start',
  },
  leftColumn: {
    width: 400,
  },
  rightColumn: {
    flex: 1,
    gap: 16,
  },

  section: { paddingHorizontal: 16, marginBottom: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 10,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 4 },
  userBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  userRole: { fontSize: 13, color: '#10B981', fontWeight: '600', marginLeft: 6 },
  notificationButton: { padding: 8 },
  notificationIcon: { position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  cardSection: { paddingHorizontal: 16, marginBottom: 20 },
  fullCardContainer: { width: '100%', maxWidth: 500, alignSelf: 'center' },
  mainCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 380,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 12 }
    })
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardLogoSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardHeaderText: { marginLeft: 10 },
  cardCompany: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 1 },
  cardSubtitle: { fontSize: 10, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF', marginRight: 4 },
  statusText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  cardBody: { flexDirection: 'row', marginBottom: 20 },
  photoColumn: { marginRight: 12 },
  cardPhoto: { width: 80, height: 80, borderRadius: 12, borderWidth: 3, borderColor: '#FFF' },
  cardPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF'
  },
  infoColumn: { flex: 1 },
  infoWhiteBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 10,
    padding: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 }
    })
  },
  employeeName: { fontSize: 15, fontWeight: '800', color: '#111827', lineHeight: 18, marginBottom: 2 },
  employeePosition: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 1 },
  employeeDepartment: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
  infoDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  detailsList: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginLeft: 6, marginRight: 4 },
  detailValue: { fontSize: 11, color: '#111827', fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)'
  },
  footerLeft: { flex: 1 },
  footerLabel: { fontSize: 8, color: 'rgba(255, 255, 255, 0.75)', fontWeight: '700', textTransform: 'uppercase' },
  footerDate: { fontSize: 13, color: '#FFF', fontWeight: '800', marginTop: 2 },
  footerEmission: { fontSize: 8, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: '500' },
  qrSection: { alignItems: 'center' },
  qrWrapper: {
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 }
    })
  },
  qrText: { fontSize: 7, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, fontWeight: '600' },
  serialNumber: { alignItems: 'center', marginTop: 8 },
  serialText: { fontSize: 8, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600', letterSpacing: 1 },
  printNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed'
  },
  printNoteText: { fontSize: 11, color: '#6B7280', marginLeft: 6, fontWeight: '500', flex: 1 },

  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  cardContent: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginLeft: 10 },
  sectionTitleStandalone: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },

  attendanceGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attendanceButton: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 10 },
  checkInButton: { backgroundColor: '#10B981' },
  checkOutButton: { backgroundColor: '#EF4444' },
  attendanceIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  attendanceButtonText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  attendanceStatItem: { alignItems: 'center' },
  attendanceStatValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8 },
  attendanceStatLabel: { fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: '500', textAlign: 'center' },

  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  statIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center', fontWeight: '500', lineHeight: 14 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  actionIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionLabel: { fontSize: 12, color: '#111827', textAlign: 'center', fontWeight: '600', lineHeight: 16 },

  commModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
    alignSelf: 'center',
    maxHeight: '80%'
  },
  commModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  commModalIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  commModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  commModalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  commModalBody: {
    padding: 20
  },
  commInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8
  },
  commInput: {
    backgroundColor: '#FFF',
    marginBottom: 16
  },
  commModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB'
  },
  commFooterBtn: {
    borderRadius: 10
  }
});

export default DashboardScreen;