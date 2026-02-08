// mobile/src/screens/auth/QRScannerScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity, Platform } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';

const QRScannerScreen = ({ navigation, route }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        requestCameraPermission();
    }, []);

    const requestCameraPermission = async () => {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
    };

    const handleBarCodeScanned = async ({ type, data }) => {
        setScanned(true);
        setLoading(true);

        try {
            // Appeler le callback avec les données du QR
            if (route.params?.onScan) {
                await route.params.onScan(data);
                navigation.goBack();
            } else {
                Alert.alert('Erreur', 'Callback de scan manquant');
                navigation.goBack();
            }
        } catch (error) {
            console.error('QR scan error:', error);
            Alert.alert('Erreur', 'QR Code invalide', [
                {
                    text: 'Réessayer',
                    onPress: () => {
                        setScanned(false);
                        setLoading(false);
                    }
                },
                {
                    text: 'Annuler',
                    onPress: () => navigation.goBack(),
                    style: 'cancel'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>Demande de permission caméra...</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <MaterialIcons name="no-photography" size={80} color="#E74C3C" />
                <Text style={styles.noPermissionText}>
                    Accès à la caméra refusé
                </Text>
                <Text style={styles.noPermissionSubtext}>
                    Veuillez autoriser l'accès à la caméra dans les paramètres
                </Text>
                <Button
                    mode="contained"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    Retour
                </Button>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="close" size={30} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scanner QR Code</Text>
            </View>

            <BarCodeScanner
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.overlay}>
                <View style={styles.topOverlay} />
                <View style={styles.middleRow}>
                    <View style={styles.sideOverlay} />
                    <View style={styles.scanArea}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                    <View style={styles.sideOverlay} />
                </View>
                <View style={styles.bottomOverlay}>
                    <Text style={styles.instructionText}>
                        Positionnez le QR code dans le cadre
                    </Text>
                    {scanned && (
                        <Button
                            mode="contained"
                            onPress={() => {
                                setScanned(false);
                                setLoading(false);
                            }}
                            style={styles.rescanButton}
                            disabled={loading}
                            loading={loading}
                        >
                            Scanner à nouveau
                        </Button>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        fontSize: 16,
        color: '#FFF',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 40 : 30,
        zIndex: 10,
    },
    closeButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    topOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    middleRow: {
        flexDirection: 'row',
        height: 300,
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanArea: {
        width: 300,
        height: 300,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#2ECC71',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
    },
    bottomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    instructionText: {
        fontSize: 16,
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 20,
    },
    rescanButton: {
        marginTop: 10,
        minWidth: 200,
    },
    noPermissionText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 20,
        textAlign: 'center',
    },
    noPermissionSubtext: {
        fontSize: 14,
        color: '#BDC3C7',
        marginTop: 10,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    backButton: {
        marginTop: 30,
    },
});

export default QRScannerScreen;