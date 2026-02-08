// mobile/src/components/MapViewWrapper.js
import React from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Import conditionnel qui évite le bundling sur web
let MapView, Marker, Circle;

if (Platform.OS !== 'web') {
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
        Circle = Maps.Circle;
    } catch (error) {
        console.log('react-native-maps not available');
    }
}

const MapViewWrapper = ({
    location,
    address,
    height = 300,
    children
}) => {
    // Version Web - Alternative sans carte native
    if (Platform.OS === 'web' || !MapView) {
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
                            title="Ouvrir dans Google Maps"
                            onPress={() => {
                                const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
                                if (Platform.OS === 'web') {
                                    window.open(url, '_blank');
                                }
                            }}
                        />
                    </>
                )}
            </View>
        );
    }

    // Version Mobile/Native - Carte réelle
    return (
        <View style={{ height }}>
            <MapView
                style={styles.map}
                initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation
                showsMyLocationButton
                followsUserLocation
            >
                {children}
            </MapView>
            
            {address && (
                <View style={styles.addressOverlay}>
                    <MaterialIcons name="my-location" size={16} color="#2E86C1" />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {address}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
    addressOverlay: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#2C3E50',
        flex: 1,
    },
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
        padding: 10,
        borderRadius: 8,
        marginVertical: 10,
        maxWidth: '90%',
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
});

// Exporter aussi les composants si disponibles
export const MapMarker = Marker;
export const MapCircle = Circle;

export default MapViewWrapper;