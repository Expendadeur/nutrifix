// mobile/src/navigation/ManagerNavigator.js
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import DashboardManagerScreen from '../screens/manager/DashboardManagerScreen';
import EquipeRHScreen from '../screens/manager/EquipeRHScreen';
import FinancierDepartementScreen from '../screens/manager/FinancierDepartementScreen';
import ModulesOperationnelsScreen from '../screens/manager/ModulesOperationnelsScreen';

const Drawer = createDrawerNavigator();

// En-tête personnalisé du Drawer
const CustomDrawerHeader = () => (
    <View style={styles.drawerHeader}>
        <View style={styles.avatarContainer}>
            <Ionicons name="business" size={50} color="#FFF" />
        </View>
        <Text style={styles.drawerHeaderTitle}>Management</Text>
        <Text style={styles.drawerHeaderSubtitle}>NUTRIFIX</Text>
    </View>
);

const ManagerNavigator = ({ onLogout }) => {
    return (
        <Drawer.Navigator
            screenOptions={{
                headerStyle: { 
                    backgroundColor: '#2E86C1',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                },
                headerTintColor: '#FFF',
                headerTitleStyle: { 
                    fontWeight: 'bold',
                    fontSize: 18,
                },
                drawerActiveTintColor: '#2E86C1',
                drawerInactiveTintColor: '#7F8C8D',
                drawerActiveBackgroundColor: '#E3F2FD',
                drawerStyle: {
                    backgroundColor: '#FAFAFA',
                    width: 280,
                },
                drawerLabelStyle: {
                    fontSize: 15,
                    fontWeight: '600',
                    marginLeft: -16,
                },
                drawerItemStyle: {
                    borderRadius: 8,
                    marginHorizontal: 10,
                    marginVertical: 4,
                    paddingVertical: 4,
                },
            }}
            drawerContent={(props) => {
                const { state, navigation, descriptors } = props;
                return (
                    <View style={styles.drawerContainer}>
                        <CustomDrawerHeader />
                        
                        <View style={styles.drawerItemsContainer}>
                            {state.routes.map((route, index) => {
                                const { options } = descriptors[route.key];
                                const isFocused = state.index === index;
                                const isLogout = route.name === 'Déconnexion';

                                return (
                                    <View 
                                        key={route.key}
                                        style={[
                                            styles.drawerItem,
                                            isFocused && styles.drawerItemActive,
                                            isLogout && styles.drawerItemLogout
                                        ]}
                                    >
                                        {options.drawerIcon && (
                                            <View style={styles.iconContainer}>
                                                {options.drawerIcon({
                                                    color: isLogout ? '#E74C3C' : (isFocused ? '#2E86C1' : '#7F8C8D'),
                                                    size: 24,
                                                })}
                                            </View>
                                        )}
                                        <Text
                                            style={[
                                                styles.drawerItemLabel,
                                                isFocused && styles.drawerItemLabelActive,
                                                isLogout && styles.drawerItemLabelLogout
                                            ]}
                                            onPress={() => {
                                                if (route.name === 'Déconnexion') {
                                                    if (onLogout) onLogout();
                                                } else {
                                                    navigation.navigate(route.name);
                                                }
                                            }}
                                        >
                                            {options.title || route.name}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={styles.drawerFooter}>
                            <Text style={styles.footerText}>NUTRIFIX v1.0.0</Text>
                            <Text style={styles.footerSubtext}>Module Management</Text>
                        </View>
                    </View>
                );
            }}
        >
            <Drawer.Screen 
                name="Dashboard" 
                component={DashboardManagerScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="analytics" size={size} color={color} />
                    ),
                    title: 'Tableau de bord'
                }}
            />
            
            <Drawer.Screen 
                name="EquipeRH" 
                component={EquipeRHScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="people" size={size} color={color} />
                    ),
                    title: 'Équipe RH'
                }}
            />
            
            <Drawer.Screen 
                name="Financier" 
                component={FinancierDepartementScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="cash" size={size} color={color} />
                    ),
                    title: 'Financier'
                }}
            />
            
            <Drawer.Screen 
                name="Modules" 
                component={ModulesOperationnelsScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="apps" size={size} color={color} />
                    ),
                    title: 'Modules Opérationnels'
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

const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    drawerHeader: {
        backgroundColor: '#2E86C1',
        paddingVertical: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomRightRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#FFF',
    },
    drawerHeaderTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    drawerHeaderSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '600',
    },
    drawerItemsContainer: {
        flex: 1,
        paddingTop: 20,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginHorizontal: 10,
        marginVertical: 4,
        borderRadius: 8,
    },
    drawerItemActive: {
        backgroundColor: '#E3F2FD',
    },
    drawerItemLogout: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingTop: 20,
    },
    iconContainer: {
        marginRight: 16,
    },
    drawerItemLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#7F8C8D',
    },
    drawerItemLabelActive: {
        color: '#2E86C1',
        fontWeight: '700',
    },
    drawerItemLabelLogout: {
        color: '#E74C3C',
        fontWeight: '700',
    },
    drawerFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#7F8C8D',
        fontWeight: '600',
    },
    footerSubtext: {
        fontSize: 11,
        color: '#BDC3C7',
        marginTop: 4,
    },
});

export default ManagerNavigator;