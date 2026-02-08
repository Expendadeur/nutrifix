// web/src/pages/chauffeur/OperationsPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Paper,
  Stack,
  Divider,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  ToggleButton,
  ToggleButtonGroup,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Zoom,
  Fade,
  Slide,
  Grow,
} from '@mui/material';
import {
  DirectionsCar,
  LocalGasStation,
  Build,
  Warning,
  PlayArrow,
  Flag,
  AttachMoney,
  Receipt,
  Speed,
  Schedule,
  LocationOn,
  People,
  LocalShipping,
  Navigation,
  CalendarToday,
  AccessTime,
  Description,
  CloudUpload,
  Delete,
  ZoomIn,
  Close,
  Send,
  ArrowBack,
  ArrowForward,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Settings,
  Refresh,
  FilterList,
  MoreVert,
  GetApp,
  Print,
  Camera,
  PhotoLibrary,
  CreditCard,
  AccountBalance,
  PhoneAndroid,
  Assignment,
  Engineering,
  CarRepair,
  Security,
  Timer,
  TrendingUp,
  History,
  AddCircle,
  RemoveCircle,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { fr } from 'date-fns/locale';
import chauffeurService from '../../services/chauffeurService';
import '../css/OperationsPage.css';

// Animations
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(46, 204, 113, 0);
  }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

// Styled Components
const GradientHeader = styled(Box)(({ theme, color }) => ({
  background: `linear-gradient(135deg, ${color}E6 0%, ${color}CC 100%)`,
  borderRadius: 24,
  padding: theme.spacing(4),
  color: 'white',
  marginBottom: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
  boxShadow: `0 10px 40px ${color}40`,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
  },
}));

const MissionCard = styled(Card)(({ theme, active }) => ({
  borderRadius: 20,
  background: active
    ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
    : 'white',
  border: active ? '3px solid #4CAF50' : '1px solid #e0e0e0',
  boxShadow: active ? '0 12px 40px rgba(76, 175, 80, 0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
  transition: 'all 0.3s ease',
  animation: active ? `${pulse} 2s ease-in-out infinite` : 'none',
  position: 'relative',
  overflow: 'hidden',
}));

const StatsBox = styled(Paper)(({ theme, color }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
  border: `2px solid ${color}30`,
  textAlign: 'center',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-8px) scale(1.03)',
    boxShadow: `0 12px 30px ${color}40`,
    borderColor: color,
  },
}));

const ExpenseTypeCard = styled(Paper)(({ theme, selected, color }) => ({
  padding: theme.spacing(2.5),
  borderRadius: 16,
  cursor: 'pointer',
  border: selected ? `3px solid ${color}` : '2px solid #e0e0e0',
  background: selected ? `${color}15` : 'white',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: `0 8px 24px ${color}30`,
    borderColor: color,
  },
}));

const MaintenanceItem = styled(Paper)(({ theme, urgent }) => ({
  padding: theme.spacing(2.5),
  borderRadius: 16,
  marginBottom: theme.spacing(2),
  borderLeft: `5px solid ${urgent ? '#E74C3C' : '#3498DB'}`,
  background: urgent ? '#FDEDED' : '#E3F2FD',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateX(8px)',
    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
  },
}));

const OperationsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentMission, setCurrentMission] = useState(null);
  const [maintenanceSchedule, setMaintenanceSchedule] = useState([]);
  const [vehicleAlerts, setVehicleAlerts] = useState([]);
  const [insuranceInfo, setInsuranceInfo] = useState(null);
  const [expenses, setExpenses] = useState([]);

  // Dialogs
  const [missionDialogOpen, setMissionDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Mission Form
  const [missionType, setMissionType] = useState('depart');
  const [missionForm, setMissionForm] = useState({
    destination: '',
    purpose: '',
    passengers: '',
    cargo: '',
    kilometrage: '',
    startTime: new Date(),
    endTime: new Date(),
  });

  // Expense Form
  const [expenseForm, setExpenseForm] = useState({
    type: '',
    amount: '',
    description: '',
    date: new Date(),
    paymentMethod: 'cash',
    fuelLiters: '',
    fuelPrice: '',
    images: [],
  });

  // Breakdown Form
  const [breakdownForm, setBreakdownForm] = useState({
    type: '',
    description: '',
    urgent: false,
    images: [],
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  const expenseTypes = [
    { id: 'fuel', label: 'Carburant', icon: <LocalGasStation />, color: '#3498DB' },
    { id: 'repair', label: 'Réparation urgente', icon: <Build />, color: '#E74C3C' },
    { id: 'toll', label: 'Péage', icon: <Navigation />, color: '#F39C12' },
    { id: 'parking', label: 'Stationnement', icon: <LocalShipping />, color: '#2ECC71' },
    { id: 'insurance', label: 'Assurance', icon: <Security />, color: '#9B59B6' },
    { id: 'other', label: 'Autres frais', icon: <Receipt />, color: '#95A5A6' },
  ];

  const breakdownTypes = [
    { id: 'engine', label: 'Moteur', icon: <Engineering /> },
    { id: 'transmission', label: 'Transmission', icon: <Settings /> },
    { id: 'brakes', label: 'Freins', icon: <Warning /> },
    { id: 'tire', label: 'Pneu', icon: <DirectionsCar /> },
    { id: 'electrical', label: 'Électrique', icon: <Build /> },
    { id: 'other', label: 'Autre', icon: <CarRepair /> },
  ];

  const paymentMethods = [
    { id: 'cash', label: 'Espèces', icon: <AttachMoney /> },
    { id: 'card', label: 'Carte bancaire', icon: <CreditCard /> },
    { id: 'mobile', label: 'Mobile Money', icon: <PhoneAndroid /> },
  ];

  useEffect(() => {
    loadData();
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const tab = urlParams.get('tab');

    if (action === 'start') {
      setMissionType('depart');
      setMissionDialogOpen(true);
    } else if (action === 'end') {
      setMissionType('retour');
      loadCurrentMission();
      setMissionDialogOpen(true);
    }

    if (tab === 'maintenance') {
      setActiveTab(1);
    } else if (tab === 'expenses') {
      setExpenseDialogOpen(true);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mission, alerts, schedule, insurance, expensesData] = await Promise.all([
        chauffeurService.getCurrentMission(),
        chauffeurService.getVehicleAlerts(),
        chauffeurService.getMaintenanceSchedule(),
        chauffeurService.getInsuranceInfo(),
        chauffeurService.getExpenses(),
      ]);

      setCurrentMission(mission);
      setVehicleAlerts(alerts);
      setMaintenanceSchedule(schedule);
      setInsuranceInfo(insurance);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentMission = async () => {
    try {
      const mission = await chauffeurService.getCurrentMission();
      setCurrentMission(mission);
      if (mission) {
        setMissionForm(prev => ({
          ...prev,
          destination: mission.destination,
          purpose: mission.purpose,
          passengers: mission.passengers?.toString() || '',
          kilometrage: mission.start_km?.toString() || '',
        }));
      }
    } catch (error) {
      console.error('Error loading mission:', error);
    }
  };

  const handleImageUpload = (event, formType) => {
    const files = Array.from(event.target.files);
    const targetForm = formType === 'expense' ? expenseForm : breakdownForm;
    const setTargetForm = formType === 'expense' ? setExpenseForm : setBreakdownForm;

    if (targetForm.images.length + files.length > 5) {
      alert('Maximum 5 images autorisées');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTargetForm((prev) => ({
          ...prev,
          images: [
            ...prev.images,
            {
              uri: reader.result,
              name: file.name,
              type: file.type,
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index, formType) => {
    if (formType === 'expense') {
      setExpenseForm((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
    } else {
      setBreakdownForm((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
    }
  };

  const handleMissionSubmit = async () => {
    if (missionType === 'depart') {
      if (!missionForm.destination || !missionForm.purpose || !missionForm.kilometrage) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
      }

      try {
        setLoading(true);
        const result = await chauffeurService.startMission({
          ...missionForm,
          start_time: missionForm.startTime.toISOString(),
          start_km: parseInt(missionForm.kilometrage),
          passengers: parseInt(missionForm.passengers) || 0,
        });

        if (result.success) {
          alert('✅ Mission démarrée avec succès!');
          setMissionDialogOpen(false);
          loadData();
          window.location.href = '/chauffeur/dashboard';
        }
      } catch (error) {
        alert('❌ Erreur lors du démarrage de la mission');
      } finally {
        setLoading(false);
      }
    } else {
      if (!missionForm.kilometrage) {
        alert('Veuillez saisir le kilométrage de retour');
        return;
      }

      const startKm = currentMission?.start_km || 0;
      const endKm = parseInt(missionForm.kilometrage);

      if (endKm <= startKm) {
        alert('Le kilométrage de retour doit être supérieur au kilométrage de départ');
        return;
      }

      try {
        setLoading(true);
        const result = await chauffeurService.endMission({
          mission_id: currentMission.id,
          end_km: endKm,
          distance: endKm - startKm,
          end_time: missionForm.endTime.toISOString(),
          notes: missionForm.notes || '',
        });

        if (result.success) {
          alert(`✅ Mission terminée!\nDistance parcourue: ${endKm - startKm} km`);
          setMissionDialogOpen(false);
          loadData();
          window.location.href = '/chauffeur/dashboard';
        }
      } catch (error) {
        alert('❌ Erreur lors de la fin de la mission');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExpenseSubmit = async () => {
    if (!expenseForm.type || !expenseForm.amount || !expenseForm.description) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (expenseForm.type === 'fuel' && !expenseForm.fuelLiters) {
      alert('Veuillez saisir la quantité de carburant');
      return;
    }

    if (expenseForm.images.length === 0) {
      alert('Veuillez ajouter au moins un justificatif');
      return;
    }

    try {
      setLoading(true);
      const result = await chauffeurService.submitExpense({
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        fuel_liters: expenseForm.fuelLiters ? parseFloat(expenseForm.fuelLiters) : null,
        fuel_price: expenseForm.fuelPrice ? parseFloat(expenseForm.fuelPrice) : null,
        date: expenseForm.date.toISOString(),
        mission_id: currentMission?.id,
      });

      if (result.success) {
        alert('✅ Frais enregistré avec succès!');
        setExpenseDialogOpen(false);
        resetExpenseForm();
        loadData();
      }
    } catch (error) {
      alert('❌ Erreur lors de l\'enregistrement des frais');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakdownSubmit = async () => {
    if (!breakdownForm.type || !breakdownForm.description) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      const result = await chauffeurService.reportBreakdown({
        ...breakdownForm,
        urgent: breakdownForm.urgent,
      });

      if (result.success) {
        alert(
          breakdownForm.urgent
            ? '🚨 Panne urgente signalée! Un technicien sera contacté immédiatement.'
            : '✅ Panne signalée avec succès.'
        );
        setBreakdownDialogOpen(false);
        resetBreakdownForm();
        loadData();
      }
    } catch (error) {
      alert('❌ Erreur lors du signalement de la panne');
    } finally {
      setLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      type: '',
      amount: '',
      description: '',
      date: new Date(),
      paymentMethod: 'cash',
      fuelLiters: '',
      fuelPrice: '',
      images: [],
    });
    setCurrentStep(0);
  };

  const resetBreakdownForm = () => {
    setBreakdownForm({
      type: '',
      description: '',
      urgent: false,
      images: [],
    });
  };

  const renderOperationsTab = () => (
    <Box>
      {/* Current Mission */}
      {currentMission ? (
        <Zoom in={true} timeout={600}>
          <MissionCard active={true}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: `${pulse} 2s ease-in-out infinite`,
                    }}
                  >
                    <Navigation sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Mission en cours
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Réf: {currentMission.reference}
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label="ACTIF"
                  color="success"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    px: 2,
                    py: 3,
                    animation: `${pulse} 2s ease-in-out infinite`,
                  }}
                />
              </Stack>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <LocationOn color="primary" sx={{ fontSize: 32 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Destination
                        </Typography>
                        <Typography variant="h6" fontWeight="600">
                          {currentMission.destination}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Assignment color="primary" sx={{ fontSize: 32 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Motif
                        </Typography>
                        <Typography variant="body1" fontWeight="500">
                          {currentMission.purpose}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>

                <Grid item xs={4}>
                  <StatsBox color="#3498DB">
                    <Schedule sx={{ fontSize: 40, color: '#3498DB', mb: 1 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Durée
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="#3498DB">
                      {currentMission.duration || 0} min
                    </Typography>
                  </StatsBox>
                </Grid>

                <Grid item xs={4}>
                  <StatsBox color="#F39C12">
                    <Speed sx={{ fontSize: 40, color: '#F39C12', mb: 1 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Distance
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="#F39C12">
                      {(currentMission.current_km || 0) - (currentMission.start_km || 0)} km
                    </Typography>
                  </StatsBox>
                </Grid>

                <Grid item xs={4}>
                  <StatsBox color="#9B59B6">
                    <People sx={{ fontSize: 40, color: '#9B59B6', mb: 1 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Passagers
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="#9B59B6">
                      {currentMission.passengers || 0}
                    </Typography>
                  </StatsBox>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    color="error"
                    startIcon={<Flag />}
                    onClick={() => {
                      setMissionType('retour');
                      loadCurrentMission();
                      setMissionDialogOpen(true);
                    }}
                    sx={{
                      py: 2,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      borderRadius: 3,
                      boxShadow: '0 8px 24px rgba(231, 76, 60, 0.4)',
                    }}
                  >
                    Terminer la mission
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </MissionCard>
        </Zoom>
      ) : (
        <Fade in={true} timeout={800}>
          <Card sx={{ borderRadius: 4, boxShadow: 4 }}>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <Navigation
                sx={{
                  fontSize: 100,
                  color: '#BDC3C7',
                  mb: 3,
                  opacity: 0.5,
                }}
              />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Aucune mission en cours
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Démarrez une nouvelle mission pour commencer vos opérations
              </Typography>
              <Button
                variant="contained"
                size="large"
                color="success"
                startIcon={<PlayArrow />}
                onClick={() => {
                  setMissionType('depart');
                  setMissionDialogOpen(true);
                }}
                sx={{
                  py: 2,
                  px: 5,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  borderRadius: 3,
                  boxShadow: '0 8px 24px rgba(46, 204, 113, 0.4)',
                }}
              >
                Démarrer une mission
              </Button>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Quick Actions */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          Actions rapides
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsBox
              color="#3498DB"
              onClick={() => setExpenseDialogOpen(true)}
              sx={{ cursor: 'pointer' }}
            >
              <AttachMoney sx={{ fontSize: 48, color: '#3498DB', mb: 2 }} />
              <Typography variant="h6" fontWeight="600">
                Déclarer frais
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Carburant, péages, etc.
              </Typography>
            </StatsBox>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatsBox
              color="#E74C3C"
              onClick={() => setBreakdownDialogOpen(true)}
              sx={{ cursor: 'pointer' }}
            >
              <Build sx={{ fontSize: 48, color: '#E74C3C', mb: 2 }} />
              <Typography variant="h6" fontWeight="600">
                Signaler panne
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Problème technique
              </Typography>
            </StatsBox>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatsBox
              color="#F39C12"
              onClick={() => (window.location.href = '/chauffeur/incidents')}
              sx={{ cursor: 'pointer' }}
            >
              <Warning sx={{ fontSize: 48, color: '#F39C12', mb: 2 }} />
              <Typography variant="h6" fontWeight="600">
                Incident
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Accident ou dégâts
              </Typography>
            </StatsBox>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatsBox color="#2ECC71" onClick={() => setActiveTab(1)} sx={{ cursor: 'pointer' }}>
              <Build sx={{ fontSize: 48, color: '#2ECC71', mb: 2 }} />
              <Typography variant="h6" fontWeight="600">
                Maintenance
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Planning & alertes
              </Typography>
            </StatsBox>
          </Grid>
        </Grid>
      </Box>

      {/* Recent Expenses */}
      <Box sx={{ mt: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            Derniers frais déclarés
          </Typography>
          <Button variant="outlined" endIcon={<History />}>
            Voir tout
          </Button>
        </Stack>

        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell>
                  <Typography fontWeight="bold">Type</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight="bold">Description</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight="bold">Date</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">Montant</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight="bold">Statut</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.slice(0, 5).map((expense, index) => (
                <TableRow
                  key={index}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#f8f9fa' },
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {expenseTypes.find((t) => t.id === expense.type)?.icon || <Receipt />}
                      <Typography>{expense.type_label}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{expense.description.substring(0, 50)}...</TableCell>
                  <TableCell>
                    {new Date(expense.date).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold">${expense.amount.toFixed(2)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={expense.status_label}
                      size="small"
                      color={
                        expense.status === 'valide'
                          ? 'success'
                          : expense.status === 'rejete'
                          ? 'error'
                          : 'warning'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );

  const renderMaintenanceTab = () => (
    <Box>
      {/* Critical Alerts */}
      {vehicleAlerts.filter((a) => a.priority === 'high').length > 0 && (
        <Alert
          severity="error"
          icon={<Warning sx={{ fontSize: 28 }} />}
          sx={{
            mb: 4,
            borderRadius: 3,
            border: '2px solid #E74C3C',
            animation: `${pulse} 2s ease-in-out infinite`,
          }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            🚨 {vehicleAlerts.filter((a) => a.priority === 'high').length} Alerte(s) critique(s)
          </Typography>
          {vehicleAlerts
            .filter((a) => a.priority === 'high')
            .map((alert, idx) => (
              <Typography key={idx} variant="body2" sx={{ mt: 1 }}>
                • {alert.message}
              </Typography>
            ))}
        </Alert>
      )}

      {/* Vehicle Status */}
      <Card sx={{ borderRadius: 4, mb: 4, boxShadow: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
            État du véhicule
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                }}
              >
                <Engineering sx={{ fontSize: 48, color: '#4CAF50', mb: 1 }} />
                <Typography variant="caption" color="text.secondary" display="block">
                  Moteur
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#4CAF50">
                  Bon
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
                }}
              >
                <LocalGasStation sx={{ fontSize: 48, color: '#F39C12', mb: 1 }} />
                <Typography variant="caption" color="text.secondary" display="block">
                  Huile
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#F39C12">
                  À vérifier
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                }}
              >
                <DirectionsCar sx={{ fontSize: 48, color: '#4CAF50', mb: 1 }} />
                <Typography variant="caption" color="text.secondary" display="block">
                  Pneus
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#4CAF50">
                  Bon
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                }}
              >
                <CarRepair sx={{ fontSize: 48, color: '#4CAF50', mb: 1 }} />
                <Typography variant="caption" color="text.secondary" display="block">
                  Freins
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="#4CAF50">
                  Bon
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Maintenance Schedule */}
      <Card sx={{ borderRadius: 4, mb: 4, boxShadow: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              Planning de maintenance
            </Typography>
            <Chip
              label={`${maintenanceSchedule.length} intervention(s)`}
              color="primary"
              sx={{ fontWeight: 700 }}
            />
          </Stack>

          {maintenanceSchedule.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CheckCircle sx={{ fontSize: 80, color: '#2ECC71', mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" color="text.secondary">
                Aucune maintenance planifiée
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {maintenanceSchedule.map((item, index) => (
                <MaintenanceItem key={index} urgent={item.urgent}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={8}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: item.urgent
                              ? 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)'
                              : 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Build sx={{ color: 'white' }} />
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight="600">
                            {item.type}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(item.scheduled_date).toLocaleDateString('fr-FR')} • Dans{' '}
                            {item.km_remaining} km
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={4} sx={{ textAlign: { sm: 'right' } }}>
                      {item.urgent && (
                        <Chip
                          label="URGENT"
                          color="error"
                          sx={{ fontWeight: 700, mb: { xs: 1, sm: 0 } }}
                        />
                      )}
                    </Grid>
                  </Grid>
                </MaintenanceItem>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Insurance Info */}
      {insuranceInfo && (
        <Card sx={{ borderRadius: 4, mb: 4, boxShadow: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <Security sx={{ fontSize: 40, color: '#3498DB' }} />
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  Assurance véhicule
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {insuranceInfo.company}
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
                  <Typography variant="caption" color="text.secondary">
                    Police N°
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {insuranceInfo.policy_number}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
                  <Typography variant="caption" color="text.secondary">
                    Type de couverture
                  </Typography>
                  <Typography variant="h6" fontWeight="600">
                    {insuranceInfo.coverage_type}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor:
                      insuranceInfo.days_remaining <= 7
                        ? '#FDEDED'
                        : insuranceInfo.days_remaining <= 30
                        ? '#FFF3CD'
                        : '#E8F5E9',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Date d'expiration
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight="600"
                        color={
                          insuranceInfo.days_remaining <= 7
                            ? '#E74C3C'
                            : insuranceInfo.days_remaining <= 30
                            ? '#F39C12'
                            : '#2ECC71'
                        }
                      >
                        {new Date(insuranceInfo.expiry_date).toLocaleDateString('fr-FR')}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${insuranceInfo.days_remaining} jours restants`}
                      color={
                        insuranceInfo.days_remaining <= 7
                          ? 'error'
                          : insuranceInfo.days_remaining <= 30
                          ? 'warning'
                          : 'success'
                      }
                      sx={{ fontWeight: 700, fontSize: '1rem', px: 2, py: 3 }}
                    />
                  </Stack>
                </Paper>
              </Grid>

              {insuranceInfo.days_remaining <= 30 && (
                <Grid item xs={12}>
                  <Alert
                    severity={insuranceInfo.days_remaining <= 7 ? 'error' : 'warning'}
                    sx={{ borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold">
                      {insuranceInfo.days_remaining <= 7 ? '🚨 ' : '⚠️ '}
                      L'assurance expire bientôt !
                    </Typography>
                    <Typography variant="body2">
                      Contactez immédiatement le service administratif pour le renouvellement.
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Report Breakdown Button */}
      <Button
        fullWidth
        variant="contained"
        size="large"
        color="error"
        startIcon={<Warning />}
        onClick={() => setBreakdownDialogOpen(true)}
        sx={{
          py: 2.5,
          fontSize: '1.1rem',
          fontWeight: 700,
          borderRadius: 3,
          boxShadow: '0 8px 24px rgba(231, 76, 60, 0.4)',
        }}
      >
        Signaler une panne ou un problème technique
      </Button>

      {/* All Alerts */}
      {vehicleAlerts.length > 0 && (
        <Card sx={{ borderRadius: 4, mt: 4, boxShadow: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
              Toutes les alertes ({vehicleAlerts.length})
            </Typography>

            <List>
              {vehicleAlerts.map((alert, index) => (
                <ListItem
                  key={index}
                  sx={{
                    mb: 1,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: alert.priority === 'high' ? '#E74C3C' : '#F39C12',
                    bgcolor: alert.priority === 'high' ? '#FDEDED' : '#FFF9E6',
                  }}
                >
                  <ListItemIcon>
                    {alert.priority === 'high' ? (
                      <ErrorIcon color="error" />
                    ) : (
                      <Warning color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={alert.message}
                    secondary={new Date(alert.date).toLocaleDateString('fr-FR')}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      color: alert.priority === 'high' ? 'error.main' : 'warning.main',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box className="operations-container">
        {/* Header */}
        <GradientHeader color={activeTab === 0 ? '#2E86C1' : '#27AE60'}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h3" fontWeight="bold" gutterBottom>
                {activeTab === 0 ? '🚗 Opérations Quotidiennes' : '🔧 Maintenance Véhicule'}
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.95 }}>
                {activeTab === 0
                  ? 'Gestion des missions et des dépenses'
                  : 'Planification et alertes de maintenance'}
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Stack direction="row" spacing={2}>
                <Tooltip title="Rafraîchir">
                  <IconButton
                    onClick={loadData}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    }}
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Filtres">
                  <IconButton
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    }}
                  >
                    <FilterList />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Stack>
        </GradientHeader>

        {/* Tabs */}
        <Paper sx={{ mb: 4, borderRadius: 3, boxShadow: 4 }}>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                fontSize: '1.1rem',
                fontWeight: 600,
                py: 3,
              },
            }}
          >
            <Tab icon={<DirectionsCar />} iconPosition="start" label="Opérations & Missions" />
            <Tab
              icon={<Build />}
              iconPosition="start"
              label={
                <Badge badgeContent={vehicleAlerts.length} color="error">
                  Maintenance & Alertes
                </Badge>
              }
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography>Chargement des données...</Typography>
          </Box>
        ) : activeTab === 0 ? (
          renderOperationsTab()
        ) : (
          renderMaintenanceTab()
        )}

        {/* Mission Dialog */}
        <Dialog
          open={missionDialogOpen}
          onClose={() => setMissionDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight="bold">
                {missionType === 'depart' ? 'Démarrer une mission' : 'Terminer la mission'}
              </Typography>
              <IconButton onClick={() => setMissionDialogOpen(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ py: 4 }}>
            <Grid container spacing={3}>
              {missionType === 'depart' ? (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Destination *"
                      value={missionForm.destination}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, destination: e.target.value }))
                      }
                      placeholder="Lieu de destination..."
                      InputProps={{
                        startAdornment: <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Motif de la mission *"
                      value={missionForm.purpose}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, purpose: e.target.value }))
                      }
                      multiline
                      rows={3}
                      placeholder="Raison du déplacement..."
                      InputProps={{
                        startAdornment: <Assignment sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Nombre de passagers"
                      type="number"
                      value={missionForm.passengers}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, passengers: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: <People sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Kilométrage départ *"
                      type="number"
                      value={missionForm.kilometrage}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, kilometrage: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: <Speed sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Marchandise (optionnel)"
                      value={missionForm.cargo}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, cargo: e.target.value }))
                      }
                      multiline
                      rows={2}
                      placeholder="Description de la cargaison..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TimePicker
                      label="Heure de départ"
                      value={missionForm.startTime}
                      onChange={(newValue) =>
                        setMissionForm((prev) => ({ ...prev, startTime: newValue }))
                      }
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </>
              ) : (
                <>
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Mission en cours
                      </Typography>
                      <Typography variant="body2">
                        Destination: {currentMission?.destination}
                        <br />
                        Km départ: {currentMission?.start_km}
                      </Typography>
                    </Alert>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Kilométrage de retour *"
                      type="number"
                      value={missionForm.kilometrage}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, kilometrage: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: <Speed sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TimePicker
                      label="Heure de retour"
                      value={missionForm.endTime}
                      onChange={(newValue) =>
                        setMissionForm((prev) => ({ ...prev, endTime: newValue }))
                      }
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Observations (optionnel)"
                      value={missionForm.notes}
                      onChange={(e) =>
                        setMissionForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      multiline
                      rows={3}
                      placeholder="Remarques sur la mission..."
                    />
                  </Grid>

                  {parseInt(missionForm.kilometrage) && currentMission?.start_km && (
                    <Grid item xs={12}>
                      <Paper
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Speed sx={{ fontSize: 40, color: '#3498DB' }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Distance parcourue
                            </Typography>
                            <Typography variant="h4" fontWeight="bold" color="#3498DB">
                              {parseInt(missionForm.kilometrage) - currentMission.start_km} km
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
            <Button onClick={() => setMissionDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleMissionSubmit}
              disabled={loading}
              color={missionType === 'depart' ? 'success' : 'error'}
              startIcon={missionType === 'depart' ? <PlayArrow /> : <Flag />}
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 700 }}
            >
              {loading
                ? 'Traitement...'
                : missionType === 'depart'
                ? 'Démarrer la mission'
                : 'Terminer la mission'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Expense Dialog */}
        <Dialog
          open={expenseDialogOpen}
          onClose={() => setExpenseDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight="bold">
                Déclarer des frais
              </Typography>
              <IconButton onClick={() => setExpenseDialogOpen(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ py: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Type de frais *
                </Typography>
                <Grid container spacing={2}>
                  {expenseTypes.map((type) => (
                    <Grid item xs={6} sm={4} key={type.id}>
                      <ExpenseTypeCard
                        selected={expenseForm.type === type.id}
                        color={type.color}
                        onClick={() => setExpenseForm((prev) => ({ ...prev, type: type.id }))}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              margin: '0 auto 12px',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${type.color} 0%, ${type.color}CC 100%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {React.cloneElement(type.icon, {
                              sx: { fontSize: 28, color: 'white' },
                            })}
                          </Box>
                          <Typography variant="body2" fontWeight="600">
                            {type.label}
                          </Typography>
                        </Box>
                      </ExpenseTypeCard>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {expenseForm.type === 'fuel' && (
                <>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Quantité (litres) *"
                      type="number"
                      value={expenseForm.fuelLiters}
                      onChange={(e) =>
                        setExpenseForm((prev) => ({ ...prev, fuelLiters: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: <LocalGasStation sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Prix/litre"
                      type="number"
                      value={expenseForm.fuelPrice}
                      onChange={(e) =>
                        setExpenseForm((prev) => ({ ...prev, fuelPrice: e.target.value }))
                      }
                      InputProps={{
                        startAdornment: <AttachMoney sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Montant total (USD) *"
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  InputProps={{
                    startAdornment: <AttachMoney sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description *"
                  multiline
                  rows={3}
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Détails de la dépense..."
                />
              </Grid>

              <Grid item xs={12}>
                <DatePicker
                  label="Date"
                  value={expenseForm.date}
                  onChange={(newValue) =>
                    setExpenseForm((prev) => ({ ...prev, date: newValue }))
                  }
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  maxDate={new Date()}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Mode de paiement
                </Typography>
                <ToggleButtonGroup
                  value={expenseForm.paymentMethod}
                  exclusive
                  onChange={(e, value) => {
                    if (value) setExpenseForm((prev) => ({ ...prev, paymentMethod: value }));
                  }}
                  fullWidth
                >
                  {paymentMethods.map((method) => (
                    <ToggleButton key={method.id} value={method.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {method.icon}
                        <Typography>{method.label}</Typography>
                      </Stack>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Justificatifs * (max 5)
                </Typography>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  id="expense-image-upload"
                  onChange={(e) => handleImageUpload(e, 'expense')}
                />

                {expenseForm.images.length < 5 && (
                  <label htmlFor="expense-image-upload">
                    <Paper
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '3px dashed #3498DB',
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.02)',
                          borderColor: '#2980B9',
                        },
                      }}
                    >
                      <CloudUpload sx={{ fontSize: 64, color: '#3498DB', mb: 2 }} />
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Cliquez pour ajouter des justificatifs
                      </Typography>
                      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                        <Chip icon={<Camera />} label="Prendre photo" color="primary" />
                        <Chip
                          icon={<PhotoLibrary />}
                          label="Galerie"
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                    </Paper>
                  </label>
                )}

                {expenseForm.images.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                      Photos ({expenseForm.images.length}/5)
                    </Typography>
                    <ImageList cols={3} gap={16}>
                      {expenseForm.images.map((image, index) => (
                        <ImageListItem key={index} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                          <img
                            src={image.uri}
                            alt={`Justificatif ${index + 1}`}
                            style={{ height: 120, objectFit: 'cover' }}
                          />
                          <ImageListItemBar
                            title={`Photo ${index + 1}`}
                            actionIcon={
                              <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                                <IconButton
                                  sx={{ color: 'white' }}
                                  onClick={() => {
                                    setSelectedImage(image.uri);
                                    setImagePreviewOpen(true);
                                  }}
                                >
                                  <ZoomIn />
                                </IconButton>
                                <IconButton
                                  sx={{ color: 'white' }}
                                  onClick={() => removeImage(index, 'expense')}
                                >
                                  <Delete />
                                </IconButton>
                              </Stack>
                            }
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                )}
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
            <Button onClick={() => setExpenseDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleExpenseSubmit}
              disabled={loading}
              startIcon={<Send />}
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 700 }}
            >
              {loading ? 'Envoi...' : 'Soumettre les frais'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Breakdown Dialog */}
        <Dialog
          open={breakdownDialogOpen}
          onClose={() => setBreakdownDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight="bold">
                Signaler une panne
              </Typography>
              <IconButton onClick={() => setBreakdownDialogOpen(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ py: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Type de panne *
                </Typography>
                <Grid container spacing={2}>
                  {breakdownTypes.map((type) => (
                    <Grid item xs={6} sm={4} key={type.id}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          cursor: 'pointer',
                          border:
                            breakdownForm.type === type.id
                              ? '3px solid #E74C3C'
                              : '2px solid #e0e0e0',
                          borderRadius: 3,
                          background:
                            breakdownForm.type === type.id
                              ? 'linear-gradient(135deg, #FDEDED 0%, #FEE2E2 100%)'
                              : 'white',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            borderColor: '#E74C3C',
                          },
                        }}
                        onClick={() =>
                          setBreakdownForm((prev) => ({ ...prev, type: type.id }))
                        }
                      >
                        {React.cloneElement(type.icon, {
                          sx: {
                            fontSize: 40,
                            color: breakdownForm.type === type.id ? '#E74C3C' : '#7F8C8D',
                            mb: 1,
                          },
                        })}
                        <Typography variant="body2" fontWeight="600">
                          {type.label}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description détaillée *"
                  multiline
                  rows={4}
                  value={breakdownForm.description}
                  onChange={(e) =>
                    setBreakdownForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Décrivez le problème rencontré..."
                />
              </Grid>

              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: breakdownForm.urgent ? '#FDEDED' : '#FFF3CD',
                    border: breakdownForm.urgent ? '2px solid #E74C3C' : '2px solid #F39C12',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setBreakdownForm((prev) => ({ ...prev, urgent: !prev.urgent }))
                  }
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '4px',
                        border: '2px solid',
                        borderColor: breakdownForm.urgent ? '#E74C3C' : '#F39C12',
                        background: breakdownForm.urgent ? '#E74C3C' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {breakdownForm.urgent && <CheckCircle sx={{ fontSize: 20, color: 'white' }} />}
                    </Box>
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Réparation urgente
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Le véhicule est immobilisé et nécessite une intervention immédiate
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Photos (optionnel)
                </Typography>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  id="breakdown-image-upload"
                  onChange={(e) => handleImageUpload(e, 'breakdown')}
                />

                {breakdownForm.images.length < 5 && (
                  <label htmlFor="breakdown-image-upload">
                    <Paper
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '3px dashed #E74C3C',
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #FDEDED 0%, #FEE2E2 100%)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.02)',
                        },
                      }}
                    >
                      <CloudUpload sx={{ fontSize: 64, color: '#E74C3C', mb: 2 }} />
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Ajouter des photos de la panne
                      </Typography>
                    </Paper>
                  </label>
                )}

                {breakdownForm.images.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <ImageList cols={3} gap={16}>
                      {breakdownForm.images.map((image, index) => (
                        <ImageListItem key={index} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                          <img
                            src={image.uri}
                            alt={`Panne ${index + 1}`}
                            style={{ height: 120, objectFit: 'cover' }}
                          />
                          <ImageListItemBar
                            actionIcon={
                              <IconButton
                                sx={{ color: 'white' }}
                                onClick={() => removeImage(index, 'breakdown')}
                              >
                                <Delete />
                              </IconButton>
                            }
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                )}
              </Grid>

              {breakdownForm.urgent && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      🚨 Panne urgente
                    </Typography>
                    <Typography variant="body2">
                      Cette panne sera signalée comme urgente. Un technicien sera contacté
                      immédiatement.
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
            <Button onClick={() => setBreakdownDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleBreakdownSubmit}
              disabled={loading}
              color={breakdownForm.urgent ? 'error' : 'warning'}
              startIcon={<Send />}
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 700 }}
            >
              {loading
                ? 'Envoi...'
                : breakdownForm.urgent
                ? 'Signaler panne urgente'
                : 'Signaler la panne'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog
          open={imagePreviewOpen}
          onClose={() => setImagePreviewOpen(false)}
          maxWidth="lg"
          PaperProps={{ sx: { bgcolor: 'black', borderRadius: 2 } }}
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            )}
            <IconButton
              onClick={() => setImagePreviewOpen(false)}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
            >
              <Close />
            </IconButton>
          </DialogContent>
        </Dialog>

        {/* Floating Action Button */}
        <SpeedDial
          ariaLabel="Actions rapides"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          icon={<SpeedDialIcon />}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
          open={speedDialOpen}
        >
          <SpeedDialAction
            icon={<AttachMoney />}
            tooltipTitle="Déclarer frais"
            onClick={() => {
              setExpenseDialogOpen(true);
              setSpeedDialOpen(false);
            }}
          />
          <SpeedDialAction
            icon={<Build />}
            tooltipTitle="Signaler panne"
            onClick={() => {
              setBreakdownDialogOpen(true);
              setSpeedDialOpen(false);
            }}
          />
          <SpeedDialAction
            icon={<Warning />}
            tooltipTitle="Incident"
            onClick={() => {
              window.location.href = '/chauffeur/incidents';
            }}
          />
        </SpeedDial>
      </Box>
    </LocalizationProvider>
  );
};

export default OperationsPage;