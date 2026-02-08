// frontend/src/screens/employe/BulletinsSalaireScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  useWindowDimensions,
  Platform
} from 'react-native';
import {
  Card,
  ActivityIndicator,
  Divider
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const BulletinsSalaireScreen = ({ navigation }) => {
  const windowDimensions = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulletins, setBulletins] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBulletin, setSelectedBulletin] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statistics, setStatistics] = useState(null);

  // Responsive
  const isSmallDevice = windowDimensions.width < 768;
  const isDesktop = windowDimensions.width >= 1024;
  const containerPadding = isSmallDevice ? 15 : isDesktop ? 35 : 25;
  const cardWidth = isDesktop ? '48%' : '100%';

  useEffect(() => {
    loadBulletins();
  }, [selectedYear]);

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return {
        'Content-Type': 'application/json'
      };
    }
  };

  const loadBulletins = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${API_URL}/employe-inss/salaires?annee=${selectedYear}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Bulletins chargés:', data);
        setBulletins(data.data?.bulletins || []);
        setStatistics(data.data?.statistiques || null);
      } else {
        console.warn('⚠️ Erreur chargement bulletins');
        setBulletins([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement bulletins:', error);
      Alert.alert('Erreur', 'Impossible de charger les bulletins de salaire');
      setBulletins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBulletins();
  };

  const viewBulletinDetail = async (bulletin) => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${API_URL}/employe-inss/salaires/${bulletin.id}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedBulletin(data.data);
        setShowDetailModal(true);
      } else {
        Alert.alert('Erreur', 'Impossible de charger les détails du bulletin');
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du bulletin');
    }
  };

  const downloadBulletin = (bulletin) => {
    Alert.alert(
      'Télécharger le bulletin',
      'Fonctionnalité de téléchargement PDF à implémenter',
      [{ text: 'OK' }]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0) + ' FBU';
  };

  const formatMonth = (mois, annee) => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${monthNames[mois - 1]} ${annee}`;
  };

  const getStatusColor = (statut) => {
    switch(statut) {
      case 'paye': return '#10B981';
      case 'en_attente': return '#F59E0B';
      case 'en_cours': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (statut) => {
    switch(statut) {
      case 'paye': return 'Payé';
      case 'en_attente': return 'En attente';
      case 'en_cours': return 'En cours';
      default: return 'Inconnu';
    }
  };

  const renderYearSelector = () => {
    return (
      <View style={[styles.yearSelector, { paddingHorizontal: containerPadding }]}>
        <TouchableOpacity
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear - 1)}
        >
          <MaterialIcons name="chevron-left" size={24} color="#1F2937" />
        </TouchableOpacity>

        <View style={styles.yearDisplay}>
          <Text style={styles.yearText}>{selectedYear}</Text>
        </View>

        <TouchableOpacity
          style={styles.yearButton}
          onPress={() => setSelectedYear(selectedYear + 1)}
          disabled={selectedYear >= new Date().getFullYear()}
        >
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={selectedYear >= new Date().getFullYear() ? '#D1D5DB' : '#1F2937'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <Card style={[styles.statsCard, { marginHorizontal: containerPadding }]}>
        <View style={styles.cardContent}>
          <Text style={styles.statsTitle}>Résumé {selectedYear}</Text>
          <View style={[
            styles.statsContainer,
            { flexDirection: isSmallDevice ? 'column' : 'row' }
          ]}>
            <View style={[styles.statItem, isSmallDevice && styles.statItemMobile]}>
              <MaterialIcons name="attach-money" size={24} color="#10B981" />
              <Text style={styles.statValue}>
                {formatCurrency(statistics.total_brut)}
              </Text>
              <Text style={styles.statLabel}>Total brut</Text>
            </View>

            {!isSmallDevice && <View style={styles.statDivider} />}

            <View style={[styles.statItem, isSmallDevice && styles.statItemMobile]}>
              <MaterialIcons name="account-balance" size={24} color="#3B82F6" />
              <Text style={styles.statValue}>
                {formatCurrency(statistics.total_net)}
              </Text>
              <Text style={styles.statLabel}>Total net</Text>
            </View>

            {!isSmallDevice && <View style={styles.statDivider} />}

            <View style={[styles.statItem, isSmallDevice && styles.statItemMobile]}>
              <MaterialIcons name="receipt" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{statistics.nombre_bulletins}</Text>
              <Text style={styles.statLabel}>Bulletins</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderBulletinCard = (bulletin, index) => {
    const isPaid = bulletin.statut_paiement === 'paye';
    const statusColor = getStatusColor(bulletin.statut_paiement);

    return (
      <TouchableOpacity
        key={index}
        onPress={() => viewBulletinDetail(bulletin)}
        activeOpacity={0.7}
        style={[
          styles.bulletinCardWrapper,
          { width: cardWidth }
        ]}
      >
        <Card style={styles.bulletinCard}>
          <View style={styles.cardContent}>
            <View style={styles.bulletinHeader}>
              <View style={styles.bulletinLeft}>
                <View style={[styles.monthIcon, { backgroundColor: `${statusColor}20` }]}>
                  <MaterialIcons name="calendar-today" size={24} color={statusColor} />
                </View>
                <View style={styles.bulletinInfo}>
                  <Text style={styles.monthText}>
                    {formatMonth(bulletin.mois, bulletin.annee)}
                  </Text>
                  {bulletin.heures_travaillees && (
                    <View style={styles.detailsRow}>
                      <MaterialIcons name="access-time" size={14} color="#6B7280" />
                      <Text style={styles.heuresText}>
                        {bulletin.heures_travaillees}h travaillées
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <MaterialIcons
                  name={isPaid ? 'check-circle' : 'schedule'}
                  size={16}
                  color="#FFF"
                />
                <Text style={styles.statusText}>
                  {getStatusLabel(bulletin.statut_paiement)}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.salarySection}>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Salaire brut</Text>
                <Text style={styles.salaryValue}>
                  {formatCurrency(bulletin.salaire_brut)}
                </Text>
              </View>

              {bulletin.primes > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Primes et bonus</Text>
                  <Text style={[styles.salaryValue, { color: '#10B981' }]}>
                    +{formatCurrency(bulletin.primes)}
                  </Text>
                </View>
              )}

              {bulletin.total_deductions > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Déductions</Text>
                  <Text style={[styles.salaryValue, { color: '#EF4444' }]}>
                    -{formatCurrency(bulletin.total_deductions)}
                  </Text>
                </View>
              )}

              <Divider style={styles.totalDivider} />

              <View style={styles.netSalaryContainer}>
                <Text style={styles.netLabel}>Salaire net</Text>
                <Text style={styles.netAmount}>
                  {formatCurrency(bulletin.salaire_net)}
                </Text>
              </View>
            </View>

            {isPaid && bulletin.date_paiement && (
              <View style={styles.paymentInfo}>
                <MaterialIcons name="event" size={16} color="#10B981" />
                <Text style={styles.paymentText}>
                  Payé le {new Date(bulletin.date_paiement).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => viewBulletinDetail(bulletin)}
              >
                <MaterialIcons name="visibility" size={20} color="#3B82F6" />
                <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>
                  Détails
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => downloadBulletin(bulletin)}
              >
                <MaterialIcons name="download" size={20} color="#10B981" />
                <Text style={[styles.actionButtonText, { color: '#10B981' }]}>
                  Télécharger
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedBulletin) return null;

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            {
              width: isSmallDevice ? '100%' : isDesktop ? '70%' : '90%',
              maxWidth: isDesktop ? 900 : windowDimensions.width,
              maxHeight: isDesktop ? '85%' : '90%',
            }
          ]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <LinearGradient
                colors={['#2563EB', '#3B82F6']}
                style={styles.modalHeader}
              >
                <View style={styles.modalHeaderContent}>
                  <View>
                    <Text style={styles.modalTitle}>Bulletin de Salaire</Text>
                    <Text style={styles.modalPeriod}>
                      {formatMonth(selectedBulletin.mois, selectedBulletin.annee)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Informations employé */}
              <View style={styles.employeeSection}>
                <Text style={styles.sectionTitle}>Informations employé</Text>
                <View style={[
                  styles.infoGrid,
                  { flexDirection: isSmallDevice ? 'column' : 'row' }
                ]}>
                  <View style={[styles.infoItem, { width: isSmallDevice ? '100%' : '50%' }]}>
                    <Text style={styles.infoLabel}>Nom complet</Text>
                    <Text style={styles.infoValue}>
                      {selectedBulletin.nom_complet || 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.infoItem, { width: isSmallDevice ? '100%' : '50%' }]}>
                    <Text style={styles.infoLabel}>Matricule</Text>
                    <Text style={styles.infoValue}>
                      {selectedBulletin.matricule || 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.infoItem, { width: isSmallDevice ? '100%' : '50%' }]}>
                    <Text style={styles.infoLabel}>N° CNSS</Text>
                    <Text style={styles.infoValue}>
                      {selectedBulletin.numero_cnss || 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.infoItem, { width: isSmallDevice ? '100%' : '50%' }]}>
                    <Text style={styles.infoLabel}>Département</Text>
                    <Text style={styles.infoValue}>
                      {selectedBulletin.departement || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Rémunération brute */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rémunération brute</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Salaire de base</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedBulletin.salaire_brut)}
                  </Text>
                </View>

                {selectedBulletin.heures_supp > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Heures supplémentaires ({selectedBulletin.heures_supp}h)
                    </Text>
                    <Text style={[styles.detailValue, { color: '#10B981' }]}>
                      +{formatCurrency(selectedBulletin.heures_supp * (selectedBulletin.taux_heure_supp || 0))}
                    </Text>
                  </View>
                )}

                {selectedBulletin.primes > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Primes</Text>
                    <Text style={[styles.detailValue, { color: '#10B981' }]}>
                      +{formatCurrency(selectedBulletin.primes)}
                    </Text>
                  </View>
                )}

                {selectedBulletin.indemnites > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Indemnités</Text>
                    <Text style={[styles.detailValue, { color: '#10B981' }]}>
                      +{formatCurrency(selectedBulletin.indemnites)}
                    </Text>
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total brut</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(selectedBulletin.salaire_brut)}
                  </Text>
                </View>
              </View>

              {/* Déductions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Déductions</Text>

                {selectedBulletin.deduction_inss > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cotisation INSS</Text>
                    <Text style={[styles.detailValue, { color: '#EF4444' }]}>
                      -{formatCurrency(selectedBulletin.deduction_inss)}
                    </Text>
                  </View>
                )}

                {selectedBulletin.deduction_impots > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Impôt professionnel</Text>
                    <Text style={[styles.detailValue, { color: '#EF4444' }]}>
                      -{formatCurrency(selectedBulletin.deduction_impots)}
                    </Text>
                  </View>
                )}

                {selectedBulletin.autres_deductions > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Autres déductions</Text>
                    <Text style={[styles.detailValue, { color: '#EF4444' }]}>
                      -{formatCurrency(selectedBulletin.autres_deductions)}
                    </Text>
                  </View>
                )}

                {selectedBulletin.avances > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Avances sur salaire</Text>
                    <Text style={[styles.detailValue, { color: '#EF4444' }]}>
                      -{formatCurrency(selectedBulletin.avances)}
                    </Text>
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total déductions</Text>
                  <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                    -{formatCurrency(selectedBulletin.total_deductions)}
                  </Text>
                </View>
              </View>

              {/* Net à payer */}
              <View style={styles.netPaySection}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.netPayGradient}
                >
                  <Text style={styles.netPayLabel}>Net à payer</Text>
                  <Text style={styles.netPayAmount}>
                    {formatCurrency(selectedBulletin.salaire_net)}
                  </Text>
                </LinearGradient>
              </View>

              {/* Informations de paiement */}
              {selectedBulletin.statut_paiement === 'paye' && selectedBulletin.date_paiement && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Informations de paiement</Text>
                  <View style={styles.paymentDetails}>
                    <View style={styles.paymentRow}>
                      <MaterialIcons name="event" size={20} color="#10B981" />
                      <View style={styles.paymentInfoDetails}>
                        <Text style={styles.paymentLabel}>Date de paiement</Text>
                        <Text style={styles.paymentValue}>
                          {new Date(selectedBulletin.date_paiement).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Boutons d'action */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => {
                    setShowDetailModal(false);
                    downloadBulletin(selectedBulletin);
                  }}
                >
                  <MaterialIcons name="download" size={24} color="#FFF" />
                  <Text style={styles.downloadButtonText}>Télécharger PDF</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                Ce bulletin est un document officiel. Conservez-le pour vos archives.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement des bulletins...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        contentContainerStyle={{
          paddingBottom: 30,
        }}
      >
        {renderYearSelector()}
        {renderStatistics()}

        <View style={[
          styles.bulletinsContainer,
          {
            paddingHorizontal: containerPadding,
            flexDirection: isDesktop ? 'row' : 'column',
            flexWrap: isDesktop ? 'wrap' : 'nowrap',
            justifyContent: isDesktop ? 'space-between' : 'flex-start',
          }
        ]}>
          {bulletins.length > 0 ? (
            bulletins.map((bulletin, index) => renderBulletinCard(bulletin, index))
          ) : (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyContent}>
                <MaterialIcons name="receipt-long" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Aucun bulletin</Text>
                <Text style={styles.emptyText}>
                  Aucun bulletin de salaire disponible pour {selectedYear}
                </Text>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>

      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  yearButton: {
    padding: 10,
  },
  yearDisplay: {
    marginHorizontal: 30,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
  },
  yearText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  cardContent: {
    padding: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  statsContainer: {
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  statItemMobile: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 15,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
  },
  bulletinsContainer: {
    paddingTop: 0,
  },
  bulletinCardWrapper: {
    marginBottom: 16,
  },
  bulletinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  bulletinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bulletinLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  monthIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletinInfo: {
    marginLeft: 12,
    flex: 1,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heuresText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#E5E7EB',
  },
  salarySection: {
    marginBottom: 16,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  salaryLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  salaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  totalDivider: {
    marginVertical: 12,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  netSalaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  netAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
  },
  paymentText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 6,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
  },
  modalHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalPeriod: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 4,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  employeeSection: {
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoGrid: {
    flexWrap: 'wrap',
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  netPaySection: {
    padding: 20,
  },
  netPayGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  netPayLabel: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '700',
  },
  netPayAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  paymentDetails: {
    marginTop: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  paymentInfoDetails: {
    marginLeft: 12,
    flex: 1,
  },
  paymentLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  modalActions: {
    padding: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
    paddingTop: 0,
    fontWeight: '500',
  },
});

export default BulletinsSalaireScreen;