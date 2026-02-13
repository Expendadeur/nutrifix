// frontend/src/components/ArticleSelector.js
// Composant de sélection dynamique d'articles pour commandes

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import {
  Modal,
  Portal,
  TextInput,
  Button,
  Searchbar,
  Card,
  Chip,
  IconButton,
  Badge,
  SegmentedButtons,
  ActivityIndicator,
  Divider
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Platform.select({
  web: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api'
});

const ArticleSelector = ({
  visible,
  onDismiss,
  onSelect,
  typeCommande = 'vente', // 'vente' ou 'achat'
  responsive
}) => {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('tous');
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Formulaire pour l'article sélectionné
  const [articleForm, setArticleForm] = useState({
    source: '',
    type_article: '',
    id_article: null,
    designation: '',
    description: '',
    quantite_commandee: '1',
    unite: 'unité',
    prix_unitaire_ht: '0',
    remise_pourcent: '0',
    tva_pourcent: '16'
  });

  // Mode personnalisé pour "Autre article"
  const [customMode, setCustomMode] = useState(false);

  // Catégories selon le type de commande
  const categories = typeCommande === 'vente'
    ? [
      { value: 'tous', label: 'Tous', icon: 'apps' },
      { value: 'lait', label: 'Lait', icon: 'opacity' },
      { value: 'oeufs', label: 'Œufs', icon: 'egg' },
      { value: 'animaux', label: 'Animaux', icon: 'pets' },
      { value: 'stock', label: 'Stock', icon: 'inventory' },
      { value: 'autre', label: 'Autre', icon: 'more-horiz' }
    ]
    : [
      { value: 'tous', label: 'Tous', icon: 'apps' },
      { value: 'intrants', label: 'Agriculture', icon: 'agriculture' },
      { value: 'aliments', label: 'Elevage', icon: 'restaurant' },
      { value: 'vehicules', label: 'Flotte', icon: 'directions-car' },
      { value: 'autre', label: 'Autre', icon: 'more-horiz' }
    ];

  useEffect(() => {
    if (visible) {
      loadArticles();
    }
  }, [visible, selectedCategory]);

  useEffect(() => {
    filterArticles();
  }, [articles, searchQuery, selectedCategory]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');

      const params = new URLSearchParams();
      if (selectedCategory !== 'tous') {
        params.append('type', selectedCategory);
      }

      const response = await fetch(
        `${API_URL}/articles/articles?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setArticles(data.data || []);
      } else {
        throw new Error(data.message || 'Erreur de chargement');
      }
    } catch (error) {
      console.error('Erreur chargement articles:', error);
      Alert.alert('Erreur', 'Impossible de charger les articles');
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = () => {
    let filtered = articles;

    // Filtre par catégorie
    if (selectedCategory !== 'tous') {
      filtered = filtered.filter(a =>
        a.type_article === selectedCategory || a.source === selectedCategory
      );
    }

    // Filtre par recherche
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.designation.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtre selon type de commande
    if (typeCommande === 'vente') {
      filtered = filtered.filter(a =>
        a.type_operation === 'vente' || a.type_operation === 'achat_vente'
      );
    }

    setFilteredArticles(filtered);
  };

  const handleSelectArticle = (article) => {
    if (article.source === 'autre' || article.type_article === 'autre') {
      // Mode personnalisé
      setCustomMode(true);
      setArticleForm({
        source: 'autre',
        type_article: 'autre',
        id_article: 0,
        designation: '',
        description: '',
        quantite_commandee: '1',
        unite: 'unité',
        prix_unitaire_ht: '0',
        remise_pourcent: '0',
        tva_pourcent: '16'
      });
    } else {
      setSelectedArticle(article);
      setCustomMode(false);
      setArticleForm({
        source: article.source,
        type_article: article.type_article,
        id_article: article.id_article,
        designation: article.designation,
        description: '',
        quantite_commandee: '1',
        unite: article.unite_mesure || 'unité',
        prix_unitaire_ht: article.prix_unitaire_suggere?.toString() || '0',
        remise_pourcent: '0',
        tva_pourcent: '16'
      });
    }
  };

  const handleValidate = async () => {
    // Validation
    if (!articleForm.designation) {
      Alert.alert('Erreur', 'Veuillez saisir une désignation');
      return;
    }

    if (!articleForm.quantite_commandee || parseFloat(articleForm.quantite_commandee) <= 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }

    if (!articleForm.prix_unitaire_ht || parseFloat(articleForm.prix_unitaire_ht) <= 0) {
      Alert.alert('Erreur', 'Prix unitaire invalide');
      return;
    }

    // Vérifier stock pour vente
    if (typeCommande === 'vente' && selectedArticle && selectedArticle.quantite_disponible !== null) {
      if (parseFloat(articleForm.quantite_commandee) > selectedArticle.quantite_disponible) {
        Alert.alert(
          'Stock insuffisant',
          `Stock disponible: ${selectedArticle.quantite_disponible} ${selectedArticle.unite_mesure}`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Continuer quand même',
              onPress: () => confirmAndAdd(),
              style: 'destructive'
            }
          ]
        );
        return;
      }
    }

    confirmAndAdd();
  };

  const confirmAndAdd = () => {
    const quantite = parseFloat(articleForm.quantite_commandee);
    const prixUnitaire = parseFloat(articleForm.prix_unitaire_ht);
    const remise = parseFloat(articleForm.remise_pourcent || 0);
    const tva = parseFloat(articleForm.tva_pourcent || 0);

    const montant_ht = quantite * prixUnitaire * (1 - remise / 100);
    const montant_tva = montant_ht * (tva / 100);
    const montant_ttc = montant_ht + montant_tva;

    const ligneCommande = {
      ...articleForm,
      type_produit: articleForm.type_article, // Pour compatibilité backend
      id_produit: articleForm.id_article,
      montant_ht: parseFloat(montant_ht.toFixed(2)),
      montant_tva: parseFloat(montant_tva.toFixed(2)),
      montant_ttc: parseFloat(montant_ttc.toFixed(2)),
      // Informations supplémentaires pour traçabilité
      article_source: articleForm.source,
      stock_initial: selectedArticle?.quantite_disponible
    };

    onSelect(ligneCommande);
    resetForm();
    onDismiss();
  };

  const resetForm = () => {
    setSelectedArticle(null);
    setCustomMode(false);
    setSearchQuery('');
    setSelectedCategory('tous');
    setArticleForm({
      source: '',
      type_article: '',
      id_article: null,
      designation: '',
      description: '',
      quantite_commandee: '1',
      unite: 'unité',
      prix_unitaire_ht: '0',
      remise_pourcent: '0',
      tva_pourcent: '16'
    });
  };

  const renderArticleCard = (article) => {
    const isAvailable = article.statut === 'disponible';
    const hasStock = article.quantite_disponible === null || article.quantite_disponible > 0;

    // For purchases (achat), allow selection regardless of status or stock
    const isDisabled = typeCommande === 'achat'
      ? false
      : (!isAvailable || !hasStock);

    return (
      <TouchableOpacity
        key={`${article.source}-${article.id}`}
        style={[
          styles.articleCard,
          !isAvailable && typeCommande === 'vente' && styles.articleCardDisabled
        ]}
        onPress={() => handleSelectArticle(article)}
        disabled={isDisabled}
      >
        <View style={styles.articleCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.articleDesignation} numberOfLines={2}>
              {article.designation}
            </Text>
            <View style={styles.articleTags}>
              <Chip
                mode="flat"
                compact
                style={styles.articleChip}
                textStyle={styles.articleChipText}
              >
                {article.type_article}
              </Chip>
              {article.quantite_disponible !== null && (
                <Chip
                  mode="flat"
                  compact
                  style={[
                    styles.articleChip,
                    { backgroundColor: hasStock ? '#D4EDDA' : '#F8D7DA' }
                  ]}
                  textStyle={[
                    styles.articleChipText,
                    { color: hasStock ? '#155724' : '#721C24' }
                  ]}
                >
                  Stock: {article.quantite_disponible} {article.unite_mesure}
                </Chip>
              )}
            </View>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={24}
            color="#7F8C8D"
          />
        </View>

        {article.prix_unitaire_suggere > 0 && (
          <Text style={styles.articlePrice}>
            Prix suggéré: {article.prix_unitaire_suggere} BIF
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderArticleForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>
        {customMode ? 'Article personnalisé' : selectedArticle?.designation}
      </Text>

      {customMode && (
        <TextInput
          label="Désignation *"
          value={articleForm.designation}
          onChangeText={(text) =>
            setArticleForm({ ...articleForm, designation: text })
          }
          style={styles.input}
          mode="outlined"
        />
      )}

      <TextInput
        label="Description"
        value={articleForm.description}
        onChangeText={(text) =>
          setArticleForm({ ...articleForm, description: text })
        }
        style={styles.input}
        mode="outlined"
        multiline
        numberOfLines={2}
      />

      <View style={styles.formRow}>
        <TextInput
          label="Quantité *"
          value={articleForm.quantite_commandee}
          onChangeText={(text) =>
            setArticleForm({ ...articleForm, quantite_commandee: text })
          }
          style={[styles.input, styles.inputHalf]}
          mode="outlined"
          keyboardType="decimal-pad"
        />

        <TextInput
          label="Unité"
          value={articleForm.unite}
          onChangeText={(text) =>
            setArticleForm({ ...articleForm, unite: text })
          }
          style={[styles.input, styles.inputHalf]}
          mode="outlined"
        />
      </View>

      {selectedArticle && selectedArticle.quantite_disponible !== null && (
        <View style={styles.stockAlert}>
          <MaterialIcons name="info" size={20} color="#2E86C1" />
          <Text style={styles.stockAlertText}>
            Stock disponible: {selectedArticle.quantite_disponible} {selectedArticle.unite_mesure}
          </Text>
        </View>
      )}

      <View style={styles.formRow}>
        <TextInput
          label="Prix Unitaire HT *"
          value={articleForm.prix_unitaire_ht}
          onChangeText={(text) =>
            setArticleForm({ ...articleForm, prix_unitaire_ht: text })
          }
          style={[styles.input, styles.inputHalf]}
          mode="outlined"
          keyboardType="decimal-pad"
        />

        <TextInput
          label="Remise (%)"
          value={articleForm.remise_pourcent}
          onChangeText={(text) =>
            setArticleForm({ ...articleForm, remise_pourcent: text })
          }
          style={[styles.input, styles.inputHalf]}
          mode="outlined"
          keyboardType="decimal-pad"
        />
      </View>

      <TextInput
        label="TVA (%)"
        value={articleForm.tva_pourcent}
        onChangeText={(text) =>
          setArticleForm({ ...articleForm, tva_pourcent: text })
        }
        style={styles.input}
        mode="outlined"
        keyboardType="decimal-pad"
      />

      <View style={styles.formActions}>
        <Button
          mode="contained"
          onPress={handleValidate}
          buttonColor="#27AE60"
          style={styles.formButton}
        >
          Ajouter
        </Button>
        <Button
          mode="outlined"
          onPress={() => {
            setSelectedArticle(null);
            setCustomMode(false);
          }}
          style={styles.formButton}
        >
          Retour
        </Button>
      </View>
    </View>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => {
          resetForm();
          onDismiss();
        }}
        contentContainerStyle={[
          styles.modal,
          responsive?.isDesktop && styles.modalDesktop
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {typeCommande === 'vente' ? 'Sélectionner un produit' : 'Sélectionner un article'}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={() => {
              resetForm();
              onDismiss();
            }}
          />
        </View>

        {!selectedArticle && !customMode ? (
          <View style={styles.selectorContainer}>
            <Searchbar
              placeholder="Rechercher..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesContainer}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.value && styles.categoryChipActive
                  ]}
                  onPress={() => setSelectedCategory(cat.value)}
                >
                  <MaterialIcons
                    name={cat.icon}
                    size={20}
                    color={selectedCategory === cat.value ? '#FFFFFF' : '#7F8C8D'}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.value && styles.categoryChipTextActive
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E86C1" />
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : (
              <ScrollView style={styles.articlesList}>
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(renderArticleCard)
                ) : (
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="inbox" size={60} color="#BDC3C7" />
                    <Text style={styles.emptyText}>Aucun article disponible</Text>
                    {typeCommande === 'achat' && (
                      <Button
                        mode="contained"
                        onPress={() => handleSelectArticle({ source: 'autre', type_article: selectedCategory !== 'tous' ? selectedCategory : 'autre', designation: searchQuery })}
                        style={{ marginTop: 20 }}
                        buttonColor="#2E86C1"
                      >
                        Ajouter un nouvel article
                      </Button>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        ) : (
          renderArticleForm()
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
    height: Platform.OS === 'web' ? 'auto' : '90%'
  },
  modalDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '80%'
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
  selectorContainer: {
    flex: 1,
    padding: 20
  },
  searchBar: {
    marginBottom: 15,
    backgroundColor: '#F8F9FA'
  },
  categoriesScroll: {
    maxHeight: 50,
    marginBottom: 15
  },
  categoriesContainer: {
    flexDirection: 'row',
    gap: 10
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    gap: 6
  },
  categoryChipActive: {
    backgroundColor: '#2E86C1'
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7F8C8D'
  },
  categoryChipTextActive: {
    color: '#FFFFFF'
  },
  articlesList: {
    flex: 1
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1
  },
  articleCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8F9FA'
  },
  articleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  articleDesignation: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6
  },
  articleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  articleChip: {
    height: 24,
    backgroundColor: '#E8F4F8'
  },
  articleChipText: {
    fontSize: 11,
    color: '#2E86C1'
  },
  articlePrice: {
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '600'
  },
  formContainer: {
    padding: 20
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF'
  },
  formRow: {
    flexDirection: 'row',
    gap: 10
  },
  inputHalf: {
    flex: 1
  },
  stockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    padding: 10,
    borderRadius: 6,
    marginBottom: 15,
    gap: 8
  },
  stockAlertText: {
    fontSize: 13,
    color: '#2E86C1',
    flex: 1
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20
  },
  formButton: {
    flex: 1
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#BDC3C7',
    marginTop: 16
  }
});

export default ArticleSelector;