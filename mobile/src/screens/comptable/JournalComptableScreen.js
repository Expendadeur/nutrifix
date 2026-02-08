// frontend/src/screens/comptable/JournalComptableScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Platform,
  Alert,
  Share
} from 'react-native';
import {
  Card,
  Title,
  Searchbar,
  Chip,
  Menu,
  Divider,
  ActivityIndicator,
  IconButton,
  Button,
  Portal,
  Modal,
  DataTable
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import comptabiliteService from '../../services/comptabiliteService';

const JournalComptableScreen = () => {
  // =============================================
  // STATES
  // =============================================
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mouvements, setMouvements] = useState([]);
  const [filteredMouvements, setFilteredMouvements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [totaux, setTotaux] = useState({ 
    total_entrees: 0, 
    total_sorties: 0, 
    solde: 0,
    nombre_operations: 0 
  });
  const [repartition, setRepartition] = useState([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMouvement, setSelectedMouvement] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // =============================================
  // CONFIGURATION
  // =============================================
  const categories = [
    { id: 'all', label: 'Tous', icon: 'view-list', color: '#95A5A6' },
    { id: 'stock', label: 'Stock', icon: 'inventory', color: '#3498DB' },
    { id: 'paiement', label: 'Paiement', icon: 'payment', color: '#2ECC71' },
    { id: 'vente', label: 'Vente', icon: 'shopping-cart', color: '#27AE60' },
    { id: 'achat', label: 'Achat', icon: 'shopping-bag', color: '#E74C3C' },
    { id: 'salaire', label: 'Salaire', icon: 'account-balance-wallet', color: '#F39C12' },
    { id: 'production', label: 'Production', icon: 'agriculture', color: '#9B59B6' },
    { id: 'maintenance', label: 'Maintenance', icon: 'build', color: '#E67E22' },
  ];

  const types = [
    { id: 'all', label: 'Tous les types' },
    { id: 'entree', label: 'Entrées' },
    { id: 'sortie', label: 'Sorties' },
    { id: 'recette', label: 'Recettes' },
    { id: 'depense', label: 'Dépenses' },
  ];

  // =============================================
  // EFFECTS
  // =============================================
  useEffect(() => {
    loadJournal();
  }, [selectedCategory, selectedType, startDate, endDate, page]);

  useEffect(() => {
    filterMouvements();
  }, [mouvements, searchQuery]);

  // =============================================
  // LOAD DATA
  // =============================================
  const loadJournal = useCallback(async () => {
    try {
      setLoading(true);
      const data = await comptabiliteService.getJournalComptableComplet({
        categorie: selectedCategory,
        type_mouvement: selectedType,
        startDate: formatDateForAPI(startDate),
        endDate: formatDateForAPI(endDate),
        page: page,
        limit: itemsPerPage
      });

      setMouvements(data.mouvements || []);
      setTotaux(data.totaux || { 
        total_entrees: 0, 
        total_sorties: 0, 
        solde: 0,
        nombre_operations: 0 
      });
      setRepartition(data.repartition || []);
      
      if (data.pagination) {
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Journal error:', error);
      Alert.alert('Erreur', 'Impossible de charger le journal comptable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedType, startDate, endDate, page, itemsPerPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadJournal();
  }, [loadJournal]);

  // =============================================
  // FILTER
  // =============================================
  const filterMouvements = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredMouvements(mouvements);
      return;
    }

    const filtered = mouvements.filter(mouvement => {
      const searchLower = searchQuery.toLowerCase();
      return (
        mouvement.libelle?.toLowerCase().includes(searchLower) ||
        mouvement.description?.toLowerCase().includes(searchLower) ||
        mouvement.reference_externe?.toLowerCase().includes(searchLower) ||
        mouvement.tiers_nom?.toLowerCase().includes(searchLower) ||
        mouvement.effectue_par_nom?.toLowerCase().includes(searchLower) ||
        mouvement.numero_ecriture?.toLowerCase().includes(searchLower)
      );
    });

    setFilteredMouvements(filtered);
  }, [mouvements, searchQuery]);

  // =============================================
  // EXPORT FUNCTIONS
  // =============================================
  const exportToExcel = async () => {
    try {
      setExportLoading(true);
      setMenuVisible(false);

      const response = await comptabiliteService.exportJournalExcel({
        categorie: selectedCategory,
        type_mouvement: selectedType,
        startDate: formatDateForAPI(startDate),
        endDate: formatDateForAPI(endDate)
      });

      if (response && response.data) {
        const filename = `Journal_Comptable_${formatDateForAPI(startDate)}_${formatDateForAPI(endDate)}.xlsx`;
        const fileUri = FileSystem.documentDirectory + filename;

        // Convertir base64 en fichier
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Partager le fichier
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exporter le journal comptable',
          });
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }
    } catch (error) {
      console.error('Export Excel error:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter en Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      setMenuVisible(false);

      const response = await comptabiliteService.exportJournalPDF({
        categorie: selectedCategory,
        type_mouvement: selectedType,
        startDate: formatDateForAPI(startDate),
        endDate: formatDateForAPI(endDate)
      });

      if (response && response.data) {
        const filename = `Journal_Comptable_${formatDateForAPI(startDate)}_${formatDateForAPI(endDate)}.pdf`;
        const fileUri = FileSystem.documentDirectory + filename;

        // Convertir base64 en fichier
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Partager le fichier
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Exporter le journal comptable',
          });
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }
    } catch (error) {
      console.error('Export PDF error:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter en PDF');
    } finally {
      setExportLoading(false);
    }
  };

  // =============================================
  // FORMATTING FUNCTIONS
  // =============================================
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5); // HH:MM
  };

  const formatDateForAPI = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getCategoryIcon = (categorie) => {
    const cat = categories.find(c => c.id === categorie);
    return cat ? cat.icon : 'receipt';
  };

  const getCategoryColor = (categorie) => {
    const cat = categories.find(c => c.id === categorie);
    return cat ? cat.color : '#95A5A6';
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'entree':
      case 'recette':
        return '#27AE60';
      case 'sortie':
      case 'depense':
        return '#E74C3C';
      default:
        return '#7F8C8D';
    }
  };

  // =============================================
  // RENDER FUNCTIONS
  // =============================================
  const renderMouvementItem = ({ item, index }) => {
    const categoryColor = getCategoryColor(item.categorie);
    const isDebit = item.type_mouvement === 'sortie' || item.type_mouvement === 'depense';
    const montant = parseFloat(item.montant) || 0;

    return (
      <TouchableOpacity 
        style={[styles.mouvementItem, index % 2 === 0 && styles.mouvementItemEven]}
        onPress={() => {
          setSelectedMouvement(item);
          setDetailModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        {/* Indicateur de catégorie */}
        <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]} />

        {/* Contenu principal */}
        <View style={styles.mouvementContent}>
          {/* En-tête */}
          <View style={styles.mouvementHeader}>
            <View style={styles.mouvementHeaderLeft}>
              <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
                <MaterialIcons 
                  name={getCategoryIcon(item.categorie)} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </View>
              <View style={styles.mouvementHeaderInfo}>
                <Text style={styles.mouvementNumero} numberOfLines={1}>
                  {item.numero_ecriture}
                </Text>
                <Text style={styles.mouvementLibelle} numberOfLines={1}>
                  {item.libelle}
                </Text>
                <Text style={styles.mouvementDate}>
                  {formatDate(item.date_operation)} • {formatTime(item.heure_operation)} • {item.categorie}
                </Text>
              </View>
            </View>

            <View style={styles.mouvementHeaderRight}>
              <Text style={[
                styles.mouvementMontant,
                { color: getTypeColor(item.type_mouvement) }
              ]}>
                {isDebit ? '-' : '+'}
                {formatCurrency(montant)}
              </Text>
              <View style={[
                styles.typeBadge,
                { backgroundColor: getTypeColor(item.type_mouvement) + '20' }
              ]}>
                <Text style={[
                  styles.typeText,
                  { color: getTypeColor(item.type_mouvement) }
                ]}>
                  {item.type_mouvement}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {item.description && (
            <Text style={styles.mouvementDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Détails complémentaires */}
          <View style={styles.mouvementDetails}>
            {item.tiers_nom && (
              <View style={styles.detailRow}>
                <MaterialIcons name="person" size={14} color="#7F8C8D" />
                <Text style={styles.detailText}>{item.tiers_nom}</Text>
              </View>
            )}

            {item.effectue_par_nom && (
              <View style={styles.detailRow}>
                <MaterialIcons name="account-circle" size={14} color="#7F8C8D" />
                <Text style={styles.detailText}>Par: {item.effectue_par_nom}</Text>
              </View>
            )}

            {item.quantite && (
              <View style={styles.detailRow}>
                <MaterialIcons name="inventory" size={14} color="#7F8C8D" />
                <Text style={styles.detailText}>
                  {item.quantite} {item.unite_mesure}
                </Text>
              </View>
            )}

            {item.reference_externe && (
              <View style={styles.detailRow}>
                <MaterialIcons name="link" size={14} color="#7F8C8D" />
                <Text style={styles.detailText}>Réf: {item.reference_externe}</Text>
              </View>
            )}
          </View>

          {/* Écriture comptable */}
          {(item.compte_debit || item.compte_credit) && (
            <View style={styles.ecritureComptable}>
              <View style={styles.ecritureRow}>
                <Text style={styles.ecritureLabel}>Débit:</Text>
                <Text style={styles.ecritureValue} numberOfLines={1}>
                  {item.compte_debit || '-'}
                </Text>
              </View>
              <View style={styles.ecritureRow}>
                <Text style={styles.ecritureLabel}>Crédit:</Text>
                <Text style={styles.ecritureValue} numberOfLines={1}>
                  {item.compte_credit || '-'}
                </Text>
              </View>
            </View>
          )}

          {/* Statut */}
          {item.statut && item.statut !== 'valide' && (
            <View style={styles.statutContainer}>
              <Chip
                mode="flat"
                style={[styles.statutChip, { backgroundColor: getStatutColor(item.statut) + '20' }]}
                textStyle={[styles.statutText, { color: getStatutColor(item.statut) }]}
              >
                {item.statut}
              </Chip>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getStatutColor = (statut) => {
    switch(statut) {
      case 'valide': return '#2ECC71';
      case 'brouillon': return '#F39C12';
      case 'lettre': return '#3498DB';
      case 'rapproche': return '#9B59B6';
      default: return '#95A5A6';
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Titre et menu */}
      <View style={styles.headerTop}>
        <View>
          <Title style={styles.headerTitle}>Journal Comptable</Title>
          <Text style={styles.headerSubtitle}>
            Toutes les opérations comptables
          </Text>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={() => setMenuVisible(true)}
              iconColor="#2E86C1"
            />
          }
        >
          <Menu.Item 
            onPress={exportToExcel} 
            title="Exporter en Excel"
            leadingIcon="file-excel"
            disabled={exportLoading}
          />
          <Menu.Item 
            onPress={exportToPDF} 
            title="Exporter en PDF"
            leadingIcon="file-pdf"
            disabled={exportLoading}
          />
          <Divider />
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              onRefresh();
            }} 
            title="Actualiser"
            leadingIcon="refresh"
          />
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              // Afficher les statistiques détaillées
              showStatisticsModal();
            }} 
            title="Statistiques"
            leadingIcon="chart-bar"
          />
        </Menu>
      </View>

      {/* Filtres de période */}
      <View style={styles.periodFilter}>
        <TouchableOpacity 
          style={styles.dateButton}
          onPress={() => setShowStartPicker(true)}
        >
          <MaterialIcons name="calendar-today" size={16} color="#2E86C1" />
          <Text style={styles.dateButtonText}>
            Du {formatDate(startDate)}
          </Text>
        </TouchableOpacity>

        <View style={styles.dateSeparator}>
          <MaterialIcons name="arrow-forward" size={16} color="#7F8C8D" />
        </View>

        <TouchableOpacity 
          style={styles.dateButton}
          onPress={() => setShowEndPicker(true)}
        >
          <MaterialIcons name="calendar-today" size={16} color="#2E86C1" />
          <Text style={styles.dateButtonText}>
            Au {formatDate(endDate)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtres de catégorie */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && { 
                backgroundColor: category.color,
                borderColor: category.color 
              }
            ]}
            onPress={() => {
              setSelectedCategory(category.id);
              setPage(1);
            }}
          >
            <MaterialIcons 
              name={category.icon} 
              size={18} 
              color={selectedCategory === category.id ? '#FFFFFF' : category.color} 
            />
            <Text style={[
              styles.categoryChipText,
              selectedCategory === category.id && styles.categoryChipTextActive
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtres de type */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.typeFilter}
      >
        {types.map((type) => (
          <Chip
            key={type.id}
            selected={selectedType === type.id}
            onPress={() => {
              setSelectedType(type.id);
              setPage(1);
            }}
            style={styles.typeChip}
            textStyle={styles.typeChipText}
            selectedColor="#2E86C1"
          >
            {type.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Recherche */}
      <Searchbar
        placeholder="Rechercher dans le journal..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        iconColor="#2E86C1"
      />

      {/* Résumé */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Résumé de la période</Text>
            <Text style={styles.summarySubtitle}>
              {totaux.nombre_operations || filteredMouvements.length} opération(s)
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: '#D5F4E6' }]}>
                <MaterialIcons name="trending-up" size={24} color="#27AE60" />
              </View>
              <Text style={styles.summaryLabel}>Entrées/Recettes</Text>
              <Text style={[styles.summaryValue, { color: '#27AE60' }]}>
                {formatCurrency(totaux.total_entrees)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: '#FADBD8' }]}>
                <MaterialIcons name="trending-down" size={24} color="#E74C3C" />
              </View>
              <Text style={styles.summaryLabel}>Sorties/Dépenses</Text>
              <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
                {formatCurrency(totaux.total_sorties)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: '#E8F4F8' }]}>
                <MaterialIcons name="account-balance" size={24} color="#2E86C1" />
              </View>
              <Text style={styles.summaryLabel}>Solde</Text>
              <Text style={[
                styles.summaryValue,
                { color: totaux.solde >= 0 ? '#27AE60' : '#E74C3C' }
              ]}>
                {formatCurrency(totaux.solde)}
              </Text>
            </View>
          </View>

          {/* Répartition par catégorie */}
          {repartition && repartition.length > 0 && (
            <View style={styles.repartitionContainer}>
              <Text style={styles.repartitionTitle}>Répartition par catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {repartition.map((rep, index) => {
                  const categoryColor = getCategoryColor(rep.categorie);
                  return (
                    <View key={index} style={styles.repartitionItem}>
                      <View style={[styles.repartitionIcon, { backgroundColor: categoryColor }]}>
                        <MaterialIcons 
                          name={getCategoryIcon(rep.categorie)} 
                          size={16} 
                          color="#FFF" 
                        />
                      </View>
                      <Text style={styles.repartitionLabel}>{rep.categorie}</Text>
                      <Text style={styles.repartitionValue}>
                        {formatCurrency(rep.total_montant)}
                      </Text>
                      <Text style={styles.repartitionCount}>
                        {rep.nombre} opération(s)
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Pagination info */}
      {totalPages > 1 && (
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            Page {page} sur {totalPages}
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (totalPages <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
          onPress={() => page > 1 && setPage(page - 1)}
          disabled={page === 1}
        >
          <MaterialIcons name="chevron-left" size={24} color={page === 1 ? '#BDC3C7' : '#2E86C1'} />
          <Text style={[styles.paginationButtonText, page === 1 && styles.paginationButtonTextDisabled]}>
            Précédent
          </Text>
        </TouchableOpacity>

        <View style={styles.paginationNumbers}>
          {renderPaginationNumbers()}
        </View>

        <TouchableOpacity
          style={[styles.paginationButton, page === totalPages && styles.paginationButtonDisabled]}
          onPress={() => page < totalPages && setPage(page + 1)}
          disabled={page === totalPages}
        >
          <Text style={[styles.paginationButtonText, page === totalPages && styles.paginationButtonTextDisabled]}>
            Suivant
          </Text>
          <MaterialIcons name="chevron-right" size={24} color={page === totalPages ? '#BDC3C7' : '#2E86C1'} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderPaginationNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <TouchableOpacity
          key={i}
          style={[styles.pageNumber, i === page && styles.pageNumberActive]}
          onPress={() => setPage(i)}
        >
          <Text style={[styles.pageNumberText, i === page && styles.pageNumberTextActive]}>
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return pages;
  };

  const renderDetailModal = () => {
    if (!selectedMouvement) return null;

    const categoryColor = getCategoryColor(selectedMouvement.categorie);
    const isDebit = selectedMouvement.type_mouvement === 'sortie' || selectedMouvement.type_mouvement === 'depense';
    const montant = parseFloat(selectedMouvement.montant) || 0;

    // Parser les données complémentaires
    let donneesComplementaires = null;
    if (selectedMouvement.donnees_complementaires) {
      try {
        donneesComplementaires = typeof selectedMouvement.donnees_complementaires === 'string' 
          ? JSON.parse(selectedMouvement.donnees_complementaires)
          : selectedMouvement.donnees_complementaires;
      } catch (e) {
        console.error('Error parsing donnees_complementaires:', e);
      }
    }

    return (
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            {/* En-tête du modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalCategoryIcon, { backgroundColor: categoryColor }]}>
                  <MaterialIcons 
                    name={getCategoryIcon(selectedMouvement.categorie)} 
                    size={24} 
                    color="#FFFFFF" 
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Détails de l'écriture</Text>
                  <Text style={styles.modalSubtitle}>{selectedMouvement.numero_ecriture}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            {/* Informations principales */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Informations générales</Text>
              
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Date et heure:</Text>
                <Text style={styles.modalInfoValue}>
                  {formatDate(selectedMouvement.date_operation)} à {formatTime(selectedMouvement.heure_operation)}
                </Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Catégorie:</Text>
                <View style={[styles.modalCategoryBadge, { backgroundColor: categoryColor + '20' }]}>
                  <Text style={[styles.modalCategoryBadgeText, { color: categoryColor }]}>
                    {selectedMouvement.categorie}
                  </Text>
                </View>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Type de mouvement:</Text>
                <View style={[styles.modalTypeBadge, { backgroundColor: getTypeColor(selectedMouvement.type_mouvement) + '20' }]}>
                  <Text style={[styles.modalTypeBadgeText, { color: getTypeColor(selectedMouvement.type_mouvement) }]}>
                    {selectedMouvement.type_mouvement}
                  </Text>
                </View>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Libellé:</Text>
                <Text style={styles.modalInfoValue}>{selectedMouvement.libelle}</Text>
              </View>

              {selectedMouvement.description && (
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Description:</Text>
                  <Text style={styles.modalInfoValue}>{selectedMouvement.description}</Text>
                </View>
              )}

              {selectedMouvement.reference_externe && (
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Référence:</Text>
                  <Text style={styles.modalInfoValue}>{selectedMouvement.reference_externe}</Text>
                </View>
              )}
            </View>

            {/* Montant */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Montant et quantité</Text>
              
              <View style={styles.modalAmountContainer}>
                <Text style={styles.modalAmountLabel}>Montant:</Text>
                <Text style={[
                  styles.modalAmountValue,
                  { color: getTypeColor(selectedMouvement.type_mouvement) }
                ]}>
                  {isDebit ? '-' : '+'}{formatCurrency(montant)}
                </Text>
              </View>

              {selectedMouvement.quantite && (
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Quantité:</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedMouvement.quantite} {selectedMouvement.unite_mesure}
                  </Text>
                </View>
              )}
            </View>

            {/* Écriture comptable */}
            {(selectedMouvement.compte_debit || selectedMouvement.compte_credit) && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Écriture comptable</Text>
                
                <View style={styles.modalEcritureContainer}>
                  <View style={styles.modalEcritureRow}>
                    <Text style={styles.modalEcritureLabel}>Compte Débit:</Text>
                    <Text style={styles.modalEcritureValue}>
                      {selectedMouvement.compte_debit || '-'}
                    </Text>
                  </View>
                  
                  <View style={styles.modalEcritureRow}>
                    <Text style={styles.modalEcritureLabel}>Compte Crédit:</Text>
                    <Text style={styles.modalEcritureValue}>
                      {selectedMouvement.compte_credit || '-'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tiers */}
            {selectedMouvement.tiers_nom && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Tiers</Text>
                
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Type:</Text>
                  <Text style={styles.modalInfoValue}>{selectedMouvement.tiers_type}</Text>
                </View>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Nom:</Text>
                  <Text style={styles.modalInfoValue}>{selectedMouvement.tiers_nom}</Text>
                </View>
              </View>
            )}

            {/* Traçabilité */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Traçabilité</Text>
              
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Effectué par:</Text>
                <Text style={styles.modalInfoValue}>
                  {selectedMouvement.effectue_par_nom} ({selectedMouvement.effectue_par_role})
                </Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Source:</Text>
                <Text style={styles.modalInfoValue}>
                  {selectedMouvement.table_source} (ID: {selectedMouvement.id_source})
                </Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Exercice:</Text>
                <Text style={styles.modalInfoValue}>
                  {selectedMouvement.exercice_comptable} - Période {selectedMouvement.periode_comptable}
                </Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Statut:</Text>
                <Chip
                  mode="flat"
                  style={[styles.modalStatutChip, { backgroundColor: getStatutColor(selectedMouvement.statut) + '20' }]}
                  textStyle={[styles.modalStatutText, { color: getStatutColor(selectedMouvement.statut) }]}
                >
                  {selectedMouvement.statut}
                </Chip>
              </View>

              {selectedMouvement.rapproche && (
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Rapproché:</Text>
                  <Text style={styles.modalInfoValue}>
                    Oui, le {formatDate(selectedMouvement.date_rapprochement)}
                  </Text>
                </View>
              )}
            </View>

            {/* Données complémentaires */}
            {donneesComplementaires && Object.keys(donneesComplementaires).length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Informations complémentaires</Text>
                
                {Object.entries(donneesComplementaires).map(([key, value]) => (
                  <View key={key} style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>{key}:</Text>
                    <Text style={styles.modalInfoValue}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bouton de fermeture */}
            <Button
              mode="contained"
              onPress={() => setDetailModalVisible(false)}
              style={styles.modalCloseButton}
              buttonColor="#2E86C1"
            >
              Fermer
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  const showStatisticsModal = () => {
    // Implémenter un modal de statistiques détaillées
    Alert.alert(
      'Statistiques détaillées',
      `Total des opérations: ${totaux.nombre_operations}\n` +
      `Entrées: ${formatCurrency(totaux.total_entrees)}\n` +
      `Sorties: ${formatCurrency(totaux.total_sorties)}\n` +
      `Solde: ${formatCurrency(totaux.solde)}\n\n` +
      `Catégories actives: ${repartition.length}`
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================
  if (loading && !refreshing && mouvements.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement du journal comptable...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredMouvements}
        renderItem={renderMouvementItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={60} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucun mouvement à afficher</Text>
            <Text style={styles.emptySubtext}>
              Modifiez les filtres pour voir plus de résultats
            </Text>
          </View>
        }
        contentContainerStyle={mouvements.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
      />

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
              setPage(1);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
              setPage(1);
            }
          }}
        />
      )}

      {/* Modal de détails */}
      {renderDetailModal()}

      {/* Indicateur d'export */}
      {exportLoading && (
        <View style={styles.exportOverlay}>
          <View style={styles.exportContainer}>
            <ActivityIndicator size="large" color="#2E86C1" />
            <Text style={styles.exportText}>Export en cours...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// =============================================
// STYLES
// =============================================
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
    fontFamily: 'Times New Roman',
    fontSize: 16,
    color: '#7F8C8D',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerSubtitle: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  periodFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 15,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateButtonText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 8,
  },
  dateSeparator: {
    marginHorizontal: 10,
  },
  categoryFilter: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipText: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#2C3E50',
    marginLeft: 5,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  typeFilter: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  typeChip: {
    marginRight: 8,
    backgroundColor: '#ECF0F1',
  },
  typeChipText: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  summaryHeader: {
    marginBottom: 15,
  },
  summaryTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  summarySubtitle: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#7F8C8D',
    marginBottom: 5,
    textAlign: 'center',
  },
  summaryValue: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  repartitionContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  repartitionTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  repartitionItem: {
    alignItems: 'center',
    marginRight: 20,
    minWidth: 80,
  },
  repartitionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  repartitionLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#7F8C8D',
    marginBottom: 3,
  },
  repartitionValue: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  repartitionCount: {
    fontFamily: 'Times New Roman',
    fontSize: 10,
    color: '#95A5A6',
  },
  paginationInfo: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  mouvementItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  mouvementItemEven: {
    backgroundColor: '#F8F9FA',
  },
  categoryIndicator: {
    width: 4,
  },
  mouvementContent: {
    flex: 1,
    padding: 15,
  },
  mouvementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mouvementHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 10,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mouvementHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mouvementNumero: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  mouvementLibelle: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 2,
  },
  mouvementDate: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    color: '#7F8C8D',
  },
  mouvementHeaderRight: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  mouvementMontant: {
    fontFamily: 'Times New Roman',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    fontFamily: 'Times New Roman',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mouvementDescription: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#34495E',
    marginBottom: 8,
    lineHeight: 18,
  },
  mouvementDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  ecritureComptable: {
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2E86C1',
    marginBottom: 8,
  },
  ecritureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ecritureLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#34495E',
  },
  ecritureValue: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#2C3E50',
    flex: 1,
    textAlign: 'right',
  },
  statutContainer: {
    marginTop: 5,
  },
  statutChip: {
    alignSelf: 'flex-start',
  },
  statutText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    backgroundColor: '#F8F9FA',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#2E86C1',
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#BDC3C7',
  },
  paginationNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageNumber: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 5,
    backgroundColor: '#F8F9FA',
  },
  pageNumberActive: {
    backgroundColor: '#2E86C1',
  },
  pageNumberText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#2C3E50',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    color: '#BDC3C7',
    marginTop: 15,
  },
  emptySubtext: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#BDC3C7',
    marginTop: 5,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 10,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalSubtitle: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 2,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  modalSectionTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalInfoLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    fontWeight: '600',
    flex: 1,
  },
  modalInfoValue: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#2C3E50',
    flex: 2,
    textAlign: 'right',
  },
  modalCategoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalCategoryBadgeText: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalTypeBadgeText: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalAmountContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  modalAmountLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  modalAmountValue: {
    fontFamily: 'Times New Roman',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalEcritureContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86C1',
  },
  modalEcritureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalEcritureLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#34495E',
  },
  modalEcritureValue: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#2C3E50',
    flex: 1,
    textAlign: 'right',
  },
  modalStatutChip: {
    alignSelf: 'flex-end',
  },
  modalStatutText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalCloseButton: {
    margin: 20,
  },
  exportOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportContainer: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  exportText: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    color: '#2C3E50',
    marginTop: 15,
  },
});

export default JournalComptableScreen;