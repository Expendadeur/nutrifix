// frontend/src/screens/employe/ProfilScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  useWindowDimensions,
  RefreshControl,
  Modal,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';
import {
  Card,
  Title,
  TextInput,
  Button,
  Divider,
  ActivityIndicator,
  Chip,
  Portal,
  Dialog,
  Paragraph,
  IconButton,
  Snackbar,
  DataTable,
  HelperText,
  Surface,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://nutrifix-1-twdf.onrender.com/api';

const ProfilScreen = ({ navigation, route, onLogout }) => {
  const windowDimensions = useWindowDimensions();
  
  // États principaux
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Données du profil
  const [profileData, setProfileData] = useState({
    id: null,
    matricule: 'N/A',
    nom_complet: 'Chargement...',
    email: '',
    telephone: '',
    type_employe: 'INSS',
    role: 'Employé',
    date_embauche: null,
    date_naissance: null,
    numero_cnss: '',
    departement_nom: '',
    salaire_base: 0,
    statut: 'Actif',
    photo_identite: null,
    adresse: '',
    ville: '',
    compte_bancaire: '',
    nom_banque: '',
    jours_conges_annuels: 24
  });
  
  const [profileImage, setProfileImage] = useState(null);
  const [formData, setFormData] = useState({
    telephone: '',
    email: '',
    adresse: '',
    ville: '',
    compte_bancaire: '',
    nom_banque: '',
  });

  // États pour les salaires
  const [salaires, setSalaires] = useState([]);
  const [loadingSalaires, setLoadingSalaires] = useState(false);
  const [selectedSalaire, setSelectedSalaire] = useState(null);
  const [showSalaireModal, setShowSalaireModal] = useState(false);
  const [demandePaiementLoading, setDemandePaiementLoading] = useState(false);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  
  // États pour les notifications
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info');
  
  // États pour les modals
  const [showDemandePaiementDialog, setShowDemandePaiementDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // État pour le filtre des salaires
  const [filtreAnnee, setFiltreAnnee] = useState(new Date().getFullYear().toString());

  // Responsive
  const isMobile = windowDimensions.width < 768;
  const isTablet = windowDimensions.width >= 768 && windowDimensions.width < 1024;
  const isDesktop = windowDimensions.width >= 1024;

  // =================================================================
  // FONCTIONS PRINCIPALES
  // =================================================================

   const getAuthToken = useCallback(async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        return token;
      } catch (error) {
        console.error('Erreur récupération token:', error);
        return null;
      }
    }, []);

const loadProfile = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      if (!token) {
        showNotification('Session expirée', 'error');
        setTimeout(() => navigateToLogin(), 1500);
        return;
      }

      const response = await axios.get(`${API_URL}/employe-inss/profil`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.success && response.data.data) {
        const data = response.data.data;
        
        const transformedData = {
          id: data.id || null,
          matricule: data.matricule || 'N/A',
          nom_complet: data.nom_complet || 'Nom non disponible',
          email: data.email || '',
          telephone: data.telephone || '',
          type_employe: data.type_employe || 'INSS',
          role: data.role || 'Employé',
          date_embauche: data.date_embauche || null,
          date_naissance: data.date_naissance || null,
          numero_cnss: data.numero_cnss || '',
          departement_nom: data.departement_nom || 'Non assigné',
          salaire_base: parseFloat(data.salaire_base) || 0,
          statut: data.statut || 'Actif',
          photo_identite: data.photo_identite || null,
          adresse: data.adresse || '',
          ville: data.ville || '',
          compte_bancaire: data.compte_bancaire || '',
          nom_banque: data.nom_banque || '',
          jours_conges_annuels: data.jours_conges_annuels || 24
        };

        setProfileData(transformedData);
        
        setFormData({
          telephone: transformedData.telephone || '',
          email: transformedData.email || '',
          adresse: transformedData.adresse || '',
          ville: transformedData.ville || '',
          compte_bancaire: transformedData.compte_bancaire || '',
          nom_banque: transformedData.nom_banque || '',
        });

        showNotification('Profil chargé', 'success');
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      showNotification('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSalaires = async () => {
    try {
      setLoadingSalaires(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await axios.get(
        `${API_URL}/employe-inss/salaires?annee=${filtreAnnee}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.success) {
        const bulletins = Array.isArray(response.data.data?.bulletins) 
          ? response.data.data.bulletins 
          : [];
        
        const transformedSalaires = bulletins.map(salaire => ({
          id: salaire.id || 0,
          mois: salaire.mois || 1,
          annee: salaire.annee || 2024,
          salaire_brut: parseFloat(salaire.salaire_brut) || 0,
          salaire_net: parseFloat(salaire.salaire_net) || 0,
          total_deductions: parseFloat(salaire.total_deductions) || 0,
          statut_paiement: salaire.statut_paiement || 'calculé',
          date_paiement: salaire.date_paiement || null,
          confirme_reception: salaire.confirme_reception || 0,
          date_confirmation_reception: salaire.date_confirmation_reception || null,
          deduction_inss: parseFloat(salaire.deduction_inss) || 0,
          deduction_impots: parseFloat(salaire.deduction_impots) || 0,
          primes: parseFloat(salaire.primes) || 0,
        }));

        setSalaires(transformedSalaires);
      }
    } catch (error) {
      console.error('Erreur chargement salaires:', error);
      setSalaires([]);
    } finally {
      setLoadingSalaires(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  useEffect(() => {
    const init = async () => {
      await requestPermissions();
      await loadProfile();
      await loadSalaires();
    };
    
    init();
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editMode) {
        setEditMode(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfile(), loadSalaires()]);
      showNotification('Données mises à jour', 'success');
    } catch (error) {
      console.error('Erreur rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showNotification('Permission galerie requise', 'error');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
        setEditMode(true);
        showNotification('Photo sélectionnée', 'success');
        setShowImagePickerModal(false);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      showNotification('Erreur sélection photo', 'error');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showNotification('Permission caméra requise', 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
        setEditMode(true);
        showNotification('Photo prise', 'success');
        setShowImagePickerModal(false);
      }
    } catch (error) {
      console.error('Erreur prise photo:', error);
      showNotification('Erreur prise photo', 'error');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showNotification('Email invalide', 'error');
      return false;
    }
    return true;
  };

  const saveProfile = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        showNotification('Session expirée', 'error');
        return;
      }

      const updateData = new FormData();
      
      const fields = ['telephone', 'email', 'adresse', 'ville', 'compte_bancaire', 'nom_banque'];
      fields.forEach(field => {
        if (formData[field] !== undefined) {
          updateData.append(field, formData[field]);
        }
      });

      if (profileImage) {
        const filename = profileImage.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        updateData.append('photo_identite', {
          uri: profileImage,
          name: filename,
          type
        });
      }

      const response = await axios.put(
        `${API_URL}/employe-inss/profil`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 15000
        }
      );

      if (response.data.success) {
        showNotification('Profil mis à jour', 'success');
        setEditMode(false);
        setProfileImage(null);
        await loadProfile();
      }
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      showNotification('Erreur mise à jour profil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    Alert.alert(
      'Annuler modifications',
      'Voulez-vous annuler toutes les modifications ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: () => {
            setFormData({
              telephone: profileData.telephone || '',
              email: profileData.email || '',
              adresse: profileData.adresse || '',
              ville: profileData.ville || '',
              compte_bancaire: profileData.compte_bancaire || '',
              nom_banque: profileData.nom_banque || '',
            });
            setProfileImage(null);
            setEditMode(false);
            showNotification('Modifications annulées', 'info');
          }
        }
      ]
    );
  };

  const demanderPaiementSalaire = async () => {
    if (!selectedSalaire) return;

    setDemandePaiementLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await axios.post(
        `${API_URL}/employe-inss/salaires/${selectedSalaire.id}/demander-paiement`,
        {
          mois: selectedSalaire.mois,
          annee: selectedSalaire.annee,
          montant: selectedSalaire.salaire_net
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        showNotification('Demande envoyée', 'success');
        setShowDemandePaiementDialog(false);
        setSelectedSalaire(null);
        loadSalaires();
      }
    } catch (error) {
      console.error('Erreur demande paiement:', error);
      showNotification('Erreur demande paiement', 'error');
    } finally {
      setDemandePaiementLoading(false);
    }
  };

  const confirmerReceptionSalaire = async () => {
    if (!selectedSalaire || !verificationCode) {
      showNotification('Code requis', 'error');
      return;
    }

    setConfirmationLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await axios.post(
        `${API_URL}/employe-inss/salaires/${selectedSalaire.id}/confirmer-reception`,
        {
          code_verification: verificationCode,
          mois: selectedSalaire.mois,
          annee: selectedSalaire.annee
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        showNotification('Réception confirmée', 'success');
        setShowConfirmationDialog(false);
        setSelectedSalaire(null);
        setVerificationCode('');
        loadSalaires();
      }
    } catch (error) {
      console.error('Erreur confirmation:', error);
      showNotification('Erreur confirmation', 'error');
    } finally {
      setConfirmationLoading(false);
    }
  };

const handleLogout = async () => {
    console.log('Déconnexion initiée');
    
    try {
      // Nettoyer le stockage local
      await AsyncStorage.clear();
      console.log('Storage nettoyé');
      
      // Fermer le dialog
      setShowLogoutDialog(false);
      
      // Notification de succès
      showNotification('Déconnexion réussie', 'success');
      
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
      showNotification('Erreur lors de la déconnexion', 'error');
      
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la déconnexion.'
      );
    }
  };

  const getMoisNom = (mois) => {
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return moisNoms[parseInt(mois) - 1] || 'Mois inconnu';
  };

  const getStatutColor = (statut) => {
    const statutStr = (statut || '').toLowerCase();
    if (statutStr.includes('payé')) return { bg: '#D5F4E6', text: '#27AE60', icon: 'check-circle' };
    if (statutStr.includes('calculé') || statutStr.includes('attente')) return { bg: '#FFF4E6', text: '#F39C12', icon: 'clock' };
    if (statutStr.includes('rejeté') || statutStr.includes('annulé')) return { bg: '#FFE6E6', text: '#E74C3C', icon: 'close-circle' };
    return { bg: '#E8E8E8', text: '#7F8C8D', icon: 'help-circle' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non définie';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('fr-FR') + ' FBU';
  };

  // =================================================================
  // RENDU DES COMPOSANTS
  // =================================================================

  const renderHeader = () => (
    <LinearGradient
      colors={['#1565C0', '#1976D2', '#1E88E5']}
      style={[styles.header, isMobile && styles.headerMobile]}
    >
      <View style={styles.headerContent}>
        <TouchableOpacity
          onPress={() => setShowImagePickerModal(true)}
          style={styles.avatarContainer}
        >
          {profileImage || profileData.photo_identite ? (
            <Image
              source={{ uri: profileImage || profileData.photo_identite }}
              style={[styles.avatar, isMobile && styles.avatarMobile]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, isMobile && styles.avatarMobile]}>
              <Text style={[styles.avatarText, isMobile && styles.avatarTextMobile]}>
                {profileData.nom_complet?.split(' ').map(n => n[0]).join('') || 'IN'}
              </Text>
            </View>
          )}
          {editMode && (
            <View style={styles.cameraIcon}>
              <MaterialIcons name="camera-alt" size={20} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.nameText, isMobile && styles.nameTextMobile]}>
          {profileData.nom_complet}
        </Text>
        <Text style={[styles.roleText, isMobile && styles.roleTextMobile]}>
          {profileData.role?.toUpperCase() || 'EMPLOYÉ INSS'}
        </Text>

        <View style={[styles.badgesContainer, isMobile && styles.badgesContainerMobile]}>
          <Surface style={[styles.badge, styles.badgePrimary]}>
            <MaterialIcons name="badge" size={16} color="#FFF" />
            <Text style={styles.badgeText}>
              Mat: {profileData.matricule}
            </Text>
          </Surface>
          <Surface style={[
            styles.badge, 
            profileData.statut === 'Actif' ? styles.badgeSuccess : styles.badgeError
          ]}>
            <MaterialIcons 
              name={profileData.statut === 'Actif' ? 'check-circle' : 'cancel'} 
              size={16} 
              color="#FFF" 
            />
            <Text style={styles.badgeText}>{profileData.statut}</Text>
          </Surface>
        </View>
      </View>
    </LinearGradient>
  );

  const renderInfoSection = () => (
    <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <MaterialIcons name="work" size={24} color="#1976D2" />
            <Title style={styles.sectionTitle}>Informations professionnelles</Title>
          </View>
        </View>

        <View style={[styles.infoGrid, isDesktop && styles.infoGridDesktop]}>
          {[
            { 
              label: 'Département', 
              value: profileData.departement_nom, 
              icon: 'business',
              color: '#1976D2'
            },
            { 
              label: 'Date d\'embauche', 
              value: formatDate(profileData.date_embauche), 
              icon: 'event',
              color: '#7B1FA2'
            },
            { 
              label: 'Salaire de base', 
              value: formatCurrency(profileData.salaire_base), 
              icon: 'attach-money',
              color: '#388E3C'
            },
            { 
              label: 'Type de contrat', 
              value: profileData.type_employe, 
              icon: 'description',
              color: '#F57C00'
            },
            { 
              label: 'N° CNSS', 
              value: profileData.numero_cnss || 'Non attribué', 
              icon: 'security',
              color: '#D32F2F'
            },
            { 
              label: 'Congés annuels', 
              value: `${profileData.jours_conges_annuels} jours`, 
              icon: 'beach-access',
              color: '#0288D1'
            },
          ].map((item, index) => (
            <Surface key={index} style={styles.infoCard} elevation={1}>
              <View style={[styles.infoIconContainer, { backgroundColor: item.color + '15' }]}>
                <MaterialIcons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            </Surface>
          ))}
        </View>
      </Card.Content>
    </Card>
  );

  const renderContactSection = () => (
    <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <MaterialIcons name="contact-phone" size={24} color="#388E3C" />
            <Title style={styles.sectionTitle}>Coordonnées</Title>
          </View>
          {!editMode ? (
            <TouchableOpacity 
              onPress={() => setEditMode(true)}
              style={styles.editButton}
            >
              <MaterialIcons name="edit" size={20} color="#1976D2" />
              <Text style={styles.editButtonText}>Modifier</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={cancelEdit}
              style={styles.cancelButton}
            >
              <MaterialIcons name="close" size={20} color="#D32F2F" />
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.inputGrid, isDesktop && styles.inputGridDesktop]}>
          {[
            {
              label: 'Téléphone',
              value: formData.telephone,
              onChange: (text) => handleInputChange('telephone', text),
              icon: 'phone',
              keyboardType: 'phone-pad'
            },
            {
              label: 'Email',
              value: formData.email,
              onChange: (text) => handleInputChange('email', text),
              icon: 'email',
              keyboardType: 'email-address'
            },
            {
              label: 'Adresse',
              value: formData.adresse,
              onChange: (text) => handleInputChange('adresse', text),
              icon: 'home',
              multiline: true
            },
            {
              label: 'Ville',
              value: formData.ville,
              onChange: (text) => handleInputChange('ville', text),
              icon: 'location-city'
            }
          ].map((field, index) => (
            <View key={index} style={styles.inputContainer}>
              <TextInput
                label={field.label}
                value={field.value}
                onChangeText={field.onChange}
                mode="outlined"
                style={styles.input}
                disabled={!editMode}
                left={<TextInput.Icon icon={field.icon} />}
                keyboardType={field.keyboardType}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 2 : 1}
                outlineColor="#E0E0E0"
                activeOutlineColor="#1976D2"
              />
              {field.label === 'Email' && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                <HelperText type="error" visible>
                  Format d'email invalide
                </HelperText>
              )}
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );

  const renderBankSection = () => (
    <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <MaterialIcons name="account-balance" size={24} color="#F57C00" />
            <Title style={styles.sectionTitle}>Informations bancaires</Title>
          </View>
        </View>

        <View style={[styles.inputGrid, isDesktop && styles.inputGridDesktop]}>
          {[
            {
              label: 'Nom de la banque',
              value: formData.nom_banque,
              onChange: (text) => handleInputChange('nom_banque', text),
              icon: 'account-balance'
            },
            {
              label: 'Numéro de compte',
              value: formData.compte_bancaire,
              onChange: (text) => handleInputChange('compte_bancaire', text),
              icon: 'credit-card',
              keyboardType: 'numeric'
            }
          ].map((field, index) => (
            <View key={index} style={styles.inputContainer}>
              <TextInput
                label={field.label}
                value={field.value}
                onChangeText={field.onChange}
                mode="outlined"
                style={styles.input}
                disabled={!editMode}
                left={<TextInput.Icon icon={field.icon} />}
                keyboardType={field.keyboardType}
                outlineColor="#E0E0E0"
                activeOutlineColor="#1976D2"
              />
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );

  const renderSalairesSection = () => (
    <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
      <Card.Content>
        <View style={[styles.sectionHeader, styles.sectionHeaderColumn]}>
          <View style={styles.sectionHeaderLeft}>
            <MaterialIcons name="payments" size={24} color="#7B1FA2" />
            <Title style={styles.sectionTitle}>Mes Salaires</Title>
          </View>
          
          <View style={[styles.salaireControls, isMobile && styles.salaireControlsMobile]}>
            <View style={styles.yearSelector}>
              {['2023', '2024', '2025', '2026'].map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => {
                    setFiltreAnnee(year);
                    setTimeout(() => loadSalaires(), 100);
                  }}
                  style={[
                    styles.yearButton,
                    filtreAnnee === year && styles.yearButtonActive
                  ]}
                >
                  <Text style={[
                    styles.yearButtonText,
                    filtreAnnee === year && styles.yearButtonTextActive
                  ]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              onPress={loadSalaires} 
              disabled={loadingSalaires}
              style={styles.refreshButton}
            >
              <MaterialIcons 
                name="refresh" 
                size={24} 
                color={loadingSalaires ? "#BDBDBD" : "#1976D2"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {loadingSalaires ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.loadingText}>Chargement des salaires...</Text>
          </View>
        ) : salaires.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={64} color="#BDBDBD" />
            <Text style={styles.emptyText}>Aucun salaire disponible</Text>
            <Text style={styles.emptySubtext}>pour l'année {filtreAnnee}</Text>
          </View>
        ) : (
          <View style={styles.salairesList}>
            {salaires.map((salaire, index) => {
              const statutColors = getStatutColor(salaire.statut_paiement);
              
              return (
                <TouchableOpacity
                  key={salaire.id || index}
                  style={styles.salaireCard}
                  onPress={() => {
                    setSelectedSalaire(salaire);
                    setShowSalaireModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.salaireCardHeader}>
                    <View style={styles.salaireCardHeaderLeft}>
                      <View style={styles.salaireIconContainer}>
                        <MaterialIcons name="account-balance-wallet" size={24} color="#7B1FA2" />
                      </View>
                      <View>
                        <Text style={styles.salaireMois}>
                          {getMoisNom(salaire.mois)} {salaire.annee}
                        </Text>
                        <Text style={styles.salaireDate}>
                          {salaire.date_paiement ? 
                            `Payé le ${formatDate(salaire.date_paiement)}` : 
                            'En attente de paiement'
                          }
                        </Text>
                      </View>
                    </View>
                    
                    <Chip
                      mode="flat"
                      style={[styles.statutChip, { backgroundColor: statutColors.bg }]}
                      textStyle={[styles.statutChipText, { color: statutColors.text }]}
                      icon={() => (
                        <MaterialIcons 
                          name={statutColors.icon} 
                          size={16} 
                          color={statutColors.text} 
                        />
                      )}
                    >
                      {salaire.statut_paiement}
                    </Chip>
                  </View>
                  
                  <Divider style={styles.salaireDivider} />
                  
                  <View style={styles.salaireCardBody}>
                    <View style={styles.salaireRow}>
                      <Text style={styles.salaireLabel}>Salaire brut</Text>
                      <Text style={styles.salaireValue}>
                        {formatCurrency(salaire.salaire_brut)}
                      </Text>
                    </View>
                    
                    <View style={styles.salaireRow}>
                      <Text style={styles.salaireLabel}>Déductions totales</Text>
                      <Text style={[styles.salaireValue, styles.salaireValueNegative]}>
                        -{formatCurrency(salaire.total_deductions)}
                      </Text>
                    </View>
                    
                    <Divider style={styles.salaireDivider} />
                    
                    <View style={[styles.salaireRow, styles.salaireRowNet]}>
                      <Text style={styles.salaireNetLabel}>
                        Net à percevoir
                      </Text>
                      <Text style={styles.salaireNetValue}>
                        {formatCurrency(salaire.salaire_net)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.salaireCardActions}>
                    {salaire.statut_paiement === 'calculé' && (
                      <Button
                        mode="contained"
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedSalaire(salaire);
                          setShowDemandePaiementDialog(true);
                        }}
                        style={styles.actionButtonPrimary}
                        icon="send"
                        compact
                        labelStyle={styles.actionButtonLabel}
                      >
                        Demander paiement
                      </Button>
                    )}

                    {salaire.statut_paiement === 'payé' && !salaire.confirme_reception && (
                      <Button
                        mode="contained"
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedSalaire(salaire);
                          setShowConfirmationDialog(true);
                        }}
                        style={styles.actionButtonSuccess}
                        icon="check-circle"
                        compact
                        labelStyle={styles.actionButtonLabel}
                      >
                        Confirmer réception
                      </Button>
                    )}

                    {salaire.confirme_reception === 1 && (
                      <View style={styles.confirmedBadge}>
                        <MaterialIcons name="verified" size={18} color="#388E3C" />
                        <Text style={styles.confirmedText}>Réception confirmée</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderActions = () => {
    if (editMode) {
      return (
        <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
          <Card.Content>
            <View style={styles.editActions}>
              <Button
                mode="outlined"
                onPress={cancelEdit}
                style={styles.buttonOutlined}
                icon="close"
                disabled={saving}
                labelStyle={styles.buttonOutlinedLabel}
              >
                Annuler
              </Button>
              
              <Button
                mode="contained"
                onPress={saveProfile}
                loading={saving}
                disabled={saving}
                style={styles.buttonContained}
                icon="check"
                labelStyle={styles.buttonContainedLabel}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </View>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={[styles.card, isMobile && styles.cardMobile]} elevation={2}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialIcons name="settings" size={24} color="#424242" />
              <Title style={styles.sectionTitle}>Actions rapides</Title>
            </View>
          </View>
          
          <View style={styles.actionsList}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('ChangePassword')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcons name="lock" size={24} color="#1976D2" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Changer mot de passe</Text>
                <Text style={styles.actionSubtitle}>Sécurisez votre compte</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#BDBDBD" />
            </TouchableOpacity>
            
            <Divider />
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('CarteDigital')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#F3E5F5' }]}>
                <MaterialIcons name="badge" size={24} color="#7B1FA2" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Carte d'identité digitale</Text>
                <Text style={styles.actionSubtitle}>Votre badge virtuel</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#BDBDBD" />
            </TouchableOpacity>
            
            <Divider />
            
            <TouchableOpacity 
              style={[styles.actionItem, styles.logoutAction]}
              onPress={() => setShowLogoutDialog(true)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#FFEBEE' }]}>
                <MaterialIcons name="logout" size={24} color="#D32F2F" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: '#D32F2F' }]}>Déconnexion</Text>
                <Text style={styles.actionSubtitle}>Quitter l'application</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#D32F2F" />
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderModals = () => (
    <>
      {/* Modal sélection image */}
         <Modal
          visible={showImagePickerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, isMobile && styles.modalBoxMobile]}>
              <View style={styles.modalHeader}>
                <MaterialIcons name="photo-camera" size={32} color="#5B6EE1" />
                <Title style={styles.modalTitle}>Changer la photo</Title>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setShowImagePickerModal(false)}
                />
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.modalDescription}>
                  Créez un nouveau mot de passe sécurisé
                </Text>
                
                <TouchableOpacity
                  style={styles.imageOption}
                  onPress={takePhoto}
                  activeOpacity={0.7}
                >
                  <View style={[styles.imageOptionIcon, { backgroundColor: '#E8F0FE' }]}>
                    <MaterialIcons name="camera-alt" size={32} color="#5B6EE1" />
                  </View>
                  <View style={styles.imageOptionContent}>
                    <Text style={styles.imageOptionTitle}>Prendre une photo</Text>
                    <Text style={styles.imageOptionSubtitle}>Utiliser l'appareil photo</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#B0BEC5" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imageOption}
                  onPress={pickImage}
                  activeOpacity={0.7}
                >
                  <View style={[styles.imageOptionIcon, { backgroundColor: '#FDE7F3' }]}>
                    <MaterialIcons name="photo-library" size={32} color="#C2185B" />
                  </View>
                  <View style={styles.imageOptionContent}>
                    <Text style={styles.imageOptionTitle}>Choisir depuis la galerie</Text>
                    <Text style={styles.imageOptionSubtitle}>Sélectionner une photo existante</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#B0BEC5" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalFooterCenter}>
                <Button
                  mode="text"
                  onPress={() => setShowImagePickerModal(false)}
                  labelStyle={styles.cancelButtonLabel}
                >
                  Annuler
                </Button>
              </View>
            </View>
          </View>
        </Modal>

      {/* Modal détails salaire */}
      <Modal
        visible={showSalaireModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalaireModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContentLarge,
            isMobile && styles.modalContentLargeMobile
          ]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MaterialIcons name="receipt-long" size={24} color="#7B1FA2" />
                <Title style={styles.modalTitle}>Détails du salaire</Title>
              </View>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowSalaireModal(false)}
              />
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {selectedSalaire && (
                <View style={styles.modalBody}>
                  <View style={styles.modalSalaireHeader}>
                    <Text style={styles.modalSalaireMois}>
                      {getMoisNom(selectedSalaire.mois)} {selectedSalaire.annee}
                    </Text>
                    <Chip
                      mode="flat"
                      style={[
                        styles.modalStatutChip,
                        { backgroundColor: getStatutColor(selectedSalaire.statut_paiement).bg }
                      ]}
                      textStyle={{ color: getStatutColor(selectedSalaire.statut_paiement).text }}
                    >
                      {selectedSalaire.statut_paiement}
                    </Chip>
                  </View>

                  <View style={styles.modalInfoSection}>
                    <View style={styles.modalInfoRow}>
                      <MaterialIcons name="event" size={20} color="#757575" />
                      <Text style={styles.modalInfoLabel}>Date de paiement:</Text>
                      <Text style={styles.modalInfoValue}>
                        {formatDate(selectedSalaire.date_paiement)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalTableSection}>
                    <Text style={styles.modalTableTitle}>Détails de rémunération</Text>
                    
                    <DataTable style={styles.dataTable}>
                      <DataTable.Header style={styles.dataTableHeader}>
                        <DataTable.Title textStyle={styles.dataTableHeaderText}>
                          Description
                        </DataTable.Title>
                        <DataTable.Title numeric textStyle={styles.dataTableHeaderText}>
                          Montant (FBU)
                        </DataTable.Title>
                      </DataTable.Header>

                      <DataTable.Row style={styles.dataTableRow}>
                        <DataTable.Cell textStyle={styles.dataTableCellText}>
                          Salaire de base
                        </DataTable.Cell>
                        <DataTable.Cell numeric textStyle={styles.dataTableCellValue}>
                          {formatCurrency(selectedSalaire.salaire_brut)}
                        </DataTable.Cell>
                      </DataTable.Row>

                      {selectedSalaire.primes > 0 && (
                        <DataTable.Row style={styles.dataTableRow}>
                          <DataTable.Cell textStyle={styles.dataTableCellText}>
                            Primes et bonus
                          </DataTable.Cell>
                          <DataTable.Cell 
                            numeric 
                            textStyle={[styles.dataTableCellValue, styles.positiveValue]}
                          >
                            +{formatCurrency(selectedSalaire.primes)}
                          </DataTable.Cell>
                        </DataTable.Row>
                      )}

                      <DataTable.Row style={styles.dataTableRow}>
                        <DataTable.Cell textStyle={styles.dataTableCellText}>
                          Cotisation INSS (3.5%)
                        </DataTable.Cell>
                        <DataTable.Cell 
                          numeric 
                          textStyle={[styles.dataTableCellValue, styles.negativeValue]}
                        >
                          -{formatCurrency(selectedSalaire.deduction_inss)}
                        </DataTable.Cell>
                      </DataTable.Row>

                      <DataTable.Row style={styles.dataTableRow}>
                        <DataTable.Cell textStyle={styles.dataTableCellText}>
                          Impôts sur le revenu (IPR)
                        </DataTable.Cell>
                        <DataTable.Cell 
                          numeric 
                          textStyle={[styles.dataTableCellValue, styles.negativeValue]}
                        >
                          -{formatCurrency(selectedSalaire.deduction_impots)}
                        </DataTable.Cell>
                      </DataTable.Row>

                      <Divider style={styles.dataTableDivider} />

                      <DataTable.Row style={[styles.dataTableRow, styles.dataTableRowTotal]}>
                        <DataTable.Cell textStyle={styles.dataTableCellTextBold}>
                          Salaire net
                        </DataTable.Cell>
                        <DataTable.Cell 
                          numeric 
                          textStyle={[styles.dataTableCellValueBold, styles.positiveValue]}
                        >
                          {formatCurrency(selectedSalaire.salaire_net)}
                        </DataTable.Cell>
                      </DataTable.Row>
                    </DataTable>
                  </View>

                  <View style={styles.modalFooter}>
                    <Button
                      mode="contained"
                      onPress={() => setShowSalaireModal(false)}
                      style={styles.modalCloseButton}
                      labelStyle={styles.modalCloseButtonLabel}
                    >
                      Fermer
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dialogs Portal */}
      <Portal>
        {/* Dialog demande paiement */}
        <Dialog
          visible={showDemandePaiementDialog}
          onDismiss={() => setShowDemandePaiementDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Demander le paiement
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogIconContainer}>
              <MaterialIcons name="send" size={48} color="#1976D2" />
            </View>
            <Paragraph style={styles.dialogText}>
              Voulez-vous demander le paiement de votre salaire de{' '}
              <Text style={styles.dialogTextBold}>
                {selectedSalaire && `${getMoisNom(selectedSalaire.mois)} ${selectedSalaire.annee}`}
              </Text> ?
            </Paragraph>
            <View style={styles.dialogAmountContainer}>
              <Text style={styles.dialogAmountLabel}>Montant à percevoir</Text>
              <Text style={styles.dialogAmountValue}>
                {selectedSalaire && formatCurrency(selectedSalaire.salaire_net)}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => setShowDemandePaiementDialog(false)}
              labelStyle={styles.dialogButtonLabelCancel}
            >
              Annuler
            </Button>
            <Button 
              onPress={demanderPaiementSalaire}
              loading={demandePaiementLoading}
              mode="contained"
              style={styles.dialogButtonConfirm}
              labelStyle={styles.dialogButtonLabelConfirm}
            >
              Confirmer
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog confirmation réception */}
        <Dialog
          visible={showConfirmationDialog}
          onDismiss={() => setShowConfirmationDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Confirmer la réception
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogIconContainer}>
              <MaterialIcons name="check-circle" size={48} color="#388E3C" />
            </View>
            <Paragraph style={styles.dialogText}>
              Entrez le code de vérification reçu pour confirmer la réception de votre salaire.
            </Paragraph>
            
            <TextInput
              label="Code de vérification"
              value={verificationCode}
              onChangeText={setVerificationCode}
              mode="outlined"
              style={styles.dialogInput}
              keyboardType="numeric"
              maxLength={6}
              left={<TextInput.Icon icon="lock" />}
              outlineColor="#E0E0E0"
              activeOutlineColor="#388E3C"
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => {
                setShowConfirmationDialog(false);
                setVerificationCode('');
              }}
              labelStyle={styles.dialogButtonLabelCancel}
            >
              Annuler
            </Button>
            <Button 
              onPress={confirmerReceptionSalaire}
              loading={confirmationLoading}
              mode="contained"
              style={[styles.dialogButtonConfirm, { backgroundColor: '#388E3C' }]}
              labelStyle={styles.dialogButtonLabelConfirm}
            >
              Valider
            </Button>
          </Dialog.Actions>
        </Dialog>
        {/* Dialog Déconnexion */}
        <Dialog
          visible={showLogoutDialog}
          onDismiss={() => setShowLogoutDialog(false)}
          style={styles.centeredDialog}
        >
          <Dialog.Content style={styles.dialogContentCentered}>
            <View style={styles.dialogIconWrapper}>
              <View style={[styles.dialogIconCircle, { backgroundColor: '#FFEBEE' }]}>
                <MaterialIcons name="logout" size={48} color="#E53935" />
              </View>
            </View>
            
            <Dialog.Title style={styles.dialogTitleCentered}>
              Déconnexion
            </Dialog.Title>
            
            <Paragraph style={styles.dialogMessage}>
              Êtes-vous sûr de vouloir vous déconnecter de votre compte ?
            </Paragraph>
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActionsCentered}>
            <Button 
              mode="outlined"
              onPress={() => setShowLogoutDialog(false)}
              style={styles.dialogButtonOutlined}
              labelStyle={styles.dialogButtonOutlinedLabel}
            >
              Annuler
            </Button>
            <Button 
              mode="contained"
              onPress={handleLogout}
              style={[styles.dialogButtonContained, { backgroundColor: '#E53935' }]}
              labelStyle={styles.dialogButtonContainedLabel}
            >
              Se déconnecter
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar */}
       <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
          }}
          style={[
            styles.snackbar,
            snackbarType === 'error' && styles.snackbarError,
            snackbarType === 'success' && styles.snackbarSuccess
          ]}
        >
          {snackbarMessage}
        </Snackbar>
    </>
  );

  // Rendu principal
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Chargement de votre profil...</Text>
      </View>
    );
  }

  return (
   <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1565C0" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        
        <View style={[styles.content, isMobile && styles.contentMobile]}>
          {renderInfoSection()}
          {renderContactSection()}
          {renderBankSection()}
          {renderSalairesSection()}
          {renderActions()}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}></Text>
          <Text style={styles.footerSubtext}></Text>
        </View>
      </ScrollView>
      
      {renderModals()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  contentMobile: {
    padding: 12,
  },
  
  // Header styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  headerMobile: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  avatarMobile: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  avatarTextMobile: {
    fontSize: 36,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#1976D2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nameTextMobile: {
    fontSize: 22,
  },
  roleText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  roleTextMobile: {
    fontSize: 13,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  badgesContainerMobile: {
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  badgePrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeSuccess: {
    backgroundColor: '#388E3C',
  },
  badgeError: {
    backgroundColor: '#D32F2F',
  },
  badgeText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  
  // Card styles
  card: {
    backgroundColor: '#493232',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardMobile: {
    borderRadius: 12,
    marginBottom: 12,
  },
  
// MODAL STYLES - CORRIGÉS POUR UN CENTRAGE PARFAIT
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  modalBoxMobile: {
    maxWidth: '95%',
    width: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
  },
  modalBody: {
    padding: 24,
  },
  modalDescription: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  imageOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  imageOptionContent: {
    flex: 1,
  },
  imageOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  imageOptionSubtitle: {
    fontSize: 13,
    color: '#757575',
  },
  modalFooterCenter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    alignItems: 'center',
  },
  cancelButtonLabel: {
    color: '#757575',
    fontSize: 15,
    fontWeight: '600',
  },

  // Section header styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionHeaderColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginLeft: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '600',
  },
  
  // Info grid styles
  infoGrid: {
    gap: 12,
  },
  infoGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  
  // Input styles
  inputGrid: {
    gap: 16,
  },
  inputGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inputContainer: {
    flex: 1,
    minWidth: 250,
  },
  input: {
    backgroundColor: '#FAFAFA',
  },
  
  // Salaire controls styles
  salaireControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  salaireControlsMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  yearSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
    flex: 1,
  },
  yearButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: '#1976D2',
  },
  yearButtonText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  yearButtonTextActive: {
    color: '#FFF',
  },
  refreshButton: {
    padding: 8,
  },
  
  // Salaire card styles
  salairesList: {
    gap: 12,
  },
  salaireCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  salaireCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  salaireCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  salaireIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  salaireMois: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  salaireDate: {
    fontSize: 12,
    color: '#757575',
  },
  statutChip: {
    height: 32,
  },
  statutChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  salaireDivider: {
    backgroundColor: '#E0E0E0',
  },
  salaireCardBody: {
    padding: 16,
  },
  salaireRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  salaireRowNet: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  salaireLabel: {
    fontSize: 14,
    color: '#616161',
  },
  salaireValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  salaireValueNegative: {
    color: '#D32F2F',
  },
  salaireNetLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
  },
  salaireNetValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#388E3C',
  },
  salaireCardActions: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButtonPrimary: {
    backgroundColor: '#1976D2',
  },
  actionButtonSuccess: {
    backgroundColor: '#388E3C',
  },
  actionButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
  },
  confirmedText: {
    color: '#388E3C',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Actions list styles
  actionsList: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#757575',
  },
  logoutAction: {
    backgroundColor: '#FFFBFB',
  },
  
  // Edit actions styles
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  buttonOutlined: {
    borderColor: '#D32F2F',
  },
  buttonOutlinedLabel: {
    color: '#D32F2F',
  },
  buttonContained: {
    backgroundColor: '#1976D2',
  },
  buttonContainedLabel: {
    color: '#FFF',
  },
  
  // DIALOG STYLES - CENTRAGE PARFAIT
  centeredDialog: {
    borderRadius: 24,
    maxWidth: 450,
    alignSelf: 'center',
  },
  dialogContentCentered: {
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  dialogIconWrapper: {
    marginBottom: 20,
  },
  dialogIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogTitleCentered: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  dialogMessage: {
    fontSize: 15,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  dialogActionsCentered: {
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  dialogButtonOutlined: {
    borderColor: '#BDBDBD',
    borderWidth: 1,
    paddingHorizontal: 24,
  },
  dialogButtonOutlinedLabel: {
    color: '#616161',
    fontSize: 15,
    fontWeight: '600',
  },
  dialogButtonContained: {
    paddingHorizontal: 24,
  },
  dialogButtonContainedLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Loading & Empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
  },

  // Snackbar
  snackbar: {
    backgroundColor: '#323232',
  },
  snackbarError: {
    backgroundColor: '#D32F2F',
  },
  snackbarSuccess: {
    backgroundColor: '#388E3C',
  },
  
  // Footer styles
  footer: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});

export default ProfilScreen;