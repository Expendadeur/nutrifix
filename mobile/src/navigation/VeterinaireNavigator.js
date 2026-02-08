// mobile/src/navigation/VeterinaireNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View, Text } from 'react-native';

// Veterinaire Screens
import AnimauxScreen from '../screens/veterinaire/AnimauxScreen';
import DashboardScreen from '../screens/veterinaire/DashboardScreen';
import InterventionsScreen from '../screens/veterinaire/InterventionsScreen';
import ProfilScreen from '../screens/veterinaire/ProfilScreen';

const Tab = createBottomTabNavigator();

const VeterinaireNavigator = ({ onLogout }) => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    
                    switch (route.name) {
                        case 'Dashboard':
                            iconName = focused ? 'medkit' : 'medkit-outline';
                            break;
                        case 'Animaux':
                            iconName = focused ? 'paw' : 'paw-outline';
                            break;
                        case 'Interventions':
                            iconName = focused ? 'clipboard' : 'clipboard-outline';
                            break;
                        case 'Salaires':
                            iconName = focused ? 'cash' : 'cash-outline';
                            break;
                        case 'Profil':
                            iconName = focused ? 'person' : 'person-outline';
                            break;
                        default:
                            iconName = 'help-outline';
                    }
                    
                    return (
                        <View style={[
                            styles.iconContainer,
                            focused && styles.iconContainerActive
                        ]}>
                            <Ionicons name={iconName} size={size} color={color} />
                            {focused && <View style={styles.activeIndicator} />}
                        </View>
                    );
                },
                tabBarActiveTintColor: '#2E86C1',
                tabBarInactiveTintColor: '#7F8C8D',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabBarLabel,
                headerStyle: styles.header,
                headerTintColor: '#FFF',
                headerTitleStyle: styles.headerTitle,
                headerTitleAlign: 'center',
                headerShown: true,
            })}
        >
            <Tab.Screen 
                name="Dashboard" 
                component={DashboardScreen}
                options={{ 
                    title: 'Tableau de bord',
                    tabBarLabel: 'Accueil',
                    headerRight: () => (
                        <View style={styles.headerBadge}>
                            <Ionicons name="medical" size={20} color="#FFF" />
                        </View>
                    ),
                }}
            />
            
            <Tab.Screen 
                name="Animaux" 
                component={AnimauxScreen}
                options={{ 
                    title: 'Animaux',
                    tabBarLabel: 'Animaux',
                    tabBarBadge: null, // Badge peut être ajouté dynamiquement
                }}
            />
            
            <Tab.Screen 
                name="Interventions" 
                component={InterventionsScreen}
                options={{ 
                    title: 'Interventions',
                    tabBarLabel: 'Interventions',
                }}
            />
            
            <Tab.Screen 
                name="Profil" 
                options={{ 
                    title: 'Mon Profil',
                    tabBarLabel: 'Profil',
                }}
            >
                {(props) => <ProfilScreen {...props} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    // Tab Bar Styles
    tabBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        height: Platform.OS === 'ios' ? 85 : 65,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 8,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
        letterSpacing: 0.3,
    },
    
    // Icon Container Styles
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 12,
        minWidth: 60,
    },
    iconContainerActive: {
        backgroundColor: 'rgba(46, 134, 193, 0.1)',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 40,
        height: 3,
        backgroundColor: '#2E86C1',
        borderRadius: 2,
    },
    
    // Header Styles
    header: {
        backgroundColor: '#2E86C1',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    headerTitle: {
        fontWeight: 'bold',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    headerBadge: {
        marginRight: 15,
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    
    // Badge Styles (pour notifications futures)
    badge: {
        position: 'absolute',
        right: -6,
        top: -3,
        backgroundColor: '#E74C3C',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    
    // Animation & Feedback
    pressedTab: {
        transform: [{ scale: 0.95 }],
    },
    
    // Accessibility
    accessibilityLabel: {
        fontSize: 14,
        color: '#7F8C8D',
    },
});

export default VeterinaireNavigator;