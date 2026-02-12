-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mer. 11 fév. 2026 à 23:26
-- Version du serveur : 9.4.0
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `nutrifix_db`
--

DELIMITER $$
--
-- Procédures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `enregistrer_journal_comptable` (IN `p_categorie` VARCHAR(50), IN `p_type_mouvement` VARCHAR(50), IN `p_libelle` VARCHAR(255), IN `p_description` TEXT, IN `p_montant` DECIMAL(15,2), IN `p_quantite` DECIMAL(10,2), IN `p_unite_mesure` VARCHAR(20), IN `p_compte_debit` VARCHAR(50), IN `p_compte_credit` VARCHAR(50), IN `p_table_source` VARCHAR(50), IN `p_id_source` INT, IN `p_tiers_type` VARCHAR(50), IN `p_tiers_id` INT, IN `p_tiers_nom` VARCHAR(150), IN `p_effectue_par` INT, IN `p_reference_externe` VARCHAR(100), IN `p_donnees_complementaires` JSON)   BEGIN
    DECLARE v_numero_ecriture VARCHAR(50);
    DECLARE v_effectue_par_nom VARCHAR(150);
    DECLARE v_effectue_par_role VARCHAR(50);
    DECLARE v_exercice INT;
    DECLARE v_periode INT;
    
    -- Générer numéro d'écriture unique
    SET v_numero_ecriture = CONCAT(
        'JNL-',
        DATE_FORMAT(NOW(), '%Y%m%d'),
        '-',
        LPAD((SELECT COALESCE(MAX(id), 0) + 1 FROM journal_comptable), 6, '0')
    );
    
    -- Récupérer infos utilisateur
    SELECT nom_complet, role INTO v_effectue_par_nom, v_effectue_par_role
    FROM utilisateurs WHERE id = p_effectue_par;
    
    -- Déterminer exercice et période
    SET v_exercice = YEAR(CURDATE());
    SET v_periode = MONTH(CURDATE());
    
    -- Insérer dans le journal
    INSERT INTO journal_comptable (
        numero_ecriture, date_operation, heure_operation,
        categorie, type_mouvement, libelle, description,
        montant, quantite, unite_mesure,
        compte_debit, compte_credit,
        table_source, id_source,
        tiers_type, tiers_id, tiers_nom,
        effectue_par, effectue_par_nom, effectue_par_role,
        exercice_comptable, periode_comptable,
        reference_externe, donnees_complementaires
    ) VALUES (
        v_numero_ecriture, CURDATE(), CURTIME(),
        p_categorie, p_type_mouvement, p_libelle, p_description,
        p_montant, p_quantite, p_unite_mesure,
        p_compte_debit, p_compte_credit,
        p_table_source, p_id_source,
        p_tiers_type, p_tiers_id, p_tiers_nom,
        p_effectue_par, v_effectue_par_nom, v_effectue_par_role,
        v_exercice, v_periode,
        p_reference_externe, p_donnees_complementaires
    );
    
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `generer_rapport_commercial` (IN `p_type_periode` VARCHAR(50), IN `p_date_debut` DATE, IN `p_date_fin` DATE, IN `p_id_departement` INT)   BEGIN
  DECLARE v_nombre_commandes INT DEFAULT 0;
  DECLARE v_montant_total_ventes DECIMAL(15,2) DEFAULT 0;
  DECLARE v_nombre_clients INT DEFAULT 0;
  DECLARE v_montant_moyen DECIMAL(12,2) DEFAULT 0;

  -- Compter les commandes
  SELECT COUNT(*) INTO v_nombre_commandes
  FROM commandes_vente
  WHERE date_commande BETWEEN p_date_debut AND p_date_fin;

  -- Calculer le montant total des ventes
  SELECT COALESCE(SUM(montant_total), 0) INTO v_montant_total_ventes
  FROM commandes_vente
  WHERE date_commande BETWEEN p_date_debut AND p_date_fin
  AND statut IN ('facturee', 'payee');

  -- Compter les clients actifs
  SELECT COUNT(DISTINCT id_client) INTO v_nombre_clients
  FROM commandes_vente
  WHERE date_commande BETWEEN p_date_debut AND p_date_fin;

  -- Calculer le montant moyen
  IF v_nombre_commandes > 0 THEN
    SET v_montant_moyen = v_montant_total_ventes / v_nombre_commandes;
  END IF;

  -- Insérer le rapport
  INSERT INTO rapports_financiers (
    type_periode,
    date_debut,
    date_fin,
    id_departement,
    type_rapport,
    chiffre_affaires,
    commentaires,
    generate_par,
    date_generation
  ) VALUES (
    p_type_periode,
    p_date_debut,
    p_date_fin,
    p_id_departement,
    'commercial',
    v_montant_total_ventes,
    CONCAT(
      'Commandes: ', v_nombre_commandes, ' | ',
      'Montant total: ', v_montant_total_ventes, ' | ',
      'Clients: ', v_nombre_clients, ' | ',
      'Montant moyen: ', v_montant_moyen
    ),
    1,
    NOW()
  );

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `generer_rapport_financier` (IN `p_type_periode` VARCHAR(50), IN `p_date_debut` DATE, IN `p_date_fin` DATE, IN `p_id_departement` INT)   BEGIN
  DECLARE v_chiffre_affaires DECIMAL(15,2) DEFAULT 0;
  DECLARE v_cout_achats DECIMAL(15,2) DEFAULT 0;
  DECLARE v_cout_production DECIMAL(15,2) DEFAULT 0;
  DECLARE v_cout_personnel DECIMAL(15,2) DEFAULT 0;
  DECLARE v_cout_operations DECIMAL(15,2) DEFAULT 0;
  DECLARE v_autres_couts DECIMAL(15,2) DEFAULT 0;
  DECLARE v_generate_par INT DEFAULT 1;

  -- Calculer le chiffre d'affaires (recettes)
  SELECT COALESCE(SUM(montant), 0) INTO v_chiffre_affaires
  FROM paiements
  WHERE type_paiement = 'recette'
  AND date_paiement BETWEEN p_date_debut AND p_date_fin
  AND statut = 'valide';

  -- Calculer le coût des achats
  SELECT COALESCE(SUM(montant_total), 0) INTO v_cout_achats
  FROM commandes_achat
  WHERE date_commande BETWEEN p_date_debut AND p_date_fin
  AND statut IN ('facturee', 'payee');

  -- Calculer le coût de production (frais de production)
  SELECT COALESCE(SUM(montant), 0) INTO v_cout_production
  FROM paiements
  WHERE type_paiement = 'depense'
  AND source_type = 'autre'
  AND date_paiement BETWEEN p_date_debut AND p_date_fin
  AND statut = 'valide';

  -- Calculer le coût du personnel
  SELECT COALESCE(SUM(salaire_net), 0) INTO v_cout_personnel
  FROM salaires
  WHERE YEAR(date_paiement) = YEAR(p_date_fin)
  AND MONTH(date_paiement) BETWEEN MONTH(p_date_debut) AND MONTH(p_date_fin)
  AND statut_paiement = 'payé';

  -- Calculer les coûts opérationnels
  SELECT COALESCE(SUM(montant), 0) INTO v_cout_operations
  FROM paiements
  WHERE type_paiement = 'depense'
  AND date_paiement BETWEEN p_date_debut AND p_date_fin
  AND statut = 'valide'
  AND source_type NOT IN ('fournisseur', 'employe');

  -- Insérer le rapport dans la table
  INSERT INTO rapports_financiers (
    type_periode,
    date_debut,
    date_fin,
    id_departement,
    type_rapport,
    chiffre_affaires,
    cout_achats,
    cout_production,
    cout_personnel,
    cout_operations,
    autres_couts,
    total_couts,
    marge_brute,
    resultat_net,
    marge_brute_pourcent,
    rentabilite_pourcent,
    generate_par,
    date_generation,
    commentaires
  ) VALUES (
    p_type_periode,
    p_date_debut,
    p_date_fin,
    p_id_departement,
    'synthese',
    v_chiffre_affaires,
    v_cout_achats,
    v_cout_production,
    v_cout_personnel,
    v_cout_operations,
    v_autres_couts,
    (v_cout_achats + v_cout_production + v_cout_personnel + v_cout_operations + v_autres_couts),
    (v_chiffre_affaires - v_cout_achats - v_cout_production),
    (v_chiffre_affaires - (v_cout_achats + v_cout_production + v_cout_personnel + v_cout_operations + v_autres_couts)),
    CASE WHEN v_chiffre_affaires > 0 THEN ((v_chiffre_affaires - v_cout_achats - v_cout_production) / v_chiffre_affaires * 100) ELSE 0 END,
    CASE WHEN v_chiffre_affaires > 0 THEN ((v_chiffre_affaires - (v_cout_achats + v_cout_production + v_cout_personnel + v_cout_operations + v_autres_couts)) / v_chiffre_affaires * 100) ELSE 0 END,
    v_generate_par,
    NOW(),
    CONCAT('Rapport généré automatiquement pour la période ', p_type_periode, ' du ', p_date_debut, ' au ', p_date_fin)
  );

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `generer_rapport_productivite` (IN `p_type_periode` VARCHAR(50), IN `p_date_debut` DATE, IN `p_date_fin` DATE, IN `p_id_departement` INT)   BEGIN
  DECLARE v_total_cultures INT DEFAULT 0;
  DECLARE v_total_production_kg DECIMAL(12,2) DEFAULT 0;
  DECLARE v_total_animaux INT DEFAULT 0;
  DECLARE v_production_lait DECIMAL(12,2) DEFAULT 0;
  DECLARE v_production_oeufs INT DEFAULT 0;

  -- Compter les cultures
  SELECT COUNT(*) INTO v_total_cultures
  FROM cultures
  WHERE id_parcelle IN (
    SELECT id FROM parcelles WHERE statut = 'active'
  )
  AND date_recolte_reelle BETWEEN p_date_debut AND p_date_fin;

  -- Calculer la production agricole
  SELECT COALESCE(SUM(rendement_obtenu_kg), 0) INTO v_total_production_kg
  FROM cultures
  WHERE date_recolte_reelle BETWEEN p_date_debut AND p_date_fin;

  -- Compter les animaux
  SELECT COUNT(*) INTO v_total_animaux
  FROM animaux
  WHERE statut = 'vivant';

  -- Calculer la production de lait
  SELECT COALESCE(SUM(quantite_litres), 0) INTO v_production_lait
  FROM productions_lait
  WHERE date_production BETWEEN p_date_debut AND p_date_fin;

  -- Calculer la production d'oeufs
  SELECT COALESCE(SUM(nombre_oeufs), 0) INTO v_production_oeufs
  FROM productions_oeufs
  WHERE date_recolte BETWEEN p_date_debut AND p_date_fin;

  -- Insérer le rapport
  INSERT INTO rapports_financiers (
    type_periode,
    date_debut,
    date_fin,
    id_departement,
    type_rapport,
    chiffre_affaires,
    commentaires,
    generate_par,
    date_generation
  ) VALUES (
    p_type_periode,
    p_date_debut,
    p_date_fin,
    p_id_departement,
    'productivite',
    0,
    CONCAT(
      'Cultures: ', v_total_cultures, ' | ',
      'Production agri: ', v_total_production_kg, ' kg | ',
      'Animaux: ', v_total_animaux, ' | ',
      'Production lait: ', v_production_lait, ' L | ',
      'Production oeufs: ', v_production_oeufs
    ),
    1,
    NOW()
  );

END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `aliments_betail`
--

CREATE TABLE `aliments_betail` (
  `id` int NOT NULL,
  `code_aliment` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_aliment` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('fourrage','granule','complement','mineral','medicamenteux') COLLATE utf8mb4_unicode_ci NOT NULL,
  `composition` text COLLATE utf8mb4_unicode_ci,
  `unite_mesure` enum('kg','ballot','sac','litre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantite_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `seuil_alerte` decimal(10,2) NOT NULL DEFAULT '100.00',
  `emplacement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `energie_kcal_kg` decimal(8,2) DEFAULT NULL,
  `proteines_pourcent` decimal(5,2) DEFAULT NULL,
  `fibres_pourcent` decimal(5,2) DEFAULT NULL,
  `prix_unitaire_achat` decimal(8,2) NOT NULL,
  `prix_unitaire_vente` decimal(8,2) DEFAULT NULL,
  `fournisseur_principal` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `especes_cible` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON array des espèces',
  `contre_indications` text COLLATE utf8mb4_unicode_ci,
  `statut` enum('actif','inactif','epuise') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `animaux`
--

CREATE TABLE `animaux` (
  `id` int NOT NULL,
  `numero_identification` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_animal` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `espece` enum('vache','brebis','chevre','poule','porc','lapin','abeille','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `race` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sexe` enum('male','femelle') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_naissance` date NOT NULL,
  `poids_naissance` decimal(5,2) DEFAULT NULL,
  `poids_actuel` decimal(6,2) DEFAULT NULL,
  `couleur` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marques_distinctives` text COLLATE utf8mb4_unicode_ci,
  `origine` enum('achat','naissance_interne','don','echange') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_fournisseur` int DEFAULT NULL,
  `id_mere` int DEFAULT NULL,
  `id_pere` int DEFAULT NULL,
  `prix_achat` decimal(10,2) DEFAULT NULL,
  `date_acquisition` date NOT NULL,
  `id_enclos` int DEFAULT NULL,
  `id_ferme` int DEFAULT NULL,
  `statut_sante` enum('excellent','bon','moyen','malade','en_traitement') COLLATE utf8mb4_unicode_ci DEFAULT 'bon',
  `derniere_vaccination` date DEFAULT NULL,
  `prochaine_vaccination` date DEFAULT NULL,
  `statut_production` enum('non_productif','en_production','reforme') COLLATE utf8mb4_unicode_ci DEFAULT 'non_productif',
  `debut_production` date DEFAULT NULL,
  `fin_production` date DEFAULT NULL,
  `statut` enum('vivant','vendu','decede','abat','perdu') COLLATE utf8mb4_unicode_ci DEFAULT 'vivant',
  `date_sortie` date DEFAULT NULL,
  `raison_sortie` text COLLATE utf8mb4_unicode_ci,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certificat_veterinaire` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `applications_intrants`
--

CREATE TABLE `applications_intrants` (
  `id` int NOT NULL,
  `id_culture` int NOT NULL,
  `id_intrant` int NOT NULL,
  `id_parcelle` int NOT NULL,
  `id_applicateur` int NOT NULL,
  `date_application` date NOT NULL,
  `quantite_utilisee` decimal(8,2) NOT NULL,
  `unite_utilisee` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `methode_application` enum('pulverisation','epandage','injection','trempage') COLLATE utf8mb4_unicode_ci NOT NULL,
  `conditions_meteo` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `humidite_sol` decimal(4,2) DEFAULT NULL,
  `temperature_air` decimal(4,1) DEFAULT NULL,
  `objectif` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `observations` text COLLATE utf8mb4_unicode_ci,
  `cout_application` decimal(10,2) DEFAULT '0.00',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `assurances_vehicules`
--

CREATE TABLE `assurances_vehicules` (
  `id` int NOT NULL,
  `id_vehicule` int NOT NULL,
  `compagnie_assurance` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero_police` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_couverture` enum('tous_risques','tiers','vol_incendie') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_debut` date NOT NULL,
  `date_expiration` date NOT NULL,
  `montant_prime` decimal(10,2) NOT NULL,
  `franchise` decimal(10,2) DEFAULT '0.00',
  `scan_police` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scan_attestation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notification_envoyee_30` tinyint(1) DEFAULT '0',
  `notification_envoyee_15` tinyint(1) DEFAULT '0',
  `notification_envoyee_7` tinyint(1) DEFAULT '0',
  `notification_envoyee_1` tinyint(1) DEFAULT '0',
  `statut` enum('active','expiree','renouvelee','resiliee') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `budgets_departements`
--

CREATE TABLE `budgets_departements` (
  `id` int NOT NULL,
  `id_departement` int NOT NULL,
  `annee` year NOT NULL,
  `budget_alloue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `budget_utilise` decimal(15,2) DEFAULT '0.00',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `budgets_departements`
--

INSERT INTO `budgets_departements` (`id`, `id_departement`, `annee`, `budget_alloue`, `budget_utilise`, `date_creation`, `date_modification`) VALUES
(1, 1, '2026', 100000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(2, 2, '2026', 50000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(3, 3, '2026', 30000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(4, 4, '2026', 150000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(5, 5, '2026', 120000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(6, 6, '2026', 80000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(7, 7, '2026', 60000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(8, 8, '2026', 90000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(9, 9, '2026', 40000000.00, 0.00, '2026-02-02 05:44:29', '2026-02-02 05:44:29');

-- --------------------------------------------------------

--
-- Structure de la table `clients`
--

CREATE TABLE `clients` (
  `id` int NOT NULL,
  `code_client` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_client` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('particulier','entreprise','revendeur','grossiste','institutionnel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_principal` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` text COLLATE utf8mb4_unicode_ci,
  `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pays` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'RDC',
  `secteur_activite` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_tva` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_compte` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `premier_achat` date DEFAULT NULL,
  `dernier_achat` date DEFAULT NULL,
  `nombre_achats` int DEFAULT '0',
  `montant_total_achats` decimal(15,2) DEFAULT '0.00',
  `moyenne_achat` decimal(12,2) DEFAULT '0.00',
  `limite_credit` decimal(12,2) DEFAULT '0.00',
  `solde_du` decimal(12,2) DEFAULT '0.00',
  `delai_paiement_jours` int DEFAULT '30',
  `niveau_fidelite` enum('nouveau','occasionnel','regulier','fidele','vip') COLLATE utf8mb4_unicode_ci DEFAULT 'nouveau',
  `points_fidelite` int DEFAULT '0',
  `statut` enum('actif','inactif','suspendu') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `motif_suspension` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `codes_verification_salaire`
--

CREATE TABLE `codes_verification_salaire` (
  `id` int NOT NULL,
  `id_salaire` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `code_verification` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_expiration` datetime NOT NULL,
  `utilise` tinyint(1) DEFAULT '0',
  `date_utilisation` datetime DEFAULT NULL,
  `tentatives_echouees` int DEFAULT '0',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `commandes_achat`
--

CREATE TABLE `commandes_achat` (
  `id` int NOT NULL,
  `numero_commande` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_fournisseur` int NOT NULL,
  `date_commande` date NOT NULL,
  `date_livraison_prevue` date NOT NULL,
  `date_livraison_reelle` date DEFAULT NULL,
  `lieu_livraison` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mode_paiement` enum('especes','cheque','virement','mobile_money','credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `conditions_paiement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delai_paiement_jours` int DEFAULT '30',
  `montant_ht` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tva_pourcent` decimal(5,2) DEFAULT '0.00',
  `montant_tva` decimal(12,2) DEFAULT '0.00',
  `montant_ttc` decimal(12,2) DEFAULT '0.00',
  `frais_livraison` decimal(10,2) DEFAULT '0.00',
  `remise` decimal(10,2) DEFAULT '0.00',
  `montant_total` decimal(12,2) DEFAULT '0.00',
  `livre_par` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_livreur` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observations_livraison` text COLLATE utf8mb4_unicode_ci,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('brouillon','envoyee','confirmee','livree_partielle','livree_complete','facturee','payee','annulee') COLLATE utf8mb4_unicode_ci DEFAULT 'brouillon',
  `cree_par` int NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modifie_par` int DEFAULT NULL,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `commandes_achat`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_achat` AFTER UPDATE ON `commandes_achat` FOR EACH ROW BEGIN
    DECLARE v_fournisseur_nom VARCHAR(150);
    
    IF OLD.statut != 'livree_complete' AND NEW.statut = 'livree_complete' THEN
        SELECT nom_fournisseur INTO v_fournisseur_nom FROM fournisseurs WHERE id = NEW.id_fournisseur;
        
        CALL enregistrer_journal_comptable(
            'achat',
            'depense',
            CONCAT('Achat - ', NEW.numero_commande),
            CONCAT('Commande fournisseur: ', NEW.numero_commande),
            NEW.montant_total,
            NULL,
            NULL,
            '607 - Achats',
            '401 - Fournisseurs',
            'commandes_achat',
            NEW.id,
            'fournisseur',
            NEW.id_fournisseur,
            v_fournisseur_nom,
            COALESCE(NEW.valide_par, NEW.cree_par),
            NEW.numero_commande,
            JSON_OBJECT(
                'mode_paiement', NEW.mode_paiement,
                'lieu_livraison', NEW.lieu_livraison,
                'date_livraison', NEW.date_livraison_reelle
            )
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `commandes_vente`
--

CREATE TABLE `commandes_vente` (
  `id` int NOT NULL,
  `numero_commande` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_client` int NOT NULL,
  `date_commande` date NOT NULL,
  `date_livraison_prevue` date NOT NULL,
  `date_livraison_reelle` date DEFAULT NULL,
  `lieu_livraison` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mode_paiement` enum('especes','cheque','virement','mobile_money','credit','mixte') COLLATE utf8mb4_unicode_ci NOT NULL,
  `conditions_paiement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `montant_ht` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tva_pourcent` decimal(5,2) DEFAULT '0.00',
  `montant_tva` decimal(12,2) DEFAULT '0.00',
  `montant_ttc` decimal(12,2) DEFAULT '0.00',
  `frais_livraison` decimal(10,2) DEFAULT '0.00',
  `remise` decimal(10,2) DEFAULT '0.00',
  `montant_total` decimal(12,2) DEFAULT '0.00',
  `livre_par` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_livreur` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observations_livraison` text COLLATE utf8mb4_unicode_ci,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('brouillon','confirmee','en_preparation','livree_partielle','livree_complete','facturee','payee','annulee') COLLATE utf8mb4_unicode_ci DEFAULT 'brouillon',
  `cree_par` int NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modifie_par` int DEFAULT NULL,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `commandes_vente`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_vente` AFTER UPDATE ON `commandes_vente` FOR EACH ROW BEGIN
    DECLARE v_client_nom VARCHAR(150);
    
    -- Seulement si la commande vient d'être livrée
    IF OLD.statut != 'livree_complete' AND NEW.statut = 'livree_complete' THEN
        SELECT nom_client INTO v_client_nom FROM clients WHERE id = NEW.id_client;
        
        CALL enregistrer_journal_comptable(
            'vente',
            'recette',
            CONCAT('Vente - ', NEW.numero_commande),
            CONCAT('Commande client: ', NEW.numero_commande),
            NEW.montant_total,
            NULL,
            NULL,
            '411 - Clients',
            '707 - Ventes',
            'commandes_vente',
            NEW.id,
            'client',
            NEW.id_client,
            v_client_nom,
            COALESCE(NEW.valide_par, NEW.cree_par),
            NEW.numero_commande,
            JSON_OBJECT(
                'mode_paiement', NEW.mode_paiement,
                'lieu_livraison', NEW.lieu_livraison,
                'date_livraison', NEW.date_livraison_reelle
            )
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `confirmations_reception_salaire`
--

CREATE TABLE `confirmations_reception_salaire` (
  `id` int NOT NULL,
  `id_salaire` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `mois` int NOT NULL,
  `annee` int NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `code_verification_utilise` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirme` tinyint(1) DEFAULT '0',
  `date_confirmation` datetime DEFAULT NULL,
  `methode_confirmation` enum('code_sms','code_email','biometrique','manuel') COLLATE utf8mb4_unicode_ci DEFAULT 'code_email',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_info` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `confirmations_reception_salaire`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_confirmation_salaire` AFTER INSERT ON `confirmations_reception_salaire` FOR EACH ROW BEGIN
    DECLARE v_employe_nom VARCHAR(150);
    
    SELECT nom_complet INTO v_employe_nom 
    FROM utilisateurs 
    WHERE id = NEW.id_utilisateur;
    
    INSERT INTO traces (
        id_utilisateur,
        module,
        type_action,
        action_details,
        table_affectee,
        id_enregistrement,
        niveau,
        date_action
    ) VALUES (
        NEW.id_utilisateur,
        'rh',
        'CONFIRMATION_RECEPTION_SALAIRE',
        CONCAT('Confirmation de réception du salaire de ', 
               CASE NEW.mois
                   WHEN 1 THEN 'Janvier'
                   WHEN 2 THEN 'Février'
                   WHEN 3 THEN 'Mars'
                   WHEN 4 THEN 'Avril'
                   WHEN 5 THEN 'Mai'
                   WHEN 6 THEN 'Juin'
                   WHEN 7 THEN 'Juillet'
                   WHEN 8 THEN 'Août'
                   WHEN 9 THEN 'Septembre'
                   WHEN 10 THEN 'Octobre'
                   WHEN 11 THEN 'Novembre'
                   WHEN 12 THEN 'Décembre'
               END, ' ', NEW.annee, ' - Montant: ', NEW.montant, ' FBU'),
        'confirmations_reception_salaire',
        NEW.id,
        'info',
        NOW()
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `conges`
--

CREATE TABLE `conges` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `type_conge` enum('annuel','maladie','maternite','exceptionnel','sans_solde') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `jours_demandes` int GENERATED ALWAYS AS (((to_days(`date_fin`) - to_days(`date_debut`)) + 1)) STORED,
  `raison` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `pieces_jointes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` enum('en_attente','approuve','rejete','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `commentaire_validation` text COLLATE utf8mb4_unicode_ci,
  `cree_par` int NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modifie_par` int DEFAULT NULL,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `cultures`
--

CREATE TABLE `cultures` (
  `id` int NOT NULL,
  `id_parcelle` int NOT NULL,
  `id_type_culture` int NOT NULL,
  `reference_saison` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_semaison` date NOT NULL,
  `date_levage_prevue` date DEFAULT NULL,
  `date_recolte_prevue` date NOT NULL,
  `date_recolte_reelle` date DEFAULT NULL,
  `quantite_semences_kg` decimal(8,2) NOT NULL,
  `densite_semis` decimal(8,2) DEFAULT NULL,
  `stade_croissance` enum('semis','levage','croissance','floraison','maturation','recolte') COLLATE utf8mb4_unicode_ci DEFAULT 'semis',
  `rendement_obtenu_kg` decimal(10,2) DEFAULT NULL,
  `qualite` enum('excellente','bonne','moyenne','faible') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `taux_perte` decimal(5,2) DEFAULT '0.00',
  `commentaires` text COLLATE utf8mb4_unicode_ci,
  `cout_total` decimal(12,2) DEFAULT '0.00',
  `revenu_estime` decimal(12,2) DEFAULT '0.00',
  `statut` enum('en_cours','recoltee','abandonnee') COLLATE utf8mb4_unicode_ci DEFAULT 'en_cours',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `demandes_budget`
--

CREATE TABLE `demandes_budget` (
  `id` int NOT NULL,
  `id_departement` int NOT NULL,
  `id_demandeur` int NOT NULL,
  `montant_demande` decimal(12,2) NOT NULL,
  `categorie` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `justification` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `urgence` enum('normal','prioritaire','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'normal',
  `statut` enum('en_attente','approuve','rejete','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `date_demande` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `commentaire_validation` text COLLATE utf8mb4_unicode_ci,
  `montant_approuve` decimal(12,2) DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `demandes_paiement_salaire`
--

CREATE TABLE `demandes_paiement_salaire` (
  `id` int NOT NULL,
  `id_salaire` int NOT NULL,
  `id_employe` int NOT NULL,
  `mois` int NOT NULL,
  `annee` int NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `statut` enum('en_attente','approuve','rejete','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `motif_rejet` text COLLATE utf8mb4_unicode_ci,
  `traite_par` int DEFAULT NULL,
  `date_demande` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_traitement` datetime DEFAULT NULL,
  `commentaire` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `demandes_paiement_salaire`
--
DELIMITER $$
CREATE TRIGGER `trigger_alerte_salaire_retard` AFTER INSERT ON `demandes_paiement_salaire` FOR EACH ROW BEGIN
    DECLARE v_employe_nom VARCHAR(150);
    DECLARE v_employe_email VARCHAR(100);
    DECLARE v_jours_retard INT;
    
    SELECT u.nom_complet, u.email 
    INTO v_employe_nom, v_employe_email
    FROM utilisateurs u 
    WHERE u.id = NEW.id_employe;
    
    -- Calculer jours de retard
    SET v_jours_retard = DATEDIFF(CURDATE(), 
        DATE_ADD(LAST_DAY(STR_TO_DATE(CONCAT(NEW.annee, '-', LPAD(NEW.mois, 2, '0'), '-01'), '%Y-%m-%d')), INTERVAL 5 DAY)
    );
    
    -- Créer notification d'alerte
    INSERT INTO notifications (
        id_utilisateur,
        type_notification,
        titre,
        message,
        priorite,
        type_reference,
        id_reference,
        statut
    ) VALUES (
        NEW.id_employe,
        'alerte_stock',
        'Salaire en Retard',
        CONCAT('Votre salaire de ', NEW.mois, '/', NEW.annee, ' est en retard depuis ', 
               v_jours_retard, ' jour(s)'),
        CASE 
            WHEN v_jours_retard >= 30 THEN 'urgente'
            WHEN v_jours_retard >= 15 THEN 'haute'
            ELSE 'normale'
        END,
        'demande_salaire',
        NEW.id,
        'non_lu'
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trigger_journal_demande_paiement` AFTER INSERT ON `demandes_paiement_salaire` FOR EACH ROW BEGIN
    DECLARE v_employe_nom VARCHAR(150);
    
    SELECT nom_complet INTO v_employe_nom 
    FROM utilisateurs 
    WHERE id = NEW.id_employe;
    
    INSERT INTO traces (
        id_utilisateur,
        module,
        type_action,
        action_details,
        table_affectee,
        id_enregistrement,
        niveau,
        date_action
    ) VALUES (
        NEW.id_employe,
        'rh',
        'DEMANDE_PAIEMENT_SALAIRE',
        CONCAT('Demande de paiement pour salaire de ', 
               CASE NEW.mois
                   WHEN 1 THEN 'Janvier'
                   WHEN 2 THEN 'Février'
                   WHEN 3 THEN 'Mars'
                   WHEN 4 THEN 'Avril'
                   WHEN 5 THEN 'Mai'
                   WHEN 6 THEN 'Juin'
                   WHEN 7 THEN 'Juillet'
                   WHEN 8 THEN 'Août'
                   WHEN 9 THEN 'Septembre'
                   WHEN 10 THEN 'Octobre'
                   WHEN 11 THEN 'Novembre'
                   WHEN 12 THEN 'Décembre'
               END, ' ', NEW.annee, ' - Montant: ', NEW.montant, ' FBU'),
        'demandes_paiement_salaire',
        NEW.id,
        'info',
        NOW()
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `departements`
--

CREATE TABLE `departements` (
  `id` int NOT NULL,
  `nom` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_parent` int DEFAULT NULL,
  `type` enum('agriculture','elevage','flotte','rh','finance','commercial','production','logistique') COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_annuel` decimal(15,2) DEFAULT '0.00',
  `responsable_id` int DEFAULT NULL,
  `statut` enum('actif','inactif') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `departements`
--

INSERT INTO `departements` (`id`, `nom`, `id_parent`, `type`, `budget_annuel`, `responsable_id`, `statut`, `date_creation`, `date_modification`) VALUES
(1, 'Direction Generale', NULL, 'rh', 100000000.00, 1, 'actif', '2026-02-02 05:44:29', '2026-02-07 19:25:25'),
(2, 'Finance & Comptabilite', 1, 'finance', 50000000.00, 2, 'actif', '2026-02-02 05:44:29', '2026-02-07 19:25:39'),
(3, 'Ressources Humaines', 1, 'rh', 30000000.00, 4, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(4, 'Agriculture', 1, 'agriculture', 10000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-11 21:39:55'),
(5, 'Elevage', 1, 'elevage', 120000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-07 19:25:52'),
(6, 'Flotte Automobile', 1, 'flotte', 80000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(7, 'Commercial', 1, 'commercial', 60000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(8, 'Production', 1, 'production', 90000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(9, 'Logistique', 1, 'logistique', 40000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29');

-- --------------------------------------------------------

--
-- Structure de la table `depenses_departement`
--

CREATE TABLE `depenses_departement` (
  `id` int NOT NULL,
  `id_departement` int NOT NULL,
  `categorie` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `montant` decimal(12,2) NOT NULL,
  `date_depense` date NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `piece_justificative` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effectue_par` int NOT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('en_attente','approuve','rejete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `devices`
--

CREATE TABLE `devices` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `push_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('ios','android','web') COLLATE utf8mb4_unicode_ci DEFAULT 'android',
  `device_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `os_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_seen` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `employes`
--

CREATE TABLE `employes` (
  `id` int NOT NULL,
  `matricule` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mot_de_passe_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nom_complet` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_employe` enum('INSS','temps_partiel','contractuel') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INSS',
  `role` enum('admin','manager','employe','comptable','veterinaire','chauffeur','agriculteur','technicien') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'employe',
  `id_departement` int NOT NULL,
  `date_embauche` date NOT NULL,
  `salaire_base` decimal(10,2) NOT NULL DEFAULT '0.00',
  `statut` enum('actif','inactif','congé','suspendu') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'actif',
  `date_naissance` date DEFAULT NULL,
  `adresse` text COLLATE utf8mb4_unicode_ci,
  `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pays` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Burundi',
  `numero_cnss` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jours_conges_annuels` int DEFAULT '20',
  `compte_bancaire` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nom_banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_code` text COLLATE utf8mb4_unicode_ci,
  `donnees_biometriques` text COLLATE utf8mb4_unicode_ci,
  `photo_identite` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `derniere_connexion` datetime DEFAULT NULL,
  `nombre_connexions` int DEFAULT '0',
  `doit_changer_mdp` tinyint(1) DEFAULT '1',
  `date_modification_mdp` datetime DEFAULT NULL,
  `date_depart` date DEFAULT NULL,
  `raison_depart` text COLLATE utf8mb4_unicode_ci,
  `cree_par` int DEFAULT NULL,
  `modifie_par` int DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `numero_cni` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `employes`
--

INSERT INTO `employes` (`id`, `matricule`, `email`, `mot_de_passe_hash`, `nom_complet`, `telephone`, `type_employe`, `role`, `id_departement`, `date_embauche`, `salaire_base`, `statut`, `date_naissance`, `adresse`, `ville`, `pays`, `numero_cnss`, `jours_conges_annuels`, `compte_bancaire`, `nom_banque`, `qr_code`, `donnees_biometriques`, `photo_identite`, `derniere_connexion`, `nombre_connexions`, `doit_changer_mdp`, `date_modification_mdp`, `date_depart`, `raison_depart`, `cree_par`, `modifie_par`, `date_creation`, `date_modification`, `numero_cni`) VALUES
(1, 'ADM001', 'admin@nutrisoft.bi', '$2b$10$Yd6vOKcxPOLlLaXB9RbNP.9vSrFWhiah.mIHsxfW8CRkDVhN27V0a', 'NIYONGABO Jean Claude', '+257 79 123 456', 'INSS', 'admin', 1, '2024-01-01', 2500000.00, 'actif', '1985-03-15', 'Avenue de la Burundi, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-001', 30, 'BDI-001-123456789', 'Banque de Cr├®dit de Bujumbura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKwAAACsCAYAAADmMUfYAAAAAklEQVR4AewaftIAAApuSURBVO3BwW1sOQxFwWOh82AgjItRMC4Gwkg8Xl54oQ/htT0WwKqPzy+McYnFGBdZjHGRxRgXefGNefKbuoInzBPVFSjzRHUFO+bJTldwwjx5oit4J/NEdQXKPFFdgTJPflNXoBZjXGQxxkUWY1zkxT90Be9knpwwT97JPHkn8+REV6DMkx3z5CeZJ090Be9knuwsxrjIYoyLLMa4yItD5smJruCEeXKiK1DmieoKnjBPlHmiugJlnuyYJ6orUObJE12BMk92ugJlnjxhnpzoCk4sxrjIYoyLLMa4yIs/ris40RXsmCeqK1DmieoKTnQFyjxRXYEyT1RXsGOeqK5AmSdPdAV/2WKMiyzGuMhijIu8uIx5cqIrUF2BMk9UV6DMk52u4IR5orqCHfNkxzzZ6QqUeaLME9UV/GWLMS6yGOMiizEu8uJQV/CXdAU75onqClRXsNMV7JgnqitQXcGOebLTFeyYJ6orUObJTlfwTl3BT1qMcZHFGBdZjHGRF/9gntzEPFFdgTJPVFegzBPVFSjzRHUFyjxRXYEyT1RXoMyTHfNEdQXKPFFdgTJPdswT1RXsmCe/aTHGRRZjXGQxxkU+Pr/wh5gnv6kr+EnmieoKnjBPVFdwwjzZ6Qr+ssUYF1mMcZHFGBf5+PyCME9UV6DMk3fqCp4wT1RXoMwT1RUo8+SduoInzJMnugJlnqiuQJknqivYMU/eqSs4sRjjIosxLrIY4yIvfllXoMyTna5AmSc75smOeaK6AmWeqK7ghHnyTl3BCfNEdQXKPHmnruCEebJjnqiuQC3GuMhijIssxrjIi4e6ghPmieoKdsyTE12BMk9UV/CEeaK6AtUVKPNEdQXvZJ6orkCZJztdwY55csI8OWGenFiMcZHFGBdZjHGRj88vCPNEdQUnzBPVFeyYJ6or2DFPVFegzBPVFSjzRHUFyjxRXcEJ80R1BX+JeaK6AmWe7HQF/6fFGBdZjHGRxRgX+fj8woZ5orqCJ8yTJ7qCJ8wT1RWcME9UV6DMk52uYMc8+T91BT/JPFFdwYnFGBdZjHGRxRgX+fj8gjBPVFdwwjxRXcGOefJOXYEyT3a6AmWeqK5AmSeqK9gxT3a6gifME9UV7JgnqitQ5slOV6DMk52u4J0WY1xkMcZFFmNc5MU/mCeqKzhhnjzRFZwwT1RXsGOeqK5gpyvYMU92ugJlnux0Bco8+UldgTJPdrqCE+aJ6gqUeaK6ArUY4yKLMS6yGOMiL77pCpR5smOe7HQFO+aJ6gqUefJO5smOebLTFex0BU90Be9knqiuYMc82TFPdrqCna5gpyvYWYxxkcUYF1mMcZEXD3UFO+bJCfNEdQU75skTXYEyT1RXcMI82ekKdsyTna5AmSc7XYEyT1RXoLoCZZ6oruAJ80R1BScWY1xkMcZFFmNc5MUP6wp2zJMT5skJ80R1BTtdwY55stMVnOgKlHmiugJlnpwwT1RXoMyTna5AmSeqK1DmyU5XoMyTna5ALca4yGKMiyzGuMiLb8wT1RXsmCeqK9gxT1RXoMwTZZ6ormDHPNkxT3a6gifME9UVKPPkia7gRFegzJO/rCvYWYxxkcUYF1mMcZEX/2CeqK5AdQU75onqCt7JPDnRFeyYJ6orUF3Bjnmy0xW8k3miuoITXcET5slOV6DME9UVnFiMcZHFGBdZjHGRF990Bco82TFPTpgnO12BMk92uoId82THPFFdwY55orqCHfPkia5gpyvYMU9OmCeqK1BdwQnzRHUFyjxRXcHOYoyLLMa4yGKMi3x8fuGAeXKiKzhhnqiu4J3ME9UVPGGeqK7gN5kn79QVKPPkRFegzBPVFeyYJ6orUIsxLrIY4yKLMS7y8fkFYZ68U1egzBPVFZwwT1RX8E7mieoKlHlyoivYMU9UV6DME9UV7Jgnqit4wjxRXcGOebLTFTyxGOMiizEushjjIh+fX9gwT1RXoMyTE12BMk9UV/CbzBPVFeyYJ6orUObJTlfwhHlyoivYMU9UV6DME9UVnDBPTnQFO4sxLrIY4yKLMS7y4hvz5CeZJ6or2DFPVFewY56oruCEefJEV/CEeXKiK1DmiTJPVFeguoIT5onqCpR5orqCd1qMcZHFGBdZjHGRF990Bco8UebJTlegzBPVFSjzRHUFO+bJTlewY5480RXsmCeqK9gxT1RXoMyTJ7oCZZ7sdAU7XcFOV3DCPFFdwc5ijIssxrjIYoyLvHioK1DmieoKlHmyY56orkCZJ6orUObJTlfwm8wT1RWorkCZJ6orUOaJMk9UV3CiK1DmyRPmieoKlHmyY56orkAtxrjIYoyLLMa4yMfnFw6YJ6orUObJTlegzBPVFSjzRHUFyjxRXYEyT3a6AmWe7HQFT5gnqivYMU9UV6DMk52uQJknqivYMU9UV6DMkxNdwROLMS6yGOMiizEu8uIb80R1BSe6gh3zRHUFO13BO3UFyjxRXYEyT5R5orqCHfNEdQXKPFFdwY55stMV7HQFJ7oCZZ6oruCEebLTFewsxrjIYoyLLMa4yIt/ME/eqStQ5slOV6DMkx3z5ERXcKIr2DFPVFegzBPVFSjzZKcrUOaJMk9UV3DCPFFdgeoKlHnymxZjXGQxxkUWY1zk4/MLwjxRXYEyT050Bco8OdEV7JgnqitQ5slOV/CEeaK6AmWeqK7gncyTna5gxzxRXYEyT3a6gifMk52uQC3GuMhijIssxrjIi0NdwQnzRHUFJ8wT1RWorkCZJztdgTJPVFegzBPVFeyYJ6orUOaJ6gqUeaK6AmWenDBPfpN5orqCna7gxGKMiyzGuMhijIu8OGSeqK5AmSc75slOV7BjnqiuQHUFO+bJjnmiuoITXYEyT35TV7BjnqiuQJknJ8yTE+bJTlewsxjjIosxLrIY4yIfn1/4Q8wT1RUo82SnK3jCPNnpCpR5oroCZZ7sdAU75onqCnbME9UVKPPkRFdwwjxRXcEJ80R1BWoxxkUWY1xkMcZFXnxjnvymrkB1Bco8UV3BCfPkRFegzJMT5slOV/CEeaK6AtUV7HQFO+bJjnmiuoId80R1Bco8UV3BzmKMiyzGuMhijIu8+Ieu4J3Mkx3zZMc8UV3BbzJPVFewY54o80R1BSe6AmWeqK5AmSeqK1DmyYmu4ERXoMyTJxZjXGQxxkUWY1zkxSHz5ERX8ERX8ERX8ERX8E5dgTJPdroCZZ6orkCZJ+9knjxhnqiuQJknJxZjXGQxxkUWY1zkxeXMkxNdwY55cqIrOGGeqK7gRFegzBPVFeyYJztdgTJPVFfwk8wT1RWoxRgXWYxxkcUYF3nxx5kn72SeqK7gCfNkpyvYMU92ugJlnrxTV6DME9UVKPPkRFdwoivYWYxxkcUYF1mMcZEXh7qCn9QVKPNkpytQ5onqCt6pK9gxT5R5orqCna7gCfNEdQWqK/g/mSdPLMa4yGKMiyzGuMjH5xeEefKbugJlnqiuQJknqitQ5onqCnbME9UVKPNkpyvYMU92ugJlnpzoCpR5stMV3GwxxkUWY1xkMcZFPj6/MMYlFmNcZDHGRRZjXOQ/HMLE9U1TjzQAAAAASUVORK5CYII=', NULL, NULL, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(2, 'MGR001', 'manager.finance@nutrisoft.bi', '$2b$10$M.6VX5opOP8btsZJ6lv3Len7eFRjf3RVqaNwa7cVr9YmDUWQBPvy6', 'NDAYISENGA Marie Claire', '+257 79 234 567', 'INSS', 'manager', 2, '2024-01-15', 1800000.00, 'actif', '1988-07-22', 'Avenue du Lac, Q. Kinindo', 'Bujumbura', 'Burundi', 'CNSS-2024-002', 25, 'BDI-002-234567890', 'Banque de Cr├®dit de Bujumbura', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(3, 'CPT001', 'comptable@nutrisoft.bi', '$2b$10$bYlpftpwNBKDOVZqgf9CwO9mrhv1puirKirCovBn.eYXU9osULD3m', 'HAKIZIMANA Patrick', '+257 79 345 678', 'INSS', 'comptable', 2, '2024-02-01', 1200000.00, 'actif', '1990-11-10', 'Boulevard de lUPRONA, Q. Mutanga Nord', 'Bujumbura', 'Burundi', 'CNSS-2024-003', 22, 'BDI-003-345678901', 'Interbank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(4, 'MGR002', 'manager.rh@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'UWIMANA Espérance', '+257 79 456 789', 'INSS', 'manager', 3, '2024-01-20', 1700000.00, 'actif', '1987-05-18', 'Avenue de lAmitié, Q. Ngagara', 'Bujumbura', 'Burundi', 'CNSS-2024-004', 25, 'BDI-004-456789012', 'BCB - Banque de credit du Burundi', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKwAAACsCAYAAADmMUfYAAAAAklEQVR4AewaftIAAApdSURBVO3B0Q0cywpF0e3S5EEgxHWiIC4CIRI/fyJ/YLV67HdLYq0fP39hrUsc1rrIYa2LHNa6yIffmAf/UqV4wjzoKsUT5sETlaIzD7pKMTEPJpWiMw/eqBSdedBVijfMg3+pUnSHtS5yWOsih7Uu8uEPKsU3mQcT82BSKTrzYFIpukrRmQcT86CrFBPzoKsUb1SKzjzoKsWkUnTmQVcpOvOgqxSTSvFN5sHksNZFDmtd5LDWRT48ZB48USneqBTfZB68YR50lWJiHrxhHrxhHjxRKd4wD56oFE8c1rrIYa2LHNa6yIf/OPOgqxRPmAddpZiYB12lmJgHk0rRmQddpZiYB12lmJgHT5gHk0rxX3JY6yKHtS5yWOsiH/5jKkVnHkwqRWceTMyDSaWYmAddpejMg848mJgHXaWYmAdPVIrOPJhUiv+yw1oXOax1kcNaF/nwUKX4LzEPJpWiMw8m5sET5kFXKTrzoKsUT1SKJ8yDzjyYVIpvqhR/02GtixzWushhrYt8+APz4F8yD7pK0ZkHXaXozIMnKkVnHnSVojMPukrRmQddpejMg65SdOZBVyk686CrFJNK0ZkHE/OgqxQT8+BfOqx1kcNaFzmsdZEPv6kU/yXmQVcpJpWiMw8m5sG/VCkmleJfMg+6SjGpFP9Ph7UucljrIoe1LvLhN+ZBVym+yTzoKsWkUvxNlaIzDzrzYGIefJN58Eal6MyDrlJ05sHEPJhUiol58ESlmBzWushhrYsc1rrIj5+/0JgHXaXozIOuUnTmQVcp3jAP3qgUnXnwRKX4m8yDSaXozINJpZiYB09UiifMg65SfNNhrYsc1rrIYa2LfHjJPOgqRWceTCrFpFJ05sGkUrxRKTrzYFIpOvOgqxSTSvFEpejMg4l5MKkUE/NgUim6StGZB5NK8cRhrYsc1rrIYa2LfHipUkwqxcQ86CrFpFJ05sEblaIzD54wD54wD7pK8YR58ESl6MyDiXnQVYrOPJiYB12lmJgHXaWYHNa6yGGtixzWusiPn7/QmAeTStGZB99UKTrzoKsUnXkwqRTfZB5MKsUT5sETlaIzD56oFE+YB09Uis486CpFZx5MKkV3WOsih7UucljrIh9+UyneqBSdedBVis486MyDiXkwqRQT86CrFJ150FWKSaWYmAeTSjExDyaV4l+qFJ150JkHXaWYVIrOPJgc1rrIYa2LHNa6yI+fvzAwD7pKMTEPukrRmQdvVIqJefBGpXjDPPimSjExD7pKMTEPukrRmQeTSvGGedBViicOa13ksNZFDmtd5MNL5kFXKTrzoKsUnXkwqRRPVIqJeTAxD7pK8Ual6MyDSaV4olJ05kFXKd6oFBPzoKsUT5gHk0rRHda6yGGtixzWusiPn7/QmAeTSvGGedBVis486CpFZx78P1WKbzIPJpWiMw8mlaIzD7pKMTEPJpXiDfNgUikmh7UucljrIoe1LvLhN5WiMw8m5sETlWJSKTrzoKsUnXnwRKXozINJpZiYB09UijcqRWcePGEevGEedJWiMw+eqBSdedBViu6w1kUOa13ksNZFPvzGPOgqRWcedJViYh505sEb5sEb5sGkUnTmwROV4o1K0ZkHXaWYmAddpejMgycqxcQ8eKJSdObBE4e1LnJY6yKHtS7y4TeVojMPJubBE5WiMw/eqBSdedBViol50JkHXaV4wzzoKsXEPOgqxROV4olK0ZkHnXnwN1WKzjyYHNa6yGGtixzWusiH35gHXaXozIOuUnTmwcQ86CpFZx50leIN86CrFF2l6MyDiXnwhnnQVYrOPHiiUvxNlWJiHnSVYmIeTCrF5LDWRQ5rXeSw1kU+/KZSdObBG5Xim8yDN8yDrlI8USkm5sEblWJiHnSVYmIeTMyDNypFZx5MKkVnHjxxWOsih7UucljrIh/+oFJ05kFnHnSVojMPnqgUnXkwqRSdeTCpFG+YB5NK8YZ5MKkUnXkwqRTfZB50laKrFJ15MKkUTxzWushhrYsc1rrIh9+YB12l6CpFZx48USkm5sEblaIzD/6mStGZB12leKNSdOZBVyneMA+6SjGpFBPz4AnzoKsUk8NaFzmsdZHDWhf58fMXBubBG5WiMw+6SjExD7pK0ZkHk0rRmQeTSjExD56oFJ158ESl+JvMg2+qFG+YB12l6A5rXeSw1kUOa13kwx9UiifMg8486CpFZx48YR50lWJiHkwqRWceTCrFxDyYVIrOPOgqRWcevFEpOvNgUikm5kFXKTrzoKsU33RY6yKHtS5yWOsiP37+QmMedJXiCfPgjUoxMQ+eqBRvmAddpZiYB5NKMTEP3qgU32QedJWiMw8mlaIzD7pK8cRhrYsc1rrIYa2L/Pj5Cw+YB12l6MyDrlJMzINJpejMg65SdObBN1WKzjzoKsXEPJhUiifMg65S/EvmwTdVis486CpFd1jrIoe1LnJY6yIffmMedJXim8yDrlJ8U6X4JvOgqxSdedBViq5SdOZBZx50leIJ82BSKZ4wDyaV4g3zYFIpJoe1LnJY6yKHtS7y4+cvNOZBVykm5kFXKZ4wD7pK8YZ5MKkUE/OgqxRPmAddpXjCPJhUim8yD7pK0ZkHf1Ol6MyDrlJ0h7UucljrIoe1LvLhD8yDrlJ0laIzD77JPOgqxTeZB12lmJgHXaV4wjyYVIonzIOuUnTmQVcpukrRmQeTStGZB12l6MyDbzqsdZHDWhc5rHWRD39QKSbmwROV4g3z4IlK8U2VojMPnqgUE/OgqxSTStGZB12leKNSdOZBVyk686CrFN90WOsih7UucljrIh8eMg8mlWJiHkwqxaRSTMyDiXnQVYqJedBVikmlmJgHXaXoKsXEPOgqxcQ8mFSKiXkwMQ+eMA8mlWJyWOsih7UucljrIh9+UykmleKNSjExD54wD7pK0ZkHXaXozIOuUvxNleIJ86CrFJ158IZ5MKkUT5gHf9NhrYsc1rrIYa2LfPiNefAvVYquUjxRKZ4wD7pK0ZkHT1SKiXnQVYo3zINJpZiYB2+YB12lmJgH33RY6yKHtS5yWOsiH/6gUnyTefCEedBVijcqRWcePGEedJWiMw+6StGZB29Uis48mJgHXaXozIMnKsUbleKNw1oXOax1kcNaF/nwkHnwRKV4o1J05sHfVCk686CrFJ150FWKzjz4l8yDiXnwhHnwN5kHk0rRHda6yGGtixzWusiHy1WKNyrFE+ZBVykmlaIzD56oFJNK0ZkHXaXozIOuUnTmQVcp/qVKMTmsdZHDWhc5rHWRD/9x5kFXKZ4wDyaV4g3zoKsUk0rxhnnwN1WKiXnwRKWYVIonDmtd5LDWRQ5rXeTDQ5Xi/8k86CpFZx50leIJ82BSKTrzoDMPukrRmQddpejMg65SdJWiMw+6SjGpFE+YB12l6MyDJ8yDrlJ05kFXKbrDWhc5rHWRw1oX+fHzFxrz4F+qFJ15MKkUnXnwRKV4wjyYVIqJeTCpFJ158DdViv8n86CrFE8c1rrIYa2LHNa6yI+fv7DWJQ5rXeSw1kUOa13kf05asKzUmGAPAAAAAElFTkSuQmCC', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-10 20:25:14', NULL),
(5, 'VET001', 'veterinaire@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'Dr. NKURUNZIZA Emmanuel', '+257 79 567 890', 'INSS', 'veterinaire', 5, '2024-02-15', 1500000.00, 'actif', '1986-09-25', 'Chauss├®e de Prince Luis Gwagasore, Q. Buyenzi', 'Bujumbura', 'Burundi', 'CNSS-2024-005', 22, 'BDI-005-567890123', 'Banque de Gestion et de Financement', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKwAAACsCAYAAADmMUfYAAAAAklEQVR4AewaftIAAAo7SURBVO3B0W1ky45FwaVE+UFDaNe2gnbREFqip0+iP7KROKXqmzOM+Pr+wRiXWIxxkcUYF1mMcZEXfzAPPqlSdOZBVyk686CrFDvmQVcpdsyDnUqxYx50laIzD/5LKsUJ8+CTKkW3GOMiizEushjjIi/+olK8k3lwwjzYMQ9OmAcnKkVnHnSVoqsUnXnwSZXikyrFO5kHO4sxLrIY4yKLMS7y4pB5cKJSPFEpTpgHv6lSdObBTqXozIOuUuyYB12l6MyDzjzoKkVnHuxUiifMgxOV4sRijIssxrjIYoyLvPiPqRSdedBVip1K0ZkHXaXozIOuUuyYB12l6MyDnUrRmQc7laIzD56oFDvmQVcp/ksWY1xkMcZFFmNc5MV/jHmwYx50laIzD7pK8YR50FWKE+ZBVym6SrFjHnSVojMPukrRmQf/lyzGuMhijIssxrjIi0OV4jdVis486CrFTqXozIOuUnSVojMPTpgHXaXozIPOPOgqRWcedJXiiUrRmQddpXinSvGbFmNcZDHGRRZjXOTFX5gHn2QedJWiMw+6StGZB12l6MyDrlLsVIrOPOgqRWcedJWiMw+eMA+6StGZB12lOGEedJVixzz4pMUYF1mMcZHFGBd58YdK8S9Vis482DEPukrRmQddpejMg65SnDAPTlSKzjzoKkVnHnSVojMPPqlS/EuLMS6yGOMiizEu8uIP5kFXKXbMg99UKU6YB12leMI8eCfzYMc86CpFZx6cMA+6SrFTKTrzoKsUO+ZBVyk68+BEpegWY1xkMcZFFmNc5Ov7B29kHnSVYsc86CrFjnnwL1WKdzIPdipFZx7sVIod8+BEpejMg65SvJN50FWKbjHGRRZjXGQxxkVe/IV50FWKzjzYMQ/eqVJ05kFXKXbMg65SdObBv1QpOvOgqxSdefBEpejMg8482DEPTlSKzjw4sRjjIosxLrIY4yIv/mAedJWiMw92KsUJ8+CJSvGEebBTKU6YBzuV4jeZB+9UKTrz4ESleKfFGBdZjHGRxRgXeXGoUjxhHnSVojMP3qlSdJWiMw+6SrFjHjxhHjxhHjxRKZ6oFJ150FWKzjzoKsUTizEushjjIosxLvLikHnQVYoTleKJSrFjHpyoFJ150FWKrlJ05kFXKTrzYKdSdOZBVyk686CrFJ150FWKzjzYqRQ75sGOebBjHjyxGOMiizEushjjIi/+UCneyTx4olLsmAcnzIOuUnSV4kSleKdK0ZkHXaXozIOuUuxUihPmwU6l2DEPTlSKncUYF1mMcZHFGBd5cahSPFEpdsyDJyrFTqXozIMTlaIzD7pK8YR50FWKnUqxYx50laIzD3YqxY550FWKrlJ05sGOedBVim4xxkUWY1xkMcZFvr5/0JgHO5VixzzoKkVnHnSVYsc86CrFCfOgqxSdedBVis48eKJS7JgH71QpOvOgqxQnzIOuUnTmQVcpftNijIssxrjIYoyLvPiLStGZB12lOFEpOvNgp1J05sFOpegqxU6l2KkUO+ZBVymeqBQnzIMT5kFXKTrz4AnzoKsUnXnQVYoTizEushjjIosxLvLizSrFjnnwSeZBVyk682CnUuxUih3z4DdVis486CpFZx7sVIpPMg92KkW3GOMiizEushjjIl/fP2jMg65SPGEedJWiMw+6StGZBzuVYsc8+JcqRWcedJXiN5kH/1Kl2DEPukqxsxjjIosxLrIY4yIv3sw82DEPnqgU71QpOvOgqxQ75sGOebBjHjxRKZ6oFJ150FWKzjzoKkVnHjxhHnSVoluMcZHFGBdZjHGRF3+oFJ15sFMpTlSKzjzYqRTvVCk686CrFDvmQVcpOvNgp1J05sFOpdgxD7pKccI8OFEpdipFZx6cqBQ7izEushjjIosxLvL1/YNfZB48USl2zIMTlWLHPHinSnHCPHiiUnTmQVcpdsyDT6oUJxZjXGQxxkUWY1zkxR/MgxOVYqdSnDAPdsyDrlJ05sEJ8+CJSnHCPOgqRVcpdsyDrlJ05sEJ86CrFDvmwYlK0ZkHTyzGuMhijIssxrjI1/cPHjAPdipFZx50leIJ86CrFDvmwU6l2DEPukrRmQddpejMgxOVYsc86CrFCfPgRKX4TeZBVym6xRgXWYxxkcUYF/n6/sEB86CrFDvmQVcpTpgHXaXYMQ92KkVnHnSV4oR50FWKzjzoKkVnHnSVojMPukrRmQc7laIzD7pK0ZkHJyrFjnlwolLsLMa4yGKMiyzGuMiLvzAPTpgHXaXozIOuUuxUis486CrFTqXozIOuUvxLlaIzD7pK8U6VojMPTlSKzjx4olKcWIxxkcUYF1mMcZGv7x805kFXKTrz4ESl2DEPdipFZx50lWLHPOgqxY55sFMpOvOgqxQ75kFXKXbMg65SPGEedJXihHnwSZWiW4xxkcUYF1mMcZEXhypFZx7smAc7laIzDzrzoKsUn1QpOvOgqxTvZB6cMA+6SrFTKZ6oFJ150FWKJ8yDncUYF1mMcZHFGBd58RfmQVcpukrRmQc7leI3mQcnzIMd86CrFO9kHnSVYsc86CrFjnnQVYod86CrFJ150FWKzjw4USlOLMa4yGKMiyzGuMiLh8yDE+ZBVylOmAc7laIzDzrzoKsUO+bBjnnQVYrOPNipFJ15sFMpOvPghHnQVYod86CrFJ150FWKzjzYMQ+6SrGzGOMiizEushjjIi8OmQdPVIrOPOgqxY55sGMedJXik8yDnUrRmQddpejMg3eqFJ15sFMpOvOgqxSdefCbFmNcZDHGRRZjXOTFm1WKzjzozIOuUjxRKZ4wD3YqxTuZBzvmQVcpnqgUnXlwwjzYMQ+eqBSdedBVim4xxkUWY1xkMcZFvr5/8B9iHpyoFJ150FWKzjzYqRQ75kFXKXbMg51K8U7mwU6l2DEPukpxwjx4olLsLMa4yGKMiyzGuMjX9w8a8+CTKkVnHnSV4gnzoKsUnXnwTpVixzzYqRQ75kFXKXbMg51K0ZkHXaXozIOuUnTmwROVYmcxxkUWY1xkMcZFXvxFpXgn8+AJ82CnUuyYBzuVojMPukpxwjw4YR50laKrFP9SpThRKTrzoKsUnXnQVYpuMcZFFmNcZDHGRV4cMg9OVIonzIOdSrFTKXbMgxPmQVcpTlSKHfOgMw+eqBSdeXDCPPhN5sGJxRgXWYxxkcUYF3nx/1yl6MyDnUrRmQc7leKTKsUJ82CnUvymStGZBzuLMS6yGOMiizEu8uI/plLsmAededBVis486CrFiUrRmQddpejMgx3zYKdSdObBCfOgqxQnKsUJ82CnUnSVojMPTizGuMhijIssxrjIi0OV4pPMg65SfJJ5sGMePFEpdirFjnlwolKcMA+6SnHCPOgqRVcpOvNgZzHGRRZjXGQxxkVe/IV58EnmwY55sFMpdsyDd6oUO+bBjnlwolL8JvOgqxQnKsWOedBViq5S7CzGuMhijIssxrjI1/cPxrjEYoyLLMa4yGKMi/wPDtuZQJ4CykUAAAAASUVORK5CYII=', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(6, 'CHF001', 'chauffeur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'BIGIRIMANA Léonard', '+257 79 678 901', 'INSS', 'chauffeur', 6, '2024-03-01', 800000.00, 'actif', '1992-12-08', 'Avenue de la Victoire, Q. Kamenge', 'Bujumbura', 'Burundi', 'CNSS-2024-006', 20, 'BDI-006-678901234', 'Ecobank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-10 20:25:14', NULL),
(7, 'AGR001', 'agriculteur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NDIKUMANA Josué', '+257 79 789 012', 'INSS', 'agriculteur', 4, '2024-03-15', 750000.00, 'actif', '1994-04-12', 'Quartier Kanyosha', 'Bujumbura', 'Burundi', 'CNSS-2024-007', 20, 'BDI-007-789012345', 'Banque de Crédit de Bujumbura', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-10 20:25:14', NULL),
(8, 'TEC001', 'technicien1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NSHIMIRIMANA David', '+257 79 890 123', 'INSS', 'technicien', 8, '2024-04-01', 950000.00, 'actif', '1991-08-20', 'Avenue de la Paix, Q. Bwiza', 'Bujumbura', 'Burundi', 'CNSS-2024-008', 20, 'BDI-008-890123456', 'Interbank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(9, 'EMP001', 'employe1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NAHIMANA Didier', '+257 79 901 234', 'INSS', 'employe', 7, '2024-04-15', 650000.00, 'actif', '1995-06-30', 'Chauss├®e Prince Louis Rwagasore, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-009', 20, 'BDI-009-901234567', 'BCB - Banque Commerciale du Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(10, 'TPT001', 'partiel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'IRAKOZE Aimée', '+257 79 012 345', 'temps_partiel', 'employe', 9, '2024-05-01', 400000.00, 'actif', '1997-02-14', 'Avenue de lIndustrie, Q. Ngagara', 'Bujumbura', 'Burundi', NULL, 12, NULL, NULL, 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-10 20:25:14', NULL),
(11, 'TPT002', 'partiel2@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'BIZIMANA Clarisse', '+257 79 123 456', 'temps_partiel', 'employe', 4, '2024-05-15', 350000.00, 'actif', '1998-10-05', 'Quartier Mutanga Sud', 'Bujumbura', 'Burundi', NULL, 12, NULL, NULL, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKwAAACsCAYAAADmMUfYAAAAAklEQVR4AewaftIAAAowSURBVO3BwW1sOQxFwWOh82AgjOtGwbgYCCPxeEn8hQzhtT0WwKqPzy+McYnFGBdZjHGRxRgXefEP8+A3VYoT5sFOpXgn8+BEpejMgxOVYsc86CpFZx50lWLHPOgqxY558JsqRbcY4yKLMS6yGOMiL75RKd7JPHiiUuyYBycqxYlK8USleKJSdObBCfOgqxRPVIp3Mg92FmNcZDHGRRZjXOTFIfPgRKU4YR50laIzD56oFE+YB12l6MyDJ8yDrlJ05sE7mQddpXjCPDhRKU4sxrjIYoyLLMa4yIvLVIod86CrFJ150FWKnUqxYx50laIzD96pUpwwD3YqRWcedJXiL1mMcZHFGBdZjHGRF3+cedBVihPmwY550FWKHfNgxzz4SebBO5kHXaX4yxZjXGQxxkUWY1zkxaFK8ZsqRWce7FSKHfOgqxSdedBVip1KsWMedOZBVyl2zIOuUuyYB12l+E2V4ictxrjIYoyLLMa4yItvmAd/WaXozIOuUvwm86CrFJ15cKJSdOZBVylOmAddpejMg65S7JgHv2kxxkUWY1xkMcZFPj6/8IeYBzuVojMPukrRmQdPVIrOPNipFJ15cKJSnDAPukqxYx7sVIq/bDHGRRZjXGQxxkU+Pr/QmAddpejMg3eqFH+JedBVihPmQVcpTpgHv6lSnDAP3qlSnFiMcZHFGBdZjHGRF4cqxY55sFMpOvPgRKXozIOuUnTmwRPmQVcpTpgHXaXozIOuUjxhHpwwD7pK8U6VojMPOvNgp1J0izEushjjIosxLvLx+YUD5sGJStGZB12l6MyDrlJ05kFXKU6YBycqRWcedJVixzzYqRSdefBEpejMg51K0ZkHO5Vixzw4USlOLMa4yGKMiyzGuMiLX1YpdirFO5kHO5WiMw92KsWOebBTKXYqxY55sGMedJWiMw92KsWOeXCiUuyYB12l2FmMcZHFGBdZjHGRF98wD7pK0ZkHXaXYMQ92KkVnHnSV4olKccI86CrFiUqxYx50laIzD7pK0ZkHO+bBCfOgqxRdpXjCPOgqxYnFGBdZjHGRxRgX+fj8QmMenKgUP8k86CpFZx7sVIrOPOgqRWcedJXiCfOgqxS/yTx4olJ05sGJSrFjHuxUim4xxkUWY1xkMcZFXvyjUnTmwQnz4ESleKJSdObBCfOgqxSdebBTKTrzoKsUJ8yDrlL8pErRmQededBViifMg51KsbMY4yKLMS6yGOMiLw5Vis482KkUJ8yDrlJ05sFOpejMgxPmQVcpOvNgp1J05kFXKTrzoKsUJ8yDnUrRmQdPmAddpejMg65SdJXiicUYF1mMcZHFGBf5+PxCYx7sVIrOPOgqRWcevFOleMI86CrFjnmwUylOmAc/qVJ05sGJStGZB12leMI86CrFicUYF1mMcZHFGBf5+PxCYx7sVIrOPDhRKTrzoKsUnXmwUyk68+CJSrFjHvykSrFjHnSVojMPukrRmQc7lWLHPOgqRWcedJXihHnQVYpuMcZFFmNcZDHGRV78o1LsmAcnKkVnHnSVYqdSvFOl6MyDzjzoKsVOpejMgxOVojMPukrRVYrOPNgxD3YqRWcedJXincyDnUqxsxjjIosxLrIY4yIv3qxS7FSKzjzYqRQ75sETlaIzD3YqxYlK0ZkHJ8yDrlKcqBSdeXDCPNgxD05Uis48OLEY4yKLMS6yGOMiL/5hHnSVoqsUT5gHXaXozIO/zDzoKsVfUik68+BEpThhHnSVYsc8eGIxxkUWY1xkMcZFXnzDPNipFDvmQVcpOvPghHmwUyk682DHPDhRKTrzYMc82DEPukrRmQdPVIod86CrFJ15cMI86CrFTqXozIOuUnSLMS6yGOMiizEu8uIflWLHPNgxD7pK0ZkHXaXozIMnzIOuUnTmwU6lOFEpOvOgqxQ75kFnHnSV4gnzYKdSdObBO5kHXaXYqRQ7izEushjjIosxLvLiIfNgxzzoKsUTleKEedBViifMg65SdJWiMw+6SvGEedBVip1K0ZkHJyrFjnnwmxZjXGQxxkUWY1zkxTfMg65SPGEedJVixzzoKkVnHnSV4oR58E7mQVcpnjAPdsyDE5WiMw/eqVLsmAddpTixGOMiizEushjjIi/+YR6cMA9OVIonzIOuUnTmQVcpTlSKn2Qe7FSKzjzoKsWOedBVis482KkUO+bBjnnQVYquUuyYB12l6BZjXGQxxkUWY1zk4/MLD5gHXaXozIMTlWLHPOgqRWcedJXihHlwolLsmAc7lWLHPPhJlaIzD7pK8U7mQVcpTizGuMhijIssxrjIi2+YBzuVYqdSnDAPukrRVYqdSvFOlWLHPOgqxU6l+EmVYsc82KkUnXnQVYod82CnUnTmwU6l6BZjXGQxxkUWY1zk4/MLv8g82KkUnXnQVYrOPOgqRWcedJWiMw+6StGZB12leMI86CrFjnnQVYrOPHiiUvwm82CnUuwsxrjIYoyLLMa4yMfnFxrzoKsUO+bBTqV4J/OgqxSdefCTKsWOebBTKXbMg65SvJN58E6VojMPukqxYx7sVIpuMcZFFmNcZDHGRV4cMg+6StGZBzvmQVcpdsyDHfPgRKXozIOuUpwwD7pK0ZkHnXmwUyk686CrFJ150FWKzjzYqRSdefCTzIOuUpxYjHGRxRgXWYxxkRcPmQcnKkVnHuxUih3zoKsUT5gHXaXozIMd82CnUuyYB12l6MyDE5WiMw92KkVnHuyYB12l2KkUO+ZBVym6xRgXWYxxkcUYF3nxy8yDrlJ05sGOefCEeXDCPDhRKXbMg51K8U7mQVcpdsyDJ8yDrlJ05sFOpdhZjHGRxRgXWYxxkRf/qBQ7leKJSvFEpejMgx3zoKsUnXnwTubBTqXozIMd82CnUnTmwTtVihPmQWce7FSKzjzoKkW3GOMiizEushjjIi/+YR78pkrRVYod86CrFJ150FWKE5WiMw+6SrFjHuyYB12lOFEpOvOgqxSdedCZB0+YB12l2KkUO+ZBVyl2FmNcZDHGRRZjXOTFNyrFO5kHO+bBE5XiRKU4YR50laKrFJ150FWKzjzoKkVXKU6YB12l6MyDJyrF/2kxxkUWY1xkMcZFXhwyD05UiicqxY550FWKzjzoKkVnHuxUih3zoKsUT5gHXaX4SZWiMw868+CdzIMnFmNcZDHGRRZjXOTFH2ce7FSKzjzoKkVnHjxhHuyYB12l2KkUnXnwTuZBVyl2KkVnHnSV4oR5cMI86CpFtxjjIosxLrIY4yIv/rhK0ZkHO5XiN1WKn2QedJVip1K8U6XozIMnKkVnHnSVYmcxxkUWY1xkMcZFXhyqFD+pUvwl5sEJ82CnUnTmwU6l6MyDn2QedJXiL1mMcZHFGBdZjHGRF98wD36TedBVineqFJ15sFMpOvOgMw+6SnGiUuyYB0+YB12l6MyDrlKcqBQnzIOuUpxYjHGRxRgXWYxxkY/PL4xxicUYF1mMcZHFGBf5D+6JkNQOEw5VAAAAAElFTkSuQmCC', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL),
(12, 'CTR001', 'contractuel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'NIYONZIMA Freddy', '+257 79 234 567', 'contractuel', 'employe', 5, '2024-06-01', 550000.00, 'actif', '1996-03-22', 'Avenue de la Libert├®, Q. Buyenzi', 'Bujumbura', 'Burundi', NULL, 15, NULL, NULL, 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-09 19:52:06', NULL);

--
-- Déclencheurs `employes`
--
DELIMITER $$
CREATE TRIGGER `trg_employes_after_insert` AFTER INSERT ON `employes` FOR EACH ROW BEGIN
    -- Insérer dans utilisateurs en gérant les NULL
    INSERT INTO `utilisateurs` (
        `id`,
        `matricule`,
        `email`,
        `mot_de_passe_hash`,
        `nom_complet`,
        `telephone`,
        `type_employe`,
        `role`,
        `id_departement`,
        `date_embauche`,
        `date_naissance`,
        `adresse`,
        `ville`,
        `pays`,
        `numero_cnss`,
        `salaire_base`,
        `jours_conges_annuels`,
        `compte_bancaire`,
        `nom_banque`,
        `qr_code`,
        `donnees_biometriques`,
        `photo_identite`,
        `derniere_connexion`,
        `nombre_connexions`,
        `doit_changer_mdp`,
        `date_modification_mdp`,
        `statut`,
        `date_depart`,
        `raison_depart`,
        `cree_par`,
        `modifie_par`
    ) VALUES (
        NEW.id,
        NEW.matricule,
        NEW.email,
        COALESCE(NEW.mot_de_passe_hash, ''),
        NEW.nom_complet,
        NEW.telephone,
        NEW.type_employe,
        NEW.role,
        NEW.id_departement,
        NEW.date_embauche,
        NEW.date_naissance,  -- NULL accepté
        NEW.adresse,         -- NULL accepté
        NEW.ville,           -- NULL accepté
        COALESCE(NEW.pays, 'RDC'),
        NEW.numero_cnss,     -- NULL accepté
        NEW.salaire_base,
        COALESCE(NEW.jours_conges_annuels, 20),
        NEW.compte_bancaire, -- NULL accepté
        NEW.nom_banque,      -- NULL accepté
        NEW.qr_code,         -- NULL accepté
        NEW.donnees_biometriques,  -- NULL accepté
        NEW.photo_identite,  -- NULL accepté
        NEW.derniere_connexion,    -- NULL accepté
        COALESCE(NEW.nombre_connexions, 0),
        COALESCE(NEW.doit_changer_mdp, 1),
        NEW.date_modification_mdp,  -- NULL accepté
        NEW.statut,
        NEW.date_depart,     -- NULL accepté
        NEW.raison_depart,   -- NULL accepté
        NEW.cree_par,        -- NULL accepté
        NEW.modifie_par      -- NULL accepté
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_employes_after_update` AFTER UPDATE ON `employes` FOR EACH ROW BEGIN
    UPDATE `utilisateurs` SET
        `matricule` = NEW.matricule,
        `email` = NEW.email,
        `mot_de_passe_hash` = COALESCE(NEW.mot_de_passe_hash, ''),
        `nom_complet` = NEW.nom_complet,
        `telephone` = NEW.telephone,
        `type_employe` = NEW.type_employe,
        `role` = NEW.role,
        `id_departement` = NEW.id_departement,
        `date_embauche` = NEW.date_embauche,
        `date_naissance` = NEW.date_naissance,
        `adresse` = NEW.adresse,
        `ville` = NEW.ville,
        `pays` = COALESCE(NEW.pays, 'RDC'),
        `numero_cnss` = NEW.numero_cnss,
        `salaire_base` = NEW.salaire_base,
        `jours_conges_annuels` = COALESCE(NEW.jours_conges_annuels, 20),
        `compte_bancaire` = NEW.compte_bancaire,
        `nom_banque` = NEW.nom_banque,
        `qr_code` = NEW.qr_code,
        `donnees_biometriques` = NEW.donnees_biometriques,
        `photo_identite` = NEW.photo_identite,
        `derniere_connexion` = NEW.derniere_connexion,
        `nombre_connexions` = COALESCE(NEW.nombre_connexions, 0),
        `doit_changer_mdp` = COALESCE(NEW.doit_changer_mdp, 1),
        `date_modification_mdp` = NEW.date_modification_mdp,
        `statut` = NEW.statut,
        `date_depart` = NEW.date_depart,
        `raison_depart` = NEW.raison_depart,
        `modifie_par` = NEW.modifie_par,
        `date_modification` = NEW.date_modification
    WHERE `id` = NEW.id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `evaluations_performance`
--

CREATE TABLE `evaluations_performance` (
  `id` int NOT NULL,
  `id_employe` int NOT NULL,
  `id_evaluateur` int NOT NULL,
  `date_evaluation` date NOT NULL,
  `periode_debut` date NOT NULL,
  `periode_fin` date NOT NULL,
  `note_performance` decimal(5,2) NOT NULL COMMENT 'Note sur 100',
  `competences_techniques` decimal(5,2) DEFAULT NULL,
  `ponctualite` decimal(5,2) DEFAULT NULL,
  `qualite_travail` decimal(5,2) DEFAULT NULL,
  `esprit_equipe` decimal(5,2) DEFAULT NULL,
  `initiative` decimal(5,2) DEFAULT NULL,
  `points_forts` text COLLATE utf8mb4_unicode_ci,
  `axes_amelioration` text COLLATE utf8mb4_unicode_ci,
  `objectifs` text COLLATE utf8mb4_unicode_ci,
  `commentaires` text COLLATE utf8mb4_unicode_ci,
  `statut` enum('brouillon','finalise','valide') COLLATE utf8mb4_unicode_ci DEFAULT 'brouillon',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `factures`
--

CREATE TABLE `factures` (
  `id` int NOT NULL,
  `numero_facture` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_facture` enum('achat','vente','avoir') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_commande` int DEFAULT NULL,
  `id_fournisseur` int DEFAULT NULL,
  `id_client` int DEFAULT NULL,
  `date_facture` date NOT NULL,
  `date_echeance` date NOT NULL,
  `montant_ht` decimal(12,2) NOT NULL DEFAULT '0.00',
  `montant_tva` decimal(12,2) NOT NULL DEFAULT '0.00',
  `montant_ttc` decimal(12,2) NOT NULL DEFAULT '0.00',
  `montant_regle` decimal(12,2) DEFAULT '0.00',
  `montant_du` decimal(12,2) DEFAULT '0.00',
  `statut_paiement` enum('impayee','partiellement_payee','payee','en_retard') COLLATE utf8mb4_unicode_ci DEFAULT 'impayee',
  `date_dernier_paiement` date DEFAULT NULL,
  `mode_reglement` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre_relances` int DEFAULT '0',
  `date_derniere_relance` date DEFAULT NULL,
  `chemin_fichier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scan_quittance` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cree_par` int NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modifie_par` int DEFAULT NULL,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `fournisseurs`
--

CREATE TABLE `fournisseurs` (
  `id` int NOT NULL,
  `code_fournisseur` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_fournisseur` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('agricole','elevage','automobile','general','intrant','aliment','equipement') COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_principal` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adresse` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pays` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'RDC',
  `numero_registre` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_tva` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_compte` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note_evaluation` decimal(3,2) DEFAULT '0.00',
  `nombre_achats` int DEFAULT '0',
  `montant_total_achats` decimal(15,2) DEFAULT '0.00',
  `limite_credit` decimal(12,2) DEFAULT '0.00',
  `solde_actuel` decimal(12,2) DEFAULT '0.00',
  `conditions_paiement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT '30 jours',
  `statut` enum('actif','inactif','suspendu') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `motif_suspension` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `frais_vehicules`
--

CREATE TABLE `frais_vehicules` (
  `id` int NOT NULL,
  `id_mouvement` int NOT NULL,
  `type_frais` enum('carburant','peage','parking','reparation','autre','versement_journalier') COLLATE utf8mb4_unicode_ci NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `date` date NOT NULL,
  `piece_justificative` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valide` tinyint(1) DEFAULT '0',
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `montant_cumule_jour` decimal(10,2) DEFAULT NULL COMMENT 'Cumul des versements du jour (pour versement_journalier)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `frais_vehicules`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_frais_vehicule` AFTER INSERT ON `frais_vehicules` FOR EACH ROW BEGIN
    DECLARE v_chauffeur_id INT;
    DECLARE v_chauffeur_nom VARCHAR(150);
    DECLARE v_vehicule_immat VARCHAR(20);
    DECLARE v_categorie VARCHAR(50);
    DECLARE v_type_mouvement VARCHAR(20);
    DECLARE v_compte_debit VARCHAR(50);
    DECLARE v_compte_credit VARCHAR(50);
    DECLARE v_libelle VARCHAR(255);
    
    SELECT 
        m.id_chauffeur,
        u.nom_complet,
        v.immatriculation
    INTO 
        v_chauffeur_id,
        v_chauffeur_nom,
        v_vehicule_immat
    FROM mouvements_vehicules m
    JOIN utilisateurs u ON m.id_chauffeur = u.id
    JOIN vehicules v ON m.id_vehicule = v.id
    WHERE m.id = NEW.id_mouvement
    LIMIT 1;
    
    IF v_chauffeur_id IS NULL THEN
        SELECT 
            v.id_chauffeur_attitre,
            u.nom_complet,
            v.immatriculation
        INTO 
            v_chauffeur_id,
            v_chauffeur_nom,
            v_vehicule_immat
        FROM vehicules v
        JOIN utilisateurs u ON v.id_chauffeur_attitre = u.id
        LIMIT 1;
    END IF;
    
    CASE NEW.type_frais
        WHEN 'versement_journalier' THEN BEGIN
            SET v_categorie = 'vente';
            SET v_type_mouvement = 'recette';
            SET v_compte_debit = '512 - Banque';
            SET v_compte_credit = '707 - Ventes produits finis';
            SET v_libelle = CONCAT('Versement journalier - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
        WHEN 'carburant' THEN BEGIN
            SET v_categorie = 'achat';
            SET v_type_mouvement = 'depense';
            SET v_compte_debit = '606 - Achats de carburant';
            SET v_compte_credit = '512 - Banque';
            SET v_libelle = CONCAT('Carburant - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
        WHEN 'reparation' THEN BEGIN
            SET v_categorie = 'maintenance';
            SET v_type_mouvement = 'depense';
            SET v_compte_debit = '615 - Entretien et réparations';
            SET v_compte_credit = '401 - Fournisseurs';
            SET v_libelle = CONCAT('Réparation - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
        WHEN 'peage' THEN BEGIN
            SET v_categorie = 'autre';
            SET v_type_mouvement = 'depense';
            SET v_compte_debit = '625 - Déplacements et péages';
            SET v_compte_credit = '512 - Banque';
            SET v_libelle = CONCAT('Péage - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
        WHEN 'parking' THEN BEGIN
            SET v_categorie = 'autre';
            SET v_type_mouvement = 'depense';
            SET v_compte_debit = '625 - Déplacements et stationnement';
            SET v_compte_credit = '512 - Banque';
            SET v_libelle = CONCAT('Parking - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
        ELSE BEGIN
            SET v_categorie = 'autre';
            SET v_type_mouvement = 'depense';
            SET v_compte_debit = '628 - Autres charges';
            SET v_compte_credit = '512 - Banque';
            SET v_libelle = CONCAT('Frais divers - ', IFNULL(v_vehicule_immat, 'N/A'));
        END;
    END CASE;
    
    CALL enregistrer_journal_comptable(
        v_categorie,
        v_type_mouvement,
        v_libelle,
        NEW.description,
        NEW.montant,
        NULL,
        NULL,
        v_compte_debit,
        v_compte_credit,
        'frais_vehicules',
        NEW.id,
        'autre',
        NULL,
        IFNULL(v_chauffeur_nom, 'N/A'),
        IFNULL(v_chauffeur_id, 1),
        CONCAT('FRAIS-', NEW.id),
        JSON_OBJECT(
            'type_frais', NEW.type_frais,
            'vehicule', IFNULL(v_vehicule_immat, 'N/A'),
            'chauffeur', IFNULL(v_chauffeur_nom, 'N/A'),
            'id_mouvement', NEW.id_mouvement
        )
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `intrants_agricoles`
--

CREATE TABLE `intrants_agricoles` (
  `id` int NOT NULL,
  `code_intrant` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_intrant` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('engrais_chimique','engrais_organique','pesticide','herbicide','fongicide','semence','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `marque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `composition` text COLLATE utf8mb4_unicode_ci,
  `dosage_recommande` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delai_attente_jours` int DEFAULT NULL COMMENT 'Délai avant récolte',
  `unite_mesure` enum('kg','litre','sac','unite','carton') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantite_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `seuil_alerte` decimal(10,2) NOT NULL DEFAULT '10.00',
  `emplacement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prix_unitaire_achat` decimal(8,2) NOT NULL,
  `prix_unitaire_vente` decimal(8,2) DEFAULT NULL,
  `fournisseur_principal` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `classe_toxicite` enum('I','II','III','IV') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `precautions` text COLLATE utf8mb4_unicode_ci,
  `statut` enum('actif','inactif','epuise') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `journal_comptable`
--

CREATE TABLE `journal_comptable` (
  `id` int NOT NULL,
  `numero_ecriture` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_operation` date NOT NULL,
  `heure_operation` time NOT NULL,
  `categorie` enum('stock','paiement','vente','achat','salaire','production','maintenance','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_mouvement` enum('entree','sortie','recette','depense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sous_categorie` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `libelle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `reference_externe` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Référence de la transaction source',
  `montant` decimal(15,2) DEFAULT NULL,
  `quantite` decimal(10,2) DEFAULT NULL,
  `unite_mesure` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `compte_debit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `compte_credit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `table_source` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Table d''origine',
  `id_source` int NOT NULL COMMENT 'ID dans la table source',
  `tiers_type` enum('client','fournisseur','employe','autre') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tiers_id` int DEFAULT NULL,
  `tiers_nom` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` enum('brouillon','valide','lettre','rapproche') COLLATE utf8mb4_unicode_ci DEFAULT 'valide',
  `exercice_comptable` int NOT NULL,
  `periode_comptable` int NOT NULL COMMENT 'Mois de l''exercice',
  `effectue_par` int NOT NULL COMMENT 'Utilisateur ayant effectué l''action',
  `effectue_par_nom` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `effectue_par_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `rapproche` tinyint(1) DEFAULT '0',
  `date_rapprochement` date DEFAULT NULL,
  `rapproche_par` int DEFAULT NULL,
  `donnees_complementaires` json DEFAULT NULL COMMENT 'Données additionnelles spécifiques',
  `commentaire` text COLLATE utf8mb4_unicode_ci,
  `piece_jointe` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `journal_comptable`
--

INSERT INTO `journal_comptable` (`id`, `numero_ecriture`, `date_operation`, `heure_operation`, `categorie`, `type_mouvement`, `sous_categorie`, `libelle`, `description`, `reference_externe`, `montant`, `quantite`, `unite_mesure`, `compte_debit`, `compte_credit`, `table_source`, `id_source`, `tiers_type`, `tiers_id`, `tiers_nom`, `statut`, `exercice_comptable`, `periode_comptable`, `effectue_par`, `effectue_par_nom`, `effectue_par_role`, `ip_address`, `valide_par`, `date_validation`, `rapproche`, `date_rapprochement`, `rapproche_par`, `donnees_complementaires`, `commentaire`, `piece_jointe`, `date_creation`, `date_modification`) VALUES
(1, 'JNL-20260212-000001', '2026-02-12', '00:18:00', 'achat', 'depense', NULL, 'Achat véhicule - AB-4567-BI', 'Achat TOYOTA HILUX - AB-4567-BI', 'AB-4567-BI', 65000000.00, NULL, NULL, '218 - Matériel de transport', '401 - Fournisseurs', 'vehicules', 1, NULL, NULL, NULL, 'valide', 2026, 2, 1, 'NIYONGABO Jean Claude', 'admin', NULL, NULL, NULL, 0, NULL, NULL, '{\"marque\": \"TOYOTA\", \"modele\": \"HILUX\", \"date_achat\": \"2026-02-11T22:16:37.241Z\", \"type_vehicule\": \"camion\"}', NULL, NULL, '2026-02-11 22:18:00', '2026-02-11 22:18:00');

-- --------------------------------------------------------

--
-- Structure de la table `lignes_commande_achat`
--

CREATE TABLE `lignes_commande_achat` (
  `id` int NOT NULL,
  `id_commande_achat` int NOT NULL,
  `type_article` enum('intrant','aliment','vehicule','piece','animal','equipement','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_article` int DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantite_commandee` decimal(10,2) NOT NULL,
  `quantite_livree` decimal(10,2) DEFAULT '0.00',
  `unite` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prix_unitaire_ht` decimal(10,2) NOT NULL,
  `remise_pourcent` decimal(5,2) DEFAULT '0.00',
  `tva_pourcent` decimal(5,2) DEFAULT '0.00',
  `montant_ht` decimal(12,2) DEFAULT '0.00',
  `montant_tva` decimal(12,2) DEFAULT '0.00',
  `montant_ttc` decimal(12,2) DEFAULT '0.00',
  `date_livraison_prevue` date DEFAULT NULL,
  `date_livraison_reelle` date DEFAULT NULL,
  `statut_livraison` enum('en_attente','partielle','complete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `qualite_reception` enum('bonne','mauvaise','retournee') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarques_reception` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lignes_commande_vente`
--

CREATE TABLE `lignes_commande_vente` (
  `id` int NOT NULL,
  `id_commande_vente` int NOT NULL,
  `type_produit` enum('lait','oeufs','viande','culture','intrant','aliment','equipement','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_produit` int DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantite_commandee` decimal(10,2) NOT NULL,
  `quantite_livree` decimal(10,2) DEFAULT '0.00',
  `quantite_facturee` decimal(10,2) DEFAULT '0.00',
  `unite` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prix_unitaire_ht` decimal(10,2) NOT NULL,
  `remise_pourcent` decimal(5,2) DEFAULT '0.00',
  `tva_pourcent` decimal(5,2) DEFAULT '0.00',
  `montant_ht` decimal(12,2) DEFAULT '0.00',
  `montant_tva` decimal(12,2) DEFAULT '0.00',
  `montant_ttc` decimal(12,2) DEFAULT '0.00',
  `date_livraison_prevue` date DEFAULT NULL,
  `date_livraison_reelle` date DEFAULT NULL,
  `statut_livraison` enum('en_attente','partielle','complete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `maintenances_vehicules`
--

CREATE TABLE `maintenances_vehicules` (
  `id` int NOT NULL,
  `id_vehicule` int NOT NULL,
  `type_maintenance` enum('vidange','reparation','controle_technique','changement_pneus','nettoyage','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `fournisseur` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_facture` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cout_maintenance` decimal(10,2) NOT NULL,
  `kilometrage` int NOT NULL,
  `date_intervention` date NOT NULL,
  `date_prochaine_maintenance` date DEFAULT NULL,
  `kilometrage_prochaine` int DEFAULT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('planifie','en_cours','termine','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'planifie',
  `photos` text COLLATE utf8mb4_unicode_ci,
  `garantie_jours` int DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `maintenances_vehicules`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_maintenance_vehicule` AFTER INSERT ON `maintenances_vehicules` FOR EACH ROW BEGIN
    DECLARE v_vehicule_immat VARCHAR(50);
    
    SELECT immatriculation INTO v_vehicule_immat FROM vehicules WHERE id = NEW.id_vehicule;
    
    CALL enregistrer_journal_comptable(
        'maintenance',
        'depense',
        CONCAT('Maintenance véhicule - ', v_vehicule_immat),
        NEW.description,
        NEW.cout_maintenance,
        NULL,
        NULL,
        '615 - Entretien et réparations',
        '401 - Fournisseurs',
        'maintenances_vehicules',
        NEW.id,
        'fournisseur',
        NULL,
        NEW.fournisseur,
        COALESCE(NEW.valide_par, 1),
        NEW.numero_facture,
        JSON_OBJECT(
            'type_maintenance', NEW.type_maintenance,
            'kilometrage', NEW.kilometrage,
            'vehicule_id', NEW.id_vehicule
        )
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `mouvements_stock`
--

CREATE TABLE `mouvements_stock` (
  `id` int NOT NULL,
  `id_stock` int NOT NULL,
  `type_mouvement` enum('entree','sortie','ajustement','transfert','perte','inventaire') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantite` decimal(10,2) NOT NULL,
  `unite_mesure` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_reference` enum('commande_achat','commande_vente','production','consommation','maintenance','autre') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_reference` int DEFAULT NULL,
  `numero_reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emplacement_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emplacement_destination` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raison` enum('achat','vente','production','consommation','perte','vol','inventaire','transfert','correction') COLLATE utf8mb4_unicode_ci NOT NULL,
  `commentaire` text COLLATE utf8mb4_unicode_ci,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `effectue_par` int NOT NULL,
  `date_mouvement` date NOT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `mouvements_stock`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_mouvement_stock` AFTER INSERT ON `mouvements_stock` FOR EACH ROW BEGIN
    DECLARE v_libelle VARCHAR(255);
    DECLARE v_type_mouvement VARCHAR(20);
    
    SET v_libelle = CONCAT('Mouvement stock - ', NEW.raison);
    SET v_type_mouvement = IF(NEW.type_mouvement = 'entree', 'entree', 'sortie');
    
    CALL enregistrer_journal_comptable(
        'stock',
        v_type_mouvement,
        v_libelle,
        NEW.commentaire,
        NULL,
        NEW.quantite,
        NEW.unite_mesure,
        IF(NEW.type_mouvement = 'entree', '31 - Stock', '60 - Achats'),
        IF(NEW.type_mouvement = 'entree', '60 - Achats', '31 - Stock'),
        'mouvements_stock',
        NEW.id,
        NULL,
        NULL,
        NULL,
        NEW.effectue_par,
        NEW.numero_reference,
        JSON_OBJECT(
            'type_mouvement', NEW.type_mouvement,
            'raison', NEW.raison,
            'emplacement_source', NEW.emplacement_source,
            'emplacement_destination', NEW.emplacement_destination
        )
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `mouvements_vehicules`
--

CREATE TABLE `mouvements_vehicules` (
  `id` int NOT NULL,
  `id_vehicule` int NOT NULL,
  `id_chauffeur` int NOT NULL,
  `id_mission` int DEFAULT NULL,
  `type_mouvement` enum('sortie','retour') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_mission` date NOT NULL,
  `heure_depart` time NOT NULL,
  `heure_retour` time DEFAULT NULL,
  `kilometrage_depart` int NOT NULL,
  `kilometrage_retour` int DEFAULT NULL,
  `distance_parcourue` int GENERATED ALWAYS AS ((`kilometrage_retour` - `kilometrage_depart`)) STORED,
  `destination` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motif` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `passagers` text COLLATE utf8mb4_unicode_ci,
  `marchandise_transportee` text COLLATE utf8mb4_unicode_ci,
  `cout_carburant` decimal(10,2) DEFAULT '0.00',
  `quantite_carburant` decimal(6,2) DEFAULT '0.00',
  `cout_peages` decimal(8,2) DEFAULT '0.00',
  `autres_frais` decimal(10,2) DEFAULT '0.00',
  `total_frais` decimal(10,2) GENERATED ALWAYS AS (((`cout_carburant` + `cout_peages`) + `autres_frais`)) STORED,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('en_cours','termine','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'en_cours',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `type_notification` enum('alerte_stock','paiement','maintenance','sanitaire','approbation','rappel','systeme') COLLATE utf8mb4_unicode_ci NOT NULL,
  `titre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priorite` enum('basse','normale','haute','urgente') COLLATE utf8mb4_unicode_ci DEFAULT 'normale',
  `type_reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_reference` int DEFAULT NULL,
  `statut` enum('non_lu','lu','archive') COLLATE utf8mb4_unicode_ci DEFAULT 'non_lu',
  `date_lecture` datetime DEFAULT NULL,
  `actions_possibles` json DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `paiements`
--

CREATE TABLE `paiements` (
  `id` int NOT NULL,
  `reference_paiement` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_paiement` enum('recette','depense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` enum('client','fournisseur','employe','banque','caisse','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_source` int NOT NULL,
  `id_facture` int DEFAULT NULL,
  `id_commande` int DEFAULT NULL,
  `montant` decimal(12,2) NOT NULL,
  `devise` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `taux_change` decimal(10,4) DEFAULT '1.0000',
  `montant_devise` decimal(12,2) DEFAULT '0.00',
  `mode_paiement` enum('especes','cheque','virement','mobile_money','carte','compensation') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_mode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_paiement` date NOT NULL,
  `banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_compte` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_cheque` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `justificatif` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('en_attente','valide','rejete','annule') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `rapproche` tinyint(1) DEFAULT '0',
  `date_rapprochement` date DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `paiements`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_paiement` AFTER INSERT ON `paiements` FOR EACH ROW BEGIN
    DECLARE v_tiers_nom VARCHAR(150);
    DECLARE v_compte_debit VARCHAR(50);
    DECLARE v_compte_credit VARCHAR(50);
    
    -- Déterminer le nom du tiers
    IF NEW.source_type = 'client' THEN
        SELECT nom_client INTO v_tiers_nom FROM clients WHERE id = NEW.id_source;
    ELSEIF NEW.source_type = 'fournisseur' THEN
        SELECT nom_fournisseur INTO v_tiers_nom FROM fournisseurs WHERE id = NEW.id_source;
    ELSEIF NEW.source_type = 'employe' THEN
        SELECT nom_complet INTO v_tiers_nom FROM utilisateurs WHERE id = NEW.id_source;
    ELSE
        SET v_tiers_nom = NEW.source_type;
    END IF;
    
    -- Déterminer comptes comptables
    IF NEW.type_paiement = 'recette' THEN
        SET v_compte_debit = CONCAT('512 - Banque (', COALESCE(NEW.banque, 'Caisse'), ')');
        SET v_compte_credit = CASE 
            WHEN NEW.source_type = 'client' THEN '411 - Clients'
            ELSE '707 - Ventes'
        END;
    ELSE
        SET v_compte_debit = CASE 
            WHEN NEW.source_type = 'fournisseur' THEN '401 - Fournisseurs'
            WHEN NEW.source_type = 'employe' THEN '421 - Personnel'
            ELSE '628 - Autres charges'
        END;
        SET v_compte_credit = CONCAT('512 - Banque (', COALESCE(NEW.banque, 'Caisse'), ')');
    END IF;
    
    -- Enregistrer dans journal
    CALL enregistrer_journal_comptable(
        'paiement',
        NEW.type_paiement,
        CONCAT('Paiement - ', NEW.mode_paiement),
        NEW.description,
        NEW.montant,
        NULL,
        NULL,
        v_compte_debit,
        v_compte_credit,
        'paiements',
        NEW.id,
        NEW.source_type,
        NEW.id_source,
        v_tiers_nom,
        COALESCE(NEW.valide_par, 1),
        NEW.reference_paiement,
        JSON_OBJECT(
            'mode_paiement', NEW.mode_paiement,
            'devise', NEW.devise,
            'banque', NEW.banque,
            'numero_compte', NEW.numero_compte
        )
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `parcelles`
--

CREATE TABLE `parcelles` (
  `id` int NOT NULL,
  `reference` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_parcelle` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `superficie_hectares` decimal(8,2) NOT NULL,
  `localisation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `coordonnees_gps` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type_sol` enum('argileux','sableux','limoneux','humifere') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ph_sol` decimal(3,1) DEFAULT NULL,
  `taux_humidite` decimal(4,2) DEFAULT NULL,
  `irrigation_installee` tinyint(1) DEFAULT '0',
  `id_culture_actuelle` int DEFAULT NULL,
  `date_plantation` date DEFAULT NULL,
  `date_recolte_prevue` date DEFAULT NULL,
  `statut` enum('active','en_jachere','en_culture','recoltee','abandonnee') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `productivite_moyenne` decimal(8,2) DEFAULT NULL COMMENT 'kg/ha',
  `proprietaire` enum('propre','loue') COLLATE utf8mb4_unicode_ci DEFAULT 'propre',
  `loyer_annuel` decimal(10,2) DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `presences`
--

CREATE TABLE `presences` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `date` date NOT NULL,
  `heure_entree` time NOT NULL,
  `heure_sortie` time DEFAULT NULL,
  `localisation_entree` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `localisation_sortie` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` enum('present','absent','retard','congé','mission') COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `duree_travail` time GENERATED ALWAYS AS (timediff(`heure_sortie`,`heure_entree`)) STORED,
  `heures_supp` time DEFAULT NULL,
  `remarques` text COLLATE utf8mb4_unicode_ci,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut_validation` enum('en_attente','valide','rejete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `productions_lait`
--

CREATE TABLE `productions_lait` (
  `id` int NOT NULL,
  `id_animal` int NOT NULL,
  `date_production` date NOT NULL,
  `quantite_litres` decimal(6,2) NOT NULL,
  `taux_matiere_grasse` decimal(4,2) DEFAULT NULL,
  `taux_proteine` decimal(4,2) DEFAULT NULL,
  `temperature` decimal(4,1) DEFAULT NULL,
  `ph` decimal(3,2) DEFAULT NULL,
  `qualite` enum('A','B','C','D') COLLATE utf8mb4_unicode_ci DEFAULT 'B',
  `observations` text COLLATE utf8mb4_unicode_ci,
  `traite_par` int NOT NULL,
  `heure_traite` time NOT NULL,
  `methode_traite` enum('manuel','mecanique') COLLATE utf8mb4_unicode_ci DEFAULT 'manuel',
  `destination` enum('vente','transformation','consommation','perte') COLLATE utf8mb4_unicode_ci DEFAULT 'vente',
  `id_reservoir` int DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `productions_lait`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_production_lait` AFTER INSERT ON `productions_lait` FOR EACH ROW BEGIN
    DECLARE v_animal_numero VARCHAR(50);
    DECLARE v_prix_estime DECIMAL(10,2);
    
    SELECT numero_identification INTO v_animal_numero FROM animaux WHERE id = NEW.id_animal;
    
    -- Prix estimé par litre (à ajuster selon votre contexte)
    SET v_prix_estime = NEW.quantite_litres * 1800; -- Exemple: 1.5 USD par litre
    
    IF NEW.destination = 'vente' THEN
        CALL enregistrer_journal_comptable(
            'production',
            'entree',
            'Production laitière',
            CONCAT('Production lait - Animal: ', v_animal_numero),
            v_prix_estime,
            NEW.quantite_litres,
            'litres',
            '355 - Stock - Produits finis',
            '721 - Production stockée',
            'productions_lait',
            NEW.id,
            NULL,
            NULL,
            NULL,
            NEW.traite_par,
            NULL,
            JSON_OBJECT(
                'animal_id', NEW.id_animal,
                'qualite', NEW.qualite,
                'methode_traite', NEW.methode_traite,
                'destination', NEW.destination
            )
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `productions_oeufs`
--

CREATE TABLE `productions_oeufs` (
  `id` int NOT NULL,
  `id_poulailler` int NOT NULL,
  `date_recolte` date NOT NULL,
  `nombre_oeufs` int NOT NULL,
  `oeufs_casses` int DEFAULT '0',
  `oeufs_sales` int DEFAULT '0',
  `calibre_petit` int DEFAULT '0',
  `calibre_moyen` int DEFAULT '0',
  `calibre_gros` int DEFAULT '0',
  `calibre_extra_gros` int DEFAULT '0',
  `taux_fertile` decimal(5,2) DEFAULT NULL,
  `observations` text COLLATE utf8mb4_unicode_ci,
  `recolte_par` int NOT NULL,
  `heure_recolte` time NOT NULL,
  `stockage_temperature` decimal(4,1) DEFAULT NULL,
  `destination` enum('vente','eclosion','consommation','perte') COLLATE utf8mb4_unicode_ci DEFAULT 'vente',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `productions_oeufs`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_production_oeufs` AFTER INSERT ON `productions_oeufs` FOR EACH ROW BEGIN
    DECLARE v_prix_estime DECIMAL(10,2);
    DECLARE v_oeufs_vendables INT;
    
    SET v_oeufs_vendables = NEW.nombre_oeufs - NEW.oeufs_casses - NEW.oeufs_sales;
    SET v_prix_estime = v_oeufs_vendables * 0.3; -- Exemple: 0.3 USD par oeuf
    
    IF NEW.destination = 'vente' AND v_oeufs_vendables > 0 THEN
        CALL enregistrer_journal_comptable(
            'production',
            'entree',
            'Production d'oeufs',
            CONCAT('Production oeufs - Poulailler ID: ', NEW.id_poulailler),
            v_prix_estime,
            v_oeufs_vendables,
            'unités',
            '355 - Stock - Produits finis',
            '721 - Production stockée',
            'productions_oeufs',
            NEW.id,
            NULL,
            NULL,
            NULL,
            NEW.recolte_par,
            NULL,
            JSON_OBJECT(
                'nombre_total', NEW.nombre_oeufs,
                'oeufs_casses', NEW.oeufs_casses,
                'oeufs_sales', NEW.oeufs_sales,
                'destination', NEW.destination
            )
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `rapports_financiers`
--

CREATE TABLE `rapports_financiers` (
  `id` int NOT NULL,
  `type_periode` enum('jour','semaine','mois','trimestre','annee') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `id_departement` int DEFAULT NULL,
  `type_rapport` enum('commercial','financier','productivite','synthese') COLLATE utf8mb4_unicode_ci NOT NULL,
  `chiffre_affaires` decimal(15,2) DEFAULT '0.00',
  `cout_achats` decimal(15,2) DEFAULT '0.00',
  `cout_production` decimal(15,2) DEFAULT '0.00',
  `cout_personnel` decimal(15,2) DEFAULT '0.00',
  `cout_operations` decimal(15,2) DEFAULT '0.00',
  `autres_couts` decimal(15,2) DEFAULT '0.00',
  `total_couts` decimal(15,2) DEFAULT '0.00',
  `marge_brute` decimal(15,2) DEFAULT '0.00',
  `resultat_net` decimal(15,2) DEFAULT '0.00',
  `marge_brute_pourcent` decimal(5,2) DEFAULT '0.00',
  `rentabilite_pourcent` decimal(5,2) DEFAULT '0.00',
  `generate_par` int NOT NULL,
  `date_generation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `commentaires` text COLLATE utf8mb4_unicode_ci,
  `chemin_fichier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `format_export` enum('pdf','excel','csv') COLLATE utf8mb4_unicode_ci DEFAULT 'pdf'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rations_alimentaires`
--

CREATE TABLE `rations_alimentaires` (
  `id` int NOT NULL,
  `id_animal` int NOT NULL,
  `id_aliment` int NOT NULL,
  `date_distribution` date NOT NULL,
  `heure_distribution` time NOT NULL,
  `quantite_distribuee` decimal(8,2) NOT NULL,
  `unite_distribution` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `distribue_par` int NOT NULL,
  `acceptation` enum('complete','partielle','refusee') COLLATE utf8mb4_unicode_ci DEFAULT 'complete',
  `reste_non_consomme` decimal(8,2) DEFAULT '0.00',
  `observations` text COLLATE utf8mb4_unicode_ci,
  `cout_distribution` decimal(8,2) DEFAULT '0.00',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `recoltes`
--

CREATE TABLE `recoltes` (
  `id` int NOT NULL,
  `id_culture` int NOT NULL,
  `date_recolte_reelle` date NOT NULL,
  `rendement_obtenu_kg` decimal(10,2) NOT NULL,
  `qualite` enum('excellente','bonne','moyenne','faible') COLLATE utf8mb4_unicode_ci DEFAULT 'bonne',
  `pertes_kg` decimal(10,2) DEFAULT '0.00',
  `cout_recolte` decimal(10,2) DEFAULT '0.00',
  `recolte_par` int DEFAULT NULL,
  `observations` text COLLATE utf8mb4_unicode_ci,
  `conditions_meteo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination` enum('vente','stockage','transformation','consommation') COLLATE utf8mb4_unicode_ci DEFAULT 'stockage',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `revenus_departement`
--

CREATE TABLE `revenus_departement` (
  `id` int NOT NULL,
  `id_departement` int NOT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `montant` decimal(12,2) NOT NULL,
  `date_revenu` date NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `piece_justificative` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enregistre_par` int NOT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `statut` enum('en_attente','approuve','rejete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `salaires`
--

CREATE TABLE `salaires` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `mois` int NOT NULL,
  `annee` int NOT NULL,
  `salaire_brut` decimal(10,2) NOT NULL,
  `heures_travaillees` decimal(6,2) DEFAULT '0.00',
  `heures_supp` decimal(6,2) DEFAULT '0.00',
  `taux_heure_supp` decimal(8,2) DEFAULT '0.00',
  `deduction_inss` decimal(10,2) DEFAULT '0.00',
  `deduction_impots` decimal(10,2) DEFAULT '0.00',
  `autres_deductions` decimal(10,2) DEFAULT '0.00',
  `avances` decimal(10,2) DEFAULT '0.00',
  `primes` decimal(10,2) DEFAULT '0.00',
  `indemnites` decimal(10,2) DEFAULT '0.00',
  `commissions` decimal(10,2) DEFAULT '0.00',
  `total_deductions` decimal(10,2) DEFAULT '0.00',
  `total_additions` decimal(10,2) DEFAULT '0.00',
  `salaire_net` decimal(10,2) DEFAULT '0.00',
  `mode_paiement` enum('virement','cheque','especes') COLLATE utf8mb4_unicode_ci DEFAULT 'virement',
  `date_paiement` date DEFAULT NULL,
  `reference_paiement` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut_paiement` enum('calculé','payé','reporté','annulé') COLLATE utf8mb4_unicode_ci DEFAULT 'calculé',
  `confirme_reception` tinyint(1) DEFAULT '0',
  `date_confirmation_reception` datetime DEFAULT NULL,
  `demande_paiement_envoyee` tinyint(1) DEFAULT '0',
  `date_demande_paiement` datetime DEFAULT NULL,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `calcul_par` int NOT NULL,
  `date_calcul` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `salaires`
--
DELIMITER $$
CREATE TRIGGER `trigger_journal_paiement_salaire` AFTER UPDATE ON `salaires` FOR EACH ROW BEGIN
    DECLARE v_employe_nom VARCHAR(150);
    DECLARE v_dept_id INT;
    
    -- Uniquement quand le statut passe à 'payé'
    IF OLD.statut_paiement != 'payé' AND NEW.statut_paiement = 'payé' THEN
        
        -- Récupérer les infos de l'employé et son département
        SELECT u.nom_complet, u.id_departement
        INTO v_employe_nom, v_dept_id
        FROM utilisateurs u
        WHERE u.id = NEW.id_utilisateur;
        
        -- Enregistrer le PAIEMENT dans le journal comptable
        CALL enregistrer_journal_comptable(
            'salaire',                                    -- categorie
            'depense',                                    -- type_mouvement
            CONCAT('Paiement salaire - ', NEW.mois, '/', NEW.annee),  -- libelle
            CONCAT('Paiement salaire: ', v_employe_nom, 
                   ' - Période: ', NEW.mois, '/', NEW.annee,
                   ' - Net: ', NEW.salaire_net, ' FBU'),  -- description
            NEW.salaire_net,                              -- montant
            NULL,                                         -- quantite
            NULL,                                         -- unite_mesure
            '421 - Personnel - Rémunérations dues',       -- compte_debit
            CONCAT('512 - Banque - ', NEW.mode_paiement), -- compte_credit
            'salaires',                                   -- table_source
            NEW.id,                                       -- id_source
            'employe',                                    -- tiers_type
            NEW.id_utilisateur,                           -- tiers_id
            v_employe_nom,                                -- tiers_nom
            COALESCE(NEW.valide_par, NEW.calcul_par),     -- effectue_par
            NEW.reference_paiement,                       -- reference_externe
            JSON_OBJECT(
                'id_departement', v_dept_id,
                'salaire_brut', NEW.salaire_brut,
                'salaire_net', NEW.salaire_net,
                'deduction_inss', NEW.deduction_inss,
                'deduction_impots', NEW.deduction_impots,
                'primes', NEW.primes,
                'mode_paiement', NEW.mode_paiement,
                'mois', NEW.mois,
                'annee', NEW.annee,
                'date_paiement', NEW.date_paiement
            )                                             -- donnees_complementaires
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trigger_journal_salaire` AFTER UPDATE ON `salaires` FOR EACH ROW BEGIN
    DECLARE v_employe_nom VARCHAR(150);
    
    IF OLD.statut_paiement != 'payé' AND NEW.statut_paiement = 'payé' THEN
        SELECT nom_complet INTO v_employe_nom FROM utilisateurs WHERE id = NEW.id_utilisateur;
        
        CALL enregistrer_journal_comptable(
            'salaire',
            'depense',
            CONCAT('Salaire - ', NEW.mois, '/', NEW.annee),
            CONCAT('Paiement salaire: ', v_employe_nom, ' - ', NEW.mois, '/', NEW.annee),
            NEW.salaire_net,
            NULL,
            NULL,
            '421 - Personnel - Rémunérations dues',
            '512 - Banque',
            'salaires',
            NEW.id,
            'employe',
            NEW.id_utilisateur,
            v_employe_nom,
            COALESCE(NEW.valide_par, NEW.calcul_par),
            NEW.reference_paiement,
            JSON_OBJECT(
                'salaire_brut', NEW.salaire_brut,
                'deduction_inss', NEW.deduction_inss,
                'mode_paiement', NEW.mode_paiement,
                'mois', NEW.mois,
                'annee', NEW.annee
            )
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `stocks`
--

CREATE TABLE `stocks` (
  `id` int NOT NULL,
  `type_article` enum('lait','oeufs','viande','culture','intrant','aliment','piece','equipement','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_article` int NOT NULL,
  `quantite_disponible` decimal(10,2) NOT NULL DEFAULT '0.00',
  `quantite_reservee` decimal(10,2) DEFAULT '0.00',
  `quantite_reelle` decimal(10,2) DEFAULT '0.00',
  `unite_mesure` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `seuil_alerte` decimal(10,2) DEFAULT '10.00',
  `emplacement` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `etiquette` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_entree` date DEFAULT NULL,
  `date_peremption` date DEFAULT NULL,
  `cout_unitaire` decimal(10,2) DEFAULT '0.00',
  `valeur_stock` decimal(12,2) DEFAULT '0.00',
  `statut` enum('disponible','reserve','epuise','perime','inventorie') COLLATE utf8mb4_unicode_ci DEFAULT 'disponible',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `suivis_sanitaires`
--

CREATE TABLE `suivis_sanitaires` (
  `id` int NOT NULL,
  `id_animal` int NOT NULL,
  `type_intervention` enum('vaccination','traitement','consultation','analyse','chirurgie') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_intervention` date NOT NULL,
  `symptomes` text COLLATE utf8mb4_unicode_ci,
  `diagnostic` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `produit_utilise` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dosage` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode_administration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `veterinaire` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_technicien` int DEFAULT NULL,
  `date_prochaine_visite` date DEFAULT NULL,
  `instructions_suivi` text COLLATE utf8mb4_unicode_ci,
  `observations` text COLLATE utf8mb4_unicode_ci,
  `cout_intervention` decimal(8,2) DEFAULT '0.00',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `tentatives_connexion`
--

CREATE TABLE `tentatives_connexion` (
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `succes` tinyint(1) NOT NULL,
  `raison` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `date_tentative` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `tentatives_connexion`
--

INSERT INTO `tentatives_connexion` (`id`, `email`, `succes`, `raison`, `ip_address`, `user_agent`, `date_tentative`) VALUES
(1, 'nzoyishemezasophonie@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-01 08:56:54'),
(2, 'nzoyishemezasophonie@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-01 09:09:51'),
(3, 'nzoyishemezasophonie@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-01 09:16:50'),
(4, 'ja@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-01 14:14:33'),
(5, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'axios/1.13.4', '2026-02-02 07:54:49'),
(6, 'manager.finance@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 07:54:50'),
(7, 'comptable@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 07:54:50'),
(8, 'manager.rh@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 07:54:51'),
(9, 'veterinaire@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 07:54:51'),
(10, 'chauffeur1@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 07:54:52'),
(11, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'axios/1.13.4', '2026-02-02 08:05:29'),
(12, 'manager.finance@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 08:05:30'),
(13, 'comptable@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 08:05:31'),
(14, 'manager.rh@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 08:05:31'),
(15, 'veterinaire@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 08:05:32'),
(16, 'chauffeur1@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'axios/1.13.4', '2026-02-02 08:05:32'),
(17, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-02 08:10:19'),
(18, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-02 08:10:36'),
(19, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-02 23:05:57'),
(20, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-02 23:16:52'),
(21, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-03 06:33:05'),
(22, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-03 14:15:22'),
(23, 'nzoyishemezasophonie@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-03 23:07:28'),
(24, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-03 23:13:00'),
(25, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-03 23:24:00'),
(26, 'janvier@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-04 19:39:29'),
(27, 'janvier@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-04 19:39:50'),
(28, 'janvier@gmail.com', 0, 'USER_NOT_FOUND', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-04 20:00:16'),
(29, 'manager.finance@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-05 16:38:12'),
(30, 'manager.finance@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-05 17:29:16'),
(31, 'manager.finance@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-05 17:34:30'),
(32, 'manager.finance@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-05 17:34:32'),
(33, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 06:31:20'),
(34, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 07:37:07'),
(35, 'manager.rh@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 17:01:21'),
(36, 'manager.rh@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 17:02:41'),
(37, 'partiel2@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 17:03:45'),
(38, 'partiel2@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 19:46:05'),
(39, 'employe1@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 19:59:19'),
(40, 'employe1@nutrisoft.bi', 0, 'INVALID_PASSWORD', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 20:00:07'),
(41, 'partiel1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 20:00:59'),
(42, 'veterinaire@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 20:37:37'),
(43, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-06 22:25:14'),
(44, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 07:43:18'),
(45, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 08:02:02'),
(46, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 08:29:19'),
(47, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 08:48:54'),
(48, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 10:54:47'),
(49, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 11:40:35'),
(50, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 12:13:26'),
(51, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 12:18:27'),
(52, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 14:03:21'),
(53, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 14:11:38'),
(54, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 14:50:45'),
(55, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 15:24:18'),
(56, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 16:19:15'),
(57, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 18:23:27'),
(58, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 23:02:44'),
(59, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 23:35:30'),
(60, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 08:08:43'),
(61, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-08 09:14:23'),
(62, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 09:44:56'),
(63, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-08 10:04:11'),
(64, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-08 10:12:11'),
(65, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-08 10:20:54'),
(66, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 10:27:13'),
(67, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 10:31:13'),
(68, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 10:37:58'),
(69, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 10:45:07'),
(70, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 10:55:20'),
(71, 'chauffeur1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '2026-02-08 11:00:01'),
(72, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 11:30:01'),
(73, 'veterinaire@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 14:58:30'),
(74, 'veterinaire@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 16:52:05'),
(75, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 22:30:22'),
(76, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-08 23:28:39'),
(77, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 00:03:54'),
(78, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 14:20:45'),
(79, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 14:59:00'),
(80, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 15:33:52'),
(81, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 15:43:07'),
(82, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 16:01:05'),
(83, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 16:16:18'),
(84, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 16:31:43'),
(85, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 16:48:31'),
(86, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 16:55:47'),
(87, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 17:32:59'),
(88, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 17:42:29'),
(89, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 17:55:20'),
(90, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 18:24:02'),
(91, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 18:51:04'),
(92, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 20:46:14'),
(93, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 20:51:06'),
(94, 'employe1@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-09 21:57:09'),
(95, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-10 21:02:56'),
(96, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-10 21:10:54'),
(97, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-10 21:22:27'),
(98, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-10 21:49:03'),
(99, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-11 08:04:43');

-- --------------------------------------------------------

--
-- Structure de la table `traces`
--

CREATE TABLE `traces` (
  `id` int NOT NULL,
  `id_utilisateur` int NOT NULL,
  `module` enum('rh','flotte','agriculture','elevage','commercial','finance','stock','systeme') COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_details` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_affectee` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_enregistrement` int DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `niveau` enum('info','warning','error','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `donnees_avant` json DEFAULT NULL,
  `donnees_apres` json DEFAULT NULL,
  `differences` json DEFAULT NULL,
  `date_action` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `traces`
--

INSERT INTO `traces` (`id`, `id_utilisateur`, `module`, `type_action`, `action_details`, `table_affectee`, `id_enregistrement`, `ip_address`, `user_agent`, `niveau`, `donnees_avant`, `donnees_apres`, `differences`, `date_action`) VALUES
(1, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation du compte administrateur principal', 'employes', 1, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(2, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Manager Finance - NDAYISENGA Marie Claire', 'employes', 2, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(3, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Comptable - HAKIZIMANA Patrick', 'employes', 3, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(4, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Manager RH - UWIMANA Esp├®rance', 'employes', 4, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(5, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation V├®t├®rinaire - Dr. NKURUNZIZA Emmanuel', 'employes', 5, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(6, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Chauffeur - BIGIRIMANA L├®onard', 'employes', 6, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(7, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Agriculteur - NDIKUMANA Josu├®', 'employes', 7, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(8, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Technicien - NSHIMIRIMANA David', 'employes', 8, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(9, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Employ├® - NAHIMANA Didier', 'employes', 9, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(10, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Temps Partiel - IRAKOZE Aim├®e', 'employes', 10, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(11, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Temps Partiel - BIZIMANA Clarisse', 'employes', 11, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(12, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Contractuel - NIYONZIMA Freddy', 'employes', 12, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29'),
(13, 1, 'rh', 'modification_departement', 'Département modifié: Agriculture', 'departements', 4, NULL, NULL, 'info', NULL, NULL, NULL, '2026-02-11 21:39:55');

-- --------------------------------------------------------

--
-- Structure de la table `types_cultures`
--

CREATE TABLE `types_cultures` (
  `id` int NOT NULL,
  `code_culture` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_culture` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `famille` enum('cereale','legume','fruit','legumineuse','fourrage','autre') COLLATE utf8mb4_unicode_ci NOT NULL,
  `duree_cycle_jours` int NOT NULL,
  `saison_optimale` enum('toutes','seche','pluie') COLLATE utf8mb4_unicode_ci DEFAULT 'toutes',
  `temperature_optimale_min` int DEFAULT NULL,
  `temperature_optimale_max` int DEFAULT NULL,
  `besoins_eau_mm` decimal(6,2) DEFAULT NULL,
  `espacement_plants_cm` int DEFAULT NULL,
  `profondeur_semaison_cm` int DEFAULT NULL,
  `rendement_moyen_kg_ha` decimal(8,2) DEFAULT NULL,
  `prix_moyen_kg` decimal(8,2) DEFAULT NULL,
  `duree_conservation_jours` int DEFAULT NULL,
  `conditions_stockage` text COLLATE utf8mb4_unicode_ci,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateurs`
--

CREATE TABLE `utilisateurs` (
  `id` int NOT NULL,
  `matricule` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mot_de_passe_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nom_complet` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type_employe` enum('INSS','temps_partiel','contractuel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','manager','employe','comptable','veterinaire','chauffeur','agriculteur','technicien','employe_temps_partiel') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_departement` int NOT NULL,
  `date_embauche` date NOT NULL,
  `date_naissance` date DEFAULT NULL,
  `adresse` text COLLATE utf8mb4_unicode_ci,
  `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pays` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Burundi',
  `numero_cnss` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salaire_base` decimal(10,2) NOT NULL,
  `jours_conges_annuels` int DEFAULT '0',
  `compte_bancaire` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nom_banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_code` text COLLATE utf8mb4_unicode_ci,
  `donnees_biometriques` text COLLATE utf8mb4_unicode_ci,
  `photo_identite` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `derniere_connexion` datetime DEFAULT NULL,
  `nombre_connexions` int DEFAULT '0',
  `doit_changer_mdp` tinyint(1) DEFAULT '1',
  `date_modification_mdp` datetime DEFAULT NULL,
  `statut` enum('actif','inactif','congé','suspendu') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `date_depart` date DEFAULT NULL,
  `raison_depart` text COLLATE utf8mb4_unicode_ci,
  `cree_par` int DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modifie_par` int DEFAULT NULL,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `numero_cni` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `utilisateurs`
--

INSERT INTO `utilisateurs` (`id`, `matricule`, `email`, `mot_de_passe_hash`, `nom_complet`, `telephone`, `type_employe`, `role`, `id_departement`, `date_embauche`, `date_naissance`, `adresse`, `ville`, `pays`, `numero_cnss`, `salaire_base`, `jours_conges_annuels`, `compte_bancaire`, `nom_banque`, `qr_code`, `donnees_biometriques`, `photo_identite`, `derniere_connexion`, `nombre_connexions`, `doit_changer_mdp`, `date_modification_mdp`, `statut`, `date_depart`, `raison_depart`, `cree_par`, `date_creation`, `modifie_par`, `date_modification`, `numero_cni`) VALUES
(1, 'ADM001', 'admin@nutrisoft.bi', '$2b$10$Yd6vOKcxPOLlLaXB9RbNP.9vSrFWhiah.mIHsxfW8CRkDVhN27V0a', 'NIYONGABO Jean Claude', '+257 79 123 456', 'INSS', 'admin', 1, '2024-01-01', '1985-03-15', 'Avenue de la Burundi, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-001', 2500000.00, 30, 'BDI-001-123456789', 'Banque de Cr├®dit de Bujumbura', 'data:image/png;base64,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', NULL, NULL, '2026-02-11 08:04:43', 5, 0, NULL, 'actif', NULL, NULL, NULL, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(2, 'MGR001', 'manager.finance@nutrisoft.bi', '$2b$10$M.6VX5opOP8btsZJ6lv3Len7eFRjf3RVqaNwa7cVr9YmDUWQBPvy6', 'NDAYISENGA Marie Claire', '+257 79 234 567', 'INSS', 'manager', 2, '2024-01-15', '1988-07-22', 'Avenue du Lac, Q. Kinindo', 'Bujumbura', 'Burundi', 'CNSS-2024-002', 1800000.00, 25, 'BDI-002-234567890', 'Banque de Cr├®dit de Bujumbura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKwAAACsCAYAAADmMUfYAAAAAklEQVR4AewaftIAAAp3SURBVO3B0W1cMQxFwWNh+2AhrItVsC4Wwkocf174Q4Hw1k4EcObj8wtjXGIxxkUWY1xkMcZFXnxjnvymrkCZJ+/UFSjzRHUFJ8wT1RUo8+REV3DCPNnpCpR58kRXoMyT39QVqMUYF1mMcZHFGBd58RddwTuZJztdwQnz5ERXsGOevFNX8IR5orqCHfPkia7gRFfwTubJzmKMiyzGuMhijIu8OGSenOgKTpgnqivY6Qp2zJMTXcGOeaLME9UVKPNEdQU75smOeaK6AtUVKPNkpyt4J/PkRFdwYjHGRRZjXGQxxkVe/Ge6AmWeqK5AmSeqK1BdgTJPVFfwk7qCHfNkpyt4p65AmSeqK/ifLca4yGKMiyzGuMiL/1xXoMyTHfNkpytQ5onqCpR5stMVKPNkpyvY6Qp2zJMnzBPVFSjzRHUF/5PFGBdZjHGRxRgXeXGoK/hJ5sk7dQUnzJOdruBf6gqUeaK6AmWeqK5gpyt4oiv4SYsxLrIY4yKLMS7y4i/Mk3+pK1DmieoKlHmyY56orkCZJ6orUOaJ6gp2ugJlnqiuQJknqitQ5onqCpR5oroCZZ6orkCZJ6or2DFPftNijIssxrjIYoyLvPimK/iXuoLfZJ6c6Aqe6Ar+pa5AmSeqK9jpCv6lxRgXWYxxkcUYF3nxjXmiugJlnqiu4IR5stMVKPNEdQXKPFFdgTJPdrqCE+aJ6gpUV7Bjnqiu4ERX8E5dgTJPVFewY56ormDHPFFdgTJPVFegFmNcZDHGRRZjXOTFN13BTlewY56orkB1Bco8UeaJ6greqStQ5sk7mSeqK9gxT1RXoMwT1RUo8+QJ80R1BTvmieoKlHmiuoITXcHOYoyLLMa4yGKMi7w4ZJ6orkB1BTvmieoKTpgnqivY6QqUebLTFSjzRHUFyjxRXYEyT1RXoMyT32Se7JgnqivYMU9OdAXKPFFdwc5ijIssxrjIYoyLvPjGPFFdwRPmieoKlHmiugJlnjxhnux0Be9knpzoCpR5oroCZZ7sdAU7XcGOebLTFSjz5ImuQJknqitQizEushjjIosxLvLiIfNkpytQ5onqCpR5oroCZZ7smCeqK1DmyYmuQJknO12BMk+UeXLCPHkn80R1Baor2DFPdroCZZ6ormCnK9hZjHGRxRgXWYxxkRcPdQXKPNnpCna6AmWeqK5AmSc75onqCpR5oroCZZ6oruBEV3DCPFFdgTJPTpgnqit4oitQ5slOV/BOizEushjjIosxLvLim67ghHlywjxRXcFOV7DTFeyYJz/JPFFdgTJPVFdwwjxRXcGOeaK6ghPmyTuZJ6orUOaJ6gp2FmNcZDHGRRZjXOTj8wvCPNnpCpR5cqIrUOaJ6gqUefJEV6DME9UV7JgnO13BE+bJTlfwTubJia5AmScnuoId80R1BTuLMS6yGOMiizEu8vH5BWGeqK5AmSeqK9gxT35SV/CEebLTFSjz5ImuYMc82ekKlHmy0xUo8+QndQXKPFFdwROLMS6yGOMiizEu8uKbruCEeaK6gp2uQJknqis4YZ6orkCZJztdwYmu4IR5smOe7HQFO12BMk92uoId8+REV3DCPFFdgTJPVFegFmNcZDHGRRZjXOTFN+aJ6gpUV7BjnqiuQJknP8k8UV2BMk9OmCc7XYEyT1RX8IR58k7myYmuYMc8ecI8ObEY4yKLMS6yGOMiH59fEOaJ6gp+k3miuoIT5onqCnbME9UV7JgnT3QFyjxRXYEyT1RXsGOeqK7ghHnyRFdwwjxRXcHOYoyLLMa4yGKMi3x8fmHDPFFdgTJPdroCZZ7sdAXKPFFdgTJPVFegzJOdrkCZJye6AmWe7HQFO+aJ6gqUebLTFSjz5ERXsGOePNEVKPNkpytQizEushjjIosxLvLiL7oCZZ7sdAU7XcGOeaK6AmWeqK5AmSfv1BUo8+SdzBPVFdykK9gxT5R58sRijIssxrjIYoyLvHioK1DmyTuZJye6gh3z5IR5smOe7HQFyjxRXcE7mSc7XYEyT5R5orqCHfNEdQUnugJlnuwsxrjIYoyLLMa4yMfnFzbMkxNdwRPmieoKlHmiuoJ/yTzZ6QpOmCeqK1DmieoKTpgnO13BCfNkpyt4p8UYF1mMcZHFGBd5cagreMI8OWGeqK7ghHlyoivYMU9UV6DMkx3zRHUFJ7qCJ7oCZZ4o80R1Bco8OWGeqK5gxzxRXYFajHGRxRgXWYxxkRdvZp7sdAUnzBNlnqiuQJknqitQ5onqCn5TV6DMkx3z5Imu4ERXsNMVKPNEdQU/aTHGRRZjXGQxxkVePGSe7HQFyjxRXYEyT1RXoMwTZZ6orkCZJ6or2DFPdroCZZ6orkCZJ6or+E3myQnzRHUFyjw5YZ6oruCJxRgXWYxxkcUYF3nxF13BO3UFyjw50RX8pK7gRFegzJMTXYEyT1RXoMwT1RUo80R1BTvmieoKlHlywjz5SYsxLrIY4yKLMS7y4hvzRHUFO13Bjnmy0xUo8+R/Yp7sdAU7XcET5onqCpR5orqCJ8wT1RUo82SnK1DmyYmuYGcxxkUWY1xkMcZFXnzTFSjz5J26gp2uQJknqitQ5slv6gp+UlegzJMnzBPVFaiu4ERXoMyTE+aJ6gqUeaK6ArUY4yKLMS6yGOMiL74xT3a6AmWe7HQFyjxRXcEJ82SnKzhhnvwk80R1Bco8OWGenOgKdsyTE13Bv7QY4yKLMS6yGOMiH59fOGCeqK7gCfNkpytQ5slOV7BjnqiuYMc8UV2BMk+e6ApOmCeqK3jCPFFdwY55orqC37QY4yKLMS6yGOMiH59fEObJTldwwjzZ6Qp2zBPVFZwwT050BTvmieoKlHnyTl2BMk9u1hUo80R1BTuLMS6yGOMiizEu8vH5hf+IeaK6AmWe7HQFyjxRXYEyT050BTvmieoKTpgnO12BMk9UV/CEeaK6ghPmyTt1BWoxxkUWY1xkMcZFXnxjnvymrmDHPHmiKzjRFZwwT3bMk52uQHUFJ7oCZZ7sdAXKPDlhnqiuYKcrUObJE4sxLrIY4yKLMS7y4i+6gncyT3a6AmWe7HQFyjxRXYEyT1RXsGOeqK5AdQXKPFFdgTJPTpgnqis40RUo80R1Bco82ekKnugKnliMcZHFGBdZjHGRF4fMkxNdwTt1Bco8OdEV7JgnJ8yTHfPkhHmyY56orkB1Bco8UV3BCfPkCfNEdQXKPNnpCtRijIssxrjIYoyLvLiMeaK6ghPmyYmu4ERXsGOeKPNEdQXv1BXsmCeqK3jCPNkxT1RXoMyTncUYF1mMcZHFGBd58Z8xT06YJz/JPDlhnqiuYKcrUObJTlegzJMnugJlnqiu4ImuQJknyjw5sRjjIosxLrIY4yIvDnUFP6kr2DFPVFegzJOdrmDHPFFdgTJPVFegzJOdrkCZJztdgTJPVFegzBPVFSjz5IR5cqIrONEVnFiMcZHFGBdZjHGRF39hnvwm82SnK1DmyU5XoMwT1RX8JPNEdQVPdAXKPFFdwU5XoMyTna5AmScnzBPVFeyYJ6orUIsxLrIY4yKLMS7y8fmFMS6xGOMiizEushjjIn8A7a/EHxSndSIAAAAASUVORK5CYII=', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(3, 'CPT001', 'comptable@nutrisoft.bi', '$2b$10$bYlpftpwNBKDOVZqgf9CwO9mrhv1puirKirCovBn.eYXU9osULD3m', 'HAKIZIMANA Patrick', '+257 79 345 678', 'INSS', 'comptable', 2, '2024-02-01', '1990-11-10', 'Boulevard de lUPRONA, Q. Mutanga Nord', 'Bujumbura', 'Burundi', 'CNSS-2024-003', 1200000.00, 22, 'BDI-003-345678901', 'Interbank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(4, 'MGR002', 'manager.rh@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'UWIMANA Espérance', '+257 79 456 789', 'INSS', 'manager', 3, '2024-01-20', '1987-05-18', 'Avenue de lAmitié, Q. Ngagara', 'Bujumbura', 'Burundi', 'CNSS-2024-004', 1700000.00, 25, 'BDI-004-456789012', 'BCB - Banque de credit du Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-10 20:25:14', NULL),
(5, 'VET001', 'veterinaire@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'Dr. NKURUNZIZA Emmanuel', '+257 79 567 890', 'INSS', 'veterinaire', 5, '2024-02-15', '1986-09-25', 'Chauss├®e de Prince Luis Gwagasore, Q. Buyenzi', 'Bujumbura', 'Burundi', 'CNSS-2024-005', 1500000.00, 22, 'BDI-005-567890123', 'Banque de Gestion et de Financement', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(6, 'CHF001', 'chauffeur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'BIGIRIMANA Léonard', '+257 79 678 901', 'INSS', 'chauffeur', 6, '2024-03-01', '1992-12-08', 'Avenue de la Victoire, Q. Kamenge', 'Bujumbura', 'Burundi', 'CNSS-2024-006', 800000.00, 20, 'BDI-006-678901234', 'Ecobank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-10 20:25:14', NULL),
(7, 'AGR001', 'agriculteur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NDIKUMANA Josué', '+257 79 789 012', 'INSS', 'agriculteur', 4, '2024-03-15', '1994-04-12', 'Quartier Kanyosha', 'Bujumbura', 'Burundi', 'CNSS-2024-007', 750000.00, 20, 'BDI-007-789012345', 'Banque de Crédit de Bujumbura', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-10 20:25:14', NULL),
(8, 'TEC001', 'technicien1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NSHIMIRIMANA David', '+257 79 890 123', 'INSS', 'technicien', 8, '2024-04-01', '1991-08-20', 'Avenue de la Paix, Q. Bwiza', 'Bujumbura', 'Burundi', 'CNSS-2024-008', 950000.00, 20, 'BDI-008-890123456', 'Interbank Burundi', 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(9, 'EMP001', 'employe1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NAHIMANA Didier', '+257 79 901 234', 'INSS', 'employe', 7, '2024-04-15', '1995-06-30', 'Chauss├®e Prince Louis Rwagasore, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-009', 650000.00, 20, 'BDI-009-901234567', 'BCB - Banque Commerciale du Burundi', 'data:image/png;base64,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', NULL, NULL, '2026-02-09 21:57:09', 1, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(10, 'TPT001', 'partiel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'IRAKOZE Aimée', '+257 79 012 345', 'temps_partiel', 'employe', 9, '2024-05-01', '1997-02-14', 'Avenue de lIndustrie, Q. Ngagara', 'Bujumbura', 'Burundi', NULL, 400000.00, 12, NULL, NULL, 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-10 20:25:14', NULL),
(11, 'TPT002', 'partiel2@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'BIZIMANA Clarisse', '+257 79 123 456', 'temps_partiel', 'employe', 4, '2024-05-15', '1998-10-05', 'Quartier Mutanga Sud', 'Bujumbura', 'Burundi', NULL, 350000.00, 12, NULL, NULL, 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL),
(12, 'CTR001', 'contractuel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'NIYONZIMA Freddy', '+257 79 234 567', 'contractuel', 'employe', 5, '2024-06-01', '1996-03-22', 'Avenue de la Libert├®, Q. Buyenzi', 'Bujumbura', 'Burundi', NULL, 550000.00, 15, NULL, NULL, 'data:image/png;base64,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', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-09 19:52:06', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `validations_doubles`
--

CREATE TABLE `validations_doubles` (
  `id` int NOT NULL,
  `action_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_json` json NOT NULL,
  `validation_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `required_role` enum('admin','manager','comptable','veterinaire') COLLATE utf8mb4_unicode_ci NOT NULL,
  `demande_par` int NOT NULL,
  `date_demande` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `valide_par` int DEFAULT NULL,
  `date_validation` datetime DEFAULT NULL,
  `decision` enum('en_attente','approuve','rejete') COLLATE utf8mb4_unicode_ci DEFAULT 'en_attente',
  `commentaire_validation` text COLLATE utf8mb4_unicode_ci,
  `execute_par` int DEFAULT NULL,
  `date_execution` datetime DEFAULT NULL,
  `resultat_execution` text COLLATE utf8mb4_unicode_ci,
  `date_expiration` datetime DEFAULT NULL,
  `expire` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vehicules`
--

CREATE TABLE `vehicules` (
  `id` int NOT NULL,
  `immatriculation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `marque` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modele` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `annee` year NOT NULL,
  `couleur` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type_vehicule` enum('camion','pickup','voiture','moto','engin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacite_carburant` decimal(6,2) DEFAULT NULL,
  `consommation_moyenne` decimal(5,2) DEFAULT NULL,
  `kilometrage_actuel` int NOT NULL DEFAULT '0',
  `date_achat` date DEFAULT NULL,
  `prix_achat` decimal(12,2) DEFAULT NULL,
  `valeur_actuelle` decimal(12,2) DEFAULT NULL,
  `id_chauffeur_attitre` int DEFAULT NULL,
  `id_departement` int NOT NULL,
  `statut` enum('actif','maintenance','hors_service','vendu') COLLATE utf8mb4_unicode_ci DEFAULT 'actif',
  `disponible` tinyint(1) DEFAULT '1',
  `date_dernier_controle` date DEFAULT NULL,
  `prochain_controle` date DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `vehicules`
--

INSERT INTO `vehicules` (`id`, `immatriculation`, `marque`, `modele`, `annee`, `couleur`, `type_vehicule`, `capacite_carburant`, `consommation_moyenne`, `kilometrage_actuel`, `date_achat`, `prix_achat`, `valeur_actuelle`, `id_chauffeur_attitre`, `id_departement`, `statut`, `disponible`, `date_dernier_controle`, `prochain_controle`, `date_creation`, `date_modification`, `photo`) VALUES
(1, 'AB-4567-BI', 'TOYOTA', 'HILUX', '2025', 'Blanc', 'camion', 80.00, 9.50, 78450, '2026-02-11', 65000000.00, 65000000.00, 6, 4, 'actif', 1, NULL, NULL, '2026-02-11 22:18:00', '2026-02-11 22:23:31', 'blob:http://localhost:8081/11fb689d-425e-478e-89c1-cde4d56a1c19');

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_applications_intrants`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_applications_intrants` (
`id` int
,`id_culture` int
,`id_intrant` int
,`id_parcelle` int
,`id_applicateur` int
,`date_application` date
,`quantite_utilisee` decimal(8,2)
,`unite_utilisee` varchar(20)
,`methode_application` enum('pulverisation','epandage','injection','trempage')
,`conditions_meteo` varchar(100)
,`humidite_sol` decimal(4,2)
,`temperature_air` decimal(4,1)
,`objectif` text
,`observations` text
,`cout_application` decimal(10,2)
,`date_creation` timestamp
,`date_modification` timestamp
,`cout_application_calcule` decimal(16,4)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_assurances_vehicules`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_assurances_vehicules` (
`id` int
,`id_vehicule` int
,`compagnie_assurance` varchar(150)
,`numero_police` varchar(100)
,`type_couverture` enum('tous_risques','tiers','vol_incendie')
,`date_debut` date
,`date_expiration` date
,`montant_prime` decimal(10,2)
,`franchise` decimal(10,2)
,`scan_police` varchar(255)
,`scan_attestation` varchar(255)
,`notification_envoyee_30` tinyint(1)
,`notification_envoyee_15` tinyint(1)
,`notification_envoyee_7` tinyint(1)
,`notification_envoyee_1` tinyint(1)
,`statut` enum('active','expiree','renouvelee','resiliee')
,`date_creation` timestamp
,`date_modification` timestamp
,`jours_restants` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_commandes_achat`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_commandes_achat` (
`id` int
,`numero_commande` varchar(50)
,`id_fournisseur` int
,`date_commande` date
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`lieu_livraison` varchar(255)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','credit')
,`conditions_paiement` varchar(100)
,`delai_paiement_jours` int
,`montant_ht` decimal(12,2)
,`tva_pourcent` decimal(5,2)
,`montant_tva` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`frais_livraison` decimal(10,2)
,`remise` decimal(10,2)
,`montant_total` decimal(12,2)
,`livre_par` varchar(100)
,`contact_livreur` varchar(50)
,`observations_livraison` text
,`valide_par` int
,`date_validation` datetime
,`statut` enum('brouillon','envoyee','confirmee','livree_partielle','livree_complete','facturee','payee','annulee')
,`cree_par` int
,`date_creation` timestamp
,`modifie_par` int
,`date_modification` timestamp
,`montant_tva_calcule` decimal(21,8)
,`montant_ttc_calcule` decimal(22,8)
,`montant_total_calcule` decimal(24,8)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_commandes_vente`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_commandes_vente` (
`id` int
,`numero_commande` varchar(50)
,`id_client` int
,`date_commande` date
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`lieu_livraison` varchar(255)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','credit','mixte')
,`conditions_paiement` varchar(100)
,`montant_ht` decimal(12,2)
,`tva_pourcent` decimal(5,2)
,`montant_tva` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`frais_livraison` decimal(10,2)
,`remise` decimal(10,2)
,`montant_total` decimal(12,2)
,`livre_par` varchar(100)
,`contact_livreur` varchar(50)
,`observations_livraison` text
,`valide_par` int
,`date_validation` datetime
,`statut` enum('brouillon','confirmee','en_preparation','livree_partielle','livree_complete','facturee','payee','annulee')
,`cree_par` int
,`date_creation` timestamp
,`modifie_par` int
,`date_modification` timestamp
,`montant_tva_calcule` decimal(21,8)
,`montant_ttc_calcule` decimal(22,8)
,`montant_total_calcule` decimal(24,8)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_confirmations_reception_salaire`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_confirmations_reception_salaire` (
`id` int
,`id_salaire` int
,`id_utilisateur` int
,`employe_nom` varchar(150)
,`employe_matricule` varchar(20)
,`employe_email` varchar(100)
,`departement_nom` varchar(100)
,`mois` int
,`annee` int
,`montant` decimal(10,2)
,`confirme` tinyint(1)
,`date_confirmation` datetime
,`methode_confirmation` enum('code_sms','code_email','biometrique','manuel')
,`code_verification_utilise` varchar(10)
,`statut_salaire` enum('calculé','payé','reporté','annulé')
,`date_paiement` date
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_dashboard_alertes`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_dashboard_alertes` (
`type_alerte` varchar(10)
,`description` varchar(129)
,`jours_restants` bigint
,`priorite` varchar(7)
,`date_echeance` date
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_demandes_paiement_salaire`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_demandes_paiement_salaire` (
`id` int
,`id_salaire` int
,`id_employe` int
,`employe_nom` varchar(150)
,`employe_matricule` varchar(20)
,`employe_email` varchar(100)
,`departement_nom` varchar(100)
,`mois` int
,`annee` int
,`montant` decimal(10,2)
,`statut` enum('en_attente','approuve','rejete','annule')
,`motif_rejet` text
,`date_demande` timestamp
,`date_traitement` datetime
,`traite_par` int
,`traite_par_nom` varchar(150)
,`commentaire` text
,`statut_salaire` enum('calculé','payé','reporté','annulé')
,`jours_attente` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_factures`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_factures` (
`id` int
,`numero_facture` varchar(50)
,`type_facture` enum('achat','vente','avoir')
,`id_commande` int
,`id_fournisseur` int
,`id_client` int
,`date_facture` date
,`date_echeance` date
,`montant_ht` decimal(12,2)
,`montant_tva` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`montant_regle` decimal(12,2)
,`montant_du` decimal(12,2)
,`statut_paiement` enum('impayee','partiellement_payee','payee','en_retard')
,`date_dernier_paiement` date
,`mode_reglement` varchar(50)
,`nombre_relances` int
,`date_derniere_relance` date
,`chemin_fichier` varchar(255)
,`scan_quittance` varchar(255)
,`cree_par` int
,`date_creation` timestamp
,`modifie_par` int
,`date_modification` timestamp
,`jours_restants` int
,`montant_du_calcule` decimal(13,2)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_frais_chauffeur_stats`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_frais_chauffeur_stats` (
`chauffeur_id` int
,`matricule` varchar(20)
,`chauffeur_nom` varchar(150)
,`vehicule_id` int
,`immatriculation` varchar(20)
,`total_frais` bigint
,`montant_total_frais` decimal(32,2)
,`frais_en_attente` bigint
,`montant_en_attente` decimal(32,2)
,`frais_valides` bigint
,`montant_valide` decimal(32,2)
,`total_carburant` decimal(32,2)
,`total_peage` decimal(32,2)
,`total_parking` decimal(32,2)
,`total_reparation` decimal(32,2)
,`total_versements` decimal(32,2)
,`total_autres` decimal(32,2)
,`premiere_soumission` date
,`derniere_soumission` date
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_frais_vehicules_complet`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_frais_vehicules_complet` (
`id` int
,`id_mouvement` int
,`type_frais` enum('carburant','peage','parking','reparation','autre','versement_journalier')
,`montant` decimal(10,2)
,`description` text
,`date` date
,`piece_justificative` varchar(255)
,`valide` tinyint(1)
,`valide_par` int
,`date_validation` datetime
,`destination` varchar(255)
,`motif` text
,`date_mission` date
,`heure_depart` time
,`heure_retour` time
,`distance_parcourue` int
,`chauffeur_id` int
,`chauffeur_matricule` varchar(20)
,`chauffeur_nom` varchar(150)
,`chauffeur_tel` varchar(20)
,`vehicule_id` int
,`immatriculation` varchar(20)
,`marque` varchar(50)
,`modele` varchar(50)
,`type_vehicule` enum('camion','pickup','voiture','moto','engin')
,`validateur_nom` varchar(150)
,`categorie_comptable` varchar(7)
,`statut_traitement` varchar(10)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_lignes_commande_achat`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_lignes_commande_achat` (
`id` int
,`id_commande_achat` int
,`type_article` enum('intrant','aliment','vehicule','piece','animal','equipement','autre')
,`id_article` int
,`designation` varchar(255)
,`description` text
,`quantite_commandee` decimal(10,2)
,`quantite_livree` decimal(10,2)
,`unite` varchar(50)
,`prix_unitaire_ht` decimal(10,2)
,`remise_pourcent` decimal(5,2)
,`tva_pourcent` decimal(5,2)
,`montant_ht` decimal(12,2)
,`montant_tva` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`statut_livraison` enum('en_attente','partielle','complete')
,`qualite_reception` enum('bonne','mauvaise','retournee')
,`remarques_reception` text
,`date_creation` timestamp
,`date_modification` timestamp
,`montant_ht_calcule` decimal(30,10)
,`montant_tva_calcule` decimal(39,16)
,`montant_ttc_calcule` decimal(40,16)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_lignes_commande_vente`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_lignes_commande_vente` (
`id` int
,`id_commande_vente` int
,`type_produit` enum('lait','oeufs','viande','culture','intrant','aliment','equipement','autre')
,`id_produit` int
,`designation` varchar(255)
,`description` text
,`quantite_commandee` decimal(10,2)
,`quantite_livree` decimal(10,2)
,`quantite_facturee` decimal(10,2)
,`unite` varchar(50)
,`prix_unitaire_ht` decimal(10,2)
,`remise_pourcent` decimal(5,2)
,`tva_pourcent` decimal(5,2)
,`montant_ht` decimal(12,2)
,`montant_tva` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`statut_livraison` enum('en_attente','partielle','complete')
,`date_creation` timestamp
,`date_modification` timestamp
,`montant_ht_calcule` decimal(30,10)
,`montant_tva_calcule` decimal(39,16)
,`montant_ttc_calcule` decimal(40,16)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_paiements`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_paiements` (
`id` int
,`reference_paiement` varchar(50)
,`type_paiement` enum('recette','depense')
,`source_type` enum('client','fournisseur','employe','banque','caisse','autre')
,`id_source` int
,`id_facture` int
,`id_commande` int
,`montant` decimal(12,2)
,`devise` varchar(3)
,`taux_change` decimal(10,4)
,`montant_devise` decimal(12,2)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','carte','compensation')
,`reference_mode` varchar(100)
,`date_paiement` date
,`banque` varchar(100)
,`numero_compte` varchar(50)
,`numero_cheque` varchar(50)
,`description` text
,`justificatif` varchar(255)
,`valide_par` int
,`date_validation` datetime
,`statut` enum('en_attente','valide','rejete','annule')
,`rapproche` tinyint(1)
,`date_rapprochement` date
,`date_creation` timestamp
,`date_modification` timestamp
,`montant_devise_calcule` decimal(22,6)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_rapports_financiers`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_rapports_financiers` (
`id` int
,`type_periode` enum('jour','semaine','mois','trimestre','annee')
,`date_debut` date
,`date_fin` date
,`id_departement` int
,`type_rapport` enum('commercial','financier','productivite','synthese')
,`chiffre_affaires` decimal(15,2)
,`cout_achats` decimal(15,2)
,`cout_production` decimal(15,2)
,`cout_personnel` decimal(15,2)
,`cout_operations` decimal(15,2)
,`autres_couts` decimal(15,2)
,`total_couts` decimal(15,2)
,`marge_brute` decimal(15,2)
,`resultat_net` decimal(15,2)
,`marge_brute_pourcent` decimal(5,2)
,`rentabilite_pourcent` decimal(5,2)
,`generate_par` int
,`date_generation` timestamp
,`commentaires` text
,`chemin_fichier` varchar(255)
,`format_export` enum('pdf','excel','csv')
,`total_couts_calcule` decimal(19,2)
,`marge_brute_calcule` decimal(17,2)
,`resultat_net_calcule` decimal(20,2)
,`marge_brute_pourcent_calcule` decimal(26,6)
,`rentabilite_pourcent_calcule` decimal(29,6)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_rations_alimentaires`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_rations_alimentaires` (
`id` int
,`id_animal` int
,`id_aliment` int
,`date_distribution` date
,`heure_distribution` time
,`quantite_distribuee` decimal(8,2)
,`unite_distribution` varchar(20)
,`distribue_par` int
,`acceptation` enum('complete','partielle','refusee')
,`reste_non_consomme` decimal(8,2)
,`observations` text
,`cout_distribution` decimal(8,2)
,`date_creation` timestamp
,`date_modification` timestamp
,`cout_distribution_calcule` decimal(16,4)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_salaires`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_salaires` (
`id` int
,`id_utilisateur` int
,`mois` int
,`annee` int
,`salaire_brut` decimal(10,2)
,`heures_travaillees` decimal(6,2)
,`heures_supp` decimal(6,2)
,`taux_heure_supp` decimal(8,2)
,`deduction_inss` decimal(10,2)
,`deduction_impots` decimal(10,2)
,`autres_deductions` decimal(10,2)
,`avances` decimal(10,2)
,`primes` decimal(10,2)
,`indemnites` decimal(10,2)
,`commissions` decimal(10,2)
,`total_deductions` decimal(10,2)
,`total_additions` decimal(10,2)
,`salaire_net` decimal(10,2)
,`mode_paiement` enum('virement','cheque','especes')
,`date_paiement` date
,`reference_paiement` varchar(100)
,`statut_paiement` enum('calculé','payé','reporté','annulé')
,`valide_par` int
,`date_validation` datetime
,`calcul_par` int
,`date_calcul` timestamp
,`date_modification` timestamp
,`total_deductions_calcule` decimal(13,2)
,`total_additions_calcule` decimal(15,4)
,`salaire_net_calcule` decimal(17,4)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_stocks`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_stocks` (
`id` int
,`type_article` enum('lait','oeufs','viande','culture','intrant','aliment','piece','equipement','autre')
,`id_article` int
,`quantite_disponible` decimal(10,2)
,`quantite_reservee` decimal(10,2)
,`quantite_reelle` decimal(10,2)
,`unite_mesure` varchar(20)
,`seuil_alerte` decimal(10,2)
,`emplacement` varchar(100)
,`zone` varchar(50)
,`etiquette` varchar(100)
,`date_entree` date
,`date_peremption` date
,`cout_unitaire` decimal(10,2)
,`valeur_stock` decimal(12,2)
,`statut` enum('disponible','reserve','epuise','perime','inventorie')
,`date_creation` timestamp
,`date_modification` timestamp
,`quantite_reelle_calcule` decimal(11,2)
,`jours_avant_peremption` int
,`valeur_stock_calcule` decimal(21,4)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_validations_doubles`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_validations_doubles` (
`id` int
,`action_type` varchar(100)
,`data_json` json
,`validation_token` varchar(64)
,`required_role` enum('admin','manager','comptable','veterinaire')
,`demande_par` int
,`date_demande` timestamp
,`valide_par` int
,`date_validation` datetime
,`decision` enum('en_attente','approuve','rejete')
,`commentaire_validation` text
,`execute_par` int
,`date_execution` datetime
,`resultat_execution` text
,`date_expiration` datetime
,`expire` tinyint(1)
,`date_expiration_calcule` datetime
,`expire_calcule` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_versements_journaliers`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_versements_journaliers` (
`id` int
,`date` date
,`montant` decimal(10,2)
,`description` text
,`valide` tinyint(1)
,`date_validation` datetime
,`chauffeur_id` int
,`chauffeur_matricule` varchar(20)
,`chauffeur_nom` varchar(150)
,`vehicule_immat` varchar(20)
,`marque` varchar(50)
,`modele` varchar(50)
,`destination` varchar(255)
,`date_mission` date
,`cumul_jour_chauffeur` decimal(32,2)
,`cumul_mois_chauffeur` decimal(32,2)
);

-- --------------------------------------------------------

--
-- Structure de la vue `v_applications_intrants`
--
DROP TABLE IF EXISTS `v_applications_intrants`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_applications_intrants`  AS SELECT `ai`.`id` AS `id`, `ai`.`id_culture` AS `id_culture`, `ai`.`id_intrant` AS `id_intrant`, `ai`.`id_parcelle` AS `id_parcelle`, `ai`.`id_applicateur` AS `id_applicateur`, `ai`.`date_application` AS `date_application`, `ai`.`quantite_utilisee` AS `quantite_utilisee`, `ai`.`unite_utilisee` AS `unite_utilisee`, `ai`.`methode_application` AS `methode_application`, `ai`.`conditions_meteo` AS `conditions_meteo`, `ai`.`humidite_sol` AS `humidite_sol`, `ai`.`temperature_air` AS `temperature_air`, `ai`.`objectif` AS `objectif`, `ai`.`observations` AS `observations`, `ai`.`cout_application` AS `cout_application`, `ai`.`date_creation` AS `date_creation`, `ai`.`date_modification` AS `date_modification`, (`ai`.`quantite_utilisee` * `ia`.`prix_unitaire_achat`) AS `cout_application_calcule` FROM (`applications_intrants` `ai` left join `intrants_agricoles` `ia` on((`ai`.`id_intrant` = `ia`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_assurances_vehicules`
--
DROP TABLE IF EXISTS `v_assurances_vehicules`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_assurances_vehicules`  AS SELECT `av`.`id` AS `id`, `av`.`id_vehicule` AS `id_vehicule`, `av`.`compagnie_assurance` AS `compagnie_assurance`, `av`.`numero_police` AS `numero_police`, `av`.`type_couverture` AS `type_couverture`, `av`.`date_debut` AS `date_debut`, `av`.`date_expiration` AS `date_expiration`, `av`.`montant_prime` AS `montant_prime`, `av`.`franchise` AS `franchise`, `av`.`scan_police` AS `scan_police`, `av`.`scan_attestation` AS `scan_attestation`, `av`.`notification_envoyee_30` AS `notification_envoyee_30`, `av`.`notification_envoyee_15` AS `notification_envoyee_15`, `av`.`notification_envoyee_7` AS `notification_envoyee_7`, `av`.`notification_envoyee_1` AS `notification_envoyee_1`, `av`.`statut` AS `statut`, `av`.`date_creation` AS `date_creation`, `av`.`date_modification` AS `date_modification`, (to_days(`av`.`date_expiration`) - to_days(curdate())) AS `jours_restants` FROM `assurances_vehicules` AS `av` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_commandes_achat`
--
DROP TABLE IF EXISTS `v_commandes_achat`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_commandes_achat`  AS SELECT `ca`.`id` AS `id`, `ca`.`numero_commande` AS `numero_commande`, `ca`.`id_fournisseur` AS `id_fournisseur`, `ca`.`date_commande` AS `date_commande`, `ca`.`date_livraison_prevue` AS `date_livraison_prevue`, `ca`.`date_livraison_reelle` AS `date_livraison_reelle`, `ca`.`lieu_livraison` AS `lieu_livraison`, `ca`.`mode_paiement` AS `mode_paiement`, `ca`.`conditions_paiement` AS `conditions_paiement`, `ca`.`delai_paiement_jours` AS `delai_paiement_jours`, `ca`.`montant_ht` AS `montant_ht`, `ca`.`tva_pourcent` AS `tva_pourcent`, `ca`.`montant_tva` AS `montant_tva`, `ca`.`montant_ttc` AS `montant_ttc`, `ca`.`frais_livraison` AS `frais_livraison`, `ca`.`remise` AS `remise`, `ca`.`montant_total` AS `montant_total`, `ca`.`livre_par` AS `livre_par`, `ca`.`contact_livreur` AS `contact_livreur`, `ca`.`observations_livraison` AS `observations_livraison`, `ca`.`valide_par` AS `valide_par`, `ca`.`date_validation` AS `date_validation`, `ca`.`statut` AS `statut`, `ca`.`cree_par` AS `cree_par`, `ca`.`date_creation` AS `date_creation`, `ca`.`modifie_par` AS `modifie_par`, `ca`.`date_modification` AS `date_modification`, ((`ca`.`montant_ht` * `ca`.`tva_pourcent`) / 100) AS `montant_tva_calcule`, (`ca`.`montant_ht` + ((`ca`.`montant_ht` * `ca`.`tva_pourcent`) / 100)) AS `montant_ttc_calcule`, (((`ca`.`montant_ht` + ((`ca`.`montant_ht` * `ca`.`tva_pourcent`) / 100)) + `ca`.`frais_livraison`) - `ca`.`remise`) AS `montant_total_calcule` FROM `commandes_achat` AS `ca` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_commandes_vente`
--
DROP TABLE IF EXISTS `v_commandes_vente`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_commandes_vente`  AS SELECT `cv`.`id` AS `id`, `cv`.`numero_commande` AS `numero_commande`, `cv`.`id_client` AS `id_client`, `cv`.`date_commande` AS `date_commande`, `cv`.`date_livraison_prevue` AS `date_livraison_prevue`, `cv`.`date_livraison_reelle` AS `date_livraison_reelle`, `cv`.`lieu_livraison` AS `lieu_livraison`, `cv`.`mode_paiement` AS `mode_paiement`, `cv`.`conditions_paiement` AS `conditions_paiement`, `cv`.`montant_ht` AS `montant_ht`, `cv`.`tva_pourcent` AS `tva_pourcent`, `cv`.`montant_tva` AS `montant_tva`, `cv`.`montant_ttc` AS `montant_ttc`, `cv`.`frais_livraison` AS `frais_livraison`, `cv`.`remise` AS `remise`, `cv`.`montant_total` AS `montant_total`, `cv`.`livre_par` AS `livre_par`, `cv`.`contact_livreur` AS `contact_livreur`, `cv`.`observations_livraison` AS `observations_livraison`, `cv`.`valide_par` AS `valide_par`, `cv`.`date_validation` AS `date_validation`, `cv`.`statut` AS `statut`, `cv`.`cree_par` AS `cree_par`, `cv`.`date_creation` AS `date_creation`, `cv`.`modifie_par` AS `modifie_par`, `cv`.`date_modification` AS `date_modification`, ((`cv`.`montant_ht` * `cv`.`tva_pourcent`) / 100) AS `montant_tva_calcule`, (`cv`.`montant_ht` + ((`cv`.`montant_ht` * `cv`.`tva_pourcent`) / 100)) AS `montant_ttc_calcule`, (((`cv`.`montant_ht` + ((`cv`.`montant_ht` * `cv`.`tva_pourcent`) / 100)) + `cv`.`frais_livraison`) - `cv`.`remise`) AS `montant_total_calcule` FROM `commandes_vente` AS `cv` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_confirmations_reception_salaire`
--
DROP TABLE IF EXISTS `v_confirmations_reception_salaire`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_confirmations_reception_salaire`  AS SELECT `c`.`id` AS `id`, `c`.`id_salaire` AS `id_salaire`, `c`.`id_utilisateur` AS `id_utilisateur`, `u`.`nom_complet` AS `employe_nom`, `u`.`matricule` AS `employe_matricule`, `u`.`email` AS `employe_email`, `dep`.`nom` AS `departement_nom`, `c`.`mois` AS `mois`, `c`.`annee` AS `annee`, `c`.`montant` AS `montant`, `c`.`confirme` AS `confirme`, `c`.`date_confirmation` AS `date_confirmation`, `c`.`methode_confirmation` AS `methode_confirmation`, `c`.`code_verification_utilise` AS `code_verification_utilise`, `s`.`statut_paiement` AS `statut_salaire`, `s`.`date_paiement` AS `date_paiement` FROM (((`confirmations_reception_salaire` `c` join `utilisateurs` `u` on((`c`.`id_utilisateur` = `u`.`id`))) left join `departements` `dep` on((`u`.`id_departement` = `dep`.`id`))) left join `salaires` `s` on((`c`.`id_salaire` = `s`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_dashboard_alertes`
--
DROP TABLE IF EXISTS `v_dashboard_alertes`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_dashboard_alertes`  AS SELECT 'assurance' AS `type_alerte`, concat('Assurance véhicule - Police: ',`assurances_vehicules`.`numero_police`) AS `description`, (to_days(`assurances_vehicules`.`date_expiration`) - to_days(curdate())) AS `jours_restants`, 'urgente' AS `priorite`, `assurances_vehicules`.`date_expiration` AS `date_echeance` FROM `assurances_vehicules` WHERE ((`assurances_vehicules`.`statut` = 'active') AND ((to_days(`assurances_vehicules`.`date_expiration`) - to_days(curdate())) <= 30))union all select 'facture' AS `type_alerte`,concat('Facture ',`factures`.`numero_facture`,' - ',`factures`.`type_facture`) AS `description`,(to_days(`factures`.`date_echeance`) - to_days(curdate())) AS `jours_restants`,(case when ((to_days(`factures`.`date_echeance`) - to_days(curdate())) < 0) then 'urgente' when ((to_days(`factures`.`date_echeance`) - to_days(curdate())) <= 7) then 'haute' else 'normale' end) AS `priorite`,`factures`.`date_echeance` AS `date_echeance` from `factures` where (`factures`.`statut_paiement` in ('impayee','partiellement_payee')) union all select 'stock' AS `type_alerte`,concat('Stock faible - ',`stocks`.`type_article`,' ID:',`stocks`.`id_article`) AS `description`,NULL AS `jours_restants`,'haute' AS `priorite`,NULL AS `date_echeance` from `stocks` where ((`stocks`.`quantite_disponible` <= `stocks`.`seuil_alerte`) and (`stocks`.`statut` = 'disponible')) union all select 'peremption' AS `type_alerte`,concat('Péremption proche - ',`stocks`.`type_article`,' ID:',`stocks`.`id_article`) AS `description`,(to_days(`stocks`.`date_peremption`) - to_days(curdate())) AS `jours_restants`,(case when ((to_days(`stocks`.`date_peremption`) - to_days(curdate())) <= 7) then 'urgente' when ((to_days(`stocks`.`date_peremption`) - to_days(curdate())) <= 15) then 'haute' else 'normale' end) AS `priorite`,`stocks`.`date_peremption` AS `date_echeance` from `stocks` where ((`stocks`.`date_peremption` is not null) and ((to_days(`stocks`.`date_peremption`) - to_days(curdate())) <= 30) and (`stocks`.`statut` = 'disponible')) order by `priorite` desc,`jours_restants`  ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_demandes_paiement_salaire`
--
DROP TABLE IF EXISTS `v_demandes_paiement_salaire`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_demandes_paiement_salaire`  AS SELECT `d`.`id` AS `id`, `d`.`id_salaire` AS `id_salaire`, `d`.`id_employe` AS `id_employe`, `u`.`nom_complet` AS `employe_nom`, `u`.`matricule` AS `employe_matricule`, `u`.`email` AS `employe_email`, `dep`.`nom` AS `departement_nom`, `d`.`mois` AS `mois`, `d`.`annee` AS `annee`, `d`.`montant` AS `montant`, `d`.`statut` AS `statut`, `d`.`motif_rejet` AS `motif_rejet`, `d`.`date_demande` AS `date_demande`, `d`.`date_traitement` AS `date_traitement`, `d`.`traite_par` AS `traite_par`, `u2`.`nom_complet` AS `traite_par_nom`, `d`.`commentaire` AS `commentaire`, `s`.`statut_paiement` AS `statut_salaire`, (to_days(now()) - to_days(`d`.`date_demande`)) AS `jours_attente` FROM ((((`demandes_paiement_salaire` `d` join `utilisateurs` `u` on((`d`.`id_employe` = `u`.`id`))) left join `departements` `dep` on((`u`.`id_departement` = `dep`.`id`))) left join `utilisateurs` `u2` on((`d`.`traite_par` = `u2`.`id`))) left join `salaires` `s` on((`d`.`id_salaire` = `s`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_factures`
--
DROP TABLE IF EXISTS `v_factures`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_factures`  AS SELECT `f`.`id` AS `id`, `f`.`numero_facture` AS `numero_facture`, `f`.`type_facture` AS `type_facture`, `f`.`id_commande` AS `id_commande`, `f`.`id_fournisseur` AS `id_fournisseur`, `f`.`id_client` AS `id_client`, `f`.`date_facture` AS `date_facture`, `f`.`date_echeance` AS `date_echeance`, `f`.`montant_ht` AS `montant_ht`, `f`.`montant_tva` AS `montant_tva`, `f`.`montant_ttc` AS `montant_ttc`, `f`.`montant_regle` AS `montant_regle`, `f`.`montant_du` AS `montant_du`, `f`.`statut_paiement` AS `statut_paiement`, `f`.`date_dernier_paiement` AS `date_dernier_paiement`, `f`.`mode_reglement` AS `mode_reglement`, `f`.`nombre_relances` AS `nombre_relances`, `f`.`date_derniere_relance` AS `date_derniere_relance`, `f`.`chemin_fichier` AS `chemin_fichier`, `f`.`scan_quittance` AS `scan_quittance`, `f`.`cree_par` AS `cree_par`, `f`.`date_creation` AS `date_creation`, `f`.`modifie_par` AS `modifie_par`, `f`.`date_modification` AS `date_modification`, (to_days(`f`.`date_echeance`) - to_days(curdate())) AS `jours_restants`, (`f`.`montant_ttc` - `f`.`montant_regle`) AS `montant_du_calcule` FROM `factures` AS `f` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_frais_chauffeur_stats`
--
DROP TABLE IF EXISTS `v_frais_chauffeur_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_frais_chauffeur_stats`  AS SELECT `u`.`id` AS `chauffeur_id`, `u`.`matricule` AS `matricule`, `u`.`nom_complet` AS `chauffeur_nom`, `v`.`id` AS `vehicule_id`, `v`.`immatriculation` AS `immatriculation`, count(distinct `f`.`id`) AS `total_frais`, coalesce(sum(`f`.`montant`),0) AS `montant_total_frais`, count(distinct (case when (`f`.`valide` = 0) then `f`.`id` end)) AS `frais_en_attente`, coalesce(sum((case when (`f`.`valide` = 0) then `f`.`montant` else 0 end)),0) AS `montant_en_attente`, count(distinct (case when (`f`.`valide` = 1) then `f`.`id` end)) AS `frais_valides`, coalesce(sum((case when (`f`.`valide` = 1) then `f`.`montant` else 0 end)),0) AS `montant_valide`, coalesce(sum((case when (`f`.`type_frais` = 'carburant') then `f`.`montant` else 0 end)),0) AS `total_carburant`, coalesce(sum((case when (`f`.`type_frais` = 'peage') then `f`.`montant` else 0 end)),0) AS `total_peage`, coalesce(sum((case when (`f`.`type_frais` = 'parking') then `f`.`montant` else 0 end)),0) AS `total_parking`, coalesce(sum((case when (`f`.`type_frais` = 'reparation') then `f`.`montant` else 0 end)),0) AS `total_reparation`, coalesce(sum((case when (`f`.`type_frais` = 'versement_journalier') then `f`.`montant` else 0 end)),0) AS `total_versements`, coalesce(sum((case when (`f`.`type_frais` = 'autre') then `f`.`montant` else 0 end)),0) AS `total_autres`, min(`f`.`date`) AS `premiere_soumission`, max(`f`.`date`) AS `derniere_soumission` FROM (((`utilisateurs` `u` left join `vehicules` `v` on((`u`.`id` = `v`.`id_chauffeur_attitre`))) left join `mouvements_vehicules` `m` on(((`v`.`id` = `m`.`id_vehicule`) and (`m`.`id_chauffeur` = `u`.`id`)))) left join `frais_vehicules` `f` on((`m`.`id` = `f`.`id_mouvement`))) WHERE (`u`.`role` = 'chauffeur') GROUP BY `u`.`id`, `u`.`matricule`, `u`.`nom_complet`, `v`.`id`, `v`.`immatriculation` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_frais_vehicules_complet`
--
DROP TABLE IF EXISTS `v_frais_vehicules_complet`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_frais_vehicules_complet`  AS SELECT `f`.`id` AS `id`, `f`.`id_mouvement` AS `id_mouvement`, `f`.`type_frais` AS `type_frais`, `f`.`montant` AS `montant`, `f`.`description` AS `description`, `f`.`date` AS `date`, `f`.`piece_justificative` AS `piece_justificative`, `f`.`valide` AS `valide`, `f`.`valide_par` AS `valide_par`, `f`.`date_validation` AS `date_validation`, `m`.`destination` AS `destination`, `m`.`motif` AS `motif`, `m`.`date_mission` AS `date_mission`, `m`.`heure_depart` AS `heure_depart`, `m`.`heure_retour` AS `heure_retour`, `m`.`distance_parcourue` AS `distance_parcourue`, `u`.`id` AS `chauffeur_id`, `u`.`matricule` AS `chauffeur_matricule`, `u`.`nom_complet` AS `chauffeur_nom`, `u`.`telephone` AS `chauffeur_tel`, `v`.`id` AS `vehicule_id`, `v`.`immatriculation` AS `immatriculation`, `v`.`marque` AS `marque`, `v`.`modele` AS `modele`, `v`.`type_vehicule` AS `type_vehicule`, `val`.`nom_complet` AS `validateur_nom`, (case when (`f`.`type_frais` = 'versement_journalier') then 'RECETTE' else 'DEPENSE' end) AS `categorie_comptable`, (case when (`f`.`valide` = 1) then 'Validé' when ((`f`.`valide` = 0) and (`f`.`date` < (curdate() - interval 7 day))) then 'En retard' else 'En attente' end) AS `statut_traitement` FROM ((((`frais_vehicules` `f` left join `mouvements_vehicules` `m` on((`f`.`id_mouvement` = `m`.`id`))) left join `utilisateurs` `u` on((`m`.`id_chauffeur` = `u`.`id`))) left join `vehicules` `v` on((`m`.`id_vehicule` = `v`.`id`))) left join `utilisateurs` `val` on((`f`.`valide_par` = `val`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_lignes_commande_achat`
--
DROP TABLE IF EXISTS `v_lignes_commande_achat`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_lignes_commande_achat`  AS SELECT `lca`.`id` AS `id`, `lca`.`id_commande_achat` AS `id_commande_achat`, `lca`.`type_article` AS `type_article`, `lca`.`id_article` AS `id_article`, `lca`.`designation` AS `designation`, `lca`.`description` AS `description`, `lca`.`quantite_commandee` AS `quantite_commandee`, `lca`.`quantite_livree` AS `quantite_livree`, `lca`.`unite` AS `unite`, `lca`.`prix_unitaire_ht` AS `prix_unitaire_ht`, `lca`.`remise_pourcent` AS `remise_pourcent`, `lca`.`tva_pourcent` AS `tva_pourcent`, `lca`.`montant_ht` AS `montant_ht`, `lca`.`montant_tva` AS `montant_tva`, `lca`.`montant_ttc` AS `montant_ttc`, `lca`.`date_livraison_prevue` AS `date_livraison_prevue`, `lca`.`date_livraison_reelle` AS `date_livraison_reelle`, `lca`.`statut_livraison` AS `statut_livraison`, `lca`.`qualite_reception` AS `qualite_reception`, `lca`.`remarques_reception` AS `remarques_reception`, `lca`.`date_creation` AS `date_creation`, `lca`.`date_modification` AS `date_modification`, ((`lca`.`quantite_commandee` * `lca`.`prix_unitaire_ht`) * (1 - (`lca`.`remise_pourcent` / 100))) AS `montant_ht_calcule`, ((((`lca`.`quantite_commandee` * `lca`.`prix_unitaire_ht`) * (1 - (`lca`.`remise_pourcent` / 100))) * `lca`.`tva_pourcent`) / 100) AS `montant_tva_calcule`, (((`lca`.`quantite_commandee` * `lca`.`prix_unitaire_ht`) * (1 - (`lca`.`remise_pourcent` / 100))) + ((((`lca`.`quantite_commandee` * `lca`.`prix_unitaire_ht`) * (1 - (`lca`.`remise_pourcent` / 100))) * `lca`.`tva_pourcent`) / 100)) AS `montant_ttc_calcule` FROM `lignes_commande_achat` AS `lca` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_lignes_commande_vente`
--
DROP TABLE IF EXISTS `v_lignes_commande_vente`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_lignes_commande_vente`  AS SELECT `lcv`.`id` AS `id`, `lcv`.`id_commande_vente` AS `id_commande_vente`, `lcv`.`type_produit` AS `type_produit`, `lcv`.`id_produit` AS `id_produit`, `lcv`.`designation` AS `designation`, `lcv`.`description` AS `description`, `lcv`.`quantite_commandee` AS `quantite_commandee`, `lcv`.`quantite_livree` AS `quantite_livree`, `lcv`.`quantite_facturee` AS `quantite_facturee`, `lcv`.`unite` AS `unite`, `lcv`.`prix_unitaire_ht` AS `prix_unitaire_ht`, `lcv`.`remise_pourcent` AS `remise_pourcent`, `lcv`.`tva_pourcent` AS `tva_pourcent`, `lcv`.`montant_ht` AS `montant_ht`, `lcv`.`montant_tva` AS `montant_tva`, `lcv`.`montant_ttc` AS `montant_ttc`, `lcv`.`date_livraison_prevue` AS `date_livraison_prevue`, `lcv`.`date_livraison_reelle` AS `date_livraison_reelle`, `lcv`.`statut_livraison` AS `statut_livraison`, `lcv`.`date_creation` AS `date_creation`, `lcv`.`date_modification` AS `date_modification`, ((`lcv`.`quantite_commandee` * `lcv`.`prix_unitaire_ht`) * (1 - (`lcv`.`remise_pourcent` / 100))) AS `montant_ht_calcule`, ((((`lcv`.`quantite_commandee` * `lcv`.`prix_unitaire_ht`) * (1 - (`lcv`.`remise_pourcent` / 100))) * `lcv`.`tva_pourcent`) / 100) AS `montant_tva_calcule`, (((`lcv`.`quantite_commandee` * `lcv`.`prix_unitaire_ht`) * (1 - (`lcv`.`remise_pourcent` / 100))) + ((((`lcv`.`quantite_commandee` * `lcv`.`prix_unitaire_ht`) * (1 - (`lcv`.`remise_pourcent` / 100))) * `lcv`.`tva_pourcent`) / 100)) AS `montant_ttc_calcule` FROM `lignes_commande_vente` AS `lcv` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_paiements`
--
DROP TABLE IF EXISTS `v_paiements`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_paiements`  AS SELECT `p`.`id` AS `id`, `p`.`reference_paiement` AS `reference_paiement`, `p`.`type_paiement` AS `type_paiement`, `p`.`source_type` AS `source_type`, `p`.`id_source` AS `id_source`, `p`.`id_facture` AS `id_facture`, `p`.`id_commande` AS `id_commande`, `p`.`montant` AS `montant`, `p`.`devise` AS `devise`, `p`.`taux_change` AS `taux_change`, `p`.`montant_devise` AS `montant_devise`, `p`.`mode_paiement` AS `mode_paiement`, `p`.`reference_mode` AS `reference_mode`, `p`.`date_paiement` AS `date_paiement`, `p`.`banque` AS `banque`, `p`.`numero_compte` AS `numero_compte`, `p`.`numero_cheque` AS `numero_cheque`, `p`.`description` AS `description`, `p`.`justificatif` AS `justificatif`, `p`.`valide_par` AS `valide_par`, `p`.`date_validation` AS `date_validation`, `p`.`statut` AS `statut`, `p`.`rapproche` AS `rapproche`, `p`.`date_rapprochement` AS `date_rapprochement`, `p`.`date_creation` AS `date_creation`, `p`.`date_modification` AS `date_modification`, (`p`.`montant` * `p`.`taux_change`) AS `montant_devise_calcule` FROM `paiements` AS `p` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_rapports_financiers`
--
DROP TABLE IF EXISTS `v_rapports_financiers`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_rapports_financiers`  AS SELECT `rf`.`id` AS `id`, `rf`.`type_periode` AS `type_periode`, `rf`.`date_debut` AS `date_debut`, `rf`.`date_fin` AS `date_fin`, `rf`.`id_departement` AS `id_departement`, `rf`.`type_rapport` AS `type_rapport`, `rf`.`chiffre_affaires` AS `chiffre_affaires`, `rf`.`cout_achats` AS `cout_achats`, `rf`.`cout_production` AS `cout_production`, `rf`.`cout_personnel` AS `cout_personnel`, `rf`.`cout_operations` AS `cout_operations`, `rf`.`autres_couts` AS `autres_couts`, `rf`.`total_couts` AS `total_couts`, `rf`.`marge_brute` AS `marge_brute`, `rf`.`resultat_net` AS `resultat_net`, `rf`.`marge_brute_pourcent` AS `marge_brute_pourcent`, `rf`.`rentabilite_pourcent` AS `rentabilite_pourcent`, `rf`.`generate_par` AS `generate_par`, `rf`.`date_generation` AS `date_generation`, `rf`.`commentaires` AS `commentaires`, `rf`.`chemin_fichier` AS `chemin_fichier`, `rf`.`format_export` AS `format_export`, ((((`rf`.`cout_achats` + `rf`.`cout_production`) + `rf`.`cout_personnel`) + `rf`.`cout_operations`) + `rf`.`autres_couts`) AS `total_couts_calcule`, ((`rf`.`chiffre_affaires` - `rf`.`cout_achats`) - `rf`.`cout_production`) AS `marge_brute_calcule`, (`rf`.`chiffre_affaires` - ((((`rf`.`cout_achats` + `rf`.`cout_production`) + `rf`.`cout_personnel`) + `rf`.`cout_operations`) + `rf`.`autres_couts`)) AS `resultat_net_calcule`, (case when (`rf`.`chiffre_affaires` > 0) then ((((`rf`.`chiffre_affaires` - `rf`.`cout_achats`) - `rf`.`cout_production`) / `rf`.`chiffre_affaires`) * 100) else 0 end) AS `marge_brute_pourcent_calcule`, (case when (`rf`.`chiffre_affaires` > 0) then (((`rf`.`chiffre_affaires` - ((((`rf`.`cout_achats` + `rf`.`cout_production`) + `rf`.`cout_personnel`) + `rf`.`cout_operations`) + `rf`.`autres_couts`)) / `rf`.`chiffre_affaires`) * 100) else 0 end) AS `rentabilite_pourcent_calcule` FROM `rapports_financiers` AS `rf` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_rations_alimentaires`
--
DROP TABLE IF EXISTS `v_rations_alimentaires`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_rations_alimentaires`  AS SELECT `ra`.`id` AS `id`, `ra`.`id_animal` AS `id_animal`, `ra`.`id_aliment` AS `id_aliment`, `ra`.`date_distribution` AS `date_distribution`, `ra`.`heure_distribution` AS `heure_distribution`, `ra`.`quantite_distribuee` AS `quantite_distribuee`, `ra`.`unite_distribution` AS `unite_distribution`, `ra`.`distribue_par` AS `distribue_par`, `ra`.`acceptation` AS `acceptation`, `ra`.`reste_non_consomme` AS `reste_non_consomme`, `ra`.`observations` AS `observations`, `ra`.`cout_distribution` AS `cout_distribution`, `ra`.`date_creation` AS `date_creation`, `ra`.`date_modification` AS `date_modification`, (`ra`.`quantite_distribuee` * `ab`.`prix_unitaire_achat`) AS `cout_distribution_calcule` FROM (`rations_alimentaires` `ra` left join `aliments_betail` `ab` on((`ra`.`id_aliment` = `ab`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_salaires`
--
DROP TABLE IF EXISTS `v_salaires`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_salaires`  AS SELECT `s`.`id` AS `id`, `s`.`id_utilisateur` AS `id_utilisateur`, `s`.`mois` AS `mois`, `s`.`annee` AS `annee`, `s`.`salaire_brut` AS `salaire_brut`, `s`.`heures_travaillees` AS `heures_travaillees`, `s`.`heures_supp` AS `heures_supp`, `s`.`taux_heure_supp` AS `taux_heure_supp`, `s`.`deduction_inss` AS `deduction_inss`, `s`.`deduction_impots` AS `deduction_impots`, `s`.`autres_deductions` AS `autres_deductions`, `s`.`avances` AS `avances`, `s`.`primes` AS `primes`, `s`.`indemnites` AS `indemnites`, `s`.`commissions` AS `commissions`, `s`.`total_deductions` AS `total_deductions`, `s`.`total_additions` AS `total_additions`, `s`.`salaire_net` AS `salaire_net`, `s`.`mode_paiement` AS `mode_paiement`, `s`.`date_paiement` AS `date_paiement`, `s`.`reference_paiement` AS `reference_paiement`, `s`.`statut_paiement` AS `statut_paiement`, `s`.`valide_par` AS `valide_par`, `s`.`date_validation` AS `date_validation`, `s`.`calcul_par` AS `calcul_par`, `s`.`date_calcul` AS `date_calcul`, `s`.`date_modification` AS `date_modification`, (((`s`.`deduction_inss` + `s`.`deduction_impots`) + `s`.`autres_deductions`) + `s`.`avances`) AS `total_deductions_calcule`, (((`s`.`primes` + `s`.`indemnites`) + `s`.`commissions`) + (`s`.`heures_supp` * `s`.`taux_heure_supp`)) AS `total_additions_calcule`, ((`s`.`salaire_brut` - (((`s`.`deduction_inss` + `s`.`deduction_impots`) + `s`.`autres_deductions`) + `s`.`avances`)) + (((`s`.`primes` + `s`.`indemnites`) + `s`.`commissions`) + (`s`.`heures_supp` * `s`.`taux_heure_supp`))) AS `salaire_net_calcule` FROM `salaires` AS `s` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_stocks`
--
DROP TABLE IF EXISTS `v_stocks`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_stocks`  AS SELECT `s`.`id` AS `id`, `s`.`type_article` AS `type_article`, `s`.`id_article` AS `id_article`, `s`.`quantite_disponible` AS `quantite_disponible`, `s`.`quantite_reservee` AS `quantite_reservee`, `s`.`quantite_reelle` AS `quantite_reelle`, `s`.`unite_mesure` AS `unite_mesure`, `s`.`seuil_alerte` AS `seuil_alerte`, `s`.`emplacement` AS `emplacement`, `s`.`zone` AS `zone`, `s`.`etiquette` AS `etiquette`, `s`.`date_entree` AS `date_entree`, `s`.`date_peremption` AS `date_peremption`, `s`.`cout_unitaire` AS `cout_unitaire`, `s`.`valeur_stock` AS `valeur_stock`, `s`.`statut` AS `statut`, `s`.`date_creation` AS `date_creation`, `s`.`date_modification` AS `date_modification`, (`s`.`quantite_disponible` - `s`.`quantite_reservee`) AS `quantite_reelle_calcule`, (case when (`s`.`date_peremption` is not null) then (to_days(`s`.`date_peremption`) - to_days(curdate())) else NULL end) AS `jours_avant_peremption`, ((`s`.`quantite_disponible` - `s`.`quantite_reservee`) * `s`.`cout_unitaire`) AS `valeur_stock_calcule` FROM `stocks` AS `s` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_validations_doubles`
--
DROP TABLE IF EXISTS `v_validations_doubles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_validations_doubles`  AS SELECT `vd`.`id` AS `id`, `vd`.`action_type` AS `action_type`, `vd`.`data_json` AS `data_json`, `vd`.`validation_token` AS `validation_token`, `vd`.`required_role` AS `required_role`, `vd`.`demande_par` AS `demande_par`, `vd`.`date_demande` AS `date_demande`, `vd`.`valide_par` AS `valide_par`, `vd`.`date_validation` AS `date_validation`, `vd`.`decision` AS `decision`, `vd`.`commentaire_validation` AS `commentaire_validation`, `vd`.`execute_par` AS `execute_par`, `vd`.`date_execution` AS `date_execution`, `vd`.`resultat_execution` AS `resultat_execution`, `vd`.`date_expiration` AS `date_expiration`, `vd`.`expire` AS `expire`, (`vd`.`date_demande` + interval 7 day) AS `date_expiration_calcule`, (now() > (`vd`.`date_demande` + interval 7 day)) AS `expire_calcule` FROM `validations_doubles` AS `vd` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_versements_journaliers`
--
DROP TABLE IF EXISTS `v_versements_journaliers`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_versements_journaliers`  AS SELECT `f`.`id` AS `id`, `f`.`date` AS `date`, `f`.`montant` AS `montant`, `f`.`description` AS `description`, `f`.`valide` AS `valide`, `f`.`date_validation` AS `date_validation`, `u`.`id` AS `chauffeur_id`, `u`.`matricule` AS `chauffeur_matricule`, `u`.`nom_complet` AS `chauffeur_nom`, `v`.`immatriculation` AS `vehicule_immat`, `v`.`marque` AS `marque`, `v`.`modele` AS `modele`, `m`.`destination` AS `destination`, `m`.`date_mission` AS `date_mission`, (select coalesce(sum(`f2`.`montant`),0) from (`frais_vehicules` `f2` join `mouvements_vehicules` `m2` on((`f2`.`id_mouvement` = `m2`.`id`))) where ((`m2`.`id_chauffeur` = `u`.`id`) and (`f2`.`type_frais` = 'versement_journalier') and (`f2`.`date` = `f`.`date`))) AS `cumul_jour_chauffeur`, (select coalesce(sum(`f3`.`montant`),0) from (`frais_vehicules` `f3` join `mouvements_vehicules` `m3` on((`f3`.`id_mouvement` = `m3`.`id`))) where ((`m3`.`id_chauffeur` = `u`.`id`) and (`f3`.`type_frais` = 'versement_journalier') and (month(`f3`.`date`) = month(`f`.`date`)) and (year(`f3`.`date`) = year(`f`.`date`)))) AS `cumul_mois_chauffeur` FROM (((`frais_vehicules` `f` join `mouvements_vehicules` `m` on((`f`.`id_mouvement` = `m`.`id`))) join `utilisateurs` `u` on((`m`.`id_chauffeur` = `u`.`id`))) join `vehicules` `v` on((`m`.`id_vehicule` = `v`.`id`))) WHERE (`f`.`type_frais` = 'versement_journalier') ORDER BY `f`.`date` DESC, `f`.`id` DESC ;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `aliments_betail`
--
ALTER TABLE `aliments_betail`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_aliment` (`code_aliment`),
  ADD KEY `idx_code` (`code_aliment`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_stock` (`quantite_stock`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `animaux`
--
ALTER TABLE `animaux`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_identification` (`numero_identification`),
  ADD KEY `id_mere` (`id_mere`),
  ADD KEY `id_pere` (`id_pere`),
  ADD KEY `idx_numero` (`numero_identification`),
  ADD KEY `idx_espece` (`espece`),
  ADD KEY `idx_race` (`race`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_sante` (`statut_sante`),
  ADD KEY `idx_date_naissance` (`date_naissance`);

--
-- Index pour la table `applications_intrants`
--
ALTER TABLE `applications_intrants`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_applicateur` (`id_applicateur`),
  ADD KEY `idx_culture` (`id_culture`),
  ADD KEY `idx_intrant` (`id_intrant`),
  ADD KEY `idx_date` (`date_application`),
  ADD KEY `idx_parcelle` (`id_parcelle`);

--
-- Index pour la table `assurances_vehicules`
--
ALTER TABLE `assurances_vehicules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_police` (`numero_police`),
  ADD KEY `idx_vehicule` (`id_vehicule`),
  ADD KEY `idx_expiration` (`date_expiration`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_compagnie` (`compagnie_assurance`);

--
-- Index pour la table `budgets_departements`
--
ALTER TABLE `budgets_departements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_dept_annee` (`id_departement`,`annee`),
  ADD KEY `idx_annee` (`annee`),
  ADD KEY `idx_departement` (`id_departement`);

--
-- Index pour la table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_client` (`code_client`),
  ADD KEY `idx_code` (`code_client`),
  ADD KEY `idx_nom` (`nom_client`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_fidelite` (`niveau_fidelite`);
ALTER TABLE `clients` ADD FULLTEXT KEY `idx_recherche` (`nom_client`,`contact_principal`,`telephone`,`email`);

--
-- Index pour la table `codes_verification_salaire`
--
ALTER TABLE `codes_verification_salaire`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_salaire` (`id_salaire`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_code` (`code_verification`),
  ADD KEY `idx_expiration` (`date_expiration`);

--
-- Index pour la table `commandes_achat`
--
ALTER TABLE `commandes_achat`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_commande` (`numero_commande`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `idx_numero` (`numero_commande`),
  ADD KEY `idx_fournisseur` (`id_fournisseur`),
  ADD KEY `idx_date_commande` (`date_commande`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_livraison` (`date_livraison_prevue`);

--
-- Index pour la table `commandes_vente`
--
ALTER TABLE `commandes_vente`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_commande` (`numero_commande`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `idx_numero` (`numero_commande`),
  ADD KEY `idx_client` (`id_client`),
  ADD KEY `idx_date_commande` (`date_commande`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_livraison` (`date_livraison_prevue`);

--
-- Index pour la table `confirmations_reception_salaire`
--
ALTER TABLE `confirmations_reception_salaire`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_confirmation_salaire` (`id_salaire`,`id_utilisateur`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_date_confirmation` (`date_confirmation`),
  ADD KEY `idx_confirme` (`confirme`);

--
-- Index pour la table `conges`
--
ALTER TABLE `conges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_dates` (`date_debut`,`date_fin`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_type` (`type_conge`);

--
-- Index pour la table `cultures`
--
ALTER TABLE `cultures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_culture_parcelle_saison` (`id_parcelle`,`reference_saison`),
  ADD KEY `idx_parcelle` (`id_parcelle`),
  ADD KEY `idx_type_culture` (`id_type_culture`),
  ADD KEY `idx_dates` (`date_semaison`,`date_recolte_prevue`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `demandes_budget`
--
ALTER TABLE `demandes_budget`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_demandeur` (`id_demandeur`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_urgence` (`urgence`),
  ADD KEY `idx_date` (`date_demande`);

--
-- Index pour la table `demandes_paiement_salaire`
--
ALTER TABLE `demandes_paiement_salaire`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_salaire` (`id_salaire`),
  ADD KEY `idx_employe` (`id_employe`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_demande` (`date_demande`),
  ADD KEY `fk_demande_traite_par` (`traite_par`);

--
-- Index pour la table `departements`
--
ALTER TABLE `departements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_parent` (`id_parent`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `depenses_departement`
--
ALTER TABLE `depenses_departement`
  ADD PRIMARY KEY (`id`),
  ADD KEY `effectue_par` (`effectue_par`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_date` (`date_depense`),
  ADD KEY `idx_categorie` (`categorie`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `push_token` (`push_token`),
  ADD KEY `idx_user` (`id_utilisateur`),
  ADD KEY `idx_push_token` (`push_token`),
  ADD KEY `idx_device_id` (`device_id`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Index pour la table `employes`
--
ALTER TABLE `employes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_matricule` (`matricule`),
  ADD UNIQUE KEY `uk_email` (`email`),
  ADD UNIQUE KEY `CNI` (`numero_cni`),
  ADD UNIQUE KEY `numero_cni` (`numero_cni`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `modifie_par` (`modifie_par`),
  ADD KEY `idx_matricule` (`matricule`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_type_employe` (`type_employe`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_embauche` (`date_embauche`);

--
-- Index pour la table `evaluations_performance`
--
ALTER TABLE `evaluations_performance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_evaluateur` (`id_evaluateur`),
  ADD KEY `idx_employe` (`id_employe`),
  ADD KEY `idx_date` (`date_evaluation`),
  ADD KEY `idx_note` (`note_performance`);

--
-- Index pour la table `factures`
--
ALTER TABLE `factures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_facture` (`numero_facture`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `idx_numero` (`numero_facture`),
  ADD KEY `idx_type` (`type_facture`),
  ADD KEY `idx_date_facture` (`date_facture`),
  ADD KEY `idx_date_echeance` (`date_echeance`),
  ADD KEY `idx_statut_paiement` (`statut_paiement`),
  ADD KEY `idx_client` (`id_client`),
  ADD KEY `idx_fournisseur` (`id_fournisseur`);

--
-- Index pour la table `fournisseurs`
--
ALTER TABLE `fournisseurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_fournisseur` (`code_fournisseur`),
  ADD KEY `idx_code` (`code_fournisseur`),
  ADD KEY `idx_nom` (`nom_fournisseur`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_evaluation` (`note_evaluation`);
ALTER TABLE `fournisseurs` ADD FULLTEXT KEY `idx_recherche` (`nom_fournisseur`,`contact_principal`,`telephone`,`email`);

--
-- Index pour la table `frais_vehicules`
--
ALTER TABLE `frais_vehicules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_mouvement` (`id_mouvement`),
  ADD KEY `idx_type` (`type_frais`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_valide` (`valide`);

--
-- Index pour la table `intrants_agricoles`
--
ALTER TABLE `intrants_agricoles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_intrant` (`code_intrant`),
  ADD KEY `idx_code` (`code_intrant`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_stock` (`quantite_stock`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `journal_comptable`
--
ALTER TABLE `journal_comptable`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_ecriture` (`numero_ecriture`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `rapproche_par` (`rapproche_par`),
  ADD KEY `idx_numero_ecriture` (`numero_ecriture`),
  ADD KEY `idx_date_operation` (`date_operation`),
  ADD KEY `idx_categorie` (`categorie`),
  ADD KEY `idx_type_mouvement` (`type_mouvement`),
  ADD KEY `idx_exercice_periode` (`exercice_comptable`,`periode_comptable`),
  ADD KEY `idx_table_source` (`table_source`,`id_source`),
  ADD KEY `idx_tiers` (`tiers_type`,`tiers_id`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_effectue_par` (`effectue_par`);
ALTER TABLE `journal_comptable` ADD FULLTEXT KEY `idx_recherche` (`libelle`,`description`,`reference_externe`,`tiers_nom`);

--
-- Index pour la table `lignes_commande_achat`
--
ALTER TABLE `lignes_commande_achat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_commande` (`id_commande_achat`),
  ADD KEY `idx_type_article` (`type_article`),
  ADD KEY `idx_article` (`id_article`),
  ADD KEY `idx_statut_livraison` (`statut_livraison`);

--
-- Index pour la table `lignes_commande_vente`
--
ALTER TABLE `lignes_commande_vente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_commande` (`id_commande_vente`),
  ADD KEY `idx_type_produit` (`type_produit`),
  ADD KEY `idx_produit` (`id_produit`),
  ADD KEY `idx_statut_livraison` (`statut_livraison`);

--
-- Index pour la table `maintenances_vehicules`
--
ALTER TABLE `maintenances_vehicules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_vehicule` (`id_vehicule`),
  ADD KEY `idx_date` (`date_intervention`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_type` (`type_maintenance`);

--
-- Index pour la table `mouvements_stock`
--
ALTER TABLE `mouvements_stock`
  ADD PRIMARY KEY (`id`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_stock` (`id_stock`),
  ADD KEY `idx_type_mouvement` (`type_mouvement`),
  ADD KEY `idx_date` (`date_mouvement`),
  ADD KEY `idx_reference` (`type_reference`,`id_reference`),
  ADD KEY `idx_effectue_par` (`effectue_par`);

--
-- Index pour la table `mouvements_vehicules`
--
ALTER TABLE `mouvements_vehicules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_vehicule` (`id_vehicule`),
  ADD KEY `idx_chauffeur` (`id_chauffeur`),
  ADD KEY `idx_date` (`date_mission`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_type` (`type_mouvement`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_type` (`type_notification`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_creation` (`date_creation`),
  ADD KEY `idx_priorite` (`priorite`);

--
-- Index pour la table `paiements`
--
ALTER TABLE `paiements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `reference_paiement` (`reference_paiement`),
  ADD KEY `id_facture` (`id_facture`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_reference` (`reference_paiement`),
  ADD KEY `idx_type` (`type_paiement`),
  ADD KEY `idx_source` (`source_type`,`id_source`),
  ADD KEY `idx_date` (`date_paiement`),
  ADD KEY `idx_mode` (`mode_paiement`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_rapproche` (`rapproche`);

--
-- Index pour la table `parcelles`
--
ALTER TABLE `parcelles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `reference` (`reference`),
  ADD KEY `idx_reference` (`reference`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_localisation` (`localisation`),
  ADD KEY `idx_superficie` (`superficie_hectares`);

--
-- Index pour la table `presences`
--
ALTER TABLE `presences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_presence_user_date` (`id_utilisateur`,`date`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `productions_lait`
--
ALTER TABLE `productions_lait`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_production_animal_date` (`id_animal`,`date_production`,`heure_traite`),
  ADD KEY `traite_par` (`traite_par`),
  ADD KEY `idx_animal` (`id_animal`),
  ADD KEY `idx_date` (`date_production`),
  ADD KEY `idx_qualite` (`qualite`);

--
-- Index pour la table `productions_oeufs`
--
ALTER TABLE `productions_oeufs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recolte_par` (`recolte_par`),
  ADD KEY `idx_poulailler` (`id_poulailler`),
  ADD KEY `idx_date` (`date_recolte`),
  ADD KEY `idx_destination` (`destination`);

--
-- Index pour la table `rapports_financiers`
--
ALTER TABLE `rapports_financiers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `generate_par` (`generate_par`),
  ADD KEY `idx_periode` (`type_periode`,`date_debut`,`date_fin`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_type_rapport` (`type_rapport`),
  ADD KEY `idx_date_generation` (`date_generation`);

--
-- Index pour la table `rations_alimentaires`
--
ALTER TABLE `rations_alimentaires`
  ADD PRIMARY KEY (`id`),
  ADD KEY `distribue_par` (`distribue_par`),
  ADD KEY `idx_animal` (`id_animal`),
  ADD KEY `idx_aliment` (`id_aliment`),
  ADD KEY `idx_date` (`date_distribution`);

--
-- Index pour la table `recoltes`
--
ALTER TABLE `recoltes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recolte_par` (`recolte_par`),
  ADD KEY `idx_culture` (`id_culture`),
  ADD KEY `idx_date` (`date_recolte_reelle`),
  ADD KEY `idx_qualite` (`qualite`);

--
-- Index pour la table `revenus_departement`
--
ALTER TABLE `revenus_departement`
  ADD PRIMARY KEY (`id`),
  ADD KEY `enregistre_par` (`enregistre_par`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_date` (`date_revenu`),
  ADD KEY `idx_source` (`source`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `salaires`
--
ALTER TABLE `salaires`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_salaire_user_month` (`id_utilisateur`,`mois`,`annee`),
  ADD KEY `valide_par` (`valide_par`),
  ADD KEY `calcul_par` (`calcul_par`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_periode` (`mois`,`annee`),
  ADD KEY `idx_statut_paiement` (`statut_paiement`),
  ADD KEY `idx_date_paiement` (`date_paiement`),
  ADD KEY `idx_confirme_reception` (`confirme_reception`),
  ADD KEY `idx_demande_paiement` (`demande_paiement_envoyee`);

--
-- Index pour la table `stocks`
--
ALTER TABLE `stocks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_stock_article` (`type_article`,`id_article`,`emplacement`),
  ADD KEY `idx_type_article` (`type_article`,`id_article`),
  ADD KEY `idx_quantite` (`quantite_disponible`),
  ADD KEY `idx_emplacement` (`emplacement`),
  ADD KEY `idx_date_peremption` (`date_peremption`),
  ADD KEY `idx_statut` (`statut`);

--
-- Index pour la table `suivis_sanitaires`
--
ALTER TABLE `suivis_sanitaires`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_technicien` (`id_technicien`),
  ADD KEY `idx_animal` (`id_animal`),
  ADD KEY `idx_date` (`date_intervention`),
  ADD KEY `idx_type` (`type_intervention`);

--
-- Index pour la table `tentatives_connexion`
--
ALTER TABLE `tentatives_connexion`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_ip` (`ip_address`),
  ADD KEY `idx_date` (`date_tentative`);

--
-- Index pour la table `traces`
--
ALTER TABLE `traces`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_utilisateur` (`id_utilisateur`),
  ADD KEY `idx_module` (`module`),
  ADD KEY `idx_type_action` (`type_action`),
  ADD KEY `idx_date_action` (`date_action`),
  ADD KEY `idx_table` (`table_affectee`,`id_enregistrement`);

--
-- Index pour la table `types_cultures`
--
ALTER TABLE `types_cultures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_culture` (`code_culture`),
  ADD KEY `idx_code` (`code_culture`),
  ADD KEY `idx_famille` (`famille`),
  ADD KEY `idx_saison` (`saison_optimale`);
ALTER TABLE `types_cultures` ADD FULLTEXT KEY `idx_nom` (`nom_culture`);

--
-- Index pour la table `utilisateurs`
--
ALTER TABLE `utilisateurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `matricule` (`matricule`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `CNI` (`numero_cni`),
  ADD UNIQUE KEY `numero_cni` (`numero_cni`),
  ADD KEY `cree_par` (`cree_par`),
  ADD KEY `idx_matricule` (`matricule`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_type_employe` (`type_employe`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_date_embauche` (`date_embauche`);
ALTER TABLE `utilisateurs` ADD FULLTEXT KEY `idx_recherche` (`nom_complet`,`email`,`matricule`,`telephone`);

--
-- Index pour la table `validations_doubles`
--
ALTER TABLE `validations_doubles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `validation_token` (`validation_token`),
  ADD KEY `execute_par` (`execute_par`),
  ADD KEY `idx_action_type` (`action_type`),
  ADD KEY `idx_demande_par` (`demande_par`),
  ADD KEY `idx_valide_par` (`valide_par`),
  ADD KEY `idx_decision` (`decision`),
  ADD KEY `idx_date_demande` (`date_demande`),
  ADD KEY `idx_token` (`validation_token`);

--
-- Index pour la table `vehicules`
--
ALTER TABLE `vehicules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `immatriculation` (`immatriculation`),
  ADD KEY `idx_immatriculation` (`immatriculation`),
  ADD KEY `idx_statut` (`statut`),
  ADD KEY `idx_departement` (`id_departement`),
  ADD KEY `idx_chauffeur` (`id_chauffeur_attitre`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `aliments_betail`
--
ALTER TABLE `aliments_betail`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `animaux`
--
ALTER TABLE `animaux`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `applications_intrants`
--
ALTER TABLE `applications_intrants`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `assurances_vehicules`
--
ALTER TABLE `assurances_vehicules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `budgets_departements`
--
ALTER TABLE `budgets_departements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `clients`
--
ALTER TABLE `clients`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `codes_verification_salaire`
--
ALTER TABLE `codes_verification_salaire`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `commandes_achat`
--
ALTER TABLE `commandes_achat`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `commandes_vente`
--
ALTER TABLE `commandes_vente`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `confirmations_reception_salaire`
--
ALTER TABLE `confirmations_reception_salaire`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `conges`
--
ALTER TABLE `conges`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `cultures`
--
ALTER TABLE `cultures`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `demandes_budget`
--
ALTER TABLE `demandes_budget`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `demandes_paiement_salaire`
--
ALTER TABLE `demandes_paiement_salaire`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `departements`
--
ALTER TABLE `departements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `depenses_departement`
--
ALTER TABLE `depenses_departement`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `employes`
--
ALTER TABLE `employes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT pour la table `evaluations_performance`
--
ALTER TABLE `evaluations_performance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `factures`
--
ALTER TABLE `factures`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `fournisseurs`
--
ALTER TABLE `fournisseurs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `frais_vehicules`
--
ALTER TABLE `frais_vehicules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `intrants_agricoles`
--
ALTER TABLE `intrants_agricoles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `journal_comptable`
--
ALTER TABLE `journal_comptable`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `lignes_commande_achat`
--
ALTER TABLE `lignes_commande_achat`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `lignes_commande_vente`
--
ALTER TABLE `lignes_commande_vente`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `maintenances_vehicules`
--
ALTER TABLE `maintenances_vehicules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `mouvements_stock`
--
ALTER TABLE `mouvements_stock`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `mouvements_vehicules`
--
ALTER TABLE `mouvements_vehicules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `paiements`
--
ALTER TABLE `paiements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `parcelles`
--
ALTER TABLE `parcelles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `presences`
--
ALTER TABLE `presences`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `productions_lait`
--
ALTER TABLE `productions_lait`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `productions_oeufs`
--
ALTER TABLE `productions_oeufs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rapports_financiers`
--
ALTER TABLE `rapports_financiers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rations_alimentaires`
--
ALTER TABLE `rations_alimentaires`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `recoltes`
--
ALTER TABLE `recoltes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `revenus_departement`
--
ALTER TABLE `revenus_departement`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `salaires`
--
ALTER TABLE `salaires`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stocks`
--
ALTER TABLE `stocks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `suivis_sanitaires`
--
ALTER TABLE `suivis_sanitaires`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `tentatives_connexion`
--
ALTER TABLE `tentatives_connexion`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100;

--
-- AUTO_INCREMENT pour la table `traces`
--
ALTER TABLE `traces`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT pour la table `types_cultures`
--
ALTER TABLE `types_cultures`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `validations_doubles`
--
ALTER TABLE `validations_doubles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `vehicules`
--
ALTER TABLE `vehicules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `animaux`
--
ALTER TABLE `animaux`
  ADD CONSTRAINT `animaux_ibfk_1` FOREIGN KEY (`id_mere`) REFERENCES `animaux` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `animaux_ibfk_2` FOREIGN KEY (`id_pere`) REFERENCES `animaux` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `applications_intrants`
--
ALTER TABLE `applications_intrants`
  ADD CONSTRAINT `applications_intrants_ibfk_1` FOREIGN KEY (`id_culture`) REFERENCES `cultures` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `applications_intrants_ibfk_2` FOREIGN KEY (`id_intrant`) REFERENCES `intrants_agricoles` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `applications_intrants_ibfk_3` FOREIGN KEY (`id_parcelle`) REFERENCES `parcelles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `applications_intrants_ibfk_4` FOREIGN KEY (`id_applicateur`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `assurances_vehicules`
--
ALTER TABLE `assurances_vehicules`
  ADD CONSTRAINT `assurances_vehicules_ibfk_1` FOREIGN KEY (`id_vehicule`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `budgets_departements`
--
ALTER TABLE `budgets_departements`
  ADD CONSTRAINT `budgets_departements_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `codes_verification_salaire`
--
ALTER TABLE `codes_verification_salaire`
  ADD CONSTRAINT `fk_code_salaire` FOREIGN KEY (`id_salaire`) REFERENCES `salaires` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_code_utilisateur` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `commandes_achat`
--
ALTER TABLE `commandes_achat`
  ADD CONSTRAINT `commandes_achat_ibfk_1` FOREIGN KEY (`id_fournisseur`) REFERENCES `fournisseurs` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `commandes_achat_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `commandes_achat_ibfk_3` FOREIGN KEY (`cree_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `commandes_vente`
--
ALTER TABLE `commandes_vente`
  ADD CONSTRAINT `commandes_vente_ibfk_1` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `commandes_vente_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `commandes_vente_ibfk_3` FOREIGN KEY (`cree_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `confirmations_reception_salaire`
--
ALTER TABLE `confirmations_reception_salaire`
  ADD CONSTRAINT `fk_confirmation_salaire` FOREIGN KEY (`id_salaire`) REFERENCES `salaires` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_confirmation_utilisateur` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `conges`
--
ALTER TABLE `conges`
  ADD CONSTRAINT `conges_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `conges_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `conges_ibfk_3` FOREIGN KEY (`cree_par`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `cultures`
--
ALTER TABLE `cultures`
  ADD CONSTRAINT `cultures_ibfk_1` FOREIGN KEY (`id_parcelle`) REFERENCES `parcelles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cultures_ibfk_2` FOREIGN KEY (`id_type_culture`) REFERENCES `types_cultures` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `demandes_budget`
--
ALTER TABLE `demandes_budget`
  ADD CONSTRAINT `demandes_budget_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `demandes_budget_ibfk_2` FOREIGN KEY (`id_demandeur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `demandes_budget_ibfk_3` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `demandes_paiement_salaire`
--
ALTER TABLE `demandes_paiement_salaire`
  ADD CONSTRAINT `fk_demande_employe` FOREIGN KEY (`id_employe`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_demande_salaire` FOREIGN KEY (`id_salaire`) REFERENCES `salaires` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_demande_traite_par` FOREIGN KEY (`traite_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `depenses_departement`
--
ALTER TABLE `depenses_departement`
  ADD CONSTRAINT `depenses_departement_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `depenses_departement_ibfk_2` FOREIGN KEY (`effectue_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `depenses_departement_ibfk_3` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `devices`
--
ALTER TABLE `devices`
  ADD CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `employes`
--
ALTER TABLE `employes`
  ADD CONSTRAINT `employes_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `employes_ibfk_2` FOREIGN KEY (`cree_par`) REFERENCES `employes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employes_ibfk_3` FOREIGN KEY (`modifie_par`) REFERENCES `employes` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `evaluations_performance`
--
ALTER TABLE `evaluations_performance`
  ADD CONSTRAINT `evaluations_performance_ibfk_1` FOREIGN KEY (`id_employe`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evaluations_performance_ibfk_2` FOREIGN KEY (`id_evaluateur`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `factures`
--
ALTER TABLE `factures`
  ADD CONSTRAINT `factures_ibfk_1` FOREIGN KEY (`id_fournisseur`) REFERENCES `fournisseurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `factures_ibfk_2` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `factures_ibfk_3` FOREIGN KEY (`cree_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `frais_vehicules`
--
ALTER TABLE `frais_vehicules`
  ADD CONSTRAINT `frais_vehicules_ibfk_1` FOREIGN KEY (`id_mouvement`) REFERENCES `mouvements_vehicules` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `frais_vehicules_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `journal_comptable`
--
ALTER TABLE `journal_comptable`
  ADD CONSTRAINT `journal_comptable_ibfk_1` FOREIGN KEY (`effectue_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `journal_comptable_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `journal_comptable_ibfk_3` FOREIGN KEY (`rapproche_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `lignes_commande_achat`
--
ALTER TABLE `lignes_commande_achat`
  ADD CONSTRAINT `lignes_commande_achat_ibfk_1` FOREIGN KEY (`id_commande_achat`) REFERENCES `commandes_achat` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `lignes_commande_vente`
--
ALTER TABLE `lignes_commande_vente`
  ADD CONSTRAINT `lignes_commande_vente_ibfk_1` FOREIGN KEY (`id_commande_vente`) REFERENCES `commandes_vente` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `maintenances_vehicules`
--
ALTER TABLE `maintenances_vehicules`
  ADD CONSTRAINT `maintenances_vehicules_ibfk_1` FOREIGN KEY (`id_vehicule`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `maintenances_vehicules_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `mouvements_stock`
--
ALTER TABLE `mouvements_stock`
  ADD CONSTRAINT `mouvements_stock_ibfk_1` FOREIGN KEY (`id_stock`) REFERENCES `stocks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mouvements_stock_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `mouvements_stock_ibfk_3` FOREIGN KEY (`effectue_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `mouvements_vehicules`
--
ALTER TABLE `mouvements_vehicules`
  ADD CONSTRAINT `mouvements_vehicules_ibfk_1` FOREIGN KEY (`id_vehicule`) REFERENCES `vehicules` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mouvements_vehicules_ibfk_2` FOREIGN KEY (`id_chauffeur`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `mouvements_vehicules_ibfk_3` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `paiements`
--
ALTER TABLE `paiements`
  ADD CONSTRAINT `paiements_ibfk_1` FOREIGN KEY (`id_facture`) REFERENCES `factures` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `paiements_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `presences`
--
ALTER TABLE `presences`
  ADD CONSTRAINT `presences_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `presences_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `productions_lait`
--
ALTER TABLE `productions_lait`
  ADD CONSTRAINT `productions_lait_ibfk_1` FOREIGN KEY (`id_animal`) REFERENCES `animaux` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `productions_lait_ibfk_2` FOREIGN KEY (`traite_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `productions_oeufs`
--
ALTER TABLE `productions_oeufs`
  ADD CONSTRAINT `productions_oeufs_ibfk_1` FOREIGN KEY (`recolte_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `rapports_financiers`
--
ALTER TABLE `rapports_financiers`
  ADD CONSTRAINT `rapports_financiers_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `rapports_financiers_ibfk_2` FOREIGN KEY (`generate_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `rations_alimentaires`
--
ALTER TABLE `rations_alimentaires`
  ADD CONSTRAINT `rations_alimentaires_ibfk_1` FOREIGN KEY (`id_animal`) REFERENCES `animaux` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `rations_alimentaires_ibfk_2` FOREIGN KEY (`id_aliment`) REFERENCES `aliments_betail` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `rations_alimentaires_ibfk_3` FOREIGN KEY (`distribue_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `recoltes`
--
ALTER TABLE `recoltes`
  ADD CONSTRAINT `recoltes_ibfk_1` FOREIGN KEY (`id_culture`) REFERENCES `cultures` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `recoltes_ibfk_2` FOREIGN KEY (`recolte_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `revenus_departement`
--
ALTER TABLE `revenus_departement`
  ADD CONSTRAINT `revenus_departement_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `revenus_departement_ibfk_2` FOREIGN KEY (`enregistre_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `revenus_departement_ibfk_3` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `salaires`
--
ALTER TABLE `salaires`
  ADD CONSTRAINT `salaires_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `salaires_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salaires_ibfk_3` FOREIGN KEY (`calcul_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT;

--
-- Contraintes pour la table `suivis_sanitaires`
--
ALTER TABLE `suivis_sanitaires`
  ADD CONSTRAINT `suivis_sanitaires_ibfk_1` FOREIGN KEY (`id_animal`) REFERENCES `animaux` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `suivis_sanitaires_ibfk_2` FOREIGN KEY (`id_technicien`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `traces`
--
ALTER TABLE `traces`
  ADD CONSTRAINT `traces_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `utilisateurs`
--
ALTER TABLE `utilisateurs`
  ADD CONSTRAINT `fk_utilisateur_employe` FOREIGN KEY (`id`) REFERENCES `employes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `utilisateurs_ibfk_1` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `utilisateurs_ibfk_2` FOREIGN KEY (`cree_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `validations_doubles`
--
ALTER TABLE `validations_doubles`
  ADD CONSTRAINT `validations_doubles_ibfk_1` FOREIGN KEY (`demande_par`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `validations_doubles_ibfk_2` FOREIGN KEY (`valide_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `validations_doubles_ibfk_3` FOREIGN KEY (`execute_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `vehicules`
--
ALTER TABLE `vehicules`
  ADD CONSTRAINT `vehicules_ibfk_1` FOREIGN KEY (`id_chauffeur_attitre`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `vehicules_ibfk_2` FOREIGN KEY (`id_departement`) REFERENCES `departements` (`id`) ON DELETE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
