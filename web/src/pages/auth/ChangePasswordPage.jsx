// web/src/pages/auth/ChangePasswordPage.jsx
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
    InputAdornment,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import { VpnKey, Visibility, VisibilityOff, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';

const ChangePasswordPage = () => {
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
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    
    const navigate = useNavigate();

    const validateOldPassword = (value) => {
        if (!value) return 'Ancien mot de passe requis';
        return '';
    };

    const validateNewPassword = (value) => {
        if (!value) return 'Nouveau mot de passe requis';
        if (value.length < 6) return 'Minimum 6 caractères';
        if (value === oldPassword) return 'Le nouveau mot de passe doit être différent';
        return '';
    };

    const validateConfirmPassword = (value) => {
        if (!value) return 'Confirmation requise';
        if (value !== newPassword) return 'Les mots de passe ne correspondent pas';
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

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
        setError('');

        try {
            const result = await authService.changePassword(oldPassword, newPassword);

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    navigate(-1);
                }, 2000);
            } else {
                setError(result.message || 'Erreur lors du changement de mot de passe');
            }
        } catch (err) {
            setError('Impossible de changer le mot de passe');
        } finally {
            setLoading(false);
        }
    };

    const passwordCriteria = [
        { met: newPassword.length >= 6, text: 'Au moins 6 caractères' },
        { met: newPassword !== oldPassword && newPassword, text: 'Différent de l\'ancien' },
        { met: confirmPassword && confirmPassword === newPassword, text: 'Correspondance confirmée' }
    ];

    return (
        <Box className="login-container">
            <Container maxWidth="sm" className="login-wrapper">
                <Box className="login-header">
                    <Box className="logo-circle">
                        <VpnKey sx={{ fontSize: 60, color: '#FFF' }} />
                    </Box>
                    <Typography variant="h3" className="login-title">
                        Changer le mot de passe
                    </Typography>
                    <Typography variant="subtitle1" className="login-subtitle">
                        Créez un nouveau mot de passe sécurisé
                    </Typography>
                </Box>

                <Paper elevation={10} className="login-card">
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert severity="success" sx={{ mb: 3 }}>
                            Mot de passe changé avec succès ! Redirection...
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Ancien mot de passe"
                            type={showOldPassword ? 'text' : 'password'}
                            value={oldPassword}
                            onChange={(e) => {
                                setOldPassword(e.target.value);
                                setErrors({ ...errors, oldPassword: '' });
                                setError('');
                            }}
                            error={!!errors.oldPassword}
                            helperText={errors.oldPassword}
                            disabled={loading || success}
                            margin="normal"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowOldPassword(!showOldPassword)}
                                            edge="end"
                                        >
                                            {showOldPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Nouveau mot de passe"
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setErrors({ ...errors, newPassword: '' });
                                setError('');
                            }}
                            error={!!errors.newPassword}
                            helperText={errors.newPassword}
                            disabled={loading || success}
                            margin="normal"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            edge="end"
                                        >
                                            {showNewPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Confirmer le mot de passe"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setErrors({ ...errors, confirmPassword: '' });
                                setError('');
                            }}
                            error={!!errors.confirmPassword}
                            helperText={errors.confirmPassword}
                            disabled={loading || success}
                            margin="normal"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            edge="end"
                                        >
                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Box sx={{ bgcolor: '#F8F9F9', borderRadius: 2, p: 2, mt: 3 }}>
                            <Typography variant="subtitle2" fontWeight="600" color="#2C3E50" gutterBottom>
                                Le mot de passe doit contenir :
                            </Typography>
                            <List dense>
                                {passwordCriteria.map((criterion, index) => (
                                    <ListItem key={index} disablePadding>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            {criterion.met ? (
                                                <CheckCircle sx={{ fontSize: 20, color: '#2ECC71' }} />
                                            ) : (
                                                <RadioButtonUnchecked sx={{ fontSize: 20, color: '#BDC3C7' }} />
                                            )}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={criterion.text}
                                            primaryTypographyProps={{
                                                variant: 'body2',
                                                color: criterion.met ? 'textPrimary' : 'textSecondary'
                                            }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading || success}
                            className="login-button"
                            sx={{ mt: 3 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Changer le mot de passe'}
                        </Button>

                        <Button
                            fullWidth
                            variant="text"
                            size="large"
                            onClick={() => navigate(-1)}
                            disabled={loading || success}
                            sx={{ mt: 2 }}
                        >
                            Annuler
                        </Button>
                    </form>
                </Paper>
            </Container>
        </Box>
    );
};

export default ChangePasswordPage;