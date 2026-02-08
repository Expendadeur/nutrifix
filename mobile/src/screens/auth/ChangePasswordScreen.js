// mobile/src/screens/auth/ChangePasswordScreen.js
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

const ChangePasswordScreen = ({ navigation, route }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [errors, setErrors] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const [loading, setLoading] = useState(false);

    const validateOldPassword = (value) => {
        if (!value) {
            return 'Ancien mot de passe requis';
        }
        return '';
    };

    const validateNewPassword = (value) => {
        if (!value) {
            return 'Nouveau mot de passe requis';
        }
        if (value.length < 6) {
            return 'Minimum 6 caractères';
        }
        if (value === oldPassword) {
            return 'Le nouveau mot de passe doit être différent';
        }
        return '';
    };

    const validateConfirmPassword = (value) => {
        if (!value) {
            return 'Confirmation requise';
        }
        if (value !== newPassword) {
            return 'Les mots de passe ne correspondent pas';
        }
        return '';
    };

    const handleChangePassword = async () => {
        const oldPasswordError = validateOldPassword(oldPassword);
        const newPasswordError = validateNewPassword(newPassword);
        const confirmPasswordError = validateConfirmPassword(confirmPassword);

        if (oldPasswordError || newPasswordError || confirmPasswordError) {
            setErrors({
                oldPassword: oldPasswordError,
                newPassword: newPasswordError,
                confirmPassword: confirmPasswordError
            });
            return;
        }

        setLoading(true);
        try {
            const result = await authService.changePassword(oldPassword, newPassword);

            if (result.success) {
                Alert.alert(
                    'Succès',
                    'Votre mot de passe a été changé avec succès.',
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
            Alert.alert('Erreur', 'Impossible de changer le mot de passe');
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
                            <MaterialIcons name="vpn-key" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Changer le mot de passe</Text>
                        <Text style={styles.subtitle}>
                            Créez un nouveau mot de passe sécurisé
                        </Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        {/* Ancien mot de passe */}
                        <TextInput
                            label="Ancien mot de passe"
                            value={oldPassword}
                            onChangeText={(text) => {
                                setOldPassword(text);
                                setErrors({ ...errors, oldPassword: '' });
                            }}
                            mode="outlined"
                            secureTextEntry={!showOldPassword}
                            style={styles.input}
                            error={!!errors.oldPassword}
                            left={<TextInput.Icon icon="lock-outline" />}
                            right={
                                <TextInput.Icon
                                    icon={showOldPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowOldPassword(!showOldPassword)}
                                />
                            }
                            theme={{ colors: { primary: '#2E86C1' } }}
                            disabled={loading}
                        />
                        <HelperText type="error" visible={!!errors.oldPassword}>
                            {errors.oldPassword}
                        </HelperText>

                        {/* Nouveau mot de passe */}
                        <TextInput
                            label="Nouveau mot de passe"
                            value={newPassword}
                            onChangeText={(text) => {
                                setNewPassword(text);
                                setErrors({ ...errors, newPassword: '' });
                            }}
                            mode="outlined"
                            secureTextEntry={!showNewPassword}
                            style={styles.input}
                            error={!!errors.newPassword}
                            left={<TextInput.Icon icon="lock" />}
                            right={
                                <TextInput.Icon
                                    icon={showNewPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowNewPassword(!showNewPassword)}
                                />
                            }
                            theme={{ colors: { primary: '#2E86C1' } }}
                            disabled={loading}
                        />
                        <HelperText type="error" visible={!!errors.newPassword}>
                            {errors.newPassword}
                        </HelperText>

                        {/* Confirmer mot de passe */}
                        <TextInput
                            label="Confirmer le mot de passe"
                            value={confirmPassword}
                            onChangeText={(text) => {
                                setConfirmPassword(text);
                                setErrors({ ...errors, confirmPassword: '' });
                            }}
                            mode="outlined"
                            secureTextEntry={!showConfirmPassword}
                            style={styles.input}
                            error={!!errors.confirmPassword}
                            left={<TextInput.Icon icon="lock-check" />}
                            right={
                                <TextInput.Icon
                                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                />
                            }
                            theme={{ colors: { primary: '#2E86C1' } }}
                            disabled={loading}
                        />
                        <HelperText type="error" visible={!!errors.confirmPassword}>
                            {errors.confirmPassword}
                        </HelperText>

                        {/* Critères de mot de passe */}
                        <View style={styles.criteriaContainer}>
                            <Text style={styles.criteriaTitle}>Le mot de passe doit contenir :</Text>
                            <View style={styles.criteriaItem}>
                                <MaterialIcons
                                    name={newPassword.length >= 6 ? 'check-circle' : 'radio-button-unchecked'}
                                    size={20}
                                    color={newPassword.length >= 6 ? '#2ECC71' : '#BDC3C7'}
                                />
                                <Text style={styles.criteriaText}>Au moins 6 caractères</Text>
                            </View>
                            <View style={styles.criteriaItem}>
                                <MaterialIcons
                                    name={newPassword !== oldPassword && newPassword ? 'check-circle' : 'radio-button-unchecked'}
                                    size={20}
                                    color={newPassword !== oldPassword && newPassword ? '#2ECC71' : '#BDC3C7'}
                                />
                                <Text style={styles.criteriaText}>Différent de l'ancien</Text>
                            </View>
                            <View style={styles.criteriaItem}>
                                <MaterialIcons
                                    name={confirmPassword && confirmPassword === newPassword ? 'check-circle' : 'radio-button-unchecked'}
                                    size={20}
                                    color={confirmPassword && confirmPassword === newPassword ? '#2ECC71' : '#BDC3C7'}
                                />
                                <Text style={styles.criteriaText}>Correspondance confirmée</Text>
                            </View>
                        </View>

                        <Button
                            mode="contained"
                            onPress={handleChangePassword}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                        >
                            Changer le mot de passe
                        </Button>

                        <Button
                            mode="text"
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            disabled={loading}
                        >
                            Annuler
                        </Button>
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
    criteriaContainer: {
        backgroundColor: '#F8F9F9',
        borderRadius: 10,
        padding: 15,
        marginTop: 15,
        marginBottom: 20,
    },
    criteriaTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 10,
    },
    criteriaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    criteriaText: {
        fontSize: 14,
        color: '#7F8C8D',
        marginLeft: 10,
    },
    button: {
        marginTop: 10,
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
});

export default ChangePasswordScreen;