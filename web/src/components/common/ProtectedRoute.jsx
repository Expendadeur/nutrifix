// web/src/components/common/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import authService from '../../services/authService';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const location = useLocation();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Vérifier si l'utilisateur est authentifié
            const authenticated = authService.isAuthenticated();
            
            if (!authenticated) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }

            // Vérifier si le token est valide
            const tokenValid = await authService.verifyToken();
            
            if (!tokenValid.success) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }

            // Récupérer les données utilisateur
            const user = authService.getUser();
            
            if (!user) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }

            setUserRole(user.role);
            setIsAuthenticated(true);
            setIsLoading(false);
        } catch (error) {
            console.error('Auth check error:', error);
            setIsAuthenticated(false);
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #2E86C1 0%, #3498DB 50%, #5DADE2 100%)'
                }}
            >
                <CircularProgress size={60} sx={{ color: '#FFF' }} />
            </Box>
        );
    }

    if (!isAuthenticated) {
        // Rediriger vers la page de connexion
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Vérifier les rôles autorisés
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        // Rediriger vers une page non autorisée
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;