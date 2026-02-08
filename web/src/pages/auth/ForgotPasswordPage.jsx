// web/src/pages/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import {
    Container,
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    CircularProgress,
} from '@mui/material';
import { LockReset, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState('');
    
    const navigate = useNavigate();

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateEmail(email)) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await authService.resetPassword(email);

            if (result.success) {
                setEmailSent(true);
            } else {
                setError(result.message || 'Erreur lors de l\'envoi de l\'email');
            }
        } catch (err) {
            setError('Impossible d\'envoyer l\'email de réinitialisation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box className="login-container">
            <Container maxWidth="sm" className="login-wrapper">
                <Box className="login-header">
                    <Box className="logo-circle">
                        <LockReset sx={{ fontSize: 60, color: '#FFF' }} />
                    </Box>
                    <Typography variant="h3" className="login-title">
                        Mot de passe oublié ?
                    </Typography>
                    <Typography variant="subtitle1" className="login-subtitle">
                        Entrez votre email pour recevoir un lien de réinitialisation
                    </Typography>
                </Box>

                <Paper elevation={10} className="login-card">
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {!emailSent ? (
                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setEmailError('');
                                    setError('');
                                }}
                                onBlur={() => validateEmail(email)}
                                error={!!emailError}
                                helperText={emailError}
                                disabled={loading}
                                margin="normal"
                                autoFocus
                            />

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                className="login-button"
                                sx={{ mt: 3 }}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Envoyer le lien'}
                            </Button>

                            <Button
                                fullWidth
                                variant="text"
                                size="large"
                                onClick={() => navigate('/login')}
                                disabled={loading}
                                sx={{ mt: 2 }}
                            >
                                Retour à la connexion
                            </Button>
                        </form>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 3 }}>
                            <CheckCircle sx={{ fontSize: 80, color: '#2ECC71', mb: 3 }} />
                            <Typography variant="h5" fontWeight="600" color="#2C3E50" gutterBottom>
                                Email Envoyé !
                            </Typography>
                            <Typography variant="body1" color="textSecondary" paragraph>
                                Vérifiez votre boîte de réception et suivez les instructions
                                pour réinitialiser votre mot de passe.
                            </Typography>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => navigate('/login')}
                                sx={{ mt: 3 }}
                            >
                                Retour à la connexion
                            </Button>
                        </Box>
                    )}

                    <Alert severity="info" sx={{ mt: 3 }}>
                        Si vous ne recevez pas l'email dans quelques minutes, vérifiez votre
                        dossier spam ou contactez l'administrateur.
                    </Alert>
                </Paper>
            </Container>
        </Box>
    );
};

export default ForgotPasswordPage;