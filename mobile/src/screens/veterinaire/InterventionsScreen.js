// frontend/src/screens/veterinaire/InterventionsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Platform,
  Image,
  RefreshControl,
  useWindowDimensions,
  KeyboardAvoidingView
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  Chip,
  RadioButton,
  SegmentedButtons,
  ActivityIndicator,
  FAB,
  Portal,
  Provider,
  Menu,
  Divider,
  IconButton,
  Badge
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration de l'API
const API_BASE_URL = __DEV__ 
  ? Platform.select({
      ios: 'http://localhost:5000',
      android: 'http://10.0.2.2:5000',
      default: 'http://localhost:5000'
    })
  : 'https://your-production-api.com';

const InterventionsScreen = ({ route, navigation }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // Responsive
  const isTablet = windowWidth >= 768;
  const isLargeScreen = windowWidth >= 1024;
  const isExtraLargeScreen = windowWidth >= 1440;

  // États principaux
  const [activeTab, setActiveTab] = useState(route.params?.action === 'create' ? 'nouvelle' : 'liste');
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState(route.params?.filter || 'all');
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalInterventions, setTotalInterventions] = useState(0);

  // États du formulaire
  const [formData, setFormData] = useState({
    id_animal: route.params?.animalId || null,
    animal_info: null,
    type_intervention: route.params?.action === 'vaccination' ? 'vaccination' : '',
    date_intervention: new Date(),
    symptomes: '',
    diagnostic: '',
    produit_utilise: '',
    dosage: '',
    mode_administration: '',
    date_prochaine_visite: null,
    instructions_suivi: '',
    observations: '',
    cout_intervention: '',
    veterinaire: '',
    urgent: false,
    photos: []
  });

  // États UI
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNextVisitPicker, setShowNextVisitPicker] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Données de référence
  const typesIntervention = [
    { id: 'vaccination', label: 'Vaccination', icon: 'needle', color: '#F39C12' },
    { id: 'traitement', label: 'Traitement', icon: 'pill', color: '#E74C3C' },
    { id: 'consultation', label: 'Consultation', icon: 'stethoscope', color: '#3498DB' },
    { id: 'analyse', label: 'Analyse', icon: 'flask', color: '#9B59B6' },
    { id: 'chirurgie', label: 'Chirurgie', icon: 'scalpel-path', color: '#E67E22' },
    { id: 'controle', label: 'Contrôle', icon: 'clipboard-check', color: '#2ECC71' },
  ];

  const modesAdministration = [
    'Injection intramusculaire (IM)',
    'Injection sous-cutanée (SC)',
    'Injection intraveineuse (IV)',
    'Voie orale',
    'Topique',
    'Gouttes oculaires',
    'Application cutanée',
    'Autre'
  ];

  const filtersOptions = [
    { id: 'all', label: 'Toutes', color: '#3498DB' },
    { id: 'today', label: "Aujourd'hui", color: '#2ECC71' },
    { id: 'vaccinations', label: 'Vaccinations', color: '#F39C12' },
    { id: 'traitements', label: 'Traitements', color: '#E74C3C' },
    { id: 'urgents', label: 'Urgents', color: '#C0392B' },
  ];

  // Charger au focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'liste') {
        loadInterventions(true);
      }
    }, [filterType])
  );

  // Initialisation
  useEffect(() => {
    if (route.params?.animalId && !formData.animal_info) {
      loadAnimalInfo(route.params.animalId);
    }
    if (route.params?.action === 'vaccination') {
      setFormData(prev => ({ ...prev, type_intervention: 'vaccination' }));
    }
  }, [route.params]);

  // Configuration Axios
  const getAxiosConfig = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  // Charger les interventions
  const loadInterventions = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const config = await getAxiosConfig();
      const currentPage = reset ? 1 : page;

      const params = {
        page: currentPage,
        limit: 20,
        ...(filterType !== 'all' && { filter: filterType })
      };

      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/interventions`,
        { ...config, params }
      );

      if (response.data.success) {
        const newInterventions = response.data.data;
        const pagination = response.data.pagination;

        if (reset) {
          setInterventions(newInterventions);
        } else {
          setInterventions(prev => [...prev, ...newInterventions]);
        }

        setTotalInterventions(pagination.total);
        setHasMore(pagination.page < pagination.pages);
        if (!reset) {
          setPage(currentPage + 1);
        }
      }
    } catch (error) {
      console.error('Erreur chargement interventions:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les interventions. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger plus d'interventions
  const loadMore = () => {
    if (!loading && hasMore) {
      loadInterventions(false);
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadInterventions(true);
  };

  // Charger les informations de l'animal
  const loadAnimalInfo = async (animalId) => {
    try {
      const config = await getAxiosConfig();
      
      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/animaux/${animalId}`,
        config
      );

      if (response.data.success) {
        setFormData(prev => ({
          ...prev,
          id_animal: animalId,
          animal_info: response.data.data
        }));
      }
    } catch (error) {
      console.error('Erreur chargement animal:', error);
    }
  };

  // Rechercher un animal
  const searchAnimal = async (query) => {
    try {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      const config = await getAxiosConfig();

      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/animaux/search/${query}`,
        config
      );

      if (response.data.success) {
        setSearchResults(response.data.data);
      }
    } catch (error) {
      console.error('Erreur recherche animal:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Sélectionner un animal
  const selectAnimal = (animal) => {
    setFormData(prev => ({
      ...prev,
      id_animal: animal.id,
      animal_info: animal
    }));
    setAnimalSearch('');
    setSearchResults([]);
  };

  // Prendre une photo
  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission nécessaire', 
          "L'accès à la caméra est requis pour prendre des photos."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled) {
        const newPhoto = {
          uri: result.assets[0].uri,
          name: `intervention_${Date.now()}.jpg`,
          type: 'image/jpeg'
        };
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, newPhoto]
        }));
      }
    } catch (error) {
      console.error('Erreur capture photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  // Choisir une photo depuis la galerie
  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission nécessaire',
          "L'accès à la galerie est requis."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled) {
        const newPhoto = {
          uri: result.assets[0].uri,
          name: `intervention_${Date.now()}.jpg`,
          type: 'image/jpeg'
        };
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, newPhoto]
        }));
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
    }
  };

  // Supprimer une photo
  const removePhoto = (index) => {
    Alert.alert(
      'Supprimer la photo',
      'Voulez-vous vraiment supprimer cette photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({
              ...prev,
              photos: prev.photos.filter((_, i) => i !== index)
            }));
          }
        }
      ]
    );
  };

  // Valider le formulaire
  const validateForm = () => {
    if (!formData.id_animal) {
      Alert.alert('Champ requis', 'Veuillez sélectionner un animal');
      return false;
    }
    if (!formData.type_intervention) {
      Alert.alert('Champ requis', "Veuillez sélectionner un type d'intervention");
      return false;
    }
    if (!formData.diagnostic.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir un diagnostic');
      return false;
    }
    return true;
  };

  // Soumettre l'intervention
  const submitIntervention = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const config = await getAxiosConfig();

      // Préparer les données
      const dataToSend = {
        id_animal: formData.id_animal,
        type_intervention: formData.type_intervention,
        date_intervention: formData.date_intervention.toISOString(),
        symptomes: formData.symptomes || null,
        diagnostic: formData.diagnostic,
        produit_utilise: formData.produit_utilise || null,
        dosage: formData.dosage || null,
        mode_administration: formData.mode_administration || null,
        date_prochaine_visite: formData.date_prochaine_visite 
          ? formData.date_prochaine_visite.toISOString() 
          : null,
        instructions_suivi: formData.instructions_suivi || null,
        observations: formData.observations || null,
        cout_intervention: formData.cout_intervention ? parseFloat(formData.cout_intervention) : 0,
        veterinaire: formData.veterinaire || null,
      };

      // Marquer comme urgent dans les observations si nécessaire
      if (formData.urgent && dataToSend.observations) {
        dataToSend.observations = `[URGENT] ${dataToSend.observations}`;
      } else if (formData.urgent) {
        dataToSend.observations = '[URGENT] Intervention prioritaire';
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/veterinaire/interventions`,
        dataToSend,
        config
      );

      if (response.data.success) {
        Alert.alert(
          'Succès',
          'L\'intervention a été enregistrée avec succès.',
          [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                setActiveTab('liste');
                loadInterventions(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur création intervention:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 
        'Impossible d\'enregistrer l\'intervention. Veuillez réessayer.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      id_animal: null,
      animal_info: null,
      type_intervention: '',
      date_intervention: new Date(),
      symptomes: '',
      diagnostic: '',
      produit_utilise: '',
      dosage: '',
      mode_administration: '',
      date_prochaine_visite: null,
      instructions_suivi: '',
      observations: '',
      cout_intervention: '',
      veterinaire: '',
      urgent: false,
      photos: []
    });
    setAnimalSearch('');
    setSearchResults([]);
  };

  // === COMPOSANTS DE RENDU === //

  // En-tête
  const renderHeader = () => (
    <View style={[
      styles.header,
      isTablet && styles.headerTablet
    ]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="medical-bag" size={32} color="#FFF" />
          <View style={styles.headerInfo}>
            <Text style={[
              styles.headerTitle,
              isTablet && styles.headerTitleTablet
            ]}>
              Interventions vétérinaires
            </Text>
            {activeTab === 'liste' && (
              <Text style={styles.headerSubtitle}>
                {totalInterventions} intervention{totalInterventions > 1 ? 's' : ''} au total
              </Text>
            )}
          </View>
        </View>

        {isTablet && activeTab === 'liste' && (
          <Button
            mode="contained"
            icon="plus"
            onPress={() => setActiveTab('nouvelle')}
            style={styles.headerButton}
            labelStyle={styles.headerButtonLabel}
          >
            Nouvelle intervention
          </Button>
        )}
      </View>

      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab}
        buttons={[
          {
            value: 'liste',
            label: isLargeScreen ? 'Liste des interventions' : 'Liste',
            icon: 'format-list-bulleted',
          },
          {
            value: 'nouvelle',
            label: isLargeScreen ? 'Nouvelle intervention' : 'Nouvelle',
            icon: 'plus-circle',
          },
        ]}
        style={[
          styles.segmentedButtons,
          isTablet && styles.segmentedButtonsTablet
        ]}
      />
    </View>
  );

  // Filtres
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {filtersOptions.map((filter) => (
          <Chip
            key={filter.id}
            selected={filterType === filter.id}
            onPress={() => {
              setFilterType(filter.id);
              setPage(1);
            }}
            style={[
              styles.filterChip,
              filterType === filter.id && {
                backgroundColor: filter.color
              }
            ]}
            textStyle={
              filterType === filter.id && { color: '#FFF' }
            }
          >
            {filter.label}
          </Chip>
        ))}
      </ScrollView>

      {filterType !== 'all' && (
        <TouchableOpacity
          style={styles.clearFilter}
          onPress={() => setFilterType('all')}
        >
          <MaterialIcons name="close" size={20} color="#7F8C8D" />
          <Text style={styles.clearFilterText}>Effacer le filtre</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Carte d'intervention
  const renderInterventionCard = ({ item, index }) => {
    const numColumns = isExtraLargeScreen ? 3 : isTablet ? 2 : 1;
    const cardWidth = isExtraLargeScreen 
      ? (windowWidth - 80) / 3 - 20
      : isTablet 
        ? (windowWidth - 60) / 2 - 15
        : windowWidth - 30;

    return (
      <TouchableOpacity
        style={[
          styles.interventionCard,
          isTablet && styles.interventionCardTablet,
          { width: cardWidth }
        ]}
        onPress={() => {
          setSelectedIntervention(item);
          setDetailModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        {/* En-tête de carte */}
        <View style={styles.cardHeader}>
          <View style={[
            styles.interventionIcon,
            { backgroundColor: getInterventionColor(item.type_intervention) }
          ]}>
            <MaterialCommunityIcons 
              name={getInterventionIcon(item.type_intervention)} 
              size={24} 
              color="#FFF" 
            />
          </View>
          
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.animal_nom || item.animal_numero}
            </Text>
            <Text style={styles.cardSubtitle}>
              {item.type_label || item.type_intervention}
            </Text>
          </View>
          
          {item.urgent && (
            <Badge 
              style={styles.urgentBadge}
              size={24}
            >
              !
            </Badge>
          )}
        </View>

        <Divider style={styles.cardDivider} />

        {/* Corps de carte */}
        <View style={styles.cardBody}>
          <Text style={styles.cardDiagnostic} numberOfLines={3}>
            {item.diagnostic}
          </Text>
          
          {/* Informations animal */}
          <View style={styles.cardAnimalInfo}>
            <MaterialCommunityIcons name="paw" size={14} color="#7F8C8D" />
            <Text style={styles.cardAnimalText} numberOfLines={1}>
              {item.animal_espece} - {item.animal_race}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.cardDate}>
              <MaterialIcons name="calendar-today" size={14} color="#7F8C8D" />
              <Text style={styles.cardDateText}>
                {formatDate(item.date_intervention)}
              </Text>
            </View>
            
            {item.cout_intervention > 0 && (
              <Text style={styles.cardCost}>
                {formatCurrency(item.cout_intervention)}
              </Text>
            )}
          </View>

          {/* Prochaine visite */}
          {item.date_prochaine_visite && (
            <View style={styles.nextVisitBanner}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color="#3498DB" />
              <Text style={styles.nextVisitText}>
                Prochaine visite: {formatDate(item.date_prochaine_visite)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Liste des interventions
  const renderListeInterventions = () => {
    if (loading && !refreshing && interventions.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Chargement des interventions...</Text>
        </View>
      );
    }

    return (
      <View style={styles.listeContainer}>
        {renderFilters()}

        {interventions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="medical-bag-off" 
              size={isTablet ? 80 : 60} 
              color="#BDC3C7" 
            />
            <Text style={[
              styles.emptyText,
              isTablet && styles.emptyTextTablet
            ]}>
              Aucune intervention trouvée
            </Text>
            <Text style={styles.emptySubtext}>
              {filterType !== 'all' 
                ? 'Essayez de modifier les filtres'
                : 'Commencez par créer une intervention'}
            </Text>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => setActiveTab('nouvelle')}
              style={styles.emptyButton}
            >
              Créer une intervention
            </Button>
          </View>
        ) : (
          <FlatList
            data={interventions}
            renderItem={renderInterventionCard}
            keyExtractor={(item) => item.id.toString()}
            numColumns={isExtraLargeScreen ? 3 : isTablet ? 2 : 1}
            key={isExtraLargeScreen ? 'three' : isTablet ? 'two' : 'one'}
            contentContainerStyle={[
              styles.listContent,
              isTablet && styles.listContentTablet
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3498DB']}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => {
              if (!loading || refreshing) return null;
              return (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#3498DB" />
                  <Text style={styles.footerText}>Chargement...</Text>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  // Formulaire nouvelle intervention
  const renderNouvelleIntervention = () => {
    const formColumns = isTablet ? 2 : 1;
    
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formKeyboard}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.formContainer}
          showsVerticalScrollIndicator={false}
        >
          <Card style={[
            styles.formCard,
            isLargeScreen && styles.formCardLarge
          ]}>
            <Card.Content>
              <Title style={[
                styles.formTitle,
                isTablet && styles.formTitleTablet
              ]}>
                {route.params?.action === 'vaccination' 
                  ? 'Nouvelle vaccination' 
                  : 'Nouvelle intervention vétérinaire'}
              </Title>

              <Divider style={styles.formDivider} />

              {/* === SÉLECTION ANIMAL === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="paw" size={18} color="#3498DB" />
                  {' '}Animal concerné
                </Text>

                {!formData.animal_info ? (
                  <View style={styles.animalSearch}>
                    <Text style={styles.label}>Rechercher un animal *</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Nom, numéro ou marques distinctives..."
                      value={animalSearch}
                      onChangeText={(text) => {
                        setAnimalSearch(text);
                        searchAnimal(text);
                      }}
                      style={styles.input}
                      left={<TextInput.Icon icon="magnify" />}
                      right={searchLoading && <TextInput.Icon icon="loading" />}
                    />
                    
                    {searchResults.length > 0 && (
                      <Card style={styles.searchResults}>
                        <ScrollView style={styles.searchResultsScroll}>
                          {searchResults.map((animal) => (
                            <TouchableOpacity
                              key={animal.id}
                              style={styles.searchResultItem}
                              onPress={() => selectAnimal(animal)}
                            >
                              <View style={styles.resultLeft}>
                                <MaterialCommunityIcons 
                                  name="paw" 
                                  size={20} 
                                  color="#3498DB" 
                                />
                                <View style={styles.resultInfo}>
                                  <Text style={styles.resultName}>
                                    {animal.nom_animal || animal.numero_identification}
                                  </Text>
                                  <Text style={styles.resultDetails}>
                                    {animal.espece} - {animal.race}
                                  </Text>
                                </View>
                              </View>
                              <MaterialIcons name="chevron-right" size={24} color="#BDC3C7" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </Card>
                    )}
                  </View>
                ) : (
                  <Card style={styles.selectedAnimalCard}>
                    <Card.Content>
                      <View style={styles.selectedAnimalInfo}>
                        <View style={styles.selectedAnimalLeft}>
                          <View style={styles.selectedAnimalIconContainer}>
                            <MaterialCommunityIcons 
                              name="check-circle" 
                              size={28} 
                              color="#2ECC71" 
                            />
                          </View>
                          <View style={styles.selectedAnimalDetails}>
                            <Text style={styles.selectedAnimalName}>
                              {formData.animal_info.nom_animal || 
                               formData.animal_info.numero_identification}
                            </Text>
                            <Text style={styles.selectedAnimalSubtitle}>
                              {formData.animal_info.espece} - {formData.animal_info.race}
                            </Text>
                            <View style={styles.selectedAnimalMeta}>
                              <Text style={styles.selectedAnimalMetaText}>
                                N° {formData.animal_info.numero_identification}
                              </Text>
                              <Text style={styles.metaSeparator}> • </Text>
                              <Text style={styles.selectedAnimalMetaText}>
                                {formData.animal_info.sexe === 'male' ? 'Mâle' : 'Femelle'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity 
                          onPress={() => setFormData(prev => ({ 
                            ...prev, 
                            id_animal: null, 
                            animal_info: null 
                          }))}
                          style={styles.removeAnimalButton}
                        >
                          <MaterialIcons name="close" size={24} color="#7F8C8D" />
                        </TouchableOpacity>
                      </View>
                    </Card.Content>
                  </Card>
                )}
              </View>

              {/* === TYPE D'INTERVENTION === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="medical-bag" size={18} color="#E74C3C" />
                  {' '}Type d'intervention
                </Text>

                <Text style={styles.label}>Sélectionner le type *</Text>
                <View style={[
                  styles.typeContainer,
                  isTablet && styles.typeContainerTablet
                ]}>
                  {typesIntervention.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeOption,
                        isTablet && styles.typeOptionTablet,
                        formData.type_intervention === type.id && {
                          borderColor: type.color,
                          borderWidth: 2,
                          backgroundColor: `${type.color}15`
                        }
                      ]}
                      onPress={() => setFormData(prev => ({ 
                        ...prev, 
                        type_intervention: type.id 
                      }))}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.typeIcon, 
                        { backgroundColor: type.color }
                      ]}>
                        <MaterialCommunityIcons 
                          name={type.icon} 
                          size={isTablet ? 26 : 22} 
                          color="#FFF" 
                        />
                      </View>
                      <Text style={[
                        styles.typeLabel,
                        isTablet && styles.typeLabelTablet,
                        formData.type_intervention === type.id && {
                          color: type.color,
                          fontWeight: 'bold'
                        }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* === INFORMATIONS GÉNÉRALES === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="calendar" size={18} color="#9B59B6" />
                  {' '}Informations générales
                </Text>

                <View style={[
                  styles.formGrid,
                  formColumns === 2 && styles.formGridTwo
                ]}>
                  {/* Date intervention */}
                  <View style={formColumns === 2 ? styles.formColumnHalf : styles.formColumnFull}>
                    <Text style={styles.label}>Date intervention *</Text>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <MaterialIcons name="calendar-today" size={20} color="#7F8C8D" />
                      <Text style={styles.dateText}>
                        {formData.date_intervention.toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formData.date_intervention}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setFormData(prev => ({ 
                              ...prev, 
                              date_intervention: selectedDate 
                            }));
                          }
                        }}
                      />
                    )}
                  </View>

                  {/* Coût */}
                  <View style={formColumns === 2 ? styles.formColumnHalf : styles.formColumnFull}>
                    <Text style={styles.label}>Coût intervention (USD)</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="0.00"
                      value={formData.cout_intervention}
                      onChangeText={(text) => setFormData(prev => ({ 
                        ...prev, 
                        cout_intervention: text 
                      }))}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      left={<TextInput.Icon icon="currency-usd" />}
                    />
                  </View>
                </View>

                {/* Vétérinaire */}
                <Text style={styles.label}>Vétérinaire (optionnel)</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Nom du vétérinaire..."
                  value={formData.veterinaire}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    veterinaire: text 
                  }))}
                  style={styles.input}
                  left={<TextInput.Icon icon="doctor" />}
                />
              </View>

              {/* === OBSERVATIONS MÉDICALES === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="stethoscope" size={18} color="#2ECC71" />
                  {' '}Observations médicales
                </Text>

                {/* Symptômes */}
                <Text style={styles.label}>Symptômes observés</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Décrire les symptômes constatés..."
                  value={formData.symptomes}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    symptomes: text 
                  }))}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />

                {/* Diagnostic */}
                <Text style={styles.label}>Diagnostic *</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Diagnostic détaillé et conclusions..."
                  value={formData.diagnostic}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    diagnostic: text 
                  }))}
                  multiline
                  numberOfLines={4}
                  style={styles.textArea}
                  error={!formData.diagnostic && submitting}
                />
              </View>

              {/* === TRAITEMENT === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="pill" size={18} color="#F39C12" />
                  {' '}Traitement administré
                </Text>

                <View style={[
                  styles.formGrid,
                  formColumns === 2 && styles.formGridTwo
                ]}>
                  <View style={formColumns === 2 ? styles.formColumnHalf : styles.formColumnFull}>
                    <Text style={styles.label}>Produit utilisé</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Nom du produit/vaccin/médicament..."
                      value={formData.produit_utilise}
                      onChangeText={(text) => setFormData(prev => ({ 
                        ...prev, 
                        produit_utilise: text 
                      }))}
                      style={styles.input}
                    />
                  </View>

                  <View style={formColumns === 2 ? styles.formColumnHalf : styles.formColumnFull}>
                    <Text style={styles.label}>Dosage</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Ex: 5ml, 2 comprimés, 10mg/kg..."
                      value={formData.dosage}
                      onChangeText={(text) => setFormData(prev => ({ 
                        ...prev, 
                        dosage: text 
                      }))}
                      style={styles.input}
                    />
                  </View>
                </View>

                {/* Mode d'administration */}
                <Text style={styles.label}>Mode d'administration</Text>
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setMenuVisible(true)}
                    >
                      <Text style={[
                        styles.selectButtonText,
                        !formData.mode_administration && styles.selectButtonPlaceholder
                      ]}>
                        {formData.mode_administration || 'Sélectionner un mode...'}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#7F8C8D" />
                    </TouchableOpacity>
                  }
                >
                  {modesAdministration.map((mode, index) => (
                    <Menu.Item
                      key={index}
                      onPress={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          mode_administration: mode 
                        }));
                        setMenuVisible(false);
                      }}
                      title={mode}
                    />
                  ))}
                </Menu>
              </View>

              {/* === SUIVI === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="calendar-clock" size={18} color="#1ABC9C" />
                  {' '}Suivi et prochaines étapes
                </Text>

                {/* Prochaine visite */}
                <Text style={styles.label}>Date prochaine visite (optionnel)</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowNextVisitPicker(true)}
                >
                  <MaterialIcons name="event" size={20} color="#7F8C8D" />
                  <Text style={[
                    styles.dateText,
                    !formData.date_prochaine_visite && styles.datePlaceholder
                  ]}>
                    {formData.date_prochaine_visite 
                      ? formData.date_prochaine_visite.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Sélectionner une date...'}
                  </Text>
                  {formData.date_prochaine_visite && (
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ 
                          ...prev, 
                          date_prochaine_visite: null 
                        }));
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color="#7F8C8D" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {showNextVisitPicker && (
                  <DateTimePicker
                    value={formData.date_prochaine_visite || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowNextVisitPicker(false);
                      if (selectedDate) {
                        setFormData(prev => ({ 
                          ...prev, 
                          date_prochaine_visite: selectedDate 
                        }));
                      }
                    }}
                  />
                )}

                {/* Instructions de suivi */}
                <Text style={styles.label}>Instructions de suivi</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Instructions pour le suivi post-intervention..."
                  value={formData.instructions_suivi}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    instructions_suivi: text 
                  }))}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />

                {/* Observations complémentaires */}
                <Text style={styles.label}>Observations complémentaires</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Autres observations, notes, précautions..."
                  value={formData.observations}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    observations: text 
                  }))}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />
              </View>

              {/* === OPTIONS === */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>
                  <MaterialCommunityIcons name="cog" size={18} color="#95A5A6" />
                  {' '}Options
                </Text>

                {/* Marquer comme urgent */}
                <TouchableOpacity
                  style={styles.urgentContainer}
                  onPress={() => setFormData(prev => ({ 
                    ...prev, 
                    urgent: !prev.urgent 
                  }))}
                  activeOpacity={0.7}
                >
                  <View style={styles.urgentLeft}>
                    <View style={[
                      styles.urgentIconContainer,
                      formData.urgent && styles.urgentIconContainerActive
                    ]}>
                      <MaterialIcons 
                        name="priority-high" 
                        size={24} 
                        color={formData.urgent ? '#FFF' : '#E74C3C'} 
                      />
                    </View>
                    <View style={styles.urgentText}>
                      <Text style={styles.urgentTitle}>Intervention urgente</Text>
                      <Text style={styles.urgentSubtitle}>
                        Marquer comme prioritaire et à traiter en premier
                      </Text>
                    </View>
                  </View>
                  <RadioButton
                    value="urgent"
                    status={formData.urgent ? 'checked' : 'unchecked'}
                    onPress={() => setFormData(prev => ({ 
                      ...prev, 
                      urgent: !prev.urgent 
                    }))}
                    color="#E74C3C"
                  />
                </TouchableOpacity>

                {/* Photos */}
                <Text style={styles.label}>Photos (optionnel)</Text>
                <View style={styles.photosContainer}>
                  <View style={styles.photoButtons}>
                    <TouchableOpacity 
                      style={styles.addPhotoButton} 
                      onPress={pickPhoto}
                    >
                      <MaterialIcons name="add-a-photo" size={24} color="#3498DB" />
                      <Text style={styles.addPhotoText}>Prendre une photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.addPhotoButton} 
                      onPress={pickImageFromGallery}
                    >
                      <MaterialIcons name="photo-library" size={24} color="#3498DB" />
                      <Text style={styles.addPhotoText}>Choisir dans galerie</Text>
                    </TouchableOpacity>
                  </View>

                  {formData.photos.length > 0 && (
                    <View style={styles.photosGrid}>
                      {formData.photos.map((photo, index) => (
                        <View key={index} style={styles.photoItem}>
                          <Image 
                            source={{ uri: photo.uri }} 
                            style={styles.photoImage} 
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.removePhotoButton}
                            onPress={() => removePhoto(index)}
                          >
                            <MaterialIcons name="close" size={18} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* === BOUTONS D'ACTION === */}
              <View style={[
                styles.actionButtons,
                isTablet && styles.actionButtonsTablet
              ]}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    Alert.alert(
                      'Réinitialiser le formulaire',
                      'Voulez-vous vraiment réinitialiser tous les champs ?',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { 
                          text: 'Réinitialiser', 
                          style: 'destructive',
                          onPress: resetForm 
                        }
                      ]
                    );
                  }}
                  style={[
                    styles.actionButton, 
                    isTablet && styles.actionButtonHalf
                  ]}
                  icon="refresh"
                  disabled={submitting}
                >
                  Réinitialiser
                </Button>
                
                <Button
                  mode="contained"
                  onPress={submitIntervention}
                  loading={submitting}
                  disabled={submitting || !formData.id_animal || !formData.type_intervention}
                  style={[
                    styles.actionButton, 
                    styles.actionButtonPrimary,
                    isTablet && styles.actionButtonHalf
                  ]}
                  icon="content-save"
                  labelStyle={styles.actionButtonLabel}
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer l\'intervention'}
                </Button>
              </View>

              <Text style={styles.disclaimer}>
                * Les champs marqués d'un astérisque sont obligatoires.{'\n'}
                Toutes les interventions sont tracées et archivées de manière sécurisée.
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.formBottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // Modal détail d'intervention
  const renderDetailModal = () => {
    if (!selectedIntervention) return null;

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
        presentationStyle={isTablet ? 'pageSheet' : 'fullScreen'}
      >
        <View style={styles.modalContainer}>
          {/* En-tête modal */}
          <View style={[
            styles.modalHeader,
            isTablet && styles.modalHeaderTablet
          ]}>
            <TouchableOpacity 
              onPress={() => setDetailModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={28} color="#2C3E50" />
            </TouchableOpacity>
            
            <Text style={[
              styles.modalTitle,
              isTablet && styles.modalTitleTablet
            ]}>
              Détails de l'intervention
            </Text>
            
            <View style={styles.modalHeaderActions}>
              <IconButton
                icon="pencil"
                size={24}
                onPress={() => {
                  // Ouvrir mode édition
                  Alert.alert('Fonctionnalité à venir', 'L\'édition sera disponible prochainement.');
                }}
              />
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Card style={styles.detailCard}>
              <Card.Content>
                {/* En-tête intervention */}
                <View style={styles.detailHeader}>
                  <View style={[
                    styles.detailIcon,
                    { backgroundColor: getInterventionColor(selectedIntervention.type_intervention) }
                  ]}>
                    <MaterialCommunityIcons 
                      name={getInterventionIcon(selectedIntervention.type_intervention)} 
                      size={32} 
                      color="#FFF" 
                    />
                  </View>
                  
                  <View style={styles.detailHeaderInfo}>
                    <Text style={styles.detailType}>
                      {selectedIntervention.type_label || selectedIntervention.type_intervention}
                    </Text>
                    <Text style={styles.detailDate}>
                      {formatDate(selectedIntervention.date_intervention)}
                    </Text>
                    {selectedIntervention.veterinaire_nom && (
                      <View style={styles.detailVet}>
                        <MaterialCommunityIcons name="doctor" size={16} color="#7F8C8D" />
                        <Text style={styles.detailVetText}>
                          Dr. {selectedIntervention.veterinaire_nom}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {selectedIntervention.urgent && (
                    <Chip 
                      style={styles.urgentChip} 
                      textStyle={styles.urgentChipText}
                      icon="alert"
                    >
                      URGENT
                    </Chip>
                  )}
                </View>

                <Divider style={styles.modalDivider} />

                {/* Animal */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    <MaterialCommunityIcons name="paw" size={16} />
                    {' '}Animal
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      navigation.navigate('AnimalDetails', {
                        animalId: selectedIntervention.id_animal
                      });
                    }}
                  >
                    <Text style={styles.detailValue}>
                      {selectedIntervention.animal_nom || selectedIntervention.animal_numero}
                    </Text>
                    <Text style={styles.detailSubvalue}>
                      {selectedIntervention.animal_espece} - {selectedIntervention.animal_race}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Symptômes */}
                {selectedIntervention.symptomes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>
                      <MaterialCommunityIcons name="thermometer" size={16} />
                      {' '}Symptômes observés
                    </Text>
                    <Text style={styles.detailValue}>
                      {selectedIntervention.symptomes}
                    </Text>
                  </View>
                )}

                {/* Diagnostic */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    <MaterialCommunityIcons name="clipboard-text" size={16} />
                    {' '}Diagnostic
                  </Text>
                  <Text style={styles.detailValue}>
                    {selectedIntervention.diagnostic}
                  </Text>
                </View>

                {/* Traitement */}
                {selectedIntervention.produit_utilise && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>
                      <MaterialCommunityIcons name="pill" size={16} />
                      {' '}Traitement administré
                    </Text>
                    <View style={styles.treatmentInfo}>
                      <View style={styles.treatmentRow}>
                        <Text style={styles.treatmentLabel}>Produit:</Text>
                        <Text style={styles.treatmentValue}>
                          {selectedIntervention.produit_utilise}
                        </Text>
                      </View>
                      {selectedIntervention.dosage && (
                        <>
                          <Divider style={styles.treatmentDivider} />
                          <View style={styles.treatmentRow}>
                            <Text style={styles.treatmentLabel}>Dosage:</Text>
                            <Text style={styles.treatmentValue}>
                              {selectedIntervention.dosage}
                            </Text>
                          </View>
                        </>
                      )}
                      {selectedIntervention.mode_administration && (
                        <>
                          <Divider style={styles.treatmentDivider} />
                          <View style={styles.treatmentRow}>
                            <Text style={styles.treatmentLabel}>Mode:</Text>
                            <Text style={styles.treatmentValue}>
                              {selectedIntervention.mode_administration}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* Instructions de suivi */}
                {selectedIntervention.instructions_suivi && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>
                      <MaterialCommunityIcons name="clipboard-check" size={16} />
                      {' '}Instructions de suivi
                    </Text>
                    <Text style={styles.detailValue}>
                      {selectedIntervention.instructions_suivi}
                    </Text>
                  </View>
                )}

                {/* Prochaine visite */}
                {selectedIntervention.date_prochaine_visite && (
                  <View style={styles.nextVisitCard}>
                    <MaterialCommunityIcons 
                      name="calendar-clock" 
                      size={28} 
                      color="#3498DB" 
                    />
                    <View style={styles.nextVisitInfo}>
                      <Text style={styles.nextVisitLabel}>
                        Prochaine visite prévue
                      </Text>
                      <Text style={styles.nextVisitDate}>
                        {formatDate(selectedIntervention.date_prochaine_visite)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Coût */}
                {selectedIntervention.cout_intervention > 0 && (
                  <View style={styles.costCard}>
                    <MaterialCommunityIcons 
                      name="currency-usd" 
                      size={24} 
                      color="#2ECC71" 
                    />
                    <View style={styles.costInfo}>
                      <Text style={styles.costLabel}>Coût de l'intervention</Text>
                      <Text style={styles.costValue}>
                        {formatCurrency(selectedIntervention.cout_intervention)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Observations */}
                {selectedIntervention.observations && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>
                      <MaterialCommunityIcons name="note-text" size={16} />
                      {' '}Observations complémentaires
                    </Text>
                    <Text style={styles.detailValue}>
                      {selectedIntervention.observations}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            <View style={styles.modalBottomSpacing} />
          </ScrollView>

          {/* Actions du modal */}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={() => setDetailModalVisible(false)}
              style={styles.modalActionButton}
              icon="check"
            >
              Fermer
            </Button>
          </View>
        </View>
      </Modal>
    );
  };

  // === FONCTIONS UTILITAIRES === //

  const getInterventionIcon = (type) => {
    const intervention = typesIntervention.find(t => t.id === type);
    return intervention ? intervention.icon : 'medical-bag';
  };

  const getInterventionColor = (type) => {
    const intervention = typesIntervention.find(t => t.id === type);
    return intervention ? intervention.color : '#95A5A6';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // === RENDU PRINCIPAL === //

  return (
    <Provider>
      <View style={styles.container}>
        {renderHeader()}

        {activeTab === 'liste' 
          ? renderListeInterventions() 
          : renderNouvelleIntervention()}

        {/* FAB pour mobile uniquement */}
        {activeTab === 'liste' && !isTablet && (
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={() => setActiveTab('nouvelle')}
            color="#FFF"
          />
        )}

        {renderDetailModal()}
      </View>
    </Provider>
  );
};

// === STYLES === //

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  // Header
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  headerTablet: {
    paddingHorizontal: 40,
    paddingBottom: 25,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerTitleTablet: {
    fontSize: 26,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  headerButton: {
    backgroundColor: '#FFF',
  },
  headerButtonLabel: {
    color: '#2E86C1',
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentedButtonsTablet: {
    maxWidth: 500,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
  },

  // Liste
  listeContainer: {
    flex: 1,
  },
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  filtersScroll: {
    paddingHorizontal: 15,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  clearFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  clearFilterText: {
    marginLeft: 5,
    fontSize: 13,
    color: '#7F8C8D',
  },
  listContent: {
    padding: 15,
  },
  listContentTablet: {
    padding: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7F8C8D',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: '#3498DB',
  },

  // Carte intervention
  interventionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  interventionCardTablet: {
    marginHorizontal: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
  },
  interventionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },
  urgentBadge: {
    backgroundColor: '#E74C3C',
  },
  cardDivider: {
    marginVertical: 0,
  },
  cardBody: {
    padding: 15,
  },
  cardDiagnostic: {
    fontSize: 14,
    color: '#2C3E50',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardAnimalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardAnimalText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDateText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 5,
  },
  cardCost: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  nextVisitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  nextVisitText: {
    fontSize: 12,
    color: '#3498DB',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Formulaire
  formKeyboard: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
  },
  formCard: {
    margin: 15,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  formCardLarge: {
    marginHorizontal: '10%',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  formTitleTablet: {
    fontSize: 26,
  },
  formDivider: {
    marginVertical: 20,
    backgroundColor: '#ECF0F1',
  },
  formSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
  },
  textArea: {
    backgroundColor: '#FFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Recherche animal
  animalSearch: {
    marginBottom: 15,
  },
  searchResults: {
    marginTop: 8,
    maxHeight: 250,
    backgroundColor: '#FFF',
  },
  searchResultsScroll: {
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resultInfo: {
    marginLeft: 12,
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  resultDetails: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },

  // Animal sélectionné
  selectedAnimalCard: {
    marginBottom: 15,
    backgroundColor: '#E8F8F5',
  },
  selectedAnimalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedAnimalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedAnimalIconContainer: {
    marginRight: 12,
  },
  selectedAnimalDetails: {
    flex: 1,
  },
  selectedAnimalName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  selectedAnimalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  selectedAnimalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  selectedAnimalMetaText: {
    fontSize: 12,
    color: '#95A5A6',
  },
  metaSeparator: {
    fontSize: 12,
    color: '#BDC3C7',
  },
  removeAnimalButton: {
    padding: 5,
  },

  // Types d'intervention
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  typeContainerTablet: {
    justifyContent: 'space-between',
  },
  typeOption: {
    alignItems: 'center',
    padding: 15,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
    backgroundColor: '#FFF',
    minWidth: 110,
  },
  typeOptionTablet: {
    minWidth: 130,
    padding: 18,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 13,
    color: '#2C3E50',
    textAlign: 'center',
    fontWeight: '500',
  },
  typeLabelTablet: {
    fontSize: 14,
  },

  // Grille formulaire
  formGrid: {
    marginVertical: 5,
  },
  formGridTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formColumnFull: {
    width: '100%',
  },
  formColumnHalf: {
    width: '48%',
  },

  // Date picker
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ECF0F1',
    borderRadius: 8,
    padding: 15,
    minHeight: 56,
  },
  dateText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#2C3E50',
  },
  datePlaceholder: {
    color: '#95A5A6',
  },

  // Select button
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ECF0F1',
    borderRadius: 8,
    padding: 15,
    minHeight: 56,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#2C3E50',
  },
  selectButtonPlaceholder: {
    color: '#95A5A6',
  },

  // Urgent
  urgentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  urgentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  urgentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  urgentIconContainerActive: {
    backgroundColor: '#E74C3C',
  },
  urgentText: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  urgentSubtitle: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },

  // Photos
  photosContainer: {
    marginBottom: 15,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addPhotoButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FB',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3498DB',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    marginTop: 8,
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '500',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 15,
    gap: 10,
  },
  photoItem: {
    position: 'relative',
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#E74C3C',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Actions
  actionButtons: {
    marginTop: 20,
  },
  actionButtonsTablet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  actionButton: {
    marginBottom: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#2ECC71',
  },
  actionButtonHalf: {
    flex: 1,
    marginBottom: 0,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  formBottomSpacing: {
    height: 30,
  },

  // FAB
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: '#2ECC71',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalHeaderTablet: {
    paddingHorizontal: 30,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalTitleTablet: {
    fontSize: 22,
  },
  modalHeaderActions: {
    flexDirection: 'row',
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  detailCard: {
    backgroundColor: '#FFF',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderInfo: {
    flex: 1,
    marginLeft: 15,
  },
  detailType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  detailDate: {
    fontSize: 15,
    color: '#7F8C8D',
    marginTop: 6,
  },
  detailVet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  detailVetText: {
    fontSize: 13,
    color: '#7F8C8D',
    marginLeft: 6,
  },
  urgentChip: {
    backgroundColor: '#E74C3C',
    marginLeft: 10,
  },
  urgentChipText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalDivider: {
    marginVertical: 20,
    backgroundColor: '#ECF0F1',
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F8C8D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailValue: {
    fontSize: 15,
    color: '#2C3E50',
    lineHeight: 22,
  },
  detailSubvalue: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  treatmentInfo: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
  },
  treatmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  treatmentLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  treatmentValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  treatmentDivider: {
    marginVertical: 5,
    backgroundColor: '#ECF0F1',
  },
  nextVisitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
  },
  nextVisitInfo: {
    marginLeft: 15,
  },
  nextVisitLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  nextVisitDate: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3498DB',
    marginTop: 4,
  },
  costCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
  },
  costInfo: {
    marginLeft: 15,
  },
  costLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  costValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginTop: 4,
  },
  modalActions: {
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  modalActionButton: {
    backgroundColor: '#3498DB',
  },
  modalBottomSpacing: {
    height: 30,
  },
});

export default InterventionsScreen;