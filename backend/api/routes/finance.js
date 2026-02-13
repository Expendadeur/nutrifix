const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../../database/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// =============================================
// HELPERS & UTILITIES
// =============================================

const formatMontant = (montant) => {
  if (!montant && montant !== 0) return '0,00';
  const num = parseFloat(montant);
  if (isNaN(num)) return '0,00';
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR');
  } catch (error) {
    return '';
  }
};

// =============================================
// ROUTE 1: GET /factures - Récupérer les factures
// =============================================
router.get(
  '/factures',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const {
        type_facture,
        statut_paiement,
        id_client,
        id_fournisseur,
        startDate,
        endDate,
        search,
        page,
        limit
      } = req.query;

      // =============================
      // Sécurisation pagination
      // =============================
      const pPage =
        Number.isInteger(Number(page)) && Number(page) > 0
          ? Number(page)
          : 1;

      const pLimit =
        Number.isInteger(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : 20;

      const offset = Number((pPage - 1) * pLimit);

      // =============================
      // Construction WHERE + params
      // =============================
      let whereSql = ' WHERE 1=1 ';
      const filters = [];

      if (type_facture) {
        whereSql += ' AND f.type_facture = ?';
        filters.push(type_facture);
      }

      if (statut_paiement) {
        whereSql += ' AND f.statut_paiement = ?';
        filters.push(statut_paiement);
      }

      if (id_client && !isNaN(id_client)) {
        whereSql += ' AND f.id_client = ?';
        filters.push(Number(id_client));
      }

      if (id_fournisseur && !isNaN(id_fournisseur)) {
        whereSql += ' AND f.id_fournisseur = ?';
        filters.push(Number(id_fournisseur));
      }

      if (startDate && startDate !== '') {
        whereSql += ' AND f.date_facture >= ?';
        filters.push(startDate);
      }

      if (endDate && endDate !== '') {
        whereSql += ' AND f.date_facture <= ?';
        filters.push(endDate);
      }

      if (search && search.trim() !== '') {
        whereSql += `
          AND (
            f.numero_facture LIKE ?
            OR c.nom_client LIKE ?
            OR fr.nom_fournisseur LIKE ?
          )
        `;
        const s = `%${search.trim()}%`;
        filters.push(s, s, s);
      }

      // =============================
      // Requête principale
      // =============================
      const sql = `
        SELECT f.*,
               c.nom_client,
               c.adresse AS client_adresse,
               c.email AS client_email,
               c.telephone AS client_telephone,
               c.solde_du,
               fr.nom_fournisseur,
               fr.adresse AS fournisseur_adresse,
               u.nom_complet AS createur_nom
        FROM factures f
        LEFT JOIN clients c ON f.id_client = c.id
        LEFT JOIN fournisseurs fr ON f.id_fournisseur = fr.id
        LEFT JOIN utilisateurs u ON f.cree_par = u.id
        ${whereSql}
        ORDER BY f.date_facture DESC
        LIMIT ${offset}, ${pLimit}
      `;

      // =============================
      // Requête COUNT
      // =============================
      const countSql = `
        SELECT COUNT(*) AS total
        FROM factures f
        LEFT JOIN clients c ON f.id_client = c.id
        LEFT JOIN fournisseurs fr ON f.id_fournisseur = fr.id
        ${whereSql}
      `;

      // =============================
      // Exécution
      // =============================
      const factures = await db.query(sql, filters);
      const countResult = await db.query(countSql, filters);

      // Extraction sécurisée du total
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

      res.status(200).json({
        success: true,
        data: factures || [],
        pagination: {
          total,
          page: pPage,
          limit: pLimit,
          pages: Math.ceil(total / pLimit)
        }
      });
    } catch (error) {
      console.error('Get factures error:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des factures.',
        error: error.message
      });
    }
  }
);


// =============================================
// ROUTE 2: POST /factures - Créer une facture
// =============================================
router.post('/factures', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const {
      type_facture,
      id_commande,
      id_client,
      id_fournisseur,
      date_echeance,
      montant_ht,
      montant_tva,
      montant_ttc,
      client_nom,
      client_adresse,
      client_email,
      client_telephone,
      fournisseur_nom,
      fournisseur_adresse,
      fournisseur_email,
      mode_reglement,
      description
    } = req.body;

    // Validation
    if (!type_facture || !date_echeance || !montant_ttc) {
      return res.status(400).json({
        success: false,
        message: 'Informations de facture incomplètes.'
      });
    }

    if (type_facture === 'vente' && !id_client) {
      return res.status(400).json({
        success: false,
        message: 'Client requis pour une facture de vente.'
      });
    }

    if (type_facture === 'achat' && !id_fournisseur) {
      return res.status(400).json({
        success: false,
        message: 'Fournisseur requis pour une facture d\'achat.'
      });
    }

    // Generate invoice number
    const date = new Date();
    const prefix = type_facture === 'vente' ? 'FV' : type_facture === 'achat' ? 'FA' : 'AV';
    const invoiceNumber = `${prefix}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const sql = `
      INSERT INTO factures (
        numero_facture, type_facture, id_commande,
        id_client, id_fournisseur, date_facture,
        date_echeance, montant_ht, montant_tva,
        montant_ttc, montant_regle, montant_du, statut_paiement,
        client_nom, client_adresse, client_email, client_telephone,
        fournisseur_nom, fournisseur_adresse, fournisseur_email,
        mode_reglement, description, cree_par, date_creation
      ) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, 0, ?, 'impayee', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await db.query(sql, [
      invoiceNumber,
      type_facture,
      id_commande || null,
      id_client || null,
      id_fournisseur || null,
      date_echeance,
      montant_ht || 0,
      montant_tva || 0,
      montant_ttc,
      montant_ttc,
      client_nom || null,
      client_adresse || null,
      client_email || null,
      client_telephone || null,
      fournisseur_nom || null,
      fournisseur_adresse || null,
      fournisseur_email || null,
      mode_reglement || 'virement',
      description || null,
      req.userId
    ]);

    // Update related order status if applicable
    if (id_commande) {
      if (type_facture === 'vente') {
        await db.query(
          'UPDATE commandes_vente SET statut = ? WHERE id = ?',
          ['facturee', id_commande]
        );
      } else if (type_facture === 'achat') {
        await db.query(
          'UPDATE commandes_achat SET statut = ? WHERE id = ?',
          ['facturee', id_commande]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès.',
      numero_facture: invoiceNumber
    });
  } catch (error) {
    console.error('Create facture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture.',
      error: error.message
    });
  }
});
// =============================================
// ROUTE 3: GET /factures/:id - Récupérer une facture
// =============================================
router.get('/factures/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT f.*,
             c.nom_client,
             c.adresse as client_adresse,
             c.email as client_email,
             c.telephone as client_telephone,
             fr.nom_fournisseur,
             fr.adresse as fournisseur_adresse,
             u.nom_complet as createur_nom
      FROM factures f
      LEFT JOIN clients c ON f.id_client = c.id
      LEFT JOIN fournisseurs fr ON f.id_fournisseur = fr.id
      LEFT JOIN utilisateurs u ON f.cree_par = u.id
      WHERE f.id = ?
    `;

    const [facture] = await db.query(sql, [id]);

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Récupérer les lignes de la commande associée si c'est une facture de vente
    let lignes = [];
    if (facture.id_commande && facture.type_facture === 'vente') {
      const lignesQuery = `
        SELECT l.*, a.designation, a.code_article
        FROM lignes_commande_vente l
        LEFT JOIN articles a ON l.id_article = a.id
        WHERE l.id_commande_vente = ?
      `;
      lignes = await db.query(lignesQuery, [facture.id_commande]);
    } else if (facture.id_commande && facture.type_facture === 'achat') {
      const lignesQuery = `
        SELECT l.*, a.designation, a.code_article
        FROM lignes_commande_achat l
        LEFT JOIN articles a ON l.id_article = a.id
        WHERE l.id_commande_achat = ?
      `;
      lignes = await db.query(lignesQuery, [facture.id_commande]);
    }

    res.status(200).json({
      success: true,
      data: {
        ...facture,
        lignes
      }
    });
  } catch (error) {
    console.error('Get facture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 4: PUT /factures/:id - Modifier une facture
// =============================================
router.put('/factures/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date_echeance,
      montant_ht,
      montant_tva,
      montant_ttc,
      mode_reglement,
      description,
      statut_paiement
    } = req.body;

    const sql = `
      UPDATE factures
      SET date_echeance = ?,
          montant_ht = ?,
          montant_tva = ?,
          montant_ttc = ?,
          mode_reglement = ?,
          description = ?,
          statut_paiement = ?
      WHERE id = ?
    `;

    const result = await db.query(sql, [
      date_echeance,
      montant_ht || 0,
      montant_tva || 0,
      montant_ttc,
      mode_reglement || 'virement',
      description || null,
      statut_paiement || 'impayee',
      id
    ]);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Facture modifiée avec succès.'
    });
  } catch (error) {
    console.error('Update facture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de la facture.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 5: DELETE /factures/:id - Supprimer une facture
// =============================================
router.delete('/factures/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la facture est payée
    const [facture] = await db.query('SELECT statut_paiement FROM factures WHERE id = ?', [id]);

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    if (facture.statut_paiement === 'payee' || facture.statut_paiement === 'partiellement_payee') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une facture payée ou partiellement payée'
      });
    }

    const result = await db.query('DELETE FROM factures WHERE id = ?', [id]);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Facture supprimée avec succès.'
    });
  } catch (error) {
    console.error('Delete facture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la facture.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 6: GET /paiements - Récupérer les paiements
// =============================================
router.get('/paiements', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const {
      type_paiement,
      source_type,
      statut,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // =============================
    // Sécurisation pagination
    // =============================
    const pPage = Math.max(parseInt(page, 10) || 1, 1);
    const pLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pPage - 1) * pLimit;

    // =============================
    // Construction WHERE + params
    // =============================
    const params = [];
    let whereClause = ' WHERE 1=1';

    if (type_paiement) {
      whereClause += ' AND p.type_paiement = ?';
      params.push(type_paiement);
    }

    if (source_type) {
      whereClause += ' AND p.source_type = ?';
      params.push(source_type);
    }

    if (statut) {
      whereClause += ' AND p.statut = ?';
      params.push(statut);
    }

    if (startDate) {
      whereClause += ' AND p.date_paiement >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND p.date_paiement <= ?';
      params.push(endDate);
    }

    if (search && search.trim() !== '') {
      whereClause += ' AND (p.reference_paiement LIKE ? OR c.nom_client LIKE ? OR f.nom_fournisseur LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // =============================
    // Requête principale (LIMIT interpolé)
    // =============================
    const sql = `
      SELECT p.*,
             CASE 
               WHEN p.source_type = 'client' THEN c.nom_client
               WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
               WHEN p.source_type = 'employe' THEN u.nom_complet
               ELSE p.source_type
             END as source_nom,
             CASE 
               WHEN p.source_type = 'client' THEN c.adresse
               WHEN p.source_type = 'fournisseur' THEN f.adresse
               ELSE NULL
             END as source_adresse,
             val.nom_complet as validateur_nom
      FROM paiements p
      LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
      LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
      LEFT JOIN utilisateurs u ON p.source_type = 'employe' AND p.id_source = u.id
      LEFT JOIN utilisateurs val ON p.valide_par = val.id
      ${whereClause}
      ORDER BY p.date_paiement DESC
      LIMIT ${pLimit} OFFSET ${offset}
    `;

    // =============================
    // Requête COUNT
    // =============================
    const countSql = `
      SELECT COUNT(*) as total 
      FROM paiements p
      LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
      LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
      ${whereClause}
    `;

    // =============================
    // Exécution (même params pour les deux)
    // =============================
    const paiements = await db.query(sql, params);
    const countResult = await db.query(countSql, params);

    // Extraction sécurisée du total
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: paiements || [],
      pagination: {
        total: total,
        page: pPage,
        limit: pLimit,
        pages: Math.ceil(total / pLimit)
      }
    });
  } catch (error) {
    console.error('Get paiements error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paiements.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 7: POST /paiements - Enregistrer un paiement
// =============================================
router.post('/paiements', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const {
      type_paiement,
      source_type,
      id_source,
      id_facture,
      montant,
      devise,
      taux_change,
      mode_paiement,
      reference_mode,
      date_paiement,
      banque,
      numero_compte,
      numero_virement,
      source_nom,
      source_adresse,
      source_email,
      source_telephone,
      facture_numero,
      description
    } = req.body;

    // Validation
    if (!type_paiement || !source_type || !id_source || !montant || !mode_paiement || !date_paiement) {
      return res.status(400).json({
        success: false,
        message: 'Informations de paiement incomplètes.'
      });
    }

    // Generate payment reference
    const dateNow = new Date();
    const prefix = type_paiement === 'recette' ? 'REC' : 'DEP';
    const paymentRef = `${prefix}-${dateNow.getFullYear()}${String(dateNow.getMonth() + 1).padStart(2, '0')}${String(dateNow.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Insert payment
    const paymentSql = `
      INSERT INTO paiements (
        reference_paiement, type_paiement, source_type,
        id_source, id_facture, montant, devise,
        taux_change, mode_paiement, reference_mode,
        date_paiement, banque, numero_compte, numero_virement,
        source_nom, source_adresse, source_email, source_telephone,
        facture_numero, description, valide_par, statut, date_creation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valide', NOW())
    `;

    await db.query(paymentSql, [
      paymentRef,
      type_paiement,
      source_type,
      id_source,
      id_facture || null,
      montant,
      devise || 'BIF',
      taux_change || 1.0,
      mode_paiement,
      reference_mode || null,
      date_paiement,
      banque || null,
      numero_compte || null,
      numero_virement || null,
      source_nom || null,
      source_adresse || null,
      source_email || null,
      source_telephone || null,
      facture_numero || null,
      description || null,
      req.userId
    ]);

    // Update related invoice if applicable
    if (id_facture) {
      const [facture] = await db.query(
        'SELECT montant_ttc, montant_regle FROM factures WHERE id = ?',
        [id_facture]
      );

      if (facture) {
        const nouveau_montant_regle = (facture.montant_regle || 0) + montant;
        const nouveau_montant_du = Math.max(0, facture.montant_ttc - nouveau_montant_regle);
        const nouveau_statut = nouveau_montant_du === 0 ? 'payee' : 'partiellement_payee';

        await db.query(
          `UPDATE factures 
           SET montant_regle = ?,
               montant_du = ?,
               statut_paiement = ?,
               date_dernier_paiement = NOW()
           WHERE id = ?`,
          [nouveau_montant_regle, nouveau_montant_du, nouveau_statut, id_facture]
        );
      }
    }

    // Update client/fournisseur balance
    if (source_type === 'client' && type_paiement === 'recette') {
      await db.query(
        'UPDATE clients SET solde_du = GREATEST(0, solde_du - ?) WHERE id = ?',
        [montant, id_source]
      );
    } else if (source_type === 'fournisseur' && type_paiement === 'depense') {
      await db.query(
        'UPDATE fournisseurs SET solde_actuel = GREATEST(0, solde_actuel - ?) WHERE id = ?',
        [montant, id_source]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès.',
      reference_paiement: paymentRef
    });
  } catch (error) {
    console.error('Create paiement error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du paiement.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 8: GET /paiements/:id - Récupérer un paiement
// =============================================
router.get('/paiements/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;

    const [paiement] = await db.query('SELECT * FROM paiements WHERE id = ?', [id]);

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: paiement
    });
  } catch (error) {
    console.error('Get paiement error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du paiement.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 9: PUT /paiements/:id - Modifier un paiement
// =============================================
router.put('/paiements/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;
    const { montant, mode_paiement, reference_mode, description, statut } = req.body;

    const sql = `
      UPDATE paiements
      SET montant = ?,
          mode_paiement = ?,
          reference_mode = ?,
          description = ?,
          statut = ?
      WHERE id = ?
    `;

    const result = await db.query(sql, [
      montant,
      mode_paiement || 'virement',
      reference_mode || null,
      description || null,
      statut || 'valide',
      id
    ]);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Paiement modifié avec succès.'
    });
  } catch (error) {
    console.error('Update paiement error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du paiement.',
      error: error.message
    });
  }
});
// =============================================
// ROUTE 10: DELETE /paiements/:id - Supprimer un paiement
// =============================================
router.delete('/paiements/:id', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;

    const [paiement] = await db.query('SELECT id_facture, montant FROM paiements WHERE id = ?', [id]);

    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    // Reverser le paiement sur la facture
    if (paiement.id_facture) {
      const [facture] = await db.query(
        'SELECT montant_ttc, montant_regle FROM factures WHERE id = ?',
        [paiement.id_facture]
      );

      if (facture) {
        const nouveau_montant_regle = Math.max(0, (facture.montant_regle || 0) - paiement.montant);
        const nouveau_montant_du = facture.montant_ttc - nouveau_montant_regle;
        const nouveau_statut = nouveau_montant_regle === 0 ? 'impayee' : 'partiellement_payee';

        await db.query(
          `UPDATE factures 
           SET montant_regle = ?, montant_du = ?, statut_paiement = ? 
           WHERE id = ?`,
          [nouveau_montant_regle, nouveau_montant_du, nouveau_statut, paiement.id_facture]
        );
      }
    }

    const result = await db.query('DELETE FROM paiements WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Paiement supprimé avec succès.'
    });
  } catch (error) {
    console.error('Delete paiement error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du paiement.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 11: GET /journal-comptable-complet
// =============================================
router.get('/journal-comptable-complet', authenticate, async (req, res) => {
  try {
    const {
      categorie,
      type_mouvement,
      tiers_type,
      startDate,
      endDate,
      search,
      exercice,
      periode,
      page,
      limit
    } = req.query;

    // =============================
    // Pagination sécurisée
    // =============================
    const pPage =
      Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;

    const pLimit =
      Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 50;

    const offset = (pPage - 1) * pLimit;

    // =============================
    // WHERE + params
    // =============================
    const whereConditions = [];
    const params = [];

    if (categorie && categorie !== 'all') {
      whereConditions.push('categorie = ?');
      params.push(categorie);
    }

    if (type_mouvement && type_mouvement !== 'all') {
      whereConditions.push('type_mouvement = ?');
      params.push(type_mouvement);
    }

    if (tiers_type) {
      whereConditions.push('tiers_type = ?');
      params.push(tiers_type);
    }

    if (startDate && startDate !== '') {
      whereConditions.push('date_operation >= ?');
      params.push(startDate);
    }

    if (endDate && endDate !== '') {
      whereConditions.push('date_operation <= ?');
      params.push(endDate);
    }

    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      whereConditions.push(`
        (
          libelle LIKE ? OR 
          description LIKE ? OR 
          reference_externe LIKE ? OR
          tiers_nom LIKE ? OR
          effectue_par_nom LIKE ? OR
          numero_ecriture LIKE ?
        )
      `);
      params.push(s, s, s, s, s, s);
    }

    if (exercice && !isNaN(exercice)) {
      whereConditions.push('exercice_comptable = ?');
      params.push(Number(exercice));
    }

    if (periode && !isNaN(periode)) {
      whereConditions.push('periode_comptable = ?');
      params.push(Number(periode));
    }

    const whereClause =
      whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

    // =============================
    // TOTAUX
    // =============================
    const totauxQuery = `
      SELECT 
        SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END) AS total_entrees,
        SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END) AS total_sorties,
        COUNT(*) AS nombre_operations
      FROM journal_comptable
      ${whereClause}
    `;

    const [totauxRow] = await db.query(totauxQuery, params);
    const t = totauxRow || {};

    const totaux = {
      total_entrees: Number(t.total_entrees) || 0,
      total_sorties: Number(t.total_sorties) || 0,
      nombre_operations: t.nombre_operations || 0
    };
    totaux.solde = totaux.total_entrees - totaux.total_sorties;

    // =============================
    // Répartition par catégorie
    // =============================
    const repartitionQuery = `
      SELECT categorie, SUM(montant) AS total_montant, COUNT(*) AS nombre
      FROM journal_comptable
      ${whereClause}
      GROUP BY categorie
      ORDER BY total_montant DESC
    `;

    const repartition = await db.query(repartitionQuery, params);

    // =============================
    // Mouvements paginés (SAFE)
    // =============================
    const mouvementsQuery = `
      SELECT *
      FROM journal_comptable
      ${whereClause}
      ORDER BY date_operation DESC, heure_operation DESC
      LIMIT ${offset}, ${pLimit}
    `;

    const mouvements = await db.query(mouvementsQuery, params);

    // =============================
    // COUNT pagination
    // =============================
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM journal_comptable
      ${whereClause}
    `;
    const [{ total }] = await db.query(countQuery, params);

    res.json({
      success: true,
      data: {
        mouvements,
        totaux,
        repartition,
        pagination: {
          total,
          page: pPage,
          limit: pLimit,
          pages: Math.ceil(total / pLimit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur journal comptable:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du journal',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 12: GET /journal-comptable/statistiques
// =============================================
router.get('/journal-comptable/statistiques', authenticate, async (req, res) => {
  try {
    const { categorie, type_mouvement, startDate, endDate, exercice } = req.query;

    const whereConditions = [];
    const params = [];

    if (categorie && categorie !== 'all') {
      whereConditions.push('categorie = ?');
      params.push(categorie);
    }

    if (type_mouvement && type_mouvement !== 'all') {
      whereConditions.push('type_mouvement = ?');
      params.push(type_mouvement);
    }

    if (startDate) {
      whereConditions.push('date_operation >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('date_operation <= ?');
      params.push(endDate);
    }

    if (exercice) {
      whereConditions.push('exercice_comptable = ?');
      params.push(parseInt(exercice));
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Statistiques par catégorie
    const statsCategorie = `
      SELECT 
        categorie,
        COUNT(*) as nombre,
        SUM(montant) as total,
        AVG(montant) as moyenne
      FROM journal_comptable 
      ${whereClause}
      GROUP BY categorie
    `;
    const categorieStats = await db.query(statsCategorie, params);

    // Statistiques par type
    const statsType = `
      SELECT 
        type_mouvement,
        COUNT(*) as nombre,
        SUM(montant) as total
      FROM journal_comptable 
      ${whereClause}
      GROUP BY type_mouvement
    `;
    const typeStats = await db.query(statsType, params);

    // Évolution mensuelle
    const evolutionMensuelle = `
      SELECT 
        YEAR(date_operation) as annee,
        MONTH(date_operation) as mois,
        SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END) as entrees,
        SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END) as sorties
      FROM journal_comptable 
      ${whereClause}
      GROUP BY YEAR(date_operation), MONTH(date_operation)
      ORDER BY annee DESC, mois DESC
      LIMIT 12
    `;
    const evolutionStats = await db.query(evolutionMensuelle, params);

    // Top 10 des plus grosses opérations
    const topOperations = `
      SELECT *
      FROM journal_comptable 
      ${whereClause}
      ORDER BY montant DESC
      LIMIT 10
    `;
    const topOps = await db.query(topOperations, params);

    res.json({
      success: true,
      data: {
        parCategorie: categorieStats,
        parType: typeStats,
        evolutionMensuelle: evolutionStats,
        topOperations: topOps
      }
    });

  } catch (error) {
    console.error('Erreur statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
      message: error.message
    });
  }
});

router.get('/balance-comptable', authenticate, async (req, res) => {
  try {
    // Désactiver le cache (évite 304)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const exercice = req.query.exercice ? parseInt(req.query.exercice, 10) : null;

    const whereConditions = [];
    const params = [];

    if (startDate) {
      whereConditions.push('date_operation >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('date_operation <= ?');
      params.push(endDate);
    }

    if (exercice) {
      whereConditions.push('exercice_comptable = ?');
      params.push(exercice);
    }

    const whereClause =
      whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

    const sql = `
      SELECT 
        COALESCE(compte_debit, compte_credit) AS compte,
        SUM(CASE WHEN compte_debit IS NOT NULL THEN montant ELSE 0 END) AS total_debit,
        SUM(CASE WHEN compte_credit IS NOT NULL THEN montant ELSE 0 END) AS total_credit,
        SUM(CASE WHEN compte_debit IS NOT NULL THEN montant ELSE 0 END)
        - SUM(CASE WHEN compte_credit IS NOT NULL THEN montant ELSE 0 END) AS solde
      FROM journal_comptable
      ${whereClause}
      GROUP BY COALESCE(compte_debit, compte_credit)
      ORDER BY compte
    `;

    const [balance] = await db.query(sql, params);

    res.json({
      success: true,
      data: balance
    });

  } catch (error) {
    console.error('Erreur balance comptable:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la balance',
      message: error.message
    });
  }
});

router.get('/grand-livre', authenticate, async (req, res) => {
  try {
    // Désactiver le cache (évite 304)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const compte = req.query.compte;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const exercice = req.query.exercice ? parseInt(req.query.exercice, 10) : null;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;

    if (!compte) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "compte" est requis'
      });
    }

    const whereConditions = ['(compte_debit = ? OR compte_credit = ?)'];
    const whereParams = [compte, compte];

    if (startDate) {
      whereConditions.push('date_operation >= ?');
      whereParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push('date_operation <= ?');
      whereParams.push(endDate);
    }

    if (exercice) {
      whereConditions.push('exercice_comptable = ?');
      whereParams.push(exercice);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const sql = `
      SELECT *,
        CASE 
          WHEN compte_debit = ? THEN montant
          ELSE 0
        END AS debit,
        CASE 
          WHEN compte_credit = ? THEN montant
          ELSE 0
        END AS credit
      FROM journal_comptable
      ${whereClause}
      ORDER BY date_operation, heure_operation
      LIMIT ? OFFSET ?
    `;

    /**
     * ORDRE DES PARAMÈTRES (CRITIQUE)
     * 1  compte (CASE debit)
     * 2  compte (CASE credit)
     * 3+ whereParams
     * n  limit (NUMBER)
     * n+ offset (NUMBER)
     */
    const queryParams = [
      compte,
      compte,
      ...whereParams,
      limit,
      offset
    ];

    const [grandLivre] = await db.query(sql, queryParams);

    // Calcul du solde progressif
    let solde = 0;
    const grandLivreAvecSolde = grandLivre.map(ligne => {
      const debit = parseFloat(ligne.debit) || 0;
      const credit = parseFloat(ligne.credit) || 0;
      solde += debit - credit;

      return {
        ...ligne,
        solde_progressif: solde
      };
    });

    // Total pour pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM journal_comptable
      ${whereClause}
    `;

    const [[countResult]] = await db.query(countSql, whereParams);

    res.json({
      success: true,
      data: grandLivreAvecSolde,
      pagination: {
        total: countResult.total,
        page,
        limit,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur grand livre:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du grand livre',
      message: error.message
    });
  }
});

// =============================================
// ROUTE 15: GET /journal-comptable/:id
// =============================================
router.get('/journal-comptable/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM journal_comptable WHERE id = ?';
    const [result] = await db.query(query, [id]);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Mouvement non trouvé'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erreur récupération mouvement:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du mouvement',
      message: error.message
    });
  }
});

// =============================================
// ROUTE 16: PATCH /journal-comptable/:id/statut
// =============================================
router.patch('/journal-comptable/:id/statut',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { statut } = req.body;

      const validStatuts = ['brouillon', 'valide', 'lettre', 'rapproche', 'annule'];
      if (!validStatuts.includes(statut)) {
        return res.status(400).json({
          success: false,
          error: 'Statut invalide'
        });
      }

      const query = 'UPDATE journal_comptable SET statut = ? WHERE id = ?';
      await db.query(query, [statut, id]);

      res.json({
        success: true,
        message: 'Statut mis à jour'
      });

    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour du statut',
        message: error.message
      });
    }
  }
);

// =============================================
// ROUTE 17: PATCH /journal-comptable/:id/rapprocher
// =============================================
router.patch('/journal-comptable/:id/rapprocher',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
        UPDATE journal_comptable 
        SET rapproche = 1, date_rapprochement = NOW(), rapproche_par = ?
        WHERE id = ?
      `;
      await db.query(query, [req.userId, id]);

      res.json({
        success: true,
        message: 'Mouvement rapproché'
      });

    } catch (error) {
      console.error('Erreur rapprochement:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du rapprochement',
        message: error.message
      });
    }
  }
);

// =============================================
// ROUTE 18: GET /dashboard - Tableau de bord
// =============================================
router.get('/dashboard', authenticate, authorize('admin', 'comptable', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const dateFilter = startDate && endDate
      ? `AND DATE(date_commande) BETWEEN '${startDate}' AND '${endDate}'`
      : `AND MONTH(date_commande) = ${currentMonth} AND YEAR(date_commande) = ${currentYear}`;

    // Sales for current month
    const [sales] = await db.query(`
      SELECT 
        SUM(montant_total) as chiffre_affaires_mois,
        COUNT(*) as nombre_commandes_mois
      FROM commandes_vente 
      WHERE statut IN ('facturee', 'payee')
      ${dateFilter}
    `);

    // Purchases for current month
    const [purchases] = await db.query(`
      SELECT 
        SUM(montant_total) as total_achats_mois,
        COUNT(*) as nombre_achats_mois
      FROM commandes_achat 
      WHERE statut IN ('facturee', 'payee')
      ${dateFilter}
    `);

    // Pending invoices
    const [pendingInvoices] = await db.query(`
      SELECT 
        COUNT(*) as factures_impayees,
        SUM(montant_du) as montant_impaye
      FROM factures 
      WHERE statut_paiement IN ('impayee', 'partiellement_payee')
      AND date_echeance >= CURDATE()
    `);

    // Overdue invoices
    const [overdueInvoices] = await db.query(`
      SELECT 
        COUNT(*) as factures_en_retard,
        SUM(montant_du) as montant_retard
      FROM factures 
      WHERE statut_paiement IN ('impayee', 'partiellement_payee')
      AND date_echeance < CURDATE()
    `);

    // Cash flow for last 6 months
    const [cashFlow] = await db.query(`
      SELECT 
        DATE_FORMAT(p.date_paiement, '%Y-%m') as mois,
        SUM(CASE WHEN p.type_paiement = 'recette' THEN p.montant ELSE 0 END) as recettes,
        SUM(CASE WHEN p.type_paiement = 'depense' THEN p.montant ELSE 0 END) as depenses,
        SUM(CASE WHEN p.type_paiement = 'recette' THEN p.montant ELSE -p.montant END) as flux_net
      FROM paiements p
      WHERE p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      AND p.statut = 'valide'
      GROUP BY DATE_FORMAT(p.date_paiement, '%Y-%m')
      ORDER BY DATE_FORMAT(p.date_paiement, '%Y-%m')
    `);

    // Top 5 clients by sales
    const [topClients] = await db.query(`
      SELECT 
        c.nom_client,
        SUM(cv.montant_total) as total_achats,
        c.solde_du
      FROM clients c
      JOIN commandes_vente cv ON c.id = cv.id_client
      WHERE cv.date_commande >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      GROUP BY c.id, c.nom_client, c.solde_du
      ORDER BY total_achats DESC
      LIMIT 5
    `);

    // Recent payments
    const [recentPayments] = await db.query(`
      SELECT 
        p.*,
        CASE 
          WHEN p.source_type = 'client' THEN c.nom_client
          WHEN p.source_type = 'fournisseur' THEN f.nom_fournisseur
          ELSE p.source_type
        END as source_nom
      FROM paiements p
      LEFT JOIN clients c ON p.source_type = 'client' AND p.id_source = c.id
      LEFT JOIN fournisseurs f ON p.source_type = 'fournisseur' AND p.id_source = f.id
      WHERE p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY p.date_paiement DESC
      LIMIT 10
    `);

    res.status(200).json({
      success: true,
      data: {
        ventes_mois: sales[0] || {},
        achats_mois: purchases[0] || {},
        factures_impayees: pendingInvoices[0] || {},
        factures_retard: overdueInvoices[0] || {},
        flux_tresorerie: cashFlow,
        meilleurs_clients: topClients,
        paiements_recents: recentPayments
      }
    });
  } catch (error) {
    console.error('Get finance dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord.',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 19: POST /journal-comptable/export-excel
// =============================================
router.post('/journal-comptable/export-excel',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const {
        categorie,
        type_mouvement,
        startDate,
        endDate
      } = req.body;

      const whereConditions = [];
      const params = [];

      if (categorie && categorie !== 'all') {
        whereConditions.push('categorie = ?');
        params.push(categorie);
      }

      if (type_mouvement && type_mouvement !== 'all') {
        whereConditions.push('type_mouvement = ?');
        params.push(type_mouvement);
      }

      if (startDate) {
        whereConditions.push('date_operation >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('date_operation <= ?');
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const query = `
        SELECT * 
        FROM journal_comptable 
        ${whereClause}
        ORDER BY date_operation DESC, heure_operation DESC
      `;
      const mouvements = await db.query(query, params);

      // Calculate totals
      const totauxQuery = `
        SELECT 
          SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END) as total_entrees,
          SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END) as total_sorties
        FROM journal_comptable 
        ${whereClause}
      `;
      const [totauxResult] = await db.query(totauxQuery, params);
      const total_entrees = parseFloat(totauxResult?.total_entrees) || 0;
      const total_sorties = parseFloat(totauxResult?.total_sorties) || 0;
      const solde = total_entrees - total_sorties;

      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'NUTRIFIX';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Journal Comptable', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      });

      // Title
      worksheet.mergeCells('A1:N1');
      worksheet.getCell('A1').value = 'JOURNAL COMPTABLE NUTRIFIX';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Period
      worksheet.mergeCells('A2:N2');
      worksheet.getCell('A2').value = `Période: ${startDate || 'Début'} au ${endDate || 'Fin'}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      // Empty line
      worksheet.addRow([]);

      // Column headers
      const headerRow = worksheet.addRow([
        'N° Écriture',
        'Date',
        'Heure',
        'Catégorie',
        'Type',
        'Libellé',
        'Description',
        'Montant',
        'Quantité',
        'Unité',
        'Compte Débit',
        'Compte Crédit',
        'Tiers',
        'Effectué par'
      ]);

      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } },
        alignment: { vertical: 'middle', horizontal: 'center' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };

      headerRow.eachCell((cell) => {
        Object.assign(cell, headerStyle);
      });
      headerRow.height = 25;

      // Column widths
      worksheet.columns = [
        { width: 18 },
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 10 },
        { width: 30 },
        { width: 40 },
        { width: 15 },
        { width: 12 },
        { width: 10 },
        { width: 25 },
        { width: 25 },
        { width: 25 },
        { width: 20 }
      ];

      // Add data
      let totalDebit = 0;
      let totalCredit = 0;

      mouvements.forEach((mouvement, index) => {
        const montant = parseFloat(mouvement.montant) || 0;
        let isDebit = mouvement.type_mouvement === 'sortie' || mouvement.type_mouvement === 'depense';

        if (mouvement.type_mouvement === 'entree' || mouvement.type_mouvement === 'recette') {
          totalDebit += montant;
        } else {
          totalCredit += montant;
        }

        const row = worksheet.addRow([
          mouvement.numero_ecriture,
          new Date(mouvement.date_operation).toLocaleDateString('fr-FR'),
          mouvement.heure_operation || '',
          mouvement.categorie,
          mouvement.type_mouvement,
          mouvement.libelle,
          mouvement.description || '',
          montant,
          mouvement.quantite || '',
          mouvement.unite_mesure || '',
          mouvement.compte_debit || '',
          mouvement.compte_credit || '',
          mouvement.tiers_nom || '',
          mouvement.effectue_par_nom
        ]);

        // Alternating style
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8F9FA' }
            };
          });
        }

        // Format amount
        row.getCell(8).numFmt = '#,##0.00 BIF';

        // Color by type
        if (isDebit) {
          row.getCell(8).font = { color: { argb: 'FFE74C3C' }, bold: true };
        } else {
          row.getCell(8).font = { color: { argb: 'FF27AE60' }, bold: true };
        }

        // Borders
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        });
      });

      // Totals section
      worksheet.addRow([]);
      const totauxRow = worksheet.addRow([
        '', '', '', '', '', '', 'TOTAUX:',
        '', '', '', '', '', '', ''
      ]);
      totauxRow.font = { bold: true };
      totauxRow.getCell(7).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDFE6E9' }
      };

      worksheet.addRow(['', '', '', '', '', '', 'Total Débits:', totalDebit, '', '', '', '', '', '']);
      worksheet.addRow(['', '', '', '', '', '', 'Total Crédits:', totalCredit, '', '', '', '', '', '']);
      worksheet.addRow(['', '', '', '', '', '', 'Solde:', solde, '', '', '', '', '', '']);

      // Format totals
      const lastRow = worksheet.lastRow;
      lastRow.getCell(8).numFmt = '#,##0.00 BIF';
      lastRow.getCell(8).font = {
        bold: true,
        color: { argb: solde >= 0 ? 'FF27AE60' : 'FFE74C3C' }
      };

      // Footer
      worksheet.addRow([]);
      const footerRow = worksheet.addRow([
        `Généré le ${new Date().toLocaleString('fr-FR')}`,
        '', '', '', '', '', '', '', '', '', '', '', '',
        `Par: ${req.user?.nom_complet || 'Utilisateur'}`
      ]);
      footerRow.font = { italic: true, size: 9, color: { argb: 'FF7F8C8D' } };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Send file
      const filename = `Journal_Comptable_${startDate || 'debut'}_${endDate || 'fin'}_${Date.now()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

    } catch (error) {
      console.error('Export Excel error:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export Excel',
        error: error.message
      });
    }
  }
);

// =============================================
// ROUTE 20: POST /journal-comptable/export-pdf
// =============================================
router.post('/journal-comptable/export-pdf',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const {
        categorie,
        type_mouvement,
        startDate,
        endDate
      } = req.body;

      const whereConditions = [];
      const params = [];

      if (categorie && categorie !== 'all') {
        whereConditions.push('categorie = ?');
        params.push(categorie);
      }

      if (type_mouvement && type_mouvement !== 'all') {
        whereConditions.push('type_mouvement = ?');
        params.push(type_mouvement);
      }

      if (startDate) {
        whereConditions.push('date_operation >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('date_operation <= ?');
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const query = `
        SELECT * 
        FROM journal_comptable 
        ${whereClause}
        ORDER BY date_operation DESC, heure_operation DESC
      `;
      const mouvements = await db.query(query, params);

      // Calculate totals
      const totauxQuery = `
        SELECT 
          SUM(CASE WHEN type_mouvement IN ('entree', 'recette') THEN montant ELSE 0 END) as total_entrees,
          SUM(CASE WHEN type_mouvement IN ('sortie', 'depense') THEN montant ELSE 0 END) as total_sorties
        FROM journal_comptable 
        ${whereClause}
      `;
      const [totauxResult] = await db.query(totauxQuery, params);
      const total_entrees = parseFloat(totauxResult?.total_entrees) || 0;
      const total_sorties = parseFloat(totauxResult?.total_sorties) || 0;
      const solde = total_entrees - total_sorties;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `Journal_Comptable_${startDate || 'debut'}_${endDate || 'fin'}_${Date.now()}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      });

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('JOURNAL COMPTABLE NUTRIFIX', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`Période: ${startDate || 'Début'} au ${endDate || 'Fin'}`, { align: 'center' });
      doc.moveDown(1);

      // Table
      const tableTop = doc.y;
      const colWidths = [100, 120, 140, 100, 100];
      let currentY = tableTop;

      // Headers
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(30, currentY, colWidths.reduce((a, b) => a + b), 20).fillAndStroke('#2E86C1', '#2E86C1');
      doc.fillColor('white');
      doc.text('Date', 35, currentY + 5, { width: colWidths[0] });
      doc.text('Type', 35 + colWidths[0], currentY + 5, { width: colWidths[1] });
      doc.text('Libellé', 35 + colWidths[0] + colWidths[1], currentY + 5, { width: colWidths[2] });
      doc.text('Montant', 35 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 5, { width: colWidths[3], align: 'right' });
      doc.text('Tiers', 35 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY + 5, { width: colWidths[4] });

      currentY += 25;

      // Data rows
      doc.font('Helvetica').fontSize(8);
      mouvements.forEach((mouvement, index) => {
        if (currentY > 500) {
          doc.addPage();
          currentY = 30;
        }

        const montant = parseFloat(mouvement.montant) || 0;
        const isDebit = mouvement.type_mouvement === 'sortie' || mouvement.type_mouvement === 'depense';

        // Alternating colors
        if (index % 2 === 0) {
          doc.fillColor('#F8F9FA').rect(30, currentY, colWidths.reduce((a, b) => a + b), 18).fill();
        }

        doc.fillColor('black');
        doc.text(new Date(mouvement.date_operation).toLocaleDateString('fr-FR'), 35, currentY + 3, { width: colWidths[0] });
        doc.text(mouvement.type_mouvement, 35 + colWidths[0], currentY + 3, { width: colWidths[1] });
        doc.text(mouvement.libelle, 35 + colWidths[0] + colWidths[1], currentY + 3, { width: colWidths[2] });

        doc.fillColor(isDebit ? '#E74C3C' : '#27AE60');
        doc.text(`${montant.toFixed(2)} BIF`, 35 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 3, { width: colWidths[3], align: 'right' });

        doc.fillColor('black');
        doc.text(mouvement.tiers_nom || '', 35 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY + 3, { width: colWidths[4] });

        currentY += 20;
      });

      // Totals
      currentY += 10;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#2E86C1').rect(30, currentY, colWidths.reduce((a, b) => a + b), 25).fillAndStroke('#2E86C1', '#2E86C1');
      doc.fillColor('white');
      doc.text('TOTAUX', 35, currentY + 7);
      doc.fillColor('#27AE60');
      doc.text(`${total_entrees.toFixed(2)} BIF`, 35 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 7, { align: 'right' });

      // Balance
      currentY += 30;
      doc.fillColor('black').fontSize(11);
      doc.text('Solde: ', 30, currentY);
      doc.fillColor(solde >= 0 ? '#27AE60' : '#FFE74C3C');
      doc.text(`${solde.toFixed(2)} BIF`, 100, currentY);

      // Footer
      doc.fillColor('gray').fontSize(8);
      doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} par ${req.user?.nom_complet || 'Utilisateur'}`, 30, doc.page.height - 30, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error('Export PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export PDF',
        error: error.message
      });
    }
  }
);
// =============================================
// ROUTE 21: GET /rapports
// =============================================
router.get(
  '/rapports',
  authenticate,
  authorize('admin', 'comptable'),
  async (req, res) => {
    try {
      const {
        type_rapport,
        type_periode,
        date_debut,
        date_fin,
        id_departement,
        page,
        limit
      } = req.query;

      // =============================
      // Pagination sécurisée
      // =============================
      const pPage =
        Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;

      const pLimit =
        Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;

      const offset = (pPage - 1) * pLimit;

      // =============================
      // WHERE + params
      // =============================
      let whereSql = ' WHERE 1=1 ';
      const params = [];

      if (type_rapport) {
        whereSql += ' AND type_rapport = ?';
        params.push(type_rapport);
      }

      if (type_periode) {
        whereSql += ' AND type_periode = ?';
        params.push(type_periode);
      }

      if (date_debut && date_debut !== '') {
        whereSql += ' AND date_debut >= ?';
        params.push(date_debut);
      }

      if (date_fin && date_fin !== '') {
        whereSql += ' AND date_fin <= ?';
        params.push(date_fin);
      }

      if (id_departement && !isNaN(id_departement)) {
        whereSql += ' AND id_departement = ?';
        params.push(Number(id_departement));
      }

      // =============================
      // DATA
      // =============================
      const sql = `
        SELECT *
        FROM rapports_financiers
        ${whereSql}
        ORDER BY date_generation DESC
        LIMIT ${offset}, ${pLimit}
      `;

      // =============================
      // COUNT
      // =============================
      const countSql = `
        SELECT COUNT(*) AS total
        FROM rapports_financiers
        ${whereSql}
      `;

      const [rapports] = await db.query(sql, params);
      const [{ total }] = await db.query(countSql, params);

      res.status(200).json({
        success: true,
        data: rapports,
        pagination: {
          total,
          page: pPage,
          limit: pLimit,
          pages: Math.ceil(total / pLimit)
        }
      });
    } catch (error) {
      console.error('Get rapports error:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des rapports',
        error: error.message
      });
    }
  }
);

// =============================================
// ROUTE 22: GET /clients - Récupérer les clients
// =============================================
router.get('/clients', authenticate, async (req, res) => {
  try {
    const [clients] = await db.query(
      'SELECT id, nom_client, adresse, email, telephone, solde_du FROM clients ORDER BY nom_client'
    );

    res.status(200).json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 23: GET /fournisseurs - Récupérer les fournisseurs
// =============================================
router.get('/fournisseurs', authenticate, async (req, res) => {
  try {
    const [fournisseurs] = await db.query(
      'SELECT id, nom_fournisseur, adresse, email, telephone, solde_actuel FROM fournisseurs ORDER BY nom_fournisseur'
    );

    res.status(200).json({
      success: true,
      data: fournisseurs
    });
  } catch (error) {
    console.error('Get fournisseurs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fournisseurs',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 24: GET /departements - Récupérer les départements
// =============================================
router.get('/departements', authenticate, async (req, res) => {
  try {
    const [departements] = await db.query(`
      SELECT 
        d.id,
        d.nom,
        d.type,
        d.budget_annuel,
        COALESCE(b.budget_alloue, 0) as budget_prevu,
        COALESCE(b.budget_utilise, 0) as budget_utilise
      FROM departements d
      LEFT JOIN budgets_departements b 
        ON d.id = b.id_departement 
        AND b.annee = YEAR(CURDATE())
      ORDER BY d.nom
    `);

    res.status(200).json({
      success: true,
      data: departements
    });
  } catch (error) {
    console.error('Get departements error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des départements',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 25: POST /rapports/export - Exporter les rapports
// =============================================
router.post('/rapports/export', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const {
      format,
      type_periode,
      date_debut,
      date_fin,
      id_departement,
      type_rapport
    } = req.body;

    if (!format || !['xlsx', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Format invalide'
      });
    }

    const params = [];
    let sql = `SELECT * FROM rapports_financiers WHERE 1=1`;

    if (type_rapport) {
      sql += ' AND type_rapport = ?';
      params.push(type_rapport);
    }

    if (type_periode) {
      sql += ' AND type_periode = ?';
      params.push(type_periode);
    }

    if (date_debut) {
      sql += ' AND date_debut >= ?';
      params.push(date_debut);
    }

    if (date_fin) {
      sql += ' AND date_fin <= ?';
      params.push(date_fin);
    }

    if (id_departement) {
      sql += ' AND id_departement = ?';
      params.push(parseInt(id_departement));
    }

    sql += ' ORDER BY date_generation DESC';

    const [rapports] = await db.query(sql, params);

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rapports Financiers');

      // Headers
      worksheet.addRow([
        'Type Rapport',
        'Période',
        'Date Début',
        'Date Fin',
        'CA',
        'Coûts Achats',
        'Coûts Production',
        'Coûts Personnel',
        'Résultat Net',
        'Rentabilité %',
        'Date Génération'
      ]);

      // Data
      rapports.forEach(rapport => {
        worksheet.addRow([
          rapport.type_rapport,
          rapport.type_periode,
          formatDate(rapport.date_debut),
          formatDate(rapport.date_fin),
          formatMontant(rapport.chiffre_affaires),
          formatMontant(rapport.cout_achats),
          formatMontant(rapport.cout_production),
          formatMontant(rapport.cout_personnel),
          formatMontant(rapport.resultat_net),
          `${rapport.rentabilite_pourcent || 0}%`,
          formatDate(rapport.date_generation)
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Rapports_${Date.now()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } else if (format === 'pdf') {
      const doc = new PDFDocument();
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `Rapports_${Date.now()}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      });

      doc.fontSize(16).text('RAPPORTS FINANCIERS NUTRIFIX', { align: 'center' });
      doc.moveDown();

      rapports.forEach(rapport => {
        doc.fontSize(12).text(`Type: ${rapport.type_rapport}`);
        doc.text(`Période: ${rapport.type_periode} (${formatDate(rapport.date_debut)} au ${formatDate(rapport.date_fin)})`);
        doc.text(`Résultat Net: ${formatMontant(rapport.resultat_net)}`);
        doc.text(`Rentabilité: ${rapport.rentabilite_pourcent || 0}%`);
        doc.moveDown();
      });

      doc.end();
    }
  } catch (error) {
    console.error('Export rapports error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export des rapports',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 26: POST /factures/:id/rapprocher - Rapprocher une facture
// =============================================
router.post('/factures/:id/rapprocher', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE factures
      SET rapprochement_effectue = 1,
          date_rapprochement = NOW(),
          rapproche_par = ?
      WHERE id = ?
    `;

    await db.query(sql, [req.userId, id]);

    res.status(200).json({
      success: true,
      message: 'Facture rapprochée avec succès'
    });
  } catch (error) {
    console.error('Rapprocher facture error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rapprochement de la facture',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 27: GET /factures-impayees - Factures impayées
// =============================================
router.get('/factures-impayees', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { id_client, id_fournisseur } = req.query;

    const params = [];
    let sql = `
      SELECT f.*,
             c.nom_client,
             c.adresse as client_adresse,
             c.email as client_email,
             DATEDIFF(CURDATE(), f.date_echeance) as jours_retard
      FROM factures f
      LEFT JOIN clients c ON f.id_client = c.id
      WHERE f.statut_paiement IN ('impayee', 'partiellement_payee')
      AND f.montant_du > 0
    `;

    if (id_client) {
      sql += ' AND f.id_client = ?';
      params.push(parseInt(id_client));
    }

    if (id_fournisseur) {
      sql += ' AND f.id_fournisseur = ?';
      params.push(parseInt(id_fournisseur));
    }

    sql += ' ORDER BY f.date_echeance ASC';

    const [factures] = await db.query(sql, params);

    // Calculate totals
    let totalDu = 0;
    let enRetard = 0;

    factures.forEach(f => {
      totalDu += f.montant_du || 0;
      if (f.jours_retard > 0) enRetard++;
    });

    res.status(200).json({
      success: true,
      data: factures,
      totals: {
        montant_du_total: totalDu,
        nombre_factures: factures.length,
        nombre_en_retard: enRetard
      }
    });
  } catch (error) {
    console.error('Get factures impayees error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures impayées',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 28: POST /paiements-lot - Enregistrer plusieurs paiements
// =============================================
router.post('/paiements-lot', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { paiements } = req.body;

    if (!Array.isArray(paiements) || paiements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste de paiements vide ou invalide'
      });
    }

    const results = [];
    let totalInsere = 0;

    for (const paiement of paiements) {
      try {
        const {
          type_paiement,
          source_type,
          id_source,
          id_facture,
          montant,
          mode_paiement,
          date_paiement,
          reference_mode,
          description
        } = paiement;

        if (!type_paiement || !source_type || !id_source || !montant) {
          results.push({
            success: false,
            error: 'Données de paiement incomplètes'
          });
          continue;
        }

        const dateNow = new Date();
        const prefix = type_paiement === 'recette' ? 'REC' : 'DEP';
        const paymentRef = `${prefix}-${dateNow.getFullYear()}${String(dateNow.getMonth() + 1).padStart(2, '0')}${String(dateNow.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const paymentSql = `
          INSERT INTO paiements (
            reference_paiement, type_paiement, source_type,
            id_source, id_facture, montant, mode_paiement,
            reference_mode, description, valide_par, statut, date_paiement, date_creation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valide', ?, NOW())
        `;

        await db.query(paymentSql, [
          paymentRef,
          type_paiement,
          source_type,
          id_source,
          id_facture || null,
          montant,
          mode_paiement,
          reference_mode || null,
          description || null,
          req.userId,
          date_paiement
        ]);

        // Update invoice if applicable
        if (id_facture) {
          const [facture] = await db.query(
            'SELECT montant_ttc, montant_regle FROM factures WHERE id = ?',
            [id_facture]
          );

          if (facture) {
            const nouveau_montant_regle = (facture.montant_regle || 0) + montant;
            const nouveau_montant_du = Math.max(0, facture.montant_ttc - nouveau_montant_regle);
            const nouveau_statut = nouveau_montant_du === 0 ? 'payee' : 'partiellement_payee';

            await db.query(
              `UPDATE factures 
               SET montant_regle = ?, montant_du = ?, statut_paiement = ? 
               WHERE id = ?`,
              [nouveau_montant_regle, nouveau_montant_du, nouveau_statut, id_facture]
            );
          }
        }

        results.push({
          success: true,
          reference_paiement: paymentRef
        });
        totalInsere++;
      } catch (err) {
        results.push({
          success: false,
          error: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${totalInsere} paiement(s) enregistré(s) sur ${paiements.length}`,
      results
    });
  } catch (error) {
    console.error('Create paiements-lot error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement des paiements',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 29: GET /tresorerie - État de la trésorerie
// =============================================
router.get('/tresorerie', authenticate, authorize('admin', 'comptable'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Récettes
    const [recettes] = await db.query(`
      SELECT 
        DATE(date_paiement) as date,
        SUM(montant) as total
      FROM paiements
      WHERE type_paiement = 'recette'
      AND statut = 'valide'
      ${startDate ? `AND date_paiement >= '${startDate}'` : ''}
      ${endDate ? `AND date_paiement <= '${endDate}'` : ''}
      GROUP BY DATE(date_paiement)
      ORDER BY date DESC
    `);

    // Dépenses
    const [depenses] = await db.query(`
      SELECT 
        DATE(date_paiement) as date,
        SUM(montant) as total
      FROM paiements
      WHERE type_paiement = 'depense'
      AND statut = 'valide'
      ${startDate ? `AND date_paiement >= '${startDate}'` : ''}
      ${endDate ? `AND date_paiement <= '${endDate}'` : ''}
      GROUP BY DATE(date_paiement)
      ORDER BY date DESC
    `);

    // Solde cumulé
    const [solde] = await db.query(`
      SELECT 
        SUM(CASE WHEN type_paiement = 'recette' THEN montant ELSE -montant END) as solde_actuel
      FROM paiements
      WHERE statut = 'valide'
      ${startDate ? `AND date_paiement >= '${startDate}'` : ''}
      ${endDate ? `AND date_paiement <= '${endDate}'` : ''}
    `);

    res.status(200).json({
      success: true,
      data: {
        recettes,
        depenses,
        solde: solde[0]?.solde_actuel || 0
      }
    });
  } catch (error) {
    console.error('Get tresorerie error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la trésorerie',
      error: error.message
    });
  }
});

// =============================================
// ROUTE 31: GET /factures/:id/pdf - Générer une facture OBR (PDF)
// =============================================
router.get('/factures/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Récupérer les données de la facture
    const [factures] = await db.query(`
      SELECT f.*, cv.numero_commande, cv.lieu_livraison, cv.mode_paiement as c_mode_paiement
      FROM factures f
      LEFT JOIN commandes_vente cv ON f.id_commande = cv.id
      WHERE f.id = ?
    `, [id]);

    if (!factures || factures.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }
    const facture = factures[0];

    // 2. Récupérer les données du vendeur (NUTRIFIX)
    const [entrepriseRows] = await db.query('SELECT * FROM parametres_entreprise LIMIT 1');
    const entreprise = entrepriseRows[0] || {
      nom_entreprise: 'NUTRIFIX',
      nif: '4001234567',
      numero_rc: 'RC/ Bujumbura / 1234',
      telephone: '+257 22 22 22 22',
      email: 'contact@nutrifix.bi',
      commune: 'Mukaza',
      quartier: 'Rohero I',
      avenue: 'de la France',
      numero_batiment: '10',
      assujetti_tva: 1,
      centre_fiscal: 'DMC',
      secteur_activite: 'Commerce',
      forme_juridique: 'S.U'
    };

    // 3. Récupérer les données du client
    const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ?', [facture.id_client]);
    const client = clientRows[0] || { nom_client: 'Client Inconnu', nif: 'N/A', adresse: 'N/A' };

    // 4. Récupérer les lignes de la commande
    const [lignes] = await db.query(`
      SELECT * FROM lignes_commande_vente WHERE id_commande_vente = ?
    `, [facture.id_commande]);

    // 5. Générer le PDF
    const doc = new PDFDocument({ margin: 50 });
    let filename = `Facture_${facture.numero_facture}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Header: Facture n° ... du ...
    doc.fillColor('#6D21A3').fontSize(16).font('Helvetica-Bold')
      .text(`Facture n° ${facture.numero_facture} du ${new Date(facture.date_facture).toLocaleDateString('fr-FR')}`, { align: 'center' });
    doc.moveDown(1);

    // Section A: Identification du vendeur
    doc.fillColor('black').fontSize(12).text('A. Identification du vendeur', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom et prénom ou Raison sociale* : ${entreprise.nom_entreprise}`);
    doc.text(`NIF* : ${entreprise.nif}`);
    doc.text(`Registre de Commerce N° : ${entreprise.numero_rc}`);
    doc.text(`B.P : ${entreprise.boite_postale || ''}, Tél : ${entreprise.telephone}`);
    doc.text(`Commune : ${entreprise.commune}, Quartier : ${entreprise.quartier}`);
    doc.text(`Av. : ${entreprise.avenue}, Rue : ${entreprise.rue || ''}, N° : ${entreprise.numero_batiment}`);
    doc.text(`Assujetti à la TVA* : [${entreprise.assujetti_tva ? 'X' : ' '}] Oui [${!entreprise.assujetti_tva ? 'X' : ' '}] Non`);

    // Colonne de droite (Vendeur)
    const rightColX = 350;
    const sellerY = doc.y - 85;
    doc.text(`Centre fiscal : ${entreprise.centre_fiscal}`, rightColX, sellerY);
    doc.text(`Secteur d'activités : ${entreprise.secteur_activite}`, rightColX, sellerY + 15);
    doc.text(`Forme juridique : ${entreprise.forme_juridique || 'S.U'}`, rightColX, sellerY + 30);

    doc.y = sellerY + 100; // Reset Y after columns
    doc.moveDown(1);

    // Section B: Le client
    doc.fontSize(12).font('Helvetica-Bold').text('B. Le client: ', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom et prénom ou Raison sociale* : ${client.nom_client}`);
    doc.text(`NIF : ${client.numero_tva || client.nif || 'N/A'}`);
    doc.text(`Résident à : ${client.adresse}`);
    doc.text(`Assujetti à la TVA* : [${client.numero_tva ? 'X' : ' '}] Oui [${!client.numero_tva ? 'X' : ' '}] Non`);
    doc.text('doit pour ce qui suit :');
    doc.moveDown(0.5);

    // Tableau des articles
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 350;
    const col3X = 420;
    const col4X = 500;

    // Table Header
    doc.font('Helvetica-Bold');
    doc.rect(col1X - 5, tableTop - 5, 500, 20).stroke();
    doc.text('Nature de l\'article ou service*', col1X, tableTop);
    doc.text('Qté*', col2X, tableTop);
    doc.text('PU*', col3X, tableTop);
    doc.text('PVHTVA', col4X, tableTop);

    let currentY = tableTop + 20;
    doc.font('Helvetica');

    lignes.forEach((item, index) => {
      // Check for page break
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(`${index + 1}. ${item.designation}`, col1X, currentY, { width: 280 });
      doc.text(item.quantite_commandee.toString(), col2X, currentY);
      doc.text(item.prix_unitaire_ht.toLocaleString(), col3X, currentY);
      const pvhtva = item.quantite_commandee * item.prix_unitaire_ht;
      doc.text(pvhtva.toLocaleString(), col4X, currentY);

      currentY += Math.max(20, doc.heightOfString(item.designation, { width: 280 }));
      doc.moveTo(col1X - 5, currentY - 5).lineTo(col4X + 45, currentY - 5).stroke();
    });

    // Totals
    doc.font('Helvetica-Bold');
    doc.text('PVT HTVA', col1X, currentY);
    doc.text(Number(facture.montant_ht).toLocaleString(), col4X, currentY);
    currentY += 20;

    doc.text('TVA', col1X, currentY);
    doc.text(Number(facture.montant_tva).toLocaleString(), col4X, currentY);
    currentY += 20;

    doc.rect(col1X - 5, currentY - 5, 500, 25).stroke();
    doc.fontSize(12).text('Total TVAC', col1X, currentY);
    doc.text(Number(facture.montant_ttc).toLocaleString(), col4X, currentY);

    doc.moveDown(2);
    doc.fontSize(10).fillColor('red').text('*Mention obligatoire');
    doc.fillColor('black').text('N.B: Les non assujettis à la TVA ne remplissent pas les deux dernières lignes');

    doc.end();

  } catch (error) {
    console.error('Export OBR PDF error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la génération du PDF OBR', error: error.message });
  }
});

module.exports = router;