// mobile/src/screens/chauffeur/IncidentsScreen.js
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
    FlatList,
    useWindowDimensions,
    Platform,
    ActivityIndicator
} from 'react-native';
import { TextInput, Button, RadioButton, Chip, Divider, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration API
const API_BASE_URL = Platform.select({
    web: process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com',
    default: 'https://nutrifix-1-twdf.onrender.com'
});

// Types d'incidents
const INCIDENT_TYPES = [
    { value: 'accident', label: 'Accident', icon: 'car-crash', color: '#E74C3C' },
    { value: 'panne', label: 'Panne Mécanique', icon: 'build', color: '#F39C12' },
    { value: 'vol', label: 'Vol/Effraction', icon: 'warning', color: '#E74C3C' },
    { value: 'degats', label: 'Dégâts Matériels', icon: 'broken-image', color: '#F39C12' },
    { value: 'crevaison', label: 'Crevaison', icon: 'warning', color: '#E67E22' },
    { value: 'autre', label: 'Autre', icon: 'more-horiz', color: '#7F8C8D' },
];

// Niveaux d'urgence
const URGENCY_LEVELS = [
    { value: 'faible', label: 'Faible', color: '#2ECC71' },
    { value: 'normal', label: 'Normal', color: '#F39C12' },
    { value: 'urgent', label: 'Urgent', color: '#E74C3C' },
];

// Périodes pour le rapport
const REPORT_PERIODS = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette Semaine' },
    { value: 'month', label: 'Ce Mois' },
    { value: 'custom', label: 'Personnalisé' },
];

const IncidentsScreen = ({ navigation }) => {
    const windowDimensions = useWindowDimensions();

    // ============================================
    // ÉTATS
    // ============================================
    // États du formulaire
    const [type, setType] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [coordinates, setCoordinates] = useState(null);
    const [urgency, setUrgency] = useState('normal');
    const [images, setImages] = useState([]);

    // États UI
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('nouveau');
    const [incidents, setIncidents] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    // États validation
    const [errors, setErrors] = useState({});

    // États localisation
    const [loadingLocation, setLoadingLocation] = useState(false);

    // État token
    const [authToken, setAuthToken] = useState(null);

    // États pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // ============================================
    // NOUVEAUX ÉTATS - RAPPORT & FRAIS QUOTIDIENS
    // ============================================
    const [expensesReport, setExpensesReport] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [reportPeriod, setReportPeriod] = useState('month');
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const [dailyExpenses, setDailyExpenses] = useState(null);
    const [loadingDailyExpenses, setLoadingDailyExpenses] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDailyDatePicker, setShowDailyDatePicker] = useState(false);

    // ============================================
    // CALCUL RESPONSIVE
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
    const isLaptop = deviceType === 'laptop';
    const isDesktop = deviceType === 'desktop' || deviceType === 'desktopLarge';
    const isLargeScreen = isLaptop || isDesktop;

    const getResponsiveValue = useCallback((values) => {
        const {
            mobile = 15,
            mobileLarge,
            tablet,
            laptop,
            desktop,
            desktopLarge
        } = values;

        // Ordre de fallback intelligent
        switch (deviceType) {
            case 'desktopLarge': return desktopLarge ?? desktop ?? laptop ?? tablet ?? mobileLarge ?? mobile;
            case 'desktop': return desktop ?? laptop ?? tablet ?? mobileLarge ?? mobile;
            case 'laptop': return laptop ?? tablet ?? mobileLarge ?? mobile;
            case 'tablet': return tablet ?? mobileLarge ?? mobile;
            case 'mobileLarge': return mobileLarge ?? mobile;
            default: return mobile;
        }
    }, [deviceType]);

    const containerPadding = getResponsiveValue({
        mobile: 15,
        mobileLarge: 18,
        tablet: 20,
        laptop: 25,
        desktop: 30,
        desktopLarge: 40
    });

    const cardMargin = getResponsiveValue({
        mobile: 10,
        mobileLarge: 12,
        tablet: 15,
        laptop: 18,
        desktop: 20,
        desktopLarge: 25
    });

    const maxContentWidth = getResponsiveValue({
        mobile: '100%',
        mobileLarge: '100%',
        tablet: '100%',
        laptop: 1000,
        desktop: 1200,
        desktopLarge: 1400
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
        medium: getResponsiveValue({ mobile: 20, tablet: 22, laptop: 24, desktop: 26 }),
        large: getResponsiveValue({ mobile: 24, tablet: 28, laptop: 30, desktop: 32 }),
        xlarge: getResponsiveValue({ mobile: 60, tablet: 70, laptop: 80, desktop: 90 })
    };

    const typeCardSize = isMobile ? '48%' : isTablet ? '31%' : '23%';

    // ============================================
    // API HELPERS
    // ============================================
    const getAuthToken = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
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
        getAuthToken();
    }, []);

    useEffect(() => {
        if (activeTab === 'historique') {
            loadIncidents(true);
        } else if (activeTab === 'rapport') {
            loadExpensesReport();
        } else if (activeTab === 'quotidien') {
            loadDailyExpenses();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'rapport' && reportPeriod !== 'custom') {
            loadExpensesReport();
        }
    }, [reportPeriod]);

    useEffect(() => {
        if (activeTab === 'quotidien') {
            loadDailyExpenses();
        }
    }, [selectedDate]);

    // ============================================
    // CHARGEMENT DONNÉES
    // ============================================
    const loadIncidents = async (reset = false) => {
        if (reset) {
            setPage(1);
            setIncidents([]);
            setHasMore(true);
        }

        if (!hasMore && !reset) return;

        setLoading(reset);
        setLoadingMore(!reset);

        try {
            const currentPage = reset ? 1 : page;
            const result = await apiCall(`/incidents?page=${currentPage}&limit=20`);

            if (result.success) {
                const newIncidents = result.data || [];

                if (reset) {
                    setIncidents(newIncidents);
                } else {
                    setIncidents(prev => [...prev, ...newIncidents]);
                }

                setHasMore(newIncidents.length === 20);
                setPage(currentPage + 1);
            }
        } catch (error) {
            console.error('Load incidents error:', error);
            if (Platform.OS !== 'web') {
                Alert.alert('Erreur', 'Impossible de charger les incidents');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // ============================================
    // NOUVEAU - CHARGEMENT RAPPORT FRAIS
    // ============================================
    const loadExpensesReport = async () => {
        setLoadingReport(true);
        try {
            let endpoint = `/expenses/report?period=${reportPeriod}`;

            if (reportPeriod === 'custom') {
                const startDate = customStartDate.toISOString().split('T')[0];
                const endDate = customEndDate.toISOString().split('T')[0];
                endpoint = `/expenses/report?startDate=${startDate}&endDate=${endDate}`;
            }

            const result = await apiCall(endpoint);

            if (result.success) {
                setExpensesReport(result.data);
            }
        } catch (error) {
            console.error('Load expenses report error:', error);
            Alert.alert('Erreur', 'Impossible de charger le rapport des frais');
        } finally {
            setLoadingReport(false);
        }
    };

    // ============================================
    // NOUVEAU - CHARGEMENT FRAIS QUOTIDIENS
    // ============================================
    const loadDailyExpenses = async () => {
        setLoadingDailyExpenses(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const result = await apiCall(`/expenses/daily/${dateStr}`);

            if (result.success) {
                setDailyExpenses(result.data);
            }
        } catch (error) {
            console.error('Load daily expenses error:', error);
            Alert.alert('Erreur', 'Impossible de charger les frais du jour');
        } finally {
            setLoadingDailyExpenses(false);
        }
    };

    // ============================================
    // LOCALISATION
    // ============================================
    const getCurrentLocation = async () => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                if (Platform.OS !== 'web') {
                    Alert.alert(
                        'Permission Refusée',
                        'L\'accès à la localisation est nécessaire pour localiser l\'incident.'
                    );
                }
                setLoadingLocation(false);
                return;
            }

            const locationData = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeout: 10000
            });

            setCoordinates({
                latitude: locationData.coords.latitude,
                longitude: locationData.coords.longitude
            });

            // Géocodage inverse
            try {
                const addresses = await Location.reverseGeocodeAsync({
                    latitude: locationData.coords.latitude,
                    longitude: locationData.coords.longitude
                });

                if (addresses && addresses.length > 0) {
                    const addr = addresses[0];
                    const parts = [
                        addr.street,
                        addr.city,
                        addr.region,
                        addr.country
                    ].filter(Boolean);

                    setLocation(parts.join(', ') || 'Adresse inconnue');
                }
            } catch (geoError) {
                console.error('Reverse geocoding error:', geoError);
                setLocation(`${locationData.coords.latitude.toFixed(6)}, ${locationData.coords.longitude.toFixed(6)}`);
            }
        } catch (error) {
            console.error('Get location error:', error);
            if (Platform.OS !== 'web') {
                Alert.alert('Erreur', 'Impossible de récupérer votre position');
            }
        } finally {
            setLoadingLocation(false);
        }
    };

    // ============================================
    // GESTION IMAGES
    // ============================================
    const pickImageFromGallery = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

                if (status !== 'granted') {
                    Alert.alert('Permission Refusée', 'Accès à la galerie refusé');
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: Platform.OS !== 'web',
                quality: 0.8,
                maxHeight: 1920,
                maxWidth: 1920,
            });

            if (!result.canceled) {
                const newAssets = result.assets || [result];

                if (images.length + newAssets.length > 5) {
                    Alert.alert('Limite Atteinte', 'Maximum 5 photos autorisées');
                    return;
                }

                const newImages = newAssets.map((asset, index) => ({
                    uri: asset.uri,
                    name: `incident_${Date.now()}_${index}.jpg`,
                    type: 'image/jpeg',
                }));

                setImages([...images, ...newImages]);
                setErrors(prev => ({ ...prev, images: null }));
            }
        } catch (error) {
            console.error('Pick image error:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner les images');
        }
    };

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            Alert.alert('Non Supporté', 'La caméra n\'est pas disponible sur le web. Utilisez la galerie.');
            return;
        }

        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permission Refusée', 'Accès à la caméra refusé');
                return;
            }

            if (images.length >= 5) {
                Alert.alert('Limite Atteinte', 'Maximum 5 photos autorisées');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                maxHeight: 1920,
                maxWidth: 1920,
            });

            if (!result.canceled) {
                const newImage = {
                    uri: result.assets[0].uri,
                    name: `incident_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                };

                setImages([...images, newImage]);
                setErrors(prev => ({ ...prev, images: null }));
            }
        } catch (error) {
            console.error('Take photo error:', error);
            Alert.alert('Erreur', 'Impossible de prendre la photo');
        }
    };

    const removeImage = (index) => {
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
    };

    const viewImage = (image) => {
        setSelectedImage(image);
        setImageModalVisible(true);
    };

    // ============================================
    // VALIDATION
    // ============================================
    const validateForm = () => {
        const newErrors = {};

        if (!type) {
            newErrors.type = 'Type d\'incident requis';
        }

        if (!description || description.trim().length < 10) {
            newErrors.description = 'Description requise (minimum 10 caractères)';
        }

        if (!location || location.trim().length < 3) {
            newErrors.location = 'Lieu requis';
        }

        if (images.length === 0) {
            newErrors.images = 'Au moins une photo requise';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ============================================
    // SOUMISSION
    // ============================================
    const handleSubmit = async () => {
        if (!validateForm()) {
            Alert.alert('Formulaire Incomplet', 'Veuillez remplir tous les champs requis');
            return;
        }

        setSubmitting(true);
        try {
            // Créer FormData pour l'upload
            const formData = new FormData();
            formData.append('type', type);
            formData.append('description', description.trim());
            formData.append('location', location.trim());
            formData.append('urgency', urgency);

            if (coordinates) {
                formData.append('latitude', coordinates.latitude);
                formData.append('longitude', coordinates.longitude);
            }

            // Ajouter les images
            images.forEach((image, index) => {
                formData.append('photos', {
                    uri: image.uri,
                    type: image.type,
                    name: image.name || `incident_${index}.jpg`
                });
            });

            const result = await apiCall('/incidents/report', 'POST', formData, true);

            if (result.success) {
                Alert.alert(
                    'Incident Déclaré',
                    'Votre incident a été enregistré avec succès',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                resetForm();
                                setActiveTab('historique');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', result.message || 'Impossible de déclarer l\'incident');
            }
        } catch (error) {
            console.error('Submit incident error:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Une erreur est survenue lors de la déclaration'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setType('');
        setDescription('');
        setLocation('');
        setCoordinates(null);
        setUrgency('normal');
        setImages([]);
        setErrors({});
    };

    // ============================================
    // GESTION DÉTAILS
    // ============================================
    const viewIncidentDetails = async (incident) => {
        try {
            const result = await apiCall(`/incidents/${incident.id}`);
            if (result.success) {
                setSelectedIncident(result.data);
                setDetailModalVisible(true);
            }
        } catch (error) {
            console.error('Load incident details error:', error);
            Alert.alert('Erreur', 'Impossible de charger les détails');
        }
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

    // ============================================
    // RENDU COMPOSANTS (INCHANGÉS)
    // ============================================
    const renderTypeSelector = () => (
        <View style={[styles.section, { marginBottom: cardMargin }]}>
            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                Type d'incident *
            </Text>
            <View style={[
                styles.typeGrid,
                {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between'
                }
            ]}>
                {INCIDENT_TYPES.map((incidentType) => (
                    <TouchableOpacity
                        key={incidentType.value}
                        style={[
                            styles.typeCard,
                            {
                                width: typeCardSize,
                                borderColor: type === incidentType.value ? incidentType.color : '#E8EAED',
                                backgroundColor: type === incidentType.value ? incidentType.color : '#FFF',
                                marginBottom: cardMargin,
                                borderWidth: 2
                            }
                        ]}
                        onPress={() => {
                            setType(incidentType.value);
                            setErrors(prev => ({ ...prev, type: null }));
                        }}
                    >
                        <MaterialIcons
                            name={incidentType.icon}
                            size={iconSize.large}
                            color={type === incidentType.value ? '#FFF' : incidentType.color}
                        />
                        <Text
                            style={[
                                styles.typeLabel,
                                {
                                    fontSize: fontSize.small,
                                    color: type === incidentType.value ? '#FFF' : '#2C3E50'
                                }
                            ]}
                        >
                            {incidentType.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            {errors.type && (
                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                    {errors.type}
                </Text>
            )}
        </View>
    );

    const renderDescriptionInput = () => (
        <View style={[styles.section, { marginBottom: cardMargin }]}>
            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                Description détaillée *
            </Text>
            <TextInput
                mode="outlined"
                placeholder="Décrivez l'incident en détail (minimum 10 caractères)..."
                value={description}
                onChangeText={(text) => {
                    setDescription(text);
                    if (text.trim().length >= 10) {
                        setErrors(prev => ({ ...prev, description: null }));
                    }
                }}
                multiline
                numberOfLines={isMobile ? 4 : 6}
                style={[styles.textArea, { fontSize: fontSize.body }]}
                error={!!errors.description}
                outlineColor="#E8EAED"
                activeOutlineColor="#2E86C1"
            />
            <Text style={[styles.characterCount, { fontSize: fontSize.tiny }]}>
                {description.length} caractères
            </Text>
            {errors.description && (
                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                    {errors.description}
                </Text>
            )}
        </View>
    );

    const renderLocationInput = () => (
        <View style={[styles.section, { marginBottom: cardMargin }]}>
            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                Lieu de l'incident *
            </Text>
            <TextInput
                mode="outlined"
                placeholder="Adresse ou description du lieu"
                value={location}
                onChangeText={(text) => {
                    setLocation(text);
                    if (text.trim().length >= 3) {
                        setErrors(prev => ({ ...prev, location: null }));
                    }
                }}
                style={[styles.input, { fontSize: fontSize.body }]}
                error={!!errors.location}
                outlineColor="#E8EAED"
                activeOutlineColor="#2E86C1"
                right={
                    <TextInput.Icon
                        icon="my-location"
                        onPress={getCurrentLocation}
                        disabled={loadingLocation}
                        color={loadingLocation ? '#BDC3C7' : '#2E86C1'}
                    />
                }
            />
            {loadingLocation && (
                <Text style={[styles.locationStatus, { fontSize: fontSize.tiny }]}>
                    📍 Récupération de votre position...
                </Text>
            )}
            {coordinates && !loadingLocation && (
                <Text style={[styles.coordinatesText, { fontSize: fontSize.tiny }]}>
                    📍 Coordonnées: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                </Text>
            )}
            {errors.location && (
                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                    {errors.location}
                </Text>
            )}
        </View>
    );

    const renderUrgencySelector = () => (
        <View style={[styles.section, { marginBottom: cardMargin }]}>
            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                Niveau d'urgence
            </Text>
            <RadioButton.Group onValueChange={setUrgency} value={urgency}>
                <View style={[
                    styles.urgencyContainer,
                    { flexDirection: isMobile ? 'column' : 'row' }
                ]}>
                    {URGENCY_LEVELS.map((level) => (
                        <TouchableOpacity
                            key={level.value}
                            style={[
                                styles.urgencyButton,
                                {
                                    backgroundColor: urgency === level.value ? level.color : '#FFF',
                                    borderColor: urgency === level.value ? level.color : '#E8EAED',
                                    marginBottom: isMobile ? 10 : 0,
                                    flex: isMobile ? 0 : 1
                                }
                            ]}
                            onPress={() => setUrgency(level.value)}
                        >
                            <RadioButton.Android
                                value={level.value}
                                status={urgency === level.value ? 'checked' : 'unchecked'}
                                color={urgency === level.value ? '#FFF' : level.color}
                            />
                            <Text
                                style={[
                                    styles.urgencyLabel,
                                    {
                                        fontSize: fontSize.body,
                                        color: urgency === level.value ? '#FFF' : '#2C3E50'
                                    }
                                ]}
                            >
                                {level.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </RadioButton.Group>
        </View>
    );

    const renderPhotoSection = () => (
        <View style={[styles.section, { marginBottom: cardMargin }]}>
            <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                Photos de l'incident ({images.length}/5) *
            </Text>

            <View style={[
                styles.photoButtons,
                { flexDirection: isMobile ? 'column' : 'row' }
            ]}>
                <Button
                    mode="outlined"
                    icon="image"
                    onPress={pickImageFromGallery}
                    style={[
                        styles.photoButton,
                        { marginBottom: isMobile ? 10 : 0 }
                    ]}
                    disabled={images.length >= 5}
                    labelStyle={{ fontSize: fontSize.body }}
                >
                    Galerie
                </Button>
                {Platform.OS !== 'web' && (
                    <Button
                        mode="outlined"
                        icon="camera"
                        onPress={takePhoto}
                        style={styles.photoButton}
                        disabled={images.length >= 5}
                        labelStyle={{ fontSize: fontSize.body }}
                    >
                        Caméra
                    </Button>
                )}
            </View>

            {images.length > 0 && (
                <View style={[
                    styles.imageGrid,
                    {
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginTop: 15
                    }
                ]}>
                    {images.map((image, index) => (
                        <View
                            key={index}
                            style={[
                                styles.imageContainer,
                                {
                                    width: isMobile ? 100 : isTablet ? 120 : 140,
                                    height: isMobile ? 100 : isTablet ? 120 : 140
                                }
                            ]}
                        >
                            <TouchableOpacity onPress={() => viewImage(image)}>
                                <Image
                                    source={{ uri: image.uri }}
                                    style={styles.imageThumb}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.removeImageButton}
                                onPress={() => removeImage(index)}
                            >
                                <MaterialIcons name="close" size={iconSize.small} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {images.length === 0 && (
                <View style={styles.emptyPhotos}>
                    <MaterialIcons name="add-a-photo" size={iconSize.xlarge} color="#BDC3C7" />
                    <Text style={[styles.emptyPhotosText, { fontSize: fontSize.small }]}>
                        Ajoutez des photos de l'incident
                    </Text>
                </View>
            )}

            {errors.images && (
                <Text style={[styles.errorText, { fontSize: fontSize.tiny }]}>
                    {errors.images}
                </Text>
            )}
        </View>
    );

    const renderNewIncidentTab = () => (
        <ScrollView
            style={styles.tabContent}
            contentContainerStyle={[
                styles.tabContentContainer,
                {
                    padding: containerPadding,
                    maxWidth: maxContentWidth,
                    width: '100%',
                    alignSelf: 'center'
                }
            ]}
            showsVerticalScrollIndicator={false}
        >
            <View style={[styles.formCard, { padding: containerPadding }]}>
                {renderTypeSelector()}
                {renderDescriptionInput()}
                {renderLocationInput()}
                {renderUrgencySelector()}
                {renderPhotoSection()}

                <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                    style={styles.submitButton}
                    contentStyle={styles.submitButtonContent}
                    labelStyle={{ fontSize: fontSize.body }}
                    icon="send"
                >
                    {submitting ? 'Envoi en cours...' : 'Déclarer l\'Incident'}
                </Button>

                {!isMobile && (
                    <Button
                        mode="text"
                        onPress={resetForm}
                        style={{ marginTop: 10 }}
                        labelStyle={{ fontSize: fontSize.small }}
                    >
                        Réinitialiser le formulaire
                    </Button>
                )}
            </View>
        </ScrollView>
    );

    const renderIncidentItem = ({ item }) => {
        const incidentType = INCIDENT_TYPES.find(t => t.value === item.type);
        const urgencyLevel = URGENCY_LEVELS.find(u => u.value === item.urgency);

        return (
            <TouchableOpacity
                style={[
                    styles.incidentCard,
                    {
                        margin: cardMargin / 2,
                        padding: containerPadding
                    }
                ]}
                onPress={() => viewIncidentDetails(item)}
            >
                <View style={styles.incidentHeader}>
                    <View style={[
                        styles.incidentTypeIcon,
                        {
                            backgroundColor: incidentType?.color || '#7F8C8D',
                            width: iconSize.large + 16,
                            height: iconSize.large + 16,
                            borderRadius: (iconSize.large + 16) / 2
                        }
                    ]}>
                        <MaterialIcons
                            name={incidentType?.icon || 'error'}
                            size={iconSize.medium}
                            color="#FFF"
                        />
                    </View>
                    <View style={styles.incidentInfo}>
                        <Text style={[styles.incidentType, { fontSize: fontSize.body }]}>
                            {incidentType?.label || item.type}
                        </Text>
                        <Text style={[styles.incidentDate, { fontSize: fontSize.tiny }]}>
                            {new Date(item.date_incident).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </Text>
                    </View>
                    <Chip
                        mode="flat"
                        style={{
                            backgroundColor: urgencyLevel?.color || '#7F8C8D'
                        }}
                        textStyle={{ color: '#FFF', fontSize: fontSize.tiny }}
                    >
                        {urgencyLevel?.label || item.urgency}
                    </Chip>
                </View>

                <Divider style={styles.divider} />

                <Text
                    style={[styles.incidentDescription, { fontSize: fontSize.small }]}
                    numberOfLines={2}
                >
                    {item.description}
                </Text>

                <View style={styles.incidentFooter}>
                    <View style={styles.incidentLocation}>
                        <MaterialIcons name="location-on" size={iconSize.small} color="#7F8C8D" />
                        <Text
                            style={[styles.incidentLocationText, { fontSize: fontSize.tiny }]}
                            numberOfLines={1}
                        >
                            {item.location}
                        </Text>
                    </View>
                    {item.nombre_photos > 0 && (
                        <View style={styles.incidentPhotos}>
                            <MaterialIcons name="photo" size={iconSize.small} color="#2E86C1" />
                            <Text style={[styles.incidentPhotosText, { fontSize: fontSize.tiny }]}>
                                {item.nombre_photos}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderHistoryTab = () => {
        if (loading && incidents.length === 0) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2E86C1" />
                    <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                        Chargement des incidents...
                    </Text>
                </View>
            );
        }

        if (incidents.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <MaterialIcons name="assignment" size={iconSize.xlarge} color="#BDC3C7" />
                    <Text style={[styles.emptyStateText, { fontSize: fontSize.body }]}>
                        Aucun incident déclaré
                    </Text>
                    <Button
                        mode="outlined"
                        onPress={() => setActiveTab('nouveau')}
                        style={{ marginTop: 20 }}
                        labelStyle={{ fontSize: fontSize.small }}
                    >
                        Déclarer un incident
                    </Button>
                </View>
            );
        }

        return (
            <View style={styles.tabContent}>
                <FlatList
                    data={incidents}
                    renderItem={renderIncidentItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{
                        padding: containerPadding / 2,
                        maxWidth: maxContentWidth,
                        width: '100%',
                        alignSelf: 'center'
                    }}
                    showsVerticalScrollIndicator={false}
                    onEndReached={() => {
                        if (hasMore && !loadingMore) {
                            loadIncidents(false);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingMore}>
                                <ActivityIndicator size="small" color="#2E86C1" />
                            </View>
                        ) : null
                    }
                />
            </View>
        );
    };

    // ============================================
    // NOUVEAU - RENDU TAB RAPPORT FRAIS
    // ============================================
    const renderExpensesReportTab = () => {
        if (loadingReport) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2E86C1" />
                    <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                        Chargement du rapport...
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={[
                    styles.tabContentContainer,
                    {
                        padding: containerPadding,
                        maxWidth: maxContentWidth,
                        width: '100%',
                        alignSelf: 'center'
                    }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Sélecteur de période */}
                <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                    <Card.Content>
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                            Période
                        </Text>
                        <View style={[
                            styles.periodSelector,
                            { flexDirection: isMobile ? 'column' : 'row', gap: 10 }
                        ]}>
                            {REPORT_PERIODS.map(period => (
                                <Chip
                                    key={period.value}
                                    selected={reportPeriod === period.value}
                                    onPress={() => setReportPeriod(period.value)}
                                    style={[
                                        styles.periodChip,
                                        { flex: isMobile ? 0 : 1 }
                                    ]}
                                    textStyle={{ fontSize: fontSize.small }}
                                >
                                    {period.label}
                                </Chip>
                            ))}
                        </View>

                        {reportPeriod === 'custom' && (
                            <View style={{ marginTop: 15 }}>
                                <TouchableOpacity onPress={() => setShowStartDatePicker(true)}>
                                    <TextInput
                                        label="Date de début"
                                        value={customStartDate.toLocaleDateString('fr-FR')}
                                        mode="outlined"
                                        editable={false}
                                        style={[styles.input, { fontSize: fontSize.body }]}
                                        left={<TextInput.Icon icon="calendar" />}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setShowEndDatePicker(true)}>
                                    <TextInput
                                        label="Date de fin"
                                        value={customEndDate.toLocaleDateString('fr-FR')}
                                        mode="outlined"
                                        editable={false}
                                        style={[styles.input, { fontSize: fontSize.body, marginTop: 10 }]}
                                        left={<TextInput.Icon icon="calendar" />}
                                    />
                                </TouchableOpacity>

                                <Button
                                    mode="contained"
                                    onPress={loadExpensesReport}
                                    style={{ marginTop: 10 }}
                                    labelStyle={{ fontSize: fontSize.body }}
                                >
                                    Charger le rapport
                                </Button>
                            </View>
                        )}
                    </Card.Content>
                </Card>

                {expensesReport && (
                    <>
                        {/* Résumé */}
                        <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                            <Card.Content>
                                <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                    Résumé Global
                                </Text>

                                <View style={styles.summaryGrid}>
                                    <View style={styles.summaryItem}>
                                        <MaterialIcons name="trending-down" size={iconSize.medium} color="#E74C3C" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Total Dépenses
                                            </Text>
                                            <Text style={[styles.summaryValueRed, { fontSize: fontSize.body }]}>
                                                {formatCurrency(expensesReport.summary.total_depenses)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.summaryItem}>
                                        <MaterialIcons name="trending-up" size={iconSize.medium} color="#27AE60" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Total Recettes
                                            </Text>
                                            <Text style={[styles.summaryValueGreen, { fontSize: fontSize.body }]}>
                                                {formatCurrency(expensesReport.summary.total_recettes)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.summaryItem}>
                                        <MaterialIcons name="account-balance" size={iconSize.medium} color="#3498DB" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Solde Net
                                            </Text>
                                            <Text style={[
                                                expensesReport.summary.solde_net >= 0 ? styles.summaryValueGreen : styles.summaryValueRed,
                                                { fontSize: fontSize.body }
                                            ]}>
                                                {formatCurrency(expensesReport.summary.solde_net)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.summaryItem}>
                                        <MaterialIcons name="percent" size={iconSize.medium} color="#9B59B6" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Rentabilité
                                            </Text>
                                            <Text style={[styles.summaryValue, { fontSize: fontSize.body }]}>
                                                {expensesReport.summary.ratio_rentabilite}%
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>

                        {/* Dépenses par type */}
                        {expensesReport.expenses_by_type && expensesReport.expenses_by_type.length > 0 && (
                            <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                                <Card.Content>
                                    <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                        Dépenses par Type
                                    </Text>

                                    {expensesReport.expenses_by_type.map((expense, index) => (
                                        <View key={index} style={styles.expenseTypeItem}>
                                            <View style={styles.expenseTypeHeader}>
                                                <Text style={[styles.expenseTypeLabel, { fontSize: fontSize.body }]}>
                                                    {expense.type_frais}
                                                </Text>
                                                <Text style={[styles.expenseTypeAmount, { fontSize: fontSize.body }]}>
                                                    {formatCurrency(expense.montant_total)}
                                                </Text>
                                            </View>
                                            <View style={styles.expenseTypeDetails}>
                                                <Text style={[styles.expenseTypeDetailText, { fontSize: fontSize.tiny }]}>
                                                    {expense.nombre_transactions} transactions • Moy: {formatCurrency(expense.montant_moyen)}
                                                </Text>
                                                <Text style={[styles.expenseTypeDetailText, { fontSize: fontSize.tiny }]}>
                                                    {expense.transactions_validees} validées • {expense.transactions_en_attente} en attente
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        )}

                        {/* Versements */}
                        {expensesReport.revenues && (
                            <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                                <Card.Content>
                                    <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                        Versements Journaliers
                                    </Text>

                                    <View style={styles.revenueItem}>
                                        <View style={styles.revenueRow}>
                                            <Text style={[styles.revenueLabel, { fontSize: fontSize.small }]}>
                                                Nombre de versements
                                            </Text>
                                            <Text style={[styles.revenueValue, { fontSize: fontSize.body }]}>
                                                {expensesReport.revenues.nombre_transactions}
                                            </Text>
                                        </View>
                                        <View style={styles.revenueRow}>
                                            <Text style={[styles.revenueLabel, { fontSize: fontSize.small }]}>
                                                Montant total
                                            </Text>
                                            <Text style={[styles.revenueValueGreen, { fontSize: fontSize.body }]}>
                                                {formatCurrency(expensesReport.revenues.montant_total)}
                                            </Text>
                                        </View>
                                        <View style={styles.revenueRow}>
                                            <Text style={[styles.revenueLabel, { fontSize: fontSize.small }]}>
                                                Versement moyen
                                            </Text>
                                            <Text style={[styles.revenueValue, { fontSize: fontSize.body }]}>
                                                {formatCurrency(expensesReport.revenues.montant_moyen)}
                                            </Text>
                                        </View>
                                    </View>
                                </Card.Content>
                            </Card>
                        )}

                        {/* Détails journaliers */}
                        {expensesReport.daily_breakdown && expensesReport.daily_breakdown.length > 0 && (
                            <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                                <Card.Content>
                                    <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                        Détails par Jour
                                    </Text>

                                    {expensesReport.daily_breakdown.map((day, index) => (
                                        <View key={index} style={styles.dailyItem}>
                                            <View style={styles.dailyHeader}>
                                                <Text style={[styles.dailyDate, { fontSize: fontSize.body }]}>
                                                    {day.date_jour_format}
                                                </Text>
                                                <Chip
                                                    style={{
                                                        backgroundColor: day.solde_net >= 0 ? '#E8F5E9' : '#FFEBEE'
                                                    }}
                                                    textStyle={{
                                                        color: day.solde_net >= 0 ? '#27AE60' : '#E74C3C',
                                                        fontSize: fontSize.tiny
                                                    }}
                                                >
                                                    {formatCurrency(day.solde_net)}
                                                </Chip>
                                            </View>
                                            <View style={styles.dailyDetails}>
                                                <View style={styles.dailyDetailRow}>
                                                    <Text style={[styles.dailyDetailLabel, { fontSize: fontSize.tiny }]}>
                                                        Dépenses:
                                                    </Text>
                                                    <Text style={[styles.dailyDetailValue, { fontSize: fontSize.tiny }]}>
                                                        {formatCurrency(day.depenses_totales)}
                                                    </Text>
                                                </View>
                                                <View style={styles.dailyDetailRow}>
                                                    <Text style={[styles.dailyDetailLabel, { fontSize: fontSize.tiny }]}>
                                                        Versements:
                                                    </Text>
                                                    <Text style={[styles.dailyDetailValue, { fontSize: fontSize.tiny }]}>
                                                        {formatCurrency(day.versements_totaux)}
                                                    </Text>
                                                </View>
                                                <View style={styles.dailyDetailRow}>
                                                    <Text style={[styles.dailyDetailLabel, { fontSize: fontSize.tiny }]}>
                                                        Missions:
                                                    </Text>
                                                    <Text style={[styles.dailyDetailValue, { fontSize: fontSize.tiny }]}>
                                                        {day.missions_jour} • {formatNumber(day.km_jour)} km
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        )}
                    </>
                )}

                {!expensesReport && !loadingReport && (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="assessment" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyStateText, { fontSize: fontSize.body }]}>
                            Aucune donnée disponible pour cette période
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    // ============================================
    // NOUVEAU - RENDU TAB FRAIS QUOTIDIENS
    // ============================================
    const renderDailyExpensesTab = () => {
        if (loadingDailyExpenses) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2E86C1" />
                    <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                        Chargement des frais du jour...
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={styles.tabContent}
                contentContainerStyle={[
                    styles.tabContentContainer,
                    {
                        padding: containerPadding,
                        maxWidth: maxContentWidth,
                        width: '100%',
                        alignSelf: 'center'
                    }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Sélecteur de date */}
                <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                    <Card.Content>
                        <TouchableOpacity onPress={() => setShowDailyDatePicker(true)}>
                            <TextInput
                                label="Date"
                                value={selectedDate.toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                                mode="outlined"
                                editable={false}
                                style={[styles.input, { fontSize: fontSize.body }]}
                                left={<TextInput.Icon icon="calendar" />}
                            />
                        </TouchableOpacity>
                    </Card.Content>
                </Card>

                {dailyExpenses && (
                    <>
                        {/* Résumé du jour */}
                        <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                            <Card.Content>
                                <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                    Résumé de la Journée
                                </Text>

                                <View style={styles.dailySummaryGrid}>
                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="drive-eta" size={iconSize.medium} color="#3498DB" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Missions
                                            </Text>
                                            <Text style={[styles.summaryValue, { fontSize: fontSize.body }]}>
                                                {dailyExpenses.summary.missions_nombre}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="speed" size={iconSize.medium} color="#9B59B6" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Kilométrage
                                            </Text>
                                            <Text style={[styles.summaryValue, { fontSize: fontSize.body }]}>
                                                {formatNumber(dailyExpenses.summary.km_total)} km
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="trending-down" size={iconSize.medium} color="#E74C3C" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Dépenses
                                            </Text>
                                            <Text style={[styles.summaryValueRed, { fontSize: fontSize.body }]}>
                                                {formatCurrency(dailyExpenses.summary.depenses_total)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="trending-up" size={iconSize.medium} color="#27AE60" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Versements
                                            </Text>
                                            <Text style={[styles.summaryValueGreen, { fontSize: fontSize.body }]}>
                                                {formatCurrency(dailyExpenses.summary.versements_total)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="account-balance-wallet" size={iconSize.medium} color="#3498DB" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Solde Net
                                            </Text>
                                            <Text style={[
                                                dailyExpenses.summary.solde_net >= 0 ? styles.summaryValueGreen : styles.summaryValueRed,
                                                { fontSize: fontSize.body }
                                            ]}>
                                                {formatCurrency(dailyExpenses.summary.solde_net)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.dailySummaryItem}>
                                        <MaterialIcons name="local-gas-station" size={iconSize.medium} color="#F39C12" />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>
                                                Coût/km
                                            </Text>
                                            <Text style={[styles.summaryValue, { fontSize: fontSize.body }]}>
                                                {formatCurrency(dailyExpenses.summary.cout_km)}/km
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>

                        {/* Missions du jour */}
                        {dailyExpenses.missions && dailyExpenses.missions.length > 0 && (
                            <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                                <Card.Content>
                                    <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                        🚗 Missions ({dailyExpenses.missions.length})
                                    </Text>

                                    {dailyExpenses.missions.map((mission, index) => (
                                        <View key={mission.id} style={styles.missionItem}>
                                            <View style={styles.missionHeader}>
                                                <MaterialIcons name="location-on" size={iconSize.small} color="#E74C3C" />
                                                <Text style={[styles.missionDestination, { fontSize: fontSize.body }]}>
                                                    {mission.destination}
                                                </Text>
                                                <Chip
                                                    style={{
                                                        backgroundColor: mission.statut === 'termine' ? '#E8F5E9' : '#FFF3CD'
                                                    }}
                                                    textStyle={{
                                                        color: mission.statut === 'termine' ? '#27AE60' : '#F39C12',
                                                        fontSize: fontSize.tiny
                                                    }}
                                                >
                                                    {mission.statut}
                                                </Chip>
                                            </View>
                                            <View style={styles.missionDetails}>
                                                <Text style={[styles.missionDetailText, { fontSize: fontSize.tiny }]}>
                                                    ⏰ {mission.heure_depart} {mission.heure_retour && `→ ${mission.heure_retour}`}
                                                </Text>
                                                <Text style={[styles.missionDetailText, { fontSize: fontSize.tiny }]}>
                                                    🛣️ {formatNumber(mission.distance_parcourue || 0)} km • {mission.immatriculation}
                                                </Text>
                                                {mission.frais_mission > 0 && (
                                                    <Text style={[styles.missionDetailText, { fontSize: fontSize.tiny }]}>
                                                        💰 Frais: {formatCurrency(mission.frais_mission)}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        )}

                        {/* Frais du jour */}
                        {dailyExpenses.expenses && dailyExpenses.expenses.length > 0 && (
                            <Card style={[styles.reportCard, { marginBottom: cardMargin }]}>
                                <Card.Content>
                                    <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle }]}>
                                        💰 Frais et Dépenses ({dailyExpenses.expenses.length})
                                    </Text>

                                    {dailyExpenses.expenses.map((expense, index) => (
                                        <View key={expense.id} style={styles.expenseItem}>
                                            <View style={styles.expenseHeader}>
                                                <View style={styles.expenseTypeInfo}>
                                                    <Text style={[styles.expenseTypeText, { fontSize: fontSize.body }]}>
                                                        {expense.type_libelle}
                                                    </Text>
                                                    {expense.destination && (
                                                        <Text style={[styles.expenseDestination, { fontSize: fontSize.tiny }]}>
                                                            📍 {expense.destination}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={[
                                                        expense.type_frais === 'versement_journalier' ? styles.expenseAmountGreen : styles.expenseAmountRed,
                                                        { fontSize: fontSize.body }
                                                    ]}>
                                                        {expense.type_frais === 'versement_journalier' ? '+' : '-'}
                                                        {formatCurrency(expense.montant)}
                                                    </Text>
                                                    <Chip
                                                        style={{
                                                            backgroundColor: expense.valide ? '#E8F5E9' : '#FFF3CD',
                                                            marginTop: 4
                                                        }}
                                                        textStyle={{
                                                            color: expense.valide ? '#27AE60' : '#F39C12',
                                                            fontSize: fontSize.tiny
                                                        }}
                                                    >
                                                        {expense.valide ? 'Validé' : 'En attente'}
                                                    </Chip>
                                                </View>
                                            </View>
                                            {expense.description && (
                                                <Text style={[styles.expenseDescription, { fontSize: fontSize.small }]}>
                                                    {expense.description}
                                                </Text>
                                            )}
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        )}
                    </>
                )}

                {!dailyExpenses && !loadingDailyExpenses && (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="event-busy" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyStateText, { fontSize: fontSize.body }]}>
                            Aucune activité pour cette date
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    const renderIncidentDetailModal = () => {
        if (!selectedIncident) return null;

        const incidentType = INCIDENT_TYPES.find(t => t.value === selectedIncident.type);
        const urgencyLevel = URGENCY_LEVELS.find(u => u.value === selectedIncident.urgency);

        return (
            <Modal
                visible={detailModalVisible}
                animationType="slide"
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { fontSize: fontSize.title }]}>
                            Détails de l'incident
                        </Text>
                        <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                            <MaterialIcons name="close" size={iconSize.large} color="#2C3E50" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {/* Type et urgence */}
                        <View style={styles.detailSection}>
                            <View style={styles.detailRow}>
                                <View style={[
                                    styles.detailIcon,
                                    { backgroundColor: incidentType?.color || '#7F8C8D' }
                                ]}>
                                    <MaterialIcons
                                        name={incidentType?.icon || 'error'}
                                        size={iconSize.medium}
                                        color="#FFF"
                                    />
                                </View>
                                <View style={styles.detailInfo}>
                                    <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>
                                        Type d'incident
                                    </Text>
                                    <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                        {incidentType?.label || selectedIncident.type}
                                    </Text>
                                </View>
                            </View>

                            <Chip
                                mode="flat"
                                style={{
                                    backgroundColor: urgencyLevel?.color || '#7F8C8D',
                                    alignSelf: 'flex-start',
                                    marginTop: 10
                                }}
                                textStyle={{ color: '#FFF', fontSize: fontSize.small }}
                            >
                                Urgence: {urgencyLevel?.label || selectedIncident.urgency}
                            </Chip>
                        </View>

                        {/* Description */}
                        <View style={styles.detailSection}>
                            <Text style={[styles.detailSectionTitle, { fontSize: fontSize.subtitle }]}>
                                Description
                            </Text>
                            <Text style={[styles.detailDescription, { fontSize: fontSize.body }]}>
                                {selectedIncident.description}
                            </Text>
                        </View>

                        {/* Localisation */}
                        <View style={styles.detailSection}>
                            <Text style={[styles.detailSectionTitle, { fontSize: fontSize.subtitle }]}>
                                Localisation
                            </Text>
                            <View style={styles.locationInfo}>
                                <MaterialIcons name="location-on" size={iconSize.medium} color="#E74C3C" />
                                <Text style={[styles.locationText, { fontSize: fontSize.body }]}>
                                    {selectedIncident.location}
                                </Text>
                            </View>
                            {selectedIncident.latitude && selectedIncident.longitude && (
                                <Text style={[styles.coordinates, { fontSize: fontSize.tiny }]}>
                                    📍 {selectedIncident.latitude.toFixed(6)}, {selectedIncident.longitude.toFixed(6)}
                                </Text>
                            )}
                        </View>

                        {/* Photos */}
                        {selectedIncident.photos && selectedIncident.photos.length > 0 && (
                            <View style={styles.detailSection}>
                                <Text style={[styles.detailSectionTitle, { fontSize: fontSize.subtitle }]}>
                                    Photos ({selectedIncident.photos.length})
                                </Text>
                                <View style={styles.photosGrid}>
                                    {selectedIncident.photos.map((photo, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => {
                                                setSelectedImage({ uri: photo.url });
                                                setImageModalVisible(true);
                                            }}
                                        >
                                            <Image
                                                source={{ uri: photo.url }}
                                                style={[
                                                    styles.photoThumbnail,
                                                    {
                                                        width: isMobile ? 100 : 150,
                                                        height: isMobile ? 100 : 150
                                                    }
                                                ]}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Date */}
                        <View style={styles.detailSection}>
                            <Text style={[styles.detailSectionTitle, { fontSize: fontSize.subtitle }]}>
                                Date de déclaration
                            </Text>
                            <Text style={[styles.dateText, { fontSize: fontSize.body }]}>
                                📅 {new Date(selectedIncident.date_incident).toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    // ============================================
    // RENDU PRINCIPAL
    // ============================================
    return (
        <View style={styles.container}>
            {/* Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsContainer}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'nouveau' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('nouveau')}
                >
                    <MaterialIcons
                        name="add-circle-outline"
                        size={iconSize.medium}
                        color={activeTab === 'nouveau' ? '#2E86C1' : '#7F8C8D'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { fontSize: fontSize.body },
                            activeTab === 'nouveau' && styles.tabTextActive
                        ]}
                    >
                        Nouveau
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'historique' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('historique')}
                >
                    <MaterialIcons
                        name="history"
                        size={iconSize.medium}
                        color={activeTab === 'historique' ? '#2E86C1' : '#7F8C8D'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { fontSize: fontSize.body },
                            activeTab === 'historique' && styles.tabTextActive
                        ]}
                    >
                        Historique {incidents.length > 0 && `(${incidents.length})`}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'rapport' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('rapport')}
                >
                    <MaterialIcons
                        name="assessment"
                        size={iconSize.medium}
                        color={activeTab === 'rapport' ? '#2E86C1' : '#7F8C8D'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { fontSize: fontSize.body },
                            activeTab === 'rapport' && styles.tabTextActive
                        ]}
                    >
                        Rapport
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'quotidien' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('quotidien')}
                >
                    <MaterialIcons
                        name="today"
                        size={iconSize.medium}
                        color={activeTab === 'quotidien' ? '#2E86C1' : '#7F8C8D'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { fontSize: fontSize.body },
                            activeTab === 'quotidien' && styles.tabTextActive
                        ]}
                    >
                        Quotidien
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Content */}
            {activeTab === 'nouveau' && renderNewIncidentTab()}
            {activeTab === 'historique' && renderHistoryTab()}
            {activeTab === 'rapport' && renderExpensesReportTab()}
            {activeTab === 'quotidien' && renderDailyExpensesTab()}

            {/* Date Pickers */}
            {showStartDatePicker && (
                <DateTimePicker
                    value={customStartDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setShowStartDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setCustomStartDate(selectedDate);
                    }}
                />
            )}

            {showEndDatePicker && (
                <DateTimePicker
                    value={customEndDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setShowEndDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setCustomEndDate(selectedDate);
                    }}
                />
            )}

            {showDailyDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setShowDailyDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setSelectedDate(selectedDate);
                    }}
                />
            )}

            {/* Image Modal */}
            <Modal
                visible={imageModalVisible}
                transparent={true}
                onRequestClose={() => setImageModalVisible(false)}
                animationType="fade"
            >
                <View style={styles.imageModal}>
                    <TouchableOpacity
                        style={styles.closeModalButton}
                        onPress={() => setImageModalVisible(false)}
                    >
                        <MaterialIcons name="close" size={iconSize.large} color="#FFF" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage.uri || selectedImage.url }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

            {/* Detail Modal */}
            {renderIncidentDetailModal()}
        </View>
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

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
        maxHeight: 50, // Force compact height
        ...Platform.select({
            web: {
                position: 'sticky',
                top: 0,
                zIndex: 100,
            },
        }),
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#2E86C1',
        backgroundColor: '#F8F9FA',
    },
    tabText: {
        marginLeft: 8,
        color: '#7F8C8D',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#2E86C1',
        fontWeight: '700',
    },

    // Content
    tabContent: {
        flex: 1,
    },
    tabContentContainer: {
        paddingBottom: 30,
    },
    formCard: {
        backgroundColor: '#FFF',
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

    // Section
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 12,
    },

    // Type selector
    typeGrid: {
        gap: 10,
    },
    typeCard: {
        aspectRatio: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    typeLabel: {
        marginTop: 8,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Inputs
    textArea: {
        backgroundColor: '#FFF',
        minHeight: 100,
    },
    input: {
        backgroundColor: '#FFF',
    },
    characterCount: {
        textAlign: 'right',
        color: '#7F8C8D',
        marginTop: 5,
    },
    coordinatesText: {
        color: '#2E86C1',
        marginTop: 5,
    },
    locationStatus: {
        color: '#F39C12',
        marginTop: 5,
    },

    // Urgency
    urgencyContainer: {
        gap: 10,
    },
    urgencyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 2,
        paddingVertical: 12,
        paddingHorizontal: 15,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    urgencyLabel: {
        fontWeight: '600',
        marginLeft: -5,
    },

    // Photos
    photoButtons: {
        gap: 10,
    },
    photoButton: {
        flex: 1,
    },
    imageGrid: {
        marginTop: 15,
    },
    imageContainer: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    imageThumb: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    removeImageButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#E74C3C',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyPhotos: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        marginTop: 10,
    },
    emptyPhotosText: {
        color: '#7F8C8D',
        marginTop: 15,
    },

    // Submit
    submitButton: {
        marginTop: 20,
        borderRadius: 10,
    },
    submitButtonContent: {
        paddingVertical: 8,
    },

    // Error
    errorText: {
        color: '#E74C3C',
        marginTop: 5,
    },

    // Incident list
    incidentCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginBottom: 12,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
            },
            default: {
                elevation: 2,
            },
        }),
    },
    incidentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    incidentTypeIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    incidentInfo: {
        flex: 1,
    },
    incidentType: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    incidentDate: {
        color: '#7F8C8D',
        marginTop: 2,
    },
    divider: {
        backgroundColor: '#E8EAED',
        height: 1,
        marginVertical: 10,
    },
    incidentDescription: {
        color: '#7F8C8D',
        lineHeight: 20,
        marginBottom: 10,
    },
    incidentFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F8F9FA',
    },
    incidentLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    incidentLocationText: {
        marginLeft: 5,
        color: '#7F8C8D',
        flex: 1,
    },
    incidentPhotos: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    incidentPhotosText: {
        marginLeft: 5,
        color: '#2E86C1',
        fontWeight: '600',
    },

    // Empty states
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        color: '#7F8C8D',
        marginTop: 20,
        textAlign: 'center',
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 15,
        color: '#7F8C8D',
    },
    loadingMore: {
        paddingVertical: 20,
        alignItems: 'center',
    },

    // Modals
    imageModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeModalButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },

    // Detail Modal
    modalContainer: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
    },
    modalTitle: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    detailSection: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    detailInfo: {
        flex: 1,
    },
    detailLabel: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    detailValue: {
        color: '#2C3E50',
        fontWeight: '600',
    },
    detailSectionTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 12,
    },
    detailDescription: {
        color: '#7F8C8D',
        lineHeight: 22,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    locationText: {
        flex: 1,
        marginLeft: 10,
        color: '#2C3E50',
    },
    coordinates: {
        color: '#2E86C1',
        marginTop: 8,
    },
    photosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    photoThumbnail: {
        borderRadius: 8,
    },
    dateText: {
        color: '#2C3E50',
    },

    // ============================================
    // NOUVEAUX STYLES - RAPPORT & QUOTIDIEN
    // ============================================
    reportCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
            default: {
                elevation: 2,
            },
        }),
    },
    cardTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 15,
    },
    periodSelector: {
        marginTop: 10,
    },
    periodChip: {
        marginBottom: 5,
    },

    // Summary
    summaryGrid: {
        gap: 15,
        marginTop: 10,
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
    },
    summaryLabel: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    summaryValue: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    summaryValueGreen: {
        fontWeight: '700',
        color: '#27AE60',
    },
    summaryValueRed: {
        fontWeight: '700',
        color: '#E74C3C',
    },

    // Expense types
    expenseTypeItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    expenseTypeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    expenseTypeLabel: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    expenseTypeAmount: {
        fontWeight: '700',
        color: '#E74C3C',
    },
    expenseTypeDetails: {
        gap: 4,
    },
    expenseTypeDetailText: {
        color: '#7F8C8D',
    },

    // Revenue
    revenueItem: {
        gap: 10,
    },
    revenueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    revenueLabel: {
        color: '#7F8C8D',
    },
    revenueValue: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    revenueValueGreen: {
        fontWeight: '700',
        color: '#27AE60',
    },

    // Daily breakdown
    dailyItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    dailyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dailyDate: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    dailyDetails: {
        gap: 6,
    },
    dailyDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dailyDetailLabel: {
        color: '#7F8C8D',
    },
    dailyDetailValue: {
        color: '#2C3E50',
    },
    // Daily expenses summary
    dailySummaryGrid: {
        gap: 12,
        marginTop: 10,
    },
    dailySummaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 8,
    },

    // Mission item
    missionItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    missionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    missionDestination: {
        flex: 1,
        fontWeight: '600',
        color: '#2C3E50',
    },
    missionDetails: {
        gap: 4,
        marginLeft: 24,
    },
    missionDetailText: {
        color: '#7F8C8D',
    },

    // Expense item
    expenseItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    expenseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    expenseTypeInfo: {
        flex: 1,
        marginRight: 10,
    },
    expenseTypeText: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    expenseDestination: {
        color: '#7F8C8D',
    },
    expenseAmountGreen: {
        fontWeight: '700',
        color: '#27AE60',
    },
    expenseAmountRed: {
        fontWeight: '700',
        color: '#E74C3C',
    },
    expenseDescription: {
        color: '#7F8C8D',
        lineHeight: 18,
    },
});
export default IncidentsScreen;