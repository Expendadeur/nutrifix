// web/src/pages/chauffeur/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  LinearProgress,
  Badge,
  IconButton,
  Box,
  Paper,
  Divider,
  Alert,
  Skeleton,
  Tooltip,
  Fade,
  Zoom,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import {
  DirectionsCar,
  LocalGasStation,
  Warning,
  Build,
  Notifications,
  PlayArrow,
  Flag,
  People,
  Speed,
  Schedule,
  LocationOn,
  Assessment,
  AttachMoney,
  EventNote,
  TrendingUp,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Navigation,
  Map,
  Phone,
  CalendarToday,
  CloudQueue,
  WbSunny,
  Nightlight,
  LocalShipping,
  Timer,
  ExpandMore,
  ExpandLess,
  Refresh,
  Settings,
  FilterList,
  Search,
  MoreVert,
  Star,
  FiberManualRecord,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import chauffeurService from '../../services/chauffeurService';
import '../css/DashboardPageChauffeur.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  ChartTooltip,
  Legend,
  ArcElement,
  BarElement
);

// Animations
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(7, 40, 185, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(102, 126, 234, 0);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// Styled Components
const GradientCard = styled(Card)(({ theme, gradient }) => ({
  borderRadius: 20,
  background: gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
    animation: `${float} 6s ease-in-out infinite`,
  },
}));

const StatsCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.3s ease',
  },
  '&:hover::after': {
    transform: 'scaleX(1)',
  },
}));

const ActionButton = styled(Paper)(({ theme, color, delay }) => ({
  padding: theme.spacing(3),
  borderRadius: 20,
  background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
  border: `2px solid ${color}30`,
  cursor: 'pointer',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  animation: `${slideInRight} 0.6s ease-out ${delay}s both`,
  '&:hover': {
    transform: 'scale(1.08) rotate(-2deg)',
    borderColor: color,
    boxShadow: `0 12px 30px ${color}50`,
    background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '0',
    height: '0',
    borderRadius: '50%',
    background: `${color}20`,
    transform: 'translate(-50%, -50%)',
    transition: 'width 0.6s, height 0.6s',
  },
  '&:hover::before': {
    width: '300px',
    height: '300px',
  },
}));

const VehicleCard = styled(Card)(({ theme }) => ({
  borderRadius: 24,
  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  overflow: 'hidden',
  position: 'relative',
  animation: `${slideInLeft} 0.6s ease-out`,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '6px',
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 3s linear infinite',
  },
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
}));

const MissionCard = styled(Card)(({ theme, active }) => ({
  borderRadius: 20,
  background: active
    ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
  border: active ? '3px solid #4CAF50' : '1px solid #e0e0e0',
  boxShadow: active
    ? '0 8px 32px rgba(76, 175, 80, 0.3)'
    : '0 4px 16px rgba(0,0,0,0.08)',
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  animation: active ? `${pulse} 2s ease-in-out infinite` : 'none',
}));

const NotificationItem = styled(Paper)(({ theme, read, priority }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1.5),
  borderRadius: 16,
  background: read ? '#fff' : '#E3F2FD',
  border: `2px solid ${priority === 'urgente' ? '#E74C3C' : priority === 'haute' ? '#F39C12' : '#E0E0E0'}`,
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  animation: `${fadeIn} 0.5s ease-out`,
  '&:hover': {
    transform: 'translateX(8px)',
    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
    borderColor: '#667eea',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '5px',
    background: priority === 'urgente'
      ? 'linear-gradient(180deg, #E74C3C 0%, #C0392B 100%)'
      : priority === 'haute'
      ? 'linear-gradient(180deg, #F39C12 0%, #E67E22 100%)'
      : 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
  },
}));

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [weatherData, setWeatherData] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    vehicle: true,
    mission: true,
    stats: true,
    notifications: true,
  });
  const [missionDialog, setMissionDialog] = useState(false);
  const [filterDialog, setFilterDialog] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadWeather();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      handleRefresh();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [data, alertsData] = await Promise.all([
        chauffeurService.getDashboardData(),
        chauffeurService.getVehicleAlerts(),
      ]);
      setDashboardData(data);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeather = async () => {
    // Simulated weather data - replace with actual API
    setWeatherData({
      temp: 28,
      condition: 'sunny',
      humidity: 65,
      windSpeed: 12,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleStartMission = () => {
    window.location.href = '/chauffeur/operations?action=start';
  };

  const handleEndMission = () => {
    window.location.href = '/chauffeur/operations?action=end';
  };

  // Chart Data
  const weeklyKmData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Kilomètres',
        data: [120, 85, 150, 95, 130, 75, 0],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const fuelConsumptionData = {
    labels: ['Essence utilisée', 'Capacité restante'],
    datasets: [
      {
        data: [35, 65],
        backgroundColor: [
          'rgba(231, 76, 60, 0.8)',
          'rgba(46, 204, 113, 0.8)',
        ],
        borderColor: ['#E74C3C', '#2ECC71'],
        borderWidth: 3,
      },
    ],
  };

  const monthlyMissionsData = {
    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    datasets: [
      {
        label: 'Missions complétées',
        data: [12, 15, 18, 14],
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: '#667eea',
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  if (loading) {
    return (
      <Box className="dashboard-container">
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton
                variant="rectangular"
                height={250}
                sx={{ borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box className="dashboard-container">
      {/* Header Section */}
      <Fade in={true} timeout={800}>
        <GradientCard sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={3} alignItems="center">
                  <Zoom in={true} timeout={600}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: '#4CAF50',
                            border: '3px solid white',
                            animation: `${pulse} 2s ease-in-out infinite`,
                          }}
                        />
                      }
                    >
                      <Avatar
                        src={dashboardData?.driver?.photo}
                        sx={{
                          width: 90,
                          height: 90,
                          border: '4px solid white',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        }}
                      >
                        {dashboardData?.driver?.name?.charAt(0)}
                      </Avatar>
                    </Badge>
                  </Zoom>
                  <Box>
                    <Typography
                      variant="h3"
                      fontWeight="bold"
                      sx={{
                        mb: 1,
                        background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      Bonjour, {dashboardData?.driver?.name} 👋
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Chip
                        icon={<FiberManualRecord sx={{ fontSize: 12 }} />}
                        label={dashboardData?.driver?.matricule}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: 600,
                          border: '1px solid rgba(255,255,255,0.3)',
                        }}
                      />
                      <Chip
                        icon={<LocationOn sx={{ fontSize: 16 }} />}
                        label={dashboardData?.driver?.departement}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: 600,
                          border: '1px solid rgba(255,255,255,0.3)',
                        }}
                      />
                      <Chip
                        icon={<CalendarToday sx={{ fontSize: 16 }} />}
                        label={new Date().toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: 600,
                          border: '1px solid rgba(255,255,255,0.3)',
                        }}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  {weatherData && (
                    <Paper
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <WbSunny sx={{ fontSize: 40, color: '#FDB813' }} />
                        <Box>
                          <Typography variant="h4" fontWeight="bold" color="white">
                            {weatherData.temp}°C
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            Ensoleillé • {weatherData.humidity}% humidité
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  )}
                  <Stack direction="row" spacing={2}>
                    <Tooltip title="Rafraîchir les données" arrow>
                      <IconButton
                        onClick={handleRefresh}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        }}
                      >
                        {refreshing ? (
                          <CircularProgress size={24} sx={{ color: 'white' }} />
                        ) : (
                          <Refresh />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Filtres" arrow>
                      <IconButton
                        onClick={() => setFilterDialog(true)}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        }}
                      >
                        <FilterList />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Notifications" arrow>
                      <IconButton
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        }}
                      >
                        <Badge
                          badgeContent={dashboardData?.notifications?.filter((n) => !n.read).length}
                          color="error"
                        >
                          <Notifications />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Paramètres" arrow>
                      <IconButton
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        }}
                      >
                        <Settings />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </GradientCard>
      </Fade>

      {/* Critical Alerts */}
      {alerts.filter((a) => a.priority === 'high').length > 0 && (
        <Zoom in={true} timeout={600}>
          <Alert
            severity="error"
            icon={<Warning sx={{ fontSize: 28 }} />}
            sx={{
              mb: 3,
              borderRadius: 3,
              border: '2px solid #E74C3C',
              animation: `${pulse} 2s ease-in-out infinite`,
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
            action={
              <Button size="small" variant="contained" color="error">
                Voir détails
              </Button>
            }
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              🚨 {alerts.filter((a) => a.priority === 'high').length} Alerte(s) critique(s)
            </Typography>
            <List dense>
              {alerts
                .filter((a) => a.priority === 'high')
                .map((alert, idx) => (
                  <ListItem key={idx} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.message}
                      primaryTypographyProps={{
                        fontWeight: 600,
                        color: 'error.main',
                      }}
                    />
                  </ListItem>
                ))}
            </List>
          </Alert>
        </Zoom>
      )}

      <Grid container spacing={3}>
        {/* Vehicle Information */}
        <Grid item xs={12} lg={6}>
          <VehicleCard>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      animation: `${float} 3s ease-in-out infinite`,
                    }}
                  >
                    <DirectionsCar sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Véhicule assigné
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      État et statistiques
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip
                    label={dashboardData?.vehicle?.statut === 'actif' ? 'ACTIF' : 'INACTIF'}
                    color={dashboardData?.vehicle?.statut === 'actif' ? 'success' : 'error'}
                    icon={
                      <FiberManualRecord
                        sx={{
                          fontSize: 12,
                          animation: `${pulse} 1.5s ease-in-out infinite`,
                        }}
                      />
                    }
                    sx={{ fontWeight: 700, fontSize: '0.9rem' }}
                  />
                  <IconButton size="small" onClick={() => toggleSection('vehicle')}>
                    {expandedSections.vehicle ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Stack>
              </Box>

              <Collapse in={expandedSections.vehicle}>
                {dashboardData?.vehicle ? (
                  <>
                    {/* Vehicle Identity */}
                    <Paper
                      sx={{
                        p: 3,
                        mb: 3,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 20%)',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -50,
                          right: -50,
                          width: 150,
                          height: 150,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.3)',
                          animation: `${float} 4s ease-in-out infinite`,
                        }}
                      />
                      <DirectionsCar
                        sx={{
                          fontSize: 64,
                          color: '#667eea',
                          mb: 2,
                          animation: `${float} 3s ease-in-out infinite`,
                        }}
                      />
                      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: '#2C3E50' }}>
                        {dashboardData.vehicle.immatriculation}
                      </Typography>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        {dashboardData.vehicle.marque} {dashboardData.vehicle.modele}
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                        <Chip
                          icon={<Star sx={{ fontSize: 16 }} />}
                          label="Véhicule premium"
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                            color: 'white',
                            fontWeight: 600,
                          }}
                        />
                      </Stack>
                    </Paper>

                    {/* Stats Grid */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={6}>
                        <StatsCard>
                          <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                            <Box
                              sx={{
                                width: 56,
                                height: 56,
                                margin: '0 auto 12px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: `${pulse} 2s ease-in-out infinite`,
                              }}
                            >
                              <Speed sx={{ fontSize: 28, color: 'white' }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Kilométrage actuel
                            </Typography>
                            <Typography variant="h5" fontWeight="bold" color="primary">
                              {dashboardData.vehicle.kilometrage_actuel?.toLocaleString()} km
                            </Typography>
                          </CardContent>
                        </StatsCard>
                      </Grid>

                      <Grid item xs={6}>
                        <StatsCard>
                          <CardContent sx={{ textAlign: 'center', p: 2.5 }}>
                            <Box
                              sx={{
                                width: 56,
                                height: 56,
                                margin: '0 auto 12px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: `${pulse} 2s ease-in-out infinite 0.3s`,
                              }}
                            >
                              <LocalGasStation sx={{ fontSize: 28, color: 'white' }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Niveau carburant
                            </Typography>
                            <Typography variant="h5" fontWeight="bold" color="success.main">
                              {dashboardData.vehicleStatus?.fuel_level || 0}%
                            </Typography>
                          </CardContent>
                        </StatsCard>
                      </Grid>
                    </Grid>

                    {/* Fuel Progress */}
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" fontWeight="600">
                          Carburant disponible
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="success.main">
                          {dashboardData.vehicleStatus?.fuel_level || 0}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={dashboardData.vehicleStatus?.fuel_level || 0}
                        sx={{
                          height: 12,
                          borderRadius: 6,
                          bgcolor: '#f0f0f0',
                          '& .MuiLinearProgress-bar': {
                            background:
                              dashboardData.vehicleStatus?.fuel_level > 50
                                ? 'linear-gradient(90deg, #2ECC71 0%, #27AE60 100%)'
                                : dashboardData.vehicleStatus?.fuel_level > 25
                                ? 'linear-gradient(90deg, #F39C12 0%, #E67E22 100%)'
                                : 'linear-gradient(90deg, #E74C3C 0%, #C0392B 100%)',
                            borderRadius: 6,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                          },
                        }}
                      />
                    </Box>

                    {/* Maintenance Info */}
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE8B3 100%)',
                        border: '2px solid #F39C12',
                        mb: 2,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Build sx={{ color: 'white' }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">
                            Prochain entretien
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Dans {dashboardData.vehicleStatus?.km_until_maintenance || 0} km
                          </Typography>
                        </Box>
                        <Chip
                          label={`${dashboardData.vehicleStatus?.km_until_maintenance || 0} km`}
                          color="warning"
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                    </Paper>

                    {/* Alerts Section */}
                    {alerts.length > 0 && (
                      <Paper
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #FDEDED 0%, #FEE2E2 100%)',
                          border: '2px solid #E74C3C',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                          <Warning color="error" />
                          <Typography variant="subtitle1" fontWeight="bold" color="error.main">
                            Alertes véhicule ({alerts.length})
                          </Typography>
                        </Stack>
                        <Stack spacing={1.5}>
                          {alerts.slice(0, 3).map((alert, idx) => (
                            <Alert
                              key={idx}
                              severity={alert.priority === 'high' ? 'error' : 'warning'}
                              icon={<ErrorIcon />}
                              sx={{
                                borderRadius: 2,
                                '& .MuiAlert-message': {
                                  fontWeight: 500,
                                },
                              }}
                            >
                              {alert.message}
                            </Alert>
                          ))}
                        </Stack>
                        {alerts.length > 3 && (
                          <Button fullWidth sx={{ mt: 2 }} variant="outlined" color="error">
                            Voir toutes les alertes ({alerts.length})
                          </Button>
                        )}
                      </Paper>
                    )}
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <DirectionsCar sx={{ fontSize: 80, color: '#BDC3C7', mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Aucun véhicule assigné
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Contactez votre superviseur pour l'attribution d'un véhicule
                    </Typography>
                  </Box>
                )}
              </Collapse>
            </CardContent>
          </VehicleCard>
        </Grid>

        {/* Current Mission */}
        <Grid item xs={12} lg={6}>
          <MissionCard active={!!dashboardData?.currentMission}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      background: dashboardData?.currentMission
                        ? 'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)'
                        : 'linear-gradient(135deg, #95A5A6 0%, #7F8C8D 100%)',
                      animation: dashboardData?.currentMission ? `${float} 3s ease-in-out infinite` : 'none',
                    }}
                  >
                    <Navigation sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Mission {dashboardData?.currentMission ? 'en cours' : 'à venir'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dashboardData?.currentMission ? 'Statut en direct' : 'Démarrez une mission'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => toggleSection('mission')}>
                  {expandedSections.mission ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.mission}>
                {dashboardData?.currentMission ? (
                  <>
                    <Stack spacing={2.5}>
                      {/* Mission Status */}
                      <Paper
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                          border: '2px solid #4CAF50',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              bgcolor: '#4CAF50',
                              animation: `${pulse} 1.5s ease-in-out infinite`,
                            }}
                          />
                          <Typography variant="h6" fontWeight="bold" color="success.dark">
                            Mission active - {dashboardData.currentMission.reference}
                          </Typography>
                        </Stack>
                      </Paper>

                      {/* Destination */}
                      <Paper
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor: '#f8f9fa',
                          border: '1px solid #e0e0e0',
                        }}
                      >
                        <Stack direction="row" spacing={2}>
                          <LocationOn color="primary" sx={{ fontSize: 28 }} />
                          <Box flex={1}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Destination
                            </Typography>
                            <Typography variant="h6" fontWeight="600">
                              {dashboardData.currentMission.destination}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>

                      {/* Purpose */}
                      <Paper
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor: '#f8f9fa',
                          border: '1px solid #e0e0e0',
                        }}
                      >
                        <Stack direction="row" spacing={2}>
                          <Assessment color="primary" sx={{ fontSize: 28 }} />
                          <Box flex={1}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Motif de la mission
                            </Typography>
                            <Typography variant="body1" fontWeight="500">
                              {dashboardData.currentMission.purpose}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>

                      <Divider />

                      {/* Mission Stats */}
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              borderRadius: 3,
                              background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                            }}
                          >
                            <Schedule color="primary" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="caption" color="text.secondary" display="block">
                              Durée
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {dashboardData.currentMission.duration || 0} min
                            </Typography>
                          </Paper>
                        </Grid>

                        <Grid item xs={4}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              borderRadius: 3,
                              background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
                            }}
                          >
                            <Speed color="warning" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="caption" color="text.secondary" display="block">
                              Distance
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {(dashboardData.currentMission.current_km || 0) -
                                (dashboardData.currentMission.start_km || 0)}{' '}
                              km
                            </Typography>
                          </Paper>
                        </Grid>

                        <Grid item xs={4}>
                          <Paper
                            sx={{
                              p: 2,
                              textAlign: 'center',
                              borderRadius: 3,
                              background: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
                            }}
                          >
                            <People color="secondary" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="caption" color="text.secondary" display="block">
                              Passagers
                            </Typography>
                            <Typography variant="h6" fontWeight="bold">
                              {dashboardData.currentMission.passengers || 0}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* End Mission Button */}
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        color="error"
                        startIcon={<Flag />}
                        onClick={handleEndMission}
                        sx={{
                          mt: 2,
                          py: 1.8,
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          borderRadius: 3,
                          boxShadow: '0 8px 24px rgba(231, 76, 60, 0.4)',
                          '&:hover': {
                            transform: 'scale(1.02)',
                            boxShadow: '0 12px 32px rgba(231, 76, 60, 0.5)',
                          },
                        }}
                      >
                        Terminer la mission
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Navigation
                      sx={{
                        fontSize: 80,
                        color: '#BDC3C7',
                        mb: 3,
                        opacity: 0.5,
                        animation: `${float} 3s ease-in-out infinite`,
                      }}
                    />
                    <Typography variant="h5" fontWeight="bold" color="text.secondary" gutterBottom>
                      Aucune mission en cours
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, px: 3 }}>
                      Démarrez une nouvelle mission pour commencer vos opérations quotidiennes
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      color="success"
                      startIcon={<PlayArrow />}
                      onClick={handleStartMission}
                      sx={{
                        py: 1.8,
                        px: 4,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        borderRadius: 3,
                        boxShadow: '0 8px 24px rgba(46, 204, 113, 0.4)',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 12px 32px rgba(46, 204, 113, 0.5)',
                        },
                      }}
                    >
                      Démarrer une mission
                    </Button>
                  </Box>
                )}
              </Collapse>
            </CardContent>
          </MissionCard>
        </Grid>

        {/* Today's Stats */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 4, boxShadow: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    <TrendingUp sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Statistiques du jour
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Performance en temps réel
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={() => toggleSection('stats')}>
                  {expandedSections.stats ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={expandedSections.stats}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <ActionButton color="#3498DB" delay={0.1}>
                      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 70,
                            height: 70,
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(52, 152, 219, 0.4)',
                          }}
                        >
                          <DirectionsCar sx={{ fontSize: 36, color: 'white' }} />
                        </Box>
                        <Typography variant="h3" fontWeight="bold" color="#3498DB" gutterBottom>
                          {dashboardData?.stats?.missions_today || 0}
                        </Typography>
                        <Typography variant="body1" fontWeight="600" color="text.secondary">
                          Missions
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          complétées aujourd'hui
                        </Typography>
                      </Box>
                    </ActionButton>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <ActionButton color="#2ECC71" delay={0.2}>
                      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 70,
                            height: 70,
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(46, 204, 113, 0.4)',
                          }}
                        >
                          <Speed sx={{ fontSize: 36, color: 'white' }} />
                        </Box>
                        <Typography variant="h3" fontWeight="bold" color="#2ECC71" gutterBottom>
                          {dashboardData?.stats?.km_today || 0}
                        </Typography>
                        <Typography variant="body1" fontWeight="600" color="text.secondary">
                          Kilomètres
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          parcourus aujourd'hui
                        </Typography>
                      </Box>
                    </ActionButton>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <ActionButton color="#F39C12" delay={0.3}>
                      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 70,
                            height: 70,
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(243, 156, 18, 0.4)',
                          }}
                        >
                          <LocalGasStation sx={{ fontSize: 36, color: 'white' }} />
                        </Box>
                        <Typography variant="h3" fontWeight="bold" color="#F39C12" gutterBottom>
                          {dashboardData?.stats?.fuel_today?.toFixed(1) || 0}
                        </Typography>
                        <Typography variant="body1" fontWeight="600" color="text.secondary">
                          Litres
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          carburant consommé
                        </Typography>
                      </Box>
                    </ActionButton>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <ActionButton color="#E74C3C" delay={0.4}>
                      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 70,
                            height: 70,
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(231, 76, 60, 0.4)',
                          }}
                        >
                          <AttachMoney sx={{ fontSize: 36, color: 'white' }} />
                        </Box>
                        <Typography variant="h3" fontWeight="bold" color="#E74C3C" gutterBottom>
                          {dashboardData?.stats?.pending_expenses || 0}
                        </Typography>
                        <Typography variant="body1" fontWeight="600" color="text.secondary">
                          Frais
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          en attente de validation
                        </Typography>
                      </Box>
                    </ActionButton>
                  </Grid>
                </Grid>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Charts Section */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Kilomètres cette semaine
              </Typography>
              <Box sx={{ height: 250 }}>
                <Line data={weeklyKmData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Consommation carburant
              </Typography>
              <Box sx={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Doughnut data={fuelConsumptionData} options={{ ...chartOptions, maintainAspectRatio: true }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Missions ce mois
              </Typography>
              <Box sx={{ height: 250 }}>
                <Bar data={monthlyMissionsData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 4, boxShadow: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                Actions rapides
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <ActionButton
                    color="#3498DB"
                    delay={0.1}
                    onClick={() => (window.location.href = '/chauffeur/operations')}
                  >
                    <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <DirectionsCar sx={{ fontSize: 40, color: '#3498DB', mb: 1.5 }} />
                      <Typography variant="body1" fontWeight="600">
                        Missions
                      </Typography>
                    </Box>
                  </ActionButton>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <ActionButton
                    color="#E74C3C"
                    delay={0.2}
                    onClick={() => (window.location.href = '/chauffeur/incidents')}
                  >
                    <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <Warning sx={{ fontSize: 40, color: '#E74C3C', mb: 1.5 }} />
                      <Typography variant="body1" fontWeight="600">
                        Incidents
                      </Typography>
                      {alerts.length > 0 && (
                        <Chip
                          label={alerts.length}
                          size="small"
                          color="error"
                          sx={{ mt: 0.5, fontWeight: 700 }}
                        />
                      )}
                    </Box>
                  </ActionButton>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <ActionButton
                    color="#2ECC71"
                    delay={0.3}
                    onClick={() => (window.location.href = '/chauffeur/operations?tab=expenses')}
                  >
                    <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <LocalGasStation sx={{ fontSize: 40, color: '#2ECC71', mb: 1.5 }} />
                      <Typography variant="body1" fontWeight="600">
                        Frais
                      </Typography>
                    </Box>
                  </ActionButton>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <ActionButton
                    color="#F39C12"
                    delay={0.4}
                    onClick={() => (window.location.href = '/chauffeur/operations?tab=maintenance')}
                  >
                    <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <Build sx={{ fontSize: 40, color: '#F39C12', mb: 1.5 }} />
                      <Typography variant="body1" fontWeight="600">
                        Maintenance
                      </Typography>
                    </Box>
                  </ActionButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 4, boxShadow: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    <Notifications sx={{ fontSize: 28, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Notifications récentes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dashboardData?.notifications?.filter((n) => !n.read).length} non lues
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Marquer tout comme lu">
                    <IconButton size="small">
                      <CheckCircle />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => toggleSection('notifications')}>
                    {expandedSections.notifications ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Stack>
              </Box>

              <Collapse in={expandedSections.notifications}>
                <Box sx={{ maxHeight: 500, overflowY: 'auto', pr: 1 }}>
                  {dashboardData?.notifications?.length > 0 ? (
                    dashboardData.notifications.slice(0, 10).map((notif, idx) => (
                      <NotificationItem key={idx} read={notif.read} priority={notif.priority}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              background:
                                notif.priority === 'urgente'
                                  ? 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)'
                                  : notif.priority === 'haute'
                                  ? 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)'
                                  : 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {notif.type === 'alert' ? (
                              <Warning sx={{ color: 'white', fontSize: 24 }} />
                            ) : notif.type === 'info' ? (
                              <Info sx={{ color: 'white', fontSize: 24 }} />
                            ) : (
                              <Notifications sx={{ color: 'white', fontSize: 24 }} />
                            )}
                          </Box>
                          <Box flex={1}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {notif.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {notif.message}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {notif.time}
                            </Typography>
                            {!notif.read && (
                              <Chip
                                label="NOUVEAU"
                                size="small"
                                color="primary"
                                sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        </Stack>
                      </NotificationItem>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Notifications sx={{ fontSize: 64, color: '#BDC3C7', mb: 2, opacity: 0.5 }} />
                      <Typography variant="h6" color="text.secondary">
                        Aucune notification
                      </Typography>
                    </Box>
                  )}
                </Box>
                {dashboardData?.notifications?.length > 10 && (
                  <Button fullWidth sx={{ mt: 2 }} variant="outlined">
                    Voir toutes les notifications ({dashboardData.notifications.length})
                  </Button>
                )}
              </Collapse>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Dialog */}
      <Dialog open={filterDialog} onClose={() => setFilterDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Filtres du dashboard
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                Période
              </Typography>
              <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>
                <Tab label="Aujourd'hui" />
                <Tab label="Cette semaine" />
                <Tab label="Ce mois" />
              </Tabs>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialog(false)}>Annuler</Button>
          <Button variant="contained" onClick={() => setFilterDialog(false)}>
            Appliquer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardPage;