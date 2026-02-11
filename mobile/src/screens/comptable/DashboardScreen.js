// frontend/src/screens/comptable/DashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  FlatList
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Avatar,
  IconButton,
  ActivityIndicator,
  Badge,
  Surface,
  Chip,
  Divider,
  ProgressBar,
  Modal,
  Portal,
  TextInput,
  Button
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { BaseEmployeService } from '../../services/employeService';

// ==================== RESPONSIVE UTILITIES ====================
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;
const isLargeDesktop = screenWidth >= 1440;

const getResponsiveValue = (mobile, tablet, desktop, largeDesktop) => {
  if (isLargeDesktop && largeDesktop !== undefined) return largeDesktop;
  if (isDesktop && desktop !== undefined) return desktop;
  if (isTablet && tablet !== undefined) return tablet;
  return mobile;
};

const getKPICardWidth = () => {
  const columns = getResponsiveValue(2, 3, 4, 4);
  const padding = 30;
  const gap = 15;
  return (screenWidth - (padding * 2) - (gap * (columns - 1))) / columns;
};

const DashboardComptableScreen = () => {
  const navigation = useNavigation();

  // ==================== STATE MANAGEMENT ====================
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [chartType, setChartType] = useState('creances');
  const [error, setError] = useState(null);

  // Communication avec l'Admin
  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // ==================== EFFECTS ====================
  useEffect(() => {
    loadDashboard();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  // ==================== LOAD DATA FROM API ====================
  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Appel API réel vers votre endpoint
      const response = await api.get('/comptabilite/dashboard');

      if (response.data.success) {
        setDashboardData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Erreur de chargement');
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      setError(error.response?.data?.message || error.message || 'Erreur de connexion');
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Impossible de charger le tableau de bord'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, []);

  const handleSendMessage = async () => {
    if (!messageSubject || !messageBody) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setIsSending(true);
      const response = await BaseEmployeService.contactAdmin(messageSubject, messageBody);

      if (response.success) {
        Alert.alert('Succès', 'Votre message a été envoyé à l\'administration');
        setCommunicationModalVisible(false);
        setMessageSubject('');
        setMessageBody('');
      } else {
        throw new Error(response.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer le message');
    } finally {
      setIsSending(false);
    }
  };

  // ==================== UTILITY FUNCTIONS ====================
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 BIF';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getAlertColor = (niveau) => {
    switch (niveau) {
      case 'urgent': return '#E74C3C';
      case 'warning': return '#F39C12';
      case 'info': return '#3498DB';
      default: return '#7F8C8D';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'creances_echues': return 'assignment-late';
      case 'dettes_echues': return 'warning';
      case 'rapprochement': return 'sync-problem';
      case 'low_cash': return 'account-balance-wallet';
      default: return 'info';
    }
  };

  const getCategoryColor = (categorie) => {
    const colors = {
      'Achats': '#E74C3C',
      'Salaires': '#3498DB',
      'Charges': '#F39C12',
      'Autres': '#95A5A6'
    };
    return colors[categorie] || '#7F8C8D';
  };

  const getPeriodLabel = () => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const mois = dashboardData?.periode?.mois || new Date().getMonth() + 1;
    const annee = dashboardData?.periode?.annee || new Date().getFullYear();
    return `${months[mois - 1]} ${annee}`;
  };

  // ==================== CHART CONFIGURATIONS ====================
  const chartConfig = {
    backgroundColor: '#FFF',
    backgroundGradientFrom: '#FFF',
    backgroundGradientTo: '#FFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(46, 134, 193, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#2E86C1'
    },
    propsForLabels: {
      fontSize: getResponsiveValue(10, 11, 12, 12)
    }
  };

  // ==================== RENDER COMPONENTS ====================
  const renderHeader = () => (
    <Surface style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Avatar.Icon
            size={getResponsiveValue(50, 55, 60, 65)}
            icon="calculator"
            style={styles.avatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Tableau de Bord</Text>
            <Text style={styles.subGreeting}>Comptabilité</Text>
            <Text style={styles.period}>{getPeriodLabel()}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <IconButton
            icon="human-greeting-proximity"
            size={24}
            iconColor="#FFF"
            onPress={() => setCommunicationModalVisible(true)}
            style={styles.headerIconButton}
          />
          <IconButton
            icon="bell"
            size={24}
            iconColor="#FFF"
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerIconButton}
          />
          {dashboardData?.alertes?.length > 0 && (
            <Badge style={styles.notificationBadge}>
              {dashboardData.alertes.length}
            </Badge>
          )}
          <IconButton
            icon="refresh"
            size={24}
            iconColor="#FFF"
            onPress={onRefresh}
            style={styles.headerIconButton}
          />
        </View>
      </View>
    </Surface>
  );

  const renderAlerts = () => {
    if (!dashboardData?.alertes || dashboardData.alertes.length === 0) {
      return null;
    }

    return (
      <Card style={styles.alertCard}>
        <Card.Content>
          <View style={styles.alertHeader}>
            <MaterialIcons name="warning" size={24} color="#E74C3C" />
            <Title style={styles.alertTitle}>Alertes importantes</Title>
            <Badge style={styles.alertBadge}>{dashboardData.alertes.length}</Badge>
          </View>

          {dashboardData.alertes.map((alerte, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.alertItem,
                { borderLeftColor: getAlertColor(alerte.niveau) }
              ]}
              onPress={() => handleAlertPress(alerte)}
              activeOpacity={0.7}
            >
              <View style={styles.alertItemContent}>
                <MaterialIcons
                  name={getAlertIcon(alerte.type)}
                  size={20}
                  color={getAlertColor(alerte.niveau)}
                />
                <View style={styles.alertItemInfo}>
                  <Text style={styles.alertMessage}>{alerte.titre}</Text>
                  <Text style={styles.alertDetail}>{alerte.message}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#BDC3C7" />
              </View>
            </TouchableOpacity>
          ))}
        </Card.Content>
      </Card>
    );
  };

  const renderKPIs = () => (
    <View style={styles.kpiContainer}>
      {/* Trésorerie */}
      <Surface style={[styles.kpiCard, styles.kpiTresorerie]}>
        <TouchableOpacity
          style={styles.kpiContent}
          onPress={() => navigation.navigate('Tresorerie')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiIconContainer}>
            <FontAwesome5 name="coins" size={getResponsiveValue(24, 26, 28, 30)} color="#FFF" />
          </View>
          <View style={styles.kpiInfo}>
            <Text style={styles.kpiLabel}>Trésorerie</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(dashboardData?.tresorerie?.solde_tresorerie)}
            </Text>
            {dashboardData?.tresorerie?.variation !== undefined && (
              <View style={styles.kpiVariation}>
                <MaterialIcons
                  name={dashboardData.tresorerie.variation >= 0 ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={dashboardData.tresorerie.variation >= 0 ? '#2ECC71' : '#E74C3C'}
                />
                <Text style={[
                  styles.kpiVariationText,
                  { color: dashboardData.tresorerie.variation >= 0 ? '#2ECC71' : '#E74C3C' }
                ]}>
                  {Math.abs(dashboardData.tresorerie.variation).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Surface>

      {/* Créances */}
      <Surface style={[styles.kpiCard, styles.kpiCreances]}>
        <TouchableOpacity
          style={styles.kpiContent}
          onPress={() => navigation.navigate('Factures', { type: 'vente', statut: 'impayee' })}
          activeOpacity={0.8}
        >
          <View style={styles.kpiIconContainer}>
            <FontAwesome5 name="file-invoice-dollar" size={getResponsiveValue(24, 26, 28, 30)} color="#FFF" />
          </View>
          <View style={styles.kpiInfo}>
            <Text style={styles.kpiLabel}>Créances Clients</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(dashboardData?.creances?.total_creances)}
            </Text>
            <Text style={styles.kpiSubtext}>
              {dashboardData?.creances?.nombre_factures_impayees || 0} factures impayées
            </Text>
          </View>
        </TouchableOpacity>
      </Surface>

      {/* Dettes */}
      <Surface style={[styles.kpiCard, styles.kpiDettes]}>
        <TouchableOpacity
          style={styles.kpiContent}
          onPress={() => navigation.navigate('Factures', { type: 'achat', statut: 'impayee' })}
          activeOpacity={0.8}
        >
          <View style={styles.kpiIconContainer}>
            <FontAwesome5 name="hand-holding-usd" size={getResponsiveValue(24, 26, 28, 30)} color="#FFF" />
          </View>
          <View style={styles.kpiInfo}>
            <Text style={styles.kpiLabel}>Dettes Fournisseurs</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(dashboardData?.dettes?.total_dettes)}
            </Text>
            <Text style={styles.kpiSubtext}>
              {dashboardData?.dettes?.nombre_factures_a_payer || 0} factures à payer
            </Text>
          </View>
        </TouchableOpacity>
      </Surface>

      {/* Rapprochements */}
      <Surface style={[styles.kpiCard, styles.kpiRapprochement]}>
        <TouchableOpacity
          style={styles.kpiContent}
          onPress={() => navigation.navigate('RapprochementBancaire')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiIconContainer}>
            <MaterialIcons name="sync-alt" size={getResponsiveValue(28, 30, 32, 34)} color="#FFF" />
          </View>
          <View style={styles.kpiInfo}>
            <Text style={styles.kpiLabel}>À Rapprocher</Text>
            <Text style={styles.kpiValue}>
              {dashboardData?.rapprochements?.paiements_non_rapproches || 0}
            </Text>
            <Text style={styles.kpiSubtext}>
              {formatCurrency(dashboardData?.rapprochements?.montant_non_rapproche)}
            </Text>
          </View>
        </TouchableOpacity>
      </Surface>
    </View>
  );

  const renderCharts = () => (
    <View style={styles.chartsContainer}>
      {/* Chart Selector */}
      <View style={styles.chartSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip
            selected={chartType === 'creances'}
            onPress={() => setChartType('creances')}
            style={styles.chartChip}
            textStyle={styles.chartChipText}
          >
            Créances
          </Chip>
          <Chip
            selected={chartType === 'tresorerie'}
            onPress={() => setChartType('tresorerie')}
            style={styles.chartChip}
            textStyle={styles.chartChipText}
          >
            Trésorerie
          </Chip>
          <Chip
            selected={chartType === 'depenses'}
            onPress={() => setChartType('depenses')}
            style={styles.chartChip}
            textStyle={styles.chartChipText}
          >
            Dépenses
          </Chip>
        </ScrollView>
      </View>

      {/* Charts */}
      {chartType === 'creances' && renderCreancesChart()}
      {chartType === 'tresorerie' && renderTresorerieChart()}
      {chartType === 'depenses' && renderDepensesChart()}
    </View>
  );

  const renderCreancesChart = () => {
    if (!dashboardData?.creances) return null;

    const pieData = [
      {
        name: 'Échues',
        population: parseFloat(dashboardData.creances.creances_echues || 0),
        color: '#E74C3C',
        legendFontColor: '#2C3E50',
        legendFontSize: getResponsiveValue(11, 12, 13, 14)
      },
      {
        name: '0-30j',
        population: parseFloat(dashboardData.creances.creances_30j || 0),
        color: '#F39C12',
        legendFontColor: '#2C3E50',
        legendFontSize: getResponsiveValue(11, 12, 13, 14)
      },
      {
        name: '31-60j',
        population: parseFloat(dashboardData.creances.creances_60j || 0),
        color: '#3498DB',
        legendFontColor: '#2C3E50',
        legendFontSize: getResponsiveValue(11, 12, 13, 14)
      },
      {
        name: '+60j',
        population: parseFloat(dashboardData.creances.creances_plus_60j || 0),
        color: '#9B59B6',
        legendFontColor: '#2C3E50',
        legendFontSize: getResponsiveValue(11, 12, 13, 14)
      }
    ].filter(item => item.population > 0);

    if (pieData.length === 0) {
      return (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={styles.chartTitle}>Répartition des Créances</Title>
            <View style={styles.emptyChart}>
              <MaterialIcons name="pie-chart" size={40} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune créance en cours</Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.chartCard}>
        <Card.Content>
          <Title style={styles.chartTitle}>Répartition des Créances</Title>
          <Paragraph style={styles.chartSubtitle}>
            Par ancienneté - Total: {formatCurrency(dashboardData.creances.total_creances)}
          </Paragraph>

          <PieChart
            data={pieData}
            width={screenWidth - getResponsiveValue(60, 80, 100, 120)}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </Card.Content>
      </Card>
    );
  };

  const renderTresorerieChart = () => {
    if (!dashboardData?.evolution_tresorerie || dashboardData.evolution_tresorerie.length === 0) {
      return (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={styles.chartTitle}>Évolution de la Trésorerie</Title>
            <View style={styles.emptyChart}>
              <MaterialIcons name="show-chart" size={40} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.chartCard}>
        <Card.Content>
          <Title style={styles.chartTitle}>Évolution de la Trésorerie</Title>
          <Paragraph style={styles.chartSubtitle}>
            Derniers mois
          </Paragraph>

          <BarChart
            data={{
              labels: dashboardData.evolution_tresorerie.map(e => e.mois),
              datasets: [
                {
                  data: dashboardData.evolution_tresorerie.map(e => e.recettes / 1000000),
                  color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`
                },
                {
                  data: dashboardData.evolution_tresorerie.map(e => e.depenses / 1000000),
                  color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`
                }
              ],
              legend: ['Recettes (M)', 'Dépenses (M)']
            }}
            width={screenWidth - getResponsiveValue(60, 80, 100, 120)}
            height={220}
            chartConfig={{
              ...chartConfig,
              barPercentage: 0.7,
              fillShadowGradient: '#2E86C1',
              fillShadowGradientOpacity: 1
            }}
            style={styles.chart}
          />
        </Card.Content>
      </Card>
    );
  };

  const renderDepensesChart = () => {
    if (!dashboardData?.repartition_depenses || dashboardData.repartition_depenses.length === 0) {
      return (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Title style={styles.chartTitle}>Répartition des Dépenses</Title>
            <View style={styles.emptyChart}>
              <MaterialIcons name="pie-chart" size={40} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune dépense enregistrée</Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.chartCard}>
        <Card.Content>
          <Title style={styles.chartTitle}>Répartition des Dépenses</Title>
          <Paragraph style={styles.chartSubtitle}>
            Par catégorie - Période en cours
          </Paragraph>

          <PieChart
            data={dashboardData.repartition_depenses.map(item => ({
              name: item.categorie,
              population: item.montant,
              color: getCategoryColor(item.categorie),
              legendFontColor: '#2C3E50',
              legendFontSize: getResponsiveValue(11, 12, 13, 14)
            }))}
            width={screenWidth - getResponsiveValue(60, 80, 100, 120)}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </Card.Content>
      </Card>
    );
  };

  const renderTransactions = () => (
    <Card style={styles.transactionsCard}>
      <Card.Content>
        <View style={styles.transactionsHeader}>
          <Title style={styles.transactionsTitle}>Transactions Récentes</Title>
          <TouchableOpacity onPress={() => navigation.navigate('Paiements')}>
            <View style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Voir tout</Text>
              <MaterialIcons name="chevron-right" size={18} color="#3498DB" />
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          data={dashboardData?.transactions?.slice(0, 5) || []}
          renderItem={renderTransactionItem}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <Divider style={styles.transactionDivider} />}
          ListEmptyComponent={
            <View style={styles.emptyTransactions}>
              <MaterialIcons name="receipt" size={40} color="#BDC3C7" />
              <Text style={styles.emptyText}>Aucune transaction récente</Text>
            </View>
          }
        />
      </Card.Content>
    </Card>
  );

  const renderTransactionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => handleTransactionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionLeft}>
        <View style={[
          styles.transactionIcon,
          { backgroundColor: item.type_paiement === 'recette' ? '#E8F8F5' : '#FDEDEC' }
        ]}>
          <MaterialIcons
            name={item.type_paiement === 'recette' ? 'arrow-downward' : 'arrow-upward'}
            size={20}
            color={item.type_paiement === 'recette' ? '#2ECC71' : '#E74C3C'}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionSource} numberOfLines={1}>
            {item.source_nom}
          </Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>{formatDate(item.date_paiement)}</Text>
            {item.mode_paiement && (
              <>
                <Text style={styles.transactionSeparator}>•</Text>
                <Text style={styles.transactionMode}>{item.mode_paiement}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: item.type_paiement === 'recette' ? '#2ECC71' : '#E74C3C' }
      ]}>
        {item.type_paiement === 'recette' ? '+' : '-'}
        {formatCurrency(item.montant)}
      </Text>
    </TouchableOpacity>
  );

  const renderCommunicationModal = () => (
    <Portal>
      <Modal
        visible={communicationModalVisible}
        onDismiss={() => setCommunicationModalVisible(false)}
        contentContainerStyle={styles.commModalContainer}
      >
        <View style={styles.commModalHeader}>
          <MaterialCommunityIcons name="message-text" size={28} color="#2E86C1" />
          <Title style={styles.commModalTitle}>Contacter l'Admin</Title>
        </View>

        <View style={styles.commModalBody}>
          <Text style={styles.commModalLabel}>Sujet</Text>
          <TextInput
            mode="outlined"
            placeholder="Sujet de votre message"
            value={messageSubject}
            onChangeText={setMessageSubject}
            style={styles.commInput}
            outlineColor="#E0E0E0"
            activeOutlineColor="#2E86C1"
          />

          <Text style={styles.commModalLabel}>Message</Text>
          <TextInput
            mode="outlined"
            placeholder="Décrivez votre demande ou question ici..."
            value={messageBody}
            onChangeText={setMessageBody}
            multiline
            numberOfLines={6}
            style={[styles.commInput, styles.commTextArea]}
            outlineColor="#E0E0E0"
            activeOutlineColor="#2E86C1"
          />

          <View style={styles.commModalActions}>
            <Button
              mode="outlined"
              onPress={() => setCommunicationModalVisible(false)}
              style={styles.commCancelBtn}
              labelStyle={{ color: '#7F8C8D' }}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleSendMessage}
              loading={isSending}
              disabled={isSending}
              style={styles.commSendBtn}
              buttonColor="#2E86C1"
            >
              Envoyer
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  const renderQuickActions = () => (
    <Card style={styles.quickActionsCard}>
      <Card.Content>
        <Title style={styles.quickActionsTitle}>Actions Rapides</Title>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('RapprochementBancaire')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4F8' }]}>
              <MaterialIcons name="account-balance" size={28} color="#3498DB" />
            </View>
            <Text style={styles.quickActionText}>Rapprochement</Text>
            {dashboardData?.rapprochements?.paiements_non_rapproches > 0 && (
              <Badge style={styles.quickActionBadge}>
                {dashboardData.rapprochements.paiements_non_rapproches}
              </Badge>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('JournalComptable')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#E8F8F5' }]}>
              <FontAwesome5 name="book" size={24} color="#2ECC71" />
            </View>
            <Text style={styles.quickActionText}>Journal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Factures')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#F4ECF7' }]}>
              <FontAwesome5 name="file-invoice" size={24} color="#9B59B6" />
            </View>
            <Text style={styles.quickActionText}>Factures</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Paiements')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEF5E7' }]}>
              <MaterialIcons name="payment" size={28} color="#F39C12" />
            </View>
            <Text style={styles.quickActionText}>Paiements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Rapports')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#EBF5FB' }]}>
              <MaterialIcons name="assessment" size={28} color="#2E86C1" />
            </View>
            <Text style={styles.quickActionText}>Rapports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Cloture')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FDEDEC' }]}>
              <MaterialIcons name="lock" size={28} color="#E74C3C" />
            </View>
            <Text style={styles.quickActionText}>Clôture</Text>
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );

  // ==================== EVENT HANDLERS ====================
  const handleAlertPress = (alerte) => {
    switch (alerte.type) {
      case 'creances_echues':
        navigation.navigate('Factures', { type: 'vente', filter: 'echues' });
        break;
      case 'dettes_echues':
        navigation.navigate('Factures', { type: 'achat', filter: 'echues' });
        break;
      case 'rapprochement':
        navigation.navigate('RapprochementBancaire');
        break;
      default:
        break;
    }
  };

  const handleTransactionPress = (transaction) => {
    navigation.navigate('PaiementDetails', { paiementId: transaction.id });
  };

  // ==================== RENDER MAIN ====================
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
      </SafeAreaView>
    );
  }

  if (error && !dashboardData) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={60} color="#E74C3C" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2E86C1" />

      {/* Header */}
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E86C1']}
            tintColor="#2E86C1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Alerts */}
        {renderAlerts()}

        {/* KPIs */}
        {renderKPIs()}

        {/* Charts */}
        {renderCharts()}

        {/* Transactions */}
        {renderTransactions()}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Communication Modal */}
        {renderCommunicationModal()}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
    padding: 30,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2E86C1',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#2E86C1',
    elevation: 4,
    paddingVertical: getResponsiveValue(15, 18, 20, 22),
    paddingHorizontal: getResponsiveValue(15, 20, 25, 30),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerInfo: {
    marginLeft: 15,
    flex: 1,
  },
  greeting: {
    fontSize: getResponsiveValue(20, 22, 24, 26),
    fontWeight: 'bold',
    color: '#FFF',
  },
  subGreeting: {
    fontSize: getResponsiveValue(14, 15, 16, 17),
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  period: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  headerIconButton: {
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 48,
    backgroundColor: '#E74C3C',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Alerts
  alertCard: {
    margin: getResponsiveValue(15, 18, 20, 25),
    marginBottom: 0,
    elevation: 3,
    borderRadius: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: getResponsiveValue(16, 17, 18, 19),
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#E74C3C',
    flex: 1,
  },
  alertBadge: {
    backgroundColor: '#E74C3C',
  },
  alertItem: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#F8F9F9',
    borderRadius: 8,
  },
  alertItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  alertMessage: {
    fontSize: getResponsiveValue(14, 15, 16, 16),
    fontWeight: '600',
    color: '#2C3E50',
  },
  alertDetail: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    color: '#7F8C8D',
    marginTop: 4,
  },

  // KPIs
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsiveValue(15, 18, 20, 25),
    marginTop: getResponsiveValue(15, 18, 20, 25),
    gap: 15,
  },
  kpiCard: {
    width: getKPICardWidth(),
    borderRadius: 12,
    elevation: 3,
    marginBottom: 0,
  },
  kpiTresorerie: {
    backgroundColor: '#2ECC71',
  },
  kpiCreances: {
    backgroundColor: '#3498DB',
  },
  kpiDettes: {
    backgroundColor: '#E74C3C',
  },
  kpiRapprochement: {
    backgroundColor: '#F39C12',
  },
  kpiContent: {
    padding: getResponsiveValue(15, 18, 20, 22),
  },
  kpiIconContainer: {
    marginBottom: 12,
  },
  kpiInfo: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: getResponsiveValue(20, 22, 24, 26),
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 6,
  },
  kpiSubtext: {
    fontSize: getResponsiveValue(11, 12, 12, 13),
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  kpiVariation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  kpiVariationText: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    fontWeight: '600',
    marginLeft: 4,
  },

  // Charts
  chartsContainer: {
    marginTop: getResponsiveValue(15, 18, 20, 25),
  },
  chartSelector: {
    paddingHorizontal: getResponsiveValue(15, 18, 20, 25),
    marginBottom: 15,
  },
  chartChip: {
    marginRight: 10,
    height: 36,
  },
  chartChipText: {
    fontSize: getResponsiveValue(13, 14, 14, 15),
  },
  chartCard: {
    marginHorizontal: getResponsiveValue(15, 18, 20, 25),
    marginBottom: 15,
    elevation: 2,
    borderRadius: 12,
  },
  chartTitle: {
    fontSize: getResponsiveValue(16, 17, 18, 19),
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 6,
  },
  chartSubtitle: {
    fontSize: getResponsiveValue(12, 13, 14, 14),
    color: '#7F8C8D',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 10,
    fontSize: getResponsiveValue(13, 14, 15, 15),
    color: '#95A5A6',
  },

  // Transactions
  transactionsCard: {
    marginHorizontal: getResponsiveValue(15, 18, 20, 25),
    marginBottom: 15,
    elevation: 2,
    borderRadius: 12,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  transactionsTitle: {
    fontSize: getResponsiveValue(16, 17, 18, 19),
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#3498DB',
    fontSize: getResponsiveValue(13, 14, 15, 15),
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionSource: {
    fontSize: getResponsiveValue(14, 15, 15, 16),
    fontWeight: '600',
    color: '#2C3E50',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transactionDate: {
    fontSize: getResponsiveValue(11, 12, 12, 13),
    color: '#7F8C8D',
  },
  transactionSeparator: {
    marginHorizontal: 6,
    color: '#BDC3C7',
    fontSize: getResponsiveValue(11, 12, 12, 13),
  },
  transactionMode: {
    fontSize: getResponsiveValue(11, 12, 12, 13),
    color: '#7F8C8D',
    textTransform: 'capitalize',
  },
  transactionAmount: {
    fontSize: getResponsiveValue(15, 16, 17, 18),
    fontWeight: 'bold',
  },
  transactionDivider: {
    marginVertical: 2,
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  // Quick Actions
  quickActionsCard: {
    marginHorizontal: getResponsiveValue(15, 18, 20, 25),
    marginBottom: 15,
    elevation: 2,
    borderRadius: 12,
  },
  quickActionsTitle: {
    fontSize: getResponsiveValue(16, 17, 18, 19),
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionButton: {
    width: getResponsiveValue('48%', '30%', '22%', '22%'),
    alignItems: 'center',
    paddingVertical: 15,
    position: 'relative',
  },
  quickActionIcon: {
    width: getResponsiveValue(50, 55, 60, 65),
    height: getResponsiveValue(50, 55, 60, 65),
    borderRadius: getResponsiveValue(25, 27.5, 30, 32.5),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: getResponsiveValue(12, 13, 13, 14),
    color: '#2C3E50',
    fontWeight: '500',
    textAlign: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: 10,
    right: getResponsiveValue('25%', '30%', '35%', '35%'),
    backgroundColor: '#E74C3C',
  },

  // Communication Modal Styles
  commModalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 16,
    elevation: 5,
  },
  commModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
  },
  commModalTitle: {
    marginLeft: 10,
    fontSize: 20,
    color: '#2E86C1',
  },
  commModalBody: {
    gap: 15,
  },
  commModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: -5,
  },
  commInput: {
    backgroundColor: '#FFF',
  },
  commTextArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  commModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  commCancelBtn: {
    borderColor: '#BDC3C7',
    borderRadius: 8,
  },
  commSendBtn: {
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default DashboardComptableScreen;