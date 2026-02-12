// mobile/src/screens/auth/LoginScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Animated,
    useWindowDimensions,
    ActivityIndicator
} from 'react-native';
import { TextInput, Button, Card, Portal, Modal, HelperText, Snackbar } from 'react-native-paper';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';

// ✅ Import conditionnel de LocalAuthentication
let LocalAuthentication = null;
try {
    LocalAuthentication = require('expo-local-authentication');
} catch (error) {
    console.warn('⚠️ expo-local-authentication non disponible');
}

// ============================================
// CONFIGURATION API DYNAMIQUE
// ============================================
const getApiUrl = () => {
    if (__DEV__) {
        if (Platform.OS === 'web') {
            return 'https://nutrifix-1-twdf.onrender.com/api';
        }
        if (Platform.OS === 'android') {
            return 'https://nutrifix-1-twdf.onrender.com/api';
        }
        return 'https://nutrifix-1-twdf.onrender.com/api';
    }
    return process.env.REACT_APP_API_URL || 'https://nutrifix-1-twdf.onrender.com/api';
};

const API_URL = getApiUrl();

// ============================================
// CONSTANTES DE SÉCURITÉ
// ============================================
const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 3,
    LOCKOUT_DURATION: 15 * 60 * 1000,
    ATTEMPT_RESET_TIME: 30 * 60 * 1000,
    PASSWORD_MIN_LENGTH: 6,
    CONNECTION_TIMEOUT: 15000,
};

const SECURE_MESSAGES = {
    INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.',
    ACCOUNT_LOCKED: 'Compte temporairement verrouillé suite à plusieurs tentatives échouées. Réessayez dans 15 minutes.',
    ACCOUNT_DISABLED: 'Votre compte est désactivé. Contactez l\'administrateur.',
    MISSING_FIELDS: 'Veuillez remplir tous les champs requis.',
    SERVER_ERROR: 'Erreur serveur. Veuillez réessayer plus tard.',
    NETWORK_ERROR: 'Pas de connexion internet. Vérifiez votre réseau.',
    CONNECTION_TIMEOUT: 'Délai de connexion dépassé. Vérifiez votre connexion.',
    SUCCESS: 'Connexion réussie.',
    ROLE_UNAUTHORIZED: 'Accès refusé. Rôle non autorisé.',
    BIOMETRIC_UNAVAILABLE: 'Authentification biométrique non disponible.',
    QR_UNAVAILABLE: 'Scanner QR non disponible sur cette plateforme.',
};

const LoginScreen = ({ navigation: navigationProp, onLogin }) => {
    const navigationHook = useNavigation();
    const navigation = navigationProp || navigationHook;

    const windowDimensions = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isMobile = windowDimensions.width < 768;
    const isTablet = windowDimensions.width >= 768 && windowDimensions.width < 1024;
    const isDesktop = windowDimensions.width >= 1024;
    const isExpoGo = Constants.appOwnership === 'expo';

    // ============================================
    // REFS
    // ============================================
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const matriculeInputRef = useRef(null);
    const connectionTimeoutRef = useRef(null);

    // ============================================
    // STATES PRINCIPAUX
    // ============================================
    const [loginMethod, setLoginMethod] = useState('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [matricule, setMatricule] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // ============================================
    // STATES RÉSEAU & CONNEXION
    // ============================================
    const [isConnected, setIsConnected] = useState(true);
    const [networkType, setNetworkType] = useState('wifi');
    const [isCheckingNetwork, setIsCheckingNetwork] = useState(true);

    // ============================================
    // STATES SÉCURITÉ & TENTATIVES
    // ============================================
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockoutEndTime, setLockoutEndTime] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(0);

    // ============================================
    // STATES BIOMÉTRIE
    // ============================================
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState(null);

    // ============================================
    // STATES ERREURS & VALIDATION
    // ============================================
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [matriculeError, setMatriculeError] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [errorTimer, setErrorTimer] = useState(null);

    // ============================================
    // STATES MODAL
    // ============================================
    const [resetModalVisible, setResetModalVisible] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    // ============================================
    // ANIMATIONS
    // ============================================
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));

    // ============================================
    // EFFECTS
    // ============================================
    useEffect(() => {
        console.log('='.repeat(60));
        console.log('🚀 NUTRIFIX LOGIN SCREEN - INITIALISATION');
        console.log('='.repeat(60));
        console.log('🌐 API URL:', API_URL);
        console.log('📱 Platform:', Platform.OS);
        console.log('🏗️ App Type:', isExpoGo ? 'Expo Go' : 'Development Build');
        console.log('🧭 Navigation:', navigation ? 'Disponible ✅' : 'MANQUANT ❌');
        console.log('🔐 Biométrie:', LocalAuthentication ? 'Module installé ✅' : 'Module manquant ❌');
        console.log('🖥️ Web Mode:', isWeb ? 'OUI ✅' : 'NON ❌');
        console.log('='.repeat(60));

        initializeScreen();
        startAnimations();
        initializeNetworkMonitoring();

        return () => {
            if (errorTimer) clearTimeout(errorTimer);
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        };
    }, []);

    // Effect pour gérer le lockout timer
    useEffect(() => {
        let interval;
        if (isLocked && lockoutEndTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, lockoutEndTime - now);
                setTimeRemaining(remaining);

                if (remaining <= 0) {
                    unlockAccount();
                }
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLocked, lockoutEndTime]);

    // ============================================
    // INITIALISATION
    // ============================================
    const initializeScreen = async () => {
        await checkBiometricAvailability();
        await loadSavedCredentials();
        await checkLockoutStatus();
    };

    const startAnimations = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            })
        ]).start();
    };

    // ============================================
    // GESTION RÉSEAU
    // ============================================
    const initializeNetworkMonitoring = () => {
        console.log('🌐 Initialisation monitoring réseau...');

        NetInfo.fetch().then(state => {
            console.log('📡 État réseau initial:', {
                isConnected: state.isConnected,
                type: state.type,
                isInternetReachable: state.isInternetReachable
            });

            setIsConnected(state.isConnected && state.isInternetReachable !== false);
            setNetworkType(state.type);
            setIsCheckingNetwork(false);
        });

        const unsubscribe = NetInfo.addEventListener(state => {
            console.log('📡 Changement réseau:', {
                isConnected: state.isConnected,
                type: state.type,
                isInternetReachable: state.isInternetReachable
            });

            const connected = state.isConnected && state.isInternetReachable !== false;

            setIsConnected(connected);
            setNetworkType(state.type);
            setIsCheckingNetwork(false);

            if (!connected && !isMobile) {
                showWebErrorDialog(SECURE_MESSAGES.NETWORK_ERROR);
            }
        });

        return unsubscribe;
    };

    const checkNetworkConnection = async () => {
        try {
            const state = await NetInfo.fetch();
            const connected = state.isConnected && state.isInternetReachable !== false;

            console.log('🔍 Vérification connexion:', {
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
                finalStatus: connected
            });

            setIsConnected(connected);
            setNetworkType(state.type);

            return connected;
        } catch (error) {
            console.error('❌ Erreur vérification réseau:', error);
            return false;
        }
    };

    // ============================================
    // GESTION LOCKOUT & TENTATIVES
    // ============================================
    const checkLockoutStatus = async () => {
        try {
            const lockoutData = await AsyncStorage.getItem('loginLockout');

            if (lockoutData) {
                const { endTime, attempts } = JSON.parse(lockoutData);
                const now = Date.now();

                if (endTime > now) {
                    setIsLocked(true);
                    setLockoutEndTime(endTime);
                    setTimeRemaining(endTime - now);
                    setLoginAttempts(attempts);

                    console.log('🔒 Compte verrouillé jusqu\'à:', new Date(endTime));
                } else {
                    await unlockAccount();
                }
            } else {
                const attemptsData = await AsyncStorage.getItem('loginAttempts');
                if (attemptsData) {
                    const { count, timestamp } = JSON.parse(attemptsData);
                    const now = Date.now();

                    if (now - timestamp > SECURITY_CONFIG.ATTEMPT_RESET_TIME) {
                        await resetAttempts();
                    } else {
                        setLoginAttempts(count);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur vérification lockout:', error);
        }
    };

    const incrementAttempts = async () => {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        const attemptsData = {
            count: newAttempts,
            timestamp: Date.now()
        };

        await AsyncStorage.setItem('loginAttempts', JSON.stringify(attemptsData));

        console.log(`⚠️ Tentative ${newAttempts}/${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}`);

        if (newAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
            await lockAccount();
        }
    };

    const lockAccount = async () => {
        const endTime = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;

        const lockoutData = {
            endTime,
            attempts: loginAttempts,
            timestamp: Date.now()
        };

        await AsyncStorage.setItem('loginLockout', JSON.stringify(lockoutData));

        setIsLocked(true);
        setLockoutEndTime(endTime);
        setTimeRemaining(SECURITY_CONFIG.LOCKOUT_DURATION);

        console.log('🔒 COMPTE VERROUILLÉ pour 15 minutes');

        if (isMobile) {
            Alert.alert(
                '🔒 Compte Verrouillé',
                SECURE_MESSAGES.ACCOUNT_LOCKED,
                [{ text: 'Compris', style: 'cancel' }]
            );
        } else {
            showWebErrorDialog(SECURE_MESSAGES.ACCOUNT_LOCKED);
        }
    };

    const unlockAccount = async () => {
        await AsyncStorage.removeItem('loginLockout');
        await resetAttempts();

        setIsLocked(false);
        setLockoutEndTime(null);
        setTimeRemaining(0);

        console.log('🔓 Compte déverrouillé');
    };

    const resetAttempts = async () => {
        await AsyncStorage.removeItem('loginAttempts');
        setLoginAttempts(0);
        console.log('♻️ Tentatives réinitialisées');
    };

    const formatTimeRemaining = (milliseconds) => {
        const totalSeconds = Math.ceil(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // ============================================
    // GESTION BIOMÉTRIE
    // ============================================
    const checkBiometricAvailability = async () => {
        try {
            console.log('\n🔐 === VÉRIFICATION BIOMÉTRIQUE ===');

            if (!LocalAuthentication) {
                console.log('❌ Module expo-local-authentication non installé');
                setBiometricAvailable(false);
                return;
            }

            if (isExpoGo) {
                console.log('⚠️ Expo Go détecté - Biométrie non disponible');
                setBiometricAvailable(false);
                return;
            }

            const compatible = await LocalAuthentication.hasHardwareAsync();
            console.log('📱 Hardware biométrique:', compatible ? 'OUI ✅' : 'NON ❌');

            if (!compatible) {
                setBiometricAvailable(false);
                return;
            }

            const enrolled = await LocalAuthentication.isEnrolledAsync();
            console.log('✋ Biométrie configurée:', enrolled ? 'OUI ✅' : 'NON ❌');

            if (!enrolled) {
                setBiometricAvailable(false);
                return;
            }

            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
            console.log('🔍 Types supportés:', supportedTypes);

            setBiometricAvailable(true);

            if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricType('face');
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricType('fingerprint');
            } else {
                setBiometricType('biometric');
            }

            console.log('='.repeat(50) + '\n');
        } catch (error) {
            console.error('❌ Erreur vérification biométrique:', error);
            setBiometricAvailable(false);
        }
    };

    const loadSavedCredentials = async () => {
        try {
            const savedEmail = await AsyncStorage.getItem('savedEmail');
            const savedMatricule = await AsyncStorage.getItem('userMatricule');
            const rememberMeValue = await AsyncStorage.getItem('rememberMe');

            if (savedEmail && rememberMeValue === 'true') {
                setEmail(savedEmail);
                setRememberMe(true);
            }

            if (savedMatricule) {
                setMatricule(savedMatricule);
            }
        } catch (error) {
            console.error('❌ Erreur chargement credentials:', error);
        }
    };

    // ============================================
    // GESTION ERREURS - WEB ET MOBILE
    // ============================================
    const showError = (message, duration = 5000) => {
        if (errorTimer) {
            clearTimeout(errorTimer);
        }

        if (isMobile) {
            // 📱 MOBILE: Toast notification (Snackbar)
            setErrorMessage(message);
            setShowErrorSnackbar(true);

            const timer = setTimeout(() => {
                setErrorMessage('');
                setShowErrorSnackbar(false);
            }, duration);

            setErrorTimer(timer);
        } else {
            // 🖥️ WEB: Dialog modal
            showWebErrorDialog(message);
        }
    };

    const showWebErrorDialog = (message) => {
        Alert.alert(
            '⚠️ Erreur',
            message,
            [{ text: 'Fermer', style: 'default' }],
            { cancelable: false }
        );
    };

    const dismissError = () => {
        setErrorMessage('');
        setShowErrorSnackbar(false);
        if (errorTimer) {
            clearTimeout(errorTimer);
            setErrorTimer(null);
        }
    };

    // ============================================
    // VALIDATION
    // ============================================
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setEmailError('Email requis');
            return false;
        }
        if (!emailRegex.test(email)) {
            setEmailError('Format email invalide');
            return false;
        }
        setEmailError('');
        return true;
    };

    const validatePassword = (password) => {
        if (!password) {
            setPasswordError('Mot de passe requis');
            return false;
        }
        if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
            setPasswordError(`Minimum ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} caractères`);
            return false;
        }
        setPasswordError('');
        return true;
    };

    const validateMatricule = (matricule) => {
        if (!matricule) {
            setMatriculeError('Matricule requis');
            return false;
        }
        if (matricule.length < 3) {
            setMatriculeError('Matricule invalide');
            return false;
        }
        setMatriculeError('');
        return true;
    };

    // ============================================
    // CONNEXION EMAIL/PASSWORD (PRINCIPALE)
    // ============================================
    const handleEmailLogin = async () => {
        console.log('\n🔐 === TENTATIVE DE CONNEXION EMAIL ===');

        dismissError();

        // Vérifier si compte verrouillé
        if (isLocked) {
            showError(SECURE_MESSAGES.ACCOUNT_LOCKED, 8000);
            return;
        }

        // Validation des champs
        const isEmailValid = validateEmail(email);
        const isPasswordValid = validatePassword(password);

        if (!isEmailValid || !isPasswordValid) {
            return;
        }

        // Vérifier la connexion réseau
        const hasNetwork = await checkNetworkConnection();
        if (!hasNetwork) {
            showError(SECURE_MESSAGES.NETWORK_ERROR, 8000);
            return;
        }

        setLoading(true);

        // Timeout de sécurité
        connectionTimeoutRef.current = setTimeout(() => {
            setLoading(false);
            showError(SECURE_MESSAGES.CONNECTION_TIMEOUT, 8000);
        }, SECURITY_CONFIG.CONNECTION_TIMEOUT);

        try {
            console.log('📡 Envoi requête à:', `${API_URL}/auth/login`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SECURITY_CONFIG.CONNECTION_TIMEOUT);

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            clearTimeout(connectionTimeoutRef.current);

            console.log('📊 Statut réponse:', response.status);

            const data = await response.json();
            console.log('📦 Réponse:', data.success ? 'Succès ✅' : 'Échec ❌');

            if (data.success) {
                // ✅ CONNEXION RÉUSSIE
                console.log('✅ AUTHENTIFICATION RÉUSSIE');
                console.log('👤 Utilisateur:', data.user.nom_complet);
                console.log('🎭 Rôle:', data.user.role);

                // Reset tentatives
                await resetAttempts();

                // Sauvegarder les données
                await AsyncStorage.setItem('userToken', data.token);
                await AsyncStorage.setItem('userData', JSON.stringify(data.user));
                await AsyncStorage.setItem('userMatricule', data.user.matricule);
                await AsyncStorage.setItem('userRole', data.user.role);

                if (rememberMe) {
                    await AsyncStorage.setItem('savedEmail', email);
                    await AsyncStorage.setItem('rememberMe', 'true');
                } else {
                    await AsyncStorage.removeItem('savedEmail');
                    await AsyncStorage.removeItem('rememberMe');
                }

                // Navigation
                if (onLogin) {
                    await onLogin(data.user);
                }

            } else {
                // ❌ CONNEXION ÉCHOUÉE
                console.log('❌ ÉCHEC AUTHENTIFICATION');
                console.log('Raison:', data.message);

                const isCredentialError = data.message === SECURE_MESSAGES.INVALID_CREDENTIALS;
                const isAccountDisabled = data.message === SECURE_MESSAGES.ACCOUNT_DISABLED;
                const isRoleError = data.message.includes('Rôle') ||
                    data.message.includes('role') ||
                    data.message.includes('autorisé') ||
                    data.message.includes('Permission') ||
                    data.message === SECURE_MESSAGES.ROLE_UNAUTHORIZED;

                if (isCredentialError) {
                    // Email ou mot de passe incorrect
                    await incrementAttempts();

                    const remainingAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - (loginAttempts + 1);

                    if (remainingAttempts > 0) {
                        // 📱 MOBILE: Afficher tentatives restantes dans le toast
                        // 🖥️ WEB: Afficher directement dans le dialog
                        const errorMsg = isMobile
                            ? `${SECURE_MESSAGES.INVALID_CREDENTIALS}\nTentatives restantes: ${remainingAttempts}`
                            : `${SECURE_MESSAGES.INVALID_CREDENTIALS}\n\nTentatives restantes: ${remainingAttempts}/${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}`;

                        showError(errorMsg, 6000);
                    } else {
                        showError(SECURE_MESSAGES.INVALID_CREDENTIALS, 6000);
                    }
                } else if (isAccountDisabled) {
                    console.log('⚠️ Compte désactivé - Pas d\'incrémentation');
                    showError(SECURE_MESSAGES.ACCOUNT_DISABLED, 8000);
                } else if (isRoleError) {
                    console.log('⚠️ Rôle non autorisé - Affichage message générique');
                    showError(SECURE_MESSAGES.INVALID_CREDENTIALS, 8000);
                } else {
                    showError(data.message, 6000);
                }

                setPassword('');
            }
        } catch (error) {
            clearTimeout(connectionTimeoutRef.current);
            console.error('❌ ERREUR CONNEXION:', error);

            let errorMsg = SECURE_MESSAGES.SERVER_ERROR;

            if (error.name === 'AbortError') {
                errorMsg = SECURE_MESSAGES.CONNECTION_TIMEOUT;
            } else if (error.message.includes('Network request failed') ||
                error.message.includes('Failed to fetch')) {
                errorMsg = SECURE_MESSAGES.NETWORK_ERROR;
            }

            setPassword('');
            showError(errorMsg, 8000);
        } finally {
            setLoading(false);
            clearTimeout(connectionTimeoutRef.current);
        }
    };

    // ============================================
    // CONNEXION BIOMÉTRIQUE
    // ============================================
    const handleBiometricLogin = async () => {
        if (!LocalAuthentication) {
            showError(SECURE_MESSAGES.BIOMETRIC_UNAVAILABLE);
            return;
        }

        if (isLocked) {
            showError(SECURE_MESSAGES.ACCOUNT_LOCKED, 8000);
            return;
        }

        try {
            console.log('🔐 Lancement authentification biométrique...');

            const savedMatricule = await AsyncStorage.getItem('userMatricule');

            if (!savedMatricule) {
                showError('Connectez-vous d\'abord avec email/mot de passe pour activer la biométrie.', 7000);
                return;
            }

            const hasNetwork = await checkNetworkConnection();
            if (!hasNetwork) {
                showError(SECURE_MESSAGES.NETWORK_ERROR, 8000);
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authentification NUTRIFIX',
                fallbackLabel: 'Utiliser le mot de passe',
                disableDeviceFallback: false,
                cancelLabel: 'Annuler'
            });

            console.log('✅ Résultat biométrique:', result.success ? 'Succès' : 'Échec');

            if (result.success) {
                setLoading(true);

                const fingerprintData = {
                    template: generateFingerprintTemplate(),
                    hash: generateFingerprintHash(),
                    timestamp: new Date().toISOString(),
                    deviceInfo: Platform.OS
                };

                const response = await fetch(`${API_URL}/auth/login/fingerprint`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        matricule: savedMatricule,
                        fingerprintData
                    })
                });

                const data = await response.json();

                if (data.success) {
                    await resetAttempts();
                    await AsyncStorage.setItem('userToken', data.token);
                    await AsyncStorage.setItem('userData', JSON.stringify(data.user));

                    console.log('✅ Connexion biométrique réussie');

                    if (onLogin) {
                        await onLogin(data.user);
                    }
                } else {
                    showError(data.message || 'Authentification refusée');
                }
            }
        } catch (error) {
            console.error('❌ Erreur biométrique:', error);
            showError('Authentification impossible');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // CONNEXION QR CODE
    // ============================================
    const handleQRLogin = () => {
        try {
            console.log('\n📷 === SCANNER QR ===');

            if (isLocked) {
                showError(SECURE_MESSAGES.ACCOUNT_LOCKED, 8000);
                return;
            }

            if (Platform.OS === 'web') {
                showError(SECURE_MESSAGES.QR_UNAVAILABLE);
                return;
            }

            if (!navigation || typeof navigation.navigate !== 'function') {
                console.error('❌ Navigation non disponible');
                showError('Erreur : Navigation non disponible.');
                return;
            }

            console.log('✅ Ouverture scanner QR...');

            navigation.navigate('QRScanner', {
                onScan: async (qrData) => {
                    console.log('📷 QR scanné');

                    const hasNetwork = await checkNetworkConnection();
                    if (!hasNetwork) {
                        showError(SECURE_MESSAGES.NETWORK_ERROR, 8000);
                        return;
                    }

                    setLoading(true);

                    try {
                        const response = await fetch(`${API_URL}/auth/login/qr`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({ qrData })
                        });

                        const data = await response.json();

                        if (data.success) {
                            await resetAttempts();
                            await AsyncStorage.setItem('userToken', data.token);
                            await AsyncStorage.setItem('userData', JSON.stringify(data.user));
                            await AsyncStorage.setItem('userMatricule', data.user.matricule);

                            console.log('✅ Connexion QR réussie');

                            if (onLogin) {
                                await onLogin(data.user);
                            }
                        } else {
                            showError(data.message || 'QR Code invalide');
                        }
                    } catch (error) {
                        console.error('❌ Erreur scan:', error);
                        showError('Impossible de se connecter');
                    } finally {
                        setLoading(false);
                    }
                }
            });
        } catch (error) {
            console.error('❌ Erreur scanner:', error);
            showError('Scanner QR non disponible');
        }
    };

    // ============================================
    // RÉINITIALISATION MOT DE PASSE
    // ============================================
    const handlePasswordReset = async () => {
        const trimmedEmail = resetEmail.trim().toLowerCase();

        if (!validateEmail(trimmedEmail)) {
            showError('Email invalide');
            return;
        }

        const hasNetwork = await checkNetworkConnection();
        if (!hasNetwork) {
            showError(SECURE_MESSAGES.NETWORK_ERROR, 8000);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: trimmedEmail })
            });

            const data = await response.json();

            if (data.success) {
                setResetModalVisible(false);
                Alert.alert('Email envoyé', data.message || 'Vérifiez votre boîte mail');
                setResetEmail('');
            } else {
                showError(data.message || 'Échec de l\'envoi');
            }
        } catch (error) {
            showError('Impossible d\'envoyer l\'email');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // HELPERS
    // ============================================
    const generateFingerprintTemplate = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        const data = `${timestamp}-${random}-${Platform.OS}`;
        return btoa ? btoa(data) : Buffer.from(data).toString('base64');
    };

    const generateFingerprintHash = () => {
        const data = `${Date.now()}-${Math.random()}-${Platform.OS}`;
        return data.split('').reduce((hash, char) => {
            return ((hash << 5) - hash) + char.charCodeAt(0);
        }, 0).toString(16);
    };

    const getBiometricIcon = () => {
        switch (biometricType) {
            case 'face': return 'face-recognition';
            case 'fingerprint': return 'fingerprint';
            default: return 'security';
        }
    };

    const getBiometricText = () => {
        switch (biometricType) {
            case 'face': return 'Face ID';
            case 'fingerprint': return 'Empreinte';
            default: return 'Biométrie';
        }
    };

    const getResponsiveCardWidth = () => {
        if (isDesktop) return Math.min(480, windowDimensions.width * 0.35);
        if (isTablet) return Math.min(450, windowDimensions.width * 0.6);
        return windowDimensions.width - 40;
    };

    const getNetworkIcon = () => {
        if (!isConnected) return 'wifi-off';
        switch (networkType) {
            case 'wifi': return 'wifi';
            case 'cellular': return 'signal-cellular-alt';
            default: return 'wifi';
        }
    };

    const getNetworkColor = () => {
        if (!isConnected) return '#E74C3C';
        switch (networkType) {
            case 'wifi': return '#27AE60';
            case 'cellular': return '#F39C12';
            default: return '#95A5A6';
        }
    };

    // ============================================
    // RENDER METHODS - VARIATION WEB vs MOBILE
    // ============================================

    // 🖥️ RENDER WEB LAYOUT
    const renderWebLayout = () => (
        <View style={webDynamicStyles.webContainer}>
            {/* Left Side - Gradient with Welcome Message */}
            <View style={webDynamicStyles.leftSection}>
                <LinearGradient
                    colors={['#0A1F4B', '#1B3A7D', '#2E5BA5']}
                    style={webDynamicStyles.gradientOverlay}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Animated.View style={[webDynamicStyles.welcomeContainer, { opacity: fadeAnim }]}>
                        <Text style={webDynamicStyles.welcomeTitle}>Welcome</Text>
                        <Text style={webDynamicStyles.welcomeSubtitle}>back . . .</Text>
                    </Animated.View>

                    {/* Decorative Grid Pattern */}
                    <View style={webDynamicStyles.gridPattern} />
                </LinearGradient>
            </View>

            {/* Right Side - Login Form */}
            <View style={webDynamicStyles.rightSection}>
                <Animated.View
                    style={[
                        webDynamicStyles.formWrapper,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    {renderLockoutBanner()}

                    <Text style={webDynamicStyles.formTitle}>Log in to your account</Text>

                    {/* Email Input */}
                    <View style={webDynamicStyles.inputGroup}>
                        <TextInput
                            ref={emailInputRef}
                            label="Username"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                setEmailError('');
                                dismissError();
                            }}
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                            mode="outlined"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="next"
                            style={webDynamicStyles.input}
                            error={!!emailError}
                            left={<TextInput.Icon icon="account" />}
                            theme={{ colors: { primary: '#2E86C1' } }}
                            disabled={loading || isLocked}
                            editable={!loading && !isLocked}
                            placeholderTextColor="#999"
                        />
                        <HelperText type="error" visible={!!emailError}>
                            {emailError}
                        </HelperText>
                    </View>

                    {/* Password Input */}
                    <View style={webDynamicStyles.inputGroup}>
                        <TextInput
                            ref={passwordInputRef}
                            label="Password"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                setPasswordError('');
                                dismissError();
                            }}
                            onSubmitEditing={handleEmailLogin}
                            mode="outlined"
                            secureTextEntry={!showPassword}
                            autoComplete="password"
                            textContentType="password"
                            returnKeyType="go"
                            style={webDynamicStyles.input}
                            error={!!passwordError}
                            left={<TextInput.Icon icon="lock" />}
                            right={
                                <TextInput.Icon
                                    icon={showPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowPassword(!showPassword)}
                                    disabled={loading || isLocked}
                                />
                            }
                            theme={{ colors: { primary: '#2E86C1' } }}
                            disabled={loading || isLocked}
                            editable={!loading && !isLocked}
                            placeholderTextColor="#999"
                        />
                        <HelperText type="error" visible={!!passwordError}>
                            {passwordError}
                        </HelperText>
                    </View>

                    {/* Remember Me & Forgot Password */}
                    <View style={webDynamicStyles.optionsRow}>
                        <TouchableOpacity
                            style={webDynamicStyles.rememberMeContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                            disabled={loading || isLocked}
                        >
                            <MaterialIcons
                                name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                                size={20}
                                color={loading || isLocked ? '#BDC3C7' : '#2E86C1'}
                            />
                            <Text style={[
                                webDynamicStyles.rememberMeText,
                                (loading || isLocked) && { color: '#BDC3C7' }
                            ]}>
                                Remember me
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setResetModalVisible(true)}
                            disabled={loading || isLocked}
                        >
                            <Text style={[
                                webDynamicStyles.forgotPasswordText,
                                (loading || isLocked) && { color: '#BDC3C7' }
                            ]}>
                                Forgot password?
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Login Button */}
                    <Button
                        mode="contained"
                        onPress={handleEmailLogin}
                        loading={loading}
                        disabled={loading || isLocked || !isConnected}
                        style={[
                            webDynamicStyles.loginButton,
                            (loading || isLocked || !isConnected) && webDynamicStyles.loginButtonDisabled
                        ]}
                        contentStyle={webDynamicStyles.loginButtonContent}
                        labelStyle={webDynamicStyles.loginButtonLabel}
                        icon={loading ? undefined : 'login'}
                    >
                        {loading ? 'Logging in...' : 'Log in'}
                    </Button>

                    {/* Network Warning */}
                    {!isConnected && (
                        <View style={webDynamicStyles.networkWarning}>
                            <MaterialIcons name="wifi-off" size={16} color="#E67E22" />
                            <Text style={webDynamicStyles.networkWarningText}>
                                Internet connection required
                            </Text>
                        </View>
                    )}

                    {/* Footer Text */}
                    <Text style={webDynamicStyles.footerText}>
                        © {new Date().getFullYear()} NUTRIFIX - All rights reserved
                    </Text>
                </Animated.View>
            </View>
        </View>
    );

    // 📱 RENDER MOBILE LAYOUT (Original)
    const renderMobileLayout = () => (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={dynamicStyles.container}
        >
            <StatusBar barStyle="light-content" backgroundColor="#2E86C1" />

            <LinearGradient
                colors={['#2E86C1', '#3498DB', '#5DADE2']}
                style={styles.gradient}
            >
                <ScrollView
                    contentContainerStyle={dynamicStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Network Status - Desktop only */}
                    {isDesktop && renderNetworkStatus()}

                    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                        <View style={dynamicStyles.logoContainer}>
                            <FontAwesome5
                                name="leaf"
                                size={isDesktop ? 60 : isTablet ? 50 : 45}
                                color="#FFF"
                            />
                        </View>
                        <Text style={dynamicStyles.title}>NUTRIFIX</Text>
                        <Text style={dynamicStyles.subtitle}>Gestion Agricole Intégrée</Text>
                    </Animated.View>

                    <Card style={dynamicStyles.card}>
                        <Card.Content>
                            <View style={styles.tabsContainer}>
                                <TouchableOpacity
                                    style={[styles.tab, loginMethod === 'email' && styles.activeTab]}
                                    onPress={() => setLoginMethod('email')}
                                    disabled={loading || isLocked}
                                >
                                    <MaterialIcons
                                        name="email"
                                        size={20}
                                        color={loginMethod === 'email' ? '#2E86C1' : '#7F8C8D'}
                                    />
                                    <Text style={[styles.tabText, loginMethod === 'email' && styles.activeTabText]}>
                                        Email
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.tab, loginMethod === 'qr' && styles.activeTab]}
                                    onPress={() => setLoginMethod('qr')}
                                    disabled={loading || isLocked}
                                >
                                    <MaterialIcons
                                        name="qr-code-scanner"
                                        size={20}
                                        color={loginMethod === 'qr' ? '#2E86C1' : '#7F8C8D'}
                                    />
                                    <Text style={[styles.tabText, loginMethod === 'qr' && styles.activeTabText]}>
                                        QR Code
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {loginMethod === 'email' && renderEmailForm()}
                            {loginMethod === 'qr' && renderQRForm()}

                            {/* Biometric - Only if available */}
                            {biometricAvailable && !isLocked && (
                                <>
                                    <View style={styles.separatorContainer}>
                                        <View style={styles.separatorLine} />
                                        <Text style={styles.separatorText}>OU</Text>
                                        <View style={styles.separatorLine} />
                                    </View>

                                    <TouchableOpacity
                                        style={styles.biometricButton}
                                        onPress={handleBiometricLogin}
                                        disabled={loading || !isConnected}
                                    >
                                        <MaterialIcons
                                            name={getBiometricIcon()}
                                            size={50}
                                            color={loading || !isConnected ? '#BDC3C7' : '#2E86C1'}
                                        />
                                        <Text style={[
                                            styles.biometricText,
                                            (loading || !isConnected) && { color: '#BDC3C7' }
                                        ]}>
                                            Connexion par {getBiometricText()}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* Dev Info */}
                            {__DEV__ && !biometricAvailable && !isLocked && isMobile && (
                                <View style={styles.infoContainer}>
                                    <MaterialIcons name="info-outline" size={20} color="#3498DB" />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.infoTitle}>
                                            {isExpoGo ? 'Expo Go détecté' : LocalAuthentication ? 'Biométrie non configurée' : 'Module manquant'}
                                        </Text>
                                        <Text style={styles.infoText}>
                                            {isExpoGo
                                                ? 'Créez un Development Build pour la biométrie'
                                                : LocalAuthentication
                                                    ? 'Configurez votre empreinte dans Paramètres'
                                                    : 'Installez expo-local-authentication'
                                            }
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </Card.Content>
                    </Card>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            © {new Date().getFullYear()} NUTRIFIX - Tous droits réservés
                        </Text>
                        <Text style={styles.versionText}>Version 1.0.0</Text>
                    </View>
                </ScrollView>
            </LinearGradient>

            {/* Snackbar - Mobile only */}
            {isMobile && (
                <Snackbar
                    visible={showErrorSnackbar}
                    onDismiss={dismissError}
                    duration={5000}
                    style={styles.snackbar}
                    action={{ label: 'Fermer', onPress: dismissError }}
                >
                    {errorMessage}
                </Snackbar>
            )}

            <Portal>
                <Modal
                    visible={resetModalVisible}
                    onDismiss={() => !loading && setResetModalVisible(false)}
                    contentContainerStyle={[
                        styles.modalContainer,
                        {
                            width: isDesktop ? 450 : isTablet ? 400 : windowDimensions.width - 40,
                            maxWidth: 500,
                            alignSelf: 'center'
                        }
                    ]}
                >
                    <Text style={styles.modalTitle}>Réinitialiser le mot de passe</Text>
                    <Text style={styles.modalSubtitle}>
                        Entrez votre email pour recevoir un lien
                    </Text>

                    <TextInput
                        label="Email"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.modalInput}
                        theme={{ colors: { primary: '#2E86C1' } }}
                        disabled={loading}
                    />

                    <View style={styles.modalButtons}>
                        <Button
                            mode="outlined"
                            onPress={() => setResetModalVisible(false)}
                            style={styles.modalButton}
                            disabled={loading}
                        >
                            Annuler
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handlePasswordReset}
                            loading={loading}
                            disabled={loading || !isConnected}
                            style={[styles.modalButton, { marginLeft: 10 }]}
                        >
                            Envoyer
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#2E86C1" />
                        <Text style={styles.loadingText}>Connexion en cours...</Text>
                        {isMobile && (
                            <Text style={styles.loadingSubText}>Veuillez patienter...</Text>
                        )}
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );

    const renderNetworkStatus = () => (
        <View style={styles.networkStatusContainer}>
            <MaterialIcons
                name={getNetworkIcon()}
                size={16}
                color={getNetworkColor()}
            />
            <Text style={[styles.networkStatusText, { color: getNetworkColor() }]}>
                {isCheckingNetwork
                    ? 'Vérification...'
                    : isConnected
                        ? (networkType === 'wifi' ? 'WiFi' : 'Données mobiles')
                        : 'Hors ligne'
                }
            </Text>
        </View>
    );

    const renderLockoutBanner = () => {
        if (!isLocked) return null;

        return (
            <View style={isWeb ? webDynamicStyles.lockoutBanner : styles.lockoutBanner}>
                <MaterialIcons name="lock-clock" size={24} color="#FFF" />
                <View style={styles.lockoutTextContainer}>
                    <Text style={styles.lockoutTitle}>🔒 Compte Verrouillé</Text>
                    <Text style={styles.lockoutTime}>
                        Déblocage dans: {formatTimeRemaining(timeRemaining)}
                    </Text>
                </View>
            </View>
        );
    };

    const renderEmailForm = () => (
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {renderLockoutBanner()}

            <TextInput
                ref={emailInputRef}
                label="Email"
                value={email}
                onChangeText={(text) => {
                    setEmail(text);
                    setEmailError('');
                    dismissError();
                }}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                style={styles.input}
                error={!!emailError}
                left={<TextInput.Icon icon="email" />}
                theme={{ colors: { primary: '#2E86C1' } }}
                disabled={loading || isLocked}
                editable={!loading && !isLocked}
            />
            <HelperText type="error" visible={!!emailError}>
                {emailError}
            </HelperText>

            <TextInput
                ref={passwordInputRef}
                label="Mot de passe"
                value={password}
                onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError('');
                    dismissError();
                }}
                onSubmitEditing={handleEmailLogin}
                mode="outlined"
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                style={styles.input}
                error={!!passwordError}
                left={<TextInput.Icon icon="lock" />}
                right={
                    <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowPassword(!showPassword)}
                        disabled={loading || isLocked}
                    />
                }
                theme={{ colors: { primary: '#2E86C1' } }}
                disabled={loading || isLocked}
                editable={!loading && !isLocked}
            />
            <HelperText type="error" visible={!!passwordError}>
                {passwordError}
            </HelperText>

            <View style={styles.optionsRow}>
                <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                    disabled={loading || isLocked}
                >
                    <MaterialIcons
                        name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={loading || isLocked ? '#BDC3C7' : '#2E86C1'}
                    />
                    <Text style={[
                        styles.rememberMeText,
                        (loading || isLocked) && { color: '#BDC3C7' }
                    ]}>
                        Se souvenir de moi
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setResetModalVisible(true)}
                    disabled={loading || isLocked}
                >
                    <Text style={[
                        styles.forgotPasswordText,
                        (loading || isLocked) && { color: '#BDC3C7' }
                    ]}>
                        Mot de passe oublié ?
                    </Text>
                </TouchableOpacity>
            </View>

            <Button
                mode="contained"
                onPress={handleEmailLogin}
                loading={loading}
                disabled={loading || isLocked || !isConnected}
                style={[
                    styles.loginButton,
                    (loading || isLocked || !isConnected) && styles.loginButtonDisabled
                ]}
                contentStyle={styles.loginButtonContent}
                labelStyle={styles.loginButtonLabel}
                icon={loading ? undefined : 'login'}
            >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>

            {!isConnected && (
                <View style={styles.networkWarning}>
                    <MaterialIcons name="wifi-off" size={16} color="#E67E22" />
                    <Text style={styles.networkWarningText}>
                        Connexion internet requise
                    </Text>
                </View>
            )}
        </Animated.View>
    );

    const renderQRForm = () => (
        <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            {renderLockoutBanner()}

            <TextInput
                ref={matriculeInputRef}
                label="Matricule"
                value={matricule}
                onChangeText={(text) => {
                    setMatricule(text);
                    setMatriculeError('');
                    dismissError();
                }}
                mode="outlined"
                autoCapitalize="characters"
                style={styles.input}
                error={!!matriculeError}
                left={<TextInput.Icon icon="badge-account" />}
                theme={{ colors: { primary: '#2E86C1' } }}
                disabled={loading || isLocked}
                editable={!loading && !isLocked}
            />
            <HelperText type="error" visible={!!matriculeError}>
                {matriculeError}
            </HelperText>

            <Button
                mode="contained"
                onPress={handleQRLogin}
                loading={loading}
                disabled={loading || isLocked || Platform.OS === 'web' || !isConnected}
                icon={loading ? undefined : "qrcode-scan"}
                style={[
                    styles.loginButton,
                    (loading || isLocked || Platform.OS === 'web' || !isConnected) && styles.loginButtonDisabled
                ]}
                contentStyle={styles.loginButtonContent}
                labelStyle={styles.loginButtonLabel}
            >
                {loading ? 'Connexion...' : 'Scanner le QR Code'}
            </Button>

            {Platform.OS === 'web' && (
                <View style={styles.webWarningContainer}>
                    <MaterialIcons name="info-outline" size={16} color="#E67E22" />
                    <Text style={styles.webWarningText}>
                        Scanner QR non disponible sur le web
                    </Text>
                </View>
            )}

            {!isConnected && (
                <View style={styles.networkWarning}>
                    <MaterialIcons name="wifi-off" size={16} color="#E67E22" />
                    <Text style={styles.networkWarningText}>
                        Connexion internet requise
                    </Text>
                </View>
            )}

            <Text style={styles.qrHintText}>
                Utilisez votre carte employé digitale
            </Text>
        </Animated.View>
    );

    // ============================================
    // DYNAMIC STYLES - MOBILE
    // ============================================
    const dynamicStyles = StyleSheet.create({
        container: {
            flex: 1,
            ...(isWeb && {
                height: '100vh',
                overflow: 'hidden'
            })
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: isDesktop ? 40 : isTablet ? 30 : 20,
            paddingTop: Platform.OS === 'ios' ? 60 : 40,
            minHeight: isWeb ? '100vh' : undefined,
        },
        card: {
            borderRadius: 20,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            width: getResponsiveCardWidth(),
            maxWidth: 500,
        },
        logoContainer: {
            width: isDesktop ? 100 : isTablet ? 90 : 80,
            height: isDesktop ? 100 : isTablet ? 90 : 80,
            borderRadius: isDesktop ? 50 : isTablet ? 45 : 40,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
        },
        title: {
            fontSize: isDesktop ? 42 : isTablet ? 38 : 32,
            fontWeight: 'bold',
            color: '#FFF',
            marginBottom: 5,
        },
        subtitle: {
            fontSize: isDesktop ? 18 : isTablet ? 17 : 15,
            color: 'rgba(255, 255, 255, 0.9)',
        },
    });

    // ============================================
    // DYNAMIC STYLES - WEB LAYOUT
    // ============================================
    const webDynamicStyles = StyleSheet.create({
        webContainer: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: '#FFF',
        },
        leftSection: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
        },
        gradientOverlay: {
            flex: 1,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
        },
        welcomeContainer: {
            zIndex: 10,
            alignItems: 'flex-start',
            paddingLeft: 60,
        },
        welcomeTitle: {
            fontSize: 72,
            fontWeight: 'bold',
            color: '#FFF',
            lineHeight: 80,
        },
        welcomeSubtitle: {
            fontSize: 72,
            fontWeight: 'bold',
            color: '#FFF',
            lineHeight: 80,
        },
        gridPattern: {
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.1,
            backgroundColor: 'transparent',
        },


        rightSection: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#FFF',
            paddingHorizontal: 50,
        },
        formWrapper: {
            width: '100%',
            maxWidth: 380,
        },
        formTitle: {
            fontSize: 28,
            fontWeight: '600',
            color: '#1A1A1A',
            marginBottom: 30,
            marginTop: 20,
        },
        inputGroup: {
            marginBottom: 15,
        },
        input: {
            backgroundColor: '#FFF',
            borderColor: '#E0E0E0',
            borderWidth: 1.5,
        },
        optionsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            marginBottom: 24,
        },
        rememberMeContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        rememberMeText: {
            marginLeft: 8,
            fontSize: 14,
            color: '#555',
        },
        forgotPasswordText: {
            fontSize: 14,
            color: '#2E86C1',
            fontWeight: '600',
        },
        loginButton: {
            marginTop: 8,
            borderRadius: 8,
            elevation: 0,
            backgroundColor: '#2E86C1',
        },
        loginButtonDisabled: {
            backgroundColor: '#BDC3C7',
        },
        loginButtonContent: {
            paddingVertical: 10,
        },
        loginButtonLabel: {
            fontSize: 16,
            fontWeight: '600',
        },
        networkWarning: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FEF5E7',
            padding: 12,
            borderRadius: 8,
            marginTop: 16,
            borderWidth: 1,
            borderColor: '#E67E22',
        },
        networkWarningText: {
            fontSize: 12,
            color: '#D35400',
            marginLeft: 8,
            fontWeight: '500',
        },
        lockoutBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#E74C3C',
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
        },
        footerText: {
            fontSize: 12,
            color: '#999',
            textAlign: 'center',
            marginTop: 32,
        },
    });

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <>
            {isWeb ? renderWebLayout() : renderMobileLayout()}

            {/* Loading Overlay - Visible on all platforms */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#2E86C1" />
                        <Text style={styles.loadingText}>{isWeb ? 'Logging in...' : 'Connexion en cours...'}</Text>
                        {isMobile && (
                            <Text style={styles.loadingSubText}>Veuillez patienter...</Text>
                        )}
                    </View>
                </View>
            )}

            {/* Password Reset Modal */}
            <Portal>
                <Modal
                    visible={resetModalVisible}
                    onDismiss={() => !loading && setResetModalVisible(false)}
                    contentContainerStyle={[
                        styles.modalContainer,
                        {
                            width: isDesktop ? 450 : isTablet ? 400 : windowDimensions.width - 40,
                            maxWidth: 500,
                            alignSelf: 'center'
                        }
                    ]}
                >
                    <Text style={styles.modalTitle}>{isWeb ? 'Reset Password' : 'Réinitialiser le mot de passe'}</Text>
                    <Text style={styles.modalSubtitle}>
                        {isWeb ? 'Enter your email to receive a link' : 'Entrez votre email pour recevoir un lien'}
                    </Text>

                    <TextInput
                        label="Email"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.modalInput}
                        theme={{ colors: { primary: '#2E86C1' } }}
                        disabled={loading}
                    />

                    <View style={styles.modalButtons}>
                        <Button
                            mode="outlined"
                            onPress={() => setResetModalVisible(false)}
                            style={styles.modalButton}
                            disabled={loading}
                        >
                            {isWeb ? 'Cancel' : 'Annuler'}
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handlePasswordReset}
                            loading={loading}
                            disabled={loading || !isConnected}
                            style={[styles.modalButton, { marginLeft: 10 }]}
                        >
                            {isWeb ? 'Send' : 'Envoyer'}
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* Snackbar - Mobile only */}
            {isMobile && (
                <Snackbar
                    visible={showErrorSnackbar}
                    onDismiss={dismissError}
                    duration={5000}
                    style={styles.snackbar}
                    action={{ label: isWeb ? 'Close' : 'Fermer', onPress: dismissError }}
                >
                    {errorMessage}
                </Snackbar>
            )}
        </>
    );
};

// ============================================
// STATIC STYLES
// ============================================
const styles = StyleSheet.create({
    gradient: { flex: 1 },

    // Network Status
    networkStatusContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        zIndex: 1000,
    },
    networkStatusText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: '600',
    },

    // Header
    header: { alignItems: 'center', marginBottom: 30 },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ECF0F1',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: { borderBottomColor: '#2E86C1' },
    tabText: {
        marginLeft: 5,
        fontSize: 14,
        color: '#7F8C8D',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#2E86C1',
        fontWeight: '700',
    },

    // Forms
    formContainer: { marginTop: 10 },

    // Lockout Banner
    lockoutBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E74C3C',
        padding: 15,
        marginBottom: 15,
        borderRadius: 8,
    },
    lockoutTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    lockoutTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    lockoutTime: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '600',
    },

    // Inputs
    input: { marginBottom: 5, backgroundColor: '#FFF' },

    // Options Row
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    rememberMeContainer: { flexDirection: 'row', alignItems: 'center' },
    rememberMeText: { marginLeft: 5, fontSize: 14, color: '#2C3E50' },
    forgotPasswordText: { fontSize: 14, color: '#2E86C1', fontWeight: '600' },

    // Buttons
    loginButton: { marginTop: 10, borderRadius: 10, elevation: 2 },
    loginButtonDisabled: {
        backgroundColor: '#BDC3C7',
    },
    loginButtonContent: { paddingVertical: 8 },
    loginButtonLabel: { fontSize: 16, fontWeight: 'bold' },

    // Network Warning
    networkWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF5E7',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E67E22',
    },
    networkWarningText: {
        fontSize: 12,
        color: '#D35400',
        marginLeft: 8,
        fontWeight: '500',
    },

    // Web Warning
    webWarningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF5E7',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E67E22',
    },
    webWarningText: {
        fontSize: 12,
        color: '#D35400',
        marginLeft: 8,
        fontWeight: '500',
    },

    // QR Hint
    qrHintText: {
        fontSize: 12,
        color: '#7F8C8D',
        textAlign: 'center',
        marginTop: 15,
        fontStyle: 'italic',
    },

    // Separator
    separatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 25,
    },
    separatorLine: { flex: 1, height: 1, backgroundColor: '#ECF0F1' },
    separatorText: {
        marginHorizontal: 15,
        fontSize: 14,
        color: '#7F8C8D',
        fontWeight: '600',
    },

    // Biometric Button
    biometricButton: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F8F9F9',
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#2E86C1',
        borderStyle: 'dashed',
    },
    biometricText: {
        marginTop: 10,
        color: '#2E86C1',
        fontSize: 16,
        fontWeight: '600',
    },

    // Info Container
    infoContainer: {
        flexDirection: 'row',
        marginTop: 20,
        padding: 15,
        backgroundColor: '#EBF5FB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#3498DB',
    },
    infoTitle: {
        fontSize: 14,
        color: '#2874A6',
        fontWeight: '600',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 12,
        color: '#5DADE2',
    },

    webLogoContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,  // Circle
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 2,
        marginBottom: 24,
    },

    // Footer
    footer: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
    footerText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 5,
    },
    versionText: { fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' },

    // Snackbar
    snackbar: {
        backgroundColor: '#E74C3C',
        marginBottom: Platform.OS === 'ios' ? 40 : 20,
    },

    // Modal
    modalContainer: {
        backgroundColor: 'white',
        margin: 20,
        padding: 20,
        borderRadius: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginBottom: 10,
    },
    modalSubtitle: { fontSize: 14, color: '#7F8C8D', marginBottom: 20 },
    modalInput: { marginBottom: 20, backgroundColor: '#FFF' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
    modalButton: { minWidth: 100 },

    // Loading Overlay
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    loadingCard: {
        backgroundColor: '#FFF',
        padding: 30,
        borderRadius: 15,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: '#2C3E50',
        fontWeight: '600',
    },
    loadingSubText: {
        marginTop: 8,
        fontSize: 14,
        color: '#7F8C8D',
        fontStyle: 'italic',
    },
});

export default LoginScreen;