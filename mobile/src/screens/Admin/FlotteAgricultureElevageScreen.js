// frontend/src/screens/admin/FlotteAgricultureElevageScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import {
  Card,
  Title,
  Button,
  Searchbar,
  Chip,
  DataTable,
  Modal,
  Portal,
  TextInput,
  IconButton,
  Avatar,
  SegmentedButtons,
  FAB,
  ProgressBar,
  ActivityIndicator,
  Divider,
  Surface,
  List,
  Switch
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
//import { API_URL } from '../../config';
import { requireAuth } from '../../utils/authGuard';

const FlotteAgricultureElevageScreen = ({ navigation, route }) => {
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 1024;
  const isTablet = width > 768 && width <= 1024;
  const isMobile = width <= 768;

  const { user, isLoading: authLoading } = requireAuth(navigation, { role: 'admin' });

  // API configuration
  const API_BASE_URL = 'http://localhost:5000/api';
  const API_URL = `${API_BASE_URL}/operations`;

  // ============================================
  // STATES PRINCIPAUX
  // ============================================
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'flotte');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ============================================
  // FLOTTE AUTOMOBILE - STATES
  // ============================================
  const [vehicules, setVehicules] = useState([]);
  const [filteredVehicules, setFilteredVehicules] = useState([]);
  const [selectedVehicule, setSelectedVehicule] = useState(null);
  const [vehiculeModalVisible, setVehiculeModalVisible] = useState(false);
  const [vehiculeMode, setVehiculeMode] = useState('view');

  // Mouvements véhicules
  const [mouvementsVehicules, setMouvementsVehicules] = useState([]);
  const [mouvementModalVisible, setMouvementModalVisible] = useState(false);
  const [selectedMouvement, setSelectedMouvement] = useState(null);

  // Maintenance
  const [maintenances, setMaintenances] = useState([]);
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);

  // Assurances
  const [assurances, setAssurances] = useState([]);
  const [assuranceModalVisible, setAssuranceModalVisible] = useState(false);

  // Chauffeurs
  const [chauffeurs, setChauffeurs] = useState([]);
  const [departements, setDepartements] = useState([]);

  // Stats
  const [statsFlotte, setStatsFlotte] = useState(null);

  // AGRICULTURE - BONUS ENDPOINTS
  const [agriculteurs, setAgriculteurs] = useState([]);
  const [filteredAgriculteurs, setFilteredAgriculteurs] = useState([]);
  const [agriculturesSearchQuery, setAgriculturesSearchQuery] = useState('');
  const [agriculturesModalVisible, setAgriculturesModalVisible] = useState(false);

  const [typesCulture, setTypesCulture] = useState([]);
  const [filteredTypesCultures, setFilteredTypesCultures] = useState([]);

  // ÉLEVAGE - BONUS ENDPOINT
  const [techniciens, setTechniciens] = useState([]);
  const [filteredTechniciens, setFilteredTechniciens] = useState([]);
  const [techniciensSearchQuery, setTechniciensSearchQuery] = useState('');
  const [techniciensModalVisible, setTechniciensModalVisible] = useState(false);

  // Formulaire Véhicule
  const [vehiculeForm, setVehiculeForm] = useState({
    immatriculation: '',
    marque: '',
    modele: '',
    annee: '',
    couleur: '',
    type_vehicule: 'camion',
    capacite_carburant: '',
    consommation_moyenne: '',
    kilometrage_actuel: '0',
    date_achat: new Date(),
    prix_achat: '',
    valeur_actuelle: '',
    id_chauffeur_attitre: null,
    id_departement: null,
    statut: 'actif',
    disponible: true,
    photo: null
  });

  // Validation d'unicité
  const [checkingImmat, setCheckingImmat] = useState(false);
  const [immatError, setImmatError] = useState(null);
  const [isImmatUnique, setIsImmatUnique] = useState(true);

  // Formulaire Mouvement
  const [mouvementForm, setMouvementForm] = useState({
    id_vehicule: null,
    id_chauffeur: null,
    type_mouvement: 'sortie',
    date_mission: new Date(),
    heure_depart: '',
    heure_retour: '',
    kilometrage_depart: '',
    kilometrage_retour: '',
    destination: '',
    motif: '',
    passagers: '',
    marchandise_transportee: '',
    cout_carburant: '0',
    quantite_carburant: '0',
    cout_peages: '0',
    autres_frais: '0'
  });

  // Formulaire Maintenance
  const [maintenanceForm, setMaintenanceForm] = useState({
    id_vehicule: null,
    type_maintenance: 'vidange',
    description: '',
    fournisseur: '',
    numero_facture: '',
    cout_maintenance: '',
    kilometrage: '',
    date_intervention: new Date(),
    date_prochaine_maintenance: null,
    kilometrage_prochaine: '',
    garantie_jours: '',
    photos: []
  });

  // Formulaire Assurance
  const [assuranceForm, setAssuranceForm] = useState({
    id_vehicule: null,
    compagnie_assurance: '',
    numero_police: '',
    type_couverture: 'tous_risques',
    date_debut: new Date(),
    date_expiration: null,
    montant_prime: '',
    franchise: '0',
    scan_police: null,
    scan_attestation: null
  });

  // ============================================
  // AGRICULTURE - STATES
  // ============================================
  const [parcelles, setParcelles] = useState([]);
  const [filteredParcelles, setFilteredParcelles] = useState([]);
  const [selectedParcelle, setSelectedParcelle] = useState(null);
  const [parcelleModalVisible, setParcelleModalVisible] = useState(false);
  const [parcelleMode, setParcelleMode] = useState('view');

  // Cultures
  const [cultures, setCultures] = useState([]);
  const [cultureModalVisible, setCultureModalVisible] = useState(false);
  const [selectedCulture, setSelectedCulture] = useState(null);

  // Types de cultures
  const [typesCultures, setTypesCultures] = useState([]);
  const [typesCulturesModalVisible, setTypesCulturesModalVisible] = useState(false);

  // Stats
  const [statsAgriculture, setStatsAgriculture] = useState(null);

  // Formulaire Parcelle
  const [parcelleForm, setParcelleForm] = useState({
    reference: '',
    nom_parcelle: '',
    superficie_hectares: '',
    localisation: '',
    coordonnees_gps: '',
    type_sol: 'argileux',
    ph_sol: '',
    taux_humidite: '',
    irrigation_installee: false,
    proprietaire: 'propre',
    loyer_annuel: '',
    photo: null
  });

  const [checkingParcelleRef, setCheckingParcelleRef] = useState(false);
  const [parcelleRefError, setParcelleRefError] = useState(null);
  const [isParcelleRefUnique, setIsParcelleRefUnique] = useState(true);

  // Formulaire Culture
  const [cultureForm, setCultureForm] = useState({
    id_parcelle: null,
    id_type_culture: null,
    reference_saison: '',
    date_semaison: new Date(),
    date_levage_prevue: null,
    date_recolte_prevue: null,
    quantite_semences_kg: '',
    densite_semis: '',
    commentaires: ''
  });

  // ============================================
  // ÉLEVAGE - STATES
  // ============================================
  const [animaux, setAnimaux] = useState([]);
  const [filteredAnimaux, setFilteredAnimaux] = useState([]);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [animalModalVisible, setAnimalModalVisible] = useState(false);
  const [animalMode, setAnimalMode] = useState('view');

  // Suivi sanitaire
  const [suivisSanitaires, setSuivisSanitaires] = useState([]);
  const [suiviModalVisible, setSuiviModalVisible] = useState(false);

  // Vétérinaires
  const [veterinaires, setVeterinaires] = useState([]);

  // Productions
  const [productionsLait, setProductionsLait] = useState([]);
  const [productionsOeufs, setProductionsOeufs] = useState([]);
  const [productionLaitModalVisible, setProductionLaitModalVisible] = useState(false);
  const [productionOeufsModalVisible, setProductionOeufsModalVisible] = useState(false);

  // Fournisseurs
  const [fournisseurs, setFournisseurs] = useState([]);

  // Stats
  const [statsElevage, setStatsElevage] = useState(null);

  // Formulaire Animal
  const [animalForm, setAnimalForm] = useState({
    numero_identification: '',
    nom_animal: '',
    espece: 'vache',
    race: '',
    sexe: 'male',
    date_naissance: new Date(),
    poids_naissance: '',
    poids_actuel: '',
    couleur: '',
    marques_distinctives: '',
    origine: 'achat',
    id_fournisseur: null,
    id_mere: null,
    id_pere: null,
    prix_achat: '',
    date_acquisition: new Date(),
    photo: null,
    certificat_veterinaire: null
  });

  const [checkingAnimalId, setCheckingAnimalId] = useState(false);
  const [animalIdError, setAnimalIdError] = useState(null);
  const [isAnimalIdUnique, setIsAnimalIdUnique] = useState(true);

  // ============================================
  // UNICITÉ - LOGIQUE
  // ============================================
  const checkImmatriculationUniqueness = async (immat) => {
    if (!immat || vehiculeMode !== 'add') return;
    try {
      setCheckingImmat(true);
      setImmatError(null);
      const response = await axios.get(`${API_BASE_URL}/system/check-uniqueness?table=vehicules&field=immatriculation&value=${immat}`, {
        headers: { Authorization: `Bearer ${await AsyncStorage.getItem('userToken')}` }
      });
      if (response.data.success) {
        setIsImmatUnique(response.data.isUnique);
        if (!response.data.isUnique) setImmatError('Déjà utilisé');
      }
    } catch (error) { console.error(error); } finally { setCheckingImmat(false); }
  };

  const checkAnimalIdUniqueness = async (id) => {
    if (!id || animalMode !== 'add') return;
    try {
      setCheckingAnimalId(true);
      setAnimalIdError(null);
      const response = await axios.get(`${API_BASE_URL}/system/check-uniqueness?table=animaux&field=numero_identification&value=${id}`, {
        headers: { Authorization: `Bearer ${await AsyncStorage.getItem('userToken')}` }
      });
      if (response.data.success) {
        setIsAnimalIdUnique(response.data.isUnique);
        if (!response.data.isUnique) setAnimalIdError('Déjà utilisé');
      }
    } catch (error) { console.error(error); } finally { setCheckingAnimalId(false); }
  };

  const checkParcelleRefUniqueness = async (ref) => {
    if (!ref || parcelleMode !== 'add') return;
    try {
      setCheckingParcelleRef(true);
      setParcelleRefError(null);
      const response = await axios.get(`${API_BASE_URL}/system/check-uniqueness?table=parcelles&field=reference&value=${ref}`, {
        headers: { Authorization: `Bearer ${await AsyncStorage.getItem('userToken')}` }
      });
      if (response.data.success) {
        setIsParcelleRefUnique(response.data.isUnique);
        if (!response.data.isUnique) setParcelleRefError('Déjà utilisée');
      }
    } catch (error) { console.error(error); } finally { setCheckingParcelleRef(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (vehiculeForm.immatriculation && vehiculeMode === 'add') {
        checkImmatriculationUniqueness(vehiculeForm.immatriculation);
      } else {
        setIsImmatUnique(true);
        setImmatError(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [vehiculeForm.immatriculation, vehiculeMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (animalForm.numero_identification && animalMode === 'add') {
        checkAnimalIdUniqueness(animalForm.numero_identification);
      } else {
        setIsAnimalIdUnique(true);
        setAnimalIdError(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [animalForm.numero_identification, animalMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (parcelleForm.reference && parcelleMode === 'add') {
        checkParcelleRefUniqueness(parcelleForm.reference);
      } else {
        setIsParcelleRefUnique(true);
        setParcelleRefError(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [parcelleForm.reference, parcelleMode]);

  // Formulaire Suivi Sanitaire
  const [suiviForm, setSuiviForm] = useState({
    id_animal: null,
    type_intervention: 'vaccination',
    date_intervention: new Date(),
    symptomes: '',
    diagnostic: '',
    produit_utilise: '',
    dosage: '',
    mode_administration: '',
    veterinaire: '',
    id_technicien: null,
    date_prochaine_visite: null,
    instructions_suivi: '',
    observations: '',
    cout_intervention: '0'
  });

  // Formulaire Production Lait
  const [productionLaitForm, setProductionLaitForm] = useState({
    id_animal: null,
    date_production: new Date(),
    quantite_litres: '',
    taux_matiere_grasse: '',
    taux_proteine: '',
    temperature: '',
    ph: '',
    qualite: 'B',
    observations: '',
    heure_traite: '',
    methode_traite: 'manuel',
    destination: 'vente',
    id_reservoir: null
  });

  // Formulaire Production Oeufs
  const [productionOeufsForm, setProductionOeufsForm] = useState({
    id_poulailler: null,
    date_recolte: new Date(),
    nombre_oeufs: '',
    oeufs_casses: '0',
    oeufs_sales: '0',
    calibre_petit: '0',
    calibre_moyen: '0',
    calibre_gros: '0',
    calibre_extra_gros: '0',
    taux_fertile: '',
    observations: '',
    heure_recolte: '',
    stockage_temperature: '',
    destination: 'vente'
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [currentForm, setCurrentForm] = useState(null);

  // ============================================
  // API CALLS - UTILITAIRES
  // ============================================
  const getAuthToken = async () => {
    try {
      if (typeof user !== 'undefined' && user?.token) {
        return user.token;
      }
      const token = await AsyncStorage.getItem('userToken');
      return token || '';
    } catch (e) {
      return '';
    }
  };

  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      };

      if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const url = endpoint.includes('?')
        ? `${API_URL}${endpoint}`
        : `${API_URL}${endpoint}${data && method === 'GET' ? '?' + new URLSearchParams(data).toString() : ''}`;

      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur réseau');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // ============================================
  // HELPERS - FORMATAGE
  // ============================================
  const formatCurrency = (value, currency = 'BIF') => {
    if (!value) return '0';
    const num = parseFloat(value);
    return `${num.toLocaleString('fr-FR')} ${currency}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return 0;
    const birth = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getStatutVehiculeColor = (statut) => {
    switch (statut) {
      case 'actif': return '#27AE60';
      case 'en_maintenance': return '#F39C12';
      case 'hors_service': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getStatutCultureColor = (statut) => {
    switch (statut) {
      case 'active': return '#27AE60';
      case 'en_culture': return '#3498DB';
      case 'en_repos': return '#F39C12';
      case 'abandonnee': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getStatutSanteColor = (statut) => {
    switch (statut) {
      case 'bon': return '#27AE60';
      case 'en_observation': return '#F39C12';
      case 'en_traitement': return '#E67E22';
      case 'malade': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  // ============================================
  // VALIDATION
  // ============================================
  const validateVehiculeData = (data) => {
    const errors = {};

    if (!data.immatriculation?.trim()) {
      errors.immatriculation = 'Immatriculation requise';
    }
    if (!data.marque?.trim()) {
      errors.marque = 'Marque requise';
    }
    if (!data.modele?.trim()) {
      errors.modele = 'Modèle requis';
    }
    if (!data.type_vehicule) {
      errors.type_vehicule = 'Type de véhicule requis';
    }
    if (!data.id_departement) {
      errors.id_departement = 'Département requis';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const validateMouvementData = (data) => {
    const errors = {};

    if (!data.id_vehicule) {
      errors.id_vehicule = 'Véhicule requis';
    }
    if (!data.id_chauffeur) {
      errors.id_chauffeur = 'Chauffeur requis';
    }
    if (!data.destination?.trim()) {
      errors.destination = 'Destination requise';
    }
    if (!data.motif?.trim()) {
      errors.motif = 'Motif requis';
    }
    if (!data.kilometrage_depart) {
      errors.kilometrage_depart = 'Kilométrage de départ requis';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const validateParcelleData = (data) => {
    const errors = {};

    if (!data.reference?.trim()) {
      errors.reference = 'Référence requise';
    }
    if (!data.nom_parcelle?.trim()) {
      errors.nom_parcelle = 'Nom de la parcelle requis';
    }
    if (!data.superficie_hectares) {
      errors.superficie_hectares = 'Superficie requise';
    }
    if (!data.localisation?.trim()) {
      errors.localisation = 'Localisation requise';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const validateAnimalData = (data) => {
    const errors = {};

    if (!data.numero_identification?.trim()) {
      errors.numero_identification = 'Numéro d\'identification requis';
    }
    if (!data.espece) {
      errors.espece = 'Espèce requise';
    }
    if (!data.race?.trim()) {
      errors.race = 'Race requise';
    }
    if (!data.sexe) {
      errors.sexe = 'Sexe requis';
    }
    if (!data.date_naissance) {
      errors.date_naissance = 'Date de naissance requise';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  // ============================================
  // LOAD DATA - DÉFINIR AVANT LES useEffect
  // ============================================
  const loadReferentialData = async () => {
    try {
      // Chauffeurs
      const chauffResponse = await apiCall('/chauffeurs');
      setChauffeurs(chauffResponse.data || []);

      // Départements
      const deptsResponse = await apiCall('/departements');
      setDepartements(deptsResponse.data || []);

      // Vétérinaires
      const vetsResponse = await apiCall('/veterinaires');
      setVeterinaires(vetsResponse.data || []);

      // Fournisseurs
      const fournsResponse = await apiCall('/fournisseurs');
      setFournisseurs(fournsResponse.data || []);

      // ========== BONUS ENDPOINTS ==========
      // Agriculteurs
      try {
        const agricResponse = await apiCall('/agriculteurs');
        setAgriculteurs(agricResponse.data || []);
        setFilteredAgriculteurs(agricResponse.data || []);
      } catch (error) {
        console.warn('Erreur chargement agriculteurs:', error);
        // Continuer sans cette donnée
      }

      // Techniciens
      try {
        const techResponse = await apiCall('/techniciens');
        setTechniciens(techResponse.data || []);
        setFilteredTechniciens(techResponse.data || []);
      } catch (error) {
        console.warn('Erreur chargement techniciens:', error);
      }

      // Types de cultures
      try {
        const typesResponse = await apiCall('/types-cultures');
        setTypesCultures(typesResponse.data || []);
        setFilteredTypesCultures(typesResponse.data || []);
      } catch (error) {
        console.warn('Erreur chargement types cultures:', error);
      }
      // ====================================

    } catch (error) {
      console.error('Erreur chargement données référentielles:', error);
    }
  };
  const loadFlotteData = async () => {
    try {
      const [vehs, mouvs, maints, assurs, stats] = await Promise.all([
        apiCall('/vehicules'),
        apiCall('/mouvements-vehicules'),
        apiCall('/maintenances'),
        apiCall('/assurances'),
        apiCall('/stats/flotte')
      ]);

      setVehicules(vehs.data || []);
      setMouvementsVehicules(mouvs.data || []);
      setMaintenances(maints.data || []);
      setAssurances(assurs.data || []);
      setStatsFlotte(stats.data || null);
    } catch (error) {
      console.error('Erreur chargement flotte:', error);
      throw error;
    }
  };

  const loadAgricultureData = async () => {
    try {
      const [parcs, cults, stats] = await Promise.all([
        apiCall('/parcelles'),
        apiCall('/cultures'),
        apiCall('/stats/agriculture')
      ]);

      setParcelles(parcs.data || []);
      setCultures(cults.data || []);
      setStatsAgriculture(stats.data || null);
    } catch (error) {
      console.error('Erreur chargement agriculture:', error);
      throw error;
    }
  };

  const loadElevageData = async () => {
    try {
      const [anim, suivis, prodsLait, prodsOeufs, stats] = await Promise.all([
        apiCall('/animaux'),
        apiCall('/suivis-sanitaires'),
        apiCall('/productions-lait'),
        apiCall('/productions-oeufs'),
        apiCall('/stats/elevage')
      ]);

      setAnimaux(anim.data || []);
      setSuivisSanitaires(suivis.data || []);
      setProductionsLait(prodsLait.data || []);
      setProductionsOeufs(prodsOeufs.data || []);
      setStatsElevage(stats.data || null);
    } catch (error) {
      console.error('Erreur chargement élevage:', error);
      throw error;
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'flotte':
          await loadFlotteData();
          break;
        case 'agriculture':
          await loadAgricultureData();
          break;
        case 'elevage':
          await loadElevageData();
          break;
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ============================================
  // FILTRAGE
  // ============================================
  const filterData = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredVehicules(vehicules);
      setFilteredParcelles(parcelles);
      setFilteredAnimaux(animaux);
      return;
    }

    const query = searchQuery.toLowerCase();

    setFilteredVehicules(vehicules.filter(v =>
      v.marque?.toLowerCase().includes(query) ||
      v.modele?.toLowerCase().includes(query) ||
      v.immatriculation?.toLowerCase().includes(query)
    ));

    setFilteredParcelles(parcelles.filter(p =>
      p.reference?.toLowerCase().includes(query) ||
      p.nom_parcelle?.toLowerCase().includes(query) ||
      p.localisation?.toLowerCase().includes(query)
    ));

    setFilteredAnimaux(animaux.filter(a =>
      a.numero_identification?.toLowerCase().includes(query) ||
      a.nom_animal?.toLowerCase().includes(query) ||
      a.espece?.toLowerCase().includes(query) ||
      a.race?.toLowerCase().includes(query)
    ));
  }, [searchQuery, vehicules, parcelles, animaux]);

  const filterAgriculteurs = useCallback(() => {
    if (!agriculturesSearchQuery.trim()) {
      setFilteredAgriculteurs(agriculteurs);
      return;
    }

    const query = agriculturesSearchQuery.toLowerCase();
    setFilteredAgriculteurs(agriculteurs.filter(a =>
      a.nom_complet?.toLowerCase().includes(query) ||
      a.matricule?.toLowerCase().includes(query) ||
      a.email?.toLowerCase().includes(query) ||
      a.telephone?.includes(query) ||
      a.departement_nom?.toLowerCase().includes(query)
    ));
  }, [agriculturesSearchQuery, agriculteurs]);

  const filterTechniciens = useCallback(() => {
    if (!techniciensSearchQuery.trim()) {
      setFilteredTechniciens(techniciens);
      return;
    }

    const query = techniciensSearchQuery.toLowerCase();
    setFilteredTechniciens(techniciens.filter(t =>
      t.nom_complet?.toLowerCase().includes(query) ||
      t.matricule?.toLowerCase().includes(query) ||
      t.email?.toLowerCase().includes(query) ||
      t.telephone?.includes(query) ||
      t.departement_nom?.toLowerCase().includes(query)
    ));
  }, [techniciensSearchQuery, techniciens]);

  const filterTypesCultures = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredTypesCultures(typesCultures);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredTypesCultures(typesCultures.filter(tc =>
      tc.nom_culture?.toLowerCase().includes(query) ||
      tc.code_culture?.toLowerCase().includes(query) ||
      tc.famille?.toLowerCase().includes(query)
    ));
  }, [searchQuery, typesCultures]);


  // ============================================
  // EFFECTS - MAINTENANT APRÈS LES FONCTIONS
  // ============================================
  useEffect(() => {
    loadData();
  }, [loadData]); // Utiliser loadData comme dépendance

  useEffect(() => {
    filterData();
  }, [filterData]); // Utiliser filterData comme dépendance

  useEffect(() => {
    loadReferentialData();
  }, []);

  useEffect(() => {
    filterAgriculteurs();
  }, [filterAgriculteurs]);

  useEffect(() => {
    filterTechniciens();
  }, [filterTechniciens]);

  useEffect(() => {
    filterTypesCultures();
  }, [filterTypesCultures]);

  // Vérification auth
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Vérification des autorisations...</Text>
      </View>
    );
  }

  // ============================================
  // ACTIONS FLOTTE
  // ============================================
  const handleAddVehicule = () => {
    setVehiculeMode('add');
    setVehiculeForm({
      immatriculation: '',
      marque: '',
      modele: '',
      annee: '',
      couleur: '',
      type_vehicule: 'camion',
      capacite_carburant: '',
      consommation_moyenne: '',
      kilometrage_actuel: '0',
      date_achat: new Date(),
      prix_achat: '',
      valeur_actuelle: '',
      id_chauffeur_attitre: null,
      id_departement: null,
      statut: 'actif',
      disponible: true
    });
    setVehiculeModalVisible(true);
  };

  const handleEditVehicule = (vehicule) => {
    setSelectedVehicule(vehicule);
    setVehiculeMode('edit');
    setVehiculeForm({
      ...vehicule,
      date_achat: vehicule.date_achat ? new Date(vehicule.date_achat) : new Date()
    });
    setVehiculeModalVisible(true);
  };

  const handleViewVehicule = (vehicule) => {
    setSelectedVehicule(vehicule);
    setVehiculeMode('view');
    setVehiculeModalVisible(true);
  };

  const handleSaveVehicule = async () => {
    try {
      const validation = validateVehiculeData(vehiculeForm);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join('\n');
        Alert.alert('Erreur de validation', errorMessages);
        return;
      }

      if (vehiculeMode === 'add') {
        if (!isImmatUnique) {
          Alert.alert('Erreur', 'Cette immatriculation est déjà utilisée.');
          return;
        }
        await apiCall('/vehicules', 'POST', vehiculeForm);
        Alert.alert('Succès', 'Véhicule ajouté avec succès');
      } else {
        await apiCall(`/vehicules/${selectedVehicule.id}`, 'PUT', vehiculeForm);
        Alert.alert('Succès', 'Véhicule modifié avec succès');
      }
      setVehiculeModalVisible(false);
      loadFlotteData();
    } catch (error) {
      console.error('Erreur sauvegarde véhicule:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de sauvegarder le véhicule');
    }
  };

  const handleDeleteVehicule = (vehicule) => {
    Alert.alert(
      'Confirmation',
      `Désactiver le véhicule ${vehicule.marque} ${vehicule.modele} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/vehicules/${vehicule.id}`, 'DELETE');
              Alert.alert('Succès', 'Véhicule désactivé');
              loadFlotteData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de désactiver');
            }
          }
        }
      ]
    );
  };

  const handleAddMouvement = (vehicule) => {
    setSelectedVehicule(vehicule);
    setMouvementForm({
      id_vehicule: vehicule?.id || null,
      id_chauffeur: vehicule?.id_chauffeur_attitre || null,
      type_mouvement: 'sortie',
      date_mission: new Date(),
      heure_depart: '',
      heure_retour: '',
      kilometrage_depart: vehicule?.kilometrage_actuel || '',
      kilometrage_retour: '',
      destination: '',
      motif: '',
      passagers: '',
      marchandise_transportee: '',
      cout_carburant: '0',
      quantite_carburant: '0',
      cout_peages: '0',
      autres_frais: '0'
    });
    setMouvementModalVisible(true);
  };

  const handleSaveMouvement = async () => {
    try {
      const validation = validateMouvementData(mouvementForm);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join('\n');
        Alert.alert('Erreur de validation', errorMessages);
        return;
      }

      await apiCall('/mouvements-vehicules', 'POST', mouvementForm);
      Alert.alert('Succès', 'Mouvement enregistré');
      setMouvementModalVisible(false);
      loadFlotteData();
    } catch (error) {
      console.error('Erreur sauvegarde mouvement:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer le mouvement');
    }
  };

  const handleAddMaintenance = (vehicule) => {
    setSelectedVehicule(vehicule);
    setMaintenanceForm({
      id_vehicule: vehicule?.id || null,
      type_maintenance: 'vidange',
      description: '',
      fournisseur: '',
      numero_facture: '',
      cout_maintenance: '',
      kilometrage: vehicule?.kilometrage_actuel || '',
      date_intervention: new Date(),
      date_prochaine_maintenance: null,
      kilometrage_prochaine: '',
      garantie_jours: '',
      photos: []
    });
    setMaintenanceModalVisible(true);
  };

  const handleSaveMaintenance = async () => {
    try {
      if (!maintenanceForm.description || !maintenanceForm.cout_maintenance) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      await apiCall('/maintenances', 'POST', maintenanceForm);
      Alert.alert('Succès', 'Maintenance enregistrée');
      setMaintenanceModalVisible(false);
      loadFlotteData();
    } catch (error) {
      console.error('Erreur sauvegarde maintenance:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer la maintenance');
    }
  };

  const handleAddAssurance = (vehicule) => {
    setSelectedVehicule(vehicule);
    setAssuranceForm({
      id_vehicule: vehicule?.id || null,
      compagnie_assurance: '',
      numero_police: '',
      type_couverture: 'tous_risques',
      date_debut: new Date(),
      date_expiration: null,
      montant_prime: '',
      franchise: '0',
      scan_police: null,
      scan_attestation: null
    });
    setAssuranceModalVisible(true);
  };

  const handleSaveAssurance = async () => {
    try {
      if (!assuranceForm.compagnie_assurance || !assuranceForm.numero_police || !assuranceForm.montant_prime) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      await apiCall('/assurances', 'POST', assuranceForm);
      Alert.alert('Succès', 'Assurance enregistrée');
      setAssuranceModalVisible(false);
      loadFlotteData();
    } catch (error) {
      console.error('Erreur sauvegarde assurance:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer l\'assurance');
    }
  };

  // ============================================
  // ACTIONS AGRICULTURE
  // ============================================
  const handleAddParcelle = () => {
    setParcelleMode('add');
    setParcelleForm({
      reference: '',
      nom_parcelle: '',
      superficie_hectares: '',
      localisation: '',
      coordonnees_gps: '',
      type_sol: 'argileux',
      ph_sol: '',
      taux_humidite: '',
      irrigation_installee: false,
      proprietaire: 'propre',
      loyer_annuel: ''
    });
    setParcelleModalVisible(true);
  };

  const handleEditParcelle = (parcelle) => {
    setSelectedParcelle(parcelle);
    setParcelleMode('edit');
    setParcelleForm(parcelle);
    setParcelleModalVisible(true);
  };

  const handleViewParcelle = (parcelle) => {
    setSelectedParcelle(parcelle);
    setParcelleMode('view');
    setParcelleModalVisible(true);
  };

  const handleSaveParcelle = async () => {
    try {
      const validation = validateParcelleData(parcelleForm);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join('\n');
        Alert.alert('Erreur de validation', errorMessages);
        return;
      }

      if (parcelleMode === 'add') {
        if (!isParcelleRefUnique) {
          Alert.alert('Erreur', 'Cette référence est déjà utilisée.');
          return;
        }
        await apiCall('/parcelles', 'POST', parcelleForm);
        Alert.alert('Succès', 'Parcelle créée');
      } else {
        await apiCall(`/parcelles/${selectedParcelle.id}`, 'PUT', parcelleForm);
        Alert.alert('Succès', 'Parcelle modifiée');
      }
      setParcelleModalVisible(false);
      loadAgricultureData();
    } catch (error) {
      console.error('Erreur sauvegarde parcelle:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de sauvegarder la parcelle');
    }
  };

  const handleDeleteParcelle = (parcelle) => {
    Alert.alert(
      'Confirmation',
      `Supprimer la parcelle ${parcelle.nom_parcelle} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/parcelles/${parcelle.id}`, 'DELETE');
              Alert.alert('Succès', 'Parcelle supprimée');
              loadAgricultureData();
            } catch (error) {
              console.error('Erreur suppression parcelle:', error);
              Alert.alert('Erreur', error.response?.data?.message || 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  const handleAddCulture = (parcelle) => {
    setSelectedParcelle(parcelle);
    setCultureForm({
      id_parcelle: parcelle?.id || null,
      id_type_culture: null,
      reference_saison: '',
      date_semaison: new Date(),
      date_levage_prevue: null,
      date_recolte_prevue: null,
      quantite_semences_kg: '',
      densite_semis: '',
      commentaires: ''
    });
    setCultureModalVisible(true);
  };

  const handleSaveCulture = async () => {
    try {
      if (!cultureForm.id_parcelle || !cultureForm.id_type_culture || !cultureForm.reference_saison) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      await apiCall('/cultures', 'POST', cultureForm);
      Alert.alert('Succès', 'Culture démarrée');
      setCultureModalVisible(false);
      loadAgricultureData();
    } catch (error) {
      console.error('Erreur sauvegarde culture:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de démarrer la culture');
    }
  };

  const handleUpdateStadeCulture = async (culture, nouveauStade) => {
    try {
      await apiCall(`/cultures/${culture.id}/stade`, 'PUT', {
        stade_croissance: nouveauStade,
        commentaires: `Passage au stade ${nouveauStade}`
      });
      Alert.alert('Succès', 'Stade mis à jour');
      loadAgricultureData();
    } catch (error) {
      console.error('Erreur mise à jour stade:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le stade');
    }
  };

  // ============================================
  // ACTIONS ÉLEVAGE
  // ============================================
  const handleAddAnimal = () => {
    setAnimalMode('add');
    setAnimalForm({
      numero_identification: '',
      nom_animal: '',
      espece: 'vache',
      race: '',
      sexe: 'male',
      date_naissance: new Date(),
      poids_naissance: '',
      poids_actuel: '',
      couleur: '',
      marques_distinctives: '',
      origine: 'achat',
      id_fournisseur: null,
      id_mere: null,
      id_pere: null,
      prix_achat: '',
      date_acquisition: new Date(),
      photo: null,
      certificat_veterinaire: null
    });
    setAnimalModalVisible(true);
  };

  const handleEditAnimal = (animal) => {
    setSelectedAnimal(animal);
    setAnimalMode('edit');
    setAnimalForm({
      ...animal,
      date_naissance: animal.date_naissance ? new Date(animal.date_naissance) : new Date(),
      date_acquisition: animal.date_acquisition ? new Date(animal.date_acquisition) : new Date()
    });
    setAnimalModalVisible(true);
  };

  const handleViewAnimal = (animal) => {
    setSelectedAnimal(animal);
    setAnimalMode('view');
    setAnimalModalVisible(true);
  };

  const handleSaveAnimal = async () => {
    try {
      const validation = validateAnimalData(animalForm);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join('\n');
        Alert.alert('Erreur de validation', errorMessages);
        return;
      }

      if (animalMode === 'add') {
        if (!isAnimalIdUnique) {
          Alert.alert('Erreur', 'Ce numéro d\'identification est déjà utilisé.');
          return;
        }
        await apiCall('/animaux', 'POST', animalForm);
        Alert.alert('Succès', 'Animal enregistré');
      } else {
        await apiCall(`/animaux/${selectedAnimal.id}`, 'PUT', animalForm);
        Alert.alert('Succès', 'Animal modifié');
      }
      setAnimalModalVisible(false);
      loadElevageData();
    } catch (error) {
      console.error('Erreur sauvegarde animal:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de sauvegarder l\'animal');
    }
  };

  const handleDeleteAnimal = (animal) => {
    Alert.alert(
      'Confirmation',
      `Sortir l'animal ${animal.nom_animal || animal.numero_identification} du cheptel ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/animaux/${animal.id}`, 'DELETE', {
                raison_sortie: 'Suppression manuelle',
                date_sortie: new Date().toISOString().split('T')[0]
              });
              Alert.alert('Succès', 'Animal sorti du cheptel');
              loadElevageData();
            } catch (error) {
              console.error('Erreur suppression animal:', error);
              Alert.alert('Erreur', error.response?.data?.message || 'Impossible de sortir l\'animal');
            }
          }
        }
      ]
    );
  };

  const handleAddSuiviSanitaire = (animal) => {
    setSelectedAnimal(animal);
    setSuiviForm({
      id_animal: animal?.id || null,
      type_intervention: 'vaccination',
      date_intervention: new Date(),
      symptomes: '',
      diagnostic: '',
      produit_utilise: '',
      dosage: '',
      mode_administration: '',
      veterinaire: '',
      id_technicien: null,
      date_prochaine_visite: null,
      instructions_suivi: '',
      observations: '',
      cout_intervention: '0'
    });
    setSuiviModalVisible(true);
  };

  const handleSaveSuiviSanitaire = async () => {
    try {
      if (!suiviForm.diagnostic) {
        Alert.alert('Erreur', 'Le diagnostic est obligatoire');
        return;
      }

      await apiCall('/suivis-sanitaires', 'POST', suiviForm);
      Alert.alert('Succès', 'Suivi sanitaire enregistré');
      setSuiviModalVisible(false);
      loadElevageData();
    } catch (error) {
      console.error('Erreur sauvegarde suivi:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer le suivi');
    }
  };

  const handleAddProductionLait = (animal = null) => {
    setSelectedAnimal(animal);
    setProductionLaitForm({
      id_animal: animal?.id || null,
      date_production: new Date(),
      quantite_litres: '',
      taux_matiere_grasse: '',
      taux_proteine: '',
      temperature: '',
      ph: '',
      qualite: 'B',
      observations: '',
      heure_traite: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      methode_traite: 'manuel',
      destination: 'vente',
      id_reservoir: null
    });
    setProductionLaitModalVisible(true);
  };

  const handleSaveProductionLait = async () => {
    try {
      if (!productionLaitForm.quantite_litres || !productionLaitForm.heure_traite) {
        Alert.alert('Erreur', 'Quantité et heure de traite obligatoires');
        return;
      }

      await apiCall('/productions-lait', 'POST', productionLaitForm);
      Alert.alert('Succès', 'Production de lait enregistrée');
      setProductionLaitModalVisible(false);
      loadElevageData();
    } catch (error) {
      console.error('Erreur sauvegarde production lait:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer la production');
    }
  };

  const handleAddProductionOeufs = () => {
    setProductionOeufsForm({
      id_poulailler: null,
      date_recolte: new Date(),
      nombre_oeufs: '',
      oeufs_casses: '0',
      oeufs_sales: '0',
      calibre_petit: '0',
      calibre_moyen: '0',
      calibre_gros: '0',
      calibre_extra_gros: '0',
      taux_fertile: '',
      observations: '',
      heure_recolte: '',
      stockage_temperature: '',
      destination: 'vente'
    });
    setProductionOeufsModalVisible(true);
  };

  const handleSaveProductionOeufs = async () => {
    try {
      if (!productionOeufsForm.nombre_oeufs || !productionOeufsForm.heure_recolte) {
        Alert.alert('Erreur', 'Nombre d\'oeufs et heure de récolte obligatoires');
        return;
      }

      await apiCall('/productions-oeufs', 'POST', productionOeufsForm);
      Alert.alert('Succès', 'Production d\'oeufs enregistrée');
      setProductionOeufsModalVisible(false);
      loadElevageData();
    } catch (error) {
      console.error('Erreur sauvegarde production oeufs:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'enregistrer la production');
    }
  };
  const handlePickImage = async (formSetter, formData, source = 'library') => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      }

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uploadData = new FormData();

      const extension = asset.uri.split('.').pop().toLowerCase();
      const mimeType =
        extension === 'png' ? 'image/png' :
          extension === 'gif' ? 'image/gif' :
            'image/jpeg';

      let file;

      if (Platform.OS === 'web') {
        const blob = await fetch(asset.uri).then(r => r.blob());
        file = new File([blob], `upload_${Date.now()}.${extension}`, {
          type: mimeType
        });
      } else {
        file = {
          uri: asset.uri,
          name: `upload_${Date.now()}.${extension}`,
          type: mimeType
        };
      }

      uploadData.append('photo', file);

      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadData,
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Upload échoué');
      }

      const rootUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      const fullUrl = `${rootUrl}/${json.url}`;

      formSetter({ ...formData, photo: fullUrl });

    } catch (error) {
      console.error('Erreur pick/upload image:', error);
      Alert.alert('Erreur', 'Impossible de télécharger l’image');
    }
  };

  const openDatePicker = (field, mode = 'date', formType = null, initialValue = null) => {
    setDatePickerField(field);
    setDatePickerMode(mode);
    setCurrentForm(formType);
    setDatePickerValue(initialValue instanceof Date ? initialValue : (initialValue ? new Date(initialValue) : new Date()));
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate && datePickerField) {
      switch (currentForm) {
        case 'vehicule':
          setVehiculeForm({ ...vehiculeForm, [datePickerField]: selectedDate });
          break;
        case 'animal':
          setAnimalForm({ ...animalForm, [datePickerField]: selectedDate });
          break;
        case 'parcelle':
          setParcelleForm({ ...parcelleForm, [datePickerField]: selectedDate });
          break;
        case 'mouvement':
          setMouvementForm({ ...mouvementForm, [datePickerField]: selectedDate });
          break;
        case 'maintenance':
          setMaintenanceForm({ ...maintenanceForm, [datePickerField]: selectedDate });
          break;
        case 'assurance':
          setAssuranceForm({ ...assuranceForm, [datePickerField]: selectedDate });
          break;
        case 'culture':
          setCultureForm({ ...cultureForm, [datePickerField]: selectedDate });
          break;
        case 'suivi':
          setSuiviForm({ ...suiviForm, [datePickerField]: selectedDate });
          break;
        case 'productionLait':
          setProductionLaitForm({ ...productionLaitForm, [datePickerField]: selectedDate });
          break;
        case 'productionOeufs':
          setProductionOeufsForm({ ...productionOeufsForm, [datePickerField]: selectedDate });
          break;
      }
    }
  };

  // ============================================
  // RENDER FUNCTIONS - RESPONSIVE LAYOUT
  // ============================================
  const getCardWidth = () => {
    if (isDesktop) return width > 1600 ? '30%' : '45%';
    if (isTablet) return '48%';
    return '100%';
  };

  const getNumColumns = () => {
    if (isDesktop) return width > 1600 ? 3 : 2;
    if (isTablet) return 2;
    return 1;
  };

  // ============================================
  // RENDER FUNCTIONS - FLOTTE
  // ============================================
  const renderVehiculeCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        isDesktop && styles.itemCardDesktop,
        isTablet && styles.itemCardTablet
      ]}
      onPress={() => handleViewVehicule(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: '#E67E2220' }]}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.animalPhoto} />
            ) : (
              <MaterialIcons name="local-shipping" size={isDesktop ? 32 : 28} color="#E67E22" />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>
              {item.marque} {item.modele}
            </Text>
            <Text style={[styles.cardSubtitle, isDesktop && styles.cardSubtitleDesktop]}>
              {item.immatriculation}
            </Text>
            <View style={styles.cardTags}>
              <Chip mode="flat" style={styles.cardChip} textStyle={styles.chipText}>
                {item.type_vehicule}
              </Chip>
              <Chip
                mode="flat"
                style={[styles.cardChip, {
                  backgroundColor: getStatutVehiculeColor(item.statut) + '20'
                }]}
                textStyle={[styles.chipText, {
                  color: getStatutVehiculeColor(item.statut)
                }]}
              >
                {item.statut}
              </Chip>
              {item.disponible && (
                <Chip mode="flat" style={[styles.cardChip, { backgroundColor: '#27AE6020' }]}>
                  <Text style={[styles.chipText, { color: '#27AE60' }]}>Disponible</Text>
                </Chip>
              )}
            </View>
          </View>
        </View>
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <MaterialIcons name="speed" size={16} color="#7F8C8D" />
          <Text style={styles.cardDetailText}>
            {formatCurrency(item.kilometrage_actuel || 0, '')} km
          </Text>
        </View>
        <View style={styles.cardDetailItem}>
          <MaterialIcons name="person" size={16} color="#7F8C8D" />
          <Text style={styles.cardDetailText}>{item.chauffeur_nom || 'Non affecté'}</Text>
        </View>
        {item.prochaine_maintenance && (
          <View style={styles.cardDetailItem}>
            <MaterialIcons name="build" size={16} color="#F39C12" />
            <Text style={[styles.cardDetailText, { color: '#F39C12' }]}>
              Maintenance: {formatDate(item.prochaine_maintenance)}
            </Text>
          </View>
        )}
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardActions}>
        <IconButton
          icon="car-arrow-right"
          size={isDesktop ? 22 : 20}
          iconColor="#3498DB"
          onPress={() => handleAddMouvement(item)}
        />
        <IconButton
          icon="car-wrench"
          size={isDesktop ? 22 : 20}
          iconColor="#F39C12"
          onPress={() => handleAddMaintenance(item)}
        />
        <IconButton
          icon="shield-check"
          size={isDesktop ? 22 : 20}
          iconColor="#9B59B6"
          onPress={() => handleAddAssurance(item)}
        />
        <IconButton
          icon="pencil"
          size={isDesktop ? 22 : 20}
          iconColor="#27AE60"
          onPress={() => handleEditVehicule(item)}
        />
        <IconButton
          icon="delete"
          size={isDesktop ? 22 : 20}
          iconColor="#E74C3C"
          onPress={() => handleDeleteVehicule(item)}
        />
      </View>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER FUNCTIONS - AGRICULTURE
  // ============================================
  const renderParcelleCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        isDesktop && styles.itemCardDesktop,
        isTablet && styles.itemCardTablet
      ]}
      onPress={() => handleViewParcelle(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: '#27AE6020' }]}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.animalPhoto} />
            ) : (
              <MaterialIcons name="landscape" size={isDesktop ? 32 : 28} color="#27AE60" />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>
              {item.nom_parcelle}
            </Text>
            <Text style={[styles.cardSubtitle, isDesktop && styles.cardSubtitleDesktop]}>
              {item.reference} • {item.localisation}
            </Text>
            <View style={styles.cardTags}>
              <Chip mode="flat" style={styles.cardChip} textStyle={styles.chipText}>
                {item.superficie_hectares} ha
              </Chip>
              <Chip mode="flat" style={styles.cardChip} textStyle={styles.chipText}>
                {item.type_sol}
              </Chip>
              <Chip
                mode="flat"
                style={[styles.cardChip, {
                  backgroundColor: getStatutCultureColor(item.statut) + '20'
                }]}
                textStyle={[styles.chipText, {
                  color: getStatutCultureColor(item.statut)
                }]}
              >
                {item.statut}
              </Chip>
            </View>
          </View>
        </View>
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <MaterialIcons name="agriculture" size={16} color="#7F8C8D" />
          <Text style={styles.cardDetailText}>
            Culture: {item.culture_actuelle || 'Aucune'}
          </Text>
        </View>
        {item.irrigation_installee && (
          <View style={styles.cardDetailItem}>
            <MaterialIcons name="water-drop" size={16} color="#3498DB" />
            <Text style={styles.cardDetailText}>Irrigation</Text>
          </View>
        )}
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardActions}>
        <IconButton
          icon="sprout"
          size={isDesktop ? 22 : 20}
          iconColor="#27AE60"
          onPress={() => handleAddCulture(item)}
        />
        <IconButton
          icon="pencil"
          size={isDesktop ? 22 : 20}
          iconColor="#3498DB"
          onPress={() => handleEditParcelle(item)}
        />
        <IconButton
          icon="delete"
          size={isDesktop ? 22 : 20}
          iconColor="#E74C3C"
          onPress={() => handleDeleteParcelle(item)}
        />
      </View>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER FUNCTIONS - ÉLEVAGE
  // ============================================
  const renderAnimalCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        isDesktop && styles.itemCardDesktop,
        isTablet && styles.itemCardTablet
      ]}
      onPress={() => handleViewAnimal(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: '#9B59B620' }]}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.animalPhoto} />
            ) : (
              <MaterialIcons name="pets" size={isDesktop ? 32 : 28} color="#9B59B6" />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>
              {item.nom_animal || item.numero_identification}
            </Text>
            <Text style={[styles.cardSubtitle, isDesktop && styles.cardSubtitleDesktop]}>
              {item.espece} • {item.race}
            </Text>
            <View style={styles.cardTags}>
              <Chip mode="flat" style={styles.cardChip} textStyle={styles.chipText}>
                {item.sexe === 'male' ? 'Mâle' : 'Femelle'}
              </Chip>
              <Chip
                mode="flat"
                style={[styles.cardChip, {
                  backgroundColor: getStatutSanteColor(item.statut_sante) + '20'
                }]}
                textStyle={[styles.chipText, {
                  color: getStatutSanteColor(item.statut_sante)
                }]}
              >
                {item.statut_sante}
              </Chip>
            </View>
          </View>
        </View>
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardDetails}>
        <View style={styles.cardDetailItem}>
          <MaterialIcons name="cake" size={16} color="#7F8C8D" />
          <Text style={styles.cardDetailText}>
            Âge: {calculateAge(item.date_naissance)} ans
          </Text>
        </View>
        <View style={styles.cardDetailItem}>
          <MaterialIcons name="monitor-weight" size={16} color="#7F8C8D" />
          <Text style={styles.cardDetailText}>{item.poids_actuel || 0} kg</Text>
        </View>
      </View>

      <Divider style={styles.cardDivider} />

      <View style={styles.cardActions}>
        <IconButton
          icon="medical-bag"
          size={isDesktop ? 22 : 20}
          iconColor="#E74C3C"
          onPress={() => handleAddSuiviSanitaire(item)}
        />
        {(item.espece === 'vache' || item.espece === 'brebis' || item.espece === 'chevre') && (
          <IconButton
            icon="water"
            size={isDesktop ? 22 : 20}
            iconColor="#3498DB"
            onPress={() => handleAddProductionLait(item)}
          />
        )}
        <IconButton
          icon="pencil"
          size={isDesktop ? 22 : 20}
          iconColor="#F39C12"
          onPress={() => handleEditAnimal(item)}
        />
        <IconButton
          icon="delete"
          size={isDesktop ? 22 : 20}
          iconColor="#E74C3C"
          onPress={() => handleDeleteAnimal(item)}
        />
      </View>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER STATS CARDS - RESPONSIVE
  // ============================================
  const renderStatsCards = (stats, type) => {
    if (!stats) return null;

    let cardsData = [];

    if (type === 'flotte') {
      cardsData = [
        { label: 'Véhicules', value: stats.total_vehicules || 0, icon: 'local-shipping', color: '#3498DB' },
        { label: 'Disponibles', value: stats.vehicules_disponibles || 0, icon: 'check-circle', color: '#27AE60' },
        { label: 'Maintenances', value: stats.maintenances_prochaines || 0, icon: 'build', color: '#F39C12' }
      ];
    } else if (type === 'agriculture') {
      cardsData = [
        { label: 'Parcelles', value: stats.parcelles_actives || 0, icon: 'landscape', color: '#27AE60' },
        { label: 'En cours', value: stats.cultures_en_cours || 0, icon: 'agriculture', color: '#3498DB' },
        { label: 'Récoltes', value: stats.recoltes_prochaines || 0, icon: 'grass', color: '#F39C12' }
      ];
    } else if (type === 'elevage') {
      cardsData = [
        { label: 'Animaux', value: stats.total_animaux || 0, icon: 'pets', color: '#9B59B6' },
        { label: 'Production', value: stats.animaux_en_production || 0, icon: 'water', color: '#3498DB' },
        { label: 'Traitement', value: stats.animaux_en_traitement || 0, icon: 'medical-bag', color: '#E74C3C' }
      ];
    }

    return (
      <View style={[
        styles.statsContainer,
        isDesktop && styles.statsContainerDesktop,
        isTablet && styles.statsContainerTablet
      ]}>
        {cardsData.map((card, index) => (
          <Surface key={index} style={[
            styles.statCard,
            isDesktop && styles.statCardDesktop,
            isTablet && styles.statCardTablet
          ]} elevation={2}>
            <View style={styles.statCardContent}>
              <MaterialIcons name={card.icon} size={isDesktop ? 40 : 32} color={card.color} />
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
                {card.value}
              </Text>
              <Text style={[styles.statLabel, isDesktop && styles.statLabelDesktop]}>
                {card.label}
              </Text>
            </View>
          </Surface>
        ))}
      </View>
    );
  };

  // ============================================
  // RENDER FLOTTE PRODUCTION SECTION
  // ============================================
  const renderFlotteProductionSection = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Début de semaine (Lundi)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(now.getDate() - day + 1);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Sécurisation
    const mouvsData = Array.isArray(mouvementsVehicules) ? mouvementsVehicules : [];

    // Calculs
    const kmToday = mouvsData
      .filter(m => m.date_mission && m.date_mission.startsWith(today))
      .reduce((acc, curr) => acc + (parseFloat(curr.kilometrage_retour || 0) - parseFloat(curr.kilometrage_depart || 0)), 0);

    const kmWeek = mouvsData
      .filter(m => m.date_mission && m.date_mission >= startOfWeekStr && m.date_mission <= today)
      .reduce((acc, curr) => acc + (parseFloat(curr.kilometrage_retour || 0) - parseFloat(curr.kilometrage_depart || 0)), 0);

    const fuelToday = mouvsData
      .filter(m => m.date_mission && m.date_mission.startsWith(today))
      .reduce((acc, curr) => acc + parseFloat(curr.quantite_carburant || 0), 0);

    const fuelWeek = mouvsData
      .filter(m => m.date_mission && m.date_mission >= startOfWeekStr && m.date_mission <= today)
      .reduce((acc, curr) => acc + parseFloat(curr.quantite_carburant || 0), 0);

    return (
      <View style={{ paddingHorizontal: isDesktop ? 32 : 16, marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Performance & Consommation</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          {/* Card KM */}
          <Surface style={[styles.statCard, { marginRight: 12, minWidth: 180, backgroundColor: '#E8F6F3' }]} elevation={1}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <MaterialIcons name="speed" size={24} color="#1ABC9C" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginTop: 8 }}>
                {kmToday.toFixed(0)} km
              </Text>
              <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Parcourus (Aujourd'hui)</Text>
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#A3E4D7', paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A085' }}>
                  Semaine: {kmWeek.toFixed(0)} km
                </Text>
              </View>
            </View>
          </Surface>

          {/* Card Carburant */}
          <Surface style={[styles.statCard, { marginRight: 12, minWidth: 180, backgroundColor: '#FDEDEC' }]} elevation={1}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <MaterialIcons name="local-gas-station" size={24} color="#E74C3C" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginTop: 8 }}>
                {fuelToday.toFixed(1)} L
              </Text>
              <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Consommés (Aujourd'hui)</Text>
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#FADBD8', paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#C0392B' }}>
                  Semaine: {fuelWeek.toFixed(1)} L
                </Text>
              </View>
            </View>
          </Surface>
        </ScrollView>
      </View>
    );
  };

  // ============================================
  // RENDER AGRICULTURE PRODUCTION SECTION
  // ============================================
  const renderAgricultureProductionSection = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Début de semaine
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(now.getDate() - day + 1);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Sécurisation
    const culturesData = Array.isArray(cultures) ? cultures : [];

    // Récoltes prévues
    const harvestsToday = culturesData
      .filter(c => c.statut === 'en_cours' && c.date_recolte_prevue && c.date_recolte_prevue.startsWith(today))
      .length;

    const harvestsWeek = culturesData
      .filter(c => c.statut === 'en_cours' && c.date_recolte_prevue && c.date_recolte_prevue >= startOfWeekStr && c.date_recolte_prevue <= today)
      .length;

    return (
      <View style={{ paddingHorizontal: isDesktop ? 32 : 16, marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Récoltes & Productions</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          {/* Card Récoltes Prévues */}
          <Surface style={[styles.statCard, { marginRight: 12, minWidth: 180, backgroundColor: '#F4ECF7' }]} elevation={1}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <MaterialIcons name="agriculture" size={24} color="#9B59B6" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginTop: 8 }}>
                {harvestsToday}
              </Text>
              <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Récoltes Prévues (Aujourd'hui)</Text>
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#D7BDE2', paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E44AD' }}>
                  Semaine: {harvestsWeek}
                </Text>
              </View>
            </View>
          </Surface>

          {/* Note informative */}
          <View style={{ justifyContent: 'center', maxWidth: 200, marginLeft: 8 }}>
            <Text style={{ fontSize: 12, color: '#7F8C8D', fontStyle: 'italic' }}>
              * Basé sur les dates prévisionnelles des cultures actives.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };


  // ============================================
  // RENDER PRODUCTIONS SECTION
  // ============================================
  const renderProductionsSection = () => {
    // Calculer les productions du jour et de la semaine
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Début de semaine (Lundi)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(now.getDate() - day + 1);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Sécurisation des données
    const laitData = Array.isArray(productionsLait) ? productionsLait : [];
    const oeufsData = Array.isArray(productionsOeufs) ? productionsOeufs : [];

    // Lait
    const milkToday = laitData
      .filter(p => p.date_production && p.date_production.startsWith(today))
      .reduce((acc, curr) => acc + parseFloat(curr.quantite_litres || 0), 0);

    const milkWeek = laitData
      .filter(p => p.date_production && p.date_production >= startOfWeekStr && p.date_production <= today)
      .reduce((acc, curr) => acc + parseFloat(curr.quantite_litres || 0), 0);

    // Oeufs
    const eggsToday = oeufsData
      .filter(p => p.date_recolte && p.date_recolte.startsWith(today))
      .reduce((acc, curr) => acc + parseInt(curr.nombre_oeufs || 0), 0);

    const eggsWeek = oeufsData
      .filter(p => p.date_recolte && p.date_recolte >= startOfWeekStr && p.date_recolte <= today)
      .reduce((acc, curr) => acc + parseInt(curr.nombre_oeufs || 0), 0);

    return (
      <View style={{ paddingHorizontal: isDesktop ? 32 : 16, marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Productions & Récoltes</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          {/* Card Lait */}
          <Surface style={[styles.statCard, { marginRight: 12, minWidth: 180, backgroundColor: '#EBF5FB' }]} elevation={1}>
            <TouchableOpacity style={{ padding: 16 }} onPress={() => handleAddProductionLait()}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <MaterialIcons name="water-drop" size={24} color="#3498DB" />
                <MaterialIcons name="add-circle" size={24} color="#3498DB" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginTop: 8 }}>
                {milkToday.toFixed(1)} L
              </Text>
              <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Aujourd'hui</Text>
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#AED6F1', paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2980B9' }}>
                  Semaine: {milkWeek.toFixed(1)} L
                </Text>
              </View>
            </TouchableOpacity>
          </Surface>

          {/* Card Oeufs */}
          <Surface style={[styles.statCard, { marginRight: 12, minWidth: 180, backgroundColor: '#FEF9E7' }]} elevation={1}>
            <TouchableOpacity style={{ padding: 16 }} onPress={handleAddProductionOeufs}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <MaterialIcons name="egg" size={24} color="#F1C40F" />
                <MaterialIcons name="add-circle" size={24} color="#F1C40F" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2C3E50', marginTop: 8 }}>
                {eggsToday}
              </Text>
              <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Aujourd'hui</Text>
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#F9E79F', paddingTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#F39C12' }}>
                  Semaine: {eggsWeek}
                </Text>
              </View>
            </TouchableOpacity>
          </Surface>

        </ScrollView>
      </View>
    );
  };

  // ============================================
  // RENDER TAB CONTENT
  // ============================================
  const renderTabContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'flotte':
        return (
          <View style={styles.tabContent}>
            {/* Search Bar */}
            <Searchbar
              placeholder="Rechercher un véhicule..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[styles.searchBar, isDesktop && styles.searchBarDesktop]}
            />

            {/* Stats */}
            {renderStatsCards(statsFlotte, 'flotte')}

            {/* Productions Section */}
            {renderFlotteProductionSection()}

            {/* Liste des véhicules */}
            <FlatList
              data={filteredVehicules}
              renderItem={renderVehiculeCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={[
                styles.listContainer,
                isDesktop && styles.listContainerDesktop
              ]}
              numColumns={getNumColumns()}
              key={getNumColumns()} // Force re-render on column change
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="directions-car" size={60} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucun véhicule</Text>
                  <Button mode="contained" onPress={handleAddVehicule} style={{ marginTop: 15 }}>
                    Ajouter un véhicule
                  </Button>
                </View>
              }
            />
          </View>
        );

      case 'agriculture':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher une parcelle..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[styles.searchBar, isDesktop && styles.searchBarDesktop]}
            />

            {renderStatsCards(statsAgriculture, 'agriculture')}

            {/* Productions Section */}
            {renderAgricultureProductionSection()}

            {/* BOUTONS BONUS AGRICULTURE */}
            <View style={[styles.quickActions, isDesktop && styles.quickActionsDesktop]}>
              <Button
                mode="outlined"
                onPress={() => setAgriculturesModalVisible(true)}
                icon="person"
                style={styles.quickActionButton}
              >
                Agriculteurs
              </Button>
              <Button
                mode="outlined"
                onPress={() => setTechniciensModalVisible(true)}
                icon="build"
                style={styles.quickActionButton}
              >
                Techniciens
              </Button>
              <Button
                mode="outlined"
                onPress={() => setTypesCulturesModalVisible(true)}
                icon="sprout"
                style={styles.quickActionButton}
              >
                Types Cultures
              </Button>
            </View>

            {/* Reste du contenu agriculture */}
            <FlatList
              data={filteredParcelles}
              renderItem={renderParcelleCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={[
                styles.listContainer,
                isDesktop && styles.listContainerDesktop
              ]}
              numColumns={getNumColumns()}
              key={getNumColumns()}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="landscape" size={60} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucune parcelle</Text>
                  <Button mode="contained" onPress={handleAddParcelle} style={{ marginTop: 15 }}>
                    Ajouter une parcelle
                  </Button>
                </View>
              }
            />
          </View>
        );

      case 'elevage':
        return (
          <View style={styles.tabContent}>
            {/* Search Bar */}
            <Searchbar
              placeholder="Rechercher un animal..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={[styles.searchBar, isDesktop && styles.searchBarDesktop]}
            />

            {/* Stats */}
            {renderStatsCards(statsElevage, 'elevage')}

            {/* Productions Section */}
            {renderProductionsSection()}

            {/* Liste des animaux */}
            <FlatList
              data={filteredAnimaux}
              renderItem={renderAnimalCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={[
                styles.listContainer,
                isDesktop && styles.listContainerDesktop
              ]}
              numColumns={getNumColumns()}
              key={getNumColumns()}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="pets" size={60} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucun animal</Text>
                  <Button mode="contained" onPress={handleAddAnimal} style={{ marginTop: 15 }}>
                    Enregistrer un animal
                  </Button>
                </View>
              }
            />
          </View>
        );

      default:
        return null;
    }
  };

  // ============================================
  // RENDER MODALS - VÉHICULE
  // ============================================
  const renderVehiculeModal = () => (
    <Portal>
      <Modal
        visible={vehiculeModalVisible}
        onDismiss={() => setVehiculeModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>
            {vehiculeMode === 'add' ? 'Nouveau Véhicule' : vehiculeMode === 'edit' ? 'Modifier Véhicule' : 'Détails Véhicule'}
          </Title>

          {vehiculeMode !== 'view' ? (
            <>
              <TextInput
                label="Immatriculation *"
                value={vehiculeForm.immatriculation}
                onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, immatriculation: text })}
                style={styles.input}
                mode="outlined"
                error={!!immatError}
                right={checkingImmat ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color="#2E86C1" />} /> :
                  !isImmatUnique ? <TextInput.Icon icon="alert-circle" color="#E74C3C" /> :
                    vehiculeForm.immatriculation && vehiculeMode === 'add' ? <TextInput.Icon icon="check-circle" color="#27AE60" /> : null}
              />
              {immatError && <Text style={styles.errorTextSmall}>{immatError}</Text>}

              <View style={styles.rowInputs}>
                <TextInput
                  label="Marque *"
                  value={vehiculeForm.marque}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, marque: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
                <TextInput
                  label="Modèle *"
                  value={vehiculeForm.modele}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, modele: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  label="Année"
                  value={vehiculeForm.annee}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, annee: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
                <TextInput
                  label="Couleur"
                  value={vehiculeForm.couleur}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, couleur: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
              </View>

              {/* Type de véhicule */}
              <Text style={styles.inputLabel}>Type de véhicule *</Text>
              <SegmentedButtons
                value={vehiculeForm.type_vehicule}
                onValueChange={(value) => setVehiculeForm({ ...vehiculeForm, type_vehicule: value })}
                buttons={[
                  { value: 'camion', label: 'Camion' },
                  { value: 'pickup', label: 'Pickup' },
                  { value: 'voiture', label: 'Voiture' },
                  { value: 'moto', label: 'Moto' }
                ]}
                style={styles.segmentedButtons}
              />

              <View style={styles.rowInputs}>
                <TextInput
                  label="Capacité carburant (L)"
                  value={vehiculeForm.capacite_carburant}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, capacite_carburant: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
                <TextInput
                  label="Consommation (L/100km)"
                  value={vehiculeForm.consommation_moyenne}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, consommation_moyenne: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
              </View>

              <TextInput
                label="Kilométrage actuel *"
                value={vehiculeForm.kilometrage_actuel}
                onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, kilometrage_actuel: text })}
                style={styles.input}
                mode="outlined"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Photo du véhicule</Text>
              <View style={styles.photoPickerContainer}>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setVehiculeForm, vehiculeForm, 'camera')}
                >
                  <MaterialIcons name="photo-camera" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setVehiculeForm, vehiculeForm, 'library')}
                >
                  <MaterialIcons name="photo-library" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Galerie</Text>
                </TouchableOpacity>
                {vehiculeForm.photo && (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: vehiculeForm.photo }} style={styles.photoPreview} />
                    <IconButton
                      icon="close-circle"
                      iconColor="#E74C3C"
                      size={20}
                      style={styles.removePhotoIcon}
                      onPress={() => setVehiculeForm({ ...vehiculeForm, photo: null })}
                    />
                  </View>
                )}
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  label="Prix d'achat"
                  value={vehiculeForm.prix_achat}
                  onChangeText={(text) => setVehiculeForm({ ...vehiculeForm, prix_achat: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
                <Button
                  mode="outlined"
                  onPress={() => openDatePicker('date_achat', 'date', 'vehicule', vehiculeForm.date_achat)}
                  style={[styles.input, styles.halfInput, { justifyContent: 'center' }]}
                  icon="calendar"
                >
                  Achat: {formatDate(vehiculeForm.date_achat)}
                </Button>
              </View>

              {/* Sélection département */}
              <Text style={styles.inputLabel}>Département *</Text>
              <ScrollView horizontal style={styles.chipContainer}>
                {departements.map((dept) => (
                  <Chip
                    key={dept.id}
                    selected={vehiculeForm.id_departement === dept.id}
                    onPress={() => setVehiculeForm({ ...vehiculeForm, id_departement: dept.id })}
                    style={styles.chip}
                  >
                    {dept.nom}
                  </Chip>
                ))}
              </ScrollView>

              {/* Sélection chauffeur */}
              <Text style={styles.inputLabel}>Chauffeur attitré</Text>
              <ScrollView horizontal style={styles.chipContainer}>
                {chauffeurs.map((chauff) => (
                  <Chip
                    key={chauff.id}
                    selected={vehiculeForm.id_chauffeur_attitre === chauff.id}
                    onPress={() => setVehiculeForm({ ...vehiculeForm, id_chauffeur_attitre: chauff.id })}
                    style={styles.chip}
                  >
                    {chauff.nom_complet}
                  </Chip>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <Button onPress={() => setVehiculeModalVisible(false)} style={styles.modalButton}>
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveVehicule}
                  style={styles.modalButton}
                  disabled={vehiculeMode === 'add' && !isImmatUnique}
                >
                  Enregistrer
                </Button>
              </View>
            </>
          ) : (
            // Mode VIEW
            <>
              <List.Section>
                <List.Item
                  title="Immatriculation"
                  description={selectedVehicule?.immatriculation}
                  left={props => <List.Icon {...props} icon="card-text" />}
                />
                <List.Item
                  title="Marque / Modèle"
                  description={`${selectedVehicule?.marque} ${selectedVehicule?.modele}`}
                  left={props => <List.Icon {...props} icon="car" />}
                />
                <List.Item
                  title="Type"
                  description={selectedVehicule?.type_vehicule}
                  left={props => <List.Icon {...props} icon="format-list-bulleted-type" />}
                />
                <List.Item
                  title="Kilométrage"
                  description={`${formatCurrency(selectedVehicule?.kilometrage_actuel || 0, '')} km`}
                  left={props => <List.Icon {...props} icon="speedometer" />}
                />
                <List.Item
                  title="Chauffeur attitré"
                  description={selectedVehicule?.chauffeur_nom || 'Non affecté'}
                  left={props => <List.Icon {...props} icon="account" />}
                />
                <List.Item
                  title="Département"
                  description={selectedVehicule?.departement_nom}
                  left={props => <List.Icon {...props} icon="office-building" />}
                />
                <List.Item
                  title="Statut"
                  description={selectedVehicule?.statut}
                  left={props => <List.Icon {...props} icon="information" />}
                />
              </List.Section>

              <View style={styles.modalActions}>
                <Button onPress={() => setVehiculeModalVisible(false)}>
                  Fermer
                </Button>
                <Button mode="contained" onPress={() => {
                  setVehiculeMode('edit');
                  setVehiculeForm({
                    ...selectedVehicule,
                    date_achat: selectedVehicule.date_achat ? new Date(selectedVehicule.date_achat) : new Date()
                  });
                }}>
                  Modifier
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // RENDER MODALS - MOUVEMENT
  // ============================================
  const renderMouvementModal = () => (
    <Portal>
      <Modal
        visible={mouvementModalVisible}
        onDismiss={() => setMouvementModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Enregistrer un mouvement</Title>

          <Text style={styles.inputLabel}>Véhicule</Text>
          <Chip icon="car">
            {selectedVehicule?.marque} {selectedVehicule?.modele} - {selectedVehicule?.immatriculation}
          </Chip>

          <Text style={styles.inputLabel}>Type de mouvement</Text>
          <SegmentedButtons
            value={mouvementForm.type_mouvement}
            onValueChange={(value) => setMouvementForm({ ...mouvementForm, type_mouvement: value })}
            buttons={[
              { value: 'sortie', label: 'Sortie' },
              { value: 'retour', label: 'Retour' }
            ]}
            style={styles.segmentedButtons}
          />

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_mission', 'date', 'mouvement', mouvementForm.date_mission)}
            style={styles.input}
            icon="calendar"
          >
            Date mission: {formatDate(mouvementForm.date_mission)}
          </Button>

          <Text style={styles.inputLabel}>Chauffeur *</Text>
          <ScrollView horizontal style={styles.chipContainer}>
            {chauffeurs.map((chauff) => (
              <Chip
                key={chauff.id}
                selected={mouvementForm.id_chauffeur === chauff.id}
                onPress={() => setMouvementForm({ ...mouvementForm, id_chauffeur: chauff.id })}
                style={styles.chip}
              >
                {chauff.nom_complet}
              </Chip>
            ))}
          </ScrollView>

          <TextInput
            label="Destination *"
            value={mouvementForm.destination}
            onChangeText={(text) => setMouvementForm({ ...mouvementForm, destination: text })}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Motif de la mission *"
            value={mouvementForm.motif}
            onChangeText={(text) => setMouvementForm({ ...mouvementForm, motif: text })}
            style={styles.input}
            mode="outlined"
            multiline
          />

          <View style={styles.rowInputs}>
            <TextInput
              label="Heure départ"
              value={mouvementForm.heure_depart}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, heure_depart: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              placeholder="HH:MM"
            />
            <TextInput
              label="Heure retour"
              value={mouvementForm.heure_retour}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, heure_retour: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              placeholder="HH:MM"
            />
          </View>

          <View style={styles.rowInputs}>
            <TextInput
              label="Km départ *"
              value={mouvementForm.kilometrage_depart}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, kilometrage_depart: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Km retour"
              value={mouvementForm.kilometrage_retour}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, kilometrage_retour: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <TextInput
            label="Passagers"
            value={mouvementForm.passagers}
            onChangeText={(text) => setMouvementForm({ ...mouvementForm, passagers: text })}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Marchandise transportée"
            value={mouvementForm.marchandise_transportee}
            onChangeText={(text) => setMouvementForm({ ...mouvementForm, marchandise_transportee: text })}
            style={styles.input}
            mode="outlined"
            multiline
          />

          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Frais</Text>

          <View style={styles.rowInputs}>
            <TextInput
              label="Carburant (BIF)"
              value={mouvementForm.cout_carburant}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, cout_carburant: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Quantité (L)"
              value={mouvementForm.quantite_carburant}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, quantite_carburant: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.rowInputs}>
            <TextInput
              label="Péages (BIF)"
              value={mouvementForm.cout_peages}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, cout_peages: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Autres frais (BIF)"
              value={mouvementForm.autres_frais}
              onChangeText={(text) => setMouvementForm({ ...mouvementForm, autres_frais: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.modalActions}>
            <Button onPress={() => setMouvementModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveMouvement} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // RENDER MODALS - MAINTENANCE
  // ============================================
  const renderMaintenanceModal = () => (
    <Portal>
      <Modal
        visible={maintenanceModalVisible}
        onDismiss={() => setMaintenanceModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Enregistrer une maintenance</Title>

          <Text style={styles.inputLabel}>Véhicule</Text>
          <Chip icon="car">
            {selectedVehicule?.marque} {selectedVehicule?.modele} - {selectedVehicule?.immatriculation}
          </Chip>

          <Text style={styles.inputLabel}>Type de maintenance *</Text>
          <SegmentedButtons
            value={maintenanceForm.type_maintenance}
            onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, type_maintenance: value })}
            buttons={[
              { value: 'vidange', label: 'Vidange' },
              { value: 'revision', label: 'Révision' },
              { value: 'reparation', label: 'Réparation' },
              { value: 'autre', label: 'Autre' }
            ]}
            style={styles.segmentedButtons}
          />

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_intervention', 'date', 'maintenance', maintenanceForm.date_intervention)}
            style={styles.input}
            icon="calendar"
          >
            Date intervention: {formatDate(maintenanceForm.date_intervention)}
          </Button>

          <TextInput
            label="Description *"
            value={maintenanceForm.description}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, description: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />

          <TextInput
            label="Fournisseur / Garage"
            value={maintenanceForm.fournisseur}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, fournisseur: text })}
            style={styles.input}
            mode="outlined"
          />

          <View style={styles.rowInputs}>
            <TextInput
              label="N° Facture"
              value={maintenanceForm.numero_facture}
              onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, numero_facture: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
            />
            <TextInput
              label="Coût (BIF) *"
              value={maintenanceForm.cout_maintenance}
              onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, cout_maintenance: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <TextInput
            label="Kilométrage actuel *"
            value={maintenanceForm.kilometrage}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, kilometrage: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <View style={styles.rowInputs}>
            <TextInput
              label="Km prochaine maintenance"
              value={maintenanceForm.kilometrage_prochaine}
              onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, kilometrage_prochaine: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Garantie (jours)"
              value={maintenanceForm.garantie_jours}
              onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, garantie_jours: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.modalActions}>
            <Button onPress={() => setMaintenanceModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveMaintenance} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // RENDER MODALS - ASSURANCE
  // ============================================
  const renderAssuranceModal = () => (
    <Portal>
      <Modal
        visible={assuranceModalVisible}
        onDismiss={() => setAssuranceModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Enregistrer une assurance</Title>

          <Text style={styles.inputLabel}>Véhicule</Text>
          <Chip icon="car">
            {selectedVehicule?.marque} {selectedVehicule?.modele} - {selectedVehicule?.immatriculation}
          </Chip>

          <TextInput
            label="Compagnie d'assurance *"
            value={assuranceForm.compagnie_assurance}
            onChangeText={(text) => setAssuranceForm({ ...assuranceForm, compagnie_assurance: text })}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Numéro de police *"
            value={assuranceForm.numero_police}
            onChangeText={(text) => setAssuranceForm({ ...assuranceForm, numero_police: text })}
            style={styles.input}
            mode="outlined"
          />

          <Text style={styles.inputLabel}>Type de couverture *</Text>
          <SegmentedButtons
            value={assuranceForm.type_couverture}
            onValueChange={(value) => setAssuranceForm({ ...assuranceForm, type_couverture: value })}
            buttons={[
              { value: 'tous_risques', label: 'Tous risques' },
              { value: 'au_tiers', label: 'Au tiers' },
              { value: 'au_tiers_plus', label: 'Tiers +' }
            ]}
            style={styles.segmentedButtons}
          />

          <View style={styles.rowInputs}>
            <TextInput
              label="Montant prime (BIF) *"
              value={assuranceForm.montant_prime}
              onChangeText={(text) => setAssuranceForm({ ...assuranceForm, montant_prime: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Franchise (BIF)"
              value={assuranceForm.franchise}
              onChangeText={(text) => setAssuranceForm({ ...assuranceForm, franchise: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_debut', 'date', 'assurance', assuranceForm.date_debut)}
            style={styles.input}
            icon="calendar"
          >
            Date début: {formatDate(assuranceForm.date_debut)}
          </Button>

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_expiration', 'date', 'assurance', assuranceForm.date_expiration)}
            style={styles.input}
            icon="calendar"
          >
            Date expiration: {assuranceForm.date_expiration ? formatDate(assuranceForm.date_expiration) : 'Sélectionner'}
          </Button>

          <View style={styles.modalActions}>
            <Button onPress={() => setAssuranceModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveAssurance} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MODAL - PARCELLE
  // ============================================
  const renderParcelleModal = () => (
    <Portal>
      <Modal
        visible={parcelleModalVisible}
        onDismiss={() => setParcelleModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>
            {parcelleMode === 'add' ? 'Nouvelle Parcelle' : parcelleMode === 'edit' ? 'Modifier Parcelle' : 'Détails Parcelle'}
          </Title>

          {parcelleMode !== 'view' ? (
            <>
              <View style={styles.rowInputs}>
                <TextInput
                  label="Référence *"
                  value={parcelleForm.reference}
                  onChangeText={(text) => setParcelleForm({ ...parcelleForm, reference: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  error={!!parcelleRefError}
                  right={
                    checkingParcelleRef ? <TextInput.Icon key="loading" icon={() => <ActivityIndicator size="small" color="#2E86C1" />} /> :
                      !isParcelleRefUnique ? <TextInput.Icon key="alert" icon="alert-circle" color="#E74C3C" /> :
                        (parcelleForm.reference && parcelleMode === 'add') ? <TextInput.Icon key="check" icon="check-circle" color="#27AE60" /> : null
                  }
                />
                <TextInput
                  label="Nom de la parcelle *"
                  value={parcelleForm.nom_parcelle}
                  onChangeText={(text) => setParcelleForm({ ...parcelleForm, nom_parcelle: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
              </View>

              <TextInput
                label="Superficie (hectares) *"
                value={parcelleForm.superficie_hectares}
                onChangeText={(text) => setParcelleForm({ ...parcelleForm, superficie_hectares: text })}
                style={styles.input}
                mode="outlined"
                keyboardType="numeric"
              />

              <TextInput
                label="Localisation *"
                value={parcelleForm.localisation}
                onChangeText={(text) => setParcelleForm({ ...parcelleForm, localisation: text })}
                style={styles.input}
                mode="outlined"
              />

              <TextInput
                label="Coordonnées GPS"
                value={parcelleForm.coordonnees_gps}
                onChangeText={(text) => setParcelleForm({ ...parcelleForm, coordonnees_gps: text })}
                style={styles.input}
                mode="outlined"
                placeholder="Latitude, Longitude"
              />

              <Text style={styles.inputLabel}>Type de sol *</Text>
              <SegmentedButtons
                value={parcelleForm.type_sol}
                onValueChange={(value) => setParcelleForm({ ...parcelleForm, type_sol: value })}
                buttons={[
                  { value: 'argileux', label: 'Argileux' },
                  { value: 'sableux', label: 'Sableux' },
                  { value: 'limoneux', label: 'Limoneux' },
                  { value: 'humifere', label: 'Humifère' }
                ]}
                style={styles.segmentedButtons}
              />

              <View style={styles.rowInputs}>
                <TextInput
                  label="pH du sol"
                  value={parcelleForm.ph_sol}
                  onChangeText={(text) => setParcelleForm({ ...parcelleForm, ph_sol: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
                <TextInput
                  label="Taux d'humidité (%)"
                  value={parcelleForm.taux_humidite}
                  onChangeText={(text) => setParcelleForm({ ...parcelleForm, taux_humidite: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
              </View>

              <List.Item
                title="Irrigation installée"
                left={props => <List.Icon {...props} icon="water" />}
                right={() => (
                  <Switch
                    value={parcelleForm.irrigation_installee}
                    onValueChange={(value) => setParcelleForm({ ...parcelleForm, irrigation_installee: value })}
                  />
                )}
              />

              <Text style={styles.inputLabel}>Propriétaire</Text>
              <SegmentedButtons
                value={parcelleForm.proprietaire}
                onValueChange={(value) => setParcelleForm({ ...parcelleForm, proprietaire: value })}
                buttons={[
                  { value: 'propre', label: 'Propriété' },
                  { value: 'location', label: 'Location' }
                ]}
                style={styles.segmentedButtons}
              />

              {parcelleForm.proprietaire === 'location' && (
                <TextInput
                  label="Loyer annuel (BIF)"
                  value={parcelleForm.loyer_annuel}
                  onChangeText={(text) => setParcelleForm({ ...parcelleForm, loyer_annuel: text })}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="numeric"
                />
              )}

              <Text style={styles.inputLabel}>Photo de la parcelle</Text>
              <View style={styles.photoPickerContainer}>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setParcelleForm, parcelleForm, 'camera')}
                >
                  <MaterialIcons name="photo-camera" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setParcelleForm, parcelleForm, 'library')}
                >
                  <MaterialIcons name="photo-library" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Galerie</Text>
                </TouchableOpacity>
                {parcelleForm.photo && (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: parcelleForm.photo }} style={styles.photoPreview} />
                    <IconButton
                      icon="close-circle"
                      iconColor="#E74C3C"
                      size={20}
                      style={styles.removePhotoIcon}
                      onPress={() => setParcelleForm({ ...parcelleForm, photo: null })}
                    />
                  </View>
                )}
              </View>
              {parcelleRefError && <Text style={styles.errorTextSmall}>{parcelleRefError}</Text>}

              <View style={styles.modalActions}>
                <Button onPress={() => setParcelleModalVisible(false)} style={styles.modalButton}>
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveParcelle}
                  style={styles.modalButton}
                  disabled={parcelleMode === 'add' && !isParcelleRefUnique}
                >
                  Enregistrer
                </Button>
              </View>
            </>
          ) : (
            // Mode VIEW
            <>
              <List.Section>
                <List.Item
                  title="Référence"
                  description={selectedParcelle?.reference}
                  left={props => <List.Icon {...props} icon="tag" />}
                />
                <List.Item
                  title="Nom"
                  description={selectedParcelle?.nom_parcelle}
                  left={props => <List.Icon {...props} icon="text" />}
                />
                <List.Item
                  title="Superficie"
                  description={`${selectedParcelle?.superficie_hectares} hectares`}
                  left={props => <List.Icon {...props} icon="ruler" />}
                />
                <List.Item
                  title="Localisation"
                  description={selectedParcelle?.localisation}
                  left={props => <List.Icon {...props} icon="map-marker" />}
                />
                <List.Item
                  title="Type de sol"
                  description={selectedParcelle?.type_sol}
                  left={props => <List.Icon {...props} icon="terrain" />}
                />
                <List.Item
                  title="Culture actuelle"
                  description={selectedParcelle?.culture_actuelle || 'Aucune'}
                  left={props => <List.Icon {...props} icon="sprout" />}
                />
              </List.Section>

              <View style={styles.modalActions}>
                <Button onPress={() => setParcelleModalVisible(false)}>
                  Fermer
                </Button>
                <Button mode="contained" onPress={() => {
                  setParcelleMode('edit');
                  setParcelleForm(selectedParcelle);
                }}>
                  Modifier
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MODAL - CULTURE
  // ============================================
  const renderCultureModal = () => (
    <Portal>
      <Modal
        visible={cultureModalVisible}
        onDismiss={() => setCultureModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Démarrer une nouvelle culture</Title>

          <Text style={styles.inputLabel}>Parcelle</Text>
          <Chip icon="landscape">
            {selectedParcelle?.nom_parcelle} - {selectedParcelle?.superficie_hectares} ha
          </Chip>

          <TextInput
            label="Référence saison *"
            value={cultureForm.reference_saison}
            onChangeText={(text) => setCultureForm({ ...cultureForm, reference_saison: text })}
            style={styles.input}
            mode="outlined"
            placeholder="Ex: Saison A 2024"
          />

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_semaison', 'date', 'culture', cultureForm.date_semaison)}
            style={styles.input}
            icon="calendar"
          >
            Date de semis: {formatDate(cultureForm.date_semaison)}
          </Button>

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_levage_prevue', 'date', 'culture', cultureForm.date_levage_prevue)}
            style={styles.input}
            icon="calendar"
          >
            Date levée prévue: {cultureForm.date_levage_prevue ? formatDate(cultureForm.date_levage_prevue) : 'Sélectionner'}
          </Button>

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_recolte_prevue', 'date', 'culture', cultureForm.date_recolte_prevue)}
            style={styles.input}
            icon="calendar"
          >
            Date récolte prévue: {cultureForm.date_recolte_prevue ? formatDate(cultureForm.date_recolte_prevue) : 'Sélectionner'}
          </Button>

          <View style={styles.rowInputs}>
            <TextInput
              label="Quantité semences (kg)"
              value={cultureForm.quantite_semences_kg}
              onChangeText={(text) => setCultureForm({ ...cultureForm, quantite_semences_kg: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Densité semis"
              value={cultureForm.densite_semis}
              onChangeText={(text) => setCultureForm({ ...cultureForm, densite_semis: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
            />
          </View>

          <TextInput
            label="Commentaires"
            value={cultureForm.commentaires}
            onChangeText={(text) => setCultureForm({ ...cultureForm, commentaires: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <Button onPress={() => setCultureModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveCulture} style={styles.modalButton}>
              Démarrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // Continuons avec les modals Animaux dans la prochaine partie...

  // ============================================
  // MODAL - ANIMAL
  // ============================================
  const renderAnimalModal = () => (
    <Portal>
      <Modal
        visible={animalModalVisible}
        onDismiss={() => setAnimalModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>
            {animalMode === 'add' ? 'Nouvel Animal' : animalMode === 'edit' ? 'Modifier Animal' : 'Détails Animal'}
          </Title>

          {animalMode !== 'view' ? (
            <>
              <View style={styles.rowInputs}>
                <TextInput
                  label="N° Identification *"
                  value={animalForm.numero_identification}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, numero_identification: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  error={!!animalIdError}
                  right={
                    checkingAnimalId ? <TextInput.Icon key="loading" icon={() => <ActivityIndicator size="small" color="#2E86C1" />} /> :
                      !isAnimalIdUnique ? <TextInput.Icon key="alert" icon="alert-circle" color="#E74C3C" /> :
                        (animalForm.numero_identification && animalMode === 'add') ? <TextInput.Icon key="check" icon="check-circle" color="#27AE60" /> : null
                  }
                />
                <TextInput
                  label="Nom de l'animal"
                  value={animalForm.nom_animal}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, nom_animal: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
              </View>

              <Text style={styles.inputLabel}>Espèce *</Text>
              <SegmentedButtons
                value={animalForm.espece}
                onValueChange={(value) => setAnimalForm({ ...animalForm, espece: value })}
                buttons={[
                  { value: 'vache', label: 'Vache' },
                  { value: 'chevre', label: 'Chèvre' },
                  { value: 'poule', label: 'Poule' },
                  { value: 'mouton', label: 'Mouton' }
                ]}
                style={styles.segmentedButtons}
              />

              <View style={styles.rowInputs}>
                <TextInput
                  label="Race *"
                  value={animalForm.race}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, race: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
                <View style={[styles.input, styles.halfInput]}>
                  <Text style={styles.inputLabel}>Sexe *</Text>
                  <SegmentedButtons
                    value={animalForm.sexe}
                    onValueChange={(value) => setAnimalForm({ ...animalForm, sexe: value })}
                    buttons={[
                      { value: 'male', label: 'Mâle' },
                      { value: 'femelle', label: 'Femelle' }
                    ]}
                  />
                </View>
              </View>

              <Button
                mode="outlined"
                onPress={() => openDatePicker('date_naissance', 'date', 'animal', animalForm.date_naissance)}
                style={styles.input}
                icon="calendar"
              >
                Date naissance: {formatDate(animalForm.date_naissance)}
              </Button>

              <View style={styles.rowInputs}>
                <TextInput
                  label="Poids naissance (kg)"
                  value={animalForm.poids_naissance}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, poids_naissance: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
                <TextInput
                  label="Poids actuel (kg)"
                  value={animalForm.poids_actuel}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, poids_actuel: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  label="Couleur"
                  value={animalForm.couleur}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, couleur: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
                <TextInput
                  label="Marques distinctives"
                  value={animalForm.marques_distinctives}
                  onChangeText={(text) => setAnimalForm({ ...animalForm, marques_distinctives: text })}
                  style={[styles.input, styles.halfInput]}
                  mode="outlined"
                />
              </View>

              <Text style={styles.inputLabel}>Origine</Text>
              <SegmentedButtons
                value={animalForm.origine}
                onValueChange={(value) => setAnimalForm({ ...animalForm, origine: value })}
                buttons={[
                  { value: 'achat', label: 'Achat' },
                  { value: 'naissance', label: 'Naissance' },
                  { value: 'don', label: 'Don' }
                ]}
                style={styles.segmentedButtons}
              />

              {animalForm.origine === 'achat' && (
                <>
                  <TextInput
                    label="Prix d'achat (BIF)"
                    value={animalForm.prix_achat}
                    onChangeText={(text) => setAnimalForm({ ...animalForm, prix_achat: text })}
                    style={styles.input}
                    mode="outlined"
                    keyboardType="numeric"
                  />

                  <Button
                    mode="outlined"
                    onPress={() => openDatePicker('date_acquisition', 'date', 'animal', animalForm.date_acquisition)}
                    style={styles.input}
                    icon="calendar"
                  >
                    Date acquisition: {formatDate(animalForm.date_acquisition)}
                  </Button>
                </>
              )}

              <Text style={styles.inputLabel}>Photo de l'animal</Text>
              <View style={styles.photoPickerContainer}>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setAnimalForm, animalForm, 'camera')}
                >
                  <MaterialIcons name="photo-camera" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoPickerBtn}
                  onPress={() => handlePickImage(setAnimalForm, animalForm, 'library')}
                >
                  <MaterialIcons name="photo-library" size={24} color="#2E86C1" />
                  <Text style={styles.photoPickerText}>Galerie</Text>
                </TouchableOpacity>
                {animalForm.photo && (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: animalForm.photo }} style={styles.photoPreview} />
                    <IconButton
                      icon="close-circle"
                      iconColor="#E74C3C"
                      size={20}
                      style={styles.removePhotoIcon}
                      onPress={() => setAnimalForm({ ...animalForm, photo: null })}
                    />
                  </View>
                )}
              </View>
              {animalIdError && <Text style={styles.errorTextSmall}>{animalIdError}</Text>}

              <View style={styles.modalActions}>
                <Button onPress={() => setAnimalModalVisible(false)} style={styles.modalButton}>
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveAnimal}
                  style={styles.modalButton}
                  disabled={animalMode === 'add' && !isAnimalIdUnique}
                >
                  Enregistrer
                </Button>
              </View>
            </>
          ) : (
            // Mode VIEW
            <>
              {selectedAnimal?.photo && (
                <Image source={{ uri: selectedAnimal.photo }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 15 }} />
              )}

              <List.Section>
                <List.Item
                  title="Numéro d'identification"
                  description={selectedAnimal?.numero_identification}
                  left={props => <List.Icon {...props} icon="barcode" />}
                />
                <List.Item
                  title="Nom"
                  description={selectedAnimal?.nom_animal || 'Non nommé'}
                  left={props => <List.Icon {...props} icon="tag" />}
                />
                <List.Item
                  title="Espèce / Race"
                  description={`${selectedAnimal?.espece} - ${selectedAnimal?.race}`}
                  left={props => <List.Icon {...props} icon="paw" />}
                />
                <List.Item
                  title="Sexe"
                  description={selectedAnimal?.sexe === 'male' ? 'Mâle' : 'Femelle'}
                  left={props => <List.Icon {...props} icon="gender-male-female" />}
                />
                <List.Item
                  title="Âge"
                  description={`${calculateAge(selectedAnimal?.date_naissance)} ans`}
                  left={props => <List.Icon {...props} icon="calendar" />}
                />
                <List.Item
                  title="Poids actuel"
                  description={`${selectedAnimal?.poids_actuel || 0} kg`}
                  left={props => <List.Icon {...props} icon="weight" />}
                />
                <List.Item
                  title="Statut santé"
                  description={selectedAnimal?.statut_sante}
                  left={props => <List.Icon {...props} icon="heart-pulse" />}
                />
              </List.Section>

              <View style={styles.modalActions}>
                <Button onPress={() => setAnimalModalVisible(false)}>
                  Fermer
                </Button>
                <Button mode="contained" onPress={() => {
                  setAnimalMode('edit');
                  setAnimalForm({
                    ...selectedAnimal,
                    date_naissance: selectedAnimal.date_naissance ? new Date(selectedAnimal.date_naissance) : new Date(),
                    date_acquisition: selectedAnimal.date_acquisition ? new Date(selectedAnimal.date_acquisition) : new Date()
                  });
                }}>
                  Modifier
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderAgriculturesModal = () => (
    <Portal>
      <Modal
        visible={agriculturesModalVisible}
        onDismiss={() => setAgriculturesModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Liste des Agriculteurs</Title>

          <Searchbar
            placeholder="Rechercher agriculteur..."
            onChangeText={setAgriculturesSearchQuery}
            value={agriculturesSearchQuery}
            style={styles.input}
          />

          {filteredAgriculteurs.length > 0 ? (
            <View>
              {filteredAgriculteurs.map((agriculteur) => (
                <Card key={agriculteur.id} style={[styles.listItemCard, { marginBottom: 12 }]}>
                  <Card.Content>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Title style={{ fontSize: 16, marginBottom: 8 }}>
                          {agriculteur.nom_complet}
                        </Title>
                        <View style={styles.detailRow}>
                          <MaterialIcons name="badge" size={16} color="#6C757D" />
                          <Text style={styles.detailText}>{agriculteur.matricule}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <MaterialIcons name="phone" size={16} color="#6C757D" />
                          <Text style={styles.detailText}>{agriculteur.telephone || '-'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <MaterialIcons name="email" size={16} color="#6C757D" />
                          <Text style={styles.detailText}>{agriculteur.email || '-'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <MaterialIcons name="location-city" size={16} color="#6C757D" />
                          <Text style={styles.detailText}>{agriculteur.departement_nom || '-'}</Text>
                        </View>
                        {agriculteur.cultures_actives > 0 && (
                          <View style={styles.detailRow}>
                            <MaterialIcons name="agriculture" size={16} color="#27AE60" />
                            <Text style={[styles.detailText, { color: '#27AE60', fontWeight: '600' }]}>
                              {agriculteur.cultures_actives} cultures actives
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person" size={60} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucun agriculteur trouvé</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onPress={() => setAgriculturesModalVisible(false)} mode="contained">
              Fermer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );


  // ============================================
  // 6. RENDU MODAL TECHNICIENS
  // ============================================

  const renderTechniciensModal = () => (
    <Portal>
      <Modal
        visible={techniciensModalVisible}
        onDismiss={() => setTechniciensModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Liste des Techniciens</Title>

          <Searchbar
            placeholder="Rechercher technicien..."
            onChangeText={setTechniciensSearchQuery}
            value={techniciensSearchQuery}
            style={styles.input}
          />

          {filteredTechniciens.length > 0 ? (
            <View>
              {filteredTechniciens.map((technicien) => (
                <Card key={technicien.id} style={[styles.listItemCard, { marginBottom: 12 }]}>
                  <Card.Content>
                    <Title style={{ fontSize: 16, marginBottom: 8 }}>
                      {technicien.nom_complet}
                    </Title>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="badge" size={16} color="#6C757D" />
                      <Text style={styles.detailText}>{technicien.matricule}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="phone" size={16} color="#6C757D" />
                      <Text style={styles.detailText}>{technicien.telephone || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="email" size={16} color="#6C757D" />
                      <Text style={styles.detailText}>{technicien.email || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="location-city" size={16} color="#6C757D" />
                      <Text style={styles.detailText}>{technicien.departement_nom || '-'}</Text>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person" size={60} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucun technicien trouvé</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onPress={() => setTechniciensModalVisible(false)} mode="contained">
              Fermer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );


  // ============================================
  // 7. RENDU MODAL TYPES DE CULTURES
  // ============================================

  const renderTypesCulturesModal = () => (
    <Portal>
      <Modal
        visible={typesCulturesModalVisible}
        onDismiss={() => setTypesCulturesModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Types de Cultures</Title>

          <Searchbar
            placeholder="Rechercher culture..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.input}
          />

          {filteredTypesCultures.length > 0 ? (
            <View>
              {filteredTypesCultures.map((typeCulture) => (
                <Card key={typeCulture.id} style={[styles.listItemCard, { marginBottom: 12 }]}>
                  <Card.Content>
                    <Title style={{ fontSize: 16, marginBottom: 4 }}>
                      {typeCulture.nom_culture}
                    </Title>
                    <Text style={{ fontSize: 12, color: '#6C757D', marginBottom: 12 }}>
                      Code: {typeCulture.code_culture}
                    </Text>

                    <View style={styles.culturesGrid}>
                      <View style={styles.culturesGridItem}>
                        <Text style={styles.culturesLabel}>Famille</Text>
                        <Text style={styles.culturesValue}>{typeCulture.famille || '-'}</Text>
                      </View>
                      <View style={styles.culturesGridItem}>
                        <Text style={styles.culturesLabel}>Saison</Text>
                        <Text style={styles.culturesValue}>{typeCulture.saison_optimale || '-'}</Text>
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 12 }} />

                    <View style={styles.culturesDetails}>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="schedule" size={16} color="#F39C12" />
                        <Text style={styles.detailText}>Cycle: {typeCulture.duree_cycle_jours} jours</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="thermostat" size={16} color="#E67E22" />
                        <Text style={styles.detailText}>
                          Température: {typeCulture.temperature_optimale_min}°-{typeCulture.temperature_optimale_max}°C
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="water-drop" size={16} color="#3498DB" />
                        <Text style={styles.detailText}>Eau: {typeCulture.besoins_eau_mm} mm</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="show-chart" size={16} color="#27AE60" />
                        <Text style={styles.detailText}>
                          Rendement: {typeCulture.rendement_moyen_kg_ha} kg/ha
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="local-offer" size={16} color="#9B59B6" />
                        <Text style={styles.detailText}>Prix: {typeCulture.prix_moyen_kg} BIF/kg</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="storage" size={16} color="#34495E" />
                        <Text style={styles.detailText}>
                          Conservation: {typeCulture.duree_conservation_jours} jours
                        </Text>
                      </View>
                    </View>

                    {typeCulture.conditions_stockage && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[styles.culturesLabel, { marginBottom: 6 }]}>Conditions de stockage:</Text>
                        <Text style={{ fontSize: 12, color: '#495057', lineHeight: 18 }}>
                          {typeCulture.conditions_stockage}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="agriculture" size={60} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune culture trouvée</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onPress={() => setTypesCulturesModalVisible(false)} mode="contained">
              Fermer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MODAL - SUIVI SANITAIRE
  // ============================================
  const renderSuiviSanitaireModal = () => (
    <Portal>
      <Modal
        visible={suiviModalVisible}
        onDismiss={() => setSuiviModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Suivi Sanitaire</Title>

          <Text style={styles.inputLabel}>Animal</Text>
          <Chip icon="paw">
            {selectedAnimal?.nom_animal || selectedAnimal?.numero_identification} - {selectedAnimal?.espece}
          </Chip>

          <Text style={styles.inputLabel}>Type d'intervention *</Text>
          <SegmentedButtons
            value={suiviForm.type_intervention}
            onValueChange={(value) => setSuiviForm({ ...suiviForm, type_intervention: value })}
            buttons={[
              { value: 'vaccination', label: 'Vaccination' },
              { value: 'traitement', label: 'Traitement' },
              { value: 'controle', label: 'Contrôle' }
            ]}
            style={styles.segmentedButtons}
          />

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_intervention', 'date', 'suivi', suiviForm.date_intervention)}
            style={styles.input}
            icon="calendar"
          >
            Date intervention: {formatDate(suiviForm.date_intervention)}
          </Button>

          <TextInput
            label="Symptômes observés"
            value={suiviForm.symptomes}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, symptomes: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={2}
          />

          <TextInput
            label="Diagnostic *"
            value={suiviForm.diagnostic}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, diagnostic: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={2}
          />

          <TextInput
            label="Produit utilisé"
            value={suiviForm.produit_utilise}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, produit_utilise: text })}
            style={styles.input}
            mode="outlined"
          />

          <View style={styles.rowInputs}>
            <TextInput
              label="Dosage"
              value={suiviForm.dosage}
              onChangeText={(text) => setSuiviForm({ ...suiviForm, dosage: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
            />
            <TextInput
              label="Mode d'administration"
              value={suiviForm.mode_administration}
              onChangeText={(text) => setSuiviForm({ ...suiviForm, mode_administration: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
            />
          </View>

          <TextInput
            label="Vétérinaire"
            value={suiviForm.veterinaire}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, veterinaire: text })}
            style={styles.input}
            mode="outlined"
          />

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_prochaine_visite', 'date', 'suivi', suiviForm.date_prochaine_visite)}
            style={styles.input}
            icon="calendar"
          >
            Prochaine visite: {suiviForm.date_prochaine_visite ? formatDate(suiviForm.date_prochaine_visite) : 'Sélectionner'}
          </Button>

          <TextInput
            label="Instructions de suivi"
            value={suiviForm.instructions_suivi}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, instructions_suivi: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />

          <TextInput
            label="Coût intervention (BIF)"
            value={suiviForm.cout_intervention}
            onChangeText={(text) => setSuiviForm({ ...suiviForm, cout_intervention: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <View style={styles.modalActions}>
            <Button onPress={() => setSuiviModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveSuiviSanitaire} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MODAL - PRODUCTION LAIT
  // ============================================
  const renderProductionLaitModal = () => (
    <Portal>
      <Modal
        visible={productionLaitModalVisible}
        onDismiss={() => setProductionLaitModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Production de Lait</Title>

          {!selectedAnimal ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.inputLabel}>Sélectionner un animal *</Text>
              <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8 }}>
                {animaux.filter(a => ['vache', 'chevre', 'brebis'].includes(a.espece)).map(animal => (
                  <TouchableOpacity
                    key={animal.id}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}
                    onPress={() => {
                      setSelectedAnimal(animal);
                      setProductionLaitForm({ ...productionLaitForm, id_animal: animal.id });
                    }}
                  >
                    <Text style={{ fontWeight: 'bold' }}>{animal.nom_animal || animal.numero_identification}</Text>
                    <Text style={{ fontSize: 12, color: '#757575' }}>{animal.espece} - {animal.race}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Animal</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Chip icon="paw" style={{ flex: 1 }}>
                  {selectedAnimal?.nom_animal || selectedAnimal?.numero_identification}
                </Chip>
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => setSelectedAnimal(null)}
                />
              </View>
            </>
          )}

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_production', 'date', 'productionLait', productionLaitForm.date_production)}
            style={styles.input}
            icon="calendar"
          >
            Date: {formatDate(productionLaitForm.date_production)}
          </Button>

          <TextInput
            label="Heure de traite *"
            value={productionLaitForm.heure_traite}
            onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, heure_traite: text })}
            style={styles.input}
            mode="outlined"
            placeholder="HH:MM"
          />

          <TextInput
            label="Quantité (litres) *"
            value={productionLaitForm.quantite_litres}
            onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, quantite_litres: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Méthode de traite</Text>
          <SegmentedButtons
            value={productionLaitForm.methode_traite}
            onValueChange={(value) => setProductionLaitForm({ ...productionLaitForm, methode_traite: value })}
            buttons={[
              { value: 'manuel', label: 'Manuel' },
              { value: 'mecanique', label: 'Mécanique' }
            ]}
            style={styles.segmentedButtons}
          />

          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Qualité du lait</Text>

          <View style={styles.rowInputs}>
            <TextInput
              label="Taux MG (%)"
              value={productionLaitForm.taux_matiere_grasse}
              onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, taux_matiere_grasse: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Taux protéine (%)"
              value={productionLaitForm.taux_proteine}
              onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, taux_proteine: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.rowInputs}>
            <TextInput
              label="Température (°C)"
              value={productionLaitForm.temperature}
              onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, temperature: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="pH"
              value={productionLaitForm.ph}
              onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, ph: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.inputLabel}>Qualité</Text>
          <SegmentedButtons
            value={productionLaitForm.qualite}
            onValueChange={(value) => setProductionLaitForm({ ...productionLaitForm, qualite: value })}
            buttons={[
              { value: 'A', label: 'A' },
              { value: 'B', label: 'B' },
              { value: 'C', label: 'C' }
            ]}
            style={styles.segmentedButtons}
          />

          <Text style={styles.inputLabel}>Destination</Text>
          <SegmentedButtons
            value={productionLaitForm.destination}
            onValueChange={(value) => setProductionLaitForm({ ...productionLaitForm, destination: value })}
            buttons={[
              { value: 'vente', label: 'Vente' },
              { value: 'consommation', label: 'Consommation' },
              { value: 'transformation', label: 'Transformation' }
            ]}
            style={styles.segmentedButtons}
          />

          <TextInput
            label="Observations"
            value={productionLaitForm.observations}
            onChangeText={(text) => setProductionLaitForm({ ...productionLaitForm, observations: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={2}
          />

          <View style={styles.modalActions}>
            <Button onPress={() => setProductionLaitModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveProductionLait} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MODAL - PRODUCTION OEUFS
  // ============================================
  const renderProductionOeufsModal = () => (
    <Portal>
      <Modal
        visible={productionOeufsModalVisible}
        onDismiss={() => setProductionOeufsModalVisible(false)}
        contentContainerStyle={[
          styles.modalContainer,
          isDesktop && styles.modalContainerDesktop
        ]}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Production d'Œufs</Title>

          <Button
            mode="outlined"
            onPress={() => openDatePicker('date_recolte', 'date', 'productionOeufs', productionOeufsForm.date_recolte)}
            style={styles.input}
            icon="calendar"
          >
            Date: {formatDate(productionOeufsForm.date_recolte)}
          </Button>

          <TextInput
            label="Heure de récolte *"
            value={productionOeufsForm.heure_recolte}
            onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, heure_recolte: text })}
            style={styles.input}
            mode="outlined"
            placeholder="HH:MM"
          />

          <TextInput
            label="Nombre total d'œufs *"
            value={productionOeufsForm.nombre_oeufs}
            onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, nombre_oeufs: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Qualité</Text>

          <View style={styles.rowInputs}>
            <TextInput
              label="Œufs cassés"
              value={productionOeufsForm.oeufs_casses}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, oeufs_casses: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Œufs sales"
              value={productionOeufsForm.oeufs_sales}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, oeufs_sales: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <Divider style={styles.divider} />
          <Text style={styles.sectionTitle}>Calibres</Text>

          <View style={styles.rowInputs}>
            <TextInput
              label="Petit"
              value={productionOeufsForm.calibre_petit}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, calibre_petit: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Moyen"
              value={productionOeufsForm.calibre_moyen}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, calibre_moyen: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.rowInputs}>
            <TextInput
              label="Gros"
              value={productionOeufsForm.calibre_gros}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, calibre_gros: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
            <TextInput
              label="Extra-gros"
              value={productionOeufsForm.calibre_extra_gros}
              onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, calibre_extra_gros: text })}
              style={[styles.input, styles.halfInput]}
              mode="outlined"
              keyboardType="numeric"
            />
          </View>

          <TextInput
            label="Taux de fertilité (%)"
            value={productionOeufsForm.taux_fertile}
            onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, taux_fertile: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <TextInput
            label="Température stockage (°C)"
            value={productionOeufsForm.stockage_temperature}
            onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, stockage_temperature: text })}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Destination</Text>
          <SegmentedButtons
            value={productionOeufsForm.destination}
            onValueChange={(value) => setProductionOeufsForm({ ...productionOeufsForm, destination: value })}
            buttons={[
              { value: 'vente', label: 'Vente' },
              { value: 'consommation', label: 'Consommation' },
              { value: 'incubation', label: 'Incubation' }
            ]}
            style={styles.segmentedButtons}
          />

          <TextInput
            label="Observations"
            value={productionOeufsForm.observations}
            onChangeText={(text) => setProductionOeufsForm({ ...productionOeufsForm, observations: text })}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={2}
          />

          <View style={styles.modalActions}>
            <Button onPress={() => setProductionOeufsModalVisible(false)} style={styles.modalButton}>
              Annuler
            </Button>
            <Button mode="contained" onPress={handleSaveProductionOeufs} style={styles.modalButton}>
              Enregistrer
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <View>
          <Title style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop]}>
            Opérations
          </Title>
          <Text style={[styles.headerSubtitle, isDesktop && styles.headerSubtitleDesktop]}>
            Flotte • Agriculture • Élevage
          </Text>
        </View>
        <IconButton
          icon="refresh"
          size={isDesktop ? 28 : 24}
          iconColor="#2E86C1"
          onPress={onRefresh}
        />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, isDesktop && styles.tabsContainerDesktop]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'flotte' && styles.activeTab,
            isDesktop && styles.tabDesktop
          ]}
          onPress={() => setActiveTab('flotte')}
        >
          <MaterialIcons
            name="local-shipping"
            size={isDesktop ? 24 : 20}
            color={activeTab === 'flotte' ? '#2E86C1' : '#7F8C8D'}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'flotte' && styles.activeTabText,
            isDesktop && styles.tabTextDesktop
          ]}>
            Flotte ({vehicules.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'agriculture' && styles.activeTab,
            isDesktop && styles.tabDesktop
          ]}
          onPress={() => setActiveTab('agriculture')}
        >
          <MaterialIcons
            name="agriculture"
            size={isDesktop ? 24 : 20}
            color={activeTab === 'agriculture' ? '#2E86C1' : '#7F8C8D'}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'agriculture' && styles.activeTabText,
            isDesktop && styles.tabTextDesktop
          ]}>
            Agriculture ({parcelles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'elevage' && styles.activeTab,
            isDesktop && styles.tabDesktop
          ]}
          onPress={() => setActiveTab('elevage')}
        >
          <MaterialIcons
            name="pets"
            size={isDesktop ? 24 : 20}
            color={activeTab === 'elevage' ? '#2E86C1' : '#7F8C8D'}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'elevage' && styles.activeTabText,
            isDesktop && styles.tabTextDesktop
          ]}>
            Élevage ({animaux.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {renderTabContent()}

      {/* FAB */}
      <FAB
        icon="plus"
        style={[styles.fab, isDesktop && styles.fabDesktop]}
        onPress={() => {
          if (activeTab === 'flotte') handleAddVehicule();
          else if (activeTab === 'agriculture') handleAddParcelle();
          else handleAddAnimal();
        }}
        color="#FFFFFF"
      />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerValue}
          mode={datePickerMode}
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* Modals */}
      {renderVehiculeModal()}
      {renderMouvementModal()}
      {renderMaintenanceModal()}
      {renderAssuranceModal()}
      {renderParcelleModal()}
      {renderCultureModal()}
      {renderAnimalModal()}
      {renderSuiviSanitaireModal()}
      {renderProductionLaitModal()}
      {renderProductionOeufsModal()}
      {renderAgriculturesModal()}
      {renderTechniciensModal()}
      {renderTypesCulturesModal()}
    </View>
  );
};
// ============================================
// STYLES - RESPONSIVE & MODERNES
// ============================================
const styles = StyleSheet.create({
  // ============================================
  // CONTAINER PRINCIPAL
  // ============================================
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // ============================================
  // HEADER
  // ============================================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  headerTitleDesktop: {
    fontSize: 28,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 4,
    fontWeight: '400',
  },
  headerSubtitleDesktop: {
    fontSize: 15,
    marginTop: 6,
  },

  // ============================================
  // TABS NAVIGATION
  // ============================================
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E9ECEF',
    paddingHorizontal: 8,
  },
  tabsContainerDesktop: {
    paddingHorizontal: 24,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flex: 1,
    maxWidth: 200,
  },
  tabDesktop: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 8,
    flex: 0,
    minWidth: 180,
  },
  activeTab: {
    borderBottomColor: '#2E86C1',
    backgroundColor: '#EBF5FB',
  },
  tabText: {
    fontSize: 12,
    color: '#6C757D',
    marginLeft: 6,
    fontWeight: '500',
  },
  tabTextDesktop: {
    fontSize: 14,
    marginLeft: 8,
  },
  activeTabText: {
    color: '#2E86C1',
    fontWeight: '700',
  },

  // ============================================
  // TAB CONTENT
  // ============================================
  tabContent: {
    flex: 1,
  },

  // ============================================
  // SEARCH BAR
  // ============================================
  searchBar: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchBarDesktop: {
    marginHorizontal: 32,
    marginVertical: 16,
    maxWidth: 600,
  },

  // ============================================
  // STATS CONTAINER
  // ============================================
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 10,
  },
  statsContainerDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 16,
  },
  statsContainerTablet: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minWidth: 100,
    flex: 1,
    maxWidth: 150,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statCardDesktop: {
    minWidth: 140,
    maxWidth: 200,
    borderRadius: 20,
  },
  statCardTablet: {
    minWidth: 120,
    maxWidth: 170,
  },
  statCardContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 10,
    marginBottom: 4,
  },
  statValueDesktop: {
    fontSize: 32,
    marginTop: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#6C757D',
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statLabelDesktop: {
    fontSize: 13,
  },

  // ============================================
  // QUICK ACTIONS
  // ============================================
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  quickActionsDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2E86C1',
  },

  // ============================================
  // LIST CONTAINER
  // ============================================
  listContainer: {
    padding: 12,
    paddingBottom: 100,
  },
  listContainerDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    paddingBottom: 120,
  },

  // ============================================
  // ITEM CARDS
  // ============================================
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  itemCardDesktop: {
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 8,
    width: '48%',
    maxWidth: 500,
    borderRadius: 20,
  },
  itemCardTablet: {
    padding: 18,
    marginHorizontal: 6,
    width: '48%',
    maxWidth: 400,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardTitleDesktop: {
    fontSize: 17,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 8,
    lineHeight: 16,
  },
  cardSubtitleDesktop: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Card Tags
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  cardChip: {
    height: 24,
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 10,
    color: '#495057',
    fontWeight: '600',
  },

  // Animal Photo
  animalPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },

  // Card Divider
  cardDivider: {
    marginVertical: 12,
    backgroundColor: '#E9ECEF',
    height: 1,
  },

  // Card Details
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 6,
    gap: 12,
  },
  cardDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 6,
  },
  cardDetailText: {
    fontSize: 11,
    color: '#495057',
    marginLeft: 6,
    fontWeight: '500',
  },

  // Card Actions
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
    flexWrap: 'wrap',
  },

  // ============================================
  // EMPTY STATE
  // ============================================
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#ADB5BD',
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '600',
  },

  // ============================================
  // LOADING STATE
  // ============================================
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 16,
    fontWeight: '500',
  },

  // ============================================
  // FLOATING ACTION BUTTON
  // ============================================
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2E86C1',
    borderRadius: 28,
    width: 56,
    height: 56,
    shadowColor: '#2E86C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabDesktop: {
    right: 32,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
  },

  // ============================================
  // MODAL
  // ============================================
  modalContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 40,
    borderRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    padding: 20,
  },
  modalContainerDesktop: {
    marginHorizontal: '25%',
    marginVertical: 60,
    padding: 32,
    maxHeight: '80%',
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: 10,
    paddingVertical: 4,
  },

  // ============================================
  // FORM INPUTS
  // ============================================
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },

  // Segmented Buttons
  segmentedButtons: {
    marginBottom: 16,
    borderRadius: 10,
  },

  // Chip Container
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },

  // Divider
  divider: {
    marginVertical: 24,
    backgroundColor: '#DEE2E6',
    height: 1,
  },

  // Section Title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: 0.3,
  },

  // ============================================
  // RESPONSIVE BREAKPOINTS
  // ============================================

  // Mobile (< 768px) - Styles par défaut ci-dessus

  // Tablet (768px - 1024px)
  '@media (min-width: 768px) and (max-width: 1024px)': {
    container: {
      backgroundColor: '#F8F9FA',
    },
    itemCard: {
      width: '48%',
      marginHorizontal: 6,
    },
    statsContainer: {
      gap: 12,
    },
    modalContainer: {
      marginHorizontal: '15%',
    },
  },

  // Desktop (> 1024px)
  '@media (min-width: 1025px)': {
    container: {
      backgroundColor: '#F1F3F5',
    },
    itemCard: {
      width: '48%',
      maxWidth: 500,
      marginHorizontal: 8,
    },
    statsContainer: {
      gap: 16,
      paddingHorizontal: 32,
    },
    modalContainer: {
      marginHorizontal: '30%',
      maxWidth: 700,
    },
    searchBar: {
      maxWidth: 600,
    },
  },

  // Large Desktop (> 1600px)
  '@media (min-width: 1601px)': {
    itemCard: {
      width: '31%',
      maxWidth: 450,
    },
    modalContainer: {
      maxWidth: 800,
    },
  },
  listItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },

  detailText: {
    fontSize: 12,
    color: '#495057',
    flex: 1,
  },

  culturesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },

  culturesGridItem: {
    alignItems: 'center',
    flex: 1,
  },

  culturesLabel: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  culturesValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
    marginTop: 4,
  },

  culturesDetails: {
    gap: 8,
  },

  quickActionButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2E86C1',
  },

  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexWrap: 'wrap',
  },

  quickActionsDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 16,
  },
  photoPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4E6F1',
    gap: 6,
  },
  photoPickerText: {
    color: '#2E86C1',
    fontSize: 13,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  photoPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E8EE',
  },
  animalPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removePhotoIcon: {
    position: 'absolute',
    top: -12,
    right: -12,
    margin: 0,
  },
  errorTextSmall: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 4,
  }
});

export default FlotteAgricultureElevageScreen;
