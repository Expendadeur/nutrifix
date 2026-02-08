// frontend/src/screens/NotificationsScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Platform,
} from 'react-native';
import {
  Card,
  Title,
  Chip,
  IconButton,
  ActivityIndicator,
  FAB,
  Menu,
  Divider,
  Snackbar,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';
import NotificationService from '../services/NotificationService';

const COLORS = {
  primary: '#1E40AF',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#EA580C',
  white: '#FFFFFF',
  grayBg: '#F3F4F6',
  grayCard: '#FAFAFA',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
};

const NotificationsScreen = ({ navigation }) => {
  // ============================================
  // ÉTATS
  // ============================================
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [stats, setStats] = useState(null);

  // ============================================
  // EFFETS
  // ============================================

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [selectedFilter]);

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const params = {
        unreadOnly: selectedFilter === 'unread' ? 'true' : 'false',
        limit: 50,
      };

      if (selectedFilter !== 'all' && selectedFilter !== 'unread') {
        params.priorite = selectedFilter;
      }

      const response = await api.get('/notifications', { params });

      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error('❌ Erreur chargement notifications:', error);
      showSnackbar('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/notifications/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    await loadStats();
    await NotificationService.loadAndUpdateBadge();
    setRefreshing(false);
  }, [selectedFilter]);

  // ============================================
  // ACTIONS SUR LES NOTIFICATIONS
  // ============================================

  const handleNotificationPress = async (notification) => {
    try {
      // Marquer comme lue
      if (notification.statut === 'non_lu') {
        await api.put(`/notifications/${notification.id}/read`);
        await NotificationService.decrementBadge();
        
        // Mettre à jour localement
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id ? { ...n, statut: 'lu' } : n
          )
        );
      }

      // Navigation basée sur le type
      navigateToReference(notification);
    } catch (error) {
      console.error('❌ Erreur handleNotificationPress:', error);
      showSnackbar('Erreur lors de l\'ouverture');
    }
  };

  const navigateToReference = (notification) => {
    const { type_notification, type_reference, id_reference } = notification;

    const navigationMap = {
      mission: { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },
      conge: { screen: 'RHPersonnel', params: { tab: 'conges' } },
      commande: { screen: 'CommercialClients', params: { commandeId: id_reference } },
      stock: { screen: 'FlouteAgricultureElevage', params: { tab: 'agriculture' } },
      maintenance: { screen: 'FlouteAgricultureElevage', params: { tab: 'flotte' } },
      facture: { screen: 'FinanceComptabilite', params: { tab: 'factures' } },
      paiement: { screen: 'FinanceComptabilite', params: { tab: 'paiements' } },
      animal: { screen: 'FlouteAgricultureElevage', params: { tab: 'elevage' } },
    };

    const nav = navigationMap[type_notification] || navigationMap[type_reference];

    if (nav) {
      navigation.navigate(nav.screen, nav.params);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      await NotificationService.decrementBadge();

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, statut: 'lu' } : n
        )
      );

      showSnackbar('Notification marquée comme lue');
    } catch (error) {
      console.error('❌ Erreur markAsRead:', error);
      showSnackbar('Erreur lors de la mise à jour');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      await NotificationService.clearBadge();

      setNotifications(prev =>
        prev.map(n => ({ ...n, statut: 'lu' }))
      );

      showSnackbar('Toutes les notifications marquées comme lues');
      await loadStats();
    } catch (error) {
      console.error('❌ Erreur markAllAsRead:', error);
      showSnackbar('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (notificationId) => {
    Alert.alert(
      'Supprimer la notification',
      'Êtes-vous sûr de vouloir supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/notifications/${notificationId}`);

              setNotifications(prev =>
                prev.filter(n => n.id !== notificationId)
              );

              showSnackbar('Notification supprimée');
              await loadStats();
            } catch (error) {
              console.error('❌ Erreur delete:', error);
              showSnackbar('Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAll = async () => {
    Alert.alert(
      'Supprimer toutes les notifications',
      'Êtes-vous sûr de vouloir supprimer toutes les notifications ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer tout',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/notifications');
              await NotificationService.clearBadge();

              setNotifications([]);
              showSnackbar('Toutes les notifications supprimées');
              await loadStats();
            } catch (error) {
              console.error('❌ Erreur deleteAll:', error);
              showSnackbar('Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // UTILITAIRES
  // ============================================

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      mission: 'local-shipping',
      conge: 'event',
      commande: 'shopping-cart',
      stock: 'inventory',
      maintenance: 'build',
      facture: 'receipt',
      paiement: 'payment',
      animal: 'pets',
      alerte: 'warning',
      systeme: 'settings',
    };
    return iconMap[type] || 'notifications';
  };

  const getNotificationColor = (priorite) => {
    const colorMap = {
      urgente: COLORS.danger,
      haute: COLORS.warning,
      normale: COLORS.primary,
      basse: COLORS.textSecondary,
    };
    return colorMap[priorite] || COLORS.primary;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // ============================================
  // RENDU DES COMPOSANTS
  // ============================================

  const renderNotificationCard = (notification) => {
    const isUnread = notification.statut === 'non_lu';
    const color = getNotificationColor(notification.priorite);

    return (
      <TouchableOpacity
        key={notification.id}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <Card
          style={[
            styles.notificationCard,
            isUnread && styles.unreadCard,
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.notificationHeader}>
              <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <MaterialIcons
                  name={getNotificationIcon(notification.type_notification)}
                  size={24}
                  color={color}
                />
              </View>

              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle} numberOfLines={1}>
                  {notification.titre}
                </Text>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {notification.message}
                </Text>
                <Text style={styles.notificationTime}>
                  {formatDate(notification.date_creation)}
                </Text>
              </View>

              <View style={styles.actionsContainer}>
                {isUnread && (
                  <View style={styles.unreadBadge}>
                    <MaterialIcons name="fiber-manual-record" size={12} color={COLORS.primary} />
                  </View>
                )}
                
                <IconButton
                  icon="delete"
                  size={20}
                  iconColor={COLORS.danger}
                  onPress={() => handleDelete(notification.id)}
                />
              </View>
            </View>

            {notification.priorite === 'urgente' && (
              <Chip
                icon="priority-high"
                style={styles.urgentChip}
                textStyle={styles.urgentChipText}
              >
                Urgent
              </Chip>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <Card style={styles.statsCard}>
        <Card.Content>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total || 0}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>
                {stats.unread || 0}
              </Text>
              <Text style={styles.statLabel}>Non lues</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: COLORS.danger }]}>
                {stats.urgent || 0}
              </Text>
              <Text style={styles.statLabel}>Urgentes</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      {[
        { key: 'all', label: 'Toutes' },
        { key: 'unread', label: 'Non lues' },
        { key: 'urgente', label: 'Urgentes' },
        { key: 'haute', label: 'Importantes' },
        { key: 'normale', label: 'Normales' },
      ].map(filter => (
        <Chip
          key={filter.key}
          selected={selectedFilter === filter.key}
          onPress={() => setSelectedFilter(filter.key)}
          style={[
            styles.filterChip,
            selectedFilter === filter.key && styles.filterChipSelected,
          ]}
          textStyle={{
            color: selectedFilter === filter.key ? COLORS.white : COLORS.textSecondary,
            fontWeight: selectedFilter === filter.key ? '700' : '500',
          }}
        >
          {filter.label}
        </Chip>
      ))}
    </ScrollView>
  );

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement des notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={COLORS.white}
            onPress={() => navigation.goBack()}
          />
          <Title style={styles.headerTitle}>Notifications</Title>
        </View>

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={24}
              iconColor={COLORS.white}
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              handleMarkAllAsRead();
            }}
            title="Tout marquer comme lu"
            leadingIcon="check-all"
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              handleDeleteAll();
            }}
            title="Tout supprimer"
            leadingIcon="delete"
            titleStyle={{ color: COLORS.danger }}
          />
        </Menu>
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Filtres */}
      {renderFilters()}

      {/* Liste des notifications */}
      <ScrollView
        style={styles.notificationsList}
        contentContainerStyle={styles.notificationsContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Aucune notification</Text>
          </View>
        ) : (
          notifications.map(renderNotificationCard)
        )}
      </ScrollView>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: COLORS.primary }}
      >
        <Text style={{ color: COLORS.white }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.grayBg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.grayBg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Stats
  statsCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Filtres
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.grayCard,
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
  },

  // Notifications
  notificationsList: {
    flex: 1,
  },
  notificationsContent: {
    padding: 16,
  },
  notificationCard: {
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayCard,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    marginRight: 8,
  },
  urgentChip: {
    marginTop: 12,
    backgroundColor: COLORS.danger + '20',
    alignSelf: 'flex-start',
  },
  urgentChipText: {
    color: COLORS.danger,
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;