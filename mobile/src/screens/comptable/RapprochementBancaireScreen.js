// frontend/src/screens/comptable/RapprochementBancaireScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  Platform
} from 'react-native';
import {
  Card,
  Title,
  Searchbar,
  Checkbox,
  Button,
  DataTable,
  Portal,
  Dialog,
  TextInput as PaperInput,
  Chip,
  IconButton,
  ActivityIndicator
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import comptabiliteService from '../../services/comptabiliteService';

const RapprochementBancaireScreen = () => {
  const [loading, setLoading] = useState(true);
  const [paiements, setPaiements] = useState([]);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('non_rapproche');
  const [filterCompte, setFilterCompte] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [rapprochementDate, setRapprochementDate] = useState(new Date());
  const [showRapprochementPicker, setShowRapprochementPicker] = useState(false);
  const [totaux, setTotaux] = useState({ recettes: 0, depenses: 0, solde: 0 });
  const [exportLoading, setExportLoading] = useState(false);

  const comptes = [
    'Tous les comptes',
    'Compte principal',
    'Compte opérationnel',
    'Compte épargne',
    'Caisse'
  ];

  useEffect(() => {
    loadPaiements();
  }, [filterStatus, filterCompte, startDate, endDate]);

  const loadPaiements = async () => {
    try {
      setLoading(true);
      const data = await comptabiliteService.getRapprochementBancaire({
        statut: filterStatus,
        compte: filterCompte !== 'Tous les comptes' ? filterCompte : null,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      setPaiements(data.paiements || []);
      setTotaux(data.totaux || { recettes: 0, depenses: 0, solde: 0 });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les paiements');
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentSelection = (paymentId) => {
    setSelectedPayments(prev => {
      if (prev.includes(paymentId)) {
        return prev.filter(id => id !== paymentId);
      } else {
        return [...prev, paymentId];
      }
    });
  };

  const selectAll = () => {
    if (selectedPayments.length === filteredPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(filteredPayments.map(p => p.id));
    }
  };

  const handleRapprocher = () => {
    if (selectedPayments.length === 0) {
      Alert.alert('Attention', 'Veuillez sélectionner au moins un paiement');
      return;
    }
    setDialogVisible(true);
  };

  const confirmRapprochement = async () => {
    try {
      setLoading(true);
      await comptabiliteService.rapprocherPaiements({
        paiement_ids: selectedPayments,
        date_rapprochement: rapprochementDate.toISOString().split('T')[0]
      });

      Alert.alert('Succès', `${selectedPayments.length} paiement(s) rapproché(s) avec succès`);
      setSelectedPayments([]);
      setDialogVisible(false);
      loadPaiements();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de rapprocher les paiements');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setExportLoading(true);

      const response = await comptabiliteService.exportRapprochementExcel({
        compte: filterCompte === 'Tous les comptes' ? null : filterCompte,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        statut: filterStatus
      });

      if (response && response.data) {
        const filename = response.filename || `Rapprochement_Bancaire_${new Date().toISOString().split('T')[0]}.xlsx`;
        const fileUri = FileSystem.documentDirectory + filename;

        // Convertir base64 en fichier
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Partager le fichier
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exporter le rapprochement bancaire',
          });
        } else {
          Alert.alert('Succès', `Fichier sauvegardé: ${filename}`);
        }
      }
    } catch (error) {
      console.error('Export Excel error:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter les données en Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'BIF',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const filteredPayments = paiements.filter(payment => {
    const matchesSearch =
      payment.reference_paiement?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.source_nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const renderPaymentItem = ({ item }) => {
    const isSelected = selectedPayments.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.paymentItem, isSelected && styles.paymentItemSelected]}
        onPress={() => togglePaymentSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.paymentCheckbox}>
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            color="#2E86C1"
          />
        </View>

        <View style={styles.paymentContent}>
          <View style={styles.paymentHeader}>
            <Text style={styles.paymentRef}>{item.reference_paiement}</Text>
            {item.rapproche && (
              <Chip
                mode="flat"
                style={styles.rapprocheChip}
                textStyle={styles.rapprocheChipText}
              >
                Rapproché
              </Chip>
            )}
          </View>

          <View style={styles.paymentDetails}>
            <View style={styles.paymentDetailRow}>
              <MaterialIcons name="calendar-today" size={14} color="#7F8C8D" />
              <Text style={styles.paymentDetailText}>
                {formatDate(item.date_paiement)}
              </Text>
            </View>

            <View style={styles.paymentDetailRow}>
              <MaterialIcons name="account-balance-wallet" size={14} color="#7F8C8D" />
              <Text style={styles.paymentDetailText}>
                {item.mode_paiement}
              </Text>
            </View>
          </View>

          <Text style={styles.paymentSource} numberOfLines={1}>
            {item.source_nom}
          </Text>

          {item.description && (
            <Text style={styles.paymentDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.paymentFooter}>
            <View style={[
              styles.typeLabel,
              item.type_paiement === 'recette' ? styles.recetteLabel : styles.depenseLabel
            ]}>
              <Text style={styles.typeLabelText}>
                {item.type_paiement === 'recette' ? 'Recette' : 'Dépense'}
              </Text>
            </View>

            <Text style={[
              styles.paymentAmount,
              item.type_paiement === 'recette' ? styles.recetteAmount : styles.depenseAmount
            ]}>
              {item.type_paiement === 'recette' ? '+' : '-'}
              {formatCurrency(item.montant)}
            </Text>
          </View>

          {item.date_rapprochement && (
            <Text style={styles.rapprochementInfo}>
              Rapproché le {formatDate(item.date_rapprochement)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Title style={styles.headerTitle}>Rapprochement Bancaire</Title>

      {/* Filtres de période */}
      <View style={styles.periodFilter}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowStartPicker(true)}
        >
          <MaterialIcons name="calendar-today" size={18} color="#FFF" />
          <Text style={styles.dateButtonText}>
            Du {startDate.toLocaleDateString('fr-FR')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowEndPicker(true)}
        >
          <MaterialIcons name="calendar-today" size={18} color="#FFF" />
          <Text style={styles.dateButtonText}>
            Au {endDate.toLocaleDateString('fr-FR')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sélection de compte */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.compteFilter}
      >
        {comptes.map((compte, index) => (
          <Chip
            key={index}
            selected={filterCompte === compte}
            onPress={() => setFilterCompte(compte)}
            style={styles.compteChip}
            textStyle={styles.compteChipText}
          >
            {compte}
          </Chip>
        ))}
      </ScrollView>

      {/* Recherche */}
      <Searchbar
        placeholder="Rechercher un paiement..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        iconColor="#2E86C1"
      />

      {/* Filtres de statut */}
      <View style={styles.statusFilter}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            filterStatus === 'non_rapproche' && styles.statusButtonActive
          ]}
          onPress={() => setFilterStatus('non_rapproche')}
        >
          <Text style={[
            styles.statusButtonText,
            filterStatus === 'non_rapproche' && styles.statusButtonTextActive
          ]}>
            Non rapprochés
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            filterStatus === 'rapproche' && styles.statusButtonActive
          ]}
          onPress={() => setFilterStatus('rapproche')}
        >
          <Text style={[
            styles.statusButtonText,
            filterStatus === 'rapproche' && styles.statusButtonTextActive
          ]}>
            Rapprochés
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            filterStatus === 'all' && styles.statusButtonActive
          ]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[
            styles.statusButtonText,
            filterStatus === 'all' && styles.statusButtonTextActive
          ]}>
            Tous
          </Text>
        </TouchableOpacity>
      </View>

      {/* Résumé */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recettes</Text>
              <Text style={[styles.summaryValue, { color: '#27AE60' }]}>
                {formatCurrency(totaux.recettes)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Dépenses</Text>
              <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
                {formatCurrency(totaux.depenses)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Solde</Text>
              <Text style={[
                styles.summaryValue,
                { color: totaux.solde >= 0 ? '#27AE60' : '#E74C3C' }
              ]}>
                {formatCurrency(totaux.solde)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  const renderFooter = () => {
    if (filterStatus === 'rapproche') return null;

    return (
      <View style={styles.footer}>
        <View style={styles.selectionInfo}>
          <Checkbox
            status={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0 ? 'checked' : 'unchecked'}
            onPress={selectAll}
            color="#2E86C1"
          />
          <Text style={styles.selectionText}>
            {selectedPayments.length} sélectionné(s) sur {filteredPayments.length}
          </Text>
        </View>

        <View style={styles.footerActions}>
          <Button
            mode="outlined"
            onPress={exportToExcel}
            style={styles.exportButton}
            icon="file-excel"
          >
            Exporter
          </Button>

          <Button
            mode="contained"
            onPress={handleRapprocher}
            disabled={selectedPayments.length === 0}
            style={styles.rapprocherButton}
            icon="check-circle"
          >
            Rapprocher ({selectedPayments.length})
          </Button>
        </View>
      </View>
    );
  };

  if (loading && paiements.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
        <Text style={styles.loadingText}>Chargement des paiements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={60} color="#BDC3C7" />
            <Text style={styles.emptyText}>Aucun paiement à afficher</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadPaiements}
      />

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) setStartDate(selectedDate);
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
            if (selectedDate) setEndDate(selectedDate);
          }}
        />
      )}

      {showRapprochementPicker && (
        <DateTimePicker
          value={rapprochementDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowRapprochementPicker(false);
            if (selectedDate) setRapprochementDate(selectedDate);
          }}
        />
      )}

      {/* Dialog de confirmation */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title style={styles.dialogTitle}>
            Confirmer le rapprochement
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Vous allez rapprocher {selectedPayments.length} paiement(s).
            </Text>
            <Text style={styles.dialogSubtext}>
              Date du rapprochement:
            </Text>
            <TouchableOpacity
              style={styles.dialogDateButton}
              onPress={() => setShowRapprochementPicker(true)}
            >
              <MaterialIcons name="calendar-today" size={20} color="#2E86C1" />
              <Text style={styles.dialogDateText}>
                {rapprochementDate.toLocaleDateString('fr-FR')}
              </Text>
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Annuler</Button>
            <Button
              onPress={confirmRapprochement}
              loading={loading}
              textColor="#27AE60"
            >
              Confirmer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Indicateur d'export */}
      {exportLoading && (
        <View style={styles.exportOverlay}>
          <View style={styles.exportContainer}>
            <ActivityIndicator size="large" color="#2E86C1" />
            <Text style={styles.exportText}>Export Excel en cours...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

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
  headerTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    padding: 20,
    paddingBottom: 15,
  },
  periodFilter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E86C1',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  dateButtonText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  compteFilter: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  compteChip: {
    marginRight: 8,
    backgroundColor: '#ECF0F1',
  },
  compteChipText: {
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
  statusFilter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#2E86C1',
    borderColor: '#2E86C1',
  },
  statusButtonText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#7F8C8D',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  summaryValue: {
    fontFamily: 'Times New Roman',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  listContent: {
    paddingBottom: 100,
  },
  paymentItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 12,
    padding: 15,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  paymentItemSelected: {
    backgroundColor: '#E8F4F8',
    borderWidth: 2,
    borderColor: '#2E86C1',
  },
  paymentCheckbox: {
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  paymentContent: {
    flex: 1,
    marginLeft: 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentRef: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  rapprocheChip: {
    backgroundColor: '#27AE60',
    height: 24,
  },
  rapprocheChipText: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#FFFFFF',
  },
  paymentDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  paymentDetailText: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginLeft: 5,
  },
  paymentSource: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 5,
  },
  paymentDescription: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 10,
    lineHeight: 18,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  typeLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recetteLabel: {
    backgroundColor: '#D5F4E6',
  },
  depenseLabel: {
    backgroundColor: '#FADBD8',
  },
  typeLabelText: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentAmount: {
    fontFamily: 'Times New Roman',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recetteAmount: {
    color: '#27AE60',
  },
  depenseAmount: {
    color: '#E74C3C',
  },
  rapprochementInfo: {
    fontFamily: 'Times New Roman',
    fontSize: 11,
    color: '#7F8C8D',
    fontStyle: 'italic',
    marginTop: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    color: '#BDC3C7',
    marginTop: 15,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 4,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectionText: {
    fontFamily: 'Times New Roman',
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 10,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exportButton: {
    flex: 1,
    marginRight: 10,
    borderColor: '#2E86C1',
  },
  rapprocherButton: {
    flex: 1,
    backgroundColor: '#27AE60',
  },
  dialogTitle: {
    fontFamily: 'Times New Roman',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dialogText: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    color: '#2C3E50',
    marginBottom: 15,
  },
  dialogSubtext: {
    fontFamily: 'Times New Roman',
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 10,
  },
  dialogDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dialogDateText: {
    fontFamily: 'Times New Roman',
    fontSize: 15,
    color: '#2C3E50',
    marginLeft: 10,
  },
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  exportContainer: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  exportText: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    color: '#2C3E50',
    marginTop: 15,
  },
});

export default RapprochementBancaireScreen;