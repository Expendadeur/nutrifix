// web/src/pages/chauffeur/IncidentsPage.jsx
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
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Paper,
  Stack,
  Avatar,
  Divider,
  Alert,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tooltip,
  Badge,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Zoom,
  Fade,
  Grow,
} from '@mui/material';
import {
  Warning,
  Add,
  Close,
  CloudUpload,
  Delete,
  ZoomIn,
  LocationOn,
  MyLocation,
  AccessTime,
  CalendarToday,
  DirectionsCar,
  LocalPolice,
  People,
  Description,
  CheckCircle,
  Schedule,
  Error as ErrorIcon,
  Info,
  Image as ImageIcon,
  Camera,
  PhotoLibrary,
  Send,
  ArrowBack,
  ArrowForward,
  Refresh,
  FilterList,
  Search,
  MoreVert,
  GetApp,
  Print,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import chauffeurService from '../../services/chauffeurService';
import '../css/IncidentsPage.css';

// Animations
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

const slideInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Styled Components
const GradientHeader = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
  borderRadius: 24,
  padding: theme.spacing(4),
  color: 'white',
  marginBottom: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(231, 76, 60, 0.3)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
  },
}));

const IncidentTypeCard = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(2.5),
  borderRadius: 16,
  cursor: 'pointer',
  border: selected ? '3px solid #E74C3C' : '2px solid #e0e0e0',
  background: selected 
    ? 'linear-gradient(135deg, #FDEDED 0%, #FEE2E2 100%)'
    : 'white',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 12px 30px rgba(231, 76, 60, 0.3)',
    borderColor: '#E74C3C',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, transparent 0%, rgba(231, 76, 60, 0.05) 100%)',
    opacity: selected ? 1 : 0,
    transition: 'opacity 0.3s ease',
  },
}));

const SeverityButton = styled(Button)(({ theme, selected, severityColor }) => ({
  borderRadius: 12,
  padding: '12px 24px',
  border: `2px solid ${selected ? severityColor : '#e0e0e0'}`,
  background: selected ? severityColor : 'white',
  color: selected ? 'white' : severityColor,
  fontWeight: 700,
  transition: 'all 0.3s ease',
  '&:hover': {
    background: severityColor,
    color: 'white',
    transform: 'scale(1.05)',
    boxShadow: `0 8px 24px ${severityColor}50`,
  },
}));

const IncidentCard = styled(Card)(({ theme, status }) => ({
  borderRadius: 20,
  marginBottom: theme.spacing(2),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  borderLeft: `6px solid ${
    status === 'resolved' ? '#2ECC71' :
    status === 'investigating' ? '#3498DB' :
    status === 'closed' ? '#95A5A6' :
    '#F39C12'
  }`,
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateX(8px) scale(1.01)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
  },
}));

const ImageUploadBox = styled(Box)(({ theme }) => ({
  border: '3px dashed #3498DB',
  borderRadius: 20,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
  '&:hover': {
    borderColor: '#2980B9',
    transform: 'scale(1.02)',
    boxShadow: '0 8px 24px rgba(52, 152, 219, 0.3)',
  },
}));

const IncidentsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form states
  const [formData, setFormData] = useState({
    type: '',
    severity: 'normal',
    description: '',
    location: '',
    coordinates: null,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    vehicleDamage: false,
    injuries: false,
    policeReport: false,
    policeReportNumber: '',
    witnesses: '',
    otherParty: '',
    images: [],
  });

  const incidentTypes = [
    { id: 'accident', label: 'Accident de la route', icon: '🚗💥', color: '#E74C3C', description: 'Collision avec un autre véhicule ou obstacle' },
    { id: 'breakdown', label: 'Panne mécanique', icon: '⚙️🔧', color: '#F39C12', description: 'Problème technique du véhicule' },
    { id: 'theft', label: 'Vol/Effraction', icon: '🔐🚨', color: '#9B59B6', description: 'Tentative de vol ou effraction' },
    { id: 'damage', label: 'Dégâts matériels', icon: '🔨💔', color: '#E67E22', description: 'Dommages au véhicule ou équipement' },
    { id: 'tire', label: 'Crevaison', icon: '🛞❌', color: '#3498DB', description: 'Problème de pneumatique' },
    { id: 'other', label: 'Autre incident', icon: '⚠️📋', color: '#95A5A6', description: 'Autre type d\'incident' },
  ];

  const steps = ['Type & Gravité', 'Détails', 'Informations supplémentaires', 'Justificatifs'];

  useEffect(() => {
    if (activeTab === 1) {
      loadIncidents();
    }
  }, [activeTab]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await chauffeurService.getIncidents();
      setIncidents(data);
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            location: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          }));
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (formData.images.length + files.length > 5) {
      alert('Maximum 5 images autorisées');
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, {
            uri: reader.result,
            name: file.name,
            type: file.type,
          }],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.type || !formData.description || !formData.location) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.policeReport && !formData.policeReportNumber) {
      alert('Veuillez saisir le numéro du rapport de police');
      return;
    }

    try {
      setLoading(true);
      const result = await chauffeurService.reportIncident(formData);
      
      if (result.success) {
        alert('✅ Incident signalé avec succès!');
        setDialogOpen(false);
        resetForm();
        setActiveTab(1);
        loadIncidents();
      }
    } catch (error) {
      alert('❌ Erreur lors du signalement de l\'incident');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: '',
      severity: 'normal',
      description: '',
      location: '',
      coordinates: null,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      vehicleDamage: false,
      injuries: false,
      policeReport: false,
      policeReportNumber: '',
      witnesses: '',
      otherParty: '',
      images: [],
    });
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep === 0 && !formData.type) {
      alert('Veuillez sélectionner un type d\'incident');
      return;
    }
    if (currentStep === 1 && !formData.description) {
      alert('Veuillez décrire l\'incident');
      return;
    }
    if (currentStep === 1 && !formData.location) {
      alert('Veuillez indiquer le lieu de l\'incident');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         incident.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || incident.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return '#2ECC71';
      case 'investigating': return '#3498DB';
      case 'closed': return '#95A5A6';
      default: return '#F39C12';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'investigating': return 'En cours d\'investigation';
      case 'resolved': return 'Résolu';
      case 'closed': return 'Clôturé';
      default: return status;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Type d'incident *
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {incidentTypes.map((type) => (
                <Grid item xs={12} sm={6} md={4} key={type.id}>
                  <IncidentTypeCard
                    selected={formData.type === type.id}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                    elevation={formData.type === type.id ? 8 : 2}
                  >
                    <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <Typography variant="h2" sx={{ mb: 1 }}>
                        {type.icon}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {type.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </IncidentTypeCard>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Niveau de gravité *
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <SeverityButton
                fullWidth
                selected={formData.severity === 'low'}
                severityColor="#2ECC71"
                onClick={() => setFormData(prev => ({ ...prev, severity: 'low' }))}
                startIcon={<Info />}
              >
                Faible - À surveiller
              </SeverityButton>
              <SeverityButton
                fullWidth
                selected={formData.severity === 'normal'}
                severityColor="#F39C12"
                onClick={() => setFormData(prev => ({ ...prev, severity: 'normal' }))}
                startIcon={<Warning />}
              >
                Moyen - À traiter
              </SeverityButton>
              <SeverityButton
                fullWidth
                selected={formData.severity === 'high'}
                severityColor="#E74C3C"
                onClick={() => setFormData(prev => ({ ...prev, severity: 'high' }))}
                startIcon={<ErrorIcon />}
              >
                Urgent - Immédiat
              </SeverityButton>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date de l'incident *"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: new Date().toISOString().split('T')[0] }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Heure de l'incident *"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    label="Lieu de l'incident *"
                    multiline
                    rows={2}
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Adresse exacte ou description du lieu..."
                  />
                  <Tooltip title="Utiliser ma position actuelle">
                    <IconButton
                      sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                      onClick={getCurrentLocation}
                    >
                      <MyLocation />
                    </IconButton>
                  </Tooltip>
                </Box>
                {formData.coordinates && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    📍 GPS: {formData.coordinates.latitude.toFixed(6)}, {formData.coordinates.longitude.toFixed(6)}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description détaillée de l'incident *"
                  multiline
                  rows={6}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez l'incident en détail (circonstances, déroulement, conséquences...)&#10;&#10;Soyez le plus précis possible pour faciliter le traitement."
                  helperText={`${formData.description.length} caractères`}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Questions complémentaires
              </Typography>

              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.vehicleDamage}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleDamage: e.target.checked }))}
                      color="error"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Dégâts au véhicule
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Le véhicule a-t-il subi des dommages ?
                      </Typography>
                    </Box>
                  }
                />

                <Divider />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.injuries}
                      onChange={(e) => setFormData(prev => ({ ...prev, injuries: e.target.checked }))}
                      color="error"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Blessures corporelles
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Y a-t-il eu des blessés ?
                      </Typography>
                    </Box>
                  }
                />

                <Divider />

                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.policeReport}
                        onChange={(e) => setFormData(prev => ({ ...prev, policeReport: e.target.checked }))}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle1" fontWeight="600">
                          Rapport de police établi
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Un rapport de police a-t-il été rédigé ?
                        </Typography>
                      </Box>
                    }
                  />

                  <Collapse in={formData.policeReport}>
                    <TextField
                      fullWidth
                      label="Numéro du rapport de police *"
                      value={formData.policeReportNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, policeReportNumber: e.target.value }))}
                      placeholder="Ex: PV-2024-12345"
                      sx={{ mt: 2 }}
                      InputProps={{
                        startAdornment: <LocalPolice sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Collapse>
                </Box>
              </Stack>
            </Paper>

            <TextField
              fullWidth
              label="Témoins (optionnel)"
              multiline
              rows={3}
              value={formData.witnesses}
              onChange={(e) => setFormData(prev => ({ ...prev, witnesses: e.target.value }))}
              placeholder="Noms, coordonnées et témoignages des personnes présentes..."
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <People sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            <TextField
              fullWidth
              label="Autre partie impliquée (optionnel)"
              multiline
              rows={3}
              value={formData.otherParty}
              onChange={(e) => setFormData(prev => ({ ...prev, otherParty: e.target.value }))}
              placeholder="Informations sur l'autre conducteur, véhicule, assurance..."
              InputProps={{
                startAdornment: <DirectionsCar sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Photos de l'incident
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Ajoutez des photos claires du lieu, des dégâts, des véhicules impliqués... (Maximum 5 photos)
            </Typography>

            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              id="image-upload"
              onChange={handleImageUpload}
            />

            {formData.images.length < 5 && (
              <label htmlFor="image-upload">
                <ImageUploadBox>
                  <CloudUpload sx={{ fontSize: 64, color: '#3498DB', mb: 2 }} />
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Cliquez pour ajouter des photos
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ou glissez-déposez vos images ici
                  </Typography>
                  <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                    <Chip icon={<Camera />} label="Prendre une photo" color="primary" />
                    <Chip icon={<PhotoLibrary />} label="Depuis la galerie" color="primary" variant="outlined" />
                  </Stack>
                </ImageUploadBox>
              </label>
            )}

            {formData.images.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Photos ajoutées ({formData.images.length}/5)
                </Typography>
                <ImageList cols={3} gap={16} sx={{ mt: 2 }}>
                  {formData.images.map((image, index) => (
                    <Grow in={true} timeout={300 * (index + 1)} key={index}>
                      <ImageListItem sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <img
                          src={image.uri}
                          alt={`Incident ${index + 1}`}
                          style={{ height: 200, objectFit: 'cover' }}
                        />
                        <ImageListItemBar
                          title={`Photo ${index + 1}`}
                          actionIcon={
                            <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                              <Tooltip title="Agrandir">
                                <IconButton
                                  sx={{ color: 'white' }}
                                  onClick={() => {
                                    setSelectedImage(image.uri);
                                    setImagePreviewOpen(true);
                                  }}
                                >
                                  <ZoomIn />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Supprimer">
                                <IconButton
                                  sx={{ color: 'white' }}
                                  onClick={() => removeImage(index)}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          }
                          sx={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                          }}
                        />
                      </ImageListItem>
                    </Grow>
                  ))}
                </ImageList>
              </Box>
            )}

            <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                📸 Conseils pour de bonnes photos
              </Typography>
              <Typography variant="body2">
                • Prenez des photos nettes et bien éclairées<br />
                • Photographiez tous les angles des dégâts<br />
                • Incluez l'environnement et les plaques d'immatriculation si pertinent<br />
                • Évitez de photographier des personnes identifiables
              </Typography>
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box className="incidents-container">
      {/* Header */}
      <GradientHeader>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h3" fontWeight="bold" gutterBottom>
              Gestion des Incidents 🚨
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Signalez et suivez vos incidents en temps réel
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            sx={{
              bgcolor: 'white',
              color: '#E74C3C',
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              fontWeight: 700,
              borderRadius: 3,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              '&:hover': {
                bgcolor: '#f8f9fa',
                transform: 'scale(1.05)',
              },
            }}
          >
            Signaler un incident
          </Button>
        </Stack>
      </GradientHeader>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              fontSize: '1rem',
              fontWeight: 600,
              py: 2.5,
            },
          }}
        >
          <Tab
            icon={<Add />}
            iconPosition="start"
            label="Nouveau signalement"
          />
          <Tab
            icon={<Schedule />}
            iconPosition="start"
            label={`Historique (${incidents.length})`}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 ? (
        <Card sx={{ borderRadius: 4, p: 4 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Signaler un nouvel incident
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Cliquez sur le bouton ci-dessus pour ouvrir le formulaire de signalement complet
          </Typography>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Warning sx={{ fontSize: 100, color: '#E74C3C', mb: 3, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucun formulaire actif
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => setDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Démarrer un signalement
            </Button>
          </Box>
        </Card>
      ) : (
        <Box>
          {/* Filters */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Rechercher un incident..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Statut"
                  >
                    <MenuItem value="all">Tous les statuts</MenuItem>
                    <MenuItem value="pending">En attente</MenuItem>
                    <MenuItem value="investigating">En investigation</MenuItem>
                    <MenuItem value="resolved">Résolu</MenuItem>
                    <MenuItem value="closed">Clôturé</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadIncidents}
                  sx={{ height: '56px' }}
                >
                  Actualiser
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Incidents List */}
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>Chargement des incidents...</Typography>
            </Box>
          ) : filteredIncidents.length === 0 ? (
            <Card sx={{ borderRadius: 4, p: 8, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 100, color: '#2ECC71', mb: 3, opacity: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Aucun incident trouvé
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {searchQuery || filterStatus !== 'all'
                  ? 'Essayez de modifier vos critères de recherche'
                  : 'Vos incidents signalés apparaîtront ici'}
              </Typography>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {filteredIncidents.map((incident, index) => (
                <Grid item xs={12} key={incident.id}>
                  <Zoom in={true} timeout={200 * (index + 1)}>
                    <IncidentCard
                      status={incident.status}
                      onClick={() => {
                        setSelectedIncident(incident);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <CardContent>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={8}>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                              <Avatar
                                sx={{
                                  bgcolor: incidentTypes.find(t => t.id === incident.type)?.color || '#95A5A6',
                                  width: 56,
                                  height: 56,
                                }}
                              >
                                <Typography variant="h4">
                                  {incidentTypes.find(t => t.id === incident.type)?.icon.split('')[0] || '⚠️'}
                                </Typography>
                              </Avatar>
                              <Box>
                                <Typography variant="h6" fontWeight="bold">
                                  {incident.type_label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Réf: {incident.reference}
                                </Typography>
                              </Box>
                            </Stack>

                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {incident.description.substring(0, 150)}
                              {incident.description.length > 150 && '...'}
                            </Typography>

                            <Stack direction="row" spacing={2} flexWrap="wrap">
                              <Chip
                                icon={<LocationOn />}
                                label={incident.location.substring(0, 40)}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                icon={<CalendarToday />}
                                label={new Date(incident.date).toLocaleDateString('fr-FR')}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                icon={<AccessTime />}
                                label={incident.time}
                                size="small"
                                variant="outlined"
                              />
                            </Stack>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Stack spacing={2} alignItems="flex-end">
                              <Chip
                                label={getStatusLabel(incident.status)}
                                sx={{
                                  bgcolor: getStatusColor(incident.status),
                                  color: 'white',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  px: 2,
                                  py: 2.5,
                                }}
                              />

                              <Chip
                                label={
                                  incident.severity === 'high' ? 'Urgent' :
                                  incident.severity === 'normal' ? 'Moyen' : 'Faible'
                                }
                                color={
                                  incident.severity === 'high' ? 'error' :
                                  incident.severity === 'normal' ? 'warning' : 'success'
                                }
                                variant="outlined"
                              />

                              {incident.images && incident.images.length > 0 && (
                                <Chip
                                  icon={<ImageIcon />}
                                  label={`${incident.images.length} photo(s)`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}

                              <Button
                                variant="outlined"
                                size="small"
                                endIcon={<ArrowForward />}
                              >
                                Voir détails
                              </Button>
                            </Stack>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </IncidentCard>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Report Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4 },
        }}
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Signaler un incident
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Étape {currentStep + 1} sur {steps.length}
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>

        <Divider />

        <Box sx={{ px: 3, py: 2 }}>
          <Stepper activeStep={currentStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent sx={{ minHeight: 400 }}>
          <Fade in={true} timeout={300} key={currentStep}>
            <Box>{renderStepContent()}</Box>
          </Fade>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
          <Button
            onClick={handleBack}
            disabled={currentStep === 0}
            startIcon={<ArrowBack />}
          >
            Précédent
          </Button>
          <Box sx={{ flex: 1 }} />
          {currentStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<ArrowForward />}
            >
              Suivant
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              onClick={handleSubmit}
              disabled={loading}
              startIcon={loading ? <LinearProgress /> : <Send />}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 700,
              }}
            >
              {loading ? 'Envoi en cours...' : 'Signaler l\'incident'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4 },
        }}
      >
        {selectedIncident && (
          <>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    Détails de l'incident
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Réf: {selectedIncident.reference}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Télécharger le rapport">
                    <IconButton>
                      <GetApp />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Imprimer">
                    <IconButton>
                      <Print />
                    </IconButton>
                  </Tooltip>
                  <IconButton onClick={() => setDetailsDialogOpen(false)}>
                    <Close />
                  </IconButton>
                </Stack>
              </Stack>
            </DialogTitle>

            <Divider />

            <DialogContent>
              <Stack spacing={3}>
                {/* Type & Status */}
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Type d'incident
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="h6">
                          {incidentTypes.find(t => t.id === selectedIncident.type)?.icon.split('')[0] || '⚠️'}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {selectedIncident.type_label}
                        </Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Statut
                      </Typography>
                      <Chip
                        label={getStatusLabel(selectedIncident.status)}
                        sx={{
                          bgcolor: getStatusColor(selectedIncident.status),
                          color: 'white',
                          fontWeight: 700,
                          mt: 0.5,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>

                {/* Date & Location */}
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Informations générales
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CalendarToday color="primary" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Date et heure
                        </Typography>
                        <Typography variant="body1" fontWeight="500">
                          {new Date(selectedIncident.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })} à {selectedIncident.time}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LocationOn color="primary" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Lieu
                        </Typography>
                        <Typography variant="body1" fontWeight="500">
                          {selectedIncident.location}
                        </Typography>
                      </Box>
                    </Box>

                    {selectedIncident.coordinates && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MyLocation color="primary" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Coordonnées GPS
                          </Typography>
                          <Typography variant="body1" fontWeight="500">
                            {selectedIncident.coordinates.latitude.toFixed(6)}, {selectedIncident.coordinates.longitude.toFixed(6)}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </Paper>

                {/* Description */}
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                    {selectedIncident.description}
                  </Typography>
                </Paper>

                {/* Additional Details */}
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Détails supplémentaires
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Dégâts véhicule
                      </Typography>
                      <Chip
                        label={selectedIncident.vehicle_damage ? 'Oui' : 'Non'}
                        color={selectedIncident.vehicle_damage ? 'error' : 'success'}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Blessures
                      </Typography>
                      <Chip
                        label={selectedIncident.injuries ? 'Oui' : 'Non'}
                        color={selectedIncident.injuries ? 'error' : 'success'}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Rapport de police
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        {selectedIncident.police_report
                          ? `Oui - ${selectedIncident.police_report_number}`
                          : 'Non'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Images */}
                {selectedIncident.images && selectedIncident.images.length > 0 && (
                  <Paper sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Photos ({selectedIncident.images.length})
                    </Typography>
                    <ImageList cols={3} gap={12}>
                      {selectedIncident.images.map((image, index) => (
                        <ImageListItem
                          key={index}
                          sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedImage(image.url);
                            setImagePreviewOpen(true);
                          }}
                        >
                          <img
                            src={image.url}
                            alt={`Incident ${index + 1}`}
                            style={{ height: 150, objectFit: 'cover' }}
                          />
                          <ImageListItemBar
                            title={`Photo ${index + 1}`}
                            actionIcon={
                              <IconButton sx={{ color: 'white' }}>
                                <ZoomIn />
                              </IconButton>
                            }
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Paper>
                )}

                {/* Manager Notes */}
                {selectedIncident.notes && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Notes du gestionnaire
                    </Typography>
                    <Typography variant="body2">
                      {selectedIncident.notes}
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
              <Button onClick={() => setDetailsDialogOpen(false)}>
                Fermer
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog
        open={imagePreviewOpen}
        onClose={() => setImagePreviewOpen(false)}
        maxWidth="lg"
        PaperProps={{
          sx: { bgcolor: 'black', borderRadius: 2 },
        }}
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
    </Box>
  );
};

export default IncidentsPage;