// mobile/src/navigation/EmployeNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import BulletinsSalaireScreen from '../screens/employe/BulletinsSalaireScreen';
import DashboardScreen from '../screens/employe/DashboardScreen';
import DemandeCongeScreen from '../screens/employe/DemandeCongeScreen';
import ProfilScreen from '../screens/employe/ProfilScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Styles pour les headers
const headerStyle = {
    backgroundColor: '#2E86C1',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
};

const headerTintColor = '#fff';

const headerTitleStyle = {
    fontWeight: 'bold',
    fontSize: 18,
};

// Stack pour Dashboard
const DashboardStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="DashboardMain" 
                component={DashboardScreen}
                options={{ 
                    title: 'Accueil',
                    headerStyle,
                    headerTintColor,
                    headerTitleStyle,
                }}
            />
        </Stack.Navigator>
    );
};

// Stack pour Bulletins de Salaire
const BulletinsStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="BulletinsList" 
                component={BulletinsSalaireScreen}
                options={{ 
                    title: 'Bulletins de Salaire',
                    headerStyle,
                    headerTintColor,
                    headerTitleStyle,
                }}
            />
        </Stack.Navigator>
    );
};

// Stack pour Demandes de Congé
const CongesStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="CongesList" 
                component={DemandeCongeScreen}
                options={{ 
                    title: 'Demandes de Congé',
                    headerStyle,
                    headerTintColor,
                    headerTitleStyle,
                }}
            />
        </Stack.Navigator>
    );
};

// Stack pour Profil avec onLogout
const ProfilStack = ({ onLogout }) => {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="ProfilMain" 
                options={{ 
                    title: 'Mon Profil',
                    headerStyle,
                    headerTintColor,
                    headerTitleStyle,
                }}
            >
                {props => <ProfilScreen {...props} onLogout={onLogout} />}
            </Stack.Screen>
        </Stack.Navigator>
    );
};

const EmployeNavigator = ({ onLogout }) => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    switch (route.name) {
                        case 'Dashboard':
                            iconName = focused ? 'grid' : 'grid-outline';
                            break;
                        case 'BulletinSalaire':
                            iconName = focused ? 'document-text' : 'document-text-outline';
                            break;
                        case 'DemandeConge':
                            iconName = focused ? 'calendar' : 'calendar-outline';
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
                        </View>
                    );
                },
                tabBarActiveTintColor: '#2E86C1',
                tabBarInactiveTintColor: '#7F8C8D',
                tabBarStyle: {
                    backgroundColor: '#FFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E3F2FD',
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 65,
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '700',
                    marginBottom: 4,
                },
                tabBarItemStyle: {
                    paddingVertical: 4,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen 
                name="Dashboard" 
                component={DashboardStack}
                options={{ title: 'Accueil' }}
            />
            <Tab.Screen 
                name="BulletinSalaire" 
                component={BulletinsStack}
                options={{ title: 'Bulletins' }}
            />
            <Tab.Screen 
                name="DemandeConge" 
                component={CongesStack}
                options={{ title: 'Congés' }}
            />
            <Tab.Screen 
                name="Profil" 
                options={{ title: 'Profil' }}
            >
                {props => <ProfilStack {...props} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
    },
    iconContainerActive: {
        transform: [{ scale: 1.1 }],
    },
});

export default EmployeNavigator;