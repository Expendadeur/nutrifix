// backend/api/routes/manager.js - Routes API Manager Complètes (VERSION CORRIGÉE)
const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { enregistrerDansBudgetDepartement } = require('./operationsRoutes');
const {
  authenticate,
  authorize,
  authorizeDepartment
} = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ==================== MIDDLEWARE ====================
router.use(authenticate);
router.use(authorize('manager'));

// ==================== DASHBOARD ====================

// GET /api/manager/dashboard - Vue d'ensemble du département
router.get('/dashboard', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement, departement_type } = req.user;
    const { period = 'month' } = req.query;

    console.log('📊 Dashboard Manager - Dept:', id_departement, 'Type:', departement_type);

    // ✅ KPIs de base
    const employeesResult = await db.query(
      `SELECT COUNT(*) as total_employes,
              SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as employes_actifs
       FROM utilisateurs 
       WHERE id_departement = ?`,
      [id_departement]
    );
    const employees = Array.isArray(employeesResult) ? employeesResult[0] : employeesResult;

    // ✅ Présences aujourd'hui
    const presencesResult = await db.query(
      `SELECT COUNT(*) as presences_aujourdhui
       FROM presences p
       JOIN utilisateurs u ON p.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND DATE(p.date) = CURDATE()
       AND p.statut = 'present'`,
      [id_departement]
    );
    const presences = Array.isArray(presencesResult) ? presencesResult[0] : presencesResult;

    // ✅ Demandes en attente
    const demandesResult = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM conges 
         WHERE id_utilisateur IN (SELECT id FROM utilisateurs WHERE id_departement = ?)
         AND statut = 'en_attente') as conges_en_attente,
        (SELECT COUNT(*) FROM demandes_budget 
         WHERE id_departement = ? AND statut = 'en_attente') as budget_en_attente`,
      [id_departement, id_departement]
    );
    const demandes = Array.isArray(demandesResult) ? demandesResult[0] : demandesResult;

    // ✅ Budget utilisé
    const budgetResult = await db.query(
      `SELECT 
        COALESCE(budget_alloue, 0) as budget_alloue,
        (SELECT COALESCE(SUM(montant), 0) 
         FROM depenses_departement 
         WHERE id_departement = ? 
         AND YEAR(date_depense) = YEAR(CURDATE())) as total_depenses
       FROM budgets_departements
       WHERE id_departement = ?
       AND annee = YEAR(CURDATE())
       LIMIT 1`,
      [id_departement, id_departement]
    );
    const budget = Array.isArray(budgetResult) ? budgetResult[0] : budgetResult;

    let kpiData = {
      employes_actifs: employees?.employes_actifs || 0,
      presences_aujourdhui: presences?.presences_aujourdhui || 0,
      demandes_en_attente: (demandes?.conges_en_attente || 0) + (demandes?.budget_en_attente || 0),
      budget_utilise: budget && budget.budget_alloue > 0 ? Math.round((budget.total_depenses / budget.budget_alloue) * 100) : 0
    };

    // ✅ KPIs spécifiques au département
    if (departement_type === 'agriculture') {
      const agriKPIsResult = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM parcelles WHERE statut = 'en_culture') as parcelles_en_culture,
          (SELECT COALESCE(SUM(rendement_obtenu_kg), 0) 
           FROM recoltes r
           JOIN cultures c ON r.id_culture = c.id
           JOIN parcelles p ON c.id_parcelle = p.id
           WHERE MONTH(r.date_recolte_reelle) = MONTH(CURDATE())
           AND YEAR(r.date_recolte_reelle) = YEAR(CURDATE())) as production_mois_kg`
      );
      const agriKPIs = Array.isArray(agriKPIsResult) ? agriKPIsResult[0] : agriKPIsResult;
      kpiData = { ...kpiData, ...agriKPIs };

    } else if (departement_type === 'elevage') {
      const elevageKPIsResult = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM animaux WHERE statut = 'vivant') as animaux_vivants,
          (SELECT COALESCE(SUM(quantite_litres), 0)
           FROM productions_lait
           WHERE MONTH(date_production) = MONTH(CURDATE())
           AND YEAR(date_production) = YEAR(CURDATE())) as production_lait_litres`
      );
      const elevageKPIs = Array.isArray(elevageKPIsResult) ? elevageKPIsResult[0] : elevageKPIsResult;
      kpiData = { ...kpiData, ...elevageKPIs };

    } else if (departement_type === 'flotte') {
      const flotteKPIsResult = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM vehicules WHERE id_departement = ? AND statut = 'actif') as vehicules_actifs,
          (SELECT COUNT(*) FROM mouvements_vehicules 
           WHERE id_vehicule IN (SELECT id FROM vehicules WHERE id_departement = ?)
           AND statut = 'en_cours') as missions_en_cours`,
        [id_departement, id_departement]
      );
      const flotteKPIs = Array.isArray(flotteKPIsResult) ? flotteKPIsResult[0] : flotteKPIsResult;
      kpiData = { ...kpiData, ...flotteKPIs };

    } else if (departement_type === 'commercial') {
      const commercialKPIsResult = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM commandes_vente 
           WHERE MONTH(date_commande) = MONTH(CURDATE())
           AND YEAR(date_commande) = YEAR(CURDATE())) as commandes_mois,
          (SELECT COALESCE(SUM(montant_total), 0) FROM commandes_vente 
           WHERE MONTH(date_commande) = MONTH(CURDATE())
           AND YEAR(date_commande) = YEAR(CURDATE())) as ca_mois`
      );
      const commercialKPIs = Array.isArray(commercialKPIsResult) ? commercialKPIsResult[0] : commercialKPIsResult;
      kpiData = { ...kpiData, ...commercialKPIs };
    }

    // ✅ Performance Chart Data
    let periodQuery = '';
    if (period === 'week') {
      periodQuery = 'AND DATE(p.date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      periodQuery = 'AND MONTH(p.date) = MONTH(CURDATE()) AND YEAR(p.date) = YEAR(CURDATE())';
    } else if (period === 'year') {
      periodQuery = 'AND YEAR(p.date) = YEAR(CURDATE())';
    }

    const performanceResult = await db.query(
      `SELECT 
        DATE(date) as date,
        COUNT(*) as total_presences,
        AVG(TIMESTAMPDIFF(HOUR, heure_entree, COALESCE(heure_sortie, heure_entree))) as heures_moyennes
       FROM presences p
       JOIN utilisateurs u ON p.id_utilisateur = u.id
       WHERE u.id_departement = ?
       ${periodQuery}
       GROUP BY DATE(date)
       ORDER BY date ASC
       LIMIT 30`,
      [id_departement]
    );
    const performance = Array.isArray(performanceResult) ? performanceResult : [];

    // ✅ Team Stats
    const teamStatsResult = await db.query(
      `SELECT 
        COALESCE(AVG(taux_presence), 0) as taux_presence_moyen,
        COALESCE(AVG(heures_moyennes), 0) as heures_moyennes,
        COALESCE(AVG(score_performance), 0) as score_performance_moyen
       FROM (
         SELECT 
           u.id,
           (SELECT COUNT(*) * 100.0 / 
            GREATEST((SELECT COUNT(*) FROM presences WHERE id_utilisateur = u.id 
             AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())), 1)
            FROM presences WHERE id_utilisateur = u.id 
            AND MONTH(date) = MONTH(CURDATE()) 
            AND YEAR(date) = YEAR(CURDATE())
            AND statut = 'present') as taux_presence,
           (SELECT AVG(TIMESTAMPDIFF(HOUR, heure_entree, COALESCE(heure_sortie, heure_entree)))
            FROM presences WHERE id_utilisateur = u.id 
            AND MONTH(date) = MONTH(CURDATE())
            AND YEAR(date) = YEAR(CURDATE())) as heures_moyennes,
           (SELECT note_performance FROM evaluations_performance 
            WHERE id_employe = u.id ORDER BY date_evaluation DESC LIMIT 1) as score_performance
         FROM utilisateurs u
         WHERE u.id_departement = ? AND u.statut = 'actif'
       ) stats`,
      [id_departement]
    );
    const teamStats = Array.isArray(teamStatsResult) ? teamStatsResult[0] : teamStatsResult;

    // ✅ Top Performers
    const topPerformersResult = await db.query(
      `SELECT 
        u.id,
        u.nom_complet,
        u.photo_identite,
        (SELECT note_performance FROM evaluations_performance 
         WHERE id_employe = u.id ORDER BY date_evaluation DESC LIMIT 1) as score,
        (SELECT COUNT(*) FROM presences 
         WHERE id_utilisateur = u.id 
         AND MONTH(date) = MONTH(CURDATE())
         AND YEAR(date) = YEAR(CURDATE())
         AND statut = 'present') as presences_mois
       FROM utilisateurs u
       WHERE u.id_departement = ? AND u.statut = 'actif'
       ORDER BY score DESC
       LIMIT 5`,
      [id_departement]
    );
    const topPerformers = Array.isArray(topPerformersResult) ? topPerformersResult : [];

    // ✅ Alertes
    const alertesResult = await db.query(
      `SELECT 
        'conge' as type,
        c.id,
        CONCAT(u.nom_complet, ' - Demande de congé') as message,
        c.date_creation as date,
        'prioritaire' as niveau
       FROM conges c
       JOIN utilisateurs u ON c.id_utilisateur = u.id
       WHERE u.id_departement = ? AND c.statut = 'en_attente'
       
       UNION ALL
       
       SELECT 
        'budget' as type,
        db.id,
        CONCAT('Demande budget: ', db.categorie, ' - ', db.montant_demande, ' BIF') as message,
        db.date_demande as date,
        db.urgence as niveau
       FROM demandes_budget db
       WHERE db.id_departement = ? AND db.statut = 'en_attente'
       
       ORDER BY niveau DESC, date DESC
       LIMIT 10`,
      [id_departement, id_departement]
    );
    const alertes = Array.isArray(alertesResult) ? alertesResult : [];

    // ✅ Demandes d'approbation
    const approbationsResult = await db.query(
      `SELECT 
        'conge' as type,
        c.id,
        u.nom_complet as employe,
        u.photo_identite,
        c.type_conge,
        c.date_debut,
        c.date_fin,
        c.jours_demandes,
        c.raison as motif
       FROM conges c
       JOIN utilisateurs u ON c.id_utilisateur = u.id
       WHERE u.id_departement = ? AND c.statut = 'en_attente'
       ORDER BY c.date_creation DESC
       LIMIT 5`,
      [id_departement]
    );
    const approbations = Array.isArray(approbationsResult) ? approbationsResult : [];

    console.log('✅ Dashboard chargé avec succès');

    res.json({
      kpis: kpiData,
      performance: performance,
      teamStats: teamStats || { taux_presence_moyen: 0, heures_moyennes: 0, score_performance_moyen: 0 },
      topPerformers: topPerformers,
      alertes: alertes,
      approbations: approbations
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ==================== RH - ÉQUIPE ====================

// GET /api/manager/employees - Liste des employés du département
router.get('/employees', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { role, statut, search } = req.query;

    let query = `
      SELECT 
        u.*,
        d.nom as nom_departement,
        (SELECT COUNT(*) * 100.0 / 
         GREATEST((SELECT COUNT(*) FROM presences 
          WHERE id_utilisateur = u.id 
          AND MONTH(date) = MONTH(CURDATE())
          AND YEAR(date) = YEAR(CURDATE())), 1)
         FROM presences 
         WHERE id_utilisateur = u.id 
         AND MONTH(date) = MONTH(CURDATE())
         AND YEAR(date) = YEAR(CURDATE())
         AND statut = 'present') as presence_rate,
        (SELECT note_performance FROM evaluations_performance 
         WHERE id_employe = u.id ORDER BY date_evaluation DESC LIMIT 1) as performance_score,
        (SELECT SUM(TIMESTAMPDIFF(HOUR, heure_entree, COALESCE(heure_sortie, heure_entree)))
         FROM presences 
         WHERE id_utilisateur = u.id 
         AND MONTH(date) = MONTH(CURDATE())
         AND YEAR(date) = YEAR(CURDATE())) as hours_worked,
        (SELECT COUNT(*) FROM presences 
         WHERE id_utilisateur = u.id 
         AND MONTH(date) = MONTH(CURDATE())
         AND YEAR(date) = YEAR(CURDATE())
         AND statut = 'absent') as absences
      FROM utilisateurs u
      JOIN departements d ON u.id_departement = d.id
      WHERE u.id_departement = ?
    `;

    const params = [id_departement];

    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (statut && statut !== 'all') {
      query += ' AND u.statut = ?';
      params.push(statut);
    }

    if (search) {
      query += ' AND (u.nom_complet LIKE ? OR u.matricule LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY u.nom_complet ASC';

    const employeesResult = await db.query(query, params);
    const employees = Array.isArray(employeesResult) ? employeesResult : [];

    // Ajouter solde congés
    for (let emp of employees) {
      const leaveBalanceResult = await db.query(
        `SELECT 
          jours_conges_annuels as total,
          (SELECT COALESCE(SUM(jours_demandes), 0) 
           FROM conges 
           WHERE id_utilisateur = ? 
           AND YEAR(date_debut) = YEAR(CURDATE())
           AND statut = 'approuve') as used
         FROM utilisateurs
         WHERE id = ?`,
        [emp.id, emp.id]
      );

      const leaveBalance = Array.isArray(leaveBalanceResult) ? leaveBalanceResult[0] : leaveBalanceResult;

      emp.leave_balance = {
        total: leaveBalance?.total || 0,
        used: leaveBalance?.used || 0,
        remaining: (leaveBalance?.total || 0) - (leaveBalance?.used || 0)
      };
    }

    res.json(employees);

  } catch (error) {
    console.error('❌ Error fetching employees:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/employees/:id/notify - Envoyer un email personnalisé à un employé
router.post('/employees/:id/notify', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id: managerId, id_departement } = req.user;
    const { id: employeeId } = req.params;
    const { sujet, message } = req.body;

    if (!sujet || !message) {
      return res.status(400).json({ error: 'Sujet et message requis' });
    }

    // Vérifier que l'employé appartient au département
    const [employee] = await db.query(
      'SELECT nom_complet, email FROM utilisateurs WHERE id = ? AND id_departement = ?',
      [employeeId, id_departement]
    );

    if (!employee || employee.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé dans votre département' });
    }

    const emailService = require('../emailService');
    const result = await emailService.envoyerNotificationGenerale(
      employee[0].email,
      sujet,
      `Message de votre manager :\n\n${message}`
    );

    if (result.success) {
      // Trace
      await db.query(
        'INSERT INTO traces (id_utilisateur, module, type_action, action_details) VALUES (?, ?, ?, ?)',
        [managerId, 'rh', 'notification_email', `Email envoyé à ${employee[0].nom_complet}: ${sujet}`]
      );

      res.json({ success: true, message: 'Email envoyé avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email', details: result.error });
    }
  } catch (error) {
    console.error('❌ Error notifying employee:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/employees/:id/toggle-status - Activer/Désactiver un employé
router.post('/employees/:id/toggle-status', authorize('manager', 'admin'), async (req, res) => {
  let connection;
  try {
    const { id: managerId, id_departement } = req.user;
    const { id: employeeId } = req.params;

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Vérifier que l'employé appartient au département
    const [employee] = await connection.query(
      'SELECT id, nom_complet, email, statut FROM utilisateurs WHERE id = ? AND id_departement = ?',
      [employeeId, id_departement]
    );

    if (!employee || employee.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Employé non trouvé dans votre département' });
    }

    const currentStatus = employee[0].statut;
    const newStatus = currentStatus === 'actif' ? 'inactif' : 'actif';

    await connection.query(
      'UPDATE utilisateurs SET statut = ? WHERE id = ?',
      [newStatus, employeeId]
    );

    // Notification par email
    const emailService = require('../emailService');
    if (newStatus === 'actif') {
      await emailService.envoyerNotificationActivation(employee[0].email, employee[0].nom_complet);
    } else {
      await emailService.envoyerNotificationDesactivation(employee[0].email, employee[0].nom_complet, 'Désactivé par votre manager');
    }

    // Trace
    await connection.query(
      'INSERT INTO traces (id_utilisateur, module, type_action, action_details) VALUES (?, ?, ?, ?)',
      [managerId, 'rh', 'toggle_status', `Statut de ${employee[0].nom_complet} changé en ${newStatus}`]
    );

    await connection.commit();
    res.json({ success: true, newStatus, message: `Employé ${newStatus === 'actif' ? 'activé' : 'désactivé'} avec succès` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error toggling employee status:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/manager/employees/:id/mark-presence - Marquer présence/absence manuellement
router.post('/employees/:id/mark-presence', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id: managerId, id_departement } = req.user;
    const { id: employeeId } = req.params;
    const { statut, date } = req.body; // statut: 'present', 'absent'

    if (!['present', 'absent'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Vérifier que l'employé appartient au département
    const [employee] = await db.query(
      'SELECT nom_complet FROM utilisateurs WHERE id = ? AND id_departement = ?',
      [employeeId, id_departement]
    );

    if (!employee || employee.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé dans votre département' });
    }

    // Vérifier si une présence existe déjà pour cette date
    const [existing] = await db.query(
      'SELECT id FROM presences WHERE id_utilisateur = ? AND DATE(date) = ?',
      [employeeId, targetDate]
    );

    if (existing && existing.length > 0) {
      await db.query(
        `UPDATE presences SET 
          statut = ?, 
          heure_entree = ?, 
          statut_validation = 'valide', 
          valide_par = ?, 
          date_validation = NOW() 
        WHERE id = ?`,
        [statut, statut === 'present' ? '08:00:00' : null, managerId, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO presences 
          (id_utilisateur, date, statut, heure_entree, statut_validation, valide_par, date_validation) 
         VALUES (?, ?, ?, ?, 'valide', ?, NOW())`,
        [employeeId, targetDate, statut, statut === 'present' ? '08:00:00' : null, managerId]
      );
    }

    // Trace
    await db.query(
      'INSERT INTO traces (id_utilisateur, module, type_action, action_details) VALUES (?, ?, ?, ?)',
      [managerId, 'rh', 'marquage_presence', `Présence de ${employee[0].nom_complet} marquée comme ${statut} pour le ${targetDate}`]
    );

    res.json({ success: true, message: `Présence marquée comme ${statut}` });
  } catch (error) {
    console.error('❌ Error marking presence:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/presences - Présences pour une date
router.get('/presences', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { date } = req.query;

    const targetDate = date || new Date().toISOString().split('T')[0];

    const presencesResult = await db.query(
      `SELECT 
        p.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo
       FROM presences p
       JOIN utilisateurs u ON p.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND DATE(p.date) = ?
       ORDER BY u.nom_complet ASC`,
      [id_departement, targetDate]
    );
    const presences = Array.isArray(presencesResult) ? presencesResult : [];

    res.json(presences);

  } catch (error) {
    console.error('❌ Error fetching presences:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/presences/validate - Valider des présences
router.post('/presences/validate', authorize('manager', 'admin'), async (req, res) => {
  let connection;

  try {
    const { id: managerId, id_departement } = req.user;
    const { presenceIds } = req.body;

    if (!presenceIds || !Array.isArray(presenceIds) || presenceIds.length === 0) {
      return res.status(400).json({ error: 'IDs de présences invalides' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Vérifier que toutes les présences appartiennent au département
    const presencesResult = await connection.query(
      `SELECT p.id FROM presences p
       JOIN utilisateurs u ON p.id_utilisateur = u.id
       WHERE p.id IN (?) AND u.id_departement = ?`,
      [presenceIds, id_departement]
    );
    const presences = Array.isArray(presencesResult) ? presencesResult : [];

    if (presences.length !== presenceIds.length) {
      await connection.rollback();
      return res.status(403).json({ error: 'Accès non autorisé à certaines présences' });
    }

    // ✅ Valider les présences (correction: statut_validation au lieu de statut)
    await connection.query(
      `UPDATE presences 
       SET statut_validation = 'valide',
           valide_par = ?,
           date_validation = NOW()
       WHERE id IN (?)`,
      [managerId, presenceIds]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'validation', ?)`,
      [managerId, `Validation de ${presenceIds.length} présences`]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `${presenceIds.length} présence(s) validée(s)`
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error validating presences:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/manager/leave-requests - Demandes de congés
router.get('/leave-requests', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { filter = 'pending' } = req.query;

    let statusCondition = '';
    if (filter === 'pending') statusCondition = "AND c.statut = 'en_attente'";
    else if (filter === 'approved') statusCondition = "AND c.statut = 'approuve'";
    else if (filter === 'rejected') statusCondition = "AND c.statut = 'rejete'";

    const requestsResult = await db.query(
      `SELECT 
        c.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo
       FROM conges c
       JOIN utilisateurs u ON c.id_utilisateur = u.id
       WHERE u.id_departement = ?
       ${statusCondition}
       ORDER BY c.date_creation DESC`,
      [id_departement]
    );
    const requests = Array.isArray(requestsResult) ? requestsResult : [];

    res.json(requests);

  } catch (error) {
    console.error('❌ Error fetching leave requests:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/leave-requests/:id/process - Approuver/Rejeter congé
router.post('/leave-requests/:id/process', authorize('manager', 'admin'), async (req, res) => {
  let connection;

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: leaveId } = req.params;
    const { action, reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Vérifier que le congé appartient au département
    const leaveResult = await connection.query(
      `SELECT c.*, u.nom_complet 
       FROM conges c
       JOIN utilisateurs u ON c.id_utilisateur = u.id
       WHERE c.id = ? AND u.id_departement = ?`,
      [leaveId, id_departement]
    );
    const leave = Array.isArray(leaveResult) ? leaveResult : [];

    if (leave.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Demande de congé non trouvée' });
    }

    if (leave[0].statut !== 'en_attente') {
      await connection.rollback();
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    const newStatus = action === 'approve' ? 'approuve' : 'rejete';

    await connection.query(
      `UPDATE conges 
       SET statut = ?,
           valide_par = ?,
           date_validation = NOW(),
           commentaire_validation = ?
       WHERE id = ?`,
      [newStatus, managerId, reason || null, leaveId]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'traitement_conge', ?)`,
      [managerId, `${action === 'approve' ? 'Approbation' : 'Rejet'} congé ${leave[0].nom_complet}`]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Demande ${action === 'approve' ? 'approuvée' : 'rejetée'}`
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error processing leave request:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/manager/salaries - Salaires du département
router.get('/salaries', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const salariesResult = await db.query(
      `SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       ORDER BY u.nom_complet ASC`,
      [id_departement, targetMonth, targetYear]
    );
    const salaries = Array.isArray(salariesResult) ? salariesResult : [];

    res.json(salaries);

  } catch (error) {
    console.error('❌ Error fetching salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/salaries/:id/mark-paid - Marquer salaire comme payé
router.post('/salaries/:id/mark-paid', authorize('manager', 'admin'), async (req, res) => {
  let connection;

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: salaryId } = req.params;

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Vérifier que le salaire appartient au département
    const [salary] = await connection.query(
      `SELECT s.* FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND u.id_departement = ?`,
      [salaryId, id_departement]
    );

    if (salary.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Salaire non trouvé' });
    }

    await connection.query(
      `UPDATE salaires 
       SET statut_paiement = 'payé',
           date_paiement = NOW()
       WHERE id = ?`,
      [salaryId]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'paiement_salaire', ?)`,
      [managerId, `Paiement salaire ID ${salaryId}`]
    );

    // Enregistrer la dépense dans le budget du département
    await enregistrerDansBudgetDepartement({
      id_departement: id_departement,
      type_mouvement: 'depense',
      categorie: 'salaire',
      description: `Paiement salaire ${salary[0].mois}/${salary[0].annee}`,
      montant: salary[0].salaire_net,
      reference: `SAL-${salaryId}`,
      effectue_par: managerId
    });

    await connection.commit();

    res.json({ success: true, message: 'Salaire marqué comme payé' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error marking salary as paid:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/manager/performance - Données de performance
router.get('/performance', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const performanceResult = await db.query(
      `SELECT 
        u.id,
        u.nom_complet,
        u.photo_identite,
        (SELECT AVG(note_performance) FROM evaluations_performance 
         WHERE id_employe = u.id) as avg_score,
        (SELECT COUNT(*) * 100.0 / 
         GREATEST((SELECT COUNT(*) FROM presences 
          WHERE id_utilisateur = u.id 
          AND YEAR(date) = YEAR(CURDATE())), 1)
         FROM presences 
         WHERE id_utilisateur = u.id 
         AND YEAR(date) = YEAR(CURDATE())
         AND statut = 'present') as presence_rate,
        (SELECT SUM(TIMESTAMPDIFF(HOUR, heure_entree, COALESCE(heure_sortie, heure_entree)))
         FROM presences 
         WHERE id_utilisateur = u.id 
         AND YEAR(date) = YEAR(CURDATE())) as total_hours
       FROM utilisateurs u
       WHERE u.id_departement = ? AND u.statut = 'actif'
       ORDER BY avg_score DESC`,
      [id_departement]
    );
    const performance = Array.isArray(performanceResult) ? performanceResult : [];

    res.json(performance);

  } catch (error) {
    console.error('❌ Error fetching performance data:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ==================== MODULES OPÉRATIONNELS ====================

// GET /api/manager/department-info - Info type département
router.get('/department-info', async (req, res) => {
  try {
    const { id_departement } = req.user;

    console.log('🔍 ID recherché:', id_departement);

    const result = await db.query(
      'SELECT id, nom, type FROM departements WHERE id = ?',
      [id_departement]
    );

    // ✅ Extraction correcte
    const rows = Array.isArray(result) ? result : [result];
    const dept = rows[0];

    console.log('✅ dept final:', dept);

    if (!dept) {
      console.log('❌ Département non trouvé pour ID:', id_departement);
      return res.status(404).json({ error: 'Département non trouvé' });
    }

    res.json(dept);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== AGRICULTURE =====

// GET /api/manager/parcelles
router.get('/parcelles', authorize('manager', 'admin'), async (req, res) => {
  try {
    const parcellesResult = await db.query(
      `SELECT 
        p.*,
        tc.nom_culture as culture_actuelle_nom
       FROM parcelles p
       LEFT JOIN cultures c ON p.id_culture_actuelle = c.id
       LEFT JOIN types_cultures tc ON c.id_type_culture = tc.id
       ORDER BY p.nom_parcelle ASC`
    );
    const parcelles = Array.isArray(parcellesResult) ? parcellesResult : [];

    res.json(parcelles);

  } catch (error) {
    console.error('❌ Error fetching parcelles:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/cultures
router.get('/cultures', authorize('manager', 'admin'), async (req, res) => {
  try {
    const culturesResult = await db.query(
      `SELECT 
        c.*,
        p.nom_parcelle as parcelle_nom,
        tc.nom_culture
       FROM cultures c
       JOIN parcelles p ON c.id_parcelle = p.id
       JOIN types_cultures tc ON c.id_type_culture = tc.id
       ORDER BY c.date_semaison DESC`
    );
    const cultures = Array.isArray(culturesResult) ? culturesResult : [];

    res.json(cultures);

  } catch (error) {
    console.error('❌ Error fetching cultures:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/intrants
router.get('/intrants', authorize('manager', 'admin'), async (req, res) => {
  try {
    const intrantsResult = await db.query(
      `SELECT * FROM intrants_agricoles 
       ORDER BY nom_intrant ASC`
    );
    const intrants = Array.isArray(intrantsResult) ? intrantsResult : [];

    res.json(intrants);

  } catch (error) {
    console.error('❌ Error fetching intrants:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/recoltes
router.get('/recoltes', authorize('manager', 'admin'), async (req, res) => {
  try {
    const recoltesResult = await db.query(
      `SELECT 
        r.*,
        tc.nom_culture,
        p.nom_parcelle as parcelle_nom
       FROM recoltes r
       JOIN cultures c ON r.id_culture = c.id
       JOIN parcelles p ON c.id_parcelle = p.id
       JOIN types_cultures tc ON c.id_type_culture = tc.id
       ORDER BY r.date_recolte_reelle DESC`
    );
    const recoltes = Array.isArray(recoltesResult) ? recoltesResult : [];

    res.json(recoltes);

  } catch (error) {
    console.error('❌ Error fetching recoltes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ===== ÉLEVAGE =====

// GET /api/manager/animaux
router.get('/animaux', authorize('manager', 'admin'), async (req, res) => {
  try {
    const animauxResult = await db.query(
      `SELECT 
        a.*,
        (SELECT date_intervention FROM suivis_sanitaires 
         WHERE id_animal = a.id 
         AND type_intervention = 'vaccination'
         ORDER BY date_intervention DESC LIMIT 1) as derniere_vaccination
       FROM animaux a
       ORDER BY a.date_naissance DESC`
    );
    const animaux = Array.isArray(animauxResult) ? animauxResult : [];

    res.json(animaux);

  } catch (error) {
    console.error('❌ Error fetching animaux:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/production-lait
router.get('/production-lait', authorize('manager', 'admin'), async (req, res) => {
  try {
    const productionResult = await db.query(
      `SELECT 
        pl.*,
        a.numero_identification as animal_numero,
        'lait' as type
       FROM productions_lait pl
       JOIN animaux a ON pl.id_animal = a.id
       ORDER BY pl.date_production DESC`
    );
    const production = Array.isArray(productionResult) ? productionResult : [];

    res.json(production);

  } catch (error) {
    console.error('❌ Error fetching production lait:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/production-oeufs
router.get('/production-oeufs', authorize('manager', 'admin'), async (req, res) => {
  try {
    const productionResult = await db.query(
      `SELECT 
        po.*,
        'oeufs' as type
       FROM productions_oeufs po
       ORDER BY po.date_recolte DESC`
    );
    const production = Array.isArray(productionResult) ? productionResult : [];

    res.json(production);

  } catch (error) {
    console.error('❌ Error fetching production oeufs:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/aliments-betail
router.get('/aliments-betail', authorize('manager', 'admin'), async (req, res) => {
  try {
    const alimentsResult = await db.query(
      `SELECT * FROM aliments_betail 
       ORDER BY nom_aliment ASC`
    );
    const aliments = Array.isArray(alimentsResult) ? alimentsResult : [];

    res.json(aliments);

  } catch (error) {
    console.error('❌ Error fetching aliments betail:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ===== FLOTTE =====

// GET /api/manager/vehicules-department
router.get('/vehicules-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const vehiculesResult = await db.query(
      `SELECT 
        v.*,
        u.nom_complet as chauffeur_nom,
        (SELECT date_intervention FROM maintenances_vehicules 
         WHERE id_vehicule = v.id 
         ORDER BY date_intervention DESC LIMIT 1) as derniere_maintenance,
        (SELECT date_intervention FROM maintenances_vehicules 
         WHERE id_vehicule = v.id AND statut = 'planifie'
         ORDER BY date_intervention ASC LIMIT 1) as prochain_controle
       FROM vehicules v
       LEFT JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
       WHERE v.id_departement = ?
       ORDER BY v.immatriculation ASC`,
      [id_departement]
    );
    const vehicules = Array.isArray(vehiculesResult) ? vehiculesResult : [];

    res.json(vehicules);

  } catch (error) {
    console.error('❌ Error fetching vehicules:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/missions-department
router.get('/missions-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const missionsResult = await db.query(
      `SELECT 
        m.*,
        v.immatriculation as vehicule_immatriculation,
        u.nom_complet as chauffeur_nom,
        (SELECT COALESCE(SUM(montant), 0) FROM frais_vehicules 
         WHERE id_mouvement = m.id) as total_frais
       FROM mouvements_vehicules m
       JOIN vehicules v ON m.id_vehicule = v.id
       JOIN utilisateurs u ON m.id_chauffeur = u.id
       WHERE v.id_departement = ?
       ORDER BY m.date_mission DESC`,
      [id_departement]
    );
    const missions = Array.isArray(missionsResult) ? missionsResult : [];

    res.json(missions);

  } catch (error) {
    console.error('❌ Error fetching missions:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/maintenances-department
router.get('/maintenances-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const maintenancesResult = await db.query(
      `SELECT 
        m.*,
        v.immatriculation as vehicule_immatriculation
       FROM maintenances_vehicules m
       JOIN vehicules v ON m.id_vehicule = v.id
       WHERE v.id_departement = ?
       ORDER BY m.date_intervention DESC`,
      [id_departement]
    );
    const maintenances = Array.isArray(maintenancesResult) ? maintenancesResult : [];

    res.json(maintenances);

  } catch (error) {
    console.error('❌ Error fetching maintenances:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/frais-department
router.get('/frais-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const fraisResult = await db.query(
      `SELECT 
        f.*,
        v.immatriculation as vehicule_immatriculation,
        u.nom_complet as chauffeur_nom
       FROM frais_vehicules f
       JOIN mouvements_vehicules m ON f.id_mouvement = m.id
       JOIN vehicules v ON m.id_vehicule = v.id
       JOIN utilisateurs u ON m.id_chauffeur = u.id
       WHERE v.id_departement = ?
       ORDER BY f.date DESC`,
      [id_departement]
    );
    const frais = Array.isArray(fraisResult) ? fraisResult : [];

    res.json(frais);

  } catch (error) {
    console.error('❌ Error fetching frais:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/frais/:id/validate
router.post('/frais/:id/validate', authorize('manager', 'admin'), async (req, res) => {
  let connection;

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: fraisId } = req.params;

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Vérifier que le frais appartient au département
    const fraisResult = await connection.query(
      `SELECT f.* FROM frais_vehicules f
       JOIN mouvements_vehicules m ON f.id_mouvement = m.id
       JOIN vehicules v ON m.id_vehicule = v.id
       WHERE f.id = ? AND v.id_departement = ?`,
      [fraisId, id_departement]
    );
    const frais = Array.isArray(fraisResult) ? fraisResult : [];

    if (frais.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Frais non trouvé' });
    }

    await connection.query(
      `UPDATE frais_vehicules 
       SET valide = TRUE,
           valide_par = ?,
           date_validation = NOW()
       WHERE id = ?`,
      [managerId, fraisId]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'flotte', 'validation_frais', ?)`,
      [managerId, `Validation frais ID ${fraisId}`]
    );

    await connection.commit();

    res.json({ success: true, message: 'Frais validé' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error validating frais:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ===== COMMERCIAL =====

// GET /api/manager/commandes-department
router.get('/commandes-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const commandesVenteResult = await db.query(
      `SELECT 
        cv.*,
        'vente' as type,
        c.nom_client as client_nom,
        (SELECT COUNT(*) FROM lignes_commande_vente WHERE id_commande_vente = cv.id) as nombre_lignes
       FROM commandes_vente cv
       JOIN clients c ON cv.id_client = c.id
       ORDER BY cv.date_commande DESC`
    );
    const commandesVente = Array.isArray(commandesVenteResult) ? commandesVenteResult : [];

    const commandesAchatResult = await db.query(
      `SELECT 
        ca.*,
        'achat' as type,
        f.nom_fournisseur as fournisseur_nom,
        (SELECT COUNT(*) FROM lignes_commande_achat WHERE id_commande_achat = ca.id) as nombre_lignes
       FROM commandes_achat ca
       JOIN fournisseurs f ON ca.id_fournisseur = f.id
       ORDER BY ca.date_commande DESC`
    );
    const commandesAchat = Array.isArray(commandesAchatResult) ? commandesAchatResult : [];

    res.json([...commandesVente, ...commandesAchat]);

  } catch (error) {
    console.error('❌ Error fetching commandes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/clients-department
router.get('/clients-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const clientsResult = await db.query(
      `SELECT 
        c.*,
        (SELECT COUNT(*) FROM commandes_vente WHERE id_client = c.id) as nombre_achats,
        (SELECT COALESCE(SUM(montant_total), 0) FROM commandes_vente WHERE id_client = c.id) as montant_total_achats,
        (SELECT COALESCE(SUM(montant_du), 0) FROM factures WHERE id_client = c.id AND type_facture = 'vente') as solde_du
       FROM clients c
       ORDER BY c.nom_client ASC`
    );
    const clients = Array.isArray(clientsResult) ? clientsResult : [];

    res.json(clients);

  } catch (error) {
    console.error('❌ Error fetching clients:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/fournisseurs-department
router.get('/fournisseurs-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const fournisseursResult = await db.query(
      `SELECT 
        f.*,
        (SELECT COUNT(*) FROM commandes_achat WHERE id_fournisseur = f.id) as nombre_achats,
        (SELECT COALESCE(SUM(montant_total), 0) FROM commandes_achat WHERE id_fournisseur = f.id) as montant_total_achats
       FROM fournisseurs f
       ORDER BY f.nom_fournisseur ASC`
    );
    const fournisseurs = Array.isArray(fournisseursResult) ? fournisseursResult : [];

    res.json(fournisseurs);

  } catch (error) {
    console.error('❌ Error fetching fournisseurs:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/stocks-department
router.get('/stocks-department', authorize('manager', 'admin'), async (req, res) => {
  try {
    const stocksResult = await db.query(
      `SELECT 
        s.*,
        (quantite_disponible - quantite_reservee) * cout_unitaire as valeur_stock
       FROM stocks s
       ORDER BY s.emplacement ASC`
    );
    const stocks = Array.isArray(stocksResult) ? stocksResult : [];

    res.json(stocks);

  } catch (error) {
    console.error('❌ Error fetching stocks:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ==================== FINANCIER ====================

// GET /api/manager/budget-overview
router.get('/budget-overview', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const budgetResult = await db.query(
      `SELECT 
        COALESCE(bd.budget_alloue, 0) as budget_alloue,
        (SELECT COALESCE(SUM(montant), 0) 
         FROM depenses_departement 
         WHERE id_departement = ? 
         AND YEAR(date_depense) = YEAR(CURDATE())) as total_depenses,
        (SELECT COALESCE(SUM(montant), 0) 
         FROM revenus_departement 
         WHERE id_departement = ? 
         AND MONTH(date_revenu) = MONTH(CURDATE())
         AND YEAR(date_revenu) = YEAR(CURDATE())) as total_revenus
       FROM budgets_departements bd
       WHERE bd.id_departement = ?
       AND bd.annee = YEAR(CURDATE())
       LIMIT 1`,
      [id_departement, id_departement, id_departement]
    );
    const budget = Array.isArray(budgetResult) ? budgetResult : [];

    if (!budget[0] || budget[0].budget_alloue === null) {
      return res.json({
        budget_alloue: 0,
        total_depenses: 0,
        total_revenus: 0,
        budget_disponible: 0,
        pourcentage_utilise: 0,
        pourcentage_disponible: 100
      });
    }

    const overview = {
      ...budget[0],
      budget_disponible: budget[0].budget_alloue - budget[0].total_depenses,
      pourcentage_utilise: budget[0].budget_alloue > 0 ? Math.round((budget[0].total_depenses / budget[0].budget_alloue) * 100) : 0,
      pourcentage_disponible: budget[0].budget_alloue > 0 ? Math.round(((budget[0].budget_alloue - budget[0].total_depenses) / budget[0].budget_alloue) * 100) : 100
    };

    res.json(overview);

  } catch (error) {
    console.error('❌ Error fetching budget overview:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/monthly-financial-trend - VERSION CORRIGÉE
router.get('/monthly-financial-trend', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { months = 6 } = req.query;

    console.log('📊 Récupération tendance financière pour département:', id_departement, 'mois:', months);

    // ✅ REQUÊTE 1: Dépenses
    const depensesResult = await db.query(
      `SELECT 
        DATE_FORMAT(date_depense, '%Y-%m') as mois,
        COALESCE(SUM(montant), 0) as depenses
       FROM depenses_departement
       WHERE id_departement = ?
       AND date_depense >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(date_depense, '%Y-%m')
       ORDER BY mois ASC`,
      [id_departement, parseInt(months)]
    );
    const depenses = Array.isArray(depensesResult) ? depensesResult : [];

    // ✅ REQUÊTE 2: Revenus
    const revenusResult = await db.query(
      `SELECT 
        DATE_FORMAT(date_revenu, '%Y-%m') as mois,
        COALESCE(SUM(montant), 0) as revenus
       FROM revenus_departement
       WHERE id_departement = ?
       AND date_revenu >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(date_revenu, '%Y-%m')
       ORDER BY mois ASC`,
      [id_departement, parseInt(months)]
    );
    const revenus = Array.isArray(revenusResult) ? revenusResult : [];

    // ✅ Fusionner les résultats
    const trend = depenses.map(d => {
      const r = revenus.find(rev => rev.mois === d.mois);
      return {
        mois: d.mois,
        depenses: parseFloat(d.depenses || 0),
        revenus: r ? parseFloat(r.revenus || 0) : 0
      };
    });

    // Ajouter revenus non présents dans dépenses
    revenus.forEach(r => {
      if (!trend.find(t => t.mois === r.mois)) {
        trend.push({
          mois: r.mois,
          depenses: 0,
          revenus: parseFloat(r.revenus || 0)
        });
      }
    });

    // Trier par mois
    trend.sort((a, b) => a.mois.localeCompare(b.mois));

    console.log('📊 Résultat final:', trend.length, 'mois');
    res.json(trend);

  } catch (error) {
    console.error('❌ Error fetching financial trend:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

// GET /api/manager/budget-details
router.get('/budget-details', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const budgetResult = await db.query(
      `SELECT * FROM budgets_departements
       WHERE id_departement = ?
       AND annee = YEAR(CURDATE())`,
      [id_departement]
    );
    const budget = Array.isArray(budgetResult) ? budgetResult : [];

    if (budget.length === 0 || !budget[0]) {
      return res.json(null);
    }

    // Récupération de la répartition par catégorie
    const categoriesResult = await db.query(
      `SELECT 
        categorie as nom,
        COALESCE(SUM(montant), 0) as montant_utilise,
        ? * 0.2 as montant_alloue
       FROM depenses_departement
       WHERE id_departement = ?
       AND YEAR(date_depense) = YEAR(CURDATE())
       GROUP BY categorie`,
      [budget[0].budget_alloue || 0, id_departement]
    );
    const categories = Array.isArray(categoriesResult) ? categoriesResult : [];

    const totalDepenses = categories.reduce((sum, cat) => sum + parseFloat(cat.montant_utilise || 0), 0);
    const budgetAlloue = parseFloat(budget[0].budget_alloue || 0);

    const details = {
      ...budget[0],
      total_depenses: totalDepenses,
      budget_disponible: budgetAlloue - totalDepenses,
      categories: categories
    };

    res.json(details);

  } catch (error) {
    console.error('❌ Error fetching budget details:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/budget-requests
router.get('/budget-requests', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;

    const requestsResult = await db.query(
      `SELECT * FROM demandes_budget
       WHERE id_departement = ?
       ORDER BY 
         CASE urgence
           WHEN 'urgent' THEN 1
           WHEN 'prioritaire' THEN 2
           ELSE 3
         END,
         date_demande DESC`,
      [id_departement]
    );
    const requests = Array.isArray(requestsResult) ? requestsResult : [];

    res.json(requests);

  } catch (error) {
    console.error('❌ Error fetching budget requests:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/budget-requests
router.post('/budget-requests', authorize('manager', 'admin'), async (req, res) => {
  let connection;

  try {
    const { id: managerId, id_departement } = req.user;
    const { montant_demande, categorie, justification, urgence } = req.body;

    if (!montant_demande || !categorie || !justification) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const resultInsert = await connection.query(
      `INSERT INTO demandes_budget 
       (id_departement, id_demandeur, montant_demande, categorie, justification, urgence, statut)
       VALUES (?, ?, ?, ?, ?, ?, 'en_attente')`,
      [id_departement, managerId, montant_demande, categorie, justification, urgence || 'normal']
    );
    const result = Array.isArray(resultInsert) ? resultInsert[0] : resultInsert;

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'finance', 'demande_budget', ?)`,
      [managerId, `Demande budget ${montant_demande} BIF - ${categorie}`]
    );

    // Notification admin
    const deptResult = await connection.query(
      `SELECT nom FROM departements WHERE id = ?`,
      [id_departement]
    );
    const dept = Array.isArray(deptResult) ? deptResult : [];

    const adminsResult = await connection.query(
      `SELECT id, nom_complet, email FROM utilisateurs WHERE role = 'admin' AND statut = 'actif'`
    );
    const admins = Array.isArray(adminsResult) ? adminsResult : [];

    for (const admin of admins) {
      await connection.query(
        `INSERT INTO notifications 
         (id_utilisateur, titre, message, type_notification, priorite, date_creation)
         VALUES (?, ?, ?, 'approbation', ?, NOW())`,
        [
          admin.id,
          'Nouvelle demande de budget',
          `Demande de ${montant_demande} BIF - ${categorie} - Département: ${dept[0]?.nom || 'Inconnu'}`,
          urgence === 'urgent' ? 'urgente' : urgence === 'prioritaire' ? 'haute' : 'normale'
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Demande de budget soumise'
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error submitting budget request:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/manager/department-expenses
router.get('/department-expenses', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const expensesResult = await db.query(
      `SELECT * FROM depenses_departement
       WHERE id_departement = ?
       AND MONTH(date_depense) = ?
       AND YEAR(date_depense) = ?
       ORDER BY date_depense DESC`,
      [id_departement, targetMonth, targetYear]
    );
    const expenses = Array.isArray(expensesResult) ? expensesResult : [];

    res.json(expenses);

  } catch (error) {
    console.error('❌ Error fetching expenses:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/expenses-by-category - VERSION CORRIGÉE
router.get('/expenses-by-category', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    console.log('📊 Dépenses par catégorie - Dept:', id_departement, `${targetMonth}/${targetYear}`);

    const categoriesResult = await db.query(
      `SELECT 
        categorie,
        COALESCE(SUM(montant), 0) as total,
        COUNT(*) as count
       FROM depenses_departement
       WHERE id_departement = ?
       AND MONTH(date_depense) = ?
       AND YEAR(date_depense) = ?
       GROUP BY categorie
       ORDER BY total DESC`,
      [id_departement, targetMonth, targetYear]
    );

    const result = Array.isArray(categoriesResult) ? categoriesResult : [];
    console.log('✅ Catégories:', result.length);
    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching expenses by category:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/department-revenues
router.get('/department-revenues', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const revenuesResult = await db.query(
      `SELECT * FROM revenus_departement
       WHERE id_departement = ?
       AND MONTH(date_revenu) = ?
       AND YEAR(date_revenu) = ?
       ORDER BY date_revenu DESC`,
      [id_departement, targetMonth, targetYear]
    );
    const revenues = Array.isArray(revenuesResult) ? revenuesResult : [];

    res.json(revenues);

  } catch (error) {
    console.error('❌ Error fetching revenues:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/department-revenues
router.post('/department-revenues', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();
  try {
    const { id: managerId, id_departement } = req.user;
    const {
      source,
      description,
      montant,
      date_revenu,
      id_client,
      reference,
      mode_paiement,
      categorie_mouvement,
      id_source,
      quantite
    } = req.body;

    // Validate required fields
    if (!montant || parseFloat(montant) <= 0) {
      return res.status(400).json({ error: 'Le montant est requis et doit être supérieur à 0' });
    }

    // Validate quantity for milk/egg sales
    if (['vente_lait', 'vente_oeufs'].includes(categorie_mouvement)) {
      if (!quantite || parseFloat(quantite) <= 0) {
        return res.status(400).json({ error: 'La quantité est requise pour les ventes de lait et d\'œufs' });
      }
    }

    await connection.beginTransaction();

    // 1. Check stock availability from production tables for milk/eggs
    if (['vente_lait', 'vente_oeufs'].includes(categorie_mouvement) && quantite > 0) {
      const type = categorie_mouvement === 'vente_lait' ? 'lait' : 'oeufs';

      let available = 0;
      if (type === 'lait') {
        const [production] = await connection.query(`
          SELECT COALESCE(SUM(quantite_litres), 0) as produit
          FROM productions_lait
          WHERE destination = 'vente' 
            AND date_production >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        const [sold] = await connection.query(`
          SELECT COALESCE(SUM(quantite), 0) as vendu
          FROM revenus_departement
          WHERE categorie_mouvement = 'vente_lait'
            AND date_revenu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        available = production[0].produit - sold[0].vendu;
      } else {
        const [production] = await connection.query(`
          SELECT COALESCE(SUM(nombre_oeufs - oeufs_casses - oeufs_sales), 0) as produit
          FROM productions_oeufs
          WHERE destination = 'vente'
            AND date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        const [sold] = await connection.query(`
          SELECT COALESCE(SUM(quantite), 0) as vendu
          FROM revenus_departement
          WHERE categorie_mouvement = 'vente_oeufs'
            AND date_revenu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        available = production[0].produit - sold[0].vendu;
      }

      if (quantite > available) {
        return res.status(400).json({
          error: `Stock insuffisant. Disponible: ${Math.max(0, available)} ${type === 'lait' ? 'litres' : 'unités'}`
        });
      }
    }

    // 2. Insérer dans revenus_departement
    const [result] = await connection.query(
      `INSERT INTO revenus_departement 
        (id_departement, source, description, montant, date_revenu, id_client, reference, enregistre_par, statut, categorie_mouvement, id_source, quantite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approuve', ?, ?, ?)`,
      [id_departement, source, description, montant, date_revenu || new Date(), id_client, reference, managerId, categorie_mouvement, id_source, quantite]
    );

    const revenueId = result.insertId;

    // 3. Log the transaction (stock management now via production tables)
    // No stock table updates needed - stock is calculated dynamically from production records

    // 3. Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details, table_affectee, id_enregistrement) 
       VALUES (?, 'finance', 'AJOUT_REVENU', ?, 'revenus_departement', ?)`,
      [managerId, `Ajout revenu: ${source} - ${montant} BIF`, revenueId]
    );

    await connection.commit();
    res.json({ success: true, id: revenueId, message: 'Revenu enregistré avec succès' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error creating revenue:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/manager/department-expenses
router.post('/department-expenses', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();
  try {
    const { id: managerId, id_departement } = req.user;
    const {
      categorie,
      description,
      montant,
      date_depense,
      reference,
      mode_paiement,
      piece_justificative
    } = req.body;

    // Validate required fields
    if (!montant || parseFloat(montant) <= 0) {
      return res.status(400).json({ error: 'Le montant est requis et doit être supérieur à 0' });
    }

    await connection.beginTransaction();

    // 1. Valider le budget (optionnel mais recommandé)
    const [budgetRows] = await connection.query(
      'SELECT budget_annuel FROM departements WHERE id = ?',
      [id_departement]
    );

    if (budgetRows && budgetRows.length > 0) {
      const budget = budgetRows[0].budget_annuel;
      const [spentRows] = await connection.query(
        'SELECT SUM(montant) as total FROM depenses_departement WHERE id_departement = ? AND statut != "rejete"',
        [id_departement]
      );
      const spent = spentRows[0].total || 0;

      // On peut ajouter une alerte si le budget est dépassé
      console.log(`Budget info - Total: ${budget}, Dépensé: ${spent}, Nouveau: ${montant}`);
    }

    // 2. Insérer dans depenses_departement
    const [result] = await connection.query(
      `INSERT INTO depenses_departement 
        (id_departement, categorie, description, montant, date_depense, reference, piece_justificative, effectue_par, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approuve')`,
      [id_departement, categorie, description, montant, date_depense || new Date(), reference, piece_justificative, managerId]
    );

    const expenseId = result.insertId;

    // 3. Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details, table_affectee, id_enregistrement) 
       VALUES (?, 'finance', 'AJOUT_DEPENSE', ?, 'depenses_departement', ?)`,
      [managerId, `Ajout dépense: ${categorie} - ${montant} BIF`, expenseId]
    );

    await connection.commit();
    res.json({ success: true, id: expenseId, message: 'Dépense enregistrée avec succès' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error creating expense:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/manager/revenues-by-source - VERSION CORRIGÉE
router.get('/revenues-by-source', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    console.log('📊 Revenus par source - Dept:', id_departement, `${targetMonth}/${targetYear}`);

    const sourcesResult = await db.query(
      `SELECT 
        source,
        COALESCE(SUM(montant), 0) as total,
        COUNT(*) as count
       FROM revenus_departement
       WHERE id_departement = ?
       AND MONTH(date_revenu) = ?
       AND YEAR(date_revenu) = ?
       GROUP BY source
       ORDER BY total DESC`,
      [id_departement, targetMonth, targetYear]
    );

    const result = Array.isArray(sourcesResult) ? sourcesResult : [];
    console.log('✅ Sources:', result.length);
    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching revenues by source:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/stock-info - Récupérer les informations de stock pour un type
router.get('/stock-info', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ error: 'Type de stock requis' });

    let quantite_disponible = 0;
    let unite_mesure = '';
    let emplacement = '';

    if (type === 'lait') {
      // Calculate milk production for vente in last 7 days
      const [production] = await db.query(`
        SELECT COALESCE(SUM(quantite_litres), 0) as produit
        FROM productions_lait
        WHERE destination = 'vente' 
          AND date_production >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `);

      // Calculate sold milk in last 7 days
      const [sold] = await db.query(`
        SELECT COALESCE(SUM(quantite), 0) as vendu
        FROM revenus_departement
        WHERE categorie_mouvement = 'vente_lait'
          AND date_revenu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `);

      quantite_disponible = production[0].produit - sold[0].vendu;
      unite_mesure = 'litre';
      emplacement = 'Réservoir principal';

    } else if (type === 'oeufs') {
      // Calculate net eggs for vente in last 7 days
      const [production] = await db.query(`
        SELECT COALESCE(SUM(nombre_oeufs - oeufs_casses - oeufs_sales), 0) as produit
        FROM productions_oeufs
        WHERE destination = 'vente'
          AND date_recolte >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `);

      // Calculate sold eggs in last 7 days
      const [sold] = await db.query(`
        SELECT COALESCE(SUM(quantite), 0) as vendu
        FROM revenus_departement
        WHERE categorie_mouvement = 'vente_oeufs'
          AND date_revenu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `);

      quantite_disponible = production[0].produit - sold[0].vendu;
      unite_mesure = 'unite';
      emplacement = 'Entrepôt';

    } else {
      return res.status(400).json({ error: 'Type de stock non pris en charge' });
    }

    res.json({
      quantite_disponible: Math.max(0, quantite_disponible), // Ensure non-negative
      unite_mesure,
      emplacement
    });
  } catch (error) {
    console.error('❌ Error fetching stock info:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/manager/payment-requests/:id/send-verification-code - Envoyer code de vérification pour paiement
router.post('/payment-requests/:id/send-verification-code', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id: managerId, id_departement } = req.user;
    const { id: requestId } = req.params;

    // Récupérer les infos de la demande et de l'employé
    const [request] = await db.query(
      `SELECT r.*, u.nom_complet, u.email 
       FROM demandes_paiement_salaire r
       JOIN utilisateurs u ON r.id_employe = u.id
       WHERE r.id = ? AND u.id_departement = ?`,
      [requestId, id_departement]
    );

    if (!request || request.length === 0) {
      return res.status(404).json({ error: 'Demande de paiement non trouvée' });
    }

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Mettre à jour la demande avec le code
    await db.query(
      'UPDATE demandes_paiement_salaire SET code_verification = ?, date_envoi_code = NOW() WHERE id = ?',
      [code, requestId]
    );

    // Envoyer l'email
    const emailService = require('../emailService');
    const result = await emailService.envoyerCodeVerification(
      request[0].email,
      code,
      request[0].nom_complet,
      request[0].mois,
      request[0].annee
    );

    if (result.success) {
      // Trace
      await db.query(
        'INSERT INTO traces (id_utilisateur, module, type_action, action_details) VALUES (?, ?, ?, ?)',
        [managerId, 'rh', 'envoi_code_verification', `Code envoyé à ${request[0].nom_complet} pour demande ID ${requestId}`]
      );

      res.json({ success: true, message: 'Code de vérification envoyé avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email', details: result.error });
    }
  } catch (error) {
    console.error('❌ Error sending verification code:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/generate-financial-report
router.post('/generate-financial-report', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { type = 'complete', format = 'excel', periode = 'current_month' } = req.body;

    // Validation
    const validFormats = ['excel', 'pdf'];
    const validTypes = ['complete', 'budget', 'expenses', 'revenues', 'rh'];

    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: 'Format invalide' });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type de rapport invalide' });
    }

    // Déterminer la période
    let dateCondition = '';
    if (periode === 'current_month') {
      dateCondition = 'AND MONTH(date_depense) = MONTH(CURDATE()) AND YEAR(date_depense) = YEAR(CURDATE())';
    } else if (periode === 'last_month') {
      dateCondition = 'AND MONTH(date_depense) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(date_depense) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))';
    } else if (periode === 'current_quarter') {
      dateCondition = 'AND QUARTER(date_depense) = QUARTER(CURDATE()) AND YEAR(date_depense) = YEAR(CURDATE())';
    } else if (periode === 'current_year') {
      dateCondition = 'AND YEAR(date_depense) = YEAR(CURDATE())';
    }

    // Récupérer les données
    const deptResult = await db.query('SELECT * FROM departements WHERE id = ?', [id_departement]);
    const dept = Array.isArray(deptResult) ? deptResult : [];

    const budgetResult = await db.query(
      'SELECT * FROM budgets_departements WHERE id_departement = ? AND annee = YEAR(CURDATE())',
      [id_departement]
    );
    const budget = Array.isArray(budgetResult) ? budgetResult : [];

    const depensesResult = await db.query(
      `SELECT * FROM depenses_departement WHERE id_departement = ? ${dateCondition} ORDER BY date_depense DESC`,
      [id_departement]
    );
    const depenses = Array.isArray(depensesResult) ? depensesResult : [];

    const revenusResult = await db.query(
      `SELECT * FROM revenus_departement WHERE id_departement = ? ${dateCondition.replace(/date_depense/g, 'date_revenu')} ORDER BY date_revenu DESC`,
      [id_departement]
    );
    const revenus = Array.isArray(revenusResult) ? revenusResult : [];

    // Calculs
    const totalBrut = depenses.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
    const totalNet = revenus.reduce((sum, r) => sum + parseFloat(r.montant || 0), 0);
    const solde = totalNet - totalBrut;
    const budgetAlloue = budget[0]?.budget_alloue || 0;
    const tauxUtilisation = budgetAlloue > 0 ? ((totalBrut / budgetAlloue) * 100).toFixed(2) : 0;

    // Créer le dossier reports
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const fileName = `Rapport_${type}_${dept[0]?.nom || 'Dept'}_${periode}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const filePath = path.join(reportsDir, fileName);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'NUTRIFIX';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Résumé Financier');

      // En-tête
      sheet.mergeCells('A1:F1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `RAPPORT FINANCIER - ${dept[0]?.nom?.toUpperCase() || 'DÉPARTEMENT'}`;
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 30;

      // Informations
      sheet.getCell('A3').value = 'Période:';
      sheet.getCell('B3').value = periode;
      sheet.getCell('A4').value = 'Date de génération:';
      sheet.getCell('B4').value = new Date().toLocaleDateString('fr-FR');
      ['A3', 'A4'].forEach(c => { sheet.getCell(c).font = { bold: true }; });

      // KPIs
      sheet.getCell('A6').value = 'INDICATEURS CLÉS';
      sheet.getCell('A6').font = { size: 14, bold: true };

      const kpis = [
        ['Budget Alloué', budgetAlloue, 'FF3498DB'],
        ['Total Dépenses', totalBrut, 'FFE74C3C'],
        ['Total Revenus', totalNet, 'FF2ECC71'],
        ['Solde', solde, solde >= 0 ? 'FF2ECC71' : 'FFE74C3C'],
        ['Taux Utilisation Budget', parseFloat(tauxUtilisation), 'FFF39C12']
      ];

      let row = 8;
      kpis.forEach(([label, value, color]) => {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`B${row}`).value = parseFloat(value);
        sheet.getCell(`C${row}`).value = 'BIF';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).font = { bold: true, color: { argb: color } };
        sheet.getCell(`B${row}`).numFmt = '#,##0.00';
        row++;
      });

      // Feuille Dépenses
      const sheetDepenses = workbook.addWorksheet('Dépenses');
      const headersD = ['Date', 'Catégorie', 'Description', 'Montant'];
      headersD.forEach((h, i) => {
        const cell = sheetDepenses.getCell(1, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
      });

      depenses.forEach((d, i) => {
        const r = i + 2;
        sheetDepenses.getCell(r, 1).value = new Date(d.date_depense);
        sheetDepenses.getCell(r, 1).numFmt = 'dd/mm/yyyy';
        sheetDepenses.getCell(r, 2).value = d.categorie;
        sheetDepenses.getCell(r, 3).value = d.description;
        sheetDepenses.getCell(r, 4).value = parseFloat(d.montant);
        sheetDepenses.getCell(r, 4).numFmt = '#,##0.00';
      });

      // Feuille Revenus
      const sheetRevenus = workbook.addWorksheet('Revenus');
      const headersR = ['Date', 'Source', 'Description', 'Montant'];
      headersR.forEach((h, i) => {
        const cell = sheetRevenus.getCell(1, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } };
      });

      revenus.forEach((r, i) => {
        const row = i + 2;
        sheetRevenus.getCell(row, 1).value = new Date(r.date_revenu);
        sheetRevenus.getCell(row, 1).numFmt = 'dd/mm/yyyy';
        sheetRevenus.getCell(row, 2).value = r.source;
        sheetRevenus.getCell(row, 3).value = r.description;
        sheetRevenus.getCell(row, 4).value = parseFloat(r.montant);
        sheetRevenus.getCell(row, 4).numFmt = '#,##0.00';
      });

      // Largeurs
      [sheet, sheetDepenses, sheetRevenus].forEach(s => {
        s.getColumn(1).width = 20;
        s.getColumn(2).width = 25;
        s.getColumn(3).width = 40;
        s.getColumn(4).width = 18;
      });

      await workbook.xlsx.writeFile(filePath);

    } else {
      // Génération PDF
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(28).fillColor('#2E86C1').text('NUTRIFIX', { align: 'center' });
      doc.moveDown();
      doc.fontSize(22).fillColor('#2C3E50').text('RAPPORT FINANCIER', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(16).fillColor('#34495E').text((dept[0]?.nom || 'DÉPARTEMENT').toUpperCase(), { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).fillColor('#7F8C8D').text(`Période: ${periode}`, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });

      doc.moveDown(3);
      const kpisPDF = [
        { label: 'Budget Alloué', value: budgetAlloue, color: '#3498DB' },
        { label: 'Dépenses', value: totalBrut, color: '#E74C3C' },
        { label: 'Revenus', value: totalNet, color: '#2ECC71' },
        { label: 'Solde', value: solde, color: solde >= 0 ? '#2ECC71' : '#E74C3C' }
      ];

      let y = doc.y;
      kpisPDF.forEach((kpi, i) => {
        const x = 80 + (i % 2) * 250;
        if (i === 2) y += 80;
        doc.fontSize(10).fillColor('#95A5A6').text(kpi.label, x, y);
        doc.fontSize(20).fillColor(kpi.color).text(`${kpi.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} BIF`, x, y + 15);
      });

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    }

    // Lire et encoder
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    res.json({
      success: true,
      message: 'Rapport généré avec succès',
      fileName: fileName,
      format: format,
      data: base64Data
    });

  } catch (error) {
    console.error('❌ Error generating report:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du rapport',
      details: error.message
    });
  }
});
// ==================== GESTION AVANCÉE DES SALAIRES ====================
// GET /api/manager/salaries-overview - VERSION CORRIGÉE
router.get('/salaries-overview', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    console.log('📊 Salaires aperçu - Dept:', id_departement, `${targetMonth}/${targetYear}`);

    // ✅ Statistiques globales
    const [stats] = await db.query(
      `SELECT 
        COUNT(DISTINCT s.id_utilisateur) as total_employes,
        COUNT(CASE WHEN s.statut_paiement = 'payé' THEN 1 END) as employes_payes,
        COUNT(CASE WHEN s.statut_paiement = 'calculé' THEN 1 END) as employes_non_payes,
        COUNT(CASE WHEN s.confirme_reception = 1 THEN 1 END) as confirmations_reception,
        COUNT(CASE WHEN s.demande_paiement_envoyee = 1 THEN 1 END) as demandes_paiement,
        COALESCE(SUM(s.salaire_brut), 0) as total_brut,
        COALESCE(SUM(s.salaire_net), 0) as total_net,
        COALESCE(SUM(s.deduction_inss), 0) as total_inss,
        COALESCE(SUM(CASE WHEN s.statut_paiement = 'payé' THEN s.salaire_net ELSE 0 END), 0) as montant_paye,
        COALESCE(SUM(CASE WHEN s.statut_paiement = 'calculé' THEN s.salaire_net ELSE 0 END), 0) as montant_restant
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?`,
      [id_departement, targetMonth, targetYear]
    );

    // ✅ Répartition par type d'employé
    const repartition = await db.query(
      `SELECT 
        u.type_employe,
        COUNT(*) as nombre,
        COALESCE(SUM(s.salaire_net), 0) as total_net,
        COUNT(CASE WHEN s.statut_paiement = 'payé' THEN 1 END) as payes,
        COUNT(CASE WHEN s.statut_paiement = 'calculé' THEN 1 END) as non_payes
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       GROUP BY u.type_employe`,
      [id_departement, targetMonth, targetYear]
    );

    // ✅ Demandes de paiement en attente
    const [demandesEnAttente] = await db.query(
      `SELECT COUNT(*) as total
       FROM demandes_paiement_salaire dps
       JOIN utilisateurs u ON dps.id_employe = u.id
       WHERE u.id_departement = ?
       AND dps.mois = ? AND dps.annee = ?
       AND dps.statut = 'en_attente'`,
      [id_departement, targetMonth, targetYear]
    );

    console.log('✅ Aperçu récupéré');
    res.json({
      stats: (stats && stats[0]) ? stats[0] : {
        total_employes: 0,
        employes_payes: 0,
        employes_non_payes: 0,
        confirmations_reception: 0,
        demandes_paiement: 0,
        total_brut: 0,
        total_net: 0,
        total_inss: 0,
        montant_paye: 0,
        montant_restant: 0
      },
      repartition: repartition || [],
      demandes_en_attente: (demandesEnAttente && demandesEnAttente[0]) ? demandesEnAttente[0].total : 0,
      periode: { mois: targetMonth, annee: targetYear }
    });

  } catch (error) {
    console.error('Error fetching salaries overview:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/salaries-detailed - Liste détaillée avec filtres avancés
router.get('/salaries-detailed', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const {
      month,
      year,
      type_employe,
      statut_paiement,
      confirme_reception,
      demande_paiement,
      search
    } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo,
        u.type_employe,
        u.email,
        u.telephone,
        u.compte_bancaire,
        u.nom_banque,
        (SELECT COUNT(*) FROM demandes_paiement_salaire 
         WHERE id_salaire = s.id AND statut = 'en_attente') as has_demande_paiement,
        (SELECT COUNT(*) FROM confirmations_reception_salaire 
         WHERE id_salaire = s.id AND confirme = 1) as has_confirmation,
        DATEDIFF(NOW(), s.date_calcul) as jours_depuis_calcul,
        CASE 
          WHEN s.statut_paiement = 'payé' AND s.date_paiement IS NOT NULL 
          THEN DATEDIFF(s.date_paiement, s.date_calcul)
          ELSE NULL 
        END as delai_paiement
      FROM salaires s
      JOIN utilisateurs u ON s.id_utilisateur = u.id
      WHERE u.id_departement = ?
      AND s.mois = ? AND s.annee = ?
    `;

    const params = [id_departement, targetMonth, targetYear];

    // Filtres
    if (type_employe && type_employe !== 'all') {
      query += ' AND u.type_employe = ?';
      params.push(type_employe);
    }

    if (statut_paiement && statut_paiement !== 'all') {
      query += ' AND s.statut_paiement = ?';
      params.push(statut_paiement);
    }

    if (confirme_reception === 'true') {
      query += ' AND s.confirme_reception = 1';
    } else if (confirme_reception === 'false') {
      query += ' AND s.confirme_reception = 0';
    }

    if (demande_paiement === 'true') {
      query += ' AND s.demande_paiement_envoyee = 1';
    } else if (demande_paiement === 'false') {
      query += ' AND s.demande_paiement_envoyee = 0';
    }

    if (search) {
      query += ' AND (u.nom_complet LIKE ? OR u.matricule LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY u.nom_complet ASC';

    const salaries = await db.query(query, params);

    res.json(salaries);

  } catch (error) {
    console.error('Error fetching detailed salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/salaries-not-paid - Employés non payés
router.get('/salaries-not-paid', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const notPaid = await db.query(
      `SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo,
        u.type_employe,
        u.email,
        u.telephone,
        u.compte_bancaire,
        u.nom_banque,
        DATEDIFF(NOW(), s.date_calcul) as jours_attente,
        (SELECT COUNT(*) FROM demandes_paiement_salaire 
         WHERE id_salaire = s.id AND statut = 'en_attente') as has_demande_paiement
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       AND s.statut_paiement IN ('calculé', 'reporté')
       ORDER BY 
         CASE WHEN s.demande_paiement_envoyee = 1 THEN 0 ELSE 1 END,
         s.date_calcul ASC`,
      [id_departement, targetMonth, targetYear]
    );

    res.json(notPaid);

  } catch (error) {
    console.error('Error fetching unpaid salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/salaries-paid - Employés déjà payés
router.get('/salaries-paid', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const paid = await db.query(
      `SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo,
        u.type_employe,
        u.email,
        u.telephone,
        u.compte_bancaire,
        u.nom_banque,
        s.mode_paiement,
        s.reference_paiement,
        s.date_paiement,
        s.confirme_reception,
        s.date_confirmation_reception,
        DATEDIFF(s.date_paiement, s.date_calcul) as delai_paiement,
        (SELECT confirme FROM confirmations_reception_salaire 
         WHERE id_salaire = s.id LIMIT 1) as reception_confirmee
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       AND s.statut_paiement = 'payé'
       ORDER BY s.date_paiement DESC`,
      [id_departement, targetMonth, targetYear]
    );

    res.json(paid);

  } catch (error) {
    console.error('Error fetching paid salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/salaries-with-reception-confirmation - Salaires avec confirmation de réception
router.get('/salaries-with-reception-confirmation', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const confirmed = await db.query(
      `SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo,
        u.type_employe,
        crs.confirme,
        crs.date_confirmation,
        crs.methode_confirmation,
        crs.code_verification_utilise
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       LEFT JOIN confirmations_reception_salaire crs ON s.id = crs.id_salaire
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       AND crs.confirme = 1
       ORDER BY crs.date_confirmation DESC`,
      [id_departement, targetMonth, targetYear]
    );

    res.json(confirmed);

  } catch (error) {
    console.error('Error fetching confirmed salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/salaries-without-confirmation - Salaires sans confirmation
router.get('/salaries-without-confirmation', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const notConfirmed = await db.query(
      `SELECT 
        s.*,
        u.nom_complet as employee_name,
        u.matricule,
        u.photo_identite as employee_photo,
        u.type_employe,
        u.email,
        u.telephone,
        DATEDIFF(NOW(), s.date_paiement) as jours_depuis_paiement
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       AND s.statut_paiement = 'payé'
       AND s.confirme_reception = 0
       AND NOT EXISTS (
         SELECT 1 FROM confirmations_reception_salaire 
         WHERE id_salaire = s.id AND confirme = 1
       )
       ORDER BY s.date_paiement ASC`,
      [id_departement, targetMonth, targetYear]
    );

    res.json(notConfirmed);

  } catch (error) {
    console.error('Error fetching unconfirmed salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/manager/payment-requests - Demandes de paiement de salaire
router.get('/payment-requests', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { statut = 'en_attente', month, year } = req.query;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    let query = `
      SELECT 
        dps.*,
        u.nom_complet as employe_nom,
        u.matricule,
        u.photo_identite as employe_photo,
        u.type_employe,
        u.email,
        u.telephone,
        s.salaire_net,
        s.statut_paiement as statut_salaire,
        DATEDIFF(NOW(), dps.date_demande) as jours_attente
       FROM demandes_paiement_salaire dps
       JOIN utilisateurs u ON dps.id_employe = u.id
       JOIN salaires s ON dps.id_salaire = s.id
       WHERE u.id_departement = ?
       AND dps.mois = ? AND dps.annee = ?
    `;

    const params = [id_departement, targetMonth, targetYear];

    if (statut && statut !== 'all') {
      query += ' AND dps.statut = ?';
      params.push(statut);
    }

    query += ' ORDER BY dps.date_demande DESC';

    const requests = await db.query(query, params);

    res.json(requests);

  } catch (error) {
    console.error('Error fetching payment requests:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/salaries/:id/pay - Payer un salaire
router.post('/salaries/:id/pay', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: salaryId } = req.params;
    const { mode_paiement, reference_paiement, date_paiement, notes } = req.body;

    if (!mode_paiement) {
      return res.status(400).json({ error: 'Mode de paiement requis' });
    }

    await connection.beginTransaction();

    // Vérifier que le salaire appartient au département
    const [salary] = await connection.query(
      `SELECT s.*, u.nom_complet, u.email, u.telephone 
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND u.id_departement = ?`,
      [salaryId, id_departement]
    );

    if (salary.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Salaire non trouvé' });
    }

    if (salary[0].statut_paiement === 'payé') {
      await connection.rollback();
      return res.status(400).json({ error: 'Ce salaire a déjà été payé' });
    }

    const paymentDate = date_paiement || new Date().toISOString().split('T')[0];
    const reference = reference_paiement || `PAY-${Date.now()}`;

    // Mettre à jour le salaire
    await connection.query(
      `UPDATE salaires 
       SET statut_paiement = 'payé',
           date_paiement = ?,
           mode_paiement = ?,
           reference_paiement = ?,
           valide_par = ?,
           date_validation = NOW()
       WHERE id = ?`,
      [paymentDate, mode_paiement, reference, managerId, salaryId]
    );

    // Créer une notification pour l'employé
    await connection.query(
      `INSERT INTO notifications 
       (id_utilisateur, titre, message, type_notification, priorite, date_creation)
       VALUES (?, ?, ?, 'paiement', 'haute', NOW())`,
      [
        salary[0].id_utilisateur,
        'Salaire payé',
        `Votre salaire de ${salary[0].mois}/${salary[0].annee} a été payé (${salary[0].salaire_net} BIF). Réf: ${reference}`
      ]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details, table_affectee, id_enregistrement)
       VALUES (?, 'rh', 'paiement_salaire', ?, 'salaires', ?)`,
      [
        managerId,
        `Paiement salaire ${salary[0].nom_complet} - ${salary[0].mois}/${salary[0].annee} - ${salary[0].salaire_net} BIF`,
        salaryId
      ]
    );

    // Si une demande de paiement existe, l'approuver
    await connection.query(
      `UPDATE demandes_paiement_salaire 
       SET statut = 'approuve',
           traite_par = ?,
           date_traitement = NOW(),
           commentaire = ?
       WHERE id_salaire = ? AND statut = 'en_attente'`,
      [managerId, notes || 'Paiement effectué', salaryId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Salaire payé avec succès',
      data: {
        id: salaryId,
        reference: reference,
        montant: salary[0].salaire_net,
        employe: salary[0].nom_complet,
        date_paiement: paymentDate
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error paying salary:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/manager/salaries/:id/mark-unpaid-debt - Marquer un salaire comme dette impayée (Temps Partiel)
router.post('/salaries/:id/mark-unpaid-debt', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: salaryId } = req.params;
    const { notes } = req.body;

    await connection.beginTransaction();

    // 1. Récupérer les infos du salaire et de l'employé
    const [salary] = await connection.query(
      `SELECT s.*, u.nom_complet, u.email, u.telephone, u.type_employe
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND u.id_departement = ?`,
      [salaryId, id_departement]
    );

    if (salary.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Salaire non trouvé' });
    }

    if (salary[0].statut_paiement === 'payé') {
      await connection.rollback();
      return res.status(400).json({ error: 'Ce salaire a déjà été payé' });
    }

    // 2. Mettre à jour le salaire avec un marqueur de dette
    const unpaidNote = `[DETTE] Impayé lors de l'encaissement le ${new Date().toLocaleDateString()}. ${notes || ''}`;

    await connection.query(
      `UPDATE salaires 
       SET statut_paiement = 'calculé',
           notes = ?,
           valide_par = ?,
           date_validation = NOW()
       WHERE id = ?`,
      [unpaidNote, managerId, salaryId]
    );

    // 3. Notification système pour l'employé
    const notificationMessage = `Votre séance du ${new Date(salary[0].date_calcul).toLocaleDateString()} (${salary[0].salaire_net} BIF) est validée mais le paiement est différé. Ce montant est ajouté à votre solde "À récupérer".`;

    await connection.query(
      `INSERT INTO notifications 
       (id_utilisateur, titre, message, type_notification, priorite, date_creation)
       VALUES (?, ?, ?, 'paiement', 'haute', NOW())`,
      [
        salary[0].id_utilisateur,
        'Paiement différé (À récupérer)',
        notificationMessage
      ]
    );

    // 4. Envoi Email via EmailService
    const EmailService = require('../emailService');
    const emailService = new EmailService();
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@nutrifix.bi';

    try {
      await emailService.envoyerNotificationImpayeJournalier(
        salary[0].email,
        adminEmail,
        salary[0].nom_complet,
        salary[0].salaire_net,
        salary[0].date_calcul
      );
    } catch (emailErr) {
      console.error('❌ Erreur envoi email impayé:', emailErr);
    }

    // 5. Trace d'audit
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details, table_affectee, id_enregistrement)
       VALUES (?, 'rh', 'marquage_dette_salaire', ?, 'salaires', ?)`,
      [
        managerId,
        `Marquage comme dette : salaire ${salary[0].nom_complet} du ${new Date(salary[0].date_calcul).toLocaleDateString()} - ${salary[0].salaire_net} BIF`,
        salaryId
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Salaire marqué comme dette avec succès',
      data: {
        id: salaryId,
        montant: salary[0].salaire_net,
        employe: salary[0].nom_complet
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error marking salary as debt:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/manager/salaries/pay-multiple - Payer plusieurs salaires
router.post('/salaries/pay-multiple', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();

  try {
    const { id: managerId, id_departement } = req.user;
    const { salary_ids, mode_paiement, date_paiement, notes } = req.body;

    if (!salary_ids || !Array.isArray(salary_ids) || salary_ids.length === 0) {
      return res.status(400).json({ error: 'IDs de salaires invalides' });
    }

    if (!mode_paiement) {
      return res.status(400).json({ error: 'Mode de paiement requis' });
    }

    await connection.beginTransaction();

    // Vérifier que tous les salaires appartiennent au département
    const [salaries] = await connection.query(`SELECT s.id, s.id_utilisateur, s.salaire_net, s.statut_paiement, u.nom_complet
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id IN (?) AND u.id_departement = ?`,
      [salary_ids, id_departement]
    );

    if (salaries.length !== salary_ids.length) {
      await connection.rollback();
      return res.status(403).json({ error: 'Accès non autorisé à certains salaires' });
    }

    // Vérifier qu'aucun n'est déjà payé
    const alreadyPaid = salaries.filter(s => s.statut_paiement === 'payé');
    if (alreadyPaid.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Certains salaires sont déjà payés',
        already_paid: alreadyPaid.map(s => ({ id: s.id, nom: s.nom_complet }))
      });
    }

    const paymentDate = date_paiement || new Date().toISOString().split('T')[0];
    const baseReference = `PAY-BATCH-${Date.now()}`;

    const results = [];
    let totalAmount = 0;

    for (const salary of salaries) {
      const reference = `${baseReference}-${salary.id}`;

      // Mettre à jour le salaire
      await connection.query(
        `UPDATE salaires 
         SET statut_paiement = 'payé',
             date_paiement = ?,
             mode_paiement = ?,
             reference_paiement = ?,
             valide_par = ?,
             date_validation = NOW()
         WHERE id = ?`,
        [paymentDate, mode_paiement, reference, managerId, salary.id]
      );

      // Notification
      await connection.query(
        `INSERT INTO notifications 
         (id_utilisateur, titre, message, type_notification, priorite, date_creation)
         VALUES (?, ?, ?, 'paiement', 'haute', NOW())`,
        [
          salary.id_utilisateur,
          'Salaire payé',
          `Votre salaire a été payé (${salary.salaire_net} BIF). Réf: ${reference}`
        ]
      );

      // Approuver les demandes de paiement
      await connection.query(
        `UPDATE demandes_paiement_salaire 
         SET statut = 'approuve',
             traite_par = ?,
             date_traitement = NOW(),
             commentaire = ?
         WHERE id_salaire = ? AND statut = 'en_attente'`,
        [managerId, notes || 'Paiement groupé effectué', salary.id]
      );

      results.push({
        id: salary.id,
        nom: salary.nom_complet,
        montant: salary.salaire_net,
        reference: reference
      });

      totalAmount += parseFloat(salary.salaire_net);
    }

    // Trace globale
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'paiement_salaire_multiple', ?)`,
      [
        managerId,
        `Paiement groupé de ${salary_ids.length} salaires - Total: ${totalAmount} BIF`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `${salary_ids.length} salaire(s) payé(s) avec succès`,
      data: {
        count: salary_ids.length,
        total_amount: totalAmount,
        mode_paiement: mode_paiement,
        date_paiement: paymentDate,
        base_reference: baseReference,
        details: results
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error paying multiple salaries:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/manager/payment-requests/:id/process - Traiter une demande de paiement
router.post('/payment-requests/:id/process', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: requestId } = req.params;
    const { action, commentaire, mode_paiement, date_paiement } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' });
    }

    await connection.beginTransaction();

    // Vérifier que la demande appartient au département
    const [request] = await connection.query(
      `SELECT dps.*, u.nom_complet, s.salaire_net
       FROM demandes_paiement_salaire dps
       JOIN utilisateurs u ON dps.id_employe = u.id
       JOIN salaires s ON dps.id_salaire = s.id
       WHERE dps.id = ? AND u.id_departement = ?`,
      [requestId, id_departement]
    );

    if (request.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    if (request[0].statut !== 'en_attente') {
      await connection.rollback();
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    if (action === 'approve') {
      // Approuver et payer
      const paymentDate = date_paiement || new Date().toISOString().split('T')[0];
      const reference = `PAY-REQ-${requestId}-${Date.now()}`;

      // Mettre à jour la demande
      await connection.query(
        `UPDATE demandes_paiement_salaire 
         SET statut = 'approuve',
             traite_par = ?,
             date_traitement = NOW(),
             commentaire = ?
         WHERE id = ?`,
        [managerId, commentaire || 'Demande approuvée et paiement effectué', requestId]
      );

      // Payer le salaire
      await connection.query(
        `UPDATE salaires 
         SET statut_paiement = 'payé',
             date_paiement = ?,
             mode_paiement = ?,
             reference_paiement = ?,
             valide_par = ?,
             date_validation = NOW()
         WHERE id = ?`,
        [paymentDate, mode_paiement || 'virement', reference, managerId, request[0].id_salaire]
      );

      // Notification
      await connection.query(
        `INSERT INTO notifications 
         (id_utilisateur, titre, message, type_notification, priorite, date_creation)
         VALUES (?, ?, ?, 'paiement', 'haute', NOW())`,
        [
          request[0].id_employe,
          'Demande de paiement approuvée',
          `Votre demande de paiement a été approuvée. Montant: ${request[0].montant} BIF. Réf: ${reference}`
        ]
      );

    } else {
      // Rejeter
      await connection.query(
        `UPDATE demandes_paiement_salaire 
         SET statut = 'rejete',
             traite_par = ?,
             date_traitement = NOW(),
             motif_rejet = ?,
             commentaire = ?
         WHERE id = ?`,
        [managerId, commentaire || 'Demande rejetée', commentaire, requestId]
      );

      // Notification
      await connection.query(
        `INSERT INTO notifications 
         (id_utilisateur, titre, message, type_notification, priorite, date_creation)
         VALUES (?, ?, ?, 'systeme', 'normale', NOW())`,
        [
          request[0].id_employe,
          'Demande de paiement rejetée',
          `Votre demande de paiement a été rejetée. Raison: ${commentaire || 'Non précisée'}`
        ]
      );
    }

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'traitement_demande_paiement', ?)`,
      [
        managerId,
        `${action === 'approve' ? 'Approbation' : 'Rejet'} demande paiement ${request[0].nom_complet}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Demande ${action === 'approve' ? 'approuvée et payée' : 'rejetée'}`
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error processing payment request:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/manager/salaries/:id/send-reminder - Envoyer un rappel de confirmation
router.post('/salaries/:id/send-reminder', authorize('manager', 'admin'), async (req, res) => {
  const connection = await db.pool.getConnection();

  try {
    const { id: managerId, id_departement } = req.user;
    const { id: salaryId } = req.params;

    await connection.beginTransaction();

    // Vérifier que le salaire appartient au département
    const [salary] = await connection.query(
      `SELECT s.*, u.nom_complet, u.email, u.telephone 
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE s.id = ? AND u.id_departement = ?`,
      [salaryId, id_departement]
    );

    if (salary.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Salaire non trouvé' });
    }

    if (salary[0].statut_paiement !== 'payé') {
      await connection.rollback();
      return res.status(400).json({ error: 'Ce salaire n\'a pas encore été payé' });
    }

    if (salary[0].confirme_reception === 1) {
      await connection.rollback();
      return res.status(400).json({ error: 'La réception a déjà été confirmée' });
    }

    // Créer une notification de rappel
    await connection.query(
      `INSERT INTO notifications 
       (id_utilisateur, titre, message, type_notification, priorite, date_creation)
       VALUES (?, ?, ?, 'rappel', 'haute', NOW())`,
      [
        salary[0].id_utilisateur,
        'Rappel: Confirmez la réception de votre salaire',
        `Veuillez confirmer la réception de votre salaire de ${salary[0].mois}/${salary[0].annee} (${salary[0].salaire_net} BIF). Réf: ${salary[0].reference_paiement}`
      ]
    );

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'rh', 'rappel_confirmation', ?)`,
      [managerId, `Rappel confirmation salaire ${salary[0].nom_complet}`]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Rappel envoyé avec succès'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    connection.release();
  }
});

// GET /api/manager/salary-statistics - VERSION CORRIGÉE
router.get('/salary-statistics', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { year } = req.query;

    const targetYear = year || new Date().getFullYear();

    console.log('📊 Statistiques salaires - Dept:', id_departement, 'Année:', targetYear);

    // ✅ Évolution mensuelle
    const monthlyEvolution = await db.query(
      `SELECT 
        s.mois,
        COUNT(*) as nombre_employes,
        COALESCE(SUM(s.salaire_brut), 0) as total_brut,
        COALESCE(SUM(s.salaire_net), 0) as total_net,
        COALESCE(SUM(s.deduction_inss), 0) as total_inss,
        COUNT(CASE WHEN s.statut_paiement = 'payé' THEN 1 END) as payes,
        COUNT(CASE WHEN s.confirme_reception = 1 THEN 1 END) as confirmes,
        AVG(CASE WHEN s.statut_paiement = 'payé' AND s.date_paiement IS NOT NULL AND s.date_calcul IS NOT NULL 
            THEN DATEDIFF(s.date_paiement, s.date_calcul) END) as delai_moyen_paiement
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.annee = ?
       GROUP BY s.mois
       ORDER BY s.mois ASC`,
      [id_departement, targetYear]
    );

    // ✅ Comparaison par type d'employé
    const byType = await db.query(
      `SELECT 
        u.type_employe,
        COUNT(DISTINCT s.id_utilisateur) as nombre_employes,
        AVG(s.salaire_brut) as salaire_brut_moyen,
        AVG(s.salaire_net) as salaire_net_moyen,
        SUM(s.salaire_net) as total_annuel
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.annee = ?
       GROUP BY u.type_employe`,
      [id_departement, targetYear]
    );

    // ✅ Taux de confirmation
    const [confirmationRate] = await db.query(
      `SELECT 
        COUNT(*) as total_salaires_payes,
        COUNT(CASE WHEN s.confirme_reception = 1 THEN 1 END) as total_confirmes,
        ROUND(COUNT(CASE WHEN s.confirme_reception = 1 THEN 1 END) * 100.0 / GREATEST(COUNT(*), 1), 2) as taux_confirmation
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.annee = ?
       AND s.statut_paiement = 'payé'`,
      [id_departement, targetYear]
    );

    console.log('✅ Statistiques récupérées');
    res.json({
      annee: targetYear,
      evolution_mensuelle: monthlyEvolution || [],
      par_type_employe: byType || [],
      taux_confirmation: confirmationRate[0] || {
        total_salaires_payes: 0,
        total_confirmes: 0,
        taux_confirmation: 0
      }
    });

  } catch (error) {
    console.error('Error fetching salary statistics:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// POST /api/manager/generate-salary-report - Générer rapport salaires
router.post('/generate-salary-report', authorize('manager', 'admin'), async (req, res) => {
  try {
    const { id_departement } = req.user;
    const { month, year, format = 'excel', type = 'complete' } = req.body;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    // Récupérer les données
    const [dept] = await db.query('SELECT * FROM departements WHERE id = ?', [id_departement]);

    const salaries = await db.query(
      `SELECT 
        s.*,
        u.nom_complet,
        u.matricule,
        u.type_employe,
        u.compte_bancaire,
        u.nom_banque
       FROM salaires s
       JOIN utilisateurs u ON s.id_utilisateur = u.id
       WHERE u.id_departement = ?
       AND s.mois = ? AND s.annee = ?
       ORDER BY u.nom_complet ASC`,
      [id_departement, targetMonth, targetYear]
    );

    if (salaries.length === 0) {
      return res.status(404).json({ error: 'Aucun salaire trouvé pour cette période' });
    }

    // Calculs
    const totalBrut = salaries.reduce((sum, s) => sum + parseFloat(s.salaire_brut || 0), 0);
    const totalNet = salaries.reduce((sum, s) => sum + parseFloat(s.salaire_net || 0), 0);
    const totalINSS = salaries.reduce((sum, s) => sum + parseFloat(s.deduction_inss || 0), 0);
    const totalImpots = salaries.reduce((sum, s) => sum + parseFloat(s.deduction_impots || 0), 0);
    const payes = salaries.filter(s => s.statut_paiement === 'payé').length;

    // Créer le fichier
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const fileName = `Rapport_Salaires_${dept[0]?.nom || 'Dept'}_${monthNames[targetMonth - 1]}_${targetYear}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const filePath = path.join(reportsDir, fileName);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Salaires');

      // En-tête
      sheet.mergeCells('A1:M1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `RAPPORT DE SALAIRES - ${monthNames[targetMonth - 1]} ${targetYear}`;
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 30;

      // Infos département
      sheet.getCell('A3').value = 'Département:';
      sheet.getCell('B3').value = dept[0]?.nom || '';
      sheet.getCell('A4').value = 'Période:';
      sheet.getCell('B4').value = `${monthNames[targetMonth - 1]} ${targetYear}`;
      sheet.getCell('A5').value = 'Nombre d\'employés:';
      sheet.getCell('B5').value = salaries.length;
      sheet.getCell('A6').value = 'Payés:';
      sheet.getCell('B6').value = payes;

      // En-têtes colonnes
      const headers = ['Matricule', 'Nom Complet', 'Type', 'Salaire Brut', 'INSS', 'Impôts',
        'Autres Déd.', 'Primes', 'Salaire Net', 'Mode Paiement', 'Statut', 'Date Paiement', 'Référence'];
      headers.forEach((h, i) => {
        const cell = sheet.getCell(8, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
      });

      // Données
      salaries.forEach((s, i) => {
        const r = i + 9;
        sheet.getCell(r, 1).value = s.matricule;
        sheet.getCell(r, 2).value = s.nom_complet;
        sheet.getCell(r, 3).value = s.type_employe;
        sheet.getCell(r, 4).value = parseFloat(s.salaire_brut);
        sheet.getCell(r, 4).numFmt = '#,##0.00';
        sheet.getCell(r, 5).value = parseFloat(s.deduction_inss);
        sheet.getCell(r, 5).numFmt = '#,##0.00';
        sheet.getCell(r, 6).value = parseFloat(s.deduction_impots);
        sheet.getCell(r, 6).numFmt = '#,##0.00';
        sheet.getCell(r, 7).value = parseFloat(s.autres_deductions);
        sheet.getCell(r, 7).numFmt = '#,##0.00';
        sheet.getCell(r, 8).value = parseFloat(s.primes);
        sheet.getCell(r, 8).numFmt = '#,##0.00';
        sheet.getCell(r, 9).value = parseFloat(s.salaire_net);
        sheet.getCell(r, 9).numFmt = '#,##0.00';
        sheet.getCell(r, 10).value = s.mode_paiement || '-';
        sheet.getCell(r, 11).value = s.statut_paiement;
        sheet.getCell(r, 12).value = s.date_paiement ? new Date(s.date_paiement) : '-';
        if (s.date_paiement) sheet.getCell(r, 12).numFmt = 'dd/mm/yyyy';
        sheet.getCell(r, 13).value = s.reference_paiement || '-';
      });

      // Totaux
      const totalRow = salaries.length + 10;
      sheet.mergeCells(`A${totalRow}:C${totalRow}`);
      sheet.getCell(`A${totalRow}`).value = 'TOTAUX';
      sheet.getCell(`A${totalRow}`).font = { bold: true };
      sheet.getCell(`D${totalRow}`).value = totalBrut;
      sheet.getCell(`D${totalRow}`).numFmt = '#,##0.00';
      sheet.getCell(`D${totalRow}`).font = { bold: true };
      sheet.getCell(`E${totalRow}`).value = totalINSS;
      sheet.getCell(`E${totalRow}`).numFmt = '#,##0.00';
      sheet.getCell(`F${totalRow}`).value = totalImpots;
      sheet.getCell(`F${totalRow}`).numFmt = '#,##0.00';
      sheet.getCell(`I${totalRow}`).value = totalNet;
      sheet.getCell(`I${totalRow}`).numFmt = '#,##0.00';
      sheet.getCell(`I${totalRow}`).font = { bold: true, color: { argb: 'FF2ECC71' } };

      // Largeurs
      sheet.columns = [
        { width: 12 }, { width: 25 }, { width: 15 }, { width: 12 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 },
        { width: 12 }, { width: 15 }, { width: 20 }
      ];

      await workbook.xlsx.writeFile(filePath);
    }

    // Encoder en base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    res.json({
      success: true,
      message: 'Rapport généré avec succès',
      fileName: fileName,
      format: format,
      data: base64Data,
      stats: {
        total_employes: salaries.length,
        total_brut: totalBrut,
        total_net: totalNet,
        total_inss: totalINSS,
        total_impots: totalImpots,
        payes: payes
      }
    });

  } catch (error) {
    console.error('Error generating salary report:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du rapport',
      details: error.message
    });
  }
});

// ==================== FINANCE - TRANSACTIONS RAPIDES ====================

// POST /api/manager/finances/transaction-rapide
router.post('/finances/transaction-rapide', authorize('manager', 'admin'), async (req, res) => {
  let connection;
  try {
    const { id: managerId, id_departement } = req.user;
    const {
      type, // 'vente' ou 'achat'
      client_id,
      fournisseur_id,
      montant,
      mode_paiement,
      description,
      article_type, // 'parcelle', 'animal', 'vehicule', 'produit', 'autre'
      article_id,
      date_transaction
    } = req.body;

    if (!type || !montant || !mode_paiement) {
      return res.status(400).json({ error: 'Type, montant et mode de paiement requis' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const dateTrans = date_transaction || new Date();
    // Générer numéro commande format: CMD-{TYPE}-{TIMESTAMP}
    const timestamp = Date.now().toString().substr(-6);
    const numCommande = `CMD-${type === 'vente' ? 'V' : 'A'}-${timestamp}`;

    let commandeId;

    if (type === 'vente') {
      // 1. Créer Commande Vente
      const [cmdResult] = await connection.query(
        `INSERT INTO commandes_vente 
          (numero_commande, id_client, date_commande, date_livraison_prevue, 
           date_livraison_reelle, lieu_livraison, mode_paiement, montant_ht, 
           montant_ttc, montant_total, statut, cree_par)
         VALUES (?, ?, ?, ?, ?, 'Sur place', ?, ?, ?, ?, 'livree_complete', ?)`,
        [numCommande, client_id || 1, dateTrans, dateTrans, dateTrans, mode_paiement, montant, montant, montant, managerId]
      );
      commandeId = cmdResult.insertId;

      // 2. Créer Ligne Commande
      await connection.query(
        `INSERT INTO lignes_commande_vente 
          (id_commande_vente, type_produit, id_produit, designation, 
           quantite_commandee, quantite_livree, quantite_facturee, 
           unite, prix_unitaire_ht, montant_ht, montant_ttc, statut_livraison)
         VALUES (?, ?, ?, ?, 1, 1, 1, 'unité', ?, ?, ?, 'complete')`,
        [commandeId, article_type || 'autre', article_id || null, description || 'Vente rapide', montant, montant, montant]
      );

      // 3. Créer Paiement (Recette)
      // Note: Le trigger 'trigger_journal_vente' va s'occuper du journal quand statut = 'livree_complete'
      // MAIS le trigger 'trigger_journal_paiement' s'occupe du paiement. 
      // Si on veut que la comptabilité soit juste, il faut les deux, ou bien gérer pour ne pas doubler.
      // Journal Vente = C.A. + Client (411 - 707)
      // Journal Paiement = Banque + Client (512 - 411)
      // Donc c'est correct d'avoir les deux.

      await connection.query(
        `INSERT INTO paiements 
          (reference_paiement, type_paiement, source_type, id_source, 
           id_commande, montant, mode_paiement, date_paiement, statut, description)
         VALUES (?, 'recette', 'client', ?, ?, ?, ?, ?, 'valide', ?)`,
        [`PAY-${numCommande}`, client_id || 1, commandeId, montant, mode_paiement, dateTrans, description || 'Paiement vente rapide']
      );

      // 4. Mettre à jour l'article vendu
      if (article_type === 'parcelle' && article_id) {
        // await connection.query('UPDATE parcelles SET statut = "active" WHERE id = ?', [article_id]); 
        // Note: For now keeping status as active or assuming 'active' means owned. If sold, maybe ownership changes?
        // User asked to use existing structure. Assuming no status change needed or status change to 'abandonnee' if sold (as per schema comment)
      } else if (article_type === 'animal' && article_id) {
        await connection.query('UPDATE animaux SET statut = "vendu", date_sortie = NOW(), raison_sortie = "Vente" WHERE id = ?', [article_id]);
      } else if (article_type === 'produit_lait' && article_id) {
        await connection.query('UPDATE productions_lait SET destination = "vente" WHERE id = ?', [article_id]);
      } else if (article_type === 'produit_oeuf' && article_id) {
        await connection.query('UPDATE productions_oeufs SET destination = "vente" WHERE id = ?', [article_id]);
      } else if (article_type === 'vehicule' && article_id) {
        await connection.query('UPDATE vehicules SET statut = "vendu" WHERE id = ?', [article_id]);
      }

    } else {
      // ACHAT
      // 1. Créer Commande Achat
      const [cmdResult] = await connection.query(
        `INSERT INTO commandes_achat
          (numero_commande, id_fournisseur, date_commande, date_livraison_prevue,
           date_livraison_reelle, lieu_livraison, mode_paiement, montant_ht,
           montant_ttc, montant_total, statut, cree_par, observations_livraison)
         VALUES (?, ?, ?, ?, ?, 'Sur place', ?, ?, ?, ?, 'livree_complete', ?, ?)`,
        [numCommande, fournisseur_id || 1, dateTrans, dateTrans, dateTrans, mode_paiement, montant, montant, montant, managerId, description || 'Achat rapide']
      );
      commandeId = cmdResult.insertId;

      // Pas de table lignes_commande_achat, on s'arrête là pour le détail.

      // 2. Créer Paiement (Dépense)
      await connection.query(
        `INSERT INTO paiements 
          (reference_paiement, type_paiement, source_type, id_source, 
           id_commande, montant, mode_paiement, date_paiement, statut, description)
         VALUES (?, 'depense', 'fournisseur', ?, ?, ?, ?, ?, 'valide', ?)`,
        [`PAY-${numCommande}`, fournisseur_id || 1, commandeId, montant, mode_paiement, dateTrans, description || 'Paiement achat rapide']
      );
    }

    // Trace
    await connection.query(
      `INSERT INTO traces (id_utilisateur, module, type_action, action_details)
       VALUES (?, 'finance', 'transaction_rapide', ?)`,
      [managerId, `${type === 'vente' ? 'Vente' : 'Achat'} rapide de ${montant} BIF - ${description}`]
    );

    await connection.commit();
    res.json({ success: true, message: 'Transaction enregistrée avec succès', commandeId, numeroCommande: numCommande });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error processing transaction:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;