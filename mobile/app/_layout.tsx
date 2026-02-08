// filepath: mobile/app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';
import LoginScreen from '../src/screens/auth/LoginScreen';
import RootNavigator from '../src/navigation/RootNavigator';

export default function AppLayout() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
            
            console.log('🔍 Vérification auth au démarrage');
            
            if (token && tokenExpiry) {
                const expiryDate = new Date(tokenExpiry);
                const now = new Date();
                
                if (expiryDate > now) {
                    console.log('✅ Token valide');
                    setIsAuthenticated(true);
                } else {
                    console.log('❌ Token expiré');
                    await clearAuthData();
                    setIsAuthenticated(false);
                }
            } else {
                console.log('❌ Pas de token');
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('❌ Erreur checkAuthStatus:', error);
            setIsAuthenticated(false);
        } finally {
            setIsChecking(false);
        }
    };

    const clearAuthData = async () => {
        await AsyncStorage.multiRemove([
            'userToken',
            'tokenExpiry',
            'userRole',
            'userData',
            'userMatricule'
        ]);
    };

    const handleLogin = async (user: any) => {
        console.log('✅ handleLogin appelé');
        
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        await AsyncStorage.setItem('tokenExpiry', expiry.toISOString());
        
        setIsAuthenticated(true);
    };

    const handleLogout = async () => {
        console.log('🚪 Déconnexion');
        await clearAuthData();
        setIsAuthenticated(false);
    };

    if (isChecking) {
        return (
            <PaperProvider>
                <View style={{ 
                    flex: 1, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    backgroundColor: '#2E86C1' 
                }}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            </PaperProvider>
        );
    }

    if (!isAuthenticated) {
        return (
            <PaperProvider>
                <LoginScreen 
                    navigation={undefined}  // ✅ Correction
                    onLogin={handleLogin} 
                />
            </PaperProvider>
        );
    }

    return (
        <PaperProvider>
            <RootNavigator onLogout={handleLogout} />
        </PaperProvider>
    );
}