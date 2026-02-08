// web/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';

// Chauffeur Pages
import ChauffeurDashboard from './pages/chauffeur/DashboardPage';
import ChauffeurIncidents from './pages/chauffeur/IncidentsPage';
import ChauffeurOperations from './pages/chauffeur/OperationsPage';

// Common Components
import ProtectedRoute from './components/common/ProtectedRoute';
import Unauthorized from './pages/common/Unauthorized';
import NotFound from './pages/common/NotFound';

// Thème Material-UI personnalisé
const theme = createTheme({
    palette: {
        primary: {
            main: '#2E86C1',
            light: '#5DADE2',
            dark: '#1F5F8B',
        },
        secondary: {
            main: '#2ECC71',
            light: '#58D68D',
            dark: '#27AE60',
        },
        error: {
            main: '#E74C3C',
        },
        warning: {
            main: '#F39C12',
        },
        info: {
            main: '#3498DB',
        },
        success: {
            main: '#2ECC71',
        },
        background: {
            default: '#F5F6FA',
            paper: '#FFFFFF',
        },
    },
    typography: {
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
        ].join(','),
        h1: {
            fontWeight: 700,
        },
        h2: {
            fontWeight: 700,
        },
        h3: {
            fontWeight: 600,
        },
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
        button: {
            textTransform: 'none',
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    padding: '10px 24px',
                },
                contained: {
                    boxShadow: '0 4px 12px rgba(46, 134, 193, 0.3)',
                    '&:hover': {
                        boxShadow: '0 6px 16px rgba(46, 134, 193, 0.4)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                    },
                },
            },
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    {/* Routes publiques */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />

                    {/* Routes Chauffeur */}
                    <Route
                        path="/chauffeur/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['chauffeur']}>
                                <ChauffeurDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/chauffeur/incidents"
                        element={
                            <ProtectedRoute allowedRoles={['chauffeur']}>
                                <ChauffeurIncidents />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/chauffeur/operations"
                        element={
                            <ProtectedRoute allowedRoles={['chauffeur']}>
                                <ChauffeurOperations />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/change-password"
                        element={
                            <ProtectedRoute>
                                <ChangePasswordPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Admin (À ajouter) */}
                    <Route
                        path="/admin/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <div>Admin Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Manager (À ajouter) */}
                    <Route
                        path="/manager/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['manager']}>
                                <div>Manager Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Vétérinaire (À ajouter) */}
                    <Route
                        path="/veterinaire/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['veterinaire']}>
                                <div>Vétérinaire Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Comptable (À ajouter) */}
                    <Route
                        path="/comptable/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['comptable']}>
                                <div>Comptable Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Employé (À ajouter) */}
                    <Route
                        path="/employe/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['employe']}>
                                <div>Employé Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Routes Agriculteur (À ajouter) */}
                    <Route
                        path="/agriculteur/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['agriculteur']}>
                                <div>Agriculteur Dashboard (À créer)</div>
                            </ProtectedRoute>
                        }
                    />

                    {/* Redirection par défaut */}
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    {/* Page 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;