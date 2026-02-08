// mobile/src/screens/auth/ForgotPasswordScreen.js
import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    Alert
} from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import authService from '../../services/authService';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const validateEmail = (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
            setEmailError('Email requis');
            return false;
        }
        if (!emailRegex.test(value)) {
            setEmailError('Format email invalide');
            return false;
        }
        setEmailError('');
        return true;
    };

    const handleResetPassword = async () => {
        if (!validateEmail(email)) {
            return;
        }

        setLoading(true);
        try {
            const result = await authService.resetPassword(email);

            if (result.success) {
                setEmailSent(true);
                Alert.alert(
                    'Email Envoyé',
                    'Un lien de réinitialisation a été envoyé à votre adresse email.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', result.message);
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'envoyer l\'email de réinitialisation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={['#2E86C1', '#3498DB', '#5DADE2']}
            style={styles.gradient}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="lock-reset" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Mot de passe oublié ?</Text>
                        <Text style={styles.subtitle}>
                            Entrez votre email pour recevoir un lien de réinitialisation
                        </Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        {!emailSent ? (
                            <>
                                <TextInput
                                    label="Email"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        setEmailError('');
                                    }}
                                    onBlur={() => validateEmail(email)}
                                    mode="outlined"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCompleteType="email"
                                    textContentType="emailAddress"
                                    style={styles.input}
                                    error={!!emailError}
                                    left={<TextInput.Icon icon="email" />}
                                    theme={{ colors: { primary: '#2E86C1' } }}
                                    disabled={loading}
                                />
                                <HelperText type="error" visible={!!emailError}>
                                    {emailError}
                                </HelperText>

                                <Button
                                    mode="contained"
                                    onPress={handleResetPassword}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.button}
                                    contentStyle={styles.buttonContent}
                                    labelStyle={styles.buttonLabel}
                                >
                                    Envoyer le lien
                                </Button>

                                <Button
                                    mode="text"
                                    onPress={() => navigation.goBack()}
                                    style={styles.backButton}
                                    disabled={loading}
                                >
                                    Retour à la connexion
                                </Button>
                            </>
                        ) : (
                            <View style={styles.successContainer}>
                                <MaterialIcons name="check-circle" size={80} color="#2ECC71" />
                                <Text style={styles.successTitle}>Email Envoyé !</Text>
                                <Text style={styles.successText}>
                                    Vérifiez votre boîte de réception et suivez les instructions
                                    pour réinitialiser votre mot de passe.
                                </Text>
                                <Button
                                    mode="contained"
                                    onPress={() => navigation.goBack()}
                                    style={styles.button}
                                >
                                    Retour à la connexion
                                </Button>
                            </View>
                        )}
                    </View>

                    {/* Info */}
                    <View style={styles.infoContainer}>
                        <MaterialIcons name="info-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.infoText}>
                            Si vous ne recevez pas l'email dans quelques minutes, vérifiez votre
                            dossier spam ou contactez l'administrateur.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 30,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    input: {
        marginBottom: 5,
        backgroundColor: '#FFF',
    },
    button: {
        marginTop: 20,
        borderRadius: 10,
        elevation: 2,
    },
    buttonContent: {
        paddingVertical: 8,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    backButton: {
        marginTop: 15,
    },
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginTop: 20,
        marginBottom: 15,
    },
    successText: {
        fontSize: 16,
        color: '#7F8C8D',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 30,
        paddingHorizontal: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
        marginLeft: 10,
        lineHeight: 18,
    },
});

export default ForgotPasswordScreen;