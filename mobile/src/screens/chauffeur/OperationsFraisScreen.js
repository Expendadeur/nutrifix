// mobile/src/screens/chauffeur/OperationsFraisScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Text,
    Alert,
    Image,
    Modal,
    useWindowDimensions,
    Platform,
    ActivityIndicator,
    KeyboardAvoidingView
} from 'react-native';
import { TextInput, Button, Chip, Portal, Divider, Badge, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration API
const API_BASE_URL = Platform.select({
    web: process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com',
    default: 'https://nutrifix-1-twdf.onrender.com'
});

// Types d'opérations (ÉTENDU pour inclure Salaire)
const OPERATIONS_TYPES = [
    { id: 'sortie', label: 'Sortie Mission', icon: 'logout', color: '#2E86C1' },
    { id: 'retour', label: 'Retour Mission', icon: 'login', color: '#2ECC71' },
    { id: 'salaire', label: 'Mon Salaire', icon: 'account-balance-wallet', color: '#9B59B6' },
];

// Types de frais (COMPLET selon la route backend)
const FRAIS_TYPES = [
    { value: 'carburant', label: 'Carburant', icon: 'local-gas-station', color: '#E74C3C', requiresQuantity: true },
    { value: 'peage', label: 'Péage', icon: 'toll', color: '#3498DB', requiresQuantity: false },
    { value: 'parking', label: 'Parking', icon: 'local-parking', color: '#9B59B6', requiresQuantity: false },
    { value: 'reparation', label: 'Réparation', icon: 'build', color: '#F39C12', requiresQuantity: false },
    { value: 'versement_journalier', label: 'Versement Journalier', icon: 'payments', color: '#27AE60', requiresQuantity: false },
    { value: 'autre', label: 'Autre', icon: 'more-horiz', color: '#7F8C8D', requiresQuantity: false },
];

// Modes de paiement
const PAYMENT_METHODS = [
    { value: 'especes', label: 'Espèces', icon: 'money' },
    { value: 'carte', label: 'Carte Bancaire', icon: 'credit-card' },
    { value: 'mobile_money', label: 'Mobile Money', icon: 'phone-android' },
    { value: 'virement', label: 'Virement', icon: 'account-balance' },
];

const OperationsFraisScreen = ({ navigation }) => {
    const windowDimensions = useWindowDimensions();

    // ============================================
    // ÉTATS OPÉRATIONS
    // ============================================
    const [operationType, setOperationType] = useState('sortie');
    const [destination, setDestination] = useState('');
    const [motif, setMotif] = useState('');
    const [passagers, setPassagers] = useState('');
    const [marchandise, setMarchandise] = useState('');
    const [kilometrageDepart, setKilometrageDepart] = useState('');
    const [kilometrageRetour, setKilometrageRetour] = useState('');
    const [observationsLivraison, setObservationsLivraison] = useState('');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationAddress, setLocationAddress] = useState('');

    // ============================================
    // ÉTATS FRAIS
    // ============================================
    const [fraisType, setFraisType] = useState('');
    const [montant, setMontant] = useState('');
    const [dateFrais, setDateFrais] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [descriptionFrais, setDescriptionFrais] = useState('');
    const [idMouvement, setIdMouvement] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('especes');
    const [quantiteCarburant, setQuantiteCarburant] = useState('');
    const [justificatifs, setJustificatifs] = useState([]);

    // ============================================
    // ÉTATS SALAIRE
    // ============================================
    const [currentSalary, setCurrentSalary] = useState(null);
    const [paymentRequests, setPaymentRequests] = useState([]);
    const [loadingSalary, setLoadingSalary] = useState(false);
    const [loadingPaymentRequests, setLoadingPaymentRequests] = useState(false);
    const [requestingPayment, setRequestingPayment] = useState(false);
    const [confirmingReception, setConfirmingReception] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [showCodeInput, setShowCodeInput] = useState(false);

    // États UI
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [submittingOperation, setSubmittingOperation] = useState(false);
    const [submittingFrais, setSubmittingFrais] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);

    // Données
    const [vehicle, setVehicle] = useState(null);
    const [currentMission, setCurrentMission] = useState(null);
    const [authToken, setAuthToken] = useState(null);

    // Modal
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState(null);

    // Validation errors
    const [operationErrors, setOperationErrors] = useState({});
    const [fraisErrors, setFraisErrors] = useState({});
    const [salaryErrors, setSalaryErrors] = useState({});

    // ============================================
    // RESPONSIVE
    // ============================================
    const getDeviceType = useCallback(() => {
        const width = windowDimensions.width;
        if (width < 640) return 'mobile';
        if (width < 768) return 'mobileLarge';
        if (width < 1024) return 'tablet';
        if (width < 1280) return 'laptop';
        if (width < 1920) return 'desktop';
        return 'desktopLarge';
    }, [windowDimensions.width]);

    const deviceType = getDeviceType();
    const isMobile = deviceType === 'mobile' || deviceType === 'mobileLarge';
    const isTablet = deviceType === 'tablet';
    const isLargeScreen = deviceType === 'laptop' || deviceType === 'desktop' || deviceType === 'desktopLarge';

    const getResponsiveValue = useCallback((values) => {
        const {
            mobile = 15,
            mobileLarge = 18,
            tablet = 20,
            laptop = 25,
            desktop = 30,
            desktopLarge = 35
        } = values;

        switch (deviceType) {
            case 'mobile': return mobile;
            case 'mobileLarge': return mobileLarge;
            case 'tablet': return tablet;
            case 'laptop': return laptop;
            case 'desktop': return desktop;
            case 'desktopLarge': return desktopLarge;
            default: return mobile;
        }
    }, [deviceType]);

    const containerPadding = getResponsiveValue({
        mobile: 10,
        tablet: 15,
        laptop: 20,
        desktop: 25
    });

    const fontSize = {
        title: getResponsiveValue({ mobile: 18, tablet: 20, laptop: 22, desktop: 24 }),
        subtitle: getResponsiveValue({ mobile: 16, tablet: 17, laptop: 18, desktop: 19 }),
        body: getResponsiveValue({ mobile: 14, tablet: 15, laptop: 15, desktop: 16 }),
        small: getResponsiveValue({ mobile: 12, tablet: 13, laptop: 13, desktop: 14 }),
        tiny: getResponsiveValue({ mobile: 11, tablet: 11, laptop: 12, desktop: 12 })
    };

    const iconSize = {
        small: getResponsiveValue({ mobile: 16, tablet: 18, laptop: 20, desktop: 20 }),
        medium: getResponsiveValue({ mobile: 20, tablet: 22, laptop: 24, desktop: 24 }),
        large: getResponsiveValue({ mobile: 24, tablet: 28, laptop: 30, desktop: 32 })
    };

    // ============================================
    // API HELPERS
    // ============================================
    const getAuthToken = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            setAuthToken(token);
            return token;
        } catch (error) {
            console.error('Get token error:', error);
            return null;
        }
    };

    const apiCall = async (endpoint, method = 'GET', data = null, isFormData = false) => {
        try {
            const token = authToken || await getAuthToken();

            if (!token) {
                throw new Error('Token d\'authentification manquant');
            }

            const config = {
                method,
                url: `${API_BASE_URL}/api/chauffeur${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            };

            if (isFormData) {
                config.headers['Content-Type'] = 'multipart/form-data';
                config.data = data;
            } else {
                config.headers['Content-Type'] = 'application/json';
                if (data && (method === 'POST' || method === 'PUT')) {
                    config.data = data;
                }
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);

            if (error.response?.status === 401) {
                await AsyncStorage.removeItem('authToken');
                if (navigation) {
                    navigation.replace('Login');
                }
            }

            throw error;
        }
    };

    // ============================================
    // EFFETS
    // ============================================
    useEffect(() => {
        initializeScreen();
    }, []);

    useEffect(() => {
        if (currentMission) {
            setOperationType('retour');
            setKilometrageDepart(currentMission.kilometrage_depart?.toString() || '');
            setDestination(currentMission.destination || '');
            setMotif(currentMission.motif || '');
        }
    }, [currentMission]);

    useEffect(() => {
        if (operationType === 'salaire') {
            loadSalaryData();
            loadPaymentRequests();
        }
    }, [operationType]);

    const initializeScreen = async () => {
        await getAuthToken();
        await Promise.all([
            loadVehicleAndMission(),
            getCurrentLocation()
        ]);
    };

    // ============================================
    // CHARGEMENT DONNÉES
    // ============================================
    const loadVehicleAndMission = async () => {
        setLoadingData(true);
        try {
            const [vehicleResult, missionResult] = await Promise.allSettled([
                apiCall('/vehicle'),
                apiCall('/missions/current')
            ]);

            if (vehicleResult.status === 'fulfilled' && vehicleResult.value.success) {
                const vehicleData = vehicleResult.value.data;
                setVehicle(vehicleData);
                if (vehicleData && vehicleData.kilometrage_actuel) {
                    setKilometrageDepart(vehicleData.kilometrage_actuel.toString());
                }
            }

            if (missionResult.status === 'fulfilled' && missionResult.value.success) {
                setCurrentMission(missionResult.value.data);
            }
        } catch (error) {
            console.error('Load data error:', error);
            Alert.alert('Erreur', 'Impossible de charger les données');
        } finally {
            setLoadingData(false);
        }
    };

    const getCurrentLocation = async () => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                    timeout: 10000
                });

                setCurrentLocation(location.coords);

                // Reverse geocoding
                try {
                    const addresses = await Location.reverseGeocodeAsync({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    });

                    if (addresses && addresses.length > 0) {
                        const addr = addresses[0];
                        const parts = [addr.street, addr.city, addr.region].filter(Boolean);
                        setLocationAddress(parts.join(', '));
                    }
                } catch (geoError) {
                    console.error('Geocoding error:', geoError);
                }
            }
        } catch (error) {
            console.error('Location error:', error);
        } finally {
            setLoadingLocation(false);
        }
    };

    // ============================================
    // CHARGEMENT DONNÉES SALAIRE
    // ============================================
    const loadSalaryData = async () => {
        setLoadingSalary(true);
        try {
            const result = await apiCall('/salary/current');
            if (result.success) {
                setCurrentSalary(result.data);
            } else {
                setCurrentSalary(null);
            }
        } catch (error) {
            console.error('Load salary error:', error);
            Alert.alert('Erreur', 'Impossible de charger les informations salariales');
        } finally {
            setLoadingSalary(false);
        }
    };

    const loadPaymentRequests = async () => {
        setLoadingPaymentRequests(true);
        try {
            const result = await apiCall('/salary/payment-requests?limit=10');
            if (result.success) {
                setPaymentRequests(result.data);
            }
        } catch (error) {
            console.error('Load payment requests error:', error);
        } finally {
            setLoadingPaymentRequests(false);
        }
    };

    // ============================================
    // ACTIONS SALAIRE
    // ============================================
    const handleRequestPayment = async () => {
        if (!currentSalary) {
            Alert.alert('Erreur', 'Aucun salaire à demander');
            return;
        }

        if (currentSalary.infos_paiement.statut === 'payé') {
            Alert.alert('Information', 'Ce salaire a déjà été payé');
            return;
        }

        // Vérifier s'il y a déjà une demande en attente
        const hasPendingRequest = paymentRequests.some(req => req.statut === 'en_attente');
        if (hasPendingRequest) {
            Alert.alert('Information', 'Vous avez déjà une demande de paiement en attente');
            return;
        }

        Alert.alert(
            'Demande de Paiement',
            `Voulez-vous demander le paiement de votre salaire de ${getMonthName(currentSalary.mois)} ${currentSalary.annee} ?\n\nMontant: ${formatCurrency(currentSalary.details.net.montant)}`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: async () => {
                        setRequestingPayment(true);
                        try {
                            const result = await apiCall('/salary/request-payment', 'POST');

                            if (result.success) {
                                Alert.alert(
                                    'Succès',
                                    'Votre demande de paiement a été soumise avec succès',
                                    [{ text: 'OK', onPress: () => loadPaymentRequests() }]
                                );
                            } else {
                                Alert.alert('Erreur', result.message || 'Impossible de soumettre la demande');
                            }
                        } catch (error) {
                            console.error('Request payment error:', error);
                            Alert.alert(
                                'Erreur',
                                error.response?.data?.message || 'Une erreur est survenue'
                            );
                        } finally {
                            setRequestingPayment(false);
                        }
                    }
                }
            ]
        );
    };

    const handleConfirmReception = async () => {
        if (!currentSalary) {
            Alert.alert('Erreur', 'Aucun salaire à confirmer');
            return;
        }

        if (currentSalary.infos_paiement.statut !== 'payé') {
            Alert.alert('Information', 'Ce salaire n\'a pas encore été payé');
            return;
        }

        if (currentSalary.confirmation?.confirme) {
            Alert.alert('Information', 'Vous avez déjà confirmé la réception de ce salaire');
            return;
        }

        // Demander le code de vérification
        setConfirmingReception(true);
        try {
            const result = await apiCall('/salary/request-code', 'POST');
            if (result.success) {
                setShowCodeInput(true);
                Alert.alert('Code Envoyé', 'Un code de vérification a été envoyé à votre email');
            } else {
                Alert.alert('Erreur', result.message || 'Impossible d\'envoyer le code');
            }
        } catch (error) {
            console.error('Request code error:', error);
            Alert.alert('Erreur', 'Impossible de demander le code de vérification');
        } finally {
            setConfirmingReception(false);
        }
    };

    const submitConfirmReception = async () => {
        if (!verificationCode.trim() || verificationCode.trim().length < 4) {
            Alert.alert('Erreur', 'Veuillez entrer un code de vérification valide');
            return;
        }

        setConfirmingReception(true);
        try {
            const data = { code_verification: verificationCode.trim() };
            const result = await apiCall('/salary/confirm-reception', 'POST', data);

            if (result.success) {
                Alert.alert(
                    'Succès',
                    'Réception de salaire confirmée avec succès',
                    [{
                        text: 'OK',
                        onPress: () => {
                            setShowCodeInput(false);
                            setVerificationCode('');
                            loadSalaryData();
                        }
                    }]
                );
            } else {
                if (result.message && result.message.includes('bloqué')) {
                    Alert.alert('Compte Bloqué', result.message, [
                        { text: 'OK', onPress: () => navigation.replace('Login') }
                    ]);
                } else {
                    Alert.alert('Erreur', result.message || 'Impossible de confirmer la réception');
                }
            }
        } catch (error) {
            console.error('Confirm reception error:', error);
            const errorMsg = error.response?.data?.message || 'Une erreur est survenue';
            if (errorMsg.includes('bloqué')) {
                Alert.alert('Compte Bloqué', errorMsg, [
                    { text: 'OK', onPress: () => navigation.replace('Login') }
                ]);
            } else {
                Alert.alert('Erreur', errorMsg);
            }
        } finally {
            setConfirmingReception(false);
        }
    };

    // ============================================
    // VALIDATION OPÉRATIONS (INCHANGÉ)
    // ============================================
    const validateSortie = () => {
        const errors = {};

        if (!destination.trim()) {
            errors.destination = 'Destination requise';
        }

        if (!motif.trim()) {
            errors.motif = 'Motif requis';
        }

        if (!kilometrageDepart || parseFloat(kilometrageDepart) <= 0) {
            errors.kilometrageDepart = 'Kilométrage invalide';
        }

        if (vehicle && parseFloat(kilometrageDepart) < vehicle.kilometrage_actuel) {
            errors.kilometrageDepart = 'Le kilométrage ne peut pas être inférieur au kilométrage actuel du véhicule';
        }

        setOperationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateRetour = () => {
        const errors = {};

        if (!kilometrageRetour || parseFloat(kilometrageRetour) <= 0) {
            errors.kilometrageRetour = 'Kilométrage de retour requis';
        }

        if (kilometrageDepart && kilometrageRetour) {
            if (parseFloat(kilometrageRetour) <= parseFloat(kilometrageDepart)) {
                errors.kilometrageRetour = 'Doit être supérieur au kilométrage de départ';
            }
        }

        setOperationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ============================================
    // SOUMISSION OPÉRATIONS (INCHANGÉ)
    // ============================================
    const handleSubmitSortie = async () => {
        if (!validateSortie()) {
            Alert.alert('Formulaire Incomplet', 'Veuillez corriger les erreurs');
            return;
        }

        setSubmittingOperation(true);
        try {
            const missionData = {
                destination: destination.trim(),
                motif: motif.trim(),
                passagers: passagers ? parseInt(passagers) : null,
                marchandise_transportee: marchandise.trim() || null,
                kilometrage_depart: parseFloat(kilometrageDepart)
            };

            const result = await apiCall('/missions/start', 'POST', missionData);

            if (result.success) {
                Alert.alert(
                    'Mission Démarrée',
                    `Mission vers ${destination} enregistrée avec succès`,
                    [{
                        text: 'OK',
                        onPress: () => {
                            resetOperationsForm();
                            loadVehicleAndMission();
                        }
                    }]
                );
            } else {
                Alert.alert('Erreur', result.message || 'Impossible d\'enregistrer la sortie');
            }
        } catch (error) {
            console.error('Submit sortie error:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Une erreur est survenue lors de l\'enregistrement'
            );
        } finally {
            setSubmittingOperation(false);
        }
    };

    const handleSubmitRetour = async () => {
        if (!validateRetour()) {
            Alert.alert('Formulaire Incomplet', 'Veuillez corriger les erreurs');
            return;
        }

        const kmParcourus = parseFloat(kilometrageRetour) - parseFloat(kilometrageDepart);

        setModalData({
            type: 'retour',
            title: 'Confirmer le Retour',
            message: `Distance parcourue: ${kmParcourus.toFixed(2)} km\n\nVoulez-vous terminer cette mission ?`,
            onConfirm: async () => {
                setSubmittingOperation(true);
                setConfirmModalVisible(false);

                try {
                    const retourData = {
                        id_mouvement: currentMission?.id,
                        kilometrage_retour: parseFloat(kilometrageRetour),
                        observations_livraison: observationsLivraison.trim() || null
                    };

                    const result = await apiCall('/missions/end', 'POST', retourData);

                    if (result.success) {
                        Alert.alert(
                            'Mission Terminée',
                            `Distance parcourue: ${kmParcourus.toFixed(2)} km`,
                            [{
                                text: 'OK',
                                onPress: () => {
                                    resetOperationsForm();
                                    loadVehicleAndMission();
                                }
                            }]
                        );
                    } else {
                        Alert.alert('Erreur', result.message || 'Impossible d\'enregistrer le retour');
                    }
                } catch (error) {
                    console.error('Submit retour error:', error);
                    Alert.alert(
                        'Erreur',
                        error.response?.data?.message || 'Une erreur est survenue'
                    );
                } finally {
                    setSubmittingOperation(false);
                }
            }
        });

        setConfirmModalVisible(true);
    };

    // ============================================
    // VALIDATION FRAIS (INCHANGÉ)
    // ============================================
    const validateFrais = () => {
        const errors = {};

        if (!fraisType) {
            errors.fraisType = 'Type de frais requis';
        }

        if (!montant || parseFloat(montant) <= 0) {
            errors.montant = 'Montant invalide';
        }

        if (!descriptionFrais.trim()) {
            errors.descriptionFrais = 'Description requise';
        }

        // Validation spécifique pour carburant
        if (fraisType === 'carburant') {
            if (!quantiteCarburant || parseFloat(quantiteCarburant) <= 0) {
                errors.quantiteCarburant = 'Quantité de carburant requise';
            }
        }

        // Justificatifs requis sauf pour versement journalier
        if (fraisType !== 'versement_journalier' && justificatifs.length === 0) {
            errors.justificatifs = 'Au moins un justificatif requis';
        }

        setFraisErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ============================================
    // SOUMISSION FRAIS (INCHANGÉ)
    // ============================================
    const handleSubmitFrais = async () => {
        if (!validateFrais()) {
            Alert.alert('Formulaire Incomplet', 'Veuillez corriger les erreurs');
            return;
        }

        setSubmittingFrais(true);
        try {
            // Créer FormData
            const formData = new FormData();
            formData.append('type_frais', fraisType);
            formData.append('montant', parseFloat(montant));
            formData.append('description', descriptionFrais.trim());
            formData.append('date', dateFrais.toISOString().split('T')[0]);

            if (idMouvement) {
                formData.append('id_mouvement', idMouvement);
            } else if (currentMission) {
                formData.append('id_mouvement', currentMission.id);
            }

            if (fraisType === 'carburant' && quantiteCarburant) {
                formData.append('quantite_carburant', parseFloat(quantiteCarburant));
            }

            // Ajouter justificatifs
            justificatifs.forEach((file, index) => {
                if (Platform.OS === 'web') {
                    formData.append('piece_justificative', file);
                } else {
                    formData.append('piece_justificative', {
                        uri: file.uri,
                        type: file.type,
                        name: file.name || `justificatif_${index}.jpg`
                    });
                }
            });

            const result = await apiCall('/expenses', 'POST', formData, true);

            if (result.success) {
                const typeLabel = FRAIS_TYPES.find(t => t.value === fraisType)?.label || fraisType;

                Alert.alert(
                    'Frais Enregistré',
                    `${typeLabel} de ${formatCurrency(parseFloat(montant))} soumis avec succès`,
                    [{ text: 'OK', onPress: resetFraisForm }]
                );
            } else {
                Alert.alert('Erreur', result.message || 'Impossible d\'enregistrer les frais');
            }
        } catch (error) {
            console.error('Submit frais error:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Une erreur est survenue lors de la soumission'
            );
        } finally {
            setSubmittingFrais(false);
        }
    };

    // ============================================
    // GESTION JUSTIFICATIFS (INCHANGÉ)
    // ============================================
    const pickImage = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Refusée', 'Accès à la galerie refusé');
                    return;
                }
            }

            setUploadingFiles(true);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: Platform.OS !== 'web',
                quality: 0.8,
                maxHeight: 1920,
                maxWidth: 1920,
            });

            if (!result.canceled) {
                const newAssets = result.assets || [result];
                const newFiles = newAssets.map((asset, index) => ({
                    uri: asset.uri,
                    name: `justificatif_${Date.now()}_${index}.jpg`,
                    type: 'image/jpeg',
                    fileType: 'image'
                }));

                setJustificatifs([...justificatifs, ...newFiles]);
                setFraisErrors(prev => ({ ...prev, justificatifs: null }));
            }
        } catch (error) {
            console.error('Pick image error:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        } finally {
            setUploadingFiles(false);
        }
    };

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            Alert.alert('Non Supporté', 'La caméra n\'est pas disponible sur le web');
            return;
        }

        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Refusée', 'Accès à la caméra refusé');
                return;
            }

            setUploadingFiles(true);
            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                maxHeight: 1920,
                maxWidth: 1920,
            });

            if (!result.canceled) {
                const newFile = {
                    uri: result.assets[0].uri,
                    name: `justificatif_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                    fileType: 'image'
                };

                setJustificatifs([...justificatifs, newFile]);
                setFraisErrors(prev => ({ ...prev, justificatifs: null }));
            }
        } catch (error) {
            console.error('Take photo error:', error);
            Alert.alert('Erreur', 'Impossible de prendre la photo');
        } finally {
            setUploadingFiles(false);
        }
    };

    const pickDocument = async () => {
        if (Platform.OS === 'web') {
            Alert.alert('Non Supporté', 'Sélection de documents limitée sur le web. Utilisez la galerie.');
            return;
        }

        try {
            setUploadingFiles(true);
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                multiple: true
            });

            if (!result.canceled) {
                const newFiles = result.assets.map(asset => ({
                    uri: asset.uri,
                    name: asset.name,
                    type: asset.mimeType,
                    fileType: asset.mimeType?.includes('pdf') ? 'pdf' : 'image'
                }));

                setJustificatifs([...justificatifs, ...newFiles]);
                setFraisErrors(prev => ({ ...prev, justificatifs: null }));
            }
        } catch (error) {
            console.error('Pick document error:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le document');
        } finally {
            setUploadingFiles(false);
        }
    };

    const removeJustificatif = (index) => {
        const newFiles = justificatifs.filter((_, i) => i !== index);
        setJustificatifs(newFiles);
    };

    const viewImage = (uri) => {
        setSelectedImageUri(uri);
        setImagePreviewVisible(true);
    };

    // ============================================
    // RESET FORMS
    // ============================================
    const resetOperationsForm = () => {
        setDestination('');
        setMotif('');
        setPassagers('');
        setMarchandise('');
        setKilometrageRetour('');
        setObservationsLivraison('');
        setOperationErrors({});
    };

    const resetFraisForm = () => {
        setFraisType('');
        setMontant('');
        setDateFrais(new Date());
        setDescriptionFrais('');
        setIdMouvement('');
        setPaymentMethod('especes');
        setQuantiteCarburant('');
        setJustificatifs([]);
        setFraisErrors({});
    };

    // ============================================
    // HELPERS
    // ============================================
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-BI', {
            style: 'currency',
            currency: 'BIF',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('fr-FR').format(num || 0);
    };

    const getMonthName = (month) => {
        const months = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        return months[month - 1] || '';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'payé': return '#27AE60';
            case 'en_attente': return '#F39C12';
            case 'approuvé': return '#3498DB';
            case 'rejeté': return '#E74C3C';
            default: return '#7F8C8D';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'payé': return 'Payé';
            case 'en_attente': return 'En attente';
            case 'approuvé': return 'Approuvé';
            case 'rejeté': return 'Rejeté';
            default: return status;
        }
    };

    // ============================================
    // RENDU OPÉRATIONS (INCHANGÉ)
    // ============================================
    const renderOperationsPanel = () => (
        <View style={[
            styles.panel,
            {
                padding: containerPadding,
                flex: isMobile ? 1 : 0.5
            }
        ]}>
            <Text style={[styles.panelTitle, { fontSize: fontSize.title }]}>
                📋 Opérations Quotidiennes
            </Text>

            {loadingData ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2E86C1" />
                    <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                        Chargement...
                    </Text>
                </View>
            ) : (
                <>
                    {/* Sélecteur Type */}
                    <View style={[
                        styles.typeSelector,
                        { flexDirection: isMobile ? 'column' : 'row' }
                    ]}>
                        {OPERATIONS_TYPES.map(type => (
                            <TouchableOpacity
                                key={type.id}
                                style={[
                                    styles.typeButton,
                                    {
                                        backgroundColor: operationType === type.id ? type.color : '#FFF',
                                        borderColor: type.color,
                                        marginBottom: isMobile ? 10 : 0,
                                        flex: isMobile ? 0 : 1,
                                        opacity: (type.id === 'retour' && !currentMission) ? 0.5 : 1
                                    }
                                ]}
                                onPress={() => setOperationType(type.id)}
                                disabled={type.id === 'retour' && !currentMission}
                            >
                                <MaterialIcons
                                    name={type.icon}
                                    size={iconSize.medium}
                                    color={operationType === type.id ? '#FFF' : type.color}
                                />
                                <Text style={[
                                    styles.typeButtonText,
                                    {
                                        fontSize: fontSize.small,
                                        color: operationType === type.id ? '#FFF' : '#2C3E50'
                                    }
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={styles.panelContent}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        {operationType === 'sortie' ? (
                            <>
                                {/* Véhicule info */}
                                {vehicle && (
                                    <View style={styles.vehicleInfo}>
                                        <MaterialIcons name="directions-car" size={iconSize.medium} color="#2E86C1" />
                                        <View style={styles.vehicleInfoContent}>
                                            <Text style={[styles.vehicleInfoText, { fontSize: fontSize.body }]}>
                                                {vehicle.immatriculation}
                                            </Text>
                                            <Text style={[styles.vehicleInfoSubtext, { fontSize: fontSize.small }]}>
                                                {vehicle.marque} {vehicle.modele}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <TextInput
                                    label="Destination *"
                                    value={destination}
                                    onChangeText={(text) => {
                                        setDestination(text);
                                        setOperationErrors(prev => ({ ...prev, destination: null }));
                                    }}
                                    mode="outlined"
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="location-on" />}
                                    error={!!operationErrors.destination}
                                />
                                {operationErrors.destination && (
                                    <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                        {operationErrors.destination}
                                    </Text>
                                )}

                                <TextInput
                                    label="Motif *"
                                    value={motif}
                                    onChangeText={(text) => {
                                        setMotif(text);
                                        setOperationErrors(prev => ({ ...prev, motif: null }));
                                    }}
                                    mode="outlined"
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="description" />}
                                    error={!!operationErrors.motif}
                                />
                                {operationErrors.motif && (
                                    <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                        {operationErrors.motif}
                                    </Text>
                                )}

                                <TextInput
                                    label="Nombre de passagers"
                                    value={passagers}
                                    onChangeText={setPassagers}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="people" />}
                                />

                                <TextInput
                                    label="Marchandise transportée"
                                    value={marchandise}
                                    onChangeText={setMarchandise}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={2}
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="inventory" />}
                                />

                                <TextInput
                                    label="Kilométrage Départ *"
                                    value={kilometrageDepart}
                                    onChangeText={(text) => {
                                        setKilometrageDepart(text);
                                        setOperationErrors(prev => ({ ...prev, kilometrageDepart: null }));
                                    }}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="speed" />}
                                    error={!!operationErrors.kilometrageDepart}
                                />
                                {operationErrors.kilometrageDepart && (
                                    <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                        {operationErrors.kilometrageDepart}
                                    </Text>
                                )}

                                {loadingLocation && (
                                    <View style={styles.locationLoading}>
                                        <ActivityIndicator size="small" color="#2E86C1" />
                                        <Text style={[styles.locationLoadingText, { fontSize: fontSize.small }]}>
                                            Récupération de votre position...
                                        </Text>
                                    </View>
                                )}

                                {currentLocation && !loadingLocation && (
                                    <View style={styles.locationInfo}>
                                        <MaterialIcons name="my-location" size={iconSize.small} color="#27AE60" />
                                        <Text style={[styles.locationText, { fontSize: fontSize.tiny }]}>
                                            📍 {locationAddress || 'Position GPS enregistrée'}
                                        </Text>
                                    </View>
                                )}

                                <Button
                                    mode="contained"
                                    onPress={handleSubmitSortie}
                                    loading={submittingOperation}
                                    disabled={submittingOperation}
                                    style={styles.submitButton}
                                    buttonColor="#2E86C1"
                                    icon="logout"
                                    labelStyle={{ fontSize: fontSize.body }}
                                >
                                    {submittingOperation ? 'Enregistrement...' : 'Enregistrer Sortie'}
                                </Button>
                            </>
                        ) : operationType === 'retour' ? (
                            <>
                                {/* Mission en cours */}
                                {currentMission && (
                                    <View style={styles.missionInfo}>
                                        <View style={styles.missionInfoHeader}>
                                            <MaterialIcons name="assignment" size={iconSize.medium} color="#2E86C1" />
                                            <Text style={[styles.missionInfoTitle, { fontSize: fontSize.subtitle }]}>
                                                Mission en cours
                                            </Text>
                                        </View>
                                        <Divider style={styles.divider} />
                                        <View style={styles.missionInfoContent}>
                                            <View style={styles.missionInfoRow}>
                                                <MaterialIcons name="location-on" size={iconSize.small} color="#E74C3C" />
                                                <Text style={[styles.missionInfoText, { fontSize: fontSize.body }]}>
                                                    {currentMission.destination}
                                                </Text>
                                            </View>
                                            <View style={styles.missionInfoRow}>
                                                <MaterialIcons name="access-time" size={iconSize.small} color="#7F8C8D" />
                                                <Text style={[styles.missionInfoText, { fontSize: fontSize.small }]}>
                                                    Départ: {currentMission.heure_depart}
                                                </Text>
                                            </View>
                                            <View style={styles.missionInfoRow}>
                                                <MaterialIcons name="speed" size={iconSize.small} color="#3498DB" />
                                                <Text style={[styles.missionInfoText, { fontSize: fontSize.small }]}>
                                                    KM départ: {formatNumber(currentMission.kilometrage_depart)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                <TextInput
                                    label="Kilométrage Retour *"
                                    value={kilometrageRetour}
                                    onChangeText={(text) => {
                                        setKilometrageRetour(text);
                                        setOperationErrors(prev => ({ ...prev, kilometrageRetour: null }));
                                    }}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="speed" />}
                                    error={!!operationErrors.kilometrageRetour}
                                />
                                {operationErrors.kilometrageRetour && (
                                    <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                        {operationErrors.kilometrageRetour}
                                    </Text>
                                )}

                                {kilometrageRetour && kilometrageDepart && parseFloat(kilometrageRetour) > parseFloat(kilometrageDepart) && (
                                    <View style={styles.kmInfo}>
                                        <MaterialIcons name="trending-up" size={iconSize.medium} color="#27AE60" />
                                        <View style={styles.kmInfoContent}>
                                            <Text style={[styles.kmInfoLabel, { fontSize: fontSize.small }]}>
                                                Distance parcourue
                                            </Text>
                                            <Text style={[styles.kmInfoValue, { fontSize: fontSize.title }]}>
                                                {(parseFloat(kilometrageRetour) - parseFloat(kilometrageDepart)).toFixed(2)} km
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <TextInput
                                    label="Observations de livraison (optionnel)"
                                    value={observationsLivraison}
                                    onChangeText={setObservationsLivraison}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={3}
                                    style={[styles.input, { fontSize: fontSize.body }]}
                                    left={<TextInput.Icon icon="note" />}
                                />

                                <Button
                                    mode="contained"
                                    onPress={handleSubmitRetour}
                                    loading={submittingOperation}
                                    disabled={submittingOperation || !currentMission}
                                    style={styles.submitButton}
                                    buttonColor="#2ECC71"
                                    icon="login"
                                    labelStyle={{ fontSize: fontSize.body }}
                                >
                                    {submittingOperation ? 'Enregistrement...' : 'Enregistrer Retour'}
                                </Button>

                                {!currentMission && (
                                    <View style={styles.noMissionWarning}>
                                        <MaterialIcons name="info" size={iconSize.medium} color="#F39C12" />
                                        <Text style={[styles.noMissionText, { fontSize: fontSize.small }]}>
                                            Aucune mission en cours. Démarrez d'abord une sortie.
                                        </Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            // NOUVEAU: PANEL SALAIRE
                            renderSalaryContent()
                        )}
                    </ScrollView>
                </>
            )}
        </View>
    );

    // ============================================
    // RENDU SALAIRE (NOUVEAU)
    // ============================================
    const renderSalaryContent = () => (
        <>
            {loadingSalary ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9B59B6" />
                    <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                        Chargement des données salariales...
                    </Text>
                </View>
            ) : currentSalary ? (
                <>
                    {/* Carte Salaire Actuel */}
                    <Card style={styles.salaryCard}>
                        <Card.Content>
                            <View style={styles.salaryHeader}>
                                <View>
                                    <Text style={[styles.salaryMonth, { fontSize: fontSize.subtitle }]}>
                                        {getMonthName(currentSalary.mois)} {currentSalary.annee}
                                    </Text>
                                    <Text style={[styles.salaryDepartment, { fontSize: fontSize.tiny }]}>
                                        {currentSalary.employe.departement}
                                    </Text>
                                </View>
                                <Badge
                                    style={[
                                        styles.salaryBadge,
                                        { backgroundColor: getStatusColor(currentSalary.infos_paiement.statut) }
                                    ]}
                                >
                                    {getStatusLabel(currentSalary.infos_paiement.statut)}
                                </Badge>
                            </View>

                            <Divider style={styles.salaryDivider} />

                            {/* Montants */}
                            <View style={styles.salaryAmounts}>
                                <View style={styles.salaryAmountItem}>
                                    <Text style={[styles.salaryAmountLabel, { fontSize: fontSize.small }]}>
                                        Salaire Brut
                                    </Text>
                                    <Text style={[styles.salaryAmountValue, { fontSize: fontSize.body }]}>
                                        {formatCurrency(currentSalary.details.brut.total)}
                                    </Text>
                                </View>

                                <View style={styles.salaryAmountItem}>
                                    <Text style={[styles.salaryAmountLabel, { fontSize: fontSize.small }]}>
                                        Déductions
                                    </Text>
                                    <Text style={[styles.salaryAmountDeduction, { fontSize: fontSize.body }]}>
                                        -{formatCurrency(currentSalary.details.deductions.total)}
                                    </Text>
                                </View>

                                <View style={styles.salaryAmountItem}>
                                    <Text style={[styles.salaryAmountLabel, { fontSize: fontSize.small, fontWeight: '700' }]}>
                                        Salaire Net
                                    </Text>
                                    <Text style={[styles.salaryAmountNet, { fontSize: fontSize.title }]}>
                                        {formatCurrency(currentSalary.details.net.montant)}
                                    </Text>
                                </View>
                            </View>

                            <Divider style={styles.salaryDivider} />

                            {/* Détails Paiement */}
                            <View style={styles.salaryPaymentInfo}>
                                <View style={styles.salaryPaymentRow}>
                                    <MaterialIcons name="payment" size={iconSize.small} color="#7F8C8D" />
                                    <Text style={[styles.salaryPaymentText, { fontSize: fontSize.small }]}>
                                        {currentSalary.details.net.mode_paiement || 'Non défini'}
                                    </Text>
                                </View>

                                {currentSalary.details.net.date_paiement && (
                                    <View style={styles.salaryPaymentRow}>
                                        <MaterialIcons name="event" size={iconSize.small} color="#7F8C8D" />
                                        <Text style={[styles.salaryPaymentText, { fontSize: fontSize.small }]}>
                                            Payé le: {new Date(currentSalary.details.net.date_paiement).toLocaleDateString('fr-FR')}
                                        </Text>
                                    </View>
                                )}

                                {currentSalary.details.net.reference && (
                                    <View style={styles.salaryPaymentRow}>
                                        <MaterialIcons name="receipt" size={iconSize.small} color="#7F8C8D" />
                                        <Text style={[styles.salaryPaymentText, { fontSize: fontSize.small }]}>
                                            Réf: {currentSalary.details.net.reference}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Alerte Retard */}
                            {currentSalary.infos_paiement.en_retard && (
                                <View style={styles.salaryAlert}>
                                    <MaterialIcons name="warning" size={iconSize.medium} color="#E74C3C" />
                                    <Text style={[styles.salaryAlertText, { fontSize: fontSize.small }]}>
                                        Paiement en retard depuis le {new Date(currentSalary.infos_paiement.date_limite).toLocaleDateString('fr-FR')}
                                    </Text>
                                </View>
                            )}

                            {/* Boutons Actions */}
                            <View style={styles.salaryActions}>
                                {currentSalary.infos_paiement.statut !== 'payé' && (
                                    <Button
                                        mode="contained"
                                        onPress={handleRequestPayment}
                                        loading={requestingPayment}
                                        disabled={requestingPayment}
                                        style={[styles.salaryActionButton, { flex: 1 }]}
                                        buttonColor="#3498DB"
                                        icon="send"
                                        labelStyle={{ fontSize: fontSize.small }}
                                    >
                                        Demander Paiement
                                    </Button>
                                )}

                                {currentSalary.infos_paiement.statut === 'payé' && !currentSalary.confirmation?.confirme && (
                                    <Button
                                        mode="contained"
                                        onPress={handleConfirmReception}
                                        style={[styles.salaryActionButton, { flex: 1 }]}
                                        buttonColor="#27AE60"
                                        icon="check-circle"
                                        labelStyle={{ fontSize: fontSize.small }}
                                    >
                                        Confirmer Réception
                                    </Button>
                                )}

                                {currentSalary.confirmation?.confirme && (
                                    <View style={styles.salaryConfirmed}>
                                        <MaterialIcons name="check-circle" size={iconSize.medium} color="#27AE60" />
                                        <Text style={[styles.salaryConfirmedText, { fontSize: fontSize.small }]}>
                                            Réception confirmée le {new Date(currentSalary.confirmation.date_confirmation).toLocaleDateString('fr-FR')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </Card.Content>
                    </Card>

                    {/* Modal Code Vérification */}
                    {showCodeInput && (
                        <View style={styles.codeInputContainer}>
                            <Text style={[styles.codeInputLabel, { fontSize: fontSize.body }]}>
                                Code de vérification
                            </Text>
                            <Text style={[styles.codeInputHint, { fontSize: fontSize.tiny }]}>
                                Veuillez entrer le code de vérification envoyé sur votre email
                            </Text>

                            <TextInput
                                label="Code de vérification"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                mode="outlined"
                                keyboardType="number-pad"
                                maxLength={6}
                                style={[styles.input, { fontSize: fontSize.body }]}
                                left={<TextInput.Icon icon="lock" />}
                            />

                            <View style={styles.codeInputButtons}>
                                <Button
                                    mode="outlined"
                                    onPress={() => {
                                        setShowCodeInput(false);
                                        setVerificationCode('');
                                    }}
                                    style={{ flex: 1 }}
                                    labelStyle={{ fontSize: fontSize.small }}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={submitConfirmReception}
                                    loading={confirmingReception}
                                    disabled={confirmingReception}
                                    style={{ flex: 1 }}
                                    buttonColor="#27AE60"
                                    labelStyle={{ fontSize: fontSize.small }}
                                >
                                    {confirmingReception ? 'Confirmation...' : 'Confirmer'}
                                </Button>
                            </View>
                        </View>
                    )}

                    {/* Historique Demandes Paiement */}
                    {paymentRequests.length > 0 && (
                        <>
                            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle, marginTop: 20 }]}>
                                Mes Demandes de Paiement
                            </Text>

                            {loadingPaymentRequests ? (
                                <ActivityIndicator size="small" color="#9B59B6" style={{ marginVertical: 10 }} />
                            ) : (
                                paymentRequests.map((request, index) => (
                                    <Card key={request.id} style={[styles.requestCard, { marginBottom: 10 }]}>
                                        <Card.Content>
                                            <View style={styles.requestHeader}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.requestMonth, { fontSize: fontSize.body }]}>
                                                        {request.nom_mois} {request.annee}
                                                    </Text>
                                                    <Text style={[styles.requestDate, { fontSize: fontSize.tiny }]}>
                                                        Demandé le {new Date(request.date_demande).toLocaleDateString('fr-FR')}
                                                    </Text>
                                                </View>
                                                <Badge
                                                    style={[
                                                        styles.requestBadge,
                                                        { backgroundColor: getStatusColor(request.statut) }
                                                    ]}
                                                >
                                                    {getStatusLabel(request.statut)}
                                                </Badge>
                                            </View>

                                            <Text style={[styles.requestAmount, { fontSize: fontSize.subtitle }]}>
                                                {formatCurrency(request.montant)}
                                            </Text>

                                            {request.statut === 'rejeté' && request.motif_rejet && (
                                                <View style={styles.requestReject}>
                                                    <MaterialIcons name="error" size={iconSize.small} color="#E74C3C" />
                                                    <Text style={[styles.requestRejectText, { fontSize: fontSize.tiny }]}>
                                                        {request.motif_rejet}
                                                    </Text>
                                                </View>
                                            )}

                                            {request.date_traitement && (
                                                <Text style={[styles.requestProcessed, { fontSize: fontSize.tiny }]}>
                                                    Traité le {new Date(request.date_traitement).toLocaleDateString('fr-FR')}
                                                    {request.traite_par_nom && ` par ${request.traite_par_nom}`}
                                                </Text>
                                            )}
                                        </Card.Content>
                                    </Card>
                                ))
                            )}
                        </>
                    )}
                </>
            ) : (
                <View style={styles.noSalaryContainer}>
                    <MaterialIcons name="account-balance-wallet" size={iconSize.large * 2} color="#BDC3C7" />
                    <Text style={[styles.noSalaryText, { fontSize: fontSize.body }]}>
                        Aucun salaire calculé pour ce mois
                    </Text>
                    <Text style={[styles.noSalaryHint, { fontSize: fontSize.small }]}>
                        Votre salaire sera disponible après le calcul mensuel
                    </Text>
                </View>
            )}
        </>
    );

    // ============================================
    // RENDU FRAIS (INCHANGÉ - code existant)
    // ============================================
    const renderFraisPanel = () => {
        const selectedFraisType = FRAIS_TYPES.find(t => t.value === fraisType);

        return (
            <View style={[
                styles.panel,
                {
                    padding: containerPadding,
                    flex: isMobile ? 1 : 0.5
                }
            ]}>
                <Text style={[styles.panelTitle, { fontSize: fontSize.title }]}>
                    💰 Frais et Dépenses
                </Text>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={styles.panelContent}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {/* Type de frais */}
                    <Text style={[styles.sectionLabel, { fontSize: fontSize.subtitle }]}>
                        Type de frais *
                    </Text>
                    <View style={styles.fraisTypeGrid}>
                        {FRAIS_TYPES.map(type => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.fraisTypeCard,
                                    {
                                        width: isMobile ? '48%' : '31%',
                                        backgroundColor: fraisType === type.value ? type.color : '#FFF',
                                        borderColor: fraisType === type.value ? type.color : '#E8EAED'
                                    }
                                ]}
                                onPress={() => {
                                    setFraisType(type.value);
                                    setFraisErrors(prev => ({ ...prev, fraisType: null }));
                                }}
                            >
                                <MaterialIcons
                                    name={type.icon}
                                    size={iconSize.medium}
                                    color={fraisType === type.value ? '#FFF' : type.color}
                                />
                                <Text style={[
                                    styles.fraisTypeLabel,
                                    {
                                        fontSize: fontSize.tiny,
                                        color: fraisType === type.value ? '#FFF' : '#2C3E50'
                                    }
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {fraisErrors.fraisType && (
                        <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                            {fraisErrors.fraisType}
                        </Text>
                    )}

                    {/* Info spéciale pour versement journalier */}
                    {fraisType === 'versement_journalier' && (
                        <View style={styles.infoBox}>
                            <MaterialIcons name="info" size={iconSize.small} color="#27AE60" />
                            <Text style={[styles.infoText, { fontSize: fontSize.small }]}>
                                Le versement journalier sera enregistré comme une recette dans le système comptable.
                            </Text>
                        </View>
                    )}

                    {/* Montant */}
                    <TextInput
                        label="Montant (BIF) *"
                        value={montant}
                        onChangeText={(text) => {
                            setMontant(text);
                            setFraisErrors(prev => ({ ...prev, montant: null }));
                        }}
                        mode="outlined"
                        keyboardType="numeric"
                        style={[styles.input, { fontSize: fontSize.body }]}
                        left={<TextInput.Icon icon="attach-money" />}
                        error={!!fraisErrors.montant}
                    />
                    {fraisErrors.montant && (
                        <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                            {fraisErrors.montant}
                        </Text>
                    )}

                    {/* Prix unitaire calculé pour carburant */}
                    {fraisType === 'carburant' && montant && quantiteCarburant && parseFloat(montant) > 0 && parseFloat(quantiteCarburant) > 0 && (
                        <View style={styles.calculationBox}>
                            <Text style={[styles.calculationLabel, { fontSize: fontSize.small }]}>
                                Prix unitaire:
                            </Text>
                            <Text style={[styles.calculationValue, { fontSize: fontSize.body }]}>
                                {formatCurrency(parseFloat(montant) / parseFloat(quantiteCarburant))}/L
                            </Text>
                        </View>
                    )}

                    {/* Quantité carburant */}
                    {selectedFraisType?.requiresQuantity && (
                        <>
                            <TextInput
                                label="Quantité (Litres) *"
                                value={quantiteCarburant}
                                onChangeText={(text) => {
                                    setQuantiteCarburant(text);
                                    setFraisErrors(prev => ({ ...prev, quantiteCarburant: null }));
                                }}
                                mode="outlined"
                                keyboardType="numeric"
                                style={[styles.input, { fontSize: fontSize.body }]}
                                left={<TextInput.Icon icon="local-gas-station" />}
                                error={!!fraisErrors.quantiteCarburant}
                            />
                            {fraisErrors.quantiteCarburant && (
                                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                    {fraisErrors.quantiteCarburant}
                                </Text>
                            )}
                        </>
                    )}

                    {/* Date */}
                    <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <TextInput
                            label="Date"
                            value={dateFrais.toLocaleDateString('fr-FR')}
                            mode="outlined"
                            editable={false}
                            style={[styles.input, { fontSize: fontSize.body }]}
                            left={<TextInput.Icon icon="event" />}
                        />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={dateFrais}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (selectedDate) setDateFrais(selectedDate);
                            }}
                        />
                    )}

                    {/* Description */}
                    <TextInput
                        label="Description *"
                        value={descriptionFrais}
                        onChangeText={(text) => {
                            setDescriptionFrais(text);
                            setFraisErrors(prev => ({ ...prev, descriptionFrais: null }));
                        }}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={[styles.input, { fontSize: fontSize.body }]}
                        error={!!fraisErrors.descriptionFrais}
                    />
                    {fraisErrors.descriptionFrais && (
                        <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                            {fraisErrors.descriptionFrais}
                        </Text>
                    )}

                    {/* Référence mission */}
                    <TextInput
                        label="ID Mission (optionnel)"
                        value={idMouvement}
                        onChangeText={setIdMouvement}
                        mode="outlined"
                        keyboardType="numeric"
                        style={[styles.input, { fontSize: fontSize.body }]}
                        left={<TextInput.Icon icon="assignment" />}
                        placeholder={currentMission ? `Mission actuelle: ${currentMission.id}` : 'Laisser vide pour mission actuelle'}
                    />

                    {/* Mode de paiement */}
                    <Text style={[styles.sectionLabel, { fontSize: fontSize.subtitle }]}>
                        Mode de paiement
                    </Text>
                    <View style={styles.paymentMethodContainer}>
                        {PAYMENT_METHODS.map(method => (
                            <Chip
                                key={method.value}
                                selected={paymentMethod === method.value}
                                onPress={() => setPaymentMethod(method.value)}
                                style={styles.paymentChip}
                                icon={method.icon}
                                textStyle={{ fontSize: fontSize.small }}
                            >
                                {method.label}
                            </Chip>
                        ))}
                    </View>

                    {/* Justificatifs */}
                    {fraisType !== 'versement_journalier' && (
                        <>
                            <Text style={[styles.sectionLabel, { fontSize: fontSize.subtitle }]}>
                                Justificatifs ({justificatifs.length}) *
                            </Text>

                            <View style={[
                                styles.justificatifsButtons,
                                { flexDirection: isMobile ? 'column' : 'row' }
                            ]}>
                                <Button
                                    mode="outlined"
                                    icon="image"
                                    onPress={pickImage}
                                    style={[styles.justifButton, { marginBottom: isMobile ? 8 : 0 }]}
                                    disabled={uploadingFiles}
                                    labelStyle={{ fontSize: fontSize.small }}
                                >
                                    Galerie
                                </Button>
                                {Platform.OS !== 'web' && (
                                    <Button
                                        mode="outlined"
                                        icon="camera"
                                        onPress={takePhoto}
                                        style={[styles.justifButton, { marginBottom: isMobile ? 8 : 0 }]}
                                        disabled={uploadingFiles}
                                        labelStyle={{ fontSize: fontSize.small }}
                                    >
                                        Photo
                                    </Button>
                                )}
                                {Platform.OS !== 'web' && (
                                    <Button
                                        mode="outlined"
                                        icon="file-document"
                                        onPress={pickDocument}
                                        style={styles.justifButton}
                                        disabled={uploadingFiles}
                                        labelStyle={{ fontSize: fontSize.small }}
                                    >
                                        Document
                                    </Button>
                                )}
                            </View>

                            {uploadingFiles && (
                                <View style={styles.uploadingIndicator}>
                                    <ActivityIndicator size="small" color="#2E86C1" />
                                    <Text style={[styles.uploadingText, { fontSize: fontSize.small }]}>
                                        Sélection en cours...
                                    </Text>
                                </View>
                            )}

                            {justificatifs.length > 0 && (
                                <View style={styles.justificatifsGrid}>
                                    {justificatifs.map((file, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.justificatifItem,
                                                {
                                                    width: isMobile ? 90 : 100,
                                                    height: isMobile ? 90 : 100
                                                }
                                            ]}
                                        >
                                            {file.fileType === 'image' ? (
                                                <TouchableOpacity onPress={() => viewImage(file.uri)}>
                                                    <Image
                                                        source={{ uri: file.uri }}
                                                        style={styles.justificatifThumb}
                                                    />
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.justificatifDoc}>
                                                    <MaterialIcons name="picture-as-pdf" size={iconSize.large} color="#E74C3C" />
                                                    <Text
                                                        style={[styles.docName, { fontSize: fontSize.tiny }]}
                                                        numberOfLines={2}
                                                    >
                                                        {file.name}
                                                    </Text>
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={styles.removeJustifButton}
                                                onPress={() => removeJustificatif(index)}
                                            >
                                                <MaterialIcons name="close" size={iconSize.small} color="#FFF" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {fraisErrors.justificatifs && (
                                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                                    {fraisErrors.justificatifs}
                                </Text>
                            )}
                        </>
                    )}

                    <Button
                        mode="contained"
                        onPress={handleSubmitFrais}
                        loading={submittingFrais}
                        disabled={submittingFrais}
                        style={styles.submitButton}
                        buttonColor="#F39C12"
                        icon="send"
                        labelStyle={{ fontSize: fontSize.body }}
                    >
                        {submittingFrais ? 'Envoi en cours...' : 'Soumettre Frais'}
                    </Button>
                </ScrollView>
            </View>
        );
    };

    // ============================================
    // LAYOUT RESPONSIVE
    // ============================================
    const renderContent = () => {
        if (isMobile) {
            // Mobile: Tabs
            return (
                <ScrollView style={styles.mobileContainer}>
                    {renderOperationsPanel()}
                    <Divider style={{ height: 2, backgroundColor: '#E8EAED', marginVertical: 10 }} />
                    {renderFraisPanel()}
                </ScrollView>
            );
        }

        // Desktop/Tablet: Split view
        return (
            <View style={styles.splitContainer}>
                {renderOperationsPanel()}
                <View style={styles.verticalDivider} />
                {renderFraisPanel()}
            </View>
        );
    };

    // ============================================
    // RENDU PRINCIPAL
    // ============================================
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {renderContent()}

            {/* Modal de confirmation */}
            <Portal>
                <Modal
                    visible={confirmModalVisible}
                    onDismiss={() => setConfirmModalVisible(false)}
                    contentContainerStyle={[styles.modal, { padding: containerPadding }]}
                >
                    <Text style={[styles.modalTitle, { fontSize: fontSize.title }]}>
                        {modalData?.title}
                    </Text>
                    <Text style={[styles.modalMessage, { fontSize: fontSize.body }]}>
                        {modalData?.message}
                    </Text>
                    <View style={styles.modalButtons}>
                        <Button
                            mode="outlined"
                            onPress={() => setConfirmModalVisible(false)}
                            labelStyle={{ fontSize: fontSize.body }}
                        >
                            Annuler
                        </Button>
                        <Button
                            mode="contained"
                            onPress={modalData?.onConfirm}
                            labelStyle={{ fontSize: fontSize.body }}
                        >
                            Confirmer
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* Modal preview image */}
            <Modal
                visible={imagePreviewVisible}
                transparent={true}
                onRequestClose={() => setImagePreviewVisible(false)}
                animationType="fade"
            >
                <View style={styles.imagePreviewModal}>
                    <TouchableOpacity
                        style={styles.closePreviewButton}
                        onPress={() => setImagePreviewVisible(false)}
                    >
                        <MaterialIcons name="close" size={iconSize.large} color="#FFF" />
                    </TouchableOpacity>
                    {selectedImageUri && (
                        <Image
                            source={{ uri: selectedImageUri }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    mobileContainer: {
        flex: 1,
    },
    splitContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    verticalDivider: {
        width: 2,
        backgroundColor: '#E8EAED',
        marginVertical: 10,
    },
    panel: {
        backgroundColor: '#FFF',
        margin: 10,
        borderRadius: 12,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
            default: {
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
        }),
    },
    panelTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 15,
    },
    panelContent: {
        flex: 1,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 10,
        color: '#7F8C8D',
    },

    // Type selector
    typeSelector: {
        gap: 10,
        marginBottom: 15,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
    },
    typeButtonText: {
        marginLeft: 8,
        fontWeight: '600',
    },

    // Vehicle info
    vehicleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
    },
    vehicleInfoContent: {
        marginLeft: 12,
        flex: 1,
    },
    vehicleInfoText: {
        fontWeight: '600',
        color: '#1976D2',
    },
    vehicleInfoSubtext: {
        color: '#424242',
        marginTop: 2,
    },

    // Input
    input: {
        marginBottom: 12,
        backgroundColor: '#FFF',
    },

    // Mission info
    missionInfo: {
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
    },
    missionInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    missionInfoTitle: {
        fontWeight: '600',
        color: '#2E7D32',
        marginLeft: 10,
    },
    divider: {
        backgroundColor: '#C8E6C9',
        height: 1,
        marginVertical: 10,
    },
    missionInfoContent: {
        gap: 8,
    },
    missionInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    missionInfoText: {
        marginLeft: 10,
        color: '#424242',
    },

    // KM Info
    kmInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
    },
    kmInfoContent: {
        marginLeft: 12,
        flex: 1,
    },
    kmInfoLabel: {
        color: '#2E7D32',
    },
    kmInfoValue: {
        fontWeight: '700',
        color: '#1B5E20',
        marginTop: 2,
    },

    // No mission warning
    noMissionWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3CD',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
    },
    noMissionText: {
        marginLeft: 10,
        color: '#856404',
        flex: 1,
    },

    // Location
    locationLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        marginBottom: 10,
    },
    locationLoadingText: {
        marginLeft: 10,
        color: '#1976D2',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        marginBottom: 15,
    },
    locationText: {
        marginLeft: 8,
        color: '#2E7D32',
        flex: 1,
    },

    // Frais
    sectionLabel: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 10,
        marginTop: 5,
    },
    sectionTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 10,
    },
    fraisTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 15,
    },
    fraisTypeCard: {
        aspectRatio: 1.2,
        borderRadius: 8,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    fraisTypeLabel: {
        fontWeight: '600',
        marginTop: 5,
        textAlign: 'center',
    },

    // Info box
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
    },
    infoText: {
        marginLeft: 10,
        color: '#2E7D32',
        flex: 1,
        lineHeight: 18,
    },

    // Calculation
    calculationBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
    },
    calculationLabel: {
        color: '#7F8C8D',
    },
    calculationValue: {
        fontWeight: '600',
        color: '#2C3E50',
    },

    // Payment
    paymentMethodContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 15,
    },
    paymentChip: {
        marginRight: 5,
    },

    // Justificatifs
    justificatifsButtons: {
        gap: 8,
        marginBottom: 15,
    },
    justifButton: {
        flex: 1,
    },
    uploadingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        marginBottom: 10,
    },
    uploadingText: {
        marginLeft: 10,
        color: '#1976D2',
    },
    justificatifsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 15,
    },
    justificatifItem: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    justificatifThumb: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    justificatifDoc: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    docName: {
        color: '#7F8C8D',
        marginTop: 4,
        textAlign: 'center',
    },
    removeJustifButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#E74C3C',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Submit
    submitButton: {
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 8,
    },

    // Error
    errorText: {
        color: '#E74C3C',
        marginTop: -8,
        marginBottom: 8,
    },

    // Modals
    modal: {
        backgroundColor: '#FFF',
        margin: 20,
        borderRadius: 12,
    },
    modalTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 10,
    },
    modalMessage: {
        color: '#7F8C8D',
        marginBottom: 20,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    imagePreviewModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closePreviewButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    previewImage: {
        width: '100%',
        height: '80%',
    },

    // ============================================
    // NOUVEAUX STYLES SALAIRE
    // ============================================
    salaryCard: {
        marginBottom: 15,
        borderRadius: 12,
        elevation: 2,
    },
    salaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    salaryMonth: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    salaryDepartment: {
        color: '#7F8C8D',
        marginTop: 2,
    },
    salaryBadge: {
        alignSelf: 'flex-start',
    },
    salaryDivider: {
        backgroundColor: '#E8EAED',
        height: 1,
        marginVertical: 12,
    },
    salaryAmounts: {
        gap: 12,
    },
    salaryAmountItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    salaryAmountLabel: {
        color: '#7F8C8D',
    },
    salaryAmountValue: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    salaryAmountDeduction: {
        fontWeight: '600',
        color: '#E74C3C',
    },
    salaryAmountNet: {
        fontWeight: '700',
        color: '#27AE60',
    },
    salaryPaymentInfo: {
        gap: 8,
    },
    salaryPaymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    salaryPaymentText: {
        marginLeft: 10,
        color: '#424242',
    },
    salaryAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    salaryAlertText: {
        marginLeft: 10,
        color: '#C62828',
        flex: 1,
    },
    salaryActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 15,
    },
    salaryActionButton: {
        borderRadius: 8,
    },
    salaryConfirmed: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        flex: 1,
    },
    salaryConfirmedText: {
        marginLeft: 10,
        color: '#2E7D32',
        flex: 1,
    },

    // Code input
    codeInputContainer: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 8,
        marginTop: 15,
    },
    codeInputLabel: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 5,
    },
    codeInputHint: {
        color: '#7F8C8D',
        marginBottom: 10,
    },
    codeInputButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },

    // Requests
    requestCard: {
        borderRadius: 8,
        elevation: 1,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    requestMonth: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    requestDate: {
        color: '#7F8C8D',
        marginTop: 2,
    },
    requestBadge: {
        alignSelf: 'flex-start',
    },
    requestAmount: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 8,
    },
    requestReject: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFEBEE',
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
    },
    requestRejectText: {
        marginLeft: 8,
        color: '#C62828',
        flex: 1,
    },
    requestProcessed: {
        color: '#7F8C8D',
        marginTop: 8,
    },

    // No salary
    noSalaryContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    noSalaryText: {
        color: '#7F8C8D',
        marginTop: 20,
        fontWeight: '600',
    },
    noSalaryHint: {
        color: '#BDC3C7',
        marginTop: 8,
        textAlign: 'center',
    },
});
export default OperationsFraisScreen;