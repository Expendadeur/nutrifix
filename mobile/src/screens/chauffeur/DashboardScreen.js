// mobile/src/screens/chauffeur/DashboardScreenComplete.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Text,
    Alert,
    useWindowDimensions,
    Platform,
    ActivityIndicator,
    Animated,
    Dimensions
} from 'react-native';
import { Card, Button, Badge, Divider, SegmentedButtons, Modal, Portal, TextInput, IconButton } from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { setupNotificationListener } from '../../services/notificationsSocket';

// Configuration API
const API_BASE_URL = Platform.select({
    web: process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com',
    default: 'https://nutrifix-1-twdf.onrender.com'
});

const DashboardScreen = ({ navigation }) => {
    const windowDimensions = useWindowDimensions();
    const screenWidth = Dimensions.get('window').width;

    // ============================================
    // ÉTATS PRINCIPAUX
    // ============================================
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // États données existantes
    const [dashboardData, setDashboardData] = useState(null);
    const [vehicle, setVehicle] = useState(null);
    const [currentMission, setCurrentMission] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [insuranceAlerts, setInsuranceAlerts] = useState([]);

    // États nouvelles données
    const [expenseCharts, setExpenseCharts] = useState(null);
    const [currentSalary, setCurrentSalary] = useState(null);
    const [salaryHistory, setSalaryHistory] = useState(null);

    // États UI
    const [selectedChartPeriod, setSelectedChartPeriod] = useState('month');
    const [selectedSalaryYear, setSelectedSalaryYear] = useState(new Date().getFullYear());
    const [expandedSections, setExpandedSections] = useState({
        expenses: true,
        salary: false,
        salaryHistory: false
    });

    // ÉTATS COMMUNICATION
    const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
    const [messageSubject, setMessageSubject] = useState('');
    const [messageBody, setMessageBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    // États localisation
    const [location, setLocation] = useState(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [address, setAddress] = useState('Localisation en cours...');
    const [locationError, setLocationError] = useState(null);

    // État token
    const [authToken, setAuthToken] = useState(null);

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
            mobileLarge = 18,
            tablet = 25,
            laptop = 30,
            desktop = 35,
            desktopLarge = 50
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

    // Valeurs responsives
    const containerPadding = getResponsiveValue({
        mobile: 10,
        mobileLarge: 15,
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

    const cardPadding = getResponsiveValue({
        mobile: 12,
        mobileLarge: 15,
        tablet: 18,
        laptop: 20,
        desktop: 22,
        desktopLarge: 25
    });

    const fontSize = {
        title: getResponsiveValue({ mobile: 20, tablet: 22, laptop: 24, desktop: 26 }),
        subtitle: getResponsiveValue({ mobile: 16, tablet: 18, laptop: 20, desktop: 22 }),
        body: getResponsiveValue({ mobile: 14, tablet: 15, laptop: 16, desktop: 16 }),
        small: getResponsiveValue({ mobile: 12, tablet: 13, laptop: 14, desktop: 14 }),
        tiny: getResponsiveValue({ mobile: 11, tablet: 12, laptop: 12, desktop: 13 })
    };

    const iconSize = {
        small: getResponsiveValue({ mobile: 16, tablet: 18, laptop: 20, desktop: 20 }),
        medium: getResponsiveValue({ mobile: 20, tablet: 22, laptop: 24, desktop: 24 }),
        large: getResponsiveValue({ mobile: 24, tablet: 28, laptop: 30, desktop: 32 }),
        xlarge: getResponsiveValue({ mobile: 50, tablet: 55, laptop: 60, desktop: 65 })
    };

    const apiCall = async (endpoint, method = 'GET', data = null) => {
        try {
            const token = await AsyncStorage.getItem('userToken');

            console.log('TOKEN RÉCUPÉRÉ :', token);

            if (!token) {
                console.warn('Aucun token trouvé dans AsyncStorage');
                throw new Error("Token d'authentification manquant");
            }

            const response = await axios({
                method,
                url: `${API_BASE_URL}${endpoint}`,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                data: data && ['POST', 'PUT'].includes(method) ? data : undefined,
            });

            console.log(`API OK [${method}] ${endpoint}`, response.data);

            return response.data;
        } catch (error) {
            console.error(
                `API Error [${method}] ${endpoint}`,
                error.response?.data || error.message
            );

            if (error.response?.status === 401) {
                console.warn('401 → Déconnexion automatique');
                await AsyncStorage.removeItem('userToken');
                navigation?.replace('Login');
            }

            throw error;
        }
    };

    const handleSendMessage = async () => {
        if (!messageSubject.trim() || !messageBody.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le sujet et le message');
            return;
        }

        try {
            setIsSending(true);
            const response = await apiCall('/api/notifications/contact-admin', 'POST', {
                sujet: messageSubject,
                message: messageBody
            });

            if (response.success) {
                Alert.alert('Succès', 'Votre message a été envoyé à l\'administration');
                setCommunicationModalVisible(false);
                setMessageSubject('');
                setMessageBody('');
            } else {
                Alert.alert('Erreur', response.message || 'Impossible d\'envoyer le message');
            }
        } catch (error) {
            console.error('❌ Erreur envoi message:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi');
        } finally {
            setIsSending(false);
        }
    };


    // ============================================
    // CHARGEMENT DONNÉES
    // ============================================
    const loadDashboardData = async () => {
        try {
            const result = await apiCall('/api/chauffeur/dashboard');

            if (result.success) {
                setDashboardData(result.data);
                if (result.data?.chauffeur?.id) {
                    setUserId(result.data.chauffeur.id);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadVehicleInfo = async () => {
        try {
            const result = await apiCall('/api/chauffeur/vehicle');
            if (result.success) {
                setVehicle(result.data);
            }
        } catch (error) {
            console.error('Load vehicle error:', error);
        }
    };

    const loadCurrentMission = async () => {
        try {
            const result = await apiCall('/api/chauffeur/missions/current');
            if (result.success) {
                setCurrentMission(result.data);
            }
        } catch (error) {
            console.error('Load mission error:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const result = await apiCall('/api/chauffeur/notifications?limit=5&unread_only=false');
            if (result.success) {
                setNotifications(result.data || []);
            }
        } catch (error) {
            console.error('Load notifications error:', error);
        }
    };

    const loadStatistics = async () => {
        try {
            const result = await apiCall('/api/chauffeur/statistics?period=today');
            if (result.success) {
                setStatistics(result.data);
            }
        } catch (error) {
            console.error('Load statistics error:', error);
        }
    };

    const loadMaintenanceAlerts = async () => {
        try {
            const result = await apiCall('/api/chauffeur/maintenance/upcoming');
            if (result.success) {
                setMaintenanceAlerts(result.data || []);
            }
        } catch (error) {
            console.error('Load maintenance error:', error);
        }
    };

    const loadInsuranceAlerts = async () => {
        try {
            const result = await apiCall('/api/chauffeur/insurance/alerts');
            if (result.success) {
                setInsuranceAlerts(result.data || []);
            }
        } catch (error) {
            console.error('Load insurance error:', error);
        }
    };

    // NOUVELLES FONCTIONS DE CHARGEMENT
    const loadExpenseCharts = async () => {
        try {
            const result = await apiCall(`/api/chauffeur/expenses/charts?period=${selectedChartPeriod}`);
            if (result.success) {
                setExpenseCharts(result.data);
            }
        } catch (error) {
            console.error('Load expense charts error:', error);
        }
    };

    const loadCurrentSalary = async () => {
        try {
            const result = await apiCall('/api/chauffeur/salary/current');
            if (result.success) {
                setCurrentSalary(result.data);
            }
        } catch (error) {
            console.error('Load current salary error:', error);
        }
    };

    const loadSalaryHistory = async () => {
        try {
            const result = await apiCall(`/api/chauffeur/salary/history?year=${selectedSalaryYear}`);
            if (result.success) {
                setSalaryHistory(result.data);
            }
        } catch (error) {
            console.error('Load salary history error:', error);
        }
    };

    const initializeScreen = async () => {
        setLoading(true);
        setError(null);

        try {
            await Promise.allSettled([
                loadDashboardData(),
                loadVehicleInfo(),
                loadCurrentMission(),
                loadNotifications(),
                loadStatistics(),
                loadMaintenanceAlerts(),
                loadInsuranceAlerts(),
                loadExpenseCharts(),
                loadCurrentSalary(),
                loadSalaryHistory()
            ]);
        } catch (error) {
            console.error('Initialize error:', error);
            setError('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // LOCALISATION GPS
    // ============================================
    const requestLocationPermission = async () => {
        try {
            setLocationError(null);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                setLocationPermission(true);
                await getCurrentLocation();
                startLocationTracking();
            } else {
                setLocationError('Permission de localisation refusée');
                if (Platform.OS !== 'web') {
                    Alert.alert(
                        'Permission Requise',
                        'L\'accès à la localisation est nécessaire pour suivre vos missions.',
                        [
                            { text: 'Annuler', style: 'cancel' },
                            { text: 'Paramètres', onPress: () => Location.requestForegroundPermissionsAsync() }
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Location permission error:', error);
            setLocationError('Erreur de permission GPS');
        }
    };

    const getCurrentLocation = async () => {
        try {
            setAddress('Localisation en cours...');

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeout: 10000
            });

            setLocation(location.coords);

            try {
                const addresses = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });

                if (addresses && addresses.length > 0) {
                    const addr = addresses[0];
                    const parts = [
                        addr.street,
                        addr.city,
                        addr.region,
                        addr.country
                    ].filter(Boolean);

                    setAddress(parts.join(', ') || 'Adresse inconnue');
                }
            } catch (geoError) {
                console.error('Reverse geocoding error:', geoError);
                setAddress(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
            }

            if (currentMission) {
                try {
                    await apiCall('/api/chauffeur/location/update', 'POST', {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        timestamp: new Date().toISOString(),
                        mission_id: currentMission.id
                    });
                } catch (updateError) {
                    console.error('Update location error:', updateError);
                }
            }
        } catch (error) {
            console.error('Get location error:', error);
            setLocationError('Impossible d\'obtenir la position');
            setAddress('Position non disponible');
        }
    };

    const startLocationTracking = () => {
        const interval = setInterval(() => {
            if (currentMission && locationPermission) {
                getCurrentLocation();
            }
        }, 30000);

        return () => clearInterval(interval);
    };

    // ============================================
    // ACTIONS
    // ============================================
    const handleStartMission = () => {
        if (!vehicle || !vehicle.disponible) {
            Alert.alert(
                'Véhicule non disponible',
                'Votre véhicule n\'est pas disponible pour démarrer une mission.'
            );
            return;
        }
        navigation.navigate('Operations', { screen: 'StartMission' });
    };

    const handleEndMission = () => {
        if (currentMission) {
            navigation.navigate('Operations', {
                screen: 'EndMission',
                params: { mission: currentMission }
            });
        }
    };

    const handleMarkNotificationRead = async (notificationId) => {
        try {
            await apiCall(`/api/chauffeur/notifications/${notificationId}/read`, 'PUT');
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId
                        ? { ...notif, statut: 'lu' }
                        : notif
                )
            );
        } catch (error) {
            console.error('Mark notification error:', error);
        }
    };

    const handleChartPeriodChange = (period) => {
        setSelectedChartPeriod(period);
    };

    const handleSalaryYearChange = (year) => {
        setSelectedSalaryYear(year);
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await initializeScreen();
        if (locationPermission) {
            await getCurrentLocation();
        }
        setRefreshing(false);
    };

    // ============================================
    // EFFETS
    // ============================================
    useEffect(() => {
        initializeScreen();
        requestLocationPermission();
    }, []);

    useEffect(() => {
        loadExpenseCharts();
    }, [selectedChartPeriod]);

    useEffect(() => {
        loadSalaryHistory();
    }, [selectedSalaryYear]);

    useEffect(() => {
        let locationInterval;
        if (currentMission && locationPermission) {
            locationInterval = startLocationTracking();
        }
        return () => {
            if (locationInterval) {
                clearInterval(locationInterval);
            }
        };
    }, [currentMission, locationPermission]);

    useEffect(() => {
        if (!userId) return;

        const cleanup = setupNotificationListener(userId, (newNotif) => {
            setNotifications(prev => [newNotif, ...prev]);
            Alert.alert(newNotif.titre, newNotif.message);
        });

        return () => {
            if (cleanup) cleanup();
        };
    }, [userId]);

    // ============================================
    // HELPERS ET FORMATAGE
    // ============================================
    const getNotificationColor = (type) => {
        const colors = {
            mission: '#2E86C1',
            maintenance: '#F39C12',
            alerte: '#E74C3C',
            info: '#3498DB',
            systeme: '#9B59B6',
            approbation: '#27AE60'
        };
        return colors[type] || '#7F8C8D';
    };

    const getNotificationIcon = (type) => {
        const icons = {
            mission: 'assignment',
            maintenance: 'build',
            alerte: 'warning',
            info: 'info',
            systeme: 'settings',
            approbation: 'check-circle'
        };
        return icons[type] || 'notifications';
    };

    const formatTimeAgo = (date) => {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays}j`;
        return past.toLocaleDateString('fr-FR');
    };

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
    // TRAITEMENT DES DONNÉES POUR GRAPHIQUES
    // ============================================
    const chartDataForLine = useMemo(() => {
        if (!expenseCharts || !expenseCharts.trend) return null;

        const data = expenseCharts.trend;
        return {
            labels: data.slice(0, 7).map(item => item.periode),
            datasets: [
                {
                    data: data.slice(0, 7).map(item => item.depenses || 0),
                    color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
                    strokeWidth: 2,
                    name: 'Dépenses'
                },
                {
                    data: data.slice(0, 7).map(item => item.recettes || 0),
                    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
                    strokeWidth: 2,
                    name: 'Recettes'
                }
            ]
        };
    }, [expenseCharts]);

    const chartDataForPie = useMemo(() => {
        if (!expenseCharts || !expenseCharts.expense_breakdown) return null;

        return expenseCharts.expense_breakdown.map((item, index) => ({
            name: item.type_libelle,
            value: item.montant,
            color: [
                '#E74C3C',
                '#F39C12',
                '#3498DB',
                '#2ECC71',
                '#9B59B6',
                '#1ABC9C'
            ][index % 6],
            legendFontColor: '#7F8C8D',
            legendFontSize: 12
        }));
    }, [expenseCharts]);

    // ============================================
    // COMPOSANTS DE RENDU
    // ============================================
    const renderVehicleCard = () => {
        if (!vehicle) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="directions-car" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            Aucun véhicule assigné
                        </Text>
                    </View>
                </Card>
            );
        }

        const fuelLevel = vehicle.niveau_carburant || 0;
        const fuelColor = fuelLevel < 25 ? '#E74C3C' : fuelLevel < 50 ? '#F39C12' : '#2ECC71';
        const statsPerRow = isMobile ? 1 : isTablet ? 2 : 3;

        return (
            <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <MaterialIcons name="directions-car" size={iconSize.medium} color="#2E86C1" />
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle, marginLeft: 10 }]}>
                            Véhicule Assigné
                        </Text>
                    </View>
                    <Badge
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: vehicle.statut === 'actif' ? '#2ECC71' : '#E74C3C',
                                fontSize: fontSize.small
                            }
                        ]}
                    >
                        {vehicle.statut?.toUpperCase()}
                    </Badge>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleImmat, { fontSize: fontSize.title }]}>
                        {vehicle.immatriculation}
                    </Text>
                    <Text style={[styles.vehicleModel, { fontSize: fontSize.body }]}>
                        {vehicle.marque} {vehicle.modele}
                    </Text>
                    {vehicle.annee && (
                        <Text style={[styles.vehicleYear, { fontSize: fontSize.small }]}>
                            Année: {vehicle.annee}
                        </Text>
                    )}
                </View>

                <View style={[
                    styles.statsGrid,
                    {
                        flexDirection: isMobile ? 'column' : 'row',
                        flexWrap: !isMobile ? 'wrap' : 'nowrap',
                        marginTop: 20
                    }
                ]}>
                    <View style={[
                        styles.statBox,
                        isMobile ? styles.statBoxMobile : { width: `${100 / statsPerRow - 2}%` }
                    ]}>
                        <MaterialIcons name="speed" size={iconSize.large} color="#2E86C1" />
                        <Text style={[styles.statValue, { fontSize: fontSize.subtitle }]}>
                            {formatNumber(vehicle.kilometrage_actuel)} km
                        </Text>
                        <Text style={[styles.statLabel, { fontSize: fontSize.small }]}>
                            Kilométrage
                        </Text>
                    </View>

                    <View style={[
                        styles.statBox,
                        isMobile ? styles.statBoxMobile : { width: `${100 / statsPerRow - 2}%` }
                    ]}>
                        <MaterialIcons name="local-gas-station" size={iconSize.large} color={fuelColor} />
                        <Text style={[styles.statValue, { color: fuelColor, fontSize: fontSize.subtitle }]}>
                            {fuelLevel}%
                        </Text>
                        <Text style={[styles.statLabel, { fontSize: fontSize.small }]}>
                            Carburant
                        </Text>
                    </View>

                    <View style={[
                        styles.statBox,
                        isMobile ? styles.statBoxMobile : { width: `${100 / statsPerRow - 2}%` }
                    ]}>
                        <MaterialIcons name="build" size={iconSize.large} color="#F39C12" />
                        <Text style={[styles.statValue, { fontSize: fontSize.subtitle }]}>
                            {vehicle.maintenances_planifiees || 0}
                        </Text>
                        <Text style={[styles.statLabel, { fontSize: fontSize.small }]}>
                            Maintenances
                        </Text>
                    </View>
                </View>

                {(vehicle.alerts && vehicle.alerts.length > 0) && (
                    <>
                        <Divider style={[styles.divider, { marginTop: 15 }]} />
                        <View style={styles.alertsContainer}>
                            {vehicle.alerts.map((alert, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.alertBox,
                                        { backgroundColor: alert.urgence === 'haute' ? '#FADBD8' : '#FFF3CD' }
                                    ]}
                                >
                                    <MaterialIcons
                                        name="warning"
                                        size={iconSize.small}
                                        color={alert.urgence === 'haute' ? '#E74C3C' : '#F39C12'}
                                    />
                                    <Text style={[styles.alertText, { fontSize: fontSize.small, marginLeft: 8 }]}>
                                        {alert.message}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </Card>
        );
    };

    const renderMissionCard = () => {
        if (!currentMission) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="assignment" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            Aucune mission en cours
                        </Text>
                        <Button
                            mode="contained"
                            onPress={handleStartMission}
                            style={[styles.actionButton, { marginTop: 20 }]}
                            icon="play-arrow"
                            labelStyle={{ fontSize: fontSize.body }}
                        >
                            Démarrer une mission
                        </Button>
                    </View>
                </Card>
            );
        }

        return (
            <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <MaterialIcons name="assignment" size={iconSize.medium} color="#3498DB" />
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle, marginLeft: 10 }]}>
                            Mission en Cours
                        </Text>
                    </View>
                    <Badge style={[styles.activeBadge, { fontSize: fontSize.small }]}>
                        EN COURS
                    </Badge>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.missionDetails}>
                    <View style={styles.detailRow}>
                        <MaterialIcons name="location-on" size={iconSize.medium} color="#E74C3C" />
                        <View style={styles.detailContent}>
                            <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>Destination</Text>
                            <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                {currentMission.destination}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <MaterialIcons name="description" size={iconSize.medium} color="#7F8C8D" />
                        <View style={styles.detailContent}>
                            <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>Motif</Text>
                            <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                {currentMission.motif}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <MaterialIcons name="access-time" size={iconSize.medium} color="#3498DB" />
                        <View style={styles.detailContent}>
                            <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>Heure de départ</Text>
                            <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                {currentMission.heure_depart}
                            </Text>
                        </View>
                    </View>

                    {currentMission.passagers && (
                        <View style={styles.detailRow}>
                            <MaterialIcons name="people" size={iconSize.medium} color="#27AE60" />
                            <View style={styles.detailContent}>
                                <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>Passagers</Text>
                                <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                    {currentMission.passagers}
                                </Text>
                            </View>
                        </View>
                    )}

                    {currentMission.kilometrage_depart && (
                        <View style={styles.detailRow}>
                            <MaterialIcons name="speed" size={iconSize.medium} color="#F39C12" />
                            <View style={styles.detailContent}>
                                <Text style={[styles.detailLabel, { fontSize: fontSize.small }]}>KM Départ</Text>
                                <Text style={[styles.detailValue, { fontSize: fontSize.body }]}>
                                    {formatNumber(currentMission.kilometrage_depart)} km
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                <Button
                    mode="contained"
                    onPress={handleEndMission}
                    style={[styles.actionButton, { marginTop: 20 }]}
                    buttonColor="#E74C3C"
                    icon="stop"
                    labelStyle={{ fontSize: fontSize.body }}
                >
                    Terminer la mission
                </Button>
            </Card>
        );
    };

    const renderExpenseChartsCard = () => {
        if (!expenseCharts) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="bar-chart" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            Aucune donnée de frais disponible
                        </Text>
                    </View>
                </Card>
            );
        }

        return (
            <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleSection('expenses')}
                >
                    <View style={styles.cardHeaderLeft}>
                        <MaterialIcons name="bar-chart" size={iconSize.medium} color="#E74C3C" />
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle, marginLeft: 10 }]}>
                            Frais & Recettes
                        </Text>
                    </View>
                    <MaterialIcons
                        name={expandedSections.expenses ? "expand-less" : "expand-more"}
                        size={iconSize.medium}
                        color="#7F8C8D"
                    />
                </TouchableOpacity>

                {expandedSections.expenses && (
                    <>
                        <Divider style={styles.divider} />

                        {/* Sélecteur de période */}
                        <View style={styles.periodSelector}>
                            <SegmentedButtons
                                value={selectedChartPeriod}
                                onValueChange={handleChartPeriodChange}
                                buttons={[
                                    { value: 'today', label: 'Aujourd\'hui' },
                                    { value: 'week', label: 'Semaine' },
                                    { value: 'month', label: 'Mois' },
                                    { value: 'year', label: 'Année' },
                                ]}
                                style={{ marginBottom: 15 }}
                            />
                        </View>

                        {/* Résumé */}
                        <View style={styles.summaryBox}>
                            <View style={[styles.summaryItem, { borderBottomWidth: 1, borderBottomColor: '#E8EAED', paddingBottom: 12, marginBottom: 12 }]}>
                                <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>Dépenses Totales</Text>
                                <Text style={[styles.summaryValue, { fontSize: fontSize.subtitle, color: '#E74C3C' }]}>
                                    {formatCurrency(expenseCharts.summary?.total_depenses || 0)}
                                </Text>
                            </View>

                            <View style={[styles.summaryItem, { borderBottomWidth: 1, borderBottomColor: '#E8EAED', paddingBottom: 12, marginBottom: 12 }]}>
                                <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>Recettes Totales</Text>
                                <Text style={[styles.summaryValue, { fontSize: fontSize.subtitle, color: '#2ECC71' }]}>
                                    {formatCurrency(expenseCharts.summary?.total_recettes || 0)}
                                </Text>
                            </View>

                            <View style={styles.summaryItem}>
                                <Text style={[styles.summaryLabel, { fontSize: fontSize.small }]}>Solde Net</Text>
                                <Text style={[
                                    styles.summaryValue,
                                    {
                                        fontSize: fontSize.subtitle,
                                        color: (expenseCharts.summary?.solde_net || 0) >= 0 ? '#27AE60' : '#E74C3C'
                                    }
                                ]}>
                                    {formatCurrency(expenseCharts.summary?.solde_net || 0)}
                                </Text>
                            </View>
                        </View>

                        {/* Graphique en ligne (Tendance) */}
                        {chartDataForLine && !isMobile && (
                            <View style={styles.chartContainer}>
                                <Text style={[styles.chartTitle, { fontSize: fontSize.body, marginBottom: 10 }]}>
                                    Tendance Dépenses vs Recettes
                                </Text>
                                <LineChart
                                    data={chartDataForLine}
                                    width={screenWidth - 60}
                                    height={220}
                                    chartConfig={{
                                        backgroundColor: '#FFF',
                                        backgroundGradientFrom: '#FFF',
                                        backgroundGradientTo: '#FFF',
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(127, 140, 141, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(127, 140, 141, ${opacity})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: {
                                            r: '6',
                                            strokeWidth: '2'
                                        }
                                    }}
                                    bezier
                                    style={styles.chart}
                                    yAxisLabel="FBU"
                                />
                            </View>
                        )}

                        {/* Graphique en pie (Répartition) */}
                        {chartDataForPie && !isMobile && (
                            <View style={styles.chartContainer}>
                                <Text style={[styles.chartTitle, { fontSize: fontSize.body, marginBottom: 10 }]}>
                                    Répartition par Type de Frais
                                </Text>
                                <PieChart
                                    data={chartDataForPie}
                                    width={screenWidth - 60}
                                    height={220}
                                    chartConfig={{
                                        color: (opacity = 1) => `rgba(26, 188, 156, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(127, 140, 141, ${opacity})`
                                    }}
                                    accessor="value"
                                    style={styles.chart}
                                />
                            </View>
                        )}

                        {/* Détails par type (Mobile) */}
                        {expenseCharts.expense_breakdown && (
                            <View style={styles.expenseTypesList}>
                                <Text style={[styles.chartsSubtitle, { fontSize: fontSize.body, marginBottom: 10 }]}>
                                    Détails par Type
                                </Text>
                                {expenseCharts.expense_breakdown.map((item, index) => (
                                    <View key={index} style={[styles.expenseTypeItem, { borderBottomWidth: index < expenseCharts.expense_breakdown.length - 1 ? 1 : 0, borderBottomColor: '#E8EAED', paddingBottom: 10, marginBottom: 10 }]}>
                                        <View style={styles.expenseTypeLeft}>
                                            <View style={[styles.expenseTypeDot, {
                                                backgroundColor: [
                                                    '#E74C3C',
                                                    '#F39C12',
                                                    '#3498DB',
                                                    '#2ECC71',
                                                    '#9B59B6',
                                                    '#1ABC9C'
                                                ][index % 6]
                                            }]} />
                                            <View style={styles.expenseTypeInfo}>
                                                <Text style={[styles.expenseTypeName, { fontSize: fontSize.body }]}>
                                                    {item.type_libelle}
                                                </Text>
                                                <Text style={[styles.expenseTypeCount, { fontSize: fontSize.small }]}>
                                                    {item.nombre} transactions
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.expenseTypeAmount, { fontSize: fontSize.body }]}>
                                            {formatCurrency(item.montant)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </Card>
        );
    };

    const renderCurrentSalaryCard = () => {
        if (!currentSalary) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="money" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            Aucun salaire calculé
                        </Text>
                    </View>
                </Card>
            );
        }

        const { data } = currentSalary;
        const { details, infos_paiement } = data;

        return (
            <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleSection('salary')}
                >
                    <View style={styles.cardHeaderLeft}>
                        <MaterialIcons name="money" size={iconSize.medium} color="#27AE60" />
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle, marginLeft: 10 }]}>
                            💰 Salaire Courant
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Badge style={{ backgroundColor: infos_paiement.statut === 'payé' ? '#2ECC71' : '#F39C12' }}>
                            {infos_paiement.statut?.toUpperCase()}
                        </Badge>
                        <MaterialIcons
                            name={expandedSections.salary ? "expand-less" : "expand-more"}
                            size={iconSize.medium}
                            color="#7F8C8D"
                            style={{ marginLeft: 10 }}
                        />
                    </View>
                </TouchableOpacity>

                {expandedSections.salary && (
                    <>
                        <Divider style={styles.divider} />

                        {/* Montant principal */}
                        <View style={[styles.salaryMainBox, { backgroundColor: '#F0F7FF', padding: 15, borderRadius: 10, marginBottom: 15 }]}>
                            <Text style={[styles.salaryMonthLabel, { fontSize: fontSize.small }]}>
                                Salaire Net - {data.mois}/{data.annee}
                            </Text>
                            <Text style={[styles.salaryMainAmount, { fontSize: fontSize.title }]}>
                                {formatCurrency(details.net.montant)}
                            </Text>
                        </View>

                        {/* Détails de calcul */}
                        <View style={styles.salarySection}>
                            <Text style={[styles.salarySectionTitle, { fontSize: fontSize.body }]}>
                                Détails du Calcul
                            </Text>

                            <View style={styles.salaryRow}>
                                <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Salaire de Base</Text>
                                <Text style={[styles.salaryRowValue, { fontSize: fontSize.small }]}>
                                    {formatCurrency(details.brut.salaire_base)}
                                </Text>
                            </View>

                            {details.brut.heures_supp > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Heures Supplémentaires</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small }]}>
                                        {formatCurrency(details.brut.heures_supp)}
                                    </Text>
                                </View>
                            )}

                            {details.brut.primes > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Primes</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#27AE60' }]}>
                                        +{formatCurrency(details.brut.primes)}
                                    </Text>
                                </View>
                            )}

                            {details.brut.indemnites > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Indemnités</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#27AE60' }]}>
                                        +{formatCurrency(details.brut.indemnites)}
                                    </Text>
                                </View>
                            )}

                            {details.brut.commissions > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Commissions</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#27AE60' }]}>
                                        +{formatCurrency(details.brut.commissions)}
                                    </Text>
                                </View>
                            )}

                            <Divider style={styles.salaryDivider} />

                            <View style={[styles.salaryRow, { borderBottomWidth: 0 }]}>
                                <Text style={[styles.salaryRowLabelBold, { fontSize: fontSize.body }]}>Brut Total</Text>
                                <Text style={[styles.salaryRowValueBold, { fontSize: fontSize.body }]}>
                                    {formatCurrency(details.brut.total)}
                                </Text>
                            </View>
                        </View>

                        {/* Déductions */}
                        <View style={styles.salarySection}>
                            <Text style={[styles.salarySectionTitle, { fontSize: fontSize.body }]}>
                                Déductions
                            </Text>

                            <View style={styles.salaryRow}>
                                <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>INSS</Text>
                                <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#E74C3C' }]}>
                                    -{formatCurrency(details.deductions.inss)}
                                </Text>
                            </View>

                            <View style={styles.salaryRow}>
                                <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Impôts</Text>
                                <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#E74C3C' }]}>
                                    -{formatCurrency(details.deductions.impots)}
                                </Text>
                            </View>

                            {details.deductions.autres > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Autres Déductions</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#E74C3C' }]}>
                                        -{formatCurrency(details.deductions.autres)}
                                    </Text>
                                </View>
                            )}

                            {details.deductions.avances > 0 && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Avances</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small, color: '#E74C3C' }]}>
                                        -{formatCurrency(details.deductions.avances)}
                                    </Text>
                                </View>
                            )}

                            <Divider style={styles.salaryDivider} />

                            <View style={[styles.salaryRow, { borderBottomWidth: 0 }]}>
                                <Text style={[styles.salaryRowLabelBold, { fontSize: fontSize.body }]}>Total Déductions</Text>
                                <Text style={[styles.salaryRowValueBold, { fontSize: fontSize.body, color: '#E74C3C' }]}>
                                    -{formatCurrency(details.deductions.total)}
                                </Text>
                            </View>
                        </View>

                        {/* Infos paiement */}
                        <View style={styles.salarySection}>
                            <Text style={[styles.salarySectionTitle, { fontSize: fontSize.body }]}>
                                Paiement
                            </Text>

                            <View style={styles.salaryRow}>
                                <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Mode de Paiement</Text>
                                <Text style={[styles.salaryRowValue, { fontSize: fontSize.small }]}>
                                    {details.net.mode_paiement || 'Virement Bancaire'}
                                </Text>
                            </View>

                            {details.net.date_paiement && (
                                <View style={styles.salaryRow}>
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small }]}>Date de Paiement</Text>
                                    <Text style={[styles.salaryRowValue, { fontSize: fontSize.small }]}>
                                        {new Date(details.net.date_paiement).toLocaleDateString('fr-FR')}
                                    </Text>
                                </View>
                            )}

                            {infos_paiement.en_retard && (
                                <View style={[styles.salaryRow, { backgroundColor: '#FADBD8', padding: 10, borderRadius: 8, marginTop: 10 }]}>
                                    <MaterialIcons name="warning" size={iconSize.medium} color="#E74C3C" />
                                    <Text style={[styles.salaryRowLabel, { fontSize: fontSize.small, marginLeft: 8, flex: 1, color: '#E74C3C' }]}>
                                        Paiement en retard
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Boutons d'action */}
                        <View style={[styles.salaryActions, { marginTop: 15, gap: 10 }]}>
                            <Button
                                mode="outlined"
                                onPress={() => navigation.navigate('SalaryDetails')}
                                style={{ flex: 1 }}
                                icon="document"
                                labelStyle={{ fontSize: fontSize.small }}
                            >
                                Voir Détails
                            </Button>
                            {infos_paiement.statut === 'payé' && (
                                <Button
                                    mode="contained"
                                    buttonColor="#27AE60"
                                    onPress={() => navigation.navigate('ConfirmSalary')}
                                    style={{ flex: 1 }}
                                    icon="check-circle"
                                    labelStyle={{ fontSize: fontSize.small }}
                                >
                                    Confirmer Réception
                                </Button>
                            )}
                        </View>
                    </>
                )}
            </Card>
        );
    };

    const renderSalaryHistoryCard = () => {
        if (!salaryHistory) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="history" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            Aucun historique disponible
                        </Text>
                    </View>
                </Card>
            );
        }

        const { salaires, summary } = salaryHistory;

        return (
            <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleSection('salaryHistory')}
                >
                    <View style={styles.cardHeaderLeft}>
                        <MaterialIcons name="history" size={iconSize.medium} color="#3498DB" />
                        <Text style={[styles.cardTitle, { fontSize: fontSize.subtitle, marginLeft: 10 }]}>
                            Historique des Salaires
                        </Text>
                    </View>
                    <MaterialIcons
                        name={expandedSections.salaryHistory ? "expand-less" : "expand-more"}
                        size={iconSize.medium}
                        color="#7F8C8D"
                    />
                </TouchableOpacity>

                {expandedSections.salaryHistory && (
                    <>
                        <Divider style={styles.divider} />

                        {/* Sélecteur d'année */}
                        <View style={styles.yearSelector}>
                            <TouchableOpacity
                                onPress={() => handleSalaryYearChange(selectedSalaryYear - 1)}
                                style={styles.yearButton}
                            >
                                <MaterialIcons name="chevron-left" size={iconSize.medium} color="#2E86C1" />
                            </TouchableOpacity>
                            <Text style={[styles.yearLabel, { fontSize: fontSize.body }]}>
                                Année {selectedSalaryYear}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handleSalaryYearChange(selectedSalaryYear + 1)}
                                style={styles.yearButton}
                            >
                                <MaterialIcons name="chevron-right" size={iconSize.medium} color="#2E86C1" />
                            </TouchableOpacity>
                        </View>

                        {/* Résumé annuel */}
                        {summary && (
                            <View style={styles.summaryGrid}>
                                <View style={[styles.summaryCard, { backgroundColor: '#EBF5FB' }]}>
                                    <Text style={[styles.summarySmallLabel, { fontSize: fontSize.tiny }]}>
                                        Brut Annuel
                                    </Text>
                                    <Text style={[styles.summarySmallValue, { fontSize: fontSize.subtitle, color: '#2E86C1' }]}>
                                        {formatCurrency(summary.total_brut_annuel)}
                                    </Text>
                                </View>

                                <View style={[styles.summaryCard, { backgroundColor: '#EAFAF1' }]}>
                                    <Text style={[styles.summarySmallLabel, { fontSize: fontSize.tiny }]}>
                                        Net Annuel
                                    </Text>
                                    <Text style={[styles.summarySmallValue, { fontSize: fontSize.subtitle, color: '#27AE60' }]}>
                                        {formatCurrency(summary.total_net_annuel)}
                                    </Text>
                                </View>

                                <View style={[styles.summaryCard, { backgroundColor: '#FADBD8' }]}>
                                    <Text style={[styles.summarySmallLabel, { fontSize: fontSize.tiny }]}>
                                        Déductions
                                    </Text>
                                    <Text style={[styles.summarySmallValue, { fontSize: fontSize.subtitle, color: '#E74C3C' }]}>
                                        {formatCurrency(summary.total_deductions_annuel)}
                                    </Text>
                                </View>

                                <View style={[styles.summaryCard, { backgroundColor: '#FEF5E7' }]}>
                                    <Text style={[styles.summarySmallLabel, { fontSize: fontSize.tiny }]}>
                                        Net Moyen
                                    </Text>
                                    <Text style={[styles.summarySmallValue, { fontSize: fontSize.subtitle, color: '#F39C12' }]}>
                                        {formatCurrency(summary.salaire_net_moyen)}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Statuts */}
                        {summary && (
                            <View style={[styles.statusRow, { marginVertical: 15 }]}>
                                <View style={styles.statusItem}>
                                    <Text style={[styles.statusValue, { fontSize: fontSize.body, color: '#27AE60' }]}>
                                        {summary.mois_payes}
                                    </Text>
                                    <Text style={[styles.statusLabel, { fontSize: fontSize.small }]}>
                                        Mois Payés
                                    </Text>
                                </View>
                                <Divider style={{ height: '100%', width: 1, backgroundColor: '#E8EAED' }} />
                                <View style={styles.statusItem}>
                                    <Text style={[styles.statusValue, { fontSize: fontSize.body, color: '#E74C3C' }]}>
                                        {summary.mois_impaye}
                                    </Text>
                                    <Text style={[styles.statusLabel, { fontSize: fontSize.small }]}>
                                        Mois Non Payés
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Liste des salaires */}
                        <View style={styles.salaryList}>
                            {salaires && salaires.length > 0 ? (
                                salaires.map((salary, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.salaryListItem,
                                            {
                                                borderLeftWidth: 4,
                                                borderLeftColor: salary.statut_paiement === 'payé' ? '#27AE60' : '#F39C12'
                                            }
                                        ]}
                                        onPress={() => navigation.navigate('SalaryDetail', { salary })}
                                    >
                                        <View style={styles.salaryListItemLeft}>
                                            <Text style={[styles.salaryListItemMonth, { fontSize: fontSize.body }]}>
                                                {salary.nom_mois}
                                            </Text>
                                            <Text style={[styles.salaryListItemDate, { fontSize: fontSize.small }]}>
                                                {salary.statut_paiement === 'payé'
                                                    ? `Payé le ${new Date(salary.date_paiement).toLocaleDateString('fr-FR')}`
                                                    : 'Non payé'
                                                }
                                            </Text>
                                        </View>
                                        <View style={styles.salaryListItemRight}>
                                            <Text style={[
                                                styles.salaryListItemAmount,
                                                {
                                                    fontSize: fontSize.body,
                                                    color: salary.statut_paiement === 'payé' ? '#27AE60' : '#F39C12'
                                                }
                                            ]}>
                                                {formatCurrency(salary.salaire_net)}
                                            </Text>
                                            <Badge style={{
                                                backgroundColor: salary.statut_paiement === 'payé' ? '#2ECC71' : '#F39C12',
                                                fontSize: fontSize.tiny
                                            }}>
                                                {salary.statut_paiement === 'payé' ? 'PAYÉ' : 'ATTENTE'}
                                            </Badge>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                                    Aucun salaire pour cette année
                                </Text>
                            )}
                        </View>

                        <Button
                            mode="outlined"
                            onPress={() => navigation.navigate('SalaryHistoryDetails')}
                            style={{ marginTop: 15 }}
                            icon="open-in-new"
                            labelStyle={{ fontSize: fontSize.small }}
                        >
                            Voir Historique Complet
                        </Button>
                    </>
                )}
            </Card>
        );
    };

    const renderMapCard = () => {
        if (!locationPermission || !location) {
            return (
                <Card style={[styles.card, { margin: cardMargin, padding: cardPadding }]}>
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="location-off" size={iconSize.xlarge} color="#BDC3C7" />
                        <Text style={[styles.emptyText, { fontSize: fontSize.body }]}>
                            {locationError || 'Localisation non disponible'}
                        </Text>
                        <Button
                            mode="outlined"
                            onPress={requestLocationPermission}
                            style={[styles.actionButton, { marginTop: 20 }]}
                            icon="my-location"
                            labelStyle={{ fontSize: fontSize.body }}
                        >
                            Activer la localisation
                        </Button>
                    </View>
                </Card>
            );
        }

        return (
            <Card style={[styles.card, { margin: cardMargin, overflow: 'hidden' }]}>
                <View style={styles.mapContainer}>
                    <View style={styles.webMapPlaceholder}>
                        <MaterialIcons name="map" size={iconSize.xlarge} color="#2E86C1" />
                        <Text style={[styles.locationText, { fontSize: fontSize.body, marginTop: 15 }]}>
                            📍 {address}
                        </Text>
                        <Text style={[styles.coordinatesText, { fontSize: fontSize.small, marginTop: 10 }]}>
                            Lat: {location.latitude.toFixed(6)}, Long: {location.longitude.toFixed(6)}
                        </Text>
                        <Button
                            mode="outlined"
                            onPress={getCurrentLocation}
                            style={{ marginTop: 20 }}
                            icon="refresh"
                            labelStyle={{ fontSize: fontSize.small }}
                        >
                            Actualiser
                        </Button>
                    </View>
                </View>
            </Card>
        );
    };

    const renderStatistics = () => {
        if (!statistics) return null;

        const statsPerRow = isMobile ? 1 : isTablet ? 2 : isLargeScreen ? 4 : 3;

        const statsData = [
            {
                icon: 'assignment',
                value: statistics.missions_today || 0,
                label: 'Missions',
                color: '#2E86C1'
            },
            {
                icon: 'speed',
                value: formatNumber(statistics.km_today || 0),
                label: 'Km parcourus',
                color: '#2ECC71'
            },
            {
                icon: 'attach-money',
                value: statistics.frais_pending || 0,
                label: 'Frais en attente',
                color: '#F39C12'
            },
            {
                icon: 'local-gas-station',
                value: formatCurrency(statistics.cout_carburant_total || 0),
                label: 'Carburant',
                color: '#E74C3C'
            }
        ];

        return (
            <View style={[styles.section, { marginHorizontal: cardMargin }]}>
                <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                    Statistiques du Jour
                </Text>
                <View style={[styles.statsGrid, { flexDirection: isMobile ? 'column' : 'row', flexWrap: !isMobile ? 'wrap' : 'nowrap' }]}>
                    {statsData.map((stat, index) => (
                        <View
                            key={index}
                            style={[
                                styles.statBox,
                                styles.card,
                                isMobile ? styles.statBoxMobile : { width: `${100 / statsPerRow - 2}%`, margin: cardMargin / 2 }
                            ]}
                        >
                            <MaterialIcons name={stat.icon} size={iconSize.large} color={stat.color} />
                            <Text style={[styles.statValue, { fontSize: fontSize.title, color: stat.color }]}>
                                {stat.value}
                            </Text>
                            <Text style={[styles.statLabel, { fontSize: fontSize.small }]}>
                                {stat.label}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderNotifications = () => {
        if (notifications.length === 0) return null;

        const displayCount = isMobile ? 3 : isTablet ? 4 : 5;

        return (
            <View style={[styles.section, { marginHorizontal: cardMargin }]}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                        Notifications
                    </Text>
                    {notifications.length > displayCount && (
                        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                            <Text style={[styles.seeAllText, { fontSize: fontSize.small }]}>
                                Voir tout
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {notifications.slice(0, displayCount).map((notif) => (
                    <TouchableOpacity
                        key={notif.id}
                        style={[styles.notificationItem, styles.card, { margin: cardMargin / 2 }]}
                        onPress={() => handleMarkNotificationRead(notif.id)}
                    >
                        <View style={[
                            styles.notificationIcon,
                            { backgroundColor: getNotificationColor(notif.type_notification) }
                        ]}>
                            <MaterialIcons
                                name={getNotificationIcon(notif.type_notification)}
                                size={iconSize.medium}
                                color="#FFF"
                            />
                        </View>
                        <View style={styles.notificationContent}>
                            <Text style={[styles.notificationTitle, { fontSize: fontSize.body }]}>
                                {notif.titre}
                            </Text>
                            <Text
                                style={[styles.notificationMessage, { fontSize: fontSize.small }]}
                                numberOfLines={2}
                            >
                                {notif.message}
                            </Text>
                            <Text style={[styles.notificationTime, { fontSize: fontSize.tiny }]}>
                                {formatTimeAgo(notif.date_creation)}
                            </Text>
                        </View>
                        {notif.statut === 'non_lu' && (
                            <View style={styles.unreadIndicator} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderAlerts = () => {
        const hasAlerts = maintenanceAlerts.length > 0 || insuranceAlerts.length > 0;
        if (!hasAlerts) return null;

        return (
            <View style={[styles.section, { marginHorizontal: cardMargin }]}>
                <Text style={[styles.sectionTitle, { fontSize: fontSize.subtitle }]}>
                    Alertes
                </Text>

                {maintenanceAlerts.map((alert) => (
                    <Card key={alert.id} style={[styles.alertCard, { margin: cardMargin / 2 }]}>
                        <Card.Content style={styles.alertContent}>
                            <MaterialIcons name="build" size={iconSize.medium} color="#F39C12" />
                            <View style={styles.alertInfo}>
                                <Text style={[styles.alertTitle, { fontSize: fontSize.body }]}>
                                    Maintenance: {alert.type_maintenance}
                                </Text>
                                <Text style={[styles.alertDescription, { fontSize: fontSize.small }]}>
                                    {alert.description}
                                </Text>
                                <Text style={[styles.alertDate, { fontSize: fontSize.tiny }]}>
                                    {new Date(alert.date_intervention).toLocaleDateString('fr-FR')}
                                    {alert.jours_restants && ` (dans ${alert.jours_restants} jours)`}
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                ))}

                {insuranceAlerts.map((alert) => (
                    <Card key={alert.id} style={[styles.alertCard, { margin: cardMargin / 2 }]}>
                        <Card.Content style={styles.alertContent}>
                            <MaterialIcons name="security" size={iconSize.medium} color="#E74C3C" />
                            <View style={styles.alertInfo}>
                                <Text style={[styles.alertTitle, { fontSize: fontSize.body }]}>
                                    Assurance: {alert.compagnie_assurance}
                                </Text>
                                <Text style={[styles.alertDescription, { fontSize: fontSize.small }]}>
                                    Police: {alert.numero_police}
                                </Text>
                                <Text style={[styles.alertDate, { fontSize: fontSize.tiny }]}>
                                    ⏰ Expire le {new Date(alert.date_expiration).toLocaleDateString('fr-FR')}
                                    {alert.jours_restants && ` (${alert.jours_restants} jours)`}
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                ))}
            </View>
        );
    };

    // ============================================
    // LAYOUTS RESPONSIVE
    // ============================================
    const renderDesktopLayout = () => (
        <View style={styles.desktopGrid}>
            <View style={styles.desktopColumn}>
                {renderVehicleCard()}
                {renderMapCard()}
                {renderAlerts()}
            </View>
            <View style={styles.desktopColumn}>
                {renderMissionCard()}
                {renderStatistics()}
                {renderExpenseChartsCard()}
                {renderCurrentSalaryCard()}
                {renderSalaryHistoryCard()}
                {renderNotifications()}
            </View>
        </View>
    );

    const renderTabletLayout = () => (
        <View style={styles.tabletGrid}>
            {renderVehicleCard()}
            {renderMissionCard()}
            {renderMapCard()}
            {renderStatistics()}
            {renderExpenseChartsCard()}
            {renderCurrentSalaryCard()}
            {renderSalaryHistoryCard()}
            {renderNotifications()}
            {renderAlerts()}
        </View>
    );

    const renderMobileLayout = () => (
        <View style={styles.mobileGrid}>
            {renderVehicleCard()}
            {renderMissionCard()}
            {renderMapCard()}
            {renderStatistics()}
            {renderExpenseChartsCard()}
            {renderCurrentSalaryCard()}
            {renderSalaryHistoryCard()}
            {renderNotifications()}
            {renderAlerts()}
        </View>
    );

    const renderContent = () => {
        if (isLargeScreen) return renderDesktopLayout();
        if (isTablet) return renderTabletLayout();
        return renderMobileLayout();
    };

    // ============================================
    // RENDU PRINCIPAL
    // ============================================
    if (loading && !dashboardData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E86C1" />
                <Text style={[styles.loadingText, { fontSize: fontSize.body }]}>
                    Chargement du tableau de bord...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* En-tête */}
            <View style={[styles.header, { paddingHorizontal: containerPadding }]}>
                <View style={styles.headerLeft}>
                    <MaterialIcons name="dashboard" size={iconSize.large} color="#2E86C1" />
                    <Text style={[styles.headerTitle, { fontSize: fontSize.title, marginLeft: 12 }]}>
                        Dashboard Chauffeur
                    </Text>
                </View>
                <View style={styles.headerRight}>
                    <IconButton
                        icon="message-draw"
                        size={iconSize.large}
                        iconColor="#2E86C1"
                        onPress={() => setCommunicationModalVisible(true)}
                    />
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Profil')}
                    >
                        <MaterialIcons name="account-circle" size={iconSize.large} color="#2E86C1" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Contenu scrollable */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingBottom: isMobile ? 80 : 20,
                        maxWidth: isLargeScreen ? 1400 : '100%',
                        width: '100%',
                        alignSelf: 'center'
                    }
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#2E86C1']}
                        tintColor="#2E86C1"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {error && (
                    <View style={[styles.errorBanner, { marginHorizontal: cardMargin }]}>
                        <MaterialIcons name="error" size={iconSize.medium} color="#E74C3C" />
                        <Text style={[styles.errorText, { fontSize: fontSize.small, marginLeft: 10 }]}>
                            {error}
                        </Text>
                    </View>
                )}

                {renderContent()}
            </ScrollView>

            {/* Actions rapides */}
            {!isMobile && (
                <View style={styles.fabContainer}>
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: '#F39C12' }]}
                        onPress={() => navigation.navigate('Frais')}
                    >
                        <MaterialIcons name="receipt" size={iconSize.medium} color="#FFF" />
                        <Text style={[styles.fabText, { fontSize: fontSize.small }]}>Frais</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: '#E74C3C' }]}
                        onPress={() => navigation.navigate('Incidents')}
                    >
                        <MaterialIcons name="warning" size={iconSize.medium} color="#FFF" />
                        <Text style={[styles.fabText, { fontSize: fontSize.small }]}>Incident</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isMobile && (
                <View style={styles.mobileActions}>
                    <TouchableOpacity
                        style={[styles.mobileAction, { backgroundColor: '#F39C12' }]}
                        onPress={() => navigation.navigate('Frais')}
                    >
                        <MaterialIcons name="receipt" size={iconSize.medium} color="#FFF" />
                        <Text style={[styles.mobileActionText, { fontSize: fontSize.small }]}>Frais</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mobileAction, { backgroundColor: '#E74C3C' }]}
                        onPress={() => navigation.navigate('Incidents')}
                    >
                        <MaterialIcons name="warning" size={iconSize.medium} color="#FFF" />
                        <Text style={[styles.mobileActionText, { fontSize: fontSize.small }]}>Incident</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* MODALE COMMUNICATION ADMIN */}
            <Portal>
                <Modal
                    visible={communicationModalVisible}
                    onDismiss={() => setCommunicationModalVisible(false)}
                    contentContainerStyle={[styles.commModalContainer, isLargeScreen && { width: 500 }]}
                >
                    <View style={styles.commModalHeader}>
                        <View style={styles.commModalIconWrapper}>
                            <MaterialIcons name="contact-support" size={24} color="#FFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.commModalTitle}>Contacter l'Admin</Text>
                            <Text style={styles.commModalSubtitle}>Envoyez un message à l'administration</Text>
                        </View>
                        <IconButton
                            icon="close"
                            onPress={() => setCommunicationModalVisible(false)}
                        />
                    </View>

                    <ScrollView style={styles.commModalBody}>
                        <Text style={styles.commInputLabel}>Sujet</Text>
                        <TextInput
                            mode="outlined"
                            placeholder="Sujet de votre message..."
                            value={messageSubject}
                            onChangeText={setMessageSubject}
                            style={styles.commInput}
                            outlineColor="#E8EAED"
                            activeOutlineColor="#2E86C1"
                        />

                        <Text style={styles.commInputLabel}>Message</Text>
                        <TextInput
                            mode="outlined"
                            placeholder="Votre message détaillé..."
                            value={messageBody}
                            onChangeText={setMessageBody}
                            multiline
                            numberOfLines={6}
                            style={[styles.commInput, { height: 120 }]}
                            outlineColor="#E8EAED"
                            activeOutlineColor="#2E86C1"
                        />
                    </ScrollView>

                    <View style={styles.commModalFooter}>
                        <Button
                            mode="outlined"
                            onPress={() => setCommunicationModalVisible(false)}
                            style={styles.commFooterBtn}
                            disabled={isSending}
                        >
                            Annuler
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleSendMessage}
                            style={[styles.commFooterBtn, { flex: 2 }]}
                            buttonColor="#2E86C1"
                            loading={isSending}
                            disabled={isSending || !messageSubject.trim() || !messageBody.trim()}
                            icon="send"
                        >
                            Envoyer
                        </Button>
                    </View>
                </Modal>
            </Portal>
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

    // En-tête
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
        ...Platform.select({
            web: {
                position: 'sticky',
                top: 0,
                zIndex: 1000,
            },
        }),
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    headerRight: {
        padding: 4,
    },

    // Scroll
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 10,
    },

    // Grilles de layout
    mobileGrid: {
        width: '100%',
    },
    tabletGrid: {
        width: '100%',
    },
    desktopGrid: {
        flexDirection: 'row',
        gap: 20,
        paddingHorizontal: 10,
    },
    desktopColumn: {
        flex: 1,
        minWidth: 0,
    },

    // Cartes
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        elevation: 2,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardTitle: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    divider: {
        backgroundColor: '#E8EAED',
        height: 1,
        marginVertical: 12,
    },

    // Badges
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: '#3498DB',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },

    // Véhicule
    vehicleInfo: {
        alignItems: 'center',
        marginVertical: 12,
    },
    vehicleImmat: {
        fontWeight: '700',
        color: '#2C3E50',
        letterSpacing: 2,
        marginVertical: 4,
    },
    vehicleModel: {
        color: '#7F8C8D',
        fontWeight: '500',
    },
    vehicleYear: {
        color: '#95A5A6',
        marginTop: 4,
    },

    // Grille de stats
    statsGrid: {
        gap: 10,
    },
    statBox: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        minHeight: 120,
        justifyContent: 'center',
    },
    statBoxMobile: {
        width: '100%',
        marginBottom: 8,
    },
    statValue: {
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        color: '#7F8C8D',
        textAlign: 'center',
    },

    // Alertes
    alertsContainer: {
        marginTop: 8,
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    alertText: {
        flex: 1,
        color: '#856404',
    },
    alertCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#F39C12',
    },
    alertContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    alertInfo: {
        flex: 1,
        marginLeft: 12,
    },
    alertTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    alertDescription: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    alertDate: {
        color: '#95A5A6',
    },

    // Mission
    missionDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    detailContent: {
        flex: 1,
        marginLeft: 12,
    },
    detailLabel: {
        color: '#7F8C8D',
        marginBottom: 2,
    },
    detailValue: {
        color: '#2C3E50',
        fontWeight: '500',
    },

    // Map
    mapContainer: {
        width: '100%',
        height: 300,
        overflow: 'hidden',
        borderRadius: 12,
    },
    webMapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ECF0F1',
        padding: 20,
    },
    nativeMapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ECF0F1',
    },
    locationText: {
        color: '#2C3E50',
        fontWeight: '500',
        textAlign: 'center',
    },
    coordinatesText: {
        color: '#7F8C8D',
    },

    // Sections
    section: {
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    seeAllText: {
        color: '#2E86C1',
        fontWeight: '500',
    },

    // Notifications
    notificationItem: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'flex-start',
        position: 'relative',
    },
    notificationIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationContent: {
        flex: 1,
        marginLeft: 12,
    },
    notificationTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    notificationMessage: {
        color: '#7F8C8D',
        marginBottom: 4,
        lineHeight: 18,
    },
    notificationTime: {
        color: '#BDC3C7',
    },
    unreadIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E74C3C',
        position: 'absolute',
        top: 16,
        right: 12,
    },

    // Graphiques
    periodSelector: {
        marginBottom: 15,
    },
    chartContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    chartTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 12,
        textAlign: 'center',
    },
    chartsSubtitle: {
        fontWeight: '600',
        color: '#2C3E50',
    },

    // Résumé frais
    summaryBox: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        color: '#7F8C8D',
        fontWeight: '500',
    },
    summaryValue: {
        fontWeight: '700',
        color: '#2C3E50',
    },

    // Frais par type
    expenseTypesList: {
        marginTop: 20,
    },
    expenseTypeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    expenseTypeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    expenseTypeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    expenseTypeInfo: {
        flex: 1,
    },
    expenseTypeName: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 2,
    },
    expenseTypeCount: {
        color: '#95A5A6',
    },
    expenseTypeAmount: {
        fontWeight: '700',
        color: '#2C3E50',
    },

    // Salaire
    salaryMainBox: {
        alignItems: 'center',
    },
    salaryMonthLabel: {
        color: '#7F8C8D',
        marginBottom: 8,
    },
    salaryMainAmount: {
        fontWeight: '700',
        color: '#27AE60',
    },

    salarySection: {
        marginBottom: 20,
    },
    salarySectionTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#E8EAED',
    },

    salaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
    },
    salaryRowLabel: {
        color: '#7F8C8D',
        flex: 1,
    },
    salaryRowLabelBold: {
        fontWeight: '700',
        color: '#2C3E50',
        flex: 1,
    },
    salaryRowValue: {
        fontWeight: '500',
        color: '#2C3E50',
    },
    salaryRowValueBold: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    salaryDivider: {
        backgroundColor: '#E8EAED',
        height: 2,
        marginVertical: 8,
    },

    salaryActions: {
        flexDirection: 'row',
    },

    // Historique salaire
    yearSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 15,
    },
    yearButton: {
        padding: 8,
    },
    yearLabel: {
        fontWeight: '700',
        color: '#2C3E50',
    },

    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    summarySmallLabel: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    summarySmallValue: {
        fontWeight: '700',
    },

    statusRow: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        padding: 12,
    },
    statusItem: {
        flex: 1,
        alignItems: 'center',
    },
    statusValue: {
        fontWeight: '700',
        marginBottom: 4,
    },
    statusLabel: {
        color: '#7F8C8D',
    },

    salaryList: {
        marginTop: 15,
    },
    salaryListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
    },
    salaryListItemLeft: {
        flex: 1,
    },
    salaryListItemMonth: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 4,
    },
    salaryListItemDate: {
        color: '#95A5A6',
    },
    salaryListItemRight: {
        alignItems: 'flex-end',
    },
    salaryListItemAmount: {
        fontWeight: '700',
        marginBottom: 4,
    },

    // États vides
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#7F8C8D',
        marginTop: 16,
        textAlign: 'center',
    },

    // Boutons d'action
    actionButton: {
        borderRadius: 8,
    },

    // FAB Desktop
    fabContainer: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        gap: 12,
        ...Platform.select({
            web: {
                position: 'fixed',
            },
        }),
    },

    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 28,
        elevation: 6,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
            },
        }),
    },
    fabText: {
        color: '#FFF',
        fontWeight: '600',
        marginLeft: 8,
    },

    // Actions mobiles
    mobileActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#FFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#E8EAED',
        gap: 12,
        elevation: 8,
        ...Platform.select({
            web: {
                boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 5,
            },
        }),
    },
    mobileAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    mobileActionText: {
        color: '#FFF',
        fontWeight: '600',
    },

    // Loading et erreur
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
    },
    loadingText: {
        marginTop: 16,
        color: '#7F8C8D',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FADBD8',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        flex: 1,
        color: '#C0392B',
    },

    // Graphiques
    chartTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        textAlign: 'center',
    },
    chartsSubtitle: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    chartContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },

    // Notifications
    section: {
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    seeAllText: {
        color: '#2E86C1',
        fontWeight: '500',
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'flex-start',
        position: 'relative',
    },
    notificationIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationContent: {
        flex: 1,
        marginLeft: 12,
    },
    notificationTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    notificationMessage: {
        color: '#7F8C8D',
        marginBottom: 4,
        lineHeight: 18,
    },
    notificationTime: {
        color: '#BDC3C7',
    },
    unreadIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E74C3C',
        position: 'absolute',
        top: 16,
        right: 12,
    },

    // Alertes
    alertCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#F39C12',
    },
    alertContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    alertInfo: {
        flex: 1,
        marginLeft: 12,
    },
    alertTitle: {
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 4,
    },
    alertDescription: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    alertDate: {
        color: '#95A5A6',
    },

    // Map
    mapContainer: {
        width: '100%',
        height: 300,
        overflow: 'hidden',
        borderRadius: 12,
    },
    webMapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ECF0F1',
        padding: 20,
    },
    locationText: {
        color: '#2C3E50',
        fontWeight: '500',
        textAlign: 'center',
    },
    coordinatesText: {
        color: '#7F8C8D',
    },

    // Types de frais
    expenseTypeInfo: {
        flex: 1,
    },
    expenseTypeCount: {
        color: '#95A5A6',
    },

    // Historique salaire
    yearButton: {
        padding: 8,
    },
    statusRow: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        padding: 12,
    },
    statusItem: {
        flex: 1,
        alignItems: 'center',
    },
    statusValue: {
        fontWeight: '700',
        marginBottom: 4,
    },
    statusLabel: {
        color: '#7F8C8D',
    },
    salaryListItemRight: {
        alignItems: 'flex-end',
    },
    salaryActions: {
        flexDirection: 'row',
    },

    // Layouts responsive supplémentaires
    desktopGrid: {
        flexDirection: 'row',
        gap: 20,
        paddingHorizontal: 10,
    },
    desktopColumn: {
        flex: 1,
        minWidth: 0,
    },
    tabletGrid: {
        width: '100%',
    },
    mobileGrid: {
        width: '100%',
    },

    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardTitle: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    divider: {
        backgroundColor: '#E8EAED',
        height: 1,
        marginVertical: 12,
    },
    vehicleInfo: {
        alignItems: 'center',
        marginVertical: 12,
    },
    vehicleImmat: {
        fontWeight: '700',
        color: '#2C3E50',
        letterSpacing: 2,
        marginVertical: 4,
    },
    vehicleModel: {
        color: '#7F8C8D',
        fontWeight: '500',
    },
    statsGrid: {
        gap: 10,
    },
    statBox: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        minHeight: 120,
        justifyContent: 'center',
    },
    statValue: {
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        color: '#7F8C8D',
        textAlign: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#7F8C8D',
        marginTop: 16,
        textAlign: 'center',
    },
    missionDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    detailContent: {
        flex: 1,
        marginLeft: 12,
    },
    detailLabel: {
        color: '#7F8C8D',
        marginBottom: 2,
    },
    detailValue: {
        color: '#2C3E50',
        fontWeight: '500',
    },
    summaryBox: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        color: '#7F8C8D',
        fontWeight: '500',
    },
    summaryValue: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    periodSelector: {
        marginBottom: 15,
    },
    expenseTypesList: {
        marginTop: 20,
    },
    expenseTypeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    expenseTypeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    expenseTypeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    expenseTypeName: {
        fontWeight: '600',
        color: '#2C3E50',
    },
    expenseTypeAmount: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    salaryMainBox: {
        alignItems: 'center',
    },
    salaryMonthLabel: {
        color: '#7F8C8D',
        marginBottom: 8,
    },
    salaryMainAmount: {
        fontWeight: '700',
        color: '#27AE60',
    },
    salarySection: {
        marginBottom: 20,
    },
    salarySectionTitle: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#E8EAED',
    },
    salaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E8EAED',
    },
    salaryRowLabel: {
        color: '#7F8C8D',
        flex: 1,
    },
    salaryRowLabelBold: {
        fontWeight: '700',
        color: '#2C3E50',
        flex: 1,
    },
    salaryRowValue: {
        fontWeight: '500',
        color: '#2C3E50',
    },
    salaryRowValueBold: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    salaryDivider: {
        backgroundColor: '#E8EAED',
        height: 2,
        marginVertical: 8,
    },
    yearSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 15,
    },
    yearLabel: {
        fontWeight: '700',
        color: '#2C3E50',
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    summarySmallLabel: {
        color: '#7F8C8D',
        marginBottom: 4,
    },
    summarySmallValue: {
        fontWeight: '700',
    },
    salaryList: {
        marginTop: 15,
    },
    salaryListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        borderLeftWidth: 4,
    },
    salaryListItemLeft: {
        flex: 1,
    },
    salaryListItemMonth: {
        fontWeight: '700',
        color: '#2C3E50',
        marginBottom: 4,
    },
    salaryListItemDate: {
        color: '#95A5A6',
    },
    salaryListItemAmount: {
        fontWeight: '700',
    },
    actionButton: {
        borderRadius: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: '#3498DB',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    alertsContainer: {
        marginTop: 8,
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    alertText: {
        flex: 1,
        color: '#856404',
        marginLeft: 8,
    },
    vehicleYear: {
        color: '#95A5A6',
        marginTop: 4,
    },
    statBoxMobile: {
        width: '100%',
        marginBottom: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    // Communication Modal Styles
    commModalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        margin: 20,
        overflow: 'hidden',
        alignSelf: 'center',
        width: '90%',
        maxWidth: 600,
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
        backgroundColor: '#2E86C1',
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