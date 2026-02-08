// filepath: mobile/src/navigation/RootNavigator.js
import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth Screens
import QRScannerScreen from '../screens/auth/QRScannerScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';

// Role-based Navigators
import ChauffeurNavigator from './ChauffeurNavigator';
import AdminNavigator from './AdminNavigator';
import ManagerNavigator from './ManagerNavigator';
import ComptableNavigator from './ComptableNavigator';
import EmployeNavigator from './EmployeNavigator';
import EmployeTempsPartielNavigator from './EmployeTempsPartielNavigator';
import VeterinaireNavigator from './VeterinaireNavigator';

// Services
import authService from '../services/authService';
import notificationService from '../services/notificationService';

const Stack = createStackNavigator();

/**
 * RootNavigator - Gère la navigation après authentification
 * @param {Object} props
 * @param {Function} props.onLogout - Callback pour retourner au LoginScreen
 */
const RootNavigator = ({ onLogout }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        initializeApp();
    }, []);

    /**
     * Initialise l'application : charge les données utilisateur et les notifications
     */
    const initializeApp = async () => {
        try {
            console.log('🚀 === INITIALISATION ROOTNAVIGATOR ===');

            await loadUserData();
            await initializeNotifications();

            console.log('='.repeat(50));
        } catch (error) {
            console.error('❌ Erreur initialisation app:', error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Charge les données utilisateur depuis AsyncStorage
     */
    const loadUserData = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            const role = await AsyncStorage.getItem('userRole');

            if (userData) {
                const user = JSON.parse(userData);
                setUserRole(role || user.role);
                setUserName(user.nom || user.email);

                console.log('👤 Utilisateur chargé:', user.nom || user.email);
                console.log('🎭 Rôle:', role || user.role);
            } else {
                console.warn('⚠️ Aucune donnée utilisateur trouvée');
                // Si pas de données, déconnecter
                if (onLogout) {
                    await onLogout();
                }
            }
        } catch (error) {
            console.error('❌ Erreur chargement données utilisateur:', error);
        }
    };

    /**
     * Initialise le service de notifications
     */
    const initializeNotifications = async () => {
        try {
            console.log('🔔 Initialisation des notifications...');
            await notificationService.initialize();
            await notificationService.connectWebSocket();
            console.log('✅ Notifications initialisées');
        } catch (error) {
            console.error('❌ Erreur initialisation notifications:', error);
        }
    };

    /**
     * Gère la déconnexion de l'utilisateur
     */
    const handleLogout = async () => {
        try {
            console.log('\n🚪 === DÉCONNEXION DEPUIS ROOTNAVIGATOR ===');
            console.log('Utilisateur:', userName);

            // Déconnecter via le service d'authentification
            await authService.logout();

            // Nettoyer les notifications
            notificationService.cleanup();

            console.log('✅ Services nettoyés');

            // Appeler le callback du _layout.tsx pour retourner au LoginScreen
            if (onLogout) {
                await onLogout();
            }
        } catch (error) {
            console.error('❌ Erreur déconnexion:', error);

            // Forcer la déconnexion même en cas d'erreur
            if (onLogout) {
                await onLogout();
            }
        }
    };

    // ============================================
    // Obtenir le composant Navigator selon le rôle
    // ============================================
    const getRoleNavigator = () => {
        switch (userRole) {
            case 'chauffeur':
                return ChauffeurNavigator;
            case 'admin':
                return AdminNavigator;
            case 'manager':
                return ManagerNavigator;
            case 'comptable':
                return ComptableNavigator;
            case 'employe':
                return EmployeNavigator;
            case 'employe_temps_partiel':
                return EmployeTempsPartielNavigator;
            case 'veterinaire':
                return VeterinaireNavigator;
            default:
                return null;
        }
    };

    const RoleNavigator = getRoleNavigator();

    // ============================================
    // ÉCRAN DE CHARGEMENT
    // ============================================
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E86C1" />
            </View>
        );
    }

    // Si pas de rôle ou rôle invalide, déconnecter
    if (!RoleNavigator) {
        console.error('❌ Rôle invalide ou non trouvé:', userRole);
        if (onLogout) {
            onLogout();
        }
        return null;
    }

    // ============================================
    // NAVIGATION PAR RÔLE
    // ============================================
    return (
        <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName="MainApp"
        >
            {/* ============================================
                ÉCRAN PRINCIPAL SELON LE RÔLE (PREMIER ÉCRAN)
                ============================================ */}
            <Stack.Screen name="MainApp">
                {({ navigation, route }) => (
                    <RoleNavigator
                        navigation={navigation}
                        route={route}
                        onLogout={handleLogout}
                    />
                )}
            </Stack.Screen>

            {/* ============================================
                ÉCRANS UTILITAIRES (accessibles via navigation)
                ============================================ */}

            <Stack.Screen
                name="QRScanner"
                component={QRScannerScreen}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
            />
            <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
            />
        </Stack.Navigator>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
});

export default RootNavigator;