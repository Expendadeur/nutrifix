// frontend/src/screens/admin/CommercialScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  Platform,
  RefreshControl
} from 'react-native';
import {
  Card,
  Title,
  Button,
  Searchbar,
  Chip,
  Modal,
  Portal,
  TextInput,
  IconButton,
  Avatar,
  SegmentedButtons,
  FAB,
  Menu,
  Divider,
  ActivityIndicator,
  Badge
} from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireAuth } from '../../utils/authGuard';

const COLORS = {
  primary: '#2E86C1',
  secondary: '#10B981', // Modern Emerald Green
  danger: '#E74C3C',
  warning: '#F39C12',
  info: '#3498DB',
  dark: '#2C3E50',
  light: '#ECF0F1',
  white: '#FFFFFF',
  gray: '#7F8C8D',
  lightGray: '#BDC3C7',
  background: '#F5F6FA'
};

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = Platform.select({
  web: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api'
});

// ============================================
// RESPONSIVE HOOKS
// ============================================
const useResponsive = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  return {
    width,
    height,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isLandscape: width > height,
    getColumns: () => {
      if (width >= 1400) return 4;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    },
    cardWidth: (columns) => {
      const padding = 20;
      const gap = 15;
      return (width - (padding * 2) - (gap * (columns - 1))) / columns;
    }
  };
};

// ============================================
// API HELPER
// ============================================
const apiCall = async (endpoint, method = 'GET', data = null) => {
  try {
    const token = await AsyncStorage.getItem('userToken');

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    const url = endpoint.includes('?')
      ? `${API_URL}${endpoint}`
      : `${API_URL}${endpoint}${data && method === 'GET' ? '?' + new URLSearchParams(data).toString() : ''}`;

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur réseau');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const CommercialScreen = ({ navigation, route }) => {
  const responsive = useResponsive();

  const { user, isLoading } = requireAuth(navigation, { role: 'admin' });

  // ============================================
  // STATES
  // ============================================
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  // Clients
  const [clients, setClients] = useState([]);
  const [clientsPagination, setClientsPagination] = useState({ total: 0, pages: 0 });
  const [clientsFilters, setClientsFilters] = useState({ limit: 50, offset: 0 });
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientMode, setClientMode] = useState('view');
  const [clientForm, setClientForm] = useState(getEmptyClientForm());

  // Fournisseurs
  const [fournisseurs, setFournisseurs] = useState([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurMode, setFournisseurMode] = useState('view');
  const [fournisseurForm, setFournisseurForm] = useState(getEmptyFournisseurForm());

  // Commandes Vente
  const [commandesVente, setCommandesVente] = useState([]);
  const [selectedCommandeVente, setSelectedCommandeVente] = useState(null);
  const [commandeVenteModalVisible, setCommandeVenteModalVisible] = useState(false);
  const [commandeVenteMode, setCommandeVenteMode] = useState('view');
  const [commandeVenteForm, setCommandeVenteForm] = useState(getEmptyCommandeVenteForm());

  // Commandes Achat
  const [commandesAchat, setCommandesAchat] = useState([]);
  const [commandeAchatModalVisible, setCommandeAchatModalVisible] = useState(false);
  const [commandeAchatMode, setCommandeAchatMode] = useState('view');
  const [commandeAchatForm, setCommandeAchatForm] = useState(getEmptyCommandeAchatForm());

  // Factures
  const [factures, setFactures] = useState([]);
  const [factureModalVisible, setFactureModalVisible] = useState(false);

  // Paiements
  const [paiements, setPaiements] = useState([]);
  const [paiementModalVisible, setPaiementModalVisible] = useState(false);
  const [paiementForm, setPaiementForm] = useState(getEmptyPaiementForm());

  // Statistiques
  const [statistiques, setStatistiques] = useState(null);

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  // Menus
  const [clientMenuVisible, setClientMenuVisible] = useState(false);
  const [fournisseurMenuVisible, setFournisseurMenuVisible] = useState(false);
  const [exportMenuVisible, setExportMenuVisible] = useState(false);

  // Ligne Commande
  const [ligneModalVisible, setLigneModalVisible] = useState(false);
  const [ligneForm, setLigneForm] = useState(getEmptyLigneForm());
  const [ligneType, setLigneType] = useState('vente');

  // ============================================
  // FORM TEMPLATES
  // ============================================
  function getEmptyClientForm() {
    return {
      nom_client: '',
      type: 'particulier',
      contact_principal: '',
      telephone: '',
      email: '',
      adresse: '',
      ville: '',
      pays: 'Burundi',
      secteur_activite: '',
      numero_tva: '',
      banque: '',
      numero_compte: '',
      limite_credit: '0',
      delai_paiement_jours: '30',
      niveau_fidelite: 'nouveau',
      statut: 'actif'
    };
  }

  function getEmptyFournisseurForm() {
    return {
      nom_fournisseur: '',
      type: 'general',
      contact_principal: '',
      telephone: '',
      email: '',
      adresse: '',
      ville: '',
      pays: 'Burundi',
      numero_registre: '',
      numero_tva: '',
      banque: '',
      numero_compte: '',
      conditions_paiement: '30 jours',
      note_evaluation: '5',
      statut: 'actif'
    };
  }

  function getEmptyCommandeVenteForm() {
    return {
      id_client: null,
      date_commande: new Date().toISOString().split('T')[0],
      date_livraison_prevue: '',
      lieu_livraison: '',
      mode_paiement: 'especes',
      conditions_paiement: '30 jours',
      tva_pourcent: '16',
      frais_livraison: '0',
      remise: '0',
      observations_livraison: '',
      lignes: []
    };
  }

  function getEmptyCommandeAchatForm() {
    return {
      id_fournisseur: null,
      date_commande: new Date().toISOString().split('T')[0],
      date_livraison_prevue: '',
      lieu_livraison: '',
      mode_paiement: 'credit',
      conditions_paiement: '30 jours',
      delai_paiement_jours: '30',
      tva_pourcent: '16',
      frais_livraison: '0',
      remise: '0',
      observations_livraison: '',
      lignes: []
    };
  }

  function getEmptyPaiementForm() {
    return {
      type_paiement: 'encaissement',
      source_type: 'facture',
      id_source: null,
      id_facture: null,
      montant: '0',
      mode_paiement: 'especes',
      date_paiement: new Date().toISOString().split('T')[0],
      banque: '',
      numero_compte: '',
      numero_cheque: '',
      description: '',
      devise: 'BIF',
      taux_change: '1'
    };
  }

  function getEmptyLigneForm() {
    return {
      type_produit: 'materiel_roulant',
      id_produit: null,
      designation: '',
      description: '',
      quantite_commandee: '1',
      unite: 'unité',
      prix_unitaire_ht: '0',
      remise_pourcent: '0',
      tva_pourcent: '16'
    };
  }

  // ============================================
  // DATA LOADING - DÉCLARÉ AVANT useEffect
  // ============================================
  const loadClients = async () => {
    const params = { ...clientsFilters };
    if (searchQuery) params.search = searchQuery;

    const response = await apiCall('/commercial/clients', 'GET', params);
    if (response.success) {
      setClients(response.data || []);
      setClientsPagination(response.pagination || { total: 0, pages: 0 });
    }
  };

  const loadFournisseurs = async () => {
    const params = {};
    if (searchQuery) params.search = searchQuery;

    const response = await apiCall('/commercial/fournisseurs', 'GET', params);
    if (response.success) {
      setFournisseurs(response.data || []);
    }
  };

  const loadCommandesVente = async () => {
    const params = {};
    if (searchQuery) params.search = searchQuery;

    const response = await apiCall('/commercial/commandes-vente', 'GET', params);
    if (response.success) {
      setCommandesVente(response.data || []);
    }
  };

  const loadCommandesAchat = async () => {
    const params = {};
    if (searchQuery) params.search = searchQuery;

    const response = await apiCall('/commercial/commandes-achat', 'GET', params);
    if (response.success) {
      setCommandesAchat(response.data || []);
    }
  };

  const loadFactures = async () => {
    const params = {};
    if (searchQuery) params.search = searchQuery;

    const response = await apiCall('/commercial/factures', 'GET', params);
    if (response.success) {
      setFactures(response.data || []);
    }
  };

  const loadPaiements = async () => {
    const response = await apiCall('/commercial/paiements', 'GET');
    if (response.success) {
      setPaiements(response.data || []);
    }
  };

  const loadStatistiques = async () => {
    const response = await apiCall('/commercial/statistiques', 'GET');
    if (response.success) {
      setStatistiques(response.data);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      switch (activeTab) {
        case 'clients':
          await loadClients();
          break;
        case 'fournisseurs':
          await loadFournisseurs();
          break;
        case 'commandes_vente':
          await loadCommandesVente();
          break;
        case 'commandes_achat':
          await loadCommandesAchat();
          break;
        case 'factures':
          await loadFactures();
          break;
        case 'paiements':
          await loadPaiements();
          break;
        case 'statistiques':
          await loadStatistiques();
          break;
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      setError(error.message || 'Erreur de chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, clientsFilters, searchQuery]);

  const handleSearch = () => {
    loadData();
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ============================================
  // useEffect - MAINTENANT APRÈS loadData
  // ============================================
  useEffect(() => {
    loadData();
  }, [activeTab, clientsFilters]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        loadData();
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // ============================================
  // CLIENT ACTIONS
  // ============================================
  const handleAddClient = () => {
    setClientMode('add');
    setClientForm(getEmptyClientForm());
    setSelectedClient(null);
    setClientModalVisible(true);
  };

  const handleEditClient = (client) => {
    setClientMode('edit');
    setSelectedClient(client);
    setClientForm({ ...client });
    setClientModalVisible(true);
  };

  const handleViewClient = async (client) => {
    try {
      setLoading(true);
      const response = await apiCall(`/commercial/clients/${client.id}`, 'GET');
      if (response.success) {
        setSelectedClient(response.data);
        setClientMode('view');
        setClientModalVisible(true);
      }
    } catch (error) {
      showError('Erreur lors du chargement du client');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClient = async () => {
    try {
      if (!clientForm.nom_client || !clientForm.telephone) {
        showError('Nom et téléphone requis');
        return;
      }

      setLoading(true);
      let response;

      if (clientMode === 'add') {
        response = await apiCall('/commercial/clients', 'POST', clientForm);
      } else {
        response = await apiCall(`/commercial/clients/${selectedClient.id}`, 'PUT', clientForm);
      }

      if (response.success) {
        showSuccess(clientMode === 'add' ? 'Client créé' : 'Client modifié');
        setClientModalVisible(false);
        loadClients();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = (client) => {
    Alert.alert(
      'Confirmation',
      `Supprimer le client ${client.nom_client} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await apiCall(`/commercial/clients/${client.id}`, 'DELETE');
              if (response.success) {
                showSuccess('Client supprimé');
                loadClients();
              }
            } catch (error) {
              showError(error.message || 'Impossible de supprimer le client');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // FOURNISSEUR ACTIONS
  // ============================================
  const handleAddFournisseur = () => {
    setFournisseurMode('add');
    setFournisseurForm(getEmptyFournisseurForm());
    setSelectedFournisseur(null);
    setFournisseurModalVisible(true);
  };

  const handleEditFournisseur = (fournisseur) => {
    setFournisseurMode('edit');
    setSelectedFournisseur(fournisseur);
    setFournisseurForm({ ...fournisseur });
    setFournisseurModalVisible(true);
  };

  const handleSaveFournisseur = async () => {
    try {
      if (!fournisseurForm.nom_fournisseur || !fournisseurForm.telephone) {
        showError('Nom et téléphone requis');
        return;
      }

      setLoading(true);
      let response;

      if (fournisseurMode === 'add') {
        response = await apiCall('/commercial/fournisseurs', 'POST', fournisseurForm);
      } else {
        response = await apiCall(`/commercial/fournisseurs/${selectedFournisseur.id}`, 'PUT', fournisseurForm);
      }

      if (response.success) {
        showSuccess(fournisseurMode === 'add' ? 'Fournisseur créé' : 'Fournisseur modifié');
        setFournisseurModalVisible(false);
        loadFournisseurs();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // COMMANDE VENTE ACTIONS
  // ============================================
  const handleAddCommandeVente = () => {
    setCommandeVenteMode('add');
    setCommandeVenteForm(getEmptyCommandeVenteForm());
    setSelectedCommandeVente(null);
    setCommandeVenteModalVisible(true);
  };

  const handleEditCommandeVente = async (commande) => {
    try {
      setLoading(true);
      const response = await apiCall(`/commercial/commandes-vente/${commande.id}`, 'GET');
      if (response.success) {
        setCommandeVenteMode('edit');
        setSelectedCommandeVente(response.data);
        setCommandeVenteForm({
          ...response.data,
          lignes: response.data.lignes || []
        });
        setCommandeVenteModalVisible(true);
      }
    } catch (error) {
      showError('Erreur lors du chargement de la commande');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommandeVente = async () => {
    try {
      if (!commandeVenteForm.id_client || commandeVenteForm.lignes.length === 0) {
        showError('Client et produits requis');
        return;
      }

      setLoading(true);

      const dataToSend = {
        ...commandeVenteForm,
        date_commande: commandeVenteForm.date_commande ? new Date(commandeVenteForm.date_commande).toISOString().split('T')[0] : null,
        date_livraison_prevue: commandeVenteForm.date_livraison_prevue ? new Date(commandeVenteForm.date_livraison_prevue).toISOString().split('T')[0] : null,
      };

      const response = await apiCall('/commercial/commandes-vente', 'POST', dataToSend);

      if (response.success) {
        showSuccess('Commande créée');
        setCommandeVenteModalVisible(false);
        loadCommandesVente();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatutCommandeVente = async (commande, statut) => {
    try {
      setLoading(true);
      const response = await apiCall(`/commercial/commandes-vente/${commande.id}/statut`, 'PUT', { statut });
      if (response.success) {
        showSuccess('Statut mis à jour');
        loadCommandesVente();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // COMMANDE ACHAT ACTIONS
  // ============================================
  const handleAddCommandeAchat = () => {
    setCommandeAchatMode('add');
    setCommandeAchatForm(getEmptyCommandeAchatForm());
    setCommandeAchatModalVisible(true);
  };

  const handleSaveCommandeAchat = async () => {
    try {
      if (!commandeAchatForm.id_fournisseur || commandeAchatForm.lignes.length === 0) {
        showError('Fournisseur et articles requis');
        return;
      }

      setLoading(true);

      const dataToSend = {
        ...commandeAchatForm,
        date_commande: commandeAchatForm.date_commande ? new Date(commandeAchatForm.date_commande).toISOString().split('T')[0] : null,
        date_livraison_prevue: commandeAchatForm.date_livraison_prevue ? new Date(commandeAchatForm.date_livraison_prevue).toISOString().split('T')[0] : null,
      };

      const response = await apiCall('/commercial/commandes-achat', 'POST', dataToSend);

      if (response.success) {
        showSuccess('Commande créée');
        setCommandeAchatModalVisible(false);
        loadCommandesAchat();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LIGNE COMMANDE ACTIONS
  // ============================================
  const handleAddLigneCommande = (type) => {
    setLigneType(type);
    setLigneForm(getEmptyLigneForm());
    setLigneModalVisible(true);
  };

  const handleSaveLigneCommande = () => {
    if (!ligneForm.designation || !ligneForm.quantite_commandee || !ligneForm.prix_unitaire_ht) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const quantite = parseFloat(ligneForm.quantite_commandee);
    const prixUnitaire = parseFloat(ligneForm.prix_unitaire_ht);
    const remise = parseFloat(ligneForm.remise_pourcent || 0);
    const tva = parseFloat(ligneForm.tva_pourcent || 0);

    const montant_ht = quantite * prixUnitaire * (1 - remise / 100);
    const montant_tva = montant_ht * (tva / 100);
    const montant_ttc = montant_ht + montant_tva;

    const nouvelleLigne = {
      ...ligneForm,
      montant_ht: montant_ht.toFixed(2),
      montant_tva: montant_tva.toFixed(2),
      montant_ttc: montant_ttc.toFixed(2)
    };

    if (ligneType === 'vente') {
      setCommandeVenteForm({
        ...commandeVenteForm,
        lignes: [...commandeVenteForm.lignes, nouvelleLigne]
      });
    } else {
      setCommandeAchatForm({
        ...commandeAchatForm,
        lignes: [...commandeAchatForm.lignes, nouvelleLigne]
      });
    }

    setLigneModalVisible(false);
    setLigneForm(getEmptyLigneForm());
  };

  const handleRemoveLigneCommande = (index, type) => {
    if (type === 'vente') {
      const lignes = commandeVenteForm.lignes.filter((_, i) => i !== index);
      setCommandeVenteForm({ ...commandeVenteForm, lignes });
    } else {
      const lignes = commandeAchatForm.lignes.filter((_, i) => i !== index);
      setCommandeAchatForm({ ...commandeAchatForm, lignes });
    }
  };

  // ============================================
  // PAIEMENT ACTIONS
  // ============================================
  const handleAddPaiement = (facture = null) => {
    const form = getEmptyPaiementForm();
    if (facture) {
      form.id_facture = facture.id;
      form.montant = facture.montant_du.toString();
    }
    setPaiementForm(form);
    setPaiementModalVisible(true);
  };

  const handleSavePaiement = async () => {
    try {
      if (!paiementForm.montant || parseFloat(paiementForm.montant) <= 0) {
        showError('Montant invalide');
        return;
      }

      setLoading(true);
      const response = await apiCall('/commercial/paiements', 'POST', paiementForm);

      if (response.success) {
        showSuccess('Paiement enregistré');
        setPaiementModalVisible(false);
        loadPaiements();
        if (activeTab === 'factures') loadFactures();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de l\'enregistrement du paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleValiderPaiement = async (paiement) => {
    try {
      setLoading(true);
      const response = await apiCall(`/commercial/paiements/${paiement.id}/valider`, 'PUT');
      if (response.success) {
        showSuccess('Paiement validé');
        loadPaiements();
      }
    } catch (error) {
      showError(error.message || 'Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CALCUL FUNCTIONS
  // ============================================
  const calculerMontantHT = (lignes) => {
    return lignes.reduce((sum, ligne) => sum + parseFloat(ligne.montant_ht || 0), 0);
  };

  const calculerMontantTotal = (type) => {
    const form = type === 'vente' ? commandeVenteForm : commandeAchatForm;
    const lignes = form.lignes;

    const montantHT = calculerMontantHT(lignes);
    const tva = (montantHT * parseFloat(form.tva_pourcent || 0)) / 100;
    const fraisLivraison = parseFloat(form.frais_livraison || 0);
    const remise = parseFloat(form.remise || 0);

    return montantHT + tva + fraisLivraison - remise;
  };

  // ============================================
  // CHART DATA HELPER
  // ============================================
  const getMonthlySalesData = () => {
    // Initialize last 6 months
    const months = [];
    const data = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(d.toLocaleString('default', { month: 'short' }));

      // Calculate total for this month from commandesVente
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthlyTotal = commandesVente
        .filter(c => {
          const cDate = new Date(c.date_commande);
          return cDate >= monthStart && cDate <= monthEnd && c.statut !== 'annulee';
        })
        .reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0);

      data.push(monthlyTotal);
    }

    return {
      labels: months,
      datasets: [{ data: data }]
    };
  };

  // ============================================
  // DATE PICKER HANDLER
  // ============================================
  const openDatePicker = (field, initialValue = null) => {
    setDatePickerField(field);
    setDatePickerValue(initialValue instanceof Date ? initialValue : (initialValue ? new Date(initialValue) : new Date()));
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    const dateString = selectedDate.toISOString().split('T')[0];

    switch (datePickerField) {
      case 'date_commande':
        setCommandeVenteForm({ ...commandeVenteForm, date_commande: dateString });
        break;
      case 'date_livraison_prevue':
        setCommandeVenteForm({ ...commandeVenteForm, date_livraison_prevue: dateString });
        break;
      case 'date_commande_achat':
        setCommandeAchatForm({ ...commandeAchatForm, date_commande: dateString });
        break;
      case 'date_livraison_prevue_achat':
        setCommandeAchatForm({ ...commandeAchatForm, date_livraison_prevue: dateString });
        break;
      case 'date_paiement':
        setPaiementForm({ ...paiementForm, date_paiement: dateString });
        break;
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const showSuccess = (message) => {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Succès', message);
    }
  };

  const showError = (message) => {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Erreur', message);
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const getStatutColor = (statut) => {
    const colors = {
      actif: '#27AE60',
      inactif: '#E74C3C',
      suspendu: '#F39C12',
      brouillon: '#95A5A6',
      confirmee: '#3498DB',
      validee: '#3498DB',
      en_preparation: '#F39C12',
      livree_partielle: '#E67E22',
      livree_complete: '#27AE60',
      facturee: '#2E86C1',
      payee: '#27AE60',
      annulee: '#E74C3C',
      impayee: '#E74C3C',
      partiellement_payee: '#F39C12'
    };
    return colors[statut] || '#95A5A6';
  };

  const getStatutBadge = (statut) => {
    return (
      <Badge
        style={{
          backgroundColor: getStatutColor(statut) + '20',
          color: getStatutColor(statut)
        }}
      >
        {statut}
      </Badge>
    );
  };

  // ============================================
  // DETAIL ITEM COMPONENT
  // ============================================
  const DetailItem = ({ label, value }) => (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );

  // ============================================
  // RENDER CARDS - RESPONSIVE
  // ============================================
  const renderClientCard = ({ item }) => {
    const isCompact = responsive.isMobile;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isCompact ? styles.cardMobile : styles.cardDesktop
        ]}
        onPress={() => handleViewClient(item)}
      >
        <View style={styles.cardHeader}>
          <Avatar.Text
            size={isCompact ? 40 : 50}
            label={item.nom_client.substring(0, 2).toUpperCase()}
            style={{ backgroundColor: '#3498DB' }}
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.nom_client}
            </Text>
            <Text style={styles.cardSubtitle}>{item.type}</Text>
            <View style={styles.cardTags}>
              <Chip
                mode="flat"
                compact
                style={[styles.chip, { backgroundColor: getStatutColor(item.statut) + '20' }]}
                textStyle={[styles.chipText, { color: getStatutColor(item.statut) }]}
              >
                {item.statut}
              </Chip>
            </View>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <MaterialIcons name="phone" size={16} color="#7F8C8D" />
            <Text style={styles.cardText}>{item.telephone}</Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialIcons name="email" size={16} color="#7F8C8D" />
            <Text style={styles.cardText} numberOfLines={1}>
              {item.email || 'N/A'}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialIcons name="location-on" size={16} color="#7F8C8D" />
            <Text style={styles.cardText}>{item.ville || 'N/A'}</Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.cardFooter}>
          <View style={styles.cardStats}>
            <Text style={styles.statLabel}>Commandes:</Text>
            <Text style={styles.statValue}>{item.nombre_commandes || 0}</Text>
          </View>
          <View style={styles.cardStats}>
            <Text style={styles.statLabel}>Total:</Text>
            <Text style={[styles.statValue, { color: '#27AE60' }]}>
              {formatCurrency(item.total_achats)}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <IconButton
            icon="eye"
            size={20}
            iconColor="#3498DB"
            onPress={() => handleViewClient(item)}
          />
          <IconButton
            icon="pencil"
            size={20}
            iconColor="#F39C12"
            onPress={() => handleEditClient(item)}
          />
          <IconButton
            icon="delete"
            size={20}
            iconColor="#E74C3C"
            onPress={() => handleDeleteClient(item)}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderFournisseurCard = ({ item }) => {
    const isCompact = responsive.isMobile;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isCompact ? styles.cardMobile : styles.cardDesktop
        ]}
        onPress={() => handleEditFournisseur(item)}
      >
        <View style={styles.cardHeader}>
          <Avatar.Text
            size={isCompact ? 40 : 50}
            label={item.nom_fournisseur.substring(0, 2).toUpperCase()}
            style={{ backgroundColor: '#E67E22' }}
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.nom_fournisseur}
            </Text>
            <Text style={styles.cardSubtitle}>{item.type}</Text>
            <View style={styles.cardTags}>
              <Chip
                mode="flat"
                compact
                style={styles.chip}
                textStyle={styles.chipText}
              >
                ⭐ {item.note_evaluation || 5}/5
              </Chip>
            </View>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <MaterialIcons name="phone" size={16} color="#7F8C8D" />
            <Text style={styles.cardText}>{item.telephone}</Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialIcons name="email" size={16} color="#7F8C8D" />
            <Text style={styles.cardText} numberOfLines={1}>
              {item.email || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <IconButton
            icon="pencil"
            size={20}
            iconColor="#F39C12"
            onPress={() => handleEditFournisseur(item)}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommandeVenteCard = ({ item }) => {
    return (
      <Card style={styles.commandeCard}>
        <Card.Content>
          <View style={styles.commandeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commandeNumero}>{item.numero_commande}</Text>
              <Text style={styles.commandeClient}>{item.nom_client}</Text>
              <Text style={styles.commandeDate}>{formatDate(item.date_commande)}</Text>
            </View>
            <View style={styles.commandeRight}>
              <Text style={styles.commandeMontant}>{formatCurrency(item.montant_total)}</Text>
              {getStatutBadge(item.statut)}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.commandeDetails}>
            <Text style={styles.detailText}>
              Produits: {item.nombre_lignes || 0}
            </Text>
            <Text style={styles.detailText}>
              Paiement: {item.mode_paiement}
            </Text>
          </View>

          <View style={styles.commandeActions}>
            {item.statut === 'brouillon' && (
              <Button
                mode="contained"
                onPress={() => handleUpdateStatutCommandeVente(item, 'confirmee')}
                buttonColor="#27AE60"
                compact
              >
                Confirmer
              </Button>
            )}
            <IconButton
              icon="eye"
              size={20}
              iconColor="#3498DB"
              onPress={() => handleEditCommandeVente(item)}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderFactureCard = ({ item }) => {
    return (
      <Card style={styles.commandeCard}>
        <Card.Content>
          <View style={styles.commandeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commandeNumero}>{item.numero_facture}</Text>
              <Text style={styles.commandeClient}>{item.tiers_nom}</Text>
              <Text style={styles.commandeDate}>
                Échéance: {formatDate(item.date_echeance)}
              </Text>
            </View>
            <View style={styles.commandeRight}>
              <Text style={styles.commandeMontant}>{formatCurrency(item.montant_ttc)}</Text>
              {getStatutBadge(item.statut_paiement)}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.commandeDetails}>
            <Text style={styles.detailText}>
              Payé: {formatCurrency(item.montant_regle)}
            </Text>
            <Text style={[styles.detailText, { color: '#E74C3C', fontWeight: 'bold' }]}>
              Dû: {formatCurrency(item.montant_du)}
            </Text>
          </View>

          {item.statut_paiement !== 'payee' && (
            <Button
              mode="contained"
              onPress={() => handleAddPaiement(item)}
              buttonColor="#27AE60"
              style={{ marginTop: 10 }}
              compact
            >
              Enregistrer Paiement
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPaiementCard = ({ item }) => {
    return (
      <Card style={styles.commandeCard}>
        <Card.Content>
          <View style={styles.commandeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commandeNumero}>{item.reference_paiement}</Text>
              <Text style={styles.commandeDate}>{formatDate(item.date_paiement)}</Text>
              <Text style={styles.detailText}>
                Mode: {item.mode_paiement}
              </Text>
            </View>
            <View style={styles.commandeRight}>
              <Text style={styles.commandeMontant}>{formatCurrency(item.montant)}</Text>
              {getStatutBadge(item.statut)}
            </View>
          </View>

          {item.statut === 'en_attente' && (
            <Button
              mode="contained"
              onPress={() => handleValiderPaiement(item)}
              buttonColor="#27AE60"
              style={{ marginTop: 10 }}
              compact
            >
              Valider
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  // ============================================
  // RENDER LIGNE MODAL
  // ============================================
  const renderLigneModal = () => (
    <Portal>
      <Modal
        visible={ligneModalVisible}
        onDismiss={() => setLigneModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <View style={styles.modalHeader}>
          <Title style={styles.modalTitle}>Ajouter un Article</Title>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setLigneModalVisible(false)}
          />
        </View>

        <ScrollView style={styles.modalContent}>
          <TextInput
            label="Désignation *"
            value={ligneForm.designation}
            onChangeText={(text) =>
              setLigneForm({ ...ligneForm, designation: text })
            }
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Description"
            value={ligneForm.description}
            onChangeText={(text) =>
              setLigneForm({ ...ligneForm, description: text })
            }
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={2}
          />

          <View style={styles.formRow}>
            <TextInput
              label="Quantité *"
              value={ligneForm.quantite_commandee}
              onChangeText={(text) =>
                setLigneForm({ ...ligneForm, quantite_commandee: text })
              }
              style={[styles.input, styles.inputHalf]}
              mode="outlined"
              keyboardType="decimal-pad"
            />

            <TextInput
              label="Unité"
              value={ligneForm.unite}
              onChangeText={(text) =>
                setLigneForm({ ...ligneForm, unite: text })
              }
              style={[styles.input, styles.inputHalf]}
              mode="outlined"
            />
          </View>

          <View style={styles.formRow}>
            <TextInput
              label="Prix Unitaire HT *"
              value={ligneForm.prix_unitaire_ht}
              onChangeText={(text) =>
                setLigneForm({ ...ligneForm, prix_unitaire_ht: text })
              }
              style={[styles.input, styles.inputHalf]}
              mode="outlined"
              keyboardType="decimal-pad"
            />

            <TextInput
              label="Remise (%)"
              value={ligneForm.remise_pourcent}
              onChangeText={(text) =>
                setLigneForm({ ...ligneForm, remise_pourcent: text })
              }
              style={[styles.input, styles.inputHalf]}
              mode="outlined"
              keyboardType="decimal-pad"
            />
          </View>

          <TextInput
            label="TVA (%)"
            value={ligneForm.tva_pourcent}
            onChangeText={(text) =>
              setLigneForm({ ...ligneForm, tva_pourcent: text })
            }
            style={styles.input}
            mode="outlined"
            keyboardType="decimal-pad"
          />

          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={handleSaveLigneCommande}
              buttonColor="#27AE60"
              style={styles.modalButton}
            >
              Ajouter
            </Button>
            <Button
              mode="outlined"
              onPress={() => setLigneModalVisible(false)}
              style={styles.modalButton}
            >
              Annuler
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ============================================
  // RENDER TAB CONTENT
  // ============================================
  const renderTabContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E86C1" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#E74C3C" />
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={loadData} buttonColor="#2E86C1">
            Réessayer
          </Button>
        </View>
      );
    }

    switch (activeTab) {
      case 'clients':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher un client..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.statsScroll}
              contentContainerStyle={styles.statsContainer}
            >
              <Card style={styles.statCard}>
                <Card.Content>
                  <Text style={styles.statCardValue}>{clients.length}</Text>
                  <Text style={styles.statCardLabel}>Total Clients</Text>
                </Card.Content>
              </Card>
              <Card style={styles.statCard}>
                <Card.Content>
                  <Text style={styles.statCardValue}>
                    {clients.filter(c => c.statut === 'actif').length}
                  </Text>
                  <Text style={styles.statCardLabel}>Actifs</Text>
                </Card.Content>
              </Card>
              <Card style={styles.statCard}>
                <Card.Content>
                  <Text style={styles.statCardValue}>
                    {formatCurrency(
                      clients.reduce((sum, c) => sum + parseFloat(c.total_achats || 0), 0)
                    )}
                  </Text>
                  <Text style={styles.statCardLabel}>CA Total</Text>
                </Card.Content>
              </Card>
            </ScrollView>

            {responsive.isDesktop ? (
              <ScrollView
                contentContainerStyle={[
                  styles.gridContainer,
                  { padding: 20 }
                ]}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              >
                <View style={styles.gridRow}>
                  {clients.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.gridItem,
                        { width: responsive.cardWidth(responsive.getColumns()) }
                      ]}
                    >
                      {renderClientCard({ item })}
                    </View>
                  ))}
                </View>
                {clients.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="people-outline" size={80} color="#BDC3C7" />
                    <Text style={styles.emptyText}>Aucun client</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <FlatList
                data={clients}
                renderItem={renderClientCard}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="people-outline" size={80} color="#BDC3C7" />
                    <Text style={styles.emptyText}>Aucun client</Text>
                  </View>
                }
              />
            )}

            {clientsPagination.pages > 1 && (
              <View style={styles.pagination}>
                <Button
                  mode="outlined"
                  disabled={clientsFilters.offset === 0}
                  onPress={() =>
                    setClientsFilters({
                      ...clientsFilters,
                      offset: Math.max(0, clientsFilters.offset - clientsFilters.limit)
                    })
                  }
                >
                  Précédent
                </Button>
                <Text style={styles.paginationText}>
                  Page {Math.floor(clientsFilters.offset / clientsFilters.limit) + 1} /{' '}
                  {clientsPagination.pages}
                </Text>
                <Button
                  mode="outlined"
                  disabled={clientsFilters.offset + clientsFilters.limit >= clientsPagination.total}
                  onPress={() =>
                    setClientsFilters({
                      ...clientsFilters,
                      offset: clientsFilters.offset + clientsFilters.limit
                    })
                  }
                >
                  Suivant
                </Button>
              </View>
            )}
          </View>
        );

      case 'fournisseurs':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher un fournisseur..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            {responsive.isDesktop ? (
              <ScrollView
                contentContainerStyle={[
                  styles.gridContainer,
                  { padding: 20 }
                ]}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              >
                <View style={styles.gridRow}>
                  {fournisseurs.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.gridItem,
                        { width: responsive.cardWidth(responsive.getColumns()) }
                      ]}
                    >
                      {renderFournisseurCard({ item })}
                    </View>
                  ))}
                </View>
                {fournisseurs.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="store" size={80} color="#BDC3C7" />
                    <Text style={styles.emptyText}>Aucun fournisseur</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <FlatList
                data={fournisseurs}
                renderItem={renderFournisseurCard}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="store" size={80} color="#BDC3C7" />
                    <Text style={styles.emptyText}>Aucun fournisseur</Text>
                  </View>
                }
              />
            )}
          </View>
        );

      case 'commandes_vente':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher une commande..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={commandesVente}
              renderItem={renderCommandeVenteCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="shopping-cart" size={80} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucune commande</Text>
                </View>
              }
            />
          </View>
        );

      case 'commandes_achat':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher un bon de commande..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={commandesAchat}
              renderItem={({ item }) => renderCommandeVenteCard({ item })}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="shopping-bag" size={80} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucun bon de commande</Text>
                </View>
              }
            />
          </View>
        );

      case 'factures':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher une facture..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={factures}
              renderItem={renderFactureCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="receipt" size={80} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucune facture</Text>
                </View>
              }
            />
          </View>
        );

      case 'paiements':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Rechercher un paiement..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={paiements}
              renderItem={renderPaiementCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="payment" size={80} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucun paiement</Text>
                </View>
              }
            />
          </View>
        );

      case 'dashboard':
        return renderDashboard();

      case 'statistiques': // Fallback for old route params
        return renderDashboard();

      default:
        return null;
    }
  };

  const renderDashboard = () => {
    const chartConfig = {
      backgroundGradientFrom: "#ffffff",
      backgroundGradientTo: "#ffffff",
      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for Money In
      strokeWidth: 2,
      barPercentage: 0.5,
      useShadowColorFromDataset: false,
      decimalPlaces: 0,
    };

    const monthlyData = getMonthlySalesData();
    const screenWidth = responsive.isDesktop
      ? responsive.width - 340 // Subtract sidebar/padding roughly
      : responsive.width - 30;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header Stats Cards */}
        <View style={styles.dashboardHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {/* Ventes Totales */}
            <Card style={styles.dashboardCard}>
              <Card.Content style={styles.dashboardCardContent}>
                <View>
                  <Text style={styles.dashboardCardValue}>
                    {formatCurrency(statistiques?.ventes?.total_ventes || 0)}
                  </Text>
                  <Text style={styles.dashboardCardLabel}>Ventes totales</Text>
                </View>
                <View style={[styles.dashboardIconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialIcons name="trending-up" size={24} color="#10B981" />
                </View>
              </Card.Content>
            </Card>

            {/* Total Achats */}
            <Card style={styles.dashboardCard}>
              <Card.Content style={styles.dashboardCardContent}>
                <View>
                  <Text style={[styles.dashboardCardValue, { color: '#2C3E50' }]}>
                    {formatCurrency(statistiques?.achats?.total_achats || 0)}
                  </Text>
                  <Text style={styles.dashboardCardLabel}>Total Achats</Text>
                </View>
                <View style={[styles.dashboardIconContainer, { backgroundColor: '#FDEDEC' }]}>
                  <MaterialIcons name="shopping-bag" size={24} color="#E74C3C" />
                </View>
              </Card.Content>
            </Card>

            {/* Factures Impayées */}
            <Card style={styles.dashboardCard}>
              <Card.Content style={styles.dashboardCardContent}>
                <View>
                  <Text style={[styles.dashboardCardValue, { color: '#E74C3C' }]}>
                    {formatCurrency(statistiques?.factures_impayees?.montant_total || 0)}
                  </Text>
                  <Text style={styles.dashboardCardLabel}>Factures impayées</Text>
                </View>
                <View style={[styles.dashboardIconContainer, { backgroundColor: '#FDEDEC' }]}>
                  <MaterialIcons name="warning" size={24} color="#E74C3C" />
                </View>
              </Card.Content>
            </Card>

            {/* Fournisseurs */}
            <Card style={styles.dashboardCard}>
              <Card.Content style={styles.dashboardCardContent}>
                <View>
                  <Text style={styles.dashboardCardValue}>
                    {fournisseurs.length} <Text style={{ fontSize: 14, fontWeight: 'normal' }}>{fournisseurs.length === 1 ? 'partenaire' : 'partenaires'}</Text>
                  </Text>
                  <Text style={styles.dashboardCardLabel}>Fournisseurs</Text>
                </View>
                <View style={[styles.dashboardIconContainer, { backgroundColor: '#EAFAF1' }]}>
                  <MaterialIcons name="store" size={24} color="#27AE60" />
                </View>
              </Card.Content>
            </Card>

            {/* Factures en Retard */}
            <Card style={styles.dashboardCard}>
              <Card.Content style={styles.dashboardCardContent}>
                <View>
                  <Text style={[styles.dashboardCardValue, { color: '#C0392B' }]}>
                    {formatCurrency(statistiques?.factures_impayees?.montant_retard || 0)}
                  </Text>
                  <Text style={styles.dashboardCardLabel}>Factures en retard</Text>
                </View>
                <View style={[styles.dashboardIconContainer, { backgroundColor: '#FDEDEC' }]}>
                  <MaterialIcons name="timer-off" size={24} color="#C0392B" />
                </View>
              </Card.Content>
            </Card>
          </ScrollView>
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Évolution mensuelle des ventes</Text>
          <Card style={styles.chartCard}>
            <Card.Content>
              <LineChart
                data={monthlyData}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
              />
            </Card.Content>
          </Card>
        </View>

        {/* Bottom Section: Top Clients & Unpaid Invoices */}
        <View style={[
          styles.bottomSection,
          responsive.isDesktop && styles.bottomSectionDesktop
        ]}>

          {/* Top 5 Clients */}
          <View style={styles.bottomColumn}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top 5 Clients</Text>
            </View>
            <Card style={styles.tableCard}>
              <Card.Content>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Client</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>Commandes</Text>
                  <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>Montant</Text>
                </View>
                <Divider />

                {/* Table Body */}
                {statistiques?.top_clients?.slice(0, 5).map((client, index) => (
                  <View key={index}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 2, fontWeight: '500' }]}>{client.nom_client}</Text>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{client.nombre_commandes}</Text>
                      <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>
                        {formatCurrency(client.total_achats)}
                      </Text>
                    </View>
                    {index < 4 && <Divider />}
                  </View>
                )) || (
                    <Text style={{ padding: 20, textAlign: 'center', color: '#999' }}>Aucune donnée</Text>
                  )}
              </Card.Content>
            </Card>
          </View>

          {/* Factures Impayées Table */}
          <View style={styles.bottomColumn}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Factures impayées</Text>
            </View>
            <Card style={styles.tableCard}>
              <Card.Content>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>Facture</Text>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>Échéance</Text>
                  <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>Montant</Text>
                </View>
                <Divider />

                {/* Table Body - Using actual factures list */}
                {factures
                  .filter(f => f.statut_paiement !== 'payee')
                  .slice(0, 5)
                  .map((facture, index) => (
                    <View key={index}>
                      <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>{facture.numero_facture}</Text>
                        <Text style={[styles.tableCell, { flex: 1.5 }]}>{formatDate(facture.date_echeance)}</Text>
                        <View style={{ flex: 2, alignItems: 'flex-end' }}>
                          <Text style={{ fontWeight: 'bold', color: '#2C3E50' }}>{formatCurrency(facture.montant_du)}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <View style={{
                              width: 8, height: 8, borderRadius: 4,
                              backgroundColor: getStatutColor(facture.statut_paiement),
                              marginRight: 4
                            }} />
                            <Text style={{ fontSize: 10, color: '#7F8C8D' }}>
                              {facture.statut_paiement.replace('_', ' ')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {index < 4 && <Divider />}
                    </View>
                  )) || (
                    <Text style={{ padding: 20, textAlign: 'center', color: '#999' }}>Aucune facture impayée</Text>
                  )}
              </Card.Content>
            </Card>
          </View>

        </View>
      </ScrollView>
    );
  };

  // ============================================
  // RENDER MODALS
  // ============================================
  const renderClientModal = () => (
    <Portal>
      <Modal
        visible={clientModalVisible}
        onDismiss={() => setClientModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title style={styles.modalTitle}>
              {clientMode === 'add'
                ? 'Nouveau Client'
                : clientMode === 'edit'
                  ? 'Modifier Client'
                  : 'Détails Client'}
            </Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setClientModalVisible(false)}
            />
          </View>

          {clientMode === 'view' && selectedClient ? (
            <View style={styles.modalContent}>
              <View style={[
                styles.detailsGrid,
                responsive.isDesktop && styles.detailsGridDesktop
              ]}>
                <DetailItem label="Nom" value={selectedClient.nom_client} />
                <DetailItem label="Type" value={selectedClient.type} />
                <DetailItem label="Téléphone" value={selectedClient.telephone} />
                <DetailItem label="Email" value={selectedClient.email} />
                <DetailItem label="Adresse" value={selectedClient.adresse} />
                <DetailItem label="Ville" value={selectedClient.ville} />
                <DetailItem label="Pays" value={selectedClient.pays} />
                <DetailItem
                  label="Crédit Limite"
                  value={formatCurrency(selectedClient.limite_credit)}
                />
                <DetailItem
                  label="Dette Actuelle"
                  value={formatCurrency(selectedClient.dette_actuelle)}
                />
                <DetailItem
                  label="Total Achats"
                  value={formatCurrency(selectedClient.total_achats)}
                />
                <DetailItem
                  label="Nombre Commandes"
                  value={selectedClient.nombre_commandes}
                />
                <DetailItem
                  label="Dernière Commande"
                  value={formatDate(selectedClient.derniere_commande)}
                />
              </View>

              <Divider style={styles.divider} />

              {selectedClient.dernières_commandes && selectedClient.dernières_commandes.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Dernières Commandes</Text>
                  {selectedClient.dernières_commandes.map((commande) => (
                    <Card key={commande.id} style={styles.miniCard}>
                      <Card.Content>
                        <View style={styles.miniCardRow}>
                          <Text style={styles.miniCardText}>{commande.numero_commande}</Text>
                          <Text style={styles.miniCardAmount}>
                            {formatCurrency(commande.montant_total)}
                          </Text>
                        </View>
                        <Text style={styles.miniCardDate}>
                          {formatDate(commande.date_commande)} • {getStatutBadge(commande.statut)}
                        </Text>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}

              {selectedClient.factures_impayees && selectedClient.factures_impayees.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Factures Impayées</Text>
                  {selectedClient.factures_impayees.map((facture) => (
                    <Card key={facture.id} style={[styles.miniCard, { borderLeftColor: '#E74C3C', borderLeftWidth: 3 }]}>
                      <Card.Content>
                        <View style={styles.miniCardRow}>
                          <Text style={styles.miniCardText}>{facture.numero_facture}</Text>
                          <Text style={[styles.miniCardAmount, { color: '#E74C3C' }]}>
                            {formatCurrency(facture.montant_du)}
                          </Text>
                        </View>
                        <Text style={styles.miniCardDate}>
                          Échéance: {formatDate(facture.date_echeance)}
                        </Text>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={() => setClientMode('edit')}
                  buttonColor="#F39C12"
                  style={styles.modalButton}
                >
                  Modifier
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setClientModalVisible(false)}
                  style={styles.modalButton}
                >
                  Fermer
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.modalContent}>
              <TextInput
                label="Nom du client *"
                value={clientForm.nom_client}
                onChangeText={(text) =>
                  setClientForm({ ...clientForm, nom_client: text })
                }
                style={styles.input}
                mode="outlined"
              />

              <SegmentedButtons
                value={clientForm.type}
                onValueChange={(value) =>
                  setClientForm({ ...clientForm, type: value })
                }
                buttons={[
                  { value: 'particulier', label: 'Particulier' },
                  { value: 'entreprise', label: 'Entreprise' }
                ]}
                style={styles.segmentedButtons}
              />

              <TextInput
                label="Contact Principal"
                value={clientForm.contact_principal}
                onChangeText={(text) =>
                  setClientForm({ ...clientForm, contact_principal: text })
                }
                style={styles.input}
                mode="outlined"
              />

              <TextInput
                label="Téléphone *"
                value={clientForm.telephone}
                onChangeText={(text) =>
                  setClientForm({ ...clientForm, telephone: text })
                }
                style={styles.input}
                mode="outlined"
                keyboardType="phone-pad"
              />

              <TextInput
                label="Email"
                value={clientForm.email}
                onChangeText={(text) =>
                  setClientForm({ ...clientForm, email: text })
                }
                style={styles.input}
                mode="outlined"
                keyboardType="email-address"
              />

              <TextInput
                label="Adresse"
                value={clientForm.adresse}
                onChangeText={(text) =>
                  setClientForm({ ...clientForm, adresse: text })
                }
                style={styles.input}
                mode="outlined"
                multiline
                numberOfLines={2}
              />

              <View style={styles.formRow}>
                <TextInput
                  label="Ville"
                  value={clientForm.ville}
                  onChangeText={(text) =>
                    setClientForm({ ...clientForm, ville: text })
                  }
                  style={[styles.input, styles.inputHalf]}
                  mode="outlined"
                />

                <TextInput
                  label="Pays"
                  value={clientForm.pays}
                  onChangeText={(text) =>
                    setClientForm({ ...clientForm, pays: text })
                  }
                  style={[styles.input, styles.inputHalf]}
                  mode="outlined"
                />
              </View>

              <View style={styles.formRow}>
                <TextInput
                  label="Limite de Crédit ($)"
                  value={clientForm.limite_credit}
                  onChangeText={(text) =>
                    setClientForm({ ...clientForm, limite_credit: text })
                  }
                  style={[styles.input, styles.inputHalf]}
                  mode="outlined"
                  keyboardType="decimal-pad"
                />

                <TextInput
                  label="Délai Paiement (jours)"
                  value={clientForm.delai_paiement_jours}
                  onChangeText={(text) =>
                    setClientForm({ ...clientForm, delai_paiement_jours: text })
                  }
                  style={[styles.input, styles.inputHalf]}
                  mode="outlined"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="contained"
                  onPress={handleSaveClient}
                  buttonColor="#27AE60"
                  style={styles.modalButton}
                  loading={loading}
                  disabled={loading}
                >
                  {clientMode === 'add' ? 'Créer' : 'Enregistrer'}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setClientModalVisible(false)}
                  style={styles.modalButton}
                  disabled={loading}
                >
                  Annuler
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderFournisseurModal = () => (
    <Portal>
      <Modal
        visible={fournisseurModalVisible}
        onDismiss={() => setFournisseurModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title style={styles.modalTitle}>
              {fournisseurMode === 'add' ? 'Nouveau Fournisseur' : 'Modifier Fournisseur'}
            </Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setFournisseurModalVisible(false)}
            />
          </View>

          <View style={styles.modalContent}>
            <TextInput
              label="Nom du fournisseur *"
              value={fournisseurForm.nom_fournisseur}
              onChangeText={(text) =>
                setFournisseurForm({ ...fournisseurForm, nom_fournisseur: text })
              }
              style={styles.input}
              mode="outlined"
            />

            <SegmentedButtons
              value={fournisseurForm.type}
              onValueChange={(value) =>
                setFournisseurForm({ ...fournisseurForm, type: value })
              }
              buttons={[
                { value: 'general', label: 'Général' },
                { value: 'specialise', label: 'Spécialisé' }
              ]}
              style={styles.segmentedButtons}
            />

            <TextInput
              label="Contact Principal"
              value={fournisseurForm.contact_principal}
              onChangeText={(text) =>
                setFournisseurForm({ ...fournisseurForm, contact_principal: text })
              }
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Téléphone *"
              value={fournisseurForm.telephone}
              onChangeText={(text) =>
                setFournisseurForm({ ...fournisseurForm, telephone: text })
              }
              style={styles.input}
              mode="outlined"
              keyboardType="phone-pad"
            />

            <TextInput
              label="Email"
              value={fournisseurForm.email}
              onChangeText={(text) =>
                setFournisseurForm({ ...fournisseurForm, email: text })
              }
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
            />

            <TextInput
              label="Adresse"
              value={fournisseurForm.adresse}
              onChangeText={(text) =>
                setFournisseurForm({ ...fournisseurForm, adresse: text })
              }
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleSaveFournisseur}
                buttonColor="#27AE60"
                style={styles.modalButton}
                loading={loading}
                disabled={loading}
              >
                {fournisseurMode === 'add' ? 'Créer' : 'Enregistrer'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => setFournisseurModalVisible(false)}
                style={styles.modalButton}
                disabled={loading}
              >
                Annuler
              </Button>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderPaiementModal = () => (
    <Portal>
      <Modal
        visible={paiementModalVisible}
        onDismiss={() => setPaiementModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <View style={styles.modalHeader}>
          <Title style={styles.modalTitle}>Enregistrer un Paiement</Title>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setPaiementModalVisible(false)}
          />
        </View>

        <ScrollView style={styles.modalContent}>
          <TextInput
            label="Montant *"
            value={paiementForm.montant}
            onChangeText={(text) =>
              setPaiementForm({ ...paiementForm, montant: text })
            }
            style={styles.input}
            mode="outlined"
            keyboardType="decimal-pad"
          />

          <SegmentedButtons
            value={paiementForm.mode_paiement}
            onValueChange={(value) =>
              setPaiementForm({ ...paiementForm, mode_paiement: value })
            }
            buttons={[
              { value: 'especes', label: 'Espèces' },
              { value: 'banque', label: 'Banque' },
              { value: 'mobile', label: 'Mobile Money' }
            ]}
            style={styles.segmentedButtons}
          />

          {paiementForm.mode_paiement === 'banque' && (
            <>
              <TextInput
                label="Banque"
                value={paiementForm.banque}
                onChangeText={(text) =>
                  setPaiementForm({ ...paiementForm, banque: text })
                }
                style={styles.input}
                mode="outlined"
              />

              <TextInput
                label="Numéro de Compte"
                value={paiementForm.numero_compte}
                onChangeText={(text) =>
                  setPaiementForm({ ...paiementForm, numero_compte: text })
                }
                style={styles.input}
                mode="outlined"
              />

              <TextInput
                label="Numéro de Chèque"
                value={paiementForm.numero_cheque}
                onChangeText={(text) =>
                  setPaiementForm({ ...paiementForm, numero_cheque: text })
                }
                style={styles.input}
                mode="outlined"
              />
            </>
          )}

          <TextInput
            label="Description"
            value={paiementForm.description}
            onChangeText={(text) =>
              setPaiementForm({ ...paiementForm, description: text })
            }
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={handleSavePaiement}
              buttonColor="#27AE60"
              style={styles.modalButton}
              loading={loading}
              disabled={loading}
            >
              Enregistrer
            </Button>
            <Button
              mode="outlined"
              onPress={() => setPaiementModalVisible(false)}
              style={styles.modalButton}
              disabled={loading}
            >
              Annuler
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderCommandeVenteModal = () => (
    <Portal>
      <Modal
        visible={commandeVenteModalVisible}
        onDismiss={() => setCommandeVenteModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          styles.modalLarge,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title style={styles.modalTitle}>
              {commandeVenteMode === 'add' ? 'Nouvelle Commande Vente' : 'Modifier Commande'}
            </Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setCommandeVenteModalVisible(false)}
            />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Client *</Text>
            <Menu
              visible={clientMenuVisible}
              onDismiss={() => setClientMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setClientMenuVisible(true)}
                >
                  <Text style={styles.selectInputText}>
                    {commandeVenteForm.id_client
                      ? clients.find((c) => c.id === commandeVenteForm.id_client)?.nom_client
                      : 'Sélectionner un client'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={24} color="#7F8C8D" />
                </TouchableOpacity>
              }
            >
              <ScrollView style={styles.menuScroll}>
                {clients.map((client) => (
                  <Menu.Item
                    key={client.id}
                    onPress={() => {
                      setCommandeVenteForm({
                        ...commandeVenteForm,
                        id_client: client.id
                      });
                      setClientMenuVisible(false);
                    }}
                    title={`${client.nom_client} - ${client.telephone}`}
                  />
                ))}
              </ScrollView>
            </Menu>

            <View style={styles.formRow}>
              <TouchableOpacity
                style={[styles.input, styles.inputHalf]}
                onPress={() => openDatePicker('date_commande', commandeVenteForm.date_commande)}
              >
                <Text style={styles.inputLabel}>Date Commande</Text>
                <Text style={styles.inputValue}>
                  {formatDate(commandeVenteForm.date_commande)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.input, styles.inputHalf]}
                onPress={() => openDatePicker('date_livraison_prevue', commandeVenteForm.date_livraison_prevue)}
              >
                <Text style={styles.inputLabel}>Livraison Prévue</Text>
                <Text style={styles.inputValue}>
                  {commandeVenteForm.date_livraison_prevue
                    ? formatDate(commandeVenteForm.date_livraison_prevue)
                    : 'Non définie'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              label="Lieu de Livraison"
              value={commandeVenteForm.lieu_livraison}
              onChangeText={(text) =>
                setCommandeVenteForm({ ...commandeVenteForm, lieu_livraison: text })
              }
              style={styles.input}
              mode="outlined"
            />

            <Divider style={styles.divider} />

            <View style={styles.produitsSection}>
              <View style={styles.produitsSectionHeader}>
                <Text style={styles.sectionTitle}>Produits ({commandeVenteForm.lignes.length})</Text>
                <Button
                  mode="contained"
                  icon="plus"
                  onPress={() => handleAddLigneCommande('vente')}
                  compact
                  buttonColor="#27AE60"
                >
                  Ajouter
                </Button>
              </View>

              {commandeVenteForm.lignes.length === 0 ? (
                <View style={styles.emptyLignes}>
                  <MaterialIcons name="shopping-cart" size={40} color="#BDC3C7" />
                  <Text style={styles.emptyLignesText}>Aucun produit ajouté</Text>
                </View>
              ) : (
                <View style={styles.lignesList}>
                  {commandeVenteForm.lignes.map((ligne, index) => (
                    <Card key={index} style={styles.ligneCard}>
                      <Card.Content>
                        <View style={styles.ligneHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ligneDesignation}>{ligne.designation}</Text>
                            {ligne.description && (
                              <Text style={styles.ligneDescription}>{ligne.description}</Text>
                            )}
                          </View>
                          <IconButton
                            icon="delete"
                            size={20}
                            iconColor="#E74C3C"
                            onPress={() => handleRemoveLigneCommande(index, 'vente')}
                          />
                        </View>

                        <View style={styles.ligneDetails}>
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Quantité:</Text>
                            <Text style={styles.ligneDetailValue}>
                              {ligne.quantite_commandee} {ligne.unite}
                            </Text>
                          </View>
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Prix Unit.:</Text>
                            <Text style={styles.ligneDetailValue}>
                              {formatCurrency(ligne.prix_unitaire_ht)}
                            </Text>
                          </View>
                          {ligne.remise_pourcent > 0 && (
                            <View style={styles.ligneDetailItem}>
                              <Text style={styles.ligneDetailLabel}>Remise:</Text>
                              <Text style={styles.ligneDetailValue}>
                                {ligne.remise_pourcent}%
                              </Text>
                            </View>
                          )}
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Total:</Text>
                            <Text style={[styles.ligneDetailValue, styles.ligneTotal]}>
                              {formatCurrency(ligne.montant_ttc)}
                            </Text>
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.totauxSection}>
              <View style={styles.formRow}>
                <TextInput
                  label="TVA (%)"
                  value={commandeVenteForm.tva_pourcent}
                  onChangeText={(text) =>
                    setCommandeVenteForm({ ...commandeVenteForm, tva_pourcent: text })
                  }
                  style={[styles.input, styles.inputThird]}
                  mode="outlined"
                  keyboardType="decimal-pad"
                />

                <TextInput
                  label="Frais Livraison ($)"
                  value={commandeVenteForm.frais_livraison}
                  onChangeText={(text) =>
                    setCommandeVenteForm({ ...commandeVenteForm, frais_livraison: text })
                  }
                  style={[styles.input, styles.inputThird]}
                  mode="outlined"
                  keyboardType="decimal-pad"
                />

                <TextInput
                  label="Remise ($)"
                  value={commandeVenteForm.remise}
                  onChangeText={(text) =>
                    setCommandeVenteForm({ ...commandeVenteForm, remise: text })
                  }
                  style={[styles.input, styles.inputThird]}
                  mode="outlined"
                  keyboardType="decimal-pad"
                />
              </View>

              <Card style={styles.totauxCard}>
                <Card.Content>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Montant HT:</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(calculerMontantHT(commandeVenteForm.lignes))}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TVA:</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(
                        (calculerMontantHT(commandeVenteForm.lignes) *
                          parseFloat(commandeVenteForm.tva_pourcent || 0)) /
                        100
                      )}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Frais Livraison:</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(commandeVenteForm.frais_livraison)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Remise:</Text>
                    <Text style={[styles.totalValue, { color: '#E74C3C' }]}>
                      -{formatCurrency(commandeVenteForm.remise)}
                    </Text>
                  </View>
                  <Divider style={styles.divider} />
                  <View style={[styles.totalRow, styles.totalFinal]}>
                    <Text style={styles.totalLabelFinal}>TOTAL TTC:</Text>
                    <Text style={styles.totalValueFinal}>
                      {formatCurrency(calculerMontantTotal('vente'))}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </View>

            <Divider style={styles.divider} />

            <Text style={styles.inputLabel}>Mode de Paiement</Text>
            <SegmentedButtons
              value={commandeVenteForm.mode_paiement}
              onValueChange={(value) =>
                setCommandeVenteForm({ ...commandeVenteForm, mode_paiement: value })
              }
              buttons={[
                { value: 'especes', label: 'Espèces', icon: 'cash' },
                { value: 'credit', label: 'Crédit', icon: 'credit-card' },
                { value: 'mobile', label: 'Mobile Money', icon: 'cellphone' }
              ]}
              style={styles.segmentedButtons}
            />

            <TextInput
              label="Conditions de Paiement"
              value={commandeVenteForm.conditions_paiement}
              onChangeText={(text) =>
                setCommandeVenteForm({ ...commandeVenteForm, conditions_paiement: text })
              }
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Observations / Notes"
              value={commandeVenteForm.observations_livraison}
              onChangeText={(text) =>
                setCommandeVenteForm({ ...commandeVenteForm, observations_livraison: text })
              }
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleSaveCommandeVente}
                buttonColor="#27AE60"
                style={styles.modalButton}
                loading={loading}
                disabled={loading || commandeVenteForm.lignes.length === 0}
                icon="content-save"
              >
                {commandeVenteMode === 'add' ? 'Créer Commande' : 'Enregistrer'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => setCommandeVenteModalVisible(false)}
                style={styles.modalButton}
                disabled={loading}
              >
                Annuler
              </Button>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderCommandeAchatModal = () => (
    <Portal>
      <Modal
        visible={commandeAchatModalVisible}
        onDismiss={() => setCommandeAchatModalVisible(false)}
        contentContainerStyle={[
          styles.modal,
          styles.modalLarge,
          responsive.isDesktop && styles.modalDesktop
        ]}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title style={styles.modalTitle}>Nouveau Bon de Commande</Title>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setCommandeAchatModalVisible(false)}
            />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Fournisseur *</Text>
            <Menu
              visible={fournisseurMenuVisible}
              onDismiss={() => setFournisseurMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setFournisseurMenuVisible(true)}
                >
                  <Text style={styles.selectInputText}>
                    {commandeAchatForm.id_fournisseur
                      ? fournisseurs.find((f) => f.id === commandeAchatForm.id_fournisseur)
                        ?.nom_fournisseur
                      : 'Sélectionner un fournisseur'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={24} color="#7F8C8D" />
                </TouchableOpacity>
              }
            >
              <ScrollView style={styles.menuScroll}>
                {fournisseurs.map((fournisseur) => (
                  <Menu.Item
                    key={fournisseur.id}
                    onPress={() => {
                      setCommandeAchatForm({
                        ...commandeAchatForm,
                        id_fournisseur: fournisseur.id
                      });
                      setFournisseurMenuVisible(false);
                    }}
                    title={`${fournisseur.nom_fournisseur} - ${fournisseur.telephone}`}
                  />
                ))}
              </ScrollView>
            </Menu>

            <View style={styles.produitsSection}>
              <View style={styles.produitsSectionHeader}>
                <Text style={styles.sectionTitle}>Articles ({commandeAchatForm.lignes.length})</Text>
                <Button
                  mode="contained"
                  icon="plus"
                  onPress={() => handleAddLigneCommande('achat')}
                  compact
                  buttonColor="#27AE60"
                >
                  Ajouter
                </Button>
              </View>

              {commandeAchatForm.lignes.length === 0 ? (
                <View style={styles.emptyLignes}>
                  <MaterialIcons name="shopping-bag" size={40} color="#BDC3C7" />
                  <Text style={styles.emptyLignesText}>Aucun article ajouté</Text>
                </View>
              ) : (
                <View style={styles.lignesList}>
                  {commandeAchatForm.lignes.map((ligne, index) => (
                    <Card key={index} style={styles.ligneCard}>
                      <Card.Content>
                        <View style={styles.ligneHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ligneDesignation}>{ligne.designation}</Text>
                            {ligne.description && (
                              <Text style={styles.ligneDescription}>{ligne.description}</Text>
                            )}
                          </View>
                          <IconButton
                            icon="delete"
                            size={20}
                            iconColor="#E74C3C"
                            onPress={() => handleRemoveLigneCommande(index, 'achat')}
                          />
                        </View>

                        <View style={styles.ligneDetails}>
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Quantité:</Text>
                            <Text style={styles.ligneDetailValue}>
                              {ligne.quantite_commandee} {ligne.unite}
                            </Text>
                          </View>
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Prix Unit.:</Text>
                            <Text style={styles.ligneDetailValue}>
                              {formatCurrency(ligne.prix_unitaire_ht)}
                            </Text>
                          </View>
                          <View style={styles.ligneDetailItem}>
                            <Text style={styles.ligneDetailLabel}>Total:</Text>
                            <Text style={[styles.ligneDetailValue, styles.ligneTotal]}>
                              {formatCurrency(ligne.montant_ttc)}
                            </Text>
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            <Card style={styles.totauxCard}>
              <Card.Content>
                <View style={[styles.totalRow, styles.totalFinal]}>
                  <Text style={styles.totalLabelFinal}>TOTAL TTC:</Text>
                  <Text style={styles.totalValueFinal}>
                    {formatCurrency(calculerMontantTotal('achat'))}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleSaveCommandeAchat}
                buttonColor="#27AE60"
                style={styles.modalButton}
                loading={loading}
                disabled={loading || commandeAchatForm.lignes.length === 0}
                icon="content-save"
              >
                Créer Bon
              </Button>
              <Button
                mode="outlined"
                onPress={() => setCommandeAchatModalVisible(false)}
                style={styles.modalButton}
                disabled={loading}
              >
                Annuler
              </Button>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <View style={styles.container}>
      <View style={[styles.header, responsive.isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
        {/* Left Side - Title */}
        <View style={{ flex: 1 }}>
          <Title style={styles.headerTitle}>Commercial</Title>
          <Text style={styles.headerSubtitle}>
            Gestion clients, fournisseurs et commandes
          </Text>
        </View>

        {/* Right Side - Tabs & Actions */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: responsive.isMobile ? 15 : 0,
          width: responsive.isMobile ? '100%' : 'auto'
        }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
            style={{ marginRight: 10, flex: 1 }}
          >
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', count: 0 },
              { id: 'clients', label: 'Clients', icon: 'people', count: clients.length },
              { id: 'fournisseurs', label: 'Fournisseurs', icon: 'store', count: fournisseurs.length },
              { id: 'commandes_vente', label: 'Ventes', icon: 'shopping-cart', count: commandesVente.length },
              { id: 'commandes_achat', label: 'Achats', icon: 'shopping-bag', count: commandesAchat.length },
              { id: 'factures', label: 'Factures', icon: 'receipt', count: factures.length },
              { id: 'paiements', label: 'Paiements', icon: 'payment', count: paiements.length },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.activeTab,
                  { paddingVertical: 8, paddingHorizontal: 12, marginRight: 5 }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={18}
                  color={activeTab === tab.id ? '#2E86C1' : '#7F8C8D'}
                />
                {responsive.isDesktop && (
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.id && styles.activeTabText,
                      { fontSize: 13, marginLeft: 6 }
                    ]}
                  >
                    {tab.label}
                  </Text>
                )}
                {tab.count > 0 && (
                  <Badge
                    size={16}
                    style={[
                      styles.tabBadge,
                      activeTab === tab.id && styles.tabBadgeActive,
                      { marginLeft: 4 }
                    ]}
                  >
                    {tab.count}
                  </Badge>
                )}
              </TouchableOpacity>
            ))}

          </ScrollView>

          <IconButton
            icon="refresh"
            size={24}
            iconColor="#2E86C1"
            onPress={onRefresh}
          />
        </View>
      </View>

      {renderTabContent()}

      {renderClientModal()}
      {renderFournisseurModal()}
      {renderPaiementModal()}
      {renderCommandeVenteModal()}
      {renderCommandeAchatModal()}
      {renderLigneModal()}

      {
        showDatePicker && (
          <DateTimePicker
            value={datePickerValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )
      }

      {
        activeTab !== 'dashboard' && (
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={() => {
              if (activeTab === 'clients') handleAddClient();
              else if (activeTab === 'fournisseurs') handleAddFournisseur();
              else if (activeTab === 'commandes_vente') handleAddCommandeVente();
              else if (activeTab === 'commandes_achat') handleAddCommandeAchat();
              else if (activeTab === 'paiements') handleAddPaiement();
            }}
            color="#FFFFFF"
          />
        )
      }
    </View >
  );
};
// ============================================
// STYLES - RESPONSIVE
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB' // Darker gray for contrast
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15, // Reduced padding
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    // Removed shadow for cleaner look


  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1'
  },
  tabsContent: {
    paddingHorizontal: 10
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeTab: {
    backgroundColor: '#E8F4F8',
    borderBottomColor: '#2E86C1'
  },
  tabText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginLeft: 8,
    fontWeight: '500'
  },
  activeTabText: {
    color: '#2E86C1',
    fontWeight: 'bold'
  },
  tabBadge: {
    marginLeft: 8,
    backgroundColor: '#BDC3C7'
  },
  tabBadgeActive: {
    backgroundColor: '#2E86C1'
  },
  tabContent: {
    flex: 1
  },
  searchBar: {
    margin: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2
  },
  statsScroll: {
    maxHeight: 120
  },
  statsContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10
  },
  statCard: {
    minWidth: 120,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    elevation: 2
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E86C1',
    textAlign: 'center'
  },
  statCardLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 4
  },
  listContent: {
    padding: 15
  },
  gridContainer: {
    flex: 1
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15
  },
  gridItem: {
    marginBottom: 15
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      },
      default: {
        elevation: 3
      }
    })
  },
  cardMobile: {
    padding: 15,
    marginBottom: 15
  },
  cardDesktop: {
    padding: 20
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2
  },
  cardTags: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap'
  },

  // Dashboard Styles
  dashboardHeader: {
    marginBottom: 20,
    width: '100%',
  },
  dashboardCard: {
    width: 200,
    height: 100,
    marginRight: 15,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB' // Added border for contrast
  },
  dashboardCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  dashboardCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E86C1',
    marginBottom: 4
  },
  dashboardCardLabel: {
    fontSize: 12,
    color: '#7F8C8D'
  },
  dashboardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chartSection: {
    marginBottom: 25,
    paddingHorizontal: 5
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 10,
    elevation: 4
  },
  bottomSection: {
    flexDirection: 'column',
    gap: 20
  },
  bottomSectionDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  bottomColumn: {
    flex: 1,
    minWidth: 300
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#F8F9F9',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12
  },
  tableCell: {
    fontSize: 13,
    color: '#34495E'
  },

  // Existing styles
  chip: {
    height: 24,
    marginRight: 6,
    marginBottom: 4
  },
  chipText: {
    fontSize: 11
  },
  divider: {
    marginVertical: 12
  },
  cardBody: {
    marginBottom: 12
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  cardText: {
    fontSize: 13,
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1'
  },
  cardStats: {
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    color: '#7F8C8D'
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8
  },
  commandeCard: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2
  },
  commandeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  commandeNumero: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E86C1'
  },
  commandeClient: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 4
  },
  commandeDate: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2
  },
  commandeRight: {
    alignItems: 'flex-end'
  },
  commandeMontant: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27AE60',
    marginBottom: 6
  },
  commandeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  detailText: {
    fontSize: 12,
    color: '#7F8C8D'
  },
  commandeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#BDC3C7',
    marginTop: 16
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#7F8C8D'
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
    marginVertical: 16
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1'
  },
  paginationText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2E86C1'
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      },
      default: {
        elevation: 5
      }
    })
  },
  modalLarge: {
    maxHeight: '95%',
    height: Platform.OS === 'web' ? 'auto' : '95%'
  },
  modalDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  modalContent: {
    padding: 20
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF'
  },
  inputHalf: {
    flex: 1,
    marginHorizontal: 5
  },
  inputThird: {
    flex: 1,
    marginHorizontal: 5
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8
  },
  inputValue: {
    fontSize: 14,
    color: '#2C3E50',
    marginTop: 4
  },
  formRow: {
    flexDirection: 'row',
    marginHorizontal: -5
  },
  segmentedButtons: {
    marginBottom: 15
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10
  },
  modalButton: {
    flex: 1
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10
  },
  detailsGridDesktop: {
    gap: 10
  },
  detailItem: {
    width: '50%',
    paddingHorizontal: 10,
    marginBottom: 15
  },
  detailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4
  },
  detailValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600'
  },
  modalSection: {
    marginTop: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12
  },
  miniCard: {
    marginBottom: 10,
    backgroundColor: '#F8F9FA'
  },
  miniCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  miniCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50'
  },
  miniCardAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27AE60'
  },
  miniCardDate: {
    fontSize: 11,
    color: '#7F8C8D'
  },
  statsSection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 10
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5
  },
  statsGridDesktop: {
    gap: 15
  },
  statCardLarge: {
    flex: 1,
    minWidth: 150,
    margin: 5,
    backgroundColor: '#F8F9FA'
  },
  topClientCard: {
    marginBottom: 10,
    backgroundColor: '#F8F9FA'
  },
  topClientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  topClientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  topClientBadge: {
    backgroundColor: '#2E86C1',
    color: '#FFFFFF',
    marginRight: 10
  },
  topClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1
  },
  topClientValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27AE60'
  },
  topClientCommandes: {
    fontSize: 11,
    color: '#7F8C8D',
    marginLeft: 36
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7F8C8D',
    borderRadius: 4,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#FFFFFF'
  },
  selectInputText: {
    fontSize: 14,
    color: '#2C3E50',
    flex: 1
  },
  menuScroll: {
    maxHeight: 300
  },
  produitsSection: {
    marginVertical: 15
  },
  produitsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  emptyLignes: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    borderStyle: 'dashed'
  },
  emptyLignesText: {
    fontSize: 14,
    color: '#BDC3C7',
    marginTop: 10
  },
  lignesList: {
    gap: 10
  },
  ligneCard: {
    backgroundColor: '#F8F9FA',
    elevation: 1
  },
  ligneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  ligneDesignation: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  ligneDescription: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4
  },
  ligneDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15
  },
  ligneDetailItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ligneDetailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginRight: 5
  },
  ligneDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50'
  },
  ligneTotal: {
    color: '#27AE60',
    fontSize: 14
  },
  totauxSection: {
    marginVertical: 15
  },
  totauxCard: {
    backgroundColor: '#F8F9FA',
    marginTop: 15
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  totalLabel: {
    fontSize: 14,
    color: '#7F8C8D'
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50'
  },
  totalFinal: {
    paddingTop: 12
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27AE60'
  }
});
export default CommercialScreen;