// frontend/src/screens/manager/FinancierDepartementScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
  FlatList
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Searchbar,
  Chip,
  Button,
  Modal,
  Portal,
  TextInput,
  ActivityIndicator,
  ProgressBar,
  Divider,
  Badge
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;

// Configuration responsive
const getResponsiveValue = (mobile, tablet, desktop) => {
  if (isDesktop) return desktop;
  if (isTablet) return tablet;
  return mobile;
};

const API_URL = 'https://nutrifix-1-twdf.onrender.com/api';

const FinancierDepartementScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [authToken, setAuthToken] = useState(null);
  
  // Overview data
  const [budgetOverview, setBudgetOverview] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  
  // Budget
  const [budgetDetails, setBudgetDetails] = useState(null);
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [newRequest, setNewRequest] = useState({
    montant: '',
    categorie: '',
    justification: '',
    urgence: 'normal'
  });
  
  // Dépenses
  const [expenses, setExpenses] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Revenus
  const [revenues, setRevenues] = useState([]);
  const [revenuesBySource, setRevenuesBySource] = useState([]);
  
  // Rapports
  const [reportType, setReportType] = useState('complete');
  const [reportFormat, setReportFormat] = useState('excel');
  const [reportPeriode, setReportPeriode] = useState('current_month');
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Initialisation
  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (authToken) {
      loadData();
    }
  }, [activeTab, selectedMonth, selectedYear, authToken]);

  const initializeAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        setAuthToken(token);
      } else {
        Alert.alert('Erreur', 'Session expirée. Veuillez vous reconnecter.');
      }
    } catch (error) {
      console.error('Error loading token:', error);
    }
  };

  // Configuration axios avec token
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const config = {
        method,
        url: `${API_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      switch(activeTab) {
        case 'overview':
          await loadOverviewData();
          break;
        case 'budget':
          await loadBudgetData();
          break;
        case 'depenses':
          await loadExpensesData();
          break;
        case 'revenus':
          await loadRevenuesData();
          break;
        case 'rapports':
          // Rapports loaded on demand
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données financières');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

const loadOverviewData = async () => {
  try {
    const [overview, trend] = await Promise.all([
      apiCall('/manager/budget-overview'),
      apiCall('/manager/monthly-financial-trend?months=6')
    ]);
    
    setBudgetOverview(overview || null);
    setMonthlyTrend(Array.isArray(trend) ? trend : []);
  } catch (error) {
    console.error('Error loading overview:', error);
    setBudgetOverview(null);
    setMonthlyTrend([]);
    throw error;
  }
};

const loadBudgetData = async () => {
  try {
    const [details, requests] = await Promise.all([
      apiCall('/manager/budget-details'),
      apiCall('/manager/budget-requests')
    ]);
    
    setBudgetDetails(details || null);
    setBudgetRequests(Array.isArray(requests) ? requests : []);
  } catch (error) {
    console.error('Error loading budget:', error);
    setBudgetDetails(null);
    setBudgetRequests([]);
    throw error;
  }
};

const loadExpensesData = async () => {
  try {
    const [expensesData, byCategory] = await Promise.all([
      apiCall(`/manager/department-expenses?month=${selectedMonth}&year=${selectedYear}`),
      apiCall(`/manager/expenses-by-category?month=${selectedMonth}&year=${selectedYear}`)
    ]);
    
    setExpenses(Array.isArray(expensesData) ? expensesData : []);
    setExpensesByCategory(Array.isArray(byCategory) ? byCategory : []);
  } catch (error) {
    console.error('Error loading expenses:', error);
    setExpenses([]);
    setExpensesByCategory([]);
    throw error;
  }
};
const loadRevenuesData = async () => {
  try {
    const [revenuesData, bySource] = await Promise.all([
      apiCall(`/manager/department-revenues?month=${selectedMonth}&year=${selectedYear}`),
      apiCall(`/manager/revenues-by-source?month=${selectedMonth}&year=${selectedYear}`)
    ]);
    
    setRevenues(Array.isArray(revenuesData) ? revenuesData : []);
    setRevenuesBySource(Array.isArray(bySource) ? bySource : []);
  } catch (error) {
    console.error('Error loading revenues:', error);
    setRevenues([]);
    setRevenuesBySource([]);
    throw error;
  }
};

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [activeTab, selectedMonth, selectedYear]);

  // ==================== OVERVIEW TAB ====================
  const renderOverviewTab = () => {
    const cardWidth = getResponsiveValue('100%', '48%', '23%');
    const cardMargin = getResponsiveValue(10, 5, 5);
    
    return (
      <ScrollView 
        style={styles.tabContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Budget Summary Cards */}
        <View style={[styles.summaryCardsContainer, { padding: cardMargin }]}>
          <Card style={[styles.summaryCard, { width: cardWidth, margin: cardMargin }]}>
            <Card.Content>
              <View style={styles.summaryCardHeader}>
                <MaterialIcons name="account-balance-wallet" size={getResponsiveValue(24, 28, 30)} color="#3498DB" />
                <Text style={styles.summaryCardLabel}>Budget Alloué</Text>
              </View>
              <Text style={[styles.summaryCardValue, { fontSize: getResponsiveValue(20, 22, 24) }]}>
                {formatCurrency(budgetOverview?.budget_alloue || 0)}
              </Text>
              <Text style={styles.summaryCardSubtext}>Année {selectedYear}</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { width: cardWidth, margin: cardMargin }]}>
            <Card.Content>
              <View style={styles.summaryCardHeader}>
                <MaterialIcons name="trending-down" size={getResponsiveValue(24, 28, 30)} color="#E74C3C" />
                <Text style={styles.summaryCardLabel}>Dépenses</Text>
              </View>
              <Text style={[styles.summaryCardValue, { fontSize: getResponsiveValue(20, 22, 24), color: '#E74C3C' }]}>
                {formatCurrency(budgetOverview?.total_depenses || 0)}
              </Text>
              <Text style={styles.summaryCardSubtext}>
                {budgetOverview?.pourcentage_utilise || 0}% utilisé
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { width: cardWidth, margin: cardMargin }]}>
            <Card.Content>
              <View style={styles.summaryCardHeader}>
                <MaterialIcons name="trending-up" size={getResponsiveValue(24, 28, 30)} color="#2ECC71" />
                <Text style={styles.summaryCardLabel}>Revenus</Text>
              </View>
              <Text style={[styles.summaryCardValue, { fontSize: getResponsiveValue(20, 22, 24), color: '#2ECC71' }]}>
                {formatCurrency(budgetOverview?.total_revenus || 0)}
              </Text>
              <Text style={styles.summaryCardSubtext}>Ce mois-ci</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { width: cardWidth, margin: cardMargin }]}>
            <Card.Content>
              <View style={styles.summaryCardHeader}>
                <MaterialIcons name="savings" size={getResponsiveValue(24, 28, 30)} color="#F39C12" />
                <Text style={styles.summaryCardLabel}>Disponible</Text>
              </View>
              <Text style={[styles.summaryCardValue, { fontSize: getResponsiveValue(20, 22, 24), color: '#F39C12' }]}>
                {formatCurrency(budgetOverview?.budget_disponible || 0)}
              </Text>
              <Text style={styles.summaryCardSubtext}>
                {budgetOverview?.pourcentage_disponible || 0}% restant
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Budget Progress */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Consommation du Budget</Title>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { fontSize: getResponsiveValue(12, 13, 14) }]}>
                {formatCurrency(budgetOverview?.total_depenses || 0)} / {formatCurrency(budgetOverview?.budget_alloue || 0)}
              </Text>
              <Text style={[
                styles.progressPercentage,
                { 
                  fontSize: getResponsiveValue(14, 16, 18),
                  color: getProgressColor(budgetOverview?.pourcentage_utilise || 0) 
                }
              ]}>
                {budgetOverview?.pourcentage_utilise || 0}%
              </Text>
            </View>
            <ProgressBar 
              progress={(budgetOverview?.pourcentage_utilise || 0) / 100}
              color={getProgressColor(budgetOverview?.pourcentage_utilise || 0)}
              style={[styles.progressBarLarge, { height: getResponsiveValue(10, 12, 14) }]}
            />
            
            {budgetOverview?.pourcentage_utilise >= 90 && (
              <View style={styles.warningBanner}>
                <MaterialIcons name="warning" size={20} color="#E74C3C" />
                <Text style={styles.warningText}>
                  Attention! Le budget est presque épuisé
                </Text>
              </View>
            )}

            {budgetOverview?.pourcentage_utilise >= 75 && budgetOverview?.pourcentage_utilise < 90 && (
              <View style={[styles.warningBanner, { backgroundColor: '#FEF5E7' }]}>
                <MaterialIcons name="info" size={20} color="#F39C12" />
                <Text style={[styles.warningText, { color: '#F39C12' }]}>
                  Le budget approche de la limite
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Monthly Trend Chart */}
        {monthlyTrend.length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Évolution sur 6 mois</Title>
              <Paragraph style={styles.sectionSubtitle}>Tendance des dépenses et revenus</Paragraph>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={{
                    labels: monthlyTrend.map(m => m.mois_court),
                    datasets: [
                      {
                        data: monthlyTrend.map(m => parseFloat(m.depenses || 0)),
                        color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
                        strokeWidth: 2
                      },
                      {
                        data: monthlyTrend.map(m => parseFloat(m.revenus || 0)),
                        color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
                        strokeWidth: 2
                      }
                    ],
                    legend: ['Dépenses', 'Revenus']
                  }}
                  width={Math.max(screenWidth - 60, monthlyTrend.length * 80)}
                  height={getResponsiveValue(200, 220, 240)}
                  chartConfig={{
                    backgroundColor: '#FFF',
                    backgroundGradientFrom: '#FFF',
                    backgroundGradientTo: '#FFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '4', strokeWidth: '2' }
                  }}
                  bezier
                  style={styles.chart}
                />
              </ScrollView>

              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#E74C3C' }]} />
                  <Text style={styles.legendText}>Dépenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#2ECC71' }]} />
                  <Text style={styles.legendText}>Revenus</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Financial Balance Card */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Bilan Financier du Mois</Title>
            <View style={[
              styles.balanceGrid,
              isWeb && !isDesktop && { flexDirection: 'column', gap: 20 }
            ]}>
              <View style={styles.balanceItem}>
                <MaterialIcons name="trending-down" size={24} color="#E74C3C" />
                <Text style={styles.balanceLabel}>Dépenses</Text>
                <Text style={[styles.balanceValue, { color: '#E74C3C', fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency(budgetOverview?.total_depenses || 0)}
                </Text>
              </View>
              
              {!isWeb || isDesktop ? <View style={styles.balanceDivider} /> : null}
              
              <View style={styles.balanceItem}>
                <MaterialIcons name="trending-up" size={24} color="#2ECC71" />
                <Text style={styles.balanceLabel}>Revenus</Text>
                <Text style={[styles.balanceValue, { color: '#2ECC71', fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency(budgetOverview?.total_revenus || 0)}
                </Text>
              </View>
              
              {!isWeb || isDesktop ? <View style={styles.balanceDivider} /> : null}
              
              <View style={styles.balanceItem}>
                <MaterialIcons 
                  name={((budgetOverview?.total_revenus || 0) - (budgetOverview?.total_depenses || 0)) >= 0 ? 'check-circle' : 'cancel'} 
                  size={24} 
                  color={((budgetOverview?.total_revenus || 0) - (budgetOverview?.total_depenses || 0)) >= 0 ? '#2ECC71' : '#E74C3C'} 
                />
                <Text style={styles.balanceLabel}>Solde</Text>
                <Text style={[
                  styles.balanceValue,
                  { 
                    fontSize: getResponsiveValue(16, 18, 20),
                    color: ((budgetOverview?.total_revenus || 0) - (budgetOverview?.total_depenses || 0)) >= 0 ? '#2ECC71' : '#E74C3C' 
                  }
                ]}>
                  {formatCurrency((budgetOverview?.total_revenus || 0) - (budgetOverview?.total_depenses || 0))}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Actions Rapides</Title>
            <View style={[
              styles.actionsGrid,
              { 
                flexDirection: isDesktop ? 'row' : isTablet ? 'row' : 'column',
                gap: getResponsiveValue(10, 12, 15)
              }
            ]}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { flex: isDesktop || isTablet ? 1 : undefined }
                ]}
                onPress={() => setActiveTab('budget')}
              >
                <MaterialIcons name="request-quote" size={getResponsiveValue(28, 30, 32)} color="#3498DB" />
                <Text style={styles.actionButtonText}>Demande Budget</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { flex: isDesktop || isTablet ? 1 : undefined }
                ]}
                onPress={() => setActiveTab('depenses')}
              >
                <MaterialIcons name="receipt" size={getResponsiveValue(28, 30, 32)} color="#E74C3C" />
                <Text style={styles.actionButtonText}>Voir Dépenses</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { flex: isDesktop || isTablet ? 1 : undefined }
                ]}
                onPress={() => setActiveTab('revenus')}
              >
                <MaterialIcons name="attach-money" size={getResponsiveValue(28, 30, 32)} color="#2ECC71" />
                <Text style={styles.actionButtonText}>Voir Revenus</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { flex: isDesktop || isTablet ? 1 : undefined }
                ]}
                onPress={() => setActiveTab('rapports')}
              >
                <MaterialIcons name="assessment" size={getResponsiveValue(28, 30, 32)} color="#9B59B6" />
                <Text style={styles.actionButtonText}>Générer Rapport</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  // ==================== BUDGET TAB ====================
  const renderBudgetTab = () => (
    <ScrollView 
      style={styles.tabContainer}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Budget Allocation */}
      {budgetDetails ? (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Allocation Budgétaire {selectedYear}</Title>
            
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget Total Alloué:</Text>
              <Text style={styles.budgetValue}>
                {formatCurrency(budgetDetails.budget_alloue)}
              </Text>
            </View>
            
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Dépenses à ce jour:</Text>
              <Text style={[styles.budgetValue, { color: '#E74C3C' }]}>
                {formatCurrency(budgetDetails.total_depenses)}
              </Text>
            </View>
            
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget Disponible:</Text>
              <Text style={[styles.budgetValue, { color: '#2ECC71' }]}>
                {formatCurrency(budgetDetails.budget_disponible)}
              </Text>
            </View>
            
            <Divider style={styles.budgetDivider} />
            
            <View style={styles.budgetProgressSection}>
              <Text style={styles.budgetProgressLabel}>Taux d'utilisation</Text>
              <ProgressBar
                progress={(budgetDetails.total_depenses || 0) / (budgetDetails.budget_alloue || 1)}
                color={getProgressColor(((budgetDetails.total_depenses || 0) / (budgetDetails.budget_alloue || 1)) * 100)}
                style={styles.budgetProgressBar}
              />
              <Text style={styles.budgetProgressText}>
                {Math.round(((budgetDetails.total_depenses || 0) / (budgetDetails.budget_alloue || 1)) * 100)}%
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance-wallet" size={60} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune allocation budgétaire pour {selectedYear}</Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Budget Breakdown by Category */}
      {budgetDetails?.categories && budgetDetails.categories.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Répartition par Catégorie</Title>
            {budgetDetails.categories.map((cat, index) => (
              <View key={index} style={styles.categoryItem}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryTitleSection}>
                    <MaterialIcons 
                      name={getCategoryIcon(cat.nom)} 
                      size={20} 
                      color={getCategoryColor(index)} 
                    />
                    <Text style={styles.categoryName}>{cat.nom}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(cat.montant_alloue)}
                  </Text>
                </View>
                <ProgressBar
                  progress={(cat.montant_utilise || 0) / (cat.montant_alloue || 1)}
                  color={getProgressColor(((cat.montant_utilise || 0) / (cat.montant_alloue || 1)) * 100)}
                  style={styles.categoryProgress}
                />
                <View style={styles.categoryFooter}>
                  <Text style={styles.categoryUsage}>
                    Utilisé: {formatCurrency(cat.montant_utilise)} 
                  </Text>
                  <Text style={[
                    styles.categoryPercentage,
                    { color: getProgressColor(((cat.montant_utilise || 0) / (cat.montant_alloue || 1)) * 100) }
                  ]}>
                    {Math.round(((cat.montant_utilise || 0) / (cat.montant_alloue || 1)) * 100)}%
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Budget Requests */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.requestsHeader}>
            <View style={{ flex: 1 }}>
              <Title style={styles.sectionTitle}>Demandes de Budget</Title>
              {budgetRequests.filter(r => r.statut === 'en_attente').length > 0 && (
                <Paragraph style={{ color: '#F39C12', marginTop: 5 }}>
                  {budgetRequests.filter(r => r.statut === 'en_attente').length} demande(s) en attente
                </Paragraph>
              )}
            </View>
            <Button
              mode="contained"
              icon="add"
              onPress={() => setRequestModalVisible(true)}
              style={styles.newRequestButton}
              compact={!isDesktop}
            >
              {isDesktop ? 'Nouvelle Demande' : 'Nouveau'}
            </Button>
          </View>

          {budgetRequests.length > 0 ? (
            budgetRequests.map((request) => (
              <View key={request.id} style={styles.requestItem}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestInfo}>
                    <Text style={[styles.requestAmount, { fontSize: getResponsiveValue(14, 16, 18) }]}>
                      {formatCurrency(request.montant_demande)}
                    </Text>
                    <Text style={styles.requestCategory}>{request.categorie}</Text>
                  </View>
                  <View style={styles.requestBadges}>
                    <Chip
                      style={[styles.requestStatus, {
                        backgroundColor: getRequestStatusColor(request.statut)
                      }]}
                      textStyle={{ color: '#FFF', fontSize: 11 }}
                    >
                      {request.statut}
                    </Chip>
                    {request.urgence === 'urgent' && (
                      <Chip
                        icon="priority-high"
                        style={styles.urgentBadge}
                        textStyle={{ fontSize: 10, color: '#FFF' }}
                      >
                        Urgent
                      </Chip>
                    )}
                    {request.urgence === 'prioritaire' && (
                      <Chip
                        icon="flag"
                        style={styles.prioritaireBadge}
                        textStyle={{ fontSize: 10, color: '#FFF' }}
                      >
                        Prioritaire
                      </Chip>
                    )}
                  </View>
                </View>
                
                <Text style={styles.requestJustification} numberOfLines={2}>
                  {request.justification}
                </Text>
                
                <View style={styles.requestFooter}>
                  <View style={styles.requestDateInfo}>
                    <MaterialIcons name="event" size={14} color="#95A5A6" />
                    <Text style={styles.requestDate}>
                      {formatDate(request.date_demande)}
                    </Text>
                  </View>
                </View>
                
                {request.reponse_admin && (
                  <View style={styles.adminResponse}>
                    <MaterialIcons 
                      name={request.statut === 'approuve' ? 'check-circle' : 'cancel'} 
                      size={16} 
                      color={request.statut === 'approuve' ? '#2ECC71' : '#E74C3C'} 
                    />
                    <Text style={styles.adminResponseText}>
                      {request.reponse_admin}
                    </Text>
                  </View>
                )}

                {request.statut === 'approuve' && request.montant_approuve && (
                  <View style={styles.approvedAmount}>
                    <MaterialIcons name="check-circle" size={16} color="#2ECC71" />
                    <Text style={styles.approvedAmountText}>
                      Montant approuvé: {formatCurrency(request.montant_approuve)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="request-quote" size={60} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune demande de budget</Text>
              <Button
                mode="outlined"
                icon="add"
                onPress={() => setRequestModalVisible(true)}
                style={{ marginTop: 10 }}
              >
                Créer une demande
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* New Request Modal */}
      {renderBudgetRequestModal()}
    </ScrollView>
  );

  const renderBudgetRequestModal = () => (
    <Portal>
      <Modal
        visible={requestModalVisible}
        onDismiss={() => {
          setRequestModalVisible(false);
          setNewRequest({
            montant: '',
            categorie: '',
            justification: '',
            urgence: 'normal'
          });
        }}
        contentContainerStyle={[
          styles.modalContainer,
          isWeb && styles.modalContainerWeb,
          { maxWidth: getResponsiveValue('90%', 600, 700) }
        ]}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Title>Nouvelle Demande de Budget</Title>
            <TouchableOpacity onPress={() => setRequestModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#7F8C8D" />
            </TouchableOpacity>
          </View>

          <TextInput
            label="Montant demandé (BIF) *"
            value={newRequest.montant}
            onChangeText={(text) => setNewRequest({...newRequest, montant: text})}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="currency-usd" />}
          />

          <TextInput
            label="Catégorie *"
            value={newRequest.categorie}
            onChangeText={(text) => setNewRequest({...newRequest, categorie: text})}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="label" />}
            placeholder="Ex: Équipement, Formation, Fournitures..."
          />

          <TextInput
            label="Justification *"
            value={newRequest.justification}
            onChangeText={(text) => setNewRequest({...newRequest, justification: text})}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            left={<TextInput.Icon icon="text" />}
            placeholder="Expliquez en détail la raison de cette demande..."
          />

          <Text style={styles.inputLabel}>Niveau d'urgence:</Text>
          <View style={[styles.urgenceContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Chip
              selected={newRequest.urgence === 'normal'}
              onPress={() => setNewRequest({...newRequest, urgence: 'normal'})}
              style={[styles.urgenceChip, !isDesktop && { marginBottom: 8 }]}
              icon="timer"
            >
              Normal
            </Chip>
            <Chip
              selected={newRequest.urgence === 'prioritaire'}
              onPress={() => setNewRequest({...newRequest, urgence: 'prioritaire'})}
              style={[styles.urgenceChip, !isDesktop && { marginBottom: 8 }]}
              selectedColor="#F39C12"
              icon="flag"
            >
              Prioritaire
            </Chip>
            <Chip
              selected={newRequest.urgence === 'urgent'}
              onPress={() => setNewRequest({...newRequest, urgence: 'urgent'})}
              style={styles.urgenceChip}
              selectedColor="#E74C3C"
              icon="priority-high"
            >
              Urgent
            </Chip>
          </View>

          <View style={[styles.modalActions, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Button
              mode="outlined"
              onPress={() => {
                setRequestModalVisible(false);
                setNewRequest({
                  montant: '',
                  categorie: '',
                  justification: '',
                  urgence: 'normal'
                });
              }}
              style={[styles.cancelButton, !isDesktop && { marginBottom: 10 }]}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitBudgetRequest}
              style={styles.submitButton}
              loading={loading}
              disabled={!newRequest.montant || !newRequest.categorie || !newRequest.justification}
            >
              Soumettre
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  const handleSubmitBudgetRequest = async () => {
    if (!newRequest.montant || !newRequest.categorie || !newRequest.justification) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const montant = parseFloat(newRequest.montant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }

    try {
      setLoading(true);
      await apiCall('/manager/budget-requests', 'POST', {
        montant_demande: montant,
        categorie: newRequest.categorie,
        justification: newRequest.justification,
        urgence: newRequest.urgence
      });
      
      Alert.alert('Succès', 'Demande de budget soumise avec succès');
      setRequestModalVisible(false);
      setNewRequest({
        montant: '',
        categorie: '',
        justification: '',
        urgence: 'normal'
      });
      loadBudgetData();
    } catch (error) {
      console.error('Error submitting budget request:', error);
      Alert.alert('Erreur', 'Impossible de soumettre la demande');
    } finally {
      setLoading(false);
    }
  };

  // ==================== DÉPENSES TAB ====================
  const renderDepensesTab = () => (
    <View style={styles.tabContainer}>
      {/* Month/Year Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
            const newYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
            setSelectedMonth(newMonth);
            setSelectedYear(newYear);
          }}
        >
          <MaterialIcons name="chevron-left" size={24} color="#3498DB" />
        </TouchableOpacity>

        <View style={styles.periodDisplay}>
          <Text style={[styles.periodText, { fontSize: getResponsiveValue(14, 16, 18) }]}>
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric'
            })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const now = new Date();
            const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
            const newYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
            
            if (newYear < now.getFullYear() || 
                (newYear === now.getFullYear() && newMonth <= now.getMonth() + 1)) {
              setSelectedMonth(newMonth);
              setSelectedYear(newYear);
            }
          }}
        >
          <MaterialIcons name="chevron-right" size={24} color="#3498DB" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Expenses Summary */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Résumé des Dépenses</Title>
            <View style={[
              styles.expensesSummaryGrid,
              !isDesktop && { flexDirection: 'column', gap: 15 }
            ]}>
              <View style={styles.expenseSummaryItem}>
                <MaterialIcons name="attach-money" size={24} color="#E74C3C" />
                <Text style={[styles.expenseSummaryValue, { fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency((expenses || []).reduce((sum, e) => sum + parseFloat(e.montant || 0), 0))}

                </Text>
                <Text style={styles.expenseSummaryLabel}>Total</Text>
              </View>
              <View style={styles.expenseSummaryItem}>
                <MaterialIcons name="receipt" size={24} color="#3498DB" />
                <Text style={[styles.expenseSummaryValue, { fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {expenses.length}
                </Text>
                <Text style={styles.expenseSummaryLabel}>Transactions</Text>
              </View>
              <View style={styles.expenseSummaryItem}>
                <MaterialIcons name="trending-up" size={24} color="#F39C12" />
                <Text style={[styles.expenseSummaryValue, { fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency(expenses.length > 0 ? expenses.reduce((sum, e) => sum + parseFloat(e.montant || 0), 0) / expenses.length : 0)}
                </Text>
                <Text style={styles.expenseSummaryLabel}>Moyenne</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Expenses by Category Chart */}
        {expensesByCategory.length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Dépenses par Catégorie</Title>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <PieChart
                  data={expensesByCategory.map((cat, index) => ({
                    name: cat.categorie,
                    population: parseFloat(cat.total || 0),
                    color: getCategoryColor(index),
                    legendFontColor: '#7F8C8D',
                    legendFontSize: getResponsiveValue(10, 11, 12)
                  }))}
                  width={Math.max(screenWidth - 60, 350)}
                  height={getResponsiveValue(200, 220, 240)}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </ScrollView>

              <View style={styles.categoryLegendContainer}>
                {expensesByCategory.map((cat, index) => (
                  <View key={index} style={styles.categoryLegendItem}>
                    <View style={[styles.categoryLegendColor, { backgroundColor: getCategoryColor(index) }]} />
                    <Text style={styles.categoryLegendText}>
                      {cat.categorie}: {formatCurrency(cat.total)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Expenses List */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Détails des Dépenses ({expenses.length})</Title>
            
            <Searchbar
              placeholder="Rechercher une dépense..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={expenses.filter(e => 
                (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.categorie || '').toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="receipt-long" size={60} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucune dépense pour cette période</Text>
                </View>
              }
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );

  const renderExpenseItem = ({ item }) => (
    <View style={styles.expenseItem}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseIconContainer}>
          <MaterialIcons 
            name={getExpenseCategoryIcon(item.categorie)} 
            size={getResponsiveValue(24, 28, 30)} 
            color="#E74C3C" 
          />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseDescription, { fontSize: getResponsiveValue(13, 14, 15) }]}>
            {item.description || 'Sans description'}
          </Text>
          <Text style={styles.expenseCategory}>{item.categorie || 'Non catégorisé'}</Text>
        </View>
        <Text style={[styles.expenseAmount, { fontSize: getResponsiveValue(14, 16, 18) }]}>
          {formatCurrency(item.montant)}
        </Text>
      </View>
      
      <View style={styles.expenseDetails}>
        <View style={styles.expenseDetailRow}>
          <MaterialIcons name="event" size={14} color="#7F8C8D" />
          <Text style={styles.expenseDetailText}>
            {formatDate(item.date_depense)}
          </Text>
        </View>
        {item.fournisseur && (
          <View style={styles.expenseDetailRow}>
            <MaterialIcons name="store" size={14} color="#7F8C8D" />
            <Text style={styles.expenseDetailText}>{item.fournisseur}</Text>
          </View>
        )}
        {item.reference && (
          <View style={styles.expenseDetailRow}>
            <MaterialIcons name="tag" size={14} color="#7F8C8D" />
            <Text style={styles.expenseDetailText}>Réf: {item.reference}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ==================== REVENUS TAB ====================
  const renderRevenusTab = () => (
    <View style={styles.tabContainer}>
      {/* Month/Year Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
            const newYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
            setSelectedMonth(newMonth);
            setSelectedYear(newYear);
          }}
        >
          <MaterialIcons name="chevron-left" size={24} color="#3498DB" />
        </TouchableOpacity>

        <View style={styles.periodDisplay}>
          <Text style={[styles.periodText, { fontSize: getResponsiveValue(14, 16, 18) }]}>
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric'
            })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => {
            const now = new Date();
            const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
            const newYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
            
            if (newYear < now.getFullYear() || 
                (newYear === now.getFullYear() && newMonth <= now.getMonth() + 1)) {
              setSelectedMonth(newMonth);
              setSelectedYear(newYear);
            }
          }}
        >
          <MaterialIcons name="chevron-right" size={24} color="#3498DB" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Revenues Summary */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Résumé des Revenus</Title>
            <View style={[
              styles.revenuesSummaryGrid,
              !isDesktop && { flexDirection: 'column', gap: 15 }
            ]}>
              <View style={styles.revenueSummaryItem}>
                <MaterialIcons name="attach-money" size={24} color="#2ECC71" />
                <Text style={[styles.revenueSummaryValue, { color: '#2ECC71', fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency((revenues || []).reduce((sum, r) => sum + parseFloat(r.montant || 0), 0))}
                </Text>
                <Text style={styles.revenueSummaryLabel}>Total</Text>
              </View>
              <View style={styles.revenueSummaryItem}>
                <MaterialIcons name="trending-up" size={24} color="#3498DB" />
                <Text style={[styles.revenueSummaryValue, { fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {revenues.length}
                </Text>
                <Text style={styles.revenueSummaryLabel}>Transactions</Text>
              </View>
              <View style={styles.revenueSummaryItem}>
                <MaterialIcons name="show-chart" size={24} color="#F39C12" />
                <Text style={[styles.revenueSummaryValue, { fontSize: getResponsiveValue(16, 18, 20) }]}>
                  {formatCurrency(revenues.length > 0 ? revenues.reduce((sum, r) => sum + parseFloat(r.montant || 0), 0) / revenues.length : 0)}
                </Text>
                <Text style={styles.revenueSummaryLabel}>Moyenne</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Revenues by Source Chart */}
        {revenuesBySource.length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Revenus par Source</Title>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={{
                    labels: revenuesBySource.map(s => (s.source || 'Autre').substring(0, 10)),
                    datasets: [{
                      data: revenuesBySource.map(s => parseFloat(s.total || 0))
                    }]
                  }}
                  width={Math.max(screenWidth - 60, revenuesBySource.length * 80)}
                  height={getResponsiveValue(200, 220, 240)}
                  chartConfig={{
                    backgroundColor: '#FFF',
                    backgroundGradientFrom: '#FFF',
                    backgroundGradientTo: '#FFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                    style: { borderRadius: 16 }
                  }}
                  style={styles.chart}
                  showValuesOnTopOfBars
                />
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        {/* Revenues List */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Détails des Revenus ({revenues.length})</Title>
            
            <Searchbar
              placeholder="Rechercher un revenu..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />

            <FlatList
              data={revenues.filter(r => 
                (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.source || '').toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={renderRevenueItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="payments" size={60} color="#BDC3C7" />
                  <Text style={styles.emptyText}>Aucun revenu pour cette période</Text>
                </View>
              }
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );

  const renderRevenueItem = ({ item }) => (
    <View style={styles.revenueItem}>
      <View style={styles.revenueHeader}>
        <View style={styles.revenueIconContainer}>
          <MaterialIcons name="payments" size={getResponsiveValue(24, 28, 30)} color="#2ECC71" />
        </View>
        <View style={styles.revenueInfo}>
          <Text style={[styles.revenueDescription, { fontSize: getResponsiveValue(13, 14, 15) }]}>
            {item.description || 'Sans description'}
          </Text>
          <Text style={styles.revenueSource}>{item.source || 'Source non spécifiée'}</Text>
        </View>
        <Text style={[styles.revenueAmount, { color: '#2ECC71', fontSize: getResponsiveValue(14, 16, 18) }]}>
          {formatCurrency(item.montant)}
        </Text>
      </View>
      
      <View style={styles.revenueDetails}>
        <View style={styles.revenueDetailRow}>
          <MaterialIcons name="event" size={14} color="#7F8C8D" />
          <Text style={styles.revenueDetailText}>
            {formatDate(item.date_revenu)}
          </Text>
        </View>
        {item.client && (
          <View style={styles.revenueDetailRow}>
            <MaterialIcons name="person" size={14} color="#7F8C8D" />
            <Text style={styles.revenueDetailText}>{item.client}</Text>
          </View>
        )}
        {item.reference && (
          <View style={styles.revenueDetailRow}>
            <MaterialIcons name="tag" size={14} color="#7F8C8D" />
            <Text style={styles.revenueDetailText}>Réf: {item.reference}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ==================== RAPPORTS TAB ====================
  const renderRapportsTab = () => (
    <ScrollView 
      style={styles.tabContainer}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Générer un Rapport Financier</Title>
          <Paragraph style={styles.sectionSubtitle}>
            Créez des rapports détaillés sur la situation financière de votre département
          </Paragraph>
          
          {/* Report Type Selection */}
          <Text style={styles.reportLabel}>Type de rapport:</Text>
          <View style={[styles.reportTypeContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Chip
              selected={reportType === 'complete'}
              onPress={() => setReportType('complete')}
              style={[styles.reportTypeChip, !isDesktop && { marginBottom: 8 }]}
              icon="file-document"
            >
              Complet
            </Chip>
            <Chip
              selected={reportType === 'budget'}
              onPress={() => setReportType('budget')}
              style={[styles.reportTypeChip, !isDesktop && { marginBottom: 8 }]}
              icon="account-balance-wallet"
            >
              Budget
            </Chip>
            <Chip
              selected={reportType === 'expenses'}
              onPress={() => setReportType('expenses')}
              style={[styles.reportTypeChip, !isDesktop && { marginBottom: 8 }]}
              icon="trending-down"
            >
              Dépenses
            </Chip>
            <Chip
              selected={reportType === 'revenues'}
              onPress={() => setReportType('revenues')}
              style={styles.reportTypeChip}
              icon="trending-up"
            >
              Revenus
            </Chip>
          </View>

          {/* Period Selection */}
          <Text style={styles.reportLabel}>Période:</Text>
          <View style={[styles.reportPeriodContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <Chip
              selected={reportPeriode === 'current_month'}
              onPress={() => setReportPeriode('current_month')}
              style={[styles.reportPeriodChip, !isDesktop && { marginBottom: 8 }]}
            >
              Mois en cours
            </Chip>
            <Chip
              selected={reportPeriode === 'last_month'}
              onPress={() => setReportPeriode('last_month')}
              style={[styles.reportPeriodChip, !isDesktop && { marginBottom: 8 }]}
            >
              Mois dernier
            </Chip>
            <Chip
              selected={reportPeriode === 'current_quarter'}
              onPress={() => setReportPeriode('current_quarter')}
              style={[styles.reportPeriodChip, !isDesktop && { marginBottom: 8 }]}
            >
              Trimestre
            </Chip>
            <Chip
              selected={reportPeriode === 'current_year'}
              onPress={() => setReportPeriode('current_year')}
              style={styles.reportPeriodChip}
            >
              Année
            </Chip>
          </View>

          {/* Export Format */}
          <Text style={styles.reportLabel}>Format d'export:</Text>
          <View style={[styles.exportFormatContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <TouchableOpacity
              style={[
                styles.formatButton,
                reportFormat === 'pdf' && styles.formatButtonSelected,
                !isDesktop && { marginBottom: 10 }
              ]}
              onPress={() => setReportFormat('pdf')}
            >
              <MaterialIcons 
                name="picture-as-pdf" 
                size={getResponsiveValue(28, 30, 32)} 
                color={reportFormat === 'pdf' ? '#FFF' : '#E74C3C'} 
              />
              <Text style={[
                styles.formatButtonText,
                reportFormat === 'pdf' && styles.formatButtonTextSelected
              ]}>
                PDF
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatButton,
                reportFormat === 'excel' && styles.formatButtonSelected
              ]}
              onPress={() => setReportFormat('excel')}
            >
              <MaterialIcons 
                name="table-chart" 
                size={getResponsiveValue(28, 30, 32)} 
                color={reportFormat === 'excel' ? '#FFF' : '#2ECC71'} 
              />
              <Text style={[
                styles.formatButtonText,
                reportFormat === 'excel' && styles.formatButtonTextSelected
              ]}>
                Excel
              </Text>
            </TouchableOpacity>
          </View>

          {/* Report Preview Info */}
          <View style={styles.reportPreviewInfo}>
            <MaterialIcons name="info" size={20} color="#3498DB" />
            <Text style={styles.reportPreviewText}>
              Le rapport {reportType} pour la période "{reportPeriode}" sera généré au format {reportFormat.toUpperCase()}
            </Text>
          </View>

          <Button
            mode="contained"
            icon="file-download"
            onPress={handleGenerateReport}
            style={styles.generateButton}
            loading={generatingReport}
            disabled={generatingReport}
          >
            {generatingReport ? 'Génération en cours...' : 'Générer et Télécharger'}
          </Button>
        </Card.Content>
      </Card>

      {/* Report Information */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>À propos des Rapports</Title>
          
          <View style={styles.reportInfoItem}>
            <MaterialIcons name="check-circle" size={20} color="#2ECC71" />
            <Text style={styles.reportInfoText}>
              Les rapports incluent toutes les transactions validées
            </Text>
          </View>

          <View style={styles.reportInfoItem}>
            <MaterialIcons name="check-circle" size={20} color="#2ECC71" />
            <Text style={styles.reportInfoText}>
              Format Excel inclut des graphiques interactifs
            </Text>
          </View>

          <View style={styles.reportInfoItem}>
            <MaterialIcons name="check-circle" size={20} color="#2ECC71" />
            <Text style={styles.reportInfoText}>
              Format PDF optimisé pour l'impression
            </Text>
          </View>

          <View style={styles.reportInfoItem}>
            <MaterialIcons name="check-circle" size={20} color="#2ECC71" />
            <Text style={styles.reportInfoText}>
              Génération instantanée avec données en temps réel
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      
      const response = await apiCall('/manager/generate-financial-report', 'POST', {
        type: reportType,
        format: reportFormat,
        periode: reportPeriode
      });

      if (isWeb) {
        // Web: Download file using base64 data
        const byteCharacters = atob(response.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        const blob = new Blob([byteArray], { 
          type: reportFormat === 'pdf' ? 'application/pdf' : 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Mobile: Save and share
        const filepath = `${FileSystem.documentDirectory}${response.fileName}`;
        
        await FileSystem.writeAsStringAsync(filepath, response.data, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filepath);
        } else {
          Alert.alert('Succès', `Rapport sauvegardé: ${response.fileName}`);
        }
      }
      
      Alert.alert('Succès', 'Rapport généré avec succès');
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Erreur', 'Impossible de générer le rapport. Veuillez réessayer.');
    } finally {
      setGeneratingReport(false);
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0) + ' BIF';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return '#E74C3C';
    if (percentage >= 75) return '#F39C12';
    if (percentage >= 50) return '#3498DB';
    return '#2ECC71';
  };

  const getRequestStatusColor = (status) => {
    switch(status) {
      case 'en_attente': return '#F39C12';
      case 'approuve': return '#2ECC71';
      case 'rejete': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const getCategoryColor = (index) => {
    const colors = [
      '#3498DB', '#E74C3C', '#2ECC71', '#F39C12', 
      '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'
    ];
    return colors[index % colors.length];
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'salaires': 'payments',
      'fournitures': 'inventory',
      'maintenance': 'build',
      'carburant': 'local-gas-station',
      'formation': 'school',
      'marketing': 'campaign',
      'informatique': 'computer',
      'équipement': 'construction',
      'transport': 'local-shipping',
      'communication': 'phone',
      'default': 'label'
    };
    
    const key = Object.keys(iconMap).find(k => 
      (category || '').toLowerCase().includes(k)
    );
    return iconMap[key] || iconMap.default;
  };

  const getExpenseCategoryIcon = (category) => {
    return getCategoryIcon(category);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={[styles.loadingText, { fontSize: getResponsiveValue(12, 14, 16) }]}>
          Chargement des données financières...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isWeb && styles.containerWeb]}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <MaterialIcons 
              name="dashboard" 
              size={20} 
              color={activeTab === 'overview' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              {isDesktop ? 'Vue d\'ensemble' : 'Aperçu'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'budget' && styles.activeTab]}
            onPress={() => setActiveTab('budget')}
          >
            <MaterialIcons 
              name="account-balance-wallet" 
              size={20} 
              color={activeTab === 'budget' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[styles.tabText, activeTab === 'budget' && styles.activeTabText]}>
              Budget
            </Text>
            {budgetRequests.filter(r => r.statut === 'en_attente').length > 0 && (
              <Badge style={styles.tabBadge}>
                {budgetRequests.filter(r => r.statut === 'en_attente').length}
              </Badge>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'depenses' && styles.activeTab]}
            onPress={() => setActiveTab('depenses')}
          >
            <MaterialIcons 
              name="trending-down" 
              size={20} 
              color={activeTab === 'depenses' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[styles.tabText, activeTab === 'depenses' && styles.activeTabText]}>
              Dépenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'revenus' && styles.activeTab]}
            onPress={() => setActiveTab('revenus')}
          >
            <MaterialIcons 
              name="trending-up" 
              size={20} 
              color={activeTab === 'revenus' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[styles.tabText, activeTab === 'revenus' && styles.activeTabText]}>
              Revenus
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'rapports' && styles.activeTab]}
            onPress={() => setActiveTab('rapports')}
          >
            <MaterialIcons 
              name="assessment" 
              size={20} 
              color={activeTab === 'rapports' ? '#2E86C1' : '#7F8C8D'} 
            />
            <Text style={[styles.tabText, activeTab === 'rapports' && styles.activeTabText]}>
              Rapports
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'budget' && renderBudgetTab()}
      {activeTab === 'depenses' && renderDepensesTab()}
      {activeTab === 'revenus' && renderRevenusTab()}
      {activeTab === 'rapports' && renderRapportsTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  containerWeb: {
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  loadingText: {
    marginTop: 10,
    color: '#7F8C8D',
  },
  tabBar: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveValue(15, 18, 20),
    paddingVertical: getResponsiveValue(12, 14, 15),
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2E86C1',
  },
  tabText: {
    marginLeft: 8,
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },
  tabBadge: {
    backgroundColor: '#E74C3C',
    marginLeft: 8,
  },
  tabContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionCard: {
    margin: getResponsiveValue(8, 10, 12),
    elevation: 2,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: getResponsiveValue(16, 18, 20),
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  sectionSubtitle: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
    marginTop: 5,
  },
  
  // Summary cards
  summaryCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    elevation: 2,
    borderRadius: 8,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryCardLabel: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    marginLeft: 10,
    flex: 1,
  },
  summaryCardValue: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  summaryCardSubtext: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#95A5A6',
    marginTop: 4,
  },
  
  // Progress
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
  },
  progressLabel: {
    color: '#2C3E50',
  },
  progressPercentage: {
    fontWeight: 'bold',
  },
  progressBarLarge: {
    borderRadius: 6,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    marginLeft: 8,
    color: '#E74C3C',
    fontSize: getResponsiveValue(12, 13, 14),
    fontWeight: '500',
    flex: 1,
  },
  
  // Charts
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
  },
  
  // Balance
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 15,
  },
  balanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  balanceDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#ECF0F1',
  },
  balanceLabel: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    marginTop: 8,
  },
  balanceValue: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  
  // Actions
  actionsGrid: {
    flexWrap: 'wrap',
    marginTop: 10,
  },
  actionButton: {
    alignItems: 'center',
    padding: getResponsiveValue(12, 15, 18),
    backgroundColor: '#F8F9F9',
    borderRadius: 10,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#2C3E50',
    textAlign: 'center',
  },
  
  // Budget
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  budgetLabel: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
  },
  budgetValue: {
    fontSize: getResponsiveValue(12, 13, 14),
    fontWeight: '600',
    color: '#2C3E50',
  },
  budgetDivider: {
    marginVertical: 10,
  },
  budgetProgressSection: {
    marginTop: 10,
  },
  budgetProgressLabel: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
    marginBottom: 8,
  },
  budgetProgressBar: {
    height: 10,
    borderRadius: 5,
  },
  budgetProgressText: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#2C3E50',
    marginTop: 4,
    textAlign: 'right',
  },
  
  // Categories
  categoryItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F8F9F9',
    borderRadius: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryName: {
    fontSize: getResponsiveValue(12, 13, 14),
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 8,
  },
  categoryAmount: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
  },
  categoryProgress: {
    height: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryUsage: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#95A5A6',
  },
  categoryPercentage: {
    fontSize: getResponsiveValue(10, 11, 12),
    fontWeight: '600',
  },
  categoryLegendContainer: {
    marginTop: 15,
  },
  categoryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  categoryLegendText: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#2C3E50',
  },
  
  // Requests
  requestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  newRequestButton: {
    backgroundColor: '#2E86C1',
  },
  requestItem: {
    backgroundColor: '#F8F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestInfo: {
    flex: 1,
  },
  requestBadges: {
    gap: 5,
    alignItems: 'flex-end',
  },
  requestAmount: {
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  requestCategory: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    marginTop: 2,
  },
  requestStatus: {
    height: 24,
  },
  urgentBadge: {
    backgroundColor: '#E74C3C',
    height: 20,
  },
  prioritaireBadge: {
    backgroundColor: '#F39C12',
    height: 20,
  },
  requestJustification: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#2C3E50',
    marginBottom: 8,
    lineHeight: 18,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestDate: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#95A5A6',
    marginLeft: 4,
  },
  adminResponse: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  adminResponseText: {
    marginLeft: 8,
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    flex: 1,
  },
  approvedAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  approvedAmountText: {
    marginLeft: 6,
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#2ECC71',
    fontWeight: '600',
  },
  
  // Modal
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
  },
  modalContainerWeb: {
    alignSelf: 'center',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  input: {
    marginBottom: 15,
    marginHorizontal: 20,
  },
  inputLabel: {
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#7F8C8D',
    marginLeft: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  urgenceContainer: {
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  urgenceChip: {
    flex: 1,
  },
  modalActions: {
    gap: 10,
    margin: 20,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2E86C1',
  },
  
  // Period selector
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 15,
    elevation: 1,
  },
  periodButton: {
    padding: 8,
  },
  periodDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  periodText: {
    fontWeight: 'bold',
    color: '#2C3E50',
    textTransform: 'capitalize',
  },
  
  // Expenses
  expensesSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  expenseSummaryItem: {
    alignItems: 'center',
  },
  expenseSummaryValue: {
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 5,
  },
  expenseSummaryLabel: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#7F8C8D',
    marginTop: 2,
  },
  searchBar: {
    backgroundColor: '#F8F9F9',
    elevation: 0,
    marginVertical: 10,
  },
  expenseItem: {
    backgroundColor: '#F8F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDEDEC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  expenseDescription: {
    fontWeight: '600',
    color: '#2C3E50',
  },
  expenseCategory: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    marginTop: 2,
  },
  expenseAmount: {
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  expenseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  expenseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseDetailText: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#7F8C8D',
    marginLeft: 4,
  },
  
  // Revenues
  revenuesSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  revenueSummaryItem: {
    alignItems: 'center',
  },
  revenueSummaryValue: {
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 5,
  },
  revenueSummaryLabel: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#7F8C8D',
    marginTop: 2,
  },
  revenueItem: {
    backgroundColor: '#F8F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D5F4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  revenueDescription: {
    fontWeight: '600',
    color: '#2C3E50',
  },
  revenueSource: {
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#7F8C8D',
    marginTop: 2,
  },
  revenueAmount: {
    fontWeight: 'bold',
  },
  revenueDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  revenueDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revenueDetailText: {
    fontSize: getResponsiveValue(10, 11, 12),
    color: '#7F8C8D',
    marginLeft: 4,
  },
  
  // Reports
  reportLabel: {
    fontSize: getResponsiveValue(12, 13, 14),
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 15,
    marginBottom: 10,
  },
  reportTypeContainer: {
    flexWrap: 'wrap',
    gap: 10,
  },
  reportTypeChip: {},
  reportPeriodContainer: {
    flexWrap: 'wrap',
    gap: 10,
  },
  reportPeriodChip: {},
  exportFormatContainer: {
    gap: 15,
    marginBottom: 20,
  },
  formatButton: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ECF0F1',
    backgroundColor: '#FFF',
  },
  formatButtonSelected: {
    borderColor: '#2E86C1',
    backgroundColor: '#2E86C1',
  },
  formatButtonText: {
    marginTop: 8,
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#2C3E50',
    fontWeight: '600',
  },
  formatButtonTextSelected: {
    color: '#FFF',
  },
  reportPreviewInfo: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  reportPreviewText: {
    marginLeft: 10,
    fontSize: getResponsiveValue(11, 12, 13),
    color: '#2C3E50',
    flex: 1,
  },
  generateButton: {
    backgroundColor: '#2E86C1',
    marginTop: 10,
  },
  reportInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  reportInfoText: {
    marginLeft: 10,
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#2C3E50',
    flex: 1,
  },
  
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: getResponsiveValue(12, 13, 14),
    color: '#95A5A6',
  },
});

export default FinancierDepartementScreen;