// frontend/src/screens/comptable/ClotureScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import comptabiliteService from '../../services/comptabiliteService';

const { width } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────
const C = {
  white: '#FFFFFF',
  black: '#1A1A2E',
  bleu: '#1B4F8A',
  bleuClair: '#2E86C1',
  bleuPale: '#E8F1F8',
  vert: '#1E8449',
  vertClair: '#27AE60',
  vertPale: '#D5F4E6',
  rouge: '#C0392B',
  rougeClair: '#E74C3C',
  rougePale: '#FADBD8',
  silver: '#BDC3C7',
  silverClair: '#ECF0F1',
  silverSombre: '#7F8C8D',
  fond: '#F4F6F9',
  texteSecond: '#5D6D7E',
  orange: '#E67E22',
  orangePale: '#FDEBD0',
};

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

const STATUTS_CLOTURE = {
  ouverte:  { label: 'Ouverte',   color: C.orange,     bg: C.orangePale },
  validee:  { label: 'Validée',   color: C.bleuClair,  bg: C.bleuPale },
  cloturee: { label: 'Clôturée',  color: C.vertClair,  bg: C.vertPale },
};

const ClotureScreen = ({ navigation }) => {
  // ── States ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [clotures, setClotures] = useState([]);
  const [selectedCloture, setSelectedCloture] = useState(null);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [moisCreer, setMoisCreer] = useState(new Date().getMonth() + 1);
  const [creationLoading, setCreationLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    loadClotures();
  }, [annee]);

  const loadClotures = async () => {
    try {
      setLoading(true);
      const data = await comptabiliteService.getClotures({ annee });
      setClotures(data || []);
      setSelectedCloture(null);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les clôtures.');
    } finally {
      setLoading(false);
    }
  };

  // ── Créer clôture ───────────────────────────────────────────
  const handleCreerCloture = async () => {
    const existe = clotures.find((c) => c.mois === moisCreer && c.annee === annee);
    if (existe) {
      Alert.alert('Attention', 'Une clôture existe déjà pour cette période.');
      return;
    }
    try {
      setCreationLoading(true);
      const res = await comptabiliteService.creerCloture(moisCreer, annee);
      Alert.alert('Succès', 'Clôture créée avec succès.');
      loadClotures();
    } catch (e) {
      Alert.alert('Erreur', 'Création échouée.');
    } finally {
      setCreationLoading(false);
    }
  };

  // ── Valider ─────────────────────────────────────────────────
  const handleValider = async () => {
    if (!selectedCloture || selectedCloture.statut !== 'ouverte') return;
    try {
      setActionLoading(true);
      await comptabiliteService.validerCloture(selectedCloture.id);
      Alert.alert('Succès', 'Clôture validée.');
      loadClotures();
    } catch (e) {
      Alert.alert('Erreur', 'Validation échouée.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Clôturer définitivement ─────────────────────────────────
  const handleCloturer = async () => {
    if (!selectedCloture || selectedCloture.statut !== 'validee') return;
    Alert.alert(
      'Confirmation',
      'Cette action est irréversible. Êtes-vous sûr de vouloir clôturer définitivement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Clôturer',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await comptabiliteService.cloturerDefinitif(selectedCloture.id);
              Alert.alert('Succès', 'Clôture finalisée.');
              loadClotures();
            } catch (e) {
              Alert.alert('Erreur', 'Clôture échouée.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Formatage ───────────────────────────────────────────────
  const fmt = (n) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

  const fmtDate = (d) => {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ── Détail clôture sélectionnée ─────────────────────────────
  const renderDetailView = () => {
    const cl = selectedCloture;
    if (!cl) return null;
    const st = STATUTS_CLOTURE[cl.statut] || STATUTS_CLOTURE.ouverte;
    const resultat = parseFloat(cl.resultat_brut || 0);
    const positif = resultat >= 0;

    // Données graphique charges (PieChart)
    const pieData = [
      { name: 'Achats',    population: parseFloat(cl.total_achats || 0),      color: C.bleuClair,  legendFontColor: C.silverSombre },
      { name: 'Personnel', population: parseFloat(cl.charges_personnel || 0), color: C.orange,     legendFontColor: C.silverSombre },
      { name: 'Autres',    population: parseFloat(cl.autres_charges || 0),    color: C.rougeClair, legendFontColor: C.silverSombre },
    ].filter(d => d.population > 0);

    // Données graphique CA vs Charges (BarChart)
    const barData = {
      labels: ['CA', 'Achats', 'Personnel', 'Autres', 'Résultat'],
      datasets: [
        {
          data: [
            parseFloat(cl.chiffre_affaires || 0),
            parseFloat(cl.total_achats || 0),
            parseFloat(cl.charges_personnel || 0),
            parseFloat(cl.autres_charges || 0),
            Math.abs(resultat),
          ],
          colors: [C.vertClair, C.bleuClair, C.orange, C.rougeClair, positif ? C.vertClair : C.rougeClair],
        },
      ],
    };

    return (
      <ScrollView style={s.detailScroll} showsVerticalScrollIndicator={false}>
        {/* Header détail */}
        <View style={s.detailHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setSelectedCloture(null)}>
            <MaterialIcons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={s.detailHeaderInfo}>
            <Text style={s.detailHeaderTitle}>
              Clôture – {MOIS_LABELS[cl.mois - 1]} {cl.annee}
            </Text>
            <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[s.statusBadgeTxt, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>
        </View>

        {/* Résultat brut – card mise en valeur */}
        <View style={[s.resultatCard, { borderColor: positif ? C.vertClair : C.rougeClair }]}>
          <Text style={s.resultatLabel}>Résultat Brut</Text>
          <Text style={[s.resultatVal, { color: positif ? C.vertClair : C.rougeClair }]}>
            {positif ? '+' : ''}{fmt(resultat)}
          </Text>
          <Text style={[s.resultatSub, { color: positif ? C.vertClair : C.rougeClair }]}>
            {positif ? '▲ Bénéfice' : '▼ Perte'}
          </Text>
        </View>

        {/* Grille KPI */}
        <View style={s.kpiGrid}>
          {[
            { label: 'Chiffre d\'Affaires', val: cl.chiffre_affaires, color: C.vertClair, icon: 'trending-up' },
            { label: 'Total Achats', val: cl.total_achats, color: C.bleuClair, icon: 'shopping-cart' },
            { label: 'Charges Personnel', val: cl.charges_personnel, color: C.orange, icon: 'people' },
            { label: 'Autres Charges', val: cl.autres_charges, color: C.rougeClair, icon: 'receipt-long' },
            { label: 'Variation Trésorerie', val: cl.variation_tresorerie, color: parseFloat(cl.variation_tresorerie || 0) >= 0 ? C.vertClair : C.rougeClair, icon: 'account-balance' },
            { label: 'Créances Clients', val: cl.creances_clients, color: C.bleuClair, icon: 'assignment' },
            { label: 'Dettes Fournisseurs', val: cl.dettes_fournisseurs, color: C.rougeClair, icon: 'business' },
          ].map((item, i) => (
            <View key={i} style={s.kpiItem}>
              <View style={[s.kpiIcon, { backgroundColor: item.color + '18' }]}>
                <MaterialIcons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={s.kpiLabel}>{item.label}</Text>
              <Text style={[s.kpiVal, { color: item.color }]}>{fmt(item.val)}</Text>
            </View>
          ))}
        </View>

        {/* Graphique Charges (PieChart) */}
        {pieData.length > 0 && (
          <View style={s.chartBox}>
            <Text style={s.chartTitle}>Répartition des Charges</Text>
            <PieChart
              data={pieData}
              width={width - 40}
              height={180}
              chartConfig={{ color: (o = 1) => `rgba(0,0,0,${o})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="10"
              absolute
            />
          </View>
        )}

        {/* Graphique CA vs Charges (BarChart) */}
        <View style={s.chartBox}>
          <Text style={s.chartTitle}>CA vs Charges</Text>
          <BarChart
            data={barData}
            width={width - 40}
            height={200}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: C.white,
              backgroundGradientTo: C.white,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(30, 132, 73, ${opacity})`,
              labelColor: () => C.silverSombre,
              style: { borderRadius: 8 },
            }}
            style={{ marginLeft: -10 }}
            showBarNumbers={false}
          />
        </View>

        {/* Traçabilité */}
        <View style={s.traceBox}>
          <Text style={s.traceTitle}>Traçabilité</Text>
          <View style={s.traceRow}>
            <Text style={s.traceLabel}>Créé par</Text>
            <Text style={s.traceVal}>{cl.cree_par_nom || '–'} le {fmtDate(cl.date_creation)}</Text>
          </View>
          {cl.valide_par_nom && (
            <View style={s.traceRow}>
              <Text style={s.traceLabel}>Validé par</Text>
              <Text style={s.traceVal}>{cl.valide_par_nom} le {fmtDate(cl.date_validation)}</Text>
            </View>
          )}
          {cl.cloture_par_nom && (
            <View style={s.traceRow}>
              <Text style={s.traceLabel}>Clôturé par</Text>
              <Text style={s.traceVal}>{cl.cloture_par_nom} le {fmtDate(cl.date_cloture)}</Text>
            </View>
          )}
        </View>

        {/* Actions workflow */}
        <View style={s.actionBox}>
          {cl.statut === 'ouverte' && (
            <TouchableOpacity
              style={[s.wfBtn, { backgroundColor: C.bleuClair }]}
              onPress={handleValider}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color={C.white} />
                  <Text style={s.wfBtnTxt}>Valider la Clôture</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {cl.statut === 'validee' && (
            <TouchableOpacity
              style={[s.wfBtn, { backgroundColor: C.rouge }]}
              onPress={handleCloturer}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <MaterialIcons name="lock" size={20} color={C.white} />
                  <Text style={s.wfBtnTxt}>Clôturer Définitivement</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {cl.statut === 'cloturee' && (
            <View style={[s.wfBtn, { backgroundColor: C.vertPale }]}>
              <MaterialIcons name="lock" size={20} color={C.vertClair} />
              <Text style={[s.wfBtnTxt, { color: C.vertClair }]}>Période Clôturée – Lecture Seule</Text>
            </View>
          )}

          {/* Export */}
          <TouchableOpacity style={[s.wfBtn, { backgroundColor: C.silverClair, marginTop: 10 }]}>
            <MaterialIcons name="picture-as-pdf" size={20} color={C.silverSombre} />
            <Text style={[s.wfBtnTxt, { color: C.silverSombre }]}>Exporter rapport PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    );
  };

  // ── Liste clôtures ──────────────────────────────────────────
  const renderListeView = () => (
    <View style={s.flex1}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Clôture Mensuelle</Text>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.yearBtn} onPress={() => setAnnee(annee - 1)}>
            <MaterialIcons name="chevron-left" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={s.yearTxt}>{annee}</Text>
          <TouchableOpacity style={s.yearBtn} onPress={() => setAnnee(annee + 1)}>
            <MaterialIcons name="chevron-right" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Créer nouvelle clôture */}
      <View style={s.creationBox}>
        <Text style={s.creationLabel}>Créer une clôture pour :</Text>
        <View style={s.creationRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.moisScroll}>
            {MOIS_LABELS.map((m, i) => {
              const n = i + 1;
              const actif = moisCreer === n;
              const existe = clotures.some((c) => c.mois === n);
              return (
                <TouchableOpacity
                  key={n}
                  style={[s.moisChip, actif && { backgroundColor: C.bleuClair, borderColor: C.bleuClair }, existe && { opacity: 0.5 }]}
                  onPress={() => !existe && setMoisCreer(n)}
                  disabled={existe}
                >
                  <Text style={[s.moisChipTxt, actif && { color: C.white }]}>{m.slice(0, 3)}</Text>
                  {existe && <Text style={s.moisChipDone}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <TouchableOpacity
          style={[s.btnCreer, { opacity: creationLoading ? 0.6 : 1 }]}
          onPress={handleCreerCloture}
          disabled={creationLoading}
        >
          {creationLoading ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <MaterialIcons name="add-circle" size={20} color={C.white} />
              <Text style={s.btnCreerTxt}>Créer Clôture {MOIS_LABELS[moisCreer - 1]} {annee}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Liste */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.bleuClair} />
          <Text style={s.loadTxt}>Chargement…</Text>
        </View>
      ) : clotures.length === 0 ? (
        <View style={s.center}>
          <MaterialIcons name="lock-open" size={56} color={C.silver} />
          <Text style={s.emptyTxt}>Aucune clôture pour {annee}</Text>
        </View>
      ) : (
        <ScrollView style={s.listScroll}>
          {clotures
            .sort((a, b) => b.mois - a.mois)
            .map((cl) => {
              const st = STATUTS_CLOTURE[cl.statut] || STATUTS_CLOTURE.ouverte;
              const resultat = parseFloat(cl.resultat_brut || 0);
              const positif = resultat >= 0;
              return (
                <TouchableOpacity
                  key={cl.id}
                  style={s.listCard}
                  onPress={() => setSelectedCloture(cl)}
                >
                  <View style={s.listCardHeader}>
                    <View style={[s.listMoisBadge, { backgroundColor: C.bleuPale }]}>
                      <Text style={[s.listMoisTxt, { color: C.bleuClair }]}>{MOIS_LABELS[cl.mois - 1]}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[s.statusBadgeTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  <View style={s.listCardRow}>
                    <View style={s.listCardCol}>
                      <Text style={s.listCardLabel}>CA</Text>
                      <Text style={[s.listCardVal, { color: C.vertClair }]}>{fmt(cl.chiffre_affaires)}</Text>
                    </View>
                    <View style={s.listCardCol}>
                      <Text style={s.listCardLabel}>Charges</Text>
                      <Text style={[s.listCardVal, { color: C.rougeClair }]}>{fmt(cl.total_charges)}</Text>
                    </View>
                    <View style={s.listCardCol}>
                      <Text style={s.listCardLabel}>Résultat</Text>
                      <Text style={[s.listCardVal, { color: positif ? C.vertClair : C.rougeClair, fontWeight: 'bold' }]}>
                        {positif ? '+' : ''}{fmt(resultat)}
                      </Text>
                    </View>
                  </View>

                  <View style={s.listCardFooter}>
                    <Text style={s.listCardCreePar}>Par {cl.cree_par_nom || '–'} le {fmtDate(cl.date_creation)}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={C.silver} />
                  </View>
                </TouchableOpacity>
              );
            })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {selectedCloture ? renderDetailView() : renderListeView()}
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.fond },
  flex1: { flex: 1 },

  // Header
  header: {
    backgroundColor: C.bleu,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
  },
  headerTitle: { fontFamily: 'Times New Roman', fontSize: 22, fontWeight: 'bold', color: C.white },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  yearBtn: { padding: 4 },
  yearTxt: { fontFamily: 'Times New Roman', fontSize: 16, fontWeight: 'bold', color: C.white, marginHorizontal: 12 },

  // Création
  creationBox: { backgroundColor: C.white, margin: 16, borderRadius: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  creationLabel: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: '600', color: C.black, marginBottom: 10 },
  creationRow: {},
  moisScroll: { marginBottom: 12 },
  moisChip: { display: 'inline-flex', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: C.silver, marginRight: 6, backgroundColor: C.white },
  moisChipTxt: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: '600', color: C.black },
  moisChipDone: { fontSize: 10, color: C.vertClair, marginLeft: 4 },
  btnCreer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.vertClair, borderRadius: 10, paddingVertical: 12, elevation: 2, shadowColor: C.vertClair, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  btnCreerTxt: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: C.white, marginLeft: 8 },

  // Liste cards
  listScroll: { flex: 1, paddingHorizontal: 16 },
  listCard: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  listCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listMoisBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  listMoisTxt: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeTxt: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: '700' },
  listCardRow: { flexDirection: 'row', marginBottom: 10 },
  listCardCol: { flex: 1 },
  listCardLabel: { fontFamily: 'Times New Roman', fontSize: 11, color: C.silverSombre, textTransform: 'uppercase', letterSpacing: 0.4 },
  listCardVal: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: '600', marginTop: 2 },
  listCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.silverClair, paddingTop: 10, marginTop: 4 },
  listCardCreePar: { fontFamily: 'Times New Roman', fontSize: 12, color: C.silverSombre },

  // Détail
  detailScroll: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bleu, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 20 },
  backBtn: { marginRight: 12 },
  detailHeaderInfo: {},
  detailHeaderTitle: { fontFamily: 'Times New Roman', fontSize: 18, fontWeight: 'bold', color: C.white },

  // Résultat card
  resultatCard: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    backgroundColor: C.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  resultatLabel: { fontFamily: 'Times New Roman', fontSize: 13, color: C.silverSombre, textTransform: 'uppercase', letterSpacing: 1 },
  resultatVal: { fontFamily: 'Times New Roman', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  resultatSub: { fontFamily: 'Times New Roman', fontSize: 13, fontWeight: '600', marginTop: 4 },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  kpiItem: { width: '33.33%', paddingHorizontal: 4, marginBottom: 10 },
  kpiIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  kpiLabel: { fontFamily: 'Times New Roman', fontSize: 11, color: C.silverSombre, lineHeight: 15 },
  kpiVal: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', marginTop: 2 },

  // Charts
  chartBox: { backgroundColor: C.white, margin: 16, borderRadius: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  chartTitle: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: C.black, marginBottom: 12 },

  // Trace
  traceBox: { backgroundColor: C.white, margin: 16, marginTop: 0, borderRadius: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  traceTitle: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: C.black, marginBottom: 10 },
  traceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.silverClair },
  traceLabel: { fontFamily: 'Times New Roman', fontSize: 13, color: C.silverSombre },
  traceVal: { fontFamily: 'Times New Roman', fontSize: 13, color: C.black, fontWeight: '600' },

  // Workflow actions
  actionBox: { paddingHorizontal: 16, marginTop: 8 },
  wfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 14 },
  wfBtnTxt: { fontFamily: 'Times New Roman', fontSize: 15, fontWeight: 'bold', color: C.white, marginLeft: 8 },

  // Loading / Empty
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadTxt: { fontFamily: 'Times New Roman', fontSize: 14, color: C.silverSombre, marginTop: 10 },
  emptyTxt: { fontFamily: 'Times New Roman', fontSize: 15, color: C.silver, marginTop: 12 },
});

export default ClotureScreen;