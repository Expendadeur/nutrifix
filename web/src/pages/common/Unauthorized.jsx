// web/src/pages/common/Unauthorized.jsx
import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { Block } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #2E86C1 0%, #3498DB 50%, #5DADE2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 3,
            }}
        >
            <Container maxWidth="sm">
                <Box
                    sx={{
                        background: '#FFF',
                        borderRadius: 4,
                        padding: 6,
                        textAlign: 'center',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    }}
                >
                    <Box
                        sx={{
                            width: 120,
                            height: 120,
                            margin: '0 auto 30px',
                            borderRadius: '50%',
                            background: 'rgba(231, 76, 60, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Block sx={{ fontSize: 80, color: '#E74C3C' }} />
                    </Box>

                    <Typography variant="h3" fontWeight="bold" color="#2C3E50" gutterBottom>
                        403
                    </Typography>

                    <Typography variant="h5" fontWeight="600" color="#7F8C8D" gutterBottom>
                        Accès Refusé
                    </Typography>

                    <Typography variant="body1" color="textSecondary" paragraph sx={{ mt: 3, mb: 4 }}>
                        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
                        Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administrateur.
                    </Typography>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => navigate('/login')}
                        sx={{ mr: 2 }}
                    >
                        Retour à la connexion
                    </Button>

                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => navigate(-1)}
                    >
                        Page précédente
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default Unauthorized;