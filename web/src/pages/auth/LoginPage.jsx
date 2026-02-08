// web/src/pages/LoginPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Container,
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    IconButton,
    InputAdornment,
    Tab,
    Tabs,
    Alert,
    CircularProgress,
    Link,
    Divider,
    Checkbox,
    FormControlLabel,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Fade,
    Slide
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Email,
    Badge,
    QrCode2,
    Fingerprint,
    LockOutlined,
    Nature
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import '../css/LoginPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const LoginPage = () => {
    // États formulaire
    const [loginMethod, setLoginMethod] = useState(0); // 0: email, 1: matricule, 2: qr
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [matricule, setMatricule] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // États UI
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // États validation
    const [errors, setErrors] = useState({
        email: '',
        password: '',
        matricule: ''
    });

    // États notifications
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // États modal
    const [resetDialog, setResetDialog] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    // États biométrie
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    const navigate = useNavigate();

    const initializePage = useCallback(async () => {
        await checkBiometric();
        await loadSavedCredentials();
        await checkAutoLogin();
        setPageLoading(false);
    }, []);

    useEffect(() => {
        initializePage();
    }, [initializePage]);

    const checkBiometric = async () => {
        try {
            // eslint-disable-next-line no-undef
            if (window.PublicKeyCredential) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                const savedMatricule = localStorage.getItem('userMatricule');
                setBiometricAvailable(available && savedMatricule);
            }
        } catch (error) {
            console.error('Biometric check failed:', error);
        }
    };

    const loadSavedCredentials = async () => {
        try {
            const savedEmail = localStorage.getItem('savedEmail');
            const savedMatricule = localStorage.getItem('savedMatricule');
            const remember = localStorage.getItem('rememberMe') === 'true';

            if (remember) {
                if (savedEmail) setEmail(savedEmail);
                if (savedMatricule) setMatricule(savedMatricule);
                setRememberMe(true);
            }
        } catch (error) {
            console.error('Load credentials failed:', error);
        }
    };

    const checkAutoLogin = async () => {
        const token = localStorage.getItem('userToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');

        if (token && tokenExpiry) {
            const expiryDate = new Date(tokenExpiry);
            if (expiryDate > new Date()) {
                try {
                    const response = await fetch(`${API_URL}/auth/verify-token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    const data = await response.json();
                    if (data.success) {
                        navigateByRole(data.user.role);
                    }
                } catch (error) {
                    console.error('Auto-login failed:', error);
                }
            } else {
                localStorage.removeItem('userToken');
                localStorage.removeItem('tokenExpiry');
            }
        }
    };

    // ============================================
    // VALIDATIONS
    // ============================================
    const validateEmail = (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
            return 'Email requis';
        }
        if (!emailRegex.test(value)) {
            return 'Format email invalide';
        }
        return '';
    };

    const validatePassword = (value) => {
        if (!value) {
            return 'Mot de passe requis';
        }
        if (value.length < 6) {
            return 'Minimum 6 caractères';
        }
        return '';
    };

    const validateMatricule = (value) => {
        if (!value) {
            return 'Matricule requis';
        }
        if (value.length < 3) {
            return 'Matricule invalide';
        }
        return '';
    };

    // ============================================
    // CONNEXION EMAIL/PASSWORD
    // ============================================
    const handleEmailLogin = async (e) => {
        e.preventDefault();

        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);

        if (emailError || passwordError) {
            setErrors({ email: emailError, password: passwordError, matricule: '' });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Vérifier si changement de mot de passe requis
                if (data.changePasswordRequired) {
                    navigate('/change-password', { state: { userId: data.userId } });
                    return;
                }

                // Sauvegarder les données
                const tokenExpiry = new Date();
                tokenExpiry.setDate(tokenExpiry.getDate() + 7);

                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('userMatricule', data.user.matricule);
                localStorage.setItem('tokenExpiry', tokenExpiry.toISOString());

                if (rememberMe) {
                    localStorage.setItem('savedEmail', email);
                    localStorage.setItem('rememberMe', 'true');
                } else {
                    localStorage.removeItem('savedEmail');
                    localStorage.removeItem('rememberMe');
                }

                showSnackbar('Connexion réussie !', 'success');

                setTimeout(() => {
                    navigateByRole(data.user.role);
                }, 500);
            } else {
                showSnackbar(data.message || 'Identifiants incorrects', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showSnackbar('Impossible de se connecter au serveur. Vérifiez votre connexion.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // CONNEXION MATRICULE/PASSWORD
    // ============================================
    const handleMatriculeLogin = async (e) => {
        e.preventDefault();

        const matriculeError = validateMatricule(matricule);
        const passwordError = validatePassword(password);

        if (matriculeError || passwordError) {
            setErrors({ matricule: matriculeError, password: passwordError, email: '' });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricule, password })
            });

            const data = await response.json();

            if (data.success) {
                const tokenExpiry = new Date();
                tokenExpiry.setDate(tokenExpiry.getDate() + 7);

                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('userMatricule', data.user.matricule);
                localStorage.setItem('tokenExpiry', tokenExpiry.toISOString());

                if (rememberMe) {
                    localStorage.setItem('savedMatricule', matricule);
                    localStorage.setItem('rememberMe', 'true');
                }

                showSnackbar('Connexion réussie !', 'success');

                setTimeout(() => {
                    navigateByRole(data.user.role);
                }, 500);
            } else {
                showSnackbar(data.message || 'Identifiants incorrects', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showSnackbar('Impossible de se connecter au serveur.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // CONNEXION BIOMÉTRIQUE
    // ============================================
    const handleBiometricLogin = async () => {
        try {
            const savedMatricule = localStorage.getItem('userMatricule');

            if (!savedMatricule) {
                showSnackbar('Veuillez vous connecter avec vos identifiants une première fois.', 'warning');
                return;
            }

            setLoading(true);

            const publicKey = {
                challenge: new Uint8Array(32),
                timeout: 60000,
                userVerification: 'required'
            };

            // eslint-disable-next-line no-undef
            const credential = await navigator.credentials.get({ publicKey });

            if (credential) {
                const response = await fetch(`${API_URL}/auth/fingerprint/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        matricule: savedMatricule,
                        fingerprintData: {
                            credentialId: credential.id,
                            response: {
                                authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
                                signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
                            },
                            timestamp: new Date().toISOString()
                        }
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const tokenExpiry = new Date();
                    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    localStorage.setItem('tokenExpiry', tokenExpiry.toISOString());

                    showSnackbar('Authentification biométrique réussie !', 'success');

                    setTimeout(() => {
                        navigateByRole(data.user.role);
                    }, 500);
                } else {
                    showSnackbar(data.message || 'Authentification échouée', 'error');
                }
            }
        } catch (error) {
            console.error('Biometric login error:', error);
            showSnackbar('Authentification biométrique annulée ou impossible', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // CONNEXION QR CODE
    // ============================================
    const handleQRLogin = () => {
        navigate('/qr-scanner');
    };

    // ============================================
    // RÉINITIALISATION MOT DE PASSE
    // ============================================
    const handlePasswordReset = async () => {
        const error = validateEmail(resetEmail);
        if (error) {
            showSnackbar(error, 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });

            const data = await response.json();

            if (data.success) {
                setResetDialog(false);
                setResetEmail('');
                showSnackbar('Email de réinitialisation envoyé avec succès', 'success');
            } else {
                showSnackbar(data.message || 'Erreur lors de l\'envoi', 'error');
            }
        } catch (error) {
            showSnackbar('Impossible d\'envoyer l\'email de réinitialisation', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // NAVIGATION
    // ============================================
    const navigateByRole = (role) => {
        const routes = {
            admin: '/admin/dashboard',
            manager: '/manager/dashboard',
            chauffeur: '/chauffeur/dashboard',
            veterinaire: '/veterinaire/dashboard',
            comptable: '/comptable/dashboard',
            employe: '/employe/dashboard',
            agriculteur: '/agriculteur/dashboard',
            temps_partiel: '/temps-partiel/dashboard'
        };

        navigate(routes[role] || '/dashboard');
    };

    // ============================================
    // HELPERS
    // ============================================
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleTabChange = (event, newValue) => {
        setLoginMethod(newValue);
        setErrors({ email: '', password: '', matricule: '' });
    };

    if (pageLoading) {
        return (
            <Box className="loading-container">
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Fade in={true} timeout={800}>
            <Box className="login-container">
                <Container maxWidth="sm" className="login-wrapper">
                    {/* Logo et titre */}
                    <Slide direction="down" in={true} timeout={600}>
                        <Box className="login-header">
                            <Box className="logo-circle">
                                <Nature sx={{ fontSize: 60, color: '#FFF' }} />
                            </Box>
                            <Typography variant="h3" className="login-title">
                                NUTRIFIX
                            </Typography>
                            <Typography variant="subtitle1" className="login-subtitle">
                                Gestion Agricole Intégrée
                            </Typography>
                        </Box>
                    </Slide>

                    {/* Carte de connexion */}
                    <Slide direction="up" in={true} timeout={800}>
                        <Paper elevation={10} className="login-card">
                            {/* Tabs de méthode */}
                            <Tabs
                                value={loginMethod}
                                onChange={handleTabChange}
                                variant="fullWidth"
                                className="login-tabs"
                            >
                                <Tab icon={<Email />} label="Email" disabled={loading} />
                                <Tab icon={<Badge />} label="Matricule" disabled={loading} />
                                <Tab icon={<QrCode2 />} label="QR Code" disabled={loading} />
                            </Tabs>

                            <Box className="login-form-container">
                                {/* Formulaire Email */}
                                {loginMethod === 0 && (
                                    <Fade in={true} timeout={400}>
                                        <form onSubmit={handleEmailLogin}>
                                            <TextField
                                                fullWidth
                                                label="Email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setErrors({ ...errors, email: '' });
                                                }}
                                                error={!!errors.email}
                                                helperText={errors.email}
                                                disabled={loading}
                                                margin="normal"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Email />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />

                                            <TextField
                                                fullWidth
                                                label="Mot de passe"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => {
                                                    setPassword(e.target.value);
                                                    setErrors({ ...errors, password: '' });
                                                }}
                                                error={!!errors.password}
                                                helperText={errors.password}
                                                disabled={loading}
                                                margin="normal"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockOutlined />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                edge="end"
                                                            >
                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />

                                            <Box className="login-options">
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={rememberMe}
                                                            onChange={(e) => setRememberMe(e.target.checked)}
                                                            color="primary"
                                                        />
                                                    }
                                                    label="Se souvenir de moi"
                                                />
                                                <Link
                                                    component="button"
                                                    type="button"
                                                    variant="body2"
                                                    onClick={() => setResetDialog(true)}
                                                    className="forgot-password-link"
                                                >
                                                    Mot de passe oublié ?
                                                </Link>
                                            </Box>

                                            <Button
                                                type="submit"
                                                fullWidth
                                                variant="contained"
                                                size="large"
                                                disabled={loading}
                                                className="login-button"
                                            >
                                                {loading ? <CircularProgress size={24} /> : 'Se connecter'}
                                            </Button>
                                        </form>
                                    </Fade>
                                )}

                                {/* Formulaire Matricule */}
                                {loginMethod === 1 && (
                                    <Fade in={true} timeout={400}>
                                        <form onSubmit={handleMatriculeLogin}>
                                            <TextField
                                                fullWidth
                                                label="Matricule"
                                                value={matricule}
                                                onChange={(e) => {
                                                    setMatricule(e.target.value.toUpperCase());
                                                    setErrors({ ...errors, matricule: '' });
                                                }}
                                                error={!!errors.matricule}
                                                helperText={errors.matricule}
                                                disabled={loading}
                                                margin="normal"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Badge />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />

                                            <TextField
                                                fullWidth
                                                label="Mot de passe"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => {
                                                    setPassword(e.target.value);
                                                    setErrors({ ...errors, password: '' });
                                                }}
                                                error={!!errors.password}
                                                helperText={errors.password}
                                                disabled={loading}
                                                margin="normal"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockOutlined />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                edge="end"
                                                            >
                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />

                                            <Box className="login-options">
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={rememberMe}
                                                            onChange={(e) => setRememberMe(e.target.checked)}
                                                            color="primary"
                                                        />
                                                    }
                                                    label="Se souvenir de moi"
                                                />
                                            </Box>

                                            <Button
                                                type="submit"
                                                fullWidth
                                                variant="contained"
                                                size="large"
                                                disabled={loading}
                                                className="login-button"
                                            >
                                                {loading ? <CircularProgress size={24} /> : 'Se connecter'}
                                            </Button>
                                        </form>
                                    </Fade>
                                )}

                                {/* Formulaire QR Code */}
                                {loginMethod === 2 && (
                                    <Fade in={true} timeout={400}>
                                        <Box className="qr-container">
                                            <QrCode2 className="qr-icon" />
                                            <Typography variant="h6" className="qr-title">
                                                Scanner votre QR Code
                                            </Typography>
                                            <Typography variant="body2" className="qr-description">
                                                Utilisez votre carte employé digitale pour vous connecter rapidement
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                size="large"
                                                startIcon={<QrCode2 />}
                                                onClick={handleQRLogin}
                                                disabled={loading}
                                                className="qr-button"
                                            >
                                                Scanner le QR Code
                                            </Button>
                                        </Box>
                                    </Fade>
                                )}

                                {/* Séparateur et biométrie */}
                                {loginMethod !== 2 && biometricAvailable && (
                                    <>
                                        <Box className="separator">
                                            <Divider>
                                                <Typography variant="body2" color="textSecondary">
                                                    OU
                                                </Typography>
                                            </Divider>
                                        </Box>

                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            size="large"
                                            startIcon={<Fingerprint />}
                                            onClick={handleBiometricLogin}
                                            disabled={loading}
                                            className="biometric-button"
                                        >
                                            Connexion biométrique
                                        </Button>
                                    </>
                                )}
                            </Box>
                        </Paper>
                    </Slide>

                    {/* Footer */}
                    <Fade in={true} timeout={1000}>
                        <Box className="login-footer">
                            <Typography variant="body2">
                                © 2024 NUTRIFIX - Tous droits réservés
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Version 1.0.0
                            </Typography>
                        </Box>
                    </Fade>
                </Container>

                {/* Dialog Réinitialisation */}
                <Dialog
                    open={resetDialog}
                    onClose={() => !loading && setResetDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Entrez votre email pour recevoir un lien de réinitialisation
                        </Typography>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            margin="normal"
                            autoFocus
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setResetDialog(false)} disabled={loading}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handlePasswordReset}
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={20} /> : 'Envoyer'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleCloseSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={handleCloseSnackbar}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
};

export default LoginPage;