// frontend/src/screens/veterinaire/AnimauxScreen.js
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
  Image,
  RefreshControl,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  Searchbar,
  Card,
  Title,
  Paragraph,
  Chip,
  FAB,
  Button,
  TextInput,
  ActivityIndicator,
  List,
  Divider,
  Avatar,
  Badge,
  IconButton
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration de l'API
const API_BASE_URL = __DEV__ 
  ? Platform.select({
      ios: 'http://localhost:5000',
      android: 'http://localhost:5000',
      default: 'http://localhost:5000'
    })
  : 'https://your-production-api.com';

const AnimauxScreen = ({ route, navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  
  // États
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animaux, setAnimaux] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEspece, setFilterEspece] = useState('all');
  const [filterStatut, setFilterStatut] = useState(route.params?.filter || 'all');
  const [filterTypeAnimal, setFilterTypeAnimal] = useState('all');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [ficheModalVisible, setFicheModalVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalAnimaux, setTotalAnimaux] = useState(0);

  // Responsive
  const isLargeScreen = windowWidth >= 768;
  const isExtraLargeScreen = windowWidth >= 1024;
  const numColumns = isExtraLargeScreen ? 3 : isLargeScreen ? 2 : 1;

  // Filtres disponibles
  const especes = [
    { id: 'all', label: 'Tous', icon: 'paw' },
    { id: 'vache', label: 'Vaches', icon: 'cow' },
    { id: 'brebis', label: 'Brebis', icon: 'sheep' },
    { id: 'chevre', label: 'Chèvres', icon: 'goat' },
    { id: 'poule', label: 'Poules', icon: 'bird' },
    { id: 'porc', label: 'Porcs', icon: 'pig' },
  ];

  const typesAnimaux = [
    { id: 'all', label: 'Tous types' },
    { id: 'reproducteur', label: 'Reproducteurs' },
    { id: 'producteur', label: 'Producteurs' },
    { id: 'jeune', label: 'Jeunes' },
  ];

  const statutsFilters = [
    { id: 'all', label: 'Tous', color: '#3498DB' },
    { id: 'surveillance', label: 'Sous surveillance', color: '#E74C3C' },
    { id: 'healthy', label: 'En bonne santé', color: '#2ECC71' },
    { id: 'en_traitement', label: 'En traitement', color: '#9B59B6' },
  ];

  // Charger au focus
  useFocusEffect(
    useCallback(() => {
      loadAnimaux(true);
    }, [filterEspece, filterStatut, filterTypeAnimal, searchQuery])
  );

  useEffect(() => {
    // Si navigation avec animalId spécifique
    if (route.params?.animalId) {
      loadAnimalDetails(route.params.animalId);
    }
    // Si navigation avec filtre
    if (route.params?.filter) {
      setFilterStatut(route.params.filter);
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

  // Charger la liste des animaux
  const loadAnimaux = async (reset = false) => {
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
        ...(filterEspece !== 'all' && { espece: filterEspece }),
        ...(filterStatut !== 'all' && { statut: filterStatut }),
        ...(filterTypeAnimal !== 'all' && { type_animal: filterTypeAnimal }),
        ...(searchQuery && { search: searchQuery })
      };

      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/animaux`,
        { ...config, params }
      );

      if (response.data.success) {
        const newAnimaux = response.data.data;
        const pagination = response.data.pagination;

        if (reset) {
          setAnimaux(newAnimaux);
        } else {
          setAnimaux(prev => [...prev, ...newAnimaux]);
        }

        setTotalAnimaux(pagination.total);
        setHasMore(pagination.page < pagination.pages);
        if (!reset) {
          setPage(currentPage + 1);
        }
      }
    } catch (error) {
      console.error('Erreur chargement animaux:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger la liste des animaux. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger les détails d'un animal
  const loadAnimalDetails = async (animalId) => {
    try {
      const config = await getAxiosConfig();
      
      const response = await axios.get(
        `${API_BASE_URL}/api/veterinaire/animaux/${animalId}`,
        config
      );

      if (response.data.success) {
        setSelectedAnimal(response.data.data);
        setFicheModalVisible(true);
      }
    } catch (error) {
      console.error('Erreur chargement détails animal:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les détails de l\'animal.'
      );
    }
  };

  // Rafraîchir
  const onRefresh = () => {
    setRefreshing(true);
    loadAnimaux(true);
  };

  // Charger plus d'animaux (pagination)
  const loadMore = () => {
    if (!loading && hasMore) {
      loadAnimaux(false);
    }
  };

  // Recherche
  const handleSearch = () => {
    loadAnimaux(true);
  };

  // === COMPOSANTS DE RENDU === //

  // En-tête avec statistiques
  const renderHeader = () => (
    <View style={[
      styles.header,
      isLargeScreen && styles.headerLarge
    ]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="paw" size={32} color="#3498DB" />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Gestion des animaux</Text>
            <Text style={styles.headerSubtitle}>
              {totalAnimaux} animal{totalAnimaux > 1 ? 'aux' : ''} au total
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <IconButton
            icon="filter-variant"
            size={24}
            onPress={() => {/* Ouvrir panneau filtres avancés */}}
          />
          <IconButton
            icon="sort"
            size={24}
            onPress={() => {/* Ouvrir options de tri */}}
          />
        </View>
      </View>

      {/* Statistiques rapides */}
      <View style={[
        styles.statsRow,
        isLargeScreen && styles.statsRowLarge
      ]}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="heart-pulse" size={24} color="#2ECC71" />
          <Text style={styles.statValue}>
            {animaux.filter(a => a.statut_sante === 'excellent' || a.statut_sante === 'bon').length}
          </Text>
          <Text style={styles.statLabel}>Sains</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#E74C3C" />
          <Text style={styles.statValue}>
            {animaux.filter(a => 
              a.statut_sante === 'moyen' || 
              a.statut_sante === 'malade' || 
              a.statut_sante === 'en_traitement'
            ).length}
          </Text>
          <Text style={styles.statLabel}>Surveillance</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <MaterialCommunityIcons name="needle" size={24} color="#F39C12" />
          <Text style={styles.statValue}>
            {animaux.filter(a => {
              if (!a.prochaine_vaccination) return false;
              const date = new Date(a.prochaine_vaccination);
              const today = new Date();
              const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
              return diffDays <= 30;
            }).length}
          </Text>
          <Text style={styles.statLabel}>Vaccins dus</Text>
        </View>
      </View>
    </View>
  );

  // Barre de recherche
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Searchbar
        placeholder="Rechercher par nom, numéro ou marque distinctive..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={handleSearch}
        onIconPress={handleSearch}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        icon="magnify"
        clearIcon="close"
      />
    </View>
  );

  // Filtres
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* Filtres par espèce */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <View style={styles.chipRow}>
          {especes.map((espece) => (
            <Chip
              key={espece.id}
              selected={filterEspece === espece.id}
              onPress={() => {
                setFilterEspece(espece.id);
                setPage(1);
              }}
              style={[
                styles.filterChip,
                filterEspece === espece.id && styles.filterChipSelected
              ]}
              icon={espece.icon}
            >
              {espece.label}
            </Chip>
          ))}
        </View>
      </ScrollView>

      {/* Filtres par statut de santé */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <View style={styles.chipRow}>
          {statutsFilters.map((statut) => (
            <Chip
              key={statut.id}
              selected={filterStatut === statut.id}
              onPress={() => {
                setFilterStatut(statut.id);
                setPage(1);
              }}
              style={[
                styles.filterChip,
                filterStatut === statut.id && {
                  backgroundColor: statut.color
                }
              ]}
              textStyle={
                filterStatut === statut.id && { color: '#FFF' }
              }
            >
              {statut.label}
            </Chip>
          ))}
        </View>
      </ScrollView>

      {/* Filtres par type d'animal */}
      {isLargeScreen && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <View style={styles.chipRow}>
            {typesAnimaux.map((type) => (
              <Chip
                key={type.id}
                selected={filterTypeAnimal === type.id}
                onPress={() => {
                  setFilterTypeAnimal(type.id);
                  setPage(1);
                }}
                style={[
                  styles.filterChip,
                  filterTypeAnimal === type.id && styles.filterChipSelected
                ]}
              >
                {type.label}
              </Chip>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  // Carte animal (liste)
  const renderAnimalItem = ({ item, index }) => {
    const cardWidth = isExtraLargeScreen 
      ? (windowWidth - 80) / 3 - 20
      : isLargeScreen 
        ? (windowWidth - 60) / 2 - 15
        : windowWidth - 30;

    return (
      <TouchableOpacity
        style={[
          styles.animalCard,
          isLargeScreen && styles.animalCardLarge,
          { width: cardWidth }
        ]}
        onPress={() => loadAnimalDetails(item.id)}
        activeOpacity={0.7}
      >
        {/* Image de l'animal */}
        <View style={styles.animalImageContainer}>
          <Image 
            source={{ 
              uri: item.photo || 'https://via.placeholder.com/150?text=Animal' 
            }}
            style={[
              styles.animalPhoto,
              isLargeScreen && styles.animalPhotoLarge
            ]}
            resizeMode="cover"
          />
          
          {/* Badge de santé */}
          <View style={[
            styles.healthBadge,
            { backgroundColor: getHealthColor(item.statut_sante) }
          ]}>
            <MaterialCommunityIcons 
              name={getHealthIcon(item.statut_sante)} 
              size={16} 
              color="#FFF" 
            />
          </View>

          {/* Badge espèce */}
          <Chip 
            style={styles.especeChip}
            textStyle={styles.especeChipText}
            compact
          >
            {item.espece}
          </Chip>
        </View>

        {/* Informations de l'animal */}
        <View style={styles.animalInfo}>
          {/* Nom et numéro */}
          <View style={styles.animalHeader}>
            <Text 
              style={[
                styles.animalName,
                isLargeScreen && styles.animalNameLarge
              ]} 
              numberOfLines={1}
            >
              {item.nom_animal || item.numero_identification}
            </Text>
            <View style={styles.genderIcon}>
              <MaterialCommunityIcons 
                name={item.sexe === 'male' ? 'gender-male' : 'gender-female'} 
                size={20} 
                color={item.sexe === 'male' ? '#3498DB' : '#E91E63'} 
              />
            </View>
          </View>

          {/* Détails */}
          <Text style={styles.animalDetails} numberOfLines={1}>
            {item.race} • N° {item.numero_identification}
          </Text>

          {/* Informations supplémentaires */}
          <View style={styles.animalMeta}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="calendar" size={14} color="#7F8C8D" />
              <Text style={styles.metaText}>
                {calculateAge(item.date_naissance)}
              </Text>
            </View>
            
            {item.poids_actuel && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="weight" size={14} color="#7F8C8D" />
                <Text style={styles.metaText}>{item.poids_actuel} kg</Text>
              </View>
            )}
          </View>

          {/* Statut de santé */}
          <View style={styles.animalFooter}>
            <Chip 
              style={[
                styles.statusChip,
                { backgroundColor: getHealthColor(item.statut_sante) + '20' }
              ]}
              textStyle={[
                styles.statusChipText,
                { color: getHealthColor(item.statut_sante) }
              ]}
              compact
            >
              {getHealthLabel(item.statut_sante)}
            </Chip>

            {/* Badge intervention récente */}
            {item.nb_interventions > 0 && (
              <Badge 
                style={styles.interventionBadge}
                size={20}
              >
                {item.nb_interventions}
              </Badge>
            )}
          </View>

          {/* Alerte si nécessaire */}
          {(item.statut_sante === 'malade' || 
            item.statut_sante === 'en_traitement' ||
            item.raison_surveillance) && (
            <View style={styles.alertBanner}>
              <MaterialIcons name="warning" size={14} color="#E74C3C" />
              <Text style={styles.alertText} numberOfLines={2}>
                {item.raison_surveillance || 'Nécessite une surveillance'}
              </Text>
            </View>
          )}

          {/* Vaccination à venir */}
          {item.prochaine_vaccination && (() => {
            const date = new Date(item.prochaine_vaccination);
            const today = new Date();
            const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7 && diffDays >= 0) {
              return (
                <View style={styles.vaccinationAlert}>
                  <MaterialCommunityIcons name="needle" size={14} color="#F39C12" />
                  <Text style={styles.vaccinationText}>
                    Vaccination dans {diffDays}j
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  // Modal fiche complète de l'animal
  const renderFicheAnimal = () => {
    if (!selectedAnimal) return null;

    return (
      <Modal
        visible={ficheModalVisible}
        animationType="slide"
        onRequestClose={() => setFicheModalVisible(false)}
        presentationStyle={isLargeScreen ? 'pageSheet' : 'fullScreen'}
      >
        <View style={styles.modalContainer}>
          {/* En-tête modal */}
          <View style={[
            styles.modalHeader,
            isLargeScreen && styles.modalHeaderLarge
          ]}>
            <TouchableOpacity 
              onPress={() => setFicheModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <MaterialIcons name="close" size={28} color="#2C3E50" />
            </TouchableOpacity>
            
            <Text style={[
              styles.modalTitle,
              isLargeScreen && styles.modalTitleLarge
            ]}>
              Fiche Animal
            </Text>
            
            <View style={styles.modalHeaderActions}>
              <IconButton
                icon="share-variant"
                size={24}
                onPress={() => {/* Partager la fiche */}}
              />
              <IconButton
                icon="printer"
                size={24}
                onPress={() => {/* Imprimer la fiche */}}
              />
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Photo et informations principales */}
            <View style={[
              styles.animalMainInfo,
              isLargeScreen && styles.animalMainInfoLarge
            ]}>
              <Image 
                source={{ 
                  uri: selectedAnimal.photo || 
                    'https://via.placeholder.com/200?text=Animal' 
                }}
                style={[
                  styles.animalPhotoModal,
                  isLargeScreen && styles.animalPhotoModalLarge
                ]}
                resizeMode="cover"
              />
              
              <View style={styles.animalMainDetails}>
                <Text style={[
                  styles.animalNameModal,
                  isLargeScreen && styles.animalNameModalLarge
                ]}>
                  {selectedAnimal.nom_animal || selectedAnimal.numero_identification}
                </Text>
                
                <Text style={styles.animalSpecies}>
                  {selectedAnimal.espece} - {selectedAnimal.race}
                </Text>
                
                <View style={styles.animalTags}>
                  <Chip 
                    style={[
                      styles.statusChipModal,
                      { backgroundColor: getHealthColor(selectedAnimal.statut_sante) }
                    ]}
                    textStyle={styles.statusChipTextModal}
                  >
                    {getHealthLabel(selectedAnimal.statut_sante)}
                  </Chip>
                  
                  <Chip 
                    style={styles.genderChipModal}
                    icon={selectedAnimal.sexe === 'male' ? 'gender-male' : 'gender-female'}
                  >
                    {selectedAnimal.sexe === 'male' ? 'Mâle' : 'Femelle'}
                  </Chip>
                  
                  {selectedAnimal.type_animal && (
                    <Chip style={styles.typeChipModal}>
                      {selectedAnimal.type_animal}
                    </Chip>
                  )}
                </View>
              </View>
            </View>

            {/* Grille d'informations pour grand écran */}
            <View style={[
              styles.cardsGrid,
              isLargeScreen && styles.cardsGridLarge
            ]}>
              {/* Informations générales */}
              <Card style={[
                styles.infoCard,
                isLargeScreen && styles.infoCardLarge
              ]}>
                <Card.Content>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons 
                      name="information" 
                      size={24} 
                      color="#3498DB" 
                    />
                    <Title style={styles.sectionTitle}>
                      Informations générales
                    </Title>
                  </View>
                  
                  <Divider style={styles.sectionDivider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>N° Identification</Text>
                    <Text style={styles.infoValue}>
                      {selectedAnimal.numero_identification}
                    </Text>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date de naissance</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(selectedAnimal.date_naissance)}
                    </Text>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Âge</Text>
                    <Text style={styles.infoValue}>
                      {calculateAge(selectedAnimal.date_naissance)}
                    </Text>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Poids actuel</Text>
                    <Text style={styles.infoValue}>
                      {selectedAnimal.poids_actuel || '-'} kg
                    </Text>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Origine</Text>
                    <Text style={styles.infoValue}>
                      {selectedAnimal.origine || '-'}
                    </Text>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date d'acquisition</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(selectedAnimal.date_acquisition)}
                    </Text>
                  </View>
                  
                  {selectedAnimal.marques_distinctives && (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.infoColumn}>
                        <Text style={styles.infoLabel}>Marques distinctives</Text>
                        <Text style={styles.infoValueMultiline}>
                          {selectedAnimal.marques_distinctives}
                        </Text>
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>

              {/* État de santé */}
              <Card style={[
                styles.infoCard,
                isLargeScreen && styles.infoCardLarge
              ]}>
                <Card.Content>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons 
                      name="heart-pulse" 
                      size={24} 
                      color="#E74C3C" 
                    />
                    <Title style={styles.sectionTitle}>État de santé</Title>
                  </View>
                  
                  <Divider style={styles.sectionDivider} />
                  
                  {/* Statut sanitaire */}
                  <View style={styles.healthStatus}>
                    <View style={[
                      styles.healthIconContainer,
                      { backgroundColor: getHealthColor(selectedAnimal.statut_sante) + '20' }
                    ]}>
                      <MaterialCommunityIcons 
                        name={getHealthIcon(selectedAnimal.statut_sante)} 
                        size={40} 
                        color={getHealthColor(selectedAnimal.statut_sante)} 
                      />
                    </View>
                    <View style={styles.healthInfo}>
                      <Text style={styles.healthLabel}>Statut sanitaire</Text>
                      <Text style={[
                        styles.healthValue,
                        { color: getHealthColor(selectedAnimal.statut_sante) }
                      ]}>
                        {getHealthLabel(selectedAnimal.statut_sante)}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Alerte surveillance */}
                  {selectedAnimal.raison_surveillance && (
                    <View style={styles.surveillanceAlert}>
                      <MaterialIcons name="warning" size={20} color="#E74C3C" />
                      <View style={styles.surveillanceContent}>
                        <Text style={styles.surveillanceTitle}>
                          Raison de surveillance
                        </Text>
                        <Text style={styles.surveillanceText}>
                          {selectedAnimal.raison_surveillance}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Informations vaccination */}
                  <View style={styles.vaccinationInfo}>
                    <View style={styles.vaccinationRow}>
                      <MaterialCommunityIcons 
                        name="needle" 
                        size={24} 
                        color="#F39C12" 
                      />
                      <View style={styles.vaccinationDetails}>
                        <Text style={styles.vaccinationLabel}>
                          Dernière vaccination
                        </Text>
                        <Text style={styles.vaccinationDate}>
                          {selectedAnimal.derniere_vaccination 
                            ? formatDate(selectedAnimal.derniere_vaccination)
                            : 'Aucune vaccination enregistrée'}
                        </Text>
                      </View>
                    </View>
                    
                    {selectedAnimal.prochaine_vaccination && (
                      <>
                        <Divider style={styles.divider} />
                        <View style={styles.vaccinationRow}>
                          <MaterialCommunityIcons 
                            name="calendar-clock" 
                            size={24} 
                            color="#3498DB" 
                          />
                          <View style={styles.vaccinationDetails}>
                            <Text style={styles.vaccinationLabel}>
                              Prochaine vaccination
                            </Text>
                            <Text style={[
                              styles.vaccinationDate,
                              { color: isVaccinationDue(selectedAnimal.prochaine_vaccination) 
                                ? '#E74C3C' 
                                : '#2C3E50' 
                              }
                            ]}>
                              {formatDate(selectedAnimal.prochaine_vaccination)}
                              {isVaccinationDue(selectedAnimal.prochaine_vaccination) && 
                                ' (À faire bientôt!)'}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </Card.Content>
              </Card>

              {/* Production (si applicable) */}
              {selectedAnimal.statut_production && 
               selectedAnimal.statut_production !== 'non_productif' && (
                <Card style={[
                  styles.infoCard,
                  isLargeScreen && styles.infoCardLarge
                ]}>
                  <Card.Content>
                    <View style={styles.cardTitleRow}>
                      <MaterialCommunityIcons 
                        name="truck-delivery" 
                        size={24} 
                        color="#2ECC71" 
                      />
                      <Title style={styles.sectionTitle}>Production</Title>
                    </View>
                    
                    <Divider style={styles.sectionDivider} />
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Statut de production</Text>
                      <Text style={styles.infoValue}>
                        {selectedAnimal.statut_production}
                      </Text>
                    </View>
                    
                    {selectedAnimal.debut_production && (
                      <>
                        <Divider style={styles.divider} />
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Début de production</Text>
                          <Text style={styles.infoValue}>
                            {formatDate(selectedAnimal.debut_production)}
                          </Text>
                        </View>
                      </>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Généalogie */}
              {(selectedAnimal.mere_numero || selectedAnimal.pere_numero) && (
                <Card style={[
                  styles.infoCard,
                  isLargeScreen && styles.infoCardLarge
                ]}>
                  <Card.Content>
                    <View style={styles.cardTitleRow}>
                      <MaterialCommunityIcons 
                        name="family-tree" 
                        size={24} 
                        color="#9B59B6" 
                      />
                      <Title style={styles.sectionTitle}>Généalogie</Title>
                    </View>
                    
                    <Divider style={styles.sectionDivider} />
                    
                    {selectedAnimal.mere_numero && (
                      <>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Mère</Text>
                          <Text style={styles.infoValue}>
                            {selectedAnimal.mere_numero}
                          </Text>
                        </View>
                        <Divider style={styles.divider} />
                      </>
                    )}
                    
                    {selectedAnimal.pere_numero && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Père</Text>
                        <Text style={styles.infoValue}>
                          {selectedAnimal.pere_numero}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Historique médical récent */}
              <Card style={[
                styles.infoCard,
                isLargeScreen && styles.infoCardLarge,
                styles.historyCard
              ]}>
                <Card.Content>
                  <View style={styles.historyHeader}>
                    <View style={styles.cardTitleRow}>
                      <MaterialCommunityIcons 
                        name="history" 
                        size={24} 
                        color="#1ABC9C" 
                      />
                      <Title style={styles.sectionTitle}>
                        Historique médical
                      </Title>
                    </View>
                    <Button
                      mode="text"
                      onPress={() => {
                        setFicheModalVisible(false);
                        navigation.navigate('HistoriqueMedical', { 
                          animalId: selectedAnimal.id,
                          animalNom: selectedAnimal.nom_animal || 
                            selectedAnimal.numero_identification
                        });
                      }}
                      compact
                    >
                      Voir tout
                    </Button>
                  </View>
                  
                  <Divider style={styles.sectionDivider} />
                  
                  {selectedAnimal.historique_recent && 
                   selectedAnimal.historique_recent.length > 0 ? (
                    selectedAnimal.historique_recent.slice(0, 5).map((item, index) => (
                      <TouchableOpacity
                        key={item.id || index}
                        style={styles.historyItem}
                        onPress={() => {
                          setFicheModalVisible(false);
                          navigation.navigate('InterventionDetails', { 
                            interventionId: item.id 
                          });
                        }}
                      >
                        <View style={[
                          styles.historyIcon,
                          { backgroundColor: getInterventionColor(item.type_intervention) + '20' }
                        ]}>
                          <MaterialCommunityIcons 
                            name={getInterventionIcon(item.type_intervention)} 
                            size={24} 
                            color={getInterventionColor(item.type_intervention)} 
                          />
                        </View>
                        
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyType}>
                            {item.type_label || item.type_intervention}
                          </Text>
                          <Text style={styles.historyDiagnostic} numberOfLines={2}>
                            {item.diagnostic}
                          </Text>
                          <View style={styles.historyMeta}>
                            <Text style={styles.historyDate}>
                              {formatDate(item.date_intervention)}
                            </Text>
                            {item.veterinaire_nom && (
                              <>
                                <Text style={styles.historySeparator}> • </Text>
                                <Text style={styles.historyVet}>
                                  Dr. {item.veterinaire_nom}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                        
                        <MaterialIcons name="chevron-right" size={24} color="#BDC3C7" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyHistory}>
                      <MaterialCommunityIcons 
                        name="clipboard-text-off" 
                        size={48} 
                        color="#BDC3C7" 
                      />
                      <Text style={styles.noHistoryText}>
                        Aucun historique médical enregistré
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </View>

            {/* Boutons d'action */}
            <View style={[
              styles.actionButtons,
              isLargeScreen && styles.actionButtonsLarge
            ]}>
              <Button
                mode="contained"
                icon="medical-bag"
                onPress={() => {
                  setFicheModalVisible(false);
                  navigation.navigate('Interventions', { 
                    action: 'create',
                    animalId: selectedAnimal.id,
                    animalNom: selectedAnimal.nom_animal || 
                      selectedAnimal.numero_identification
                  });
                }}
                style={[styles.actionButton, styles.actionButtonPrimary]}
                labelStyle={styles.actionButtonLabel}
              >
                Nouvelle intervention
              </Button>
              
              <Button
                mode="contained"
                icon="needle"
                onPress={() => {
                  setFicheModalVisible(false);
                  navigation.navigate('Interventions', { 
                    action: 'vaccination',
                    animalId: selectedAnimal.id,
                    animalNom: selectedAnimal.nom_animal || 
                      selectedAnimal.numero_identification
                  });
                }}
                style={[styles.actionButton, styles.actionButtonWarning]}
                labelStyle={styles.actionButtonLabel}
              >
                Vacciner
              </Button>

              <View style={styles.actionButtonRow}>
                <Button
                  mode="outlined"
                  icon="history"
                  onPress={() => {
                    setFicheModalVisible(false);
                    navigation.navigate('HistoriqueMedical', { 
                      animalId: selectedAnimal.id,
                      animalNom: selectedAnimal.nom_animal || 
                        selectedAnimal.numero_identification
                    });
                  }}
                  style={[styles.actionButton, styles.actionButtonOutlined]}
                  compact
                >
                  Historique complet
                </Button>

                <Button
                  mode="outlined"
                  icon="pencil"
                  onPress={() => {
                    setFicheModalVisible(false);
                    navigation.navigate('EditerAnimal', { 
                      animalId: selectedAnimal.id 
                    });
                  }}
                  style={[styles.actionButton, styles.actionButtonOutlined]}
                  compact
                >
                  Modifier
                </Button>
              </View>
            </View>

            <View style={styles.modalBottomSpacing} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Liste vide
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name="cow-off" 
        size={isLargeScreen ? 80 : 60} 
        color="#BDC3C7" 
      />
      <Text style={[
        styles.emptyText,
        isLargeScreen && styles.emptyTextLarge
      ]}>
        Aucun animal trouvé
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery 
          ? 'Essayez avec d\'autres critères de recherche'
          : 'Ajustez vos filtres ou ajoutez un nouvel animal'}
      </Text>
    </View>
  );

  // Footer de la liste (chargement)
  const renderFooter = () => {
    if (!loading || refreshing) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3498DB" />
        <Text style={styles.footerText}>Chargement...</Text>
      </View>
    );
  };

  // === FONCTIONS UTILITAIRES === //

  const getHealthIcon = (statut) => {
    const icons = {
      excellent: 'heart-pulse',
      bon: 'heart',
      moyen: 'alert-circle',
      malade: 'alert',
      en_traitement: 'pill',
      critique: 'alert-octagon'
    };
    return icons[statut] || 'help-circle';
  };

  const getHealthColor = (statut) => {
    const colors = {
      excellent: '#2ECC71',
      bon: '#3498DB',
      moyen: '#F39C12',
      malade: '#E74C3C',
      en_traitement: '#9B59B6',
      critique: '#C0392B'
    };
    return colors[statut] || '#95A5A6';
  };

  const getHealthLabel = (statut) => {
    const labels = {
      excellent: 'Excellent',
      bon: 'Bon',
      moyen: 'Moyen',
      malade: 'Malade',
      en_traitement: 'En traitement',
      critique: 'Critique'
    };
    return labels[statut] || statut;
  };

  const getInterventionIcon = (type) => {
    const icons = {
      vaccination: 'needle',
      traitement: 'pill',
      consultation: 'stethoscope',
      chirurgie: 'hospital-box',
      analyse: 'flask',
      controle: 'clipboard-check'
    };
    return icons[type] || 'medical-bag';
  };

  const getInterventionColor = (type) => {
    const colors = {
      vaccination: '#F39C12',
      traitement: '#E74C3C',
      consultation: '#3498DB',
      chirurgie: '#9B59B6',
      analyse: '#1ABC9C',
      controle: '#2ECC71'
    };
    return colors[type] || '#95A5A6';
  };

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return '-';
    
    const birth = new Date(dateNaissance);
    const today = new Date();
    const ageMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                      (today.getMonth() - birth.getMonth());
    
    if (ageMonths < 1) return 'Moins d\'1 mois';
    if (ageMonths < 12) return `${ageMonths} mois`;
    
    const years = Math.floor(ageMonths / 12);
    const months = ageMonths % 12;
    
    if (months === 0) {
      return `${years} an${years > 1 ? 's' : ''}`;
    }
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
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

  const isVaccinationDue = (dateString) => {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    return diffDays <= 7 && diffDays >= 0;
  };

  // === RENDU PRINCIPAL === //

  if (loading && !refreshing && animaux.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Chargement des animaux...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSearchBar()}
      {renderFilters()}

      <FlatList
        data={animaux}
        renderItem={renderAnimalItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          isLargeScreen && styles.listContainerLarge
        ]}
        numColumns={numColumns}
        key={numColumns} // Force re-render quand colonnes changent
        ListEmptyComponent={renderEmptyList}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498DB']}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {renderFicheAnimal()}
    </View>
  );
};

// === STYLES === //

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
  },

  // Header
  header: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerLarge: {
    paddingHorizontal: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 10,
  },
  statsRowLarge: {
    marginHorizontal: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ECF0F1',
    marginHorizontal: 15,
  },

  // Search
  searchContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  searchBar: {
    backgroundColor: '#F8F9FA',
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },

  // Filtres
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  filterScroll: {
    paddingHorizontal: 15,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F8F9FA',
  },
  filterChipSelected: {
    backgroundColor: '#3498DB',
  },

  // Liste
  listContainer: {
    padding: 15,
  },
  listContainerLarge: {
    padding: 20,
  },

  // Carte animal
  animalCard: {
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
  animalCardLarge: {
    marginHorizontal: 10,
  },
  animalImageContainer: {
    position: 'relative',
  },
  animalPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: '#ECF0F1',
  },
  animalPhotoLarge: {
    height: 200,
  },
  healthBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
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
  especeChip: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  especeChipText: {
    color: '#FFF',
    fontSize: 12,
  },
  animalInfo: {
    padding: 15,
  },
  animalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  animalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  animalNameLarge: {
    fontSize: 18,
  },
  genderIcon: {
    marginLeft: 8,
  },
  animalDetails: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  animalMeta: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  metaText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 4,
  },
  animalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    height: 26,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  interventionBadge: {
    backgroundColor: '#3498DB',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#E74C3C',
  },
  vaccinationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  vaccinationText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#F39C12',
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  emptyTextLarge: {
    fontSize: 18,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Footer
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7F8C8D',
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
  modalHeaderLarge: {
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
  modalTitleLarge: {
    fontSize: 22,
  },
  modalHeaderActions: {
    flexDirection: 'row',
  },
  modalContent: {
    flex: 1,
  },

  // Info principale animal (modal)
  animalMainInfo: {
    backgroundColor: '#FFF',
    padding: 25,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  animalMainInfoLarge: {
    padding: 40,
  },
  animalPhotoModal: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ECF0F1',
    marginBottom: 20,
  },
  animalPhotoModalLarge: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  animalMainDetails: {
    alignItems: 'center',
  },
  animalNameModal: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 6,
    textAlign: 'center',
  },
  animalNameModalLarge: {
    fontSize: 30,
  },
  animalSpecies: {
    fontSize: 17,
    color: '#7F8C8D',
    marginBottom: 15,
  },
  animalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  statusChipModal: {
    marginHorizontal: 4,
  },
  statusChipTextModal: {
    color: '#FFF',
    fontWeight: '600',
  },
  genderChipModal: {
    backgroundColor: '#ECF0F1',
    marginHorizontal: 4,
  },
  typeChipModal: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 4,
  },

  // Grille de cartes
  cardsGrid: {
    padding: 15,
  },
  cardsGridLarge: {
    padding: 20,
  },

  // Cartes d'info
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 15,
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
  infoCardLarge: {
    marginBottom: 20,
  },
  historyCard: {
    minHeight: 200,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  sectionDivider: {
    marginVertical: 15,
    backgroundColor: '#ECF0F1',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoColumn: {
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoValueMultiline: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 20,
  },
  divider: {
    marginVertical: 6,
    backgroundColor: '#ECF0F1',
  },

  // Santé
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  healthIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthInfo: {
    marginLeft: 15,
    flex: 1,
  },
  healthLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  healthValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  surveillanceAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  surveillanceContent: {
    flex: 1,
    marginLeft: 12,
  },
  surveillanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
    marginBottom: 4,
  },
  surveillanceText: {
    fontSize: 13,
    color: '#E74C3C',
    lineHeight: 18,
  },

  // Vaccination
  vaccinationInfo: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
  },
  vaccinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  vaccinationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  vaccinationLabel: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  vaccinationDate: {
    fontSize: 15,
    color: '#2C3E50',
    fontWeight: '500',
    marginTop: 4,
  },

  // Historique
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  historyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  historyDiagnostic: {
    fontSize: 13,
    color: '#7F8C8D',
    lineHeight: 18,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyDate: {
    fontSize: 12,
    color: '#95A5A6',
  },
  historySeparator: {
    fontSize: 12,
    color: '#BDC3C7',
  },
  historyVet: {
    fontSize: 12,
    color: '#95A5A6',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noHistoryText: {
    marginTop: 12,
    fontSize: 14,
    color: '#95A5A6',
    fontStyle: 'italic',
  },

  // Actions
  actionButtons: {
    padding: 15,
  },
  actionButtonsLarge: {
    padding: 20,
  },
  actionButton: {
    marginBottom: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#3498DB',
  },
  actionButtonWarning: {
    backgroundColor: '#F39C12',
  },
  actionButtonOutlined: {
    flex: 1,
    marginHorizontal: 5,
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Spacing
  modalBottomSpacing: {
    height: 30,
  },
});

export default AnimauxScreen;