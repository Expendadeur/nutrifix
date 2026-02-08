import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import AllScreensTempsPartiel from '../screens/employe-temps-partiel/AllScreensTempsPartiel';

const Tab = createBottomTabNavigator();

const EmployeTempsPartielNavigator = ({ onLogout }) => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = focused ? 'time' : 'time-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#2E86C1',
                tabBarInactiveTintColor: 'gray',
                headerShown: true,
            })}
        >
            <Tab.Screen 
                name="TempsPartiel" 
                component={AllScreensTempsPartiel}
                options={{ title: 'Temps Partiel' }}
                initialParams={{ onLogout }}
            />
        </Tab.Navigator>
    );
};

export default EmployeTempsPartielNavigator;