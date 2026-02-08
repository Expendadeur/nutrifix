// mobile/src/components/MapViewWrapper.web.js
// Version Web spécifique - React Native Web utilisera automatiquement ce fichier
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const MapViewWrapper = ({ location, address, height = 300 }) => {
    const openInGoogleMaps = () => {
        if (location) {
            const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            Linking.openURL(url);
        }
    };

    return (
        <View style={[styles.webMapContainer, { height }]}>
            <MaterialIcons name="map" size={80} color="#2E86C1" />
            <Text style={styles.webMapTitle}>Position Actuelle</Text>
            
            {address && (
                <View style={styles.webAddressContainer}>
                    <MaterialIcons name="my-location" size={20} color="#2E86C1" />
                    <Text style={styles.webAddressText}>{address}</Text>
                </View>
            )}
            
            {location && (
                <>
                    <Text style={styles.webMapCoords}>
                        Latitude: {location.latitude.toFixed(6)}
                    </Text>
                    <Text style={styles.webMapCoords}>
                        Longitude: {location.longitude.toFixed(6)}
                    </Text>
                    
                    <Button
                        mode="contained"
                        style={styles.button}
                        onPress={openInGoogleMaps}
                        icon="map"
                    >
                        Ouvrir dans Google Maps
                    </Button>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    webMapContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 20,
    },
    webMapTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginTop: 15,
        marginBottom: 10,
    },
    webAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 8,
        marginVertical: 10,
        maxWidth: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    webAddressText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#2C3E50',
        flex: 1,
        textAlign: 'center',
    },
    webMapCoords: {
        fontSize: 13,
        color: '#7F8C8D',
        marginTop: 5,
    },
    button: {
        marginTop: 15,
        minWidth: 250,
    },
});

// Exports vides pour la compatibilité
export const MapMarker = null;
export const MapCircle = null;

export default MapViewWrapper;