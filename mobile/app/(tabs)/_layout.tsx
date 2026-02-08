// filepath: d:\NUTRIFIX\mobile\app\_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';
import { Stack } from 'expo-router';
import LoginScreen from '../../src/screens/auth/LoginScreen';

export default function RootLayout() {
    const [isLoggedIn, setIsLoggedIn] = useState<null | boolean>(null); // null = loading, true = logged in, false = not

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
                if (token && tokenExpiry && new Date(tokenExpiry) > new Date()) {
                    setIsLoggedIn(true);
                } else {
                    setIsLoggedIn(false);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                setIsLoggedIn(false);
            }
        };
        checkAuth();
    }, []);

    if (isLoggedIn === null) {
        // Afficher un indicateur de chargement pendant la vérification
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!isLoggedIn) {
        // Afficher LoginScreen si non connecté
        return <LoginScreen navigation={undefined} onLogin={undefined} />;
    }

    return (
        <PaperProvider>
            <Stack />
        </PaperProvider>
    );
}