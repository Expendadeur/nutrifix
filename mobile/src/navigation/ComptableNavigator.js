// mobile/src/navigation/ComptableNavigator.js
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

import ClotureScreen from '../screens/comptable/ClotureScreen';
import DashboardScreen from '../screens/comptable/DashboardScreen';
import JournalComptableScreen from '../screens/comptable/JournalComptableScreen';
import RapprochementBancaireScreen from '../screens/comptable/RapprochementBancaireScreen';

const Drawer = createDrawerNavigator();

const ComptableNavigator = ({ onLogout }) => {
    return (
        <Drawer.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#2E86C1' },
                headerTintColor: '#FFF',
                headerTitleStyle: { fontWeight: 'bold' },
                drawerActiveTintColor: '#2E86C1',
                drawerInactiveTintColor: '#7F8C8D',
            }}
        >
            <Drawer.Screen 
                name="Dashboard" 
                component={DashboardScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="speedometer" size={size} color={color} />
                    ),
                    title: 'Tableau de bord'
                }}
            />
            
            <Drawer.Screen 
                name="Journal" 
                component={JournalComptableScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="book" size={size} color={color} />
                    ),
                    title: 'Journal Comptable'
                }}
            />
            
            <Drawer.Screen 
                name="Rapprochement" 
                component={RapprochementBancaireScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="git-compare" size={size} color={color} />
                    ),
                    title: 'Rapprochement Bancaire'
                }}
            />
            
            <Drawer.Screen 
                name="Cloture" 
                component={ClotureScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="lock-closed" size={size} color={color} />
                    ),
                    title: 'Clôture'
                }}
            />
            
            <Drawer.Screen 
                name="Déconnexion" 
                component={() => null}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="log-out" size={size} color={color} />
                    ),
                }}
                listeners={{
                    drawerItemPress: (e) => {
                        e.preventDefault();
                        if (onLogout) {
                            onLogout();
                        }
                    }
                }}
            />
        </Drawer.Navigator>
    );
};

export default ComptableNavigator;