-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : sam. 07 fév. 2026 à 22:25
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
(4, 'Agriculture', 1, 'agriculture', 150000000.00, NULL, 'actif', '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
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
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `employes`
--

INSERT INTO `employes` (`id`, `matricule`, `email`, `mot_de_passe_hash`, `nom_complet`, `telephone`, `type_employe`, `role`, `id_departement`, `date_embauche`, `salaire_base`, `statut`, `date_naissance`, `adresse`, `ville`, `pays`, `numero_cnss`, `jours_conges_annuels`, `compte_bancaire`, `nom_banque`, `qr_code`, `donnees_biometriques`, `photo_identite`, `derniere_connexion`, `nombre_connexions`, `doit_changer_mdp`, `date_modification_mdp`, `date_depart`, `raison_depart`, `cree_par`, `modifie_par`, `date_creation`, `date_modification`) VALUES
(1, 'ADM001', 'admin@nutrisoft.bi', '$2b$10$Yd6vOKcxPOLlLaXB9RbNP.9vSrFWhiah.mIHsxfW8CRkDVhN27V0a', 'NIYONGABO Jean Claude', '+257 79 123 456', 'INSS', 'admin', 1, '2024-01-01', 2500000.00, 'actif', '1985-03-15', 'Avenue de la Burundi, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-001', 30, 'BDI-001-123456789', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NIYONGABO Jean Claude\", \"role\": \"admin\", \"type\": \"INSS\", \"matricule\": \"ADM001\", \"timestamp\": 1770011069, \"departement\": 1}', NULL, NULL, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(2, 'MGR001', 'manager.finance@nutrisoft.bi', '$2b$10$M.6VX5opOP8btsZJ6lv3Len7eFRjf3RVqaNwa7cVr9YmDUWQBPvy6', 'NDAYISENGA Marie Claire', '+257 79 234 567', 'INSS', 'manager', 2, '2024-01-15', 1800000.00, 'actif', '1988-07-22', 'Avenue du Lac, Q. Kinindo', 'Bujumbura', 'Burundi', 'CNSS-2024-002', 25, 'BDI-002-234567890', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NDAYISENGA Marie Claire\", \"role\": \"manager\", \"type\": \"INSS\", \"matricule\": \"MGR001\", \"timestamp\": 1770011069, \"departement\": 2}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(3, 'CPT001', 'comptable@nutrisoft.bi', '$2b$10$bYlpftpwNBKDOVZqgf9CwO9mrhv1puirKirCovBn.eYXU9osULD3m', 'HAKIZIMANA Patrick', '+257 79 345 678', 'INSS', 'comptable', 2, '2024-02-01', 1200000.00, 'actif', '1990-11-10', 'Boulevard de lUPRONA, Q. Mutanga Nord', 'Bujumbura', 'Burundi', 'CNSS-2024-003', 22, 'BDI-003-345678901', 'Interbank Burundi', '{\"nom\": \"HAKIZIMANA Patrick\", \"role\": \"comptable\", \"type\": \"INSS\", \"matricule\": \"CPT001\", \"timestamp\": 1770011069, \"departement\": 2}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(4, 'MGR002', 'manager.rh@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'UWIMANA Esp├®rance', '+257 79 456 789', 'INSS', 'manager', 3, '2024-01-20', 1700000.00, 'actif', '1987-05-18', 'Avenue de lAmiti├®, Q. Ngagara', 'Bujumbura', 'Burundi', 'CNSS-2024-004', 25, 'BDI-004-456789012', 'BCB - Banque de credit du Burundi', '{\"nom\": \"UWIMANA Esp├®rance\", \"role\": \"manager\", \"type\": \"INSS\", \"matricule\": \"MGR002\", \"timestamp\": 1770011069, \"departement\": 3}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(5, 'VET001', 'veterinaire@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'Dr. NKURUNZIZA Emmanuel', '+257 79 567 890', 'INSS', 'veterinaire', 5, '2024-02-15', 1500000.00, 'actif', '1986-09-25', 'Chauss├®e de Prince Luis Gwagasore, Q. Buyenzi', 'Bujumbura', 'Burundi', 'CNSS-2024-005', 22, 'BDI-005-567890123', 'Banque de Gestion et de Financement', '{\"nom\": \"Dr. NKURUNZIZA Emmanuel\", \"role\": \"veterinaire\", \"type\": \"INSS\", \"matricule\": \"VET001\", \"timestamp\": 1770011069, \"departement\": 5}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(6, 'CHF001', 'chauffeur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'BIGIRIMANA L├®onard', '+257 79 678 901', 'INSS', 'chauffeur', 6, '2024-03-01', 800000.00, 'actif', '1992-12-08', 'Avenue de la Victoire, Q. Kamenge', 'Bujumbura', 'Burundi', 'CNSS-2024-006', 20, 'BDI-006-678901234', 'Ecobank Burundi', '{\"nom\": \"BIGIRIMANA L├®onard\", \"role\": \"chauffeur\", \"type\": \"INSS\", \"matricule\": \"CHF001\", \"timestamp\": 1770011069, \"departement\": 6}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(7, 'AGR001', 'agriculteur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NDIKUMANA Josu├®', '+257 79 789 012', 'INSS', 'agriculteur', 4, '2024-03-15', 750000.00, 'actif', '1994-04-12', 'Quartier Kanyosha', 'Bujumbura', 'Burundi', 'CNSS-2024-007', 20, 'BDI-007-789012345', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NDIKUMANA Josu├®\", \"role\": \"agriculteur\", \"type\": \"INSS\", \"matricule\": \"AGR001\", \"timestamp\": 1770011069, \"departement\": 4}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(8, 'TEC001', 'technicien1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NSHIMIRIMANA David', '+257 79 890 123', 'INSS', 'technicien', 8, '2024-04-01', 950000.00, 'actif', '1991-08-20', 'Avenue de la Paix, Q. Bwiza', 'Bujumbura', 'Burundi', 'CNSS-2024-008', 20, 'BDI-008-890123456', 'Interbank Burundi', '{\"nom\": \"NSHIMIRIMANA David\", \"role\": \"technicien\", \"type\": \"INSS\", \"matricule\": \"TEC001\", \"timestamp\": 1770011069, \"departement\": 8}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(9, 'EMP001', 'employe1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NAHIMANA Didier', '+257 79 901 234', 'INSS', 'employe', 7, '2024-04-15', 650000.00, 'actif', '1995-06-30', 'Chauss├®e Prince Louis Rwagasore, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-009', 20, 'BDI-009-901234567', 'BCB - Banque Commerciale du Burundi', '{\"nom\": \"NAHIMANA Didier\", \"role\": \"employe\", \"type\": \"INSS\", \"matricule\": \"EMP001\", \"timestamp\": 1770011069, \"departement\": 7}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(10, 'TPT001', 'partiel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'IRAKOZE Aim├®e', '+257 79 012 345', 'temps_partiel', 'employe', 9, '2024-05-01', 400000.00, 'actif', '1997-02-14', 'Avenue de lIndustrie, Q. Ngagara', 'Bujumbura', 'Burundi', NULL, 12, NULL, NULL, '{\"nom\": \"IRAKOZE Aim├®e\", \"role\": \"employe\", \"type\": \"temps_partiel\", \"matricule\": \"TPT001\", \"timestamp\": 1770011069, \"departement\": 9}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(11, 'TPT002', 'partiel2@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'BIZIMANA Clarisse', '+257 79 123 456', 'temps_partiel', 'employe', 4, '2024-05-15', 350000.00, 'actif', '1998-10-05', 'Quartier Mutanga Sud', 'Bujumbura', 'Burundi', NULL, 12, NULL, NULL, '{\"nom\": \"BIZIMANA Clarisse\", \"role\": \"employe\", \"type\": \"temps_partiel\", \"matricule\": \"TPT002\", \"timestamp\": 1770011069, \"departement\": 4}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29'),
(12, 'CTR001', 'contractuel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'NIYONZIMA Freddy', '+257 79 234 567', 'contractuel', 'employe', 5, '2024-06-01', 550000.00, 'actif', '1996-03-22', 'Avenue de la Libert├®, Q. Buyenzi', 'Bujumbura', 'Burundi', NULL, 15, NULL, NULL, '{\"nom\": \"NIYONZIMA Freddy\", \"role\": \"employe\", \"type\": \"contractuel\", \"matricule\": \"CTR001\", \"timestamp\": 1770011069, \"departement\": 5}', NULL, NULL, NULL, 0, 1, NULL, NULL, NULL, 1, NULL, '2026-02-02 05:44:29', '2026-02-02 05:44:29');

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
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
(58, 'admin@nutrisoft.bi', 1, 'SUCCESS', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-07 23:02:44');

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
(12, 1, 'rh', 'CREATION_EMPLOYE', 'Cr├®ation Contractuel - NIYONZIMA Freddy', 'employes', 12, '127.0.0.1', NULL, 'info', NULL, NULL, NULL, '2026-02-02 05:44:29');

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
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `utilisateurs`
--

INSERT INTO `utilisateurs` (`id`, `matricule`, `email`, `mot_de_passe_hash`, `nom_complet`, `telephone`, `type_employe`, `role`, `id_departement`, `date_embauche`, `date_naissance`, `adresse`, `ville`, `pays`, `numero_cnss`, `salaire_base`, `jours_conges_annuels`, `compte_bancaire`, `nom_banque`, `qr_code`, `donnees_biometriques`, `photo_identite`, `derniere_connexion`, `nombre_connexions`, `doit_changer_mdp`, `date_modification_mdp`, `statut`, `date_depart`, `raison_depart`, `cree_par`, `date_creation`, `modifie_par`, `date_modification`) VALUES
(1, 'ADM001', 'admin@nutrisoft.bi', '$2b$10$Yd6vOKcxPOLlLaXB9RbNP.9vSrFWhiah.mIHsxfW8CRkDVhN27V0a', 'NIYONGABO Jean Claude', '+257 79 123 456', 'INSS', 'admin', 1, '2024-01-01', '1985-03-15', 'Avenue de la Burundi, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-001', 2500000.00, 30, 'BDI-001-123456789', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NIYONGABO Jean Claude\", \"role\": \"admin\", \"type\": \"INSS\", \"matricule\": \"ADM001\", \"timestamp\": 1770011069, \"departement\": 1}', NULL, NULL, '2026-02-07 23:02:44', 26, 0, NULL, 'actif', NULL, NULL, NULL, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(2, 'MGR001', 'manager.finance@nutrisoft.bi', '$2b$10$M.6VX5opOP8btsZJ6lv3Len7eFRjf3RVqaNwa7cVr9YmDUWQBPvy6', 'NDAYISENGA Marie Claire', '+257 79 234 567', 'INSS', 'manager', 2, '2024-01-15', '1988-07-22', 'Avenue du Lac, Q. Kinindo', 'Bujumbura', 'Burundi', 'CNSS-2024-002', 1800000.00, 25, 'BDI-002-234567890', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NDAYISENGA Marie Claire\", \"role\": \"manager\", \"type\": \"INSS\", \"matricule\": \"MGR001\", \"timestamp\": 1770011069, \"departement\": 2}', NULL, NULL, '2026-02-05 17:34:32', 4, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(3, 'CPT001', 'comptable@nutrisoft.bi', '$2b$10$bYlpftpwNBKDOVZqgf9CwO9mrhv1puirKirCovBn.eYXU9osULD3m', 'HAKIZIMANA Patrick', '+257 79 345 678', 'INSS', 'comptable', 2, '2024-02-01', '1990-11-10', 'Boulevard de lUPRONA, Q. Mutanga Nord', 'Bujumbura', 'Burundi', 'CNSS-2024-003', 1200000.00, 22, 'BDI-003-345678901', 'Interbank Burundi', '{\"nom\": \"HAKIZIMANA Patrick\", \"role\": \"comptable\", \"type\": \"INSS\", \"matricule\": \"CPT001\", \"timestamp\": 1770011069, \"departement\": 2}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(4, 'MGR002', 'manager.rh@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'UWIMANA Esp├®rance', '+257 79 456 789', 'INSS', 'manager', 3, '2024-01-20', '1987-05-18', 'Avenue de lAmiti├®, Q. Ngagara', 'Bujumbura', 'Burundi', 'CNSS-2024-004', 1700000.00, 25, 'BDI-004-456789012', 'BCB - Banque de credit du Burundi', '{\"nom\": \"UWIMANA Esp├®rance\", \"role\": \"manager\", \"type\": \"INSS\", \"matricule\": \"MGR002\", \"timestamp\": 1770011069, \"departement\": 3}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(5, 'VET001', 'veterinaire@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'Dr. NKURUNZIZA Emmanuel', '+257 79 567 890', 'INSS', 'veterinaire', 5, '2024-02-15', '1986-09-25', 'Chauss├®e de Prince Luis Gwagasore, Q. Buyenzi', 'Bujumbura', 'Burundi', 'CNSS-2024-005', 1500000.00, 22, 'BDI-005-567890123', 'Banque de Gestion et de Financement', '{\"nom\": \"Dr. NKURUNZIZA Emmanuel\", \"role\": \"veterinaire\", \"type\": \"INSS\", \"matricule\": \"VET001\", \"timestamp\": 1770011069, \"departement\": 5}', NULL, NULL, '2026-02-06 20:37:37', 1, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(6, 'CHF001', 'chauffeur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'BIGIRIMANA L├®onard', '+257 79 678 901', 'INSS', 'chauffeur', 6, '2024-03-01', '1992-12-08', 'Avenue de la Victoire, Q. Kamenge', 'Bujumbura', 'Burundi', 'CNSS-2024-006', 800000.00, 20, 'BDI-006-678901234', 'Ecobank Burundi', '{\"nom\": \"BIGIRIMANA L├®onard\", \"role\": \"chauffeur\", \"type\": \"INSS\", \"matricule\": \"CHF001\", \"timestamp\": 1770011069, \"departement\": 6}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(7, 'AGR001', 'agriculteur1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NDIKUMANA Josu├®', '+257 79 789 012', 'INSS', 'agriculteur', 4, '2024-03-15', '1994-04-12', 'Quartier Kanyosha', 'Bujumbura', 'Burundi', 'CNSS-2024-007', 750000.00, 20, 'BDI-007-789012345', 'Banque de Cr├®dit de Bujumbura', '{\"nom\": \"NDIKUMANA Josu├®\", \"role\": \"agriculteur\", \"type\": \"INSS\", \"matricule\": \"AGR001\", \"timestamp\": 1770011069, \"departement\": 4}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(8, 'TEC001', 'technicien1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NSHIMIRIMANA David', '+257 79 890 123', 'INSS', 'technicien', 8, '2024-04-01', '1991-08-20', 'Avenue de la Paix, Q. Bwiza', 'Bujumbura', 'Burundi', 'CNSS-2024-008', 950000.00, 20, 'BDI-008-890123456', 'Interbank Burundi', '{\"nom\": \"NSHIMIRIMANA David\", \"role\": \"technicien\", \"type\": \"INSS\", \"matricule\": \"TEC001\", \"timestamp\": 1770011069, \"departement\": 8}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(9, 'EMP001', 'employe1@nutrisoft.bi', '$2b$10$kn57l90b5eVQKXk8JihTeOCo.bhlhFT3mgNR9ZNdKeU.98ofPoKZW', 'NAHIMANA Didier', '+257 79 901 234', 'INSS', 'employe', 7, '2024-04-15', '1995-06-30', 'Chauss├®e Prince Louis Rwagasore, Q. Rohero', 'Bujumbura', 'Burundi', 'CNSS-2024-009', 650000.00, 20, 'BDI-009-901234567', 'BCB - Banque Commerciale du Burundi', '{\"nom\": \"NAHIMANA Didier\", \"role\": \"employe\", \"type\": \"INSS\", \"matricule\": \"EMP001\", \"timestamp\": 1770011069, \"departement\": 7}', NULL, NULL, '2026-02-07 08:02:02', 2, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(10, 'TPT001', 'partiel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'IRAKOZE Aim├®e', '+257 79 012 345', 'temps_partiel', 'employe_temps_partiel', 9, '2024-05-01', '1997-02-14', 'Avenue de lIndustrie, Q. Ngagara', 'Bujumbura', 'Burundi', NULL, 400000.00, 12, NULL, NULL, '{\"nom\": \"IRAKOZE Aim├®e\", \"role\": \"employe\", \"type\": \"temps_partiel\", \"matricule\": \"TPT001\", \"timestamp\": 1770011069, \"departement\": 9}', NULL, NULL, '2026-02-06 20:00:59', 1, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(11, 'TPT002', 'partiel2@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'BIZIMANA Clarisse', '+257 79 123 456', 'temps_partiel', 'employe', 4, '2024-05-15', '1998-10-05', 'Quartier Mutanga Sud', 'Bujumbura', 'Burundi', NULL, 350000.00, 12, NULL, NULL, '{\"nom\": \"BIZIMANA Clarisse\", \"role\": \"employe\", \"type\": \"temps_partiel\", \"matricule\": \"TPT002\", \"timestamp\": 1770011069, \"departement\": 4}', NULL, NULL, '2026-02-06 19:46:05', 2, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29'),
(12, 'CTR001', 'contractuel1@nutrisoft.bi', '$2b$10$UnmD0I7eKcp8fOFIeQ650OOmmJbDEkhU09FSepwjUlLXDGXMw04m6', 'NIYONZIMA Freddy', '+257 79 234 567', 'contractuel', 'employe', 5, '2024-06-01', '1996-03-22', 'Avenue de la Libert├®, Q. Buyenzi', 'Bujumbura', 'Burundi', NULL, 550000.00, 15, NULL, NULL, '{\"nom\": \"NIYONZIMA Freddy\", \"role\": \"employe\", \"type\": \"contractuel\", \"matricule\": \"CTR001\", \"timestamp\": 1770011069, \"departement\": 5}', NULL, NULL, NULL, 0, 1, NULL, 'actif', NULL, NULL, 1, '2026-02-02 05:44:29', NULL, '2026-02-02 05:44:29');

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
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_applications_intrants`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_applications_intrants` (
`conditions_meteo` varchar(100)
,`cout_application` decimal(10,2)
,`cout_application_calcule` decimal(16,4)
,`date_application` date
,`date_creation` timestamp
,`date_modification` timestamp
,`humidite_sol` decimal(4,2)
,`id` int
,`id_applicateur` int
,`id_culture` int
,`id_intrant` int
,`id_parcelle` int
,`methode_application` enum('pulverisation','epandage','injection','trempage')
,`objectif` text
,`observations` text
,`quantite_utilisee` decimal(8,2)
,`temperature_air` decimal(4,1)
,`unite_utilisee` varchar(20)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_assurances_vehicules`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_assurances_vehicules` (
`compagnie_assurance` varchar(150)
,`date_creation` timestamp
,`date_debut` date
,`date_expiration` date
,`date_modification` timestamp
,`franchise` decimal(10,2)
,`id` int
,`id_vehicule` int
,`jours_restants` int
,`montant_prime` decimal(10,2)
,`notification_envoyee_1` tinyint(1)
,`notification_envoyee_15` tinyint(1)
,`notification_envoyee_30` tinyint(1)
,`notification_envoyee_7` tinyint(1)
,`numero_police` varchar(100)
,`scan_attestation` varchar(255)
,`scan_police` varchar(255)
,`statut` enum('active','expiree','renouvelee','resiliee')
,`type_couverture` enum('tous_risques','tiers','vol_incendie')
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_commandes_achat`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_commandes_achat` (
`conditions_paiement` varchar(100)
,`contact_livreur` varchar(50)
,`cree_par` int
,`date_commande` date
,`date_creation` timestamp
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`date_modification` timestamp
,`date_validation` datetime
,`delai_paiement_jours` int
,`frais_livraison` decimal(10,2)
,`id` int
,`id_fournisseur` int
,`lieu_livraison` varchar(255)
,`livre_par` varchar(100)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','credit')
,`modifie_par` int
,`montant_ht` decimal(12,2)
,`montant_total` decimal(12,2)
,`montant_total_calcule` decimal(24,8)
,`montant_ttc` decimal(12,2)
,`montant_ttc_calcule` decimal(22,8)
,`montant_tva` decimal(12,2)
,`montant_tva_calcule` decimal(21,8)
,`numero_commande` varchar(50)
,`observations_livraison` text
,`remise` decimal(10,2)
,`statut` enum('brouillon','envoyee','confirmee','livree_partielle','livree_complete','facturee','payee','annulee')
,`tva_pourcent` decimal(5,2)
,`valide_par` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_commandes_vente`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_commandes_vente` (
`conditions_paiement` varchar(100)
,`contact_livreur` varchar(50)
,`cree_par` int
,`date_commande` date
,`date_creation` timestamp
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`date_modification` timestamp
,`date_validation` datetime
,`frais_livraison` decimal(10,2)
,`id` int
,`id_client` int
,`lieu_livraison` varchar(255)
,`livre_par` varchar(100)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','credit','mixte')
,`modifie_par` int
,`montant_ht` decimal(12,2)
,`montant_total` decimal(12,2)
,`montant_total_calcule` decimal(24,8)
,`montant_ttc` decimal(12,2)
,`montant_ttc_calcule` decimal(22,8)
,`montant_tva` decimal(12,2)
,`montant_tva_calcule` decimal(21,8)
,`numero_commande` varchar(50)
,`observations_livraison` text
,`remise` decimal(10,2)
,`statut` enum('brouillon','confirmee','en_preparation','livree_partielle','livree_complete','facturee','payee','annulee')
,`tva_pourcent` decimal(5,2)
,`valide_par` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_confirmations_reception_salaire`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_confirmations_reception_salaire` (
`annee` int
,`code_verification_utilise` varchar(10)
,`confirme` tinyint(1)
,`date_confirmation` datetime
,`date_paiement` date
,`departement_nom` varchar(100)
,`employe_email` varchar(100)
,`employe_matricule` varchar(20)
,`employe_nom` varchar(150)
,`id` int
,`id_salaire` int
,`id_utilisateur` int
,`methode_confirmation` enum('code_sms','code_email','biometrique','manuel')
,`mois` int
,`montant` decimal(10,2)
,`statut_salaire` enum('calculé','payé','reporté','annulé')
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_dashboard_alertes`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_dashboard_alertes` (
`date_echeance` date
,`description` varchar(129)
,`jours_restants` bigint
,`priorite` varchar(7)
,`type_alerte` varchar(10)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_demandes_paiement_salaire`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_demandes_paiement_salaire` (
`annee` int
,`commentaire` text
,`date_demande` timestamp
,`date_traitement` datetime
,`departement_nom` varchar(100)
,`employe_email` varchar(100)
,`employe_matricule` varchar(20)
,`employe_nom` varchar(150)
,`id` int
,`id_employe` int
,`id_salaire` int
,`jours_attente` int
,`mois` int
,`montant` decimal(10,2)
,`motif_rejet` text
,`statut` enum('en_attente','approuve','rejete','annule')
,`statut_salaire` enum('calculé','payé','reporté','annulé')
,`traite_par` int
,`traite_par_nom` varchar(150)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_factures`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_factures` (
`chemin_fichier` varchar(255)
,`cree_par` int
,`date_creation` timestamp
,`date_dernier_paiement` date
,`date_derniere_relance` date
,`date_echeance` date
,`date_facture` date
,`date_modification` timestamp
,`id` int
,`id_client` int
,`id_commande` int
,`id_fournisseur` int
,`jours_restants` int
,`mode_reglement` varchar(50)
,`modifie_par` int
,`montant_du` decimal(12,2)
,`montant_du_calcule` decimal(13,2)
,`montant_ht` decimal(12,2)
,`montant_regle` decimal(12,2)
,`montant_ttc` decimal(12,2)
,`montant_tva` decimal(12,2)
,`nombre_relances` int
,`numero_facture` varchar(50)
,`scan_quittance` varchar(255)
,`statut_paiement` enum('impayee','partiellement_payee','payee','en_retard')
,`type_facture` enum('achat','vente','avoir')
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_frais_chauffeur_stats`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_frais_chauffeur_stats` (
`chauffeur_id` int
,`chauffeur_nom` varchar(150)
,`derniere_soumission` date
,`frais_en_attente` bigint
,`frais_valides` bigint
,`immatriculation` varchar(20)
,`matricule` varchar(20)
,`montant_en_attente` decimal(32,2)
,`montant_total_frais` decimal(32,2)
,`montant_valide` decimal(32,2)
,`premiere_soumission` date
,`total_autres` decimal(32,2)
,`total_carburant` decimal(32,2)
,`total_frais` bigint
,`total_parking` decimal(32,2)
,`total_peage` decimal(32,2)
,`total_reparation` decimal(32,2)
,`total_versements` decimal(32,2)
,`vehicule_id` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_frais_vehicules_complet`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_frais_vehicules_complet` (
`categorie_comptable` varchar(7)
,`chauffeur_id` int
,`chauffeur_matricule` varchar(20)
,`chauffeur_nom` varchar(150)
,`chauffeur_tel` varchar(20)
,`date` date
,`date_mission` date
,`date_validation` datetime
,`description` text
,`destination` varchar(255)
,`distance_parcourue` int
,`heure_depart` time
,`heure_retour` time
,`id` int
,`id_mouvement` int
,`immatriculation` varchar(20)
,`marque` varchar(50)
,`modele` varchar(50)
,`montant` decimal(10,2)
,`motif` text
,`piece_justificative` varchar(255)
,`statut_traitement` varchar(10)
,`type_frais` enum('carburant','peage','parking','reparation','autre','versement_journalier')
,`type_vehicule` enum('camion','pickup','voiture','moto','engin')
,`validateur_nom` varchar(150)
,`valide` tinyint(1)
,`valide_par` int
,`vehicule_id` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_lignes_commande_achat`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_lignes_commande_achat` (
`date_creation` timestamp
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`date_modification` timestamp
,`description` text
,`designation` varchar(255)
,`id` int
,`id_article` int
,`id_commande_achat` int
,`montant_ht` decimal(12,2)
,`montant_ht_calcule` decimal(30,10)
,`montant_ttc` decimal(12,2)
,`montant_ttc_calcule` decimal(40,16)
,`montant_tva` decimal(12,2)
,`montant_tva_calcule` decimal(39,16)
,`prix_unitaire_ht` decimal(10,2)
,`qualite_reception` enum('bonne','mauvaise','retournee')
,`quantite_commandee` decimal(10,2)
,`quantite_livree` decimal(10,2)
,`remarques_reception` text
,`remise_pourcent` decimal(5,2)
,`statut_livraison` enum('en_attente','partielle','complete')
,`tva_pourcent` decimal(5,2)
,`type_article` enum('intrant','aliment','vehicule','piece','animal','equipement','autre')
,`unite` varchar(50)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_lignes_commande_vente`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_lignes_commande_vente` (
`date_creation` timestamp
,`date_livraison_prevue` date
,`date_livraison_reelle` date
,`date_modification` timestamp
,`description` text
,`designation` varchar(255)
,`id` int
,`id_commande_vente` int
,`id_produit` int
,`montant_ht` decimal(12,2)
,`montant_ht_calcule` decimal(30,10)
,`montant_ttc` decimal(12,2)
,`montant_ttc_calcule` decimal(40,16)
,`montant_tva` decimal(12,2)
,`montant_tva_calcule` decimal(39,16)
,`prix_unitaire_ht` decimal(10,2)
,`quantite_commandee` decimal(10,2)
,`quantite_facturee` decimal(10,2)
,`quantite_livree` decimal(10,2)
,`remise_pourcent` decimal(5,2)
,`statut_livraison` enum('en_attente','partielle','complete')
,`tva_pourcent` decimal(5,2)
,`type_produit` enum('lait','oeufs','viande','culture','intrant','aliment','equipement','autre')
,`unite` varchar(50)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_paiements`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_paiements` (
`banque` varchar(100)
,`date_creation` timestamp
,`date_modification` timestamp
,`date_paiement` date
,`date_rapprochement` date
,`date_validation` datetime
,`description` text
,`devise` varchar(3)
,`id` int
,`id_commande` int
,`id_facture` int
,`id_source` int
,`justificatif` varchar(255)
,`mode_paiement` enum('especes','cheque','virement','mobile_money','carte','compensation')
,`montant` decimal(12,2)
,`montant_devise` decimal(12,2)
,`montant_devise_calcule` decimal(22,6)
,`numero_cheque` varchar(50)
,`numero_compte` varchar(50)
,`rapproche` tinyint(1)
,`reference_mode` varchar(100)
,`reference_paiement` varchar(50)
,`source_type` enum('client','fournisseur','employe','banque','caisse','autre')
,`statut` enum('en_attente','valide','rejete','annule')
,`taux_change` decimal(10,4)
,`type_paiement` enum('recette','depense')
,`valide_par` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_rapports_financiers`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_rapports_financiers` (
`autres_couts` decimal(15,2)
,`chemin_fichier` varchar(255)
,`chiffre_affaires` decimal(15,2)
,`commentaires` text
,`cout_achats` decimal(15,2)
,`cout_operations` decimal(15,2)
,`cout_personnel` decimal(15,2)
,`cout_production` decimal(15,2)
,`date_debut` date
,`date_fin` date
,`date_generation` timestamp
,`format_export` enum('pdf','excel','csv')
,`generate_par` int
,`id` int
,`id_departement` int
,`marge_brute` decimal(15,2)
,`marge_brute_calcule` decimal(17,2)
,`marge_brute_pourcent` decimal(5,2)
,`marge_brute_pourcent_calcule` decimal(26,6)
,`rentabilite_pourcent` decimal(5,2)
,`rentabilite_pourcent_calcule` decimal(29,6)
,`resultat_net` decimal(15,2)
,`resultat_net_calcule` decimal(20,2)
,`total_couts` decimal(15,2)
,`total_couts_calcule` decimal(19,2)
,`type_periode` enum('jour','semaine','mois','trimestre','annee')
,`type_rapport` enum('commercial','financier','productivite','synthese')
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_rations_alimentaires`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_rations_alimentaires` (
`acceptation` enum('complete','partielle','refusee')
,`cout_distribution` decimal(8,2)
,`cout_distribution_calcule` decimal(16,4)
,`date_creation` timestamp
,`date_distribution` date
,`date_modification` timestamp
,`distribue_par` int
,`heure_distribution` time
,`id` int
,`id_aliment` int
,`id_animal` int
,`observations` text
,`quantite_distribuee` decimal(8,2)
,`reste_non_consomme` decimal(8,2)
,`unite_distribution` varchar(20)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_salaires`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_salaires` (
`annee` int
,`autres_deductions` decimal(10,2)
,`avances` decimal(10,2)
,`calcul_par` int
,`commissions` decimal(10,2)
,`date_calcul` timestamp
,`date_modification` timestamp
,`date_paiement` date
,`date_validation` datetime
,`deduction_impots` decimal(10,2)
,`deduction_inss` decimal(10,2)
,`heures_supp` decimal(6,2)
,`heures_travaillees` decimal(6,2)
,`id` int
,`id_utilisateur` int
,`indemnites` decimal(10,2)
,`mode_paiement` enum('virement','cheque','especes')
,`mois` int
,`primes` decimal(10,2)
,`reference_paiement` varchar(100)
,`salaire_brut` decimal(10,2)
,`salaire_net` decimal(10,2)
,`salaire_net_calcule` decimal(17,4)
,`statut_paiement` enum('calculé','payé','reporté','annulé')
,`taux_heure_supp` decimal(8,2)
,`total_additions` decimal(10,2)
,`total_additions_calcule` decimal(15,4)
,`total_deductions` decimal(10,2)
,`total_deductions_calcule` decimal(13,2)
,`valide_par` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_stocks`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_stocks` (
`cout_unitaire` decimal(10,2)
,`date_creation` timestamp
,`date_entree` date
,`date_modification` timestamp
,`date_peremption` date
,`emplacement` varchar(100)
,`etiquette` varchar(100)
,`id` int
,`id_article` int
,`jours_avant_peremption` int
,`quantite_disponible` decimal(10,2)
,`quantite_reelle` decimal(10,2)
,`quantite_reelle_calcule` decimal(11,2)
,`quantite_reservee` decimal(10,2)
,`seuil_alerte` decimal(10,2)
,`statut` enum('disponible','reserve','epuise','perime','inventorie')
,`type_article` enum('lait','oeufs','viande','culture','intrant','aliment','piece','equipement','autre')
,`unite_mesure` varchar(20)
,`valeur_stock` decimal(12,2)
,`valeur_stock_calcule` decimal(21,4)
,`zone` varchar(50)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_validations_doubles`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_validations_doubles` (
`action_type` varchar(100)
,`commentaire_validation` text
,`data_json` json
,`date_demande` timestamp
,`date_execution` datetime
,`date_expiration` datetime
,`date_expiration_calcule` datetime
,`date_validation` datetime
,`decision` enum('en_attente','approuve','rejete')
,`demande_par` int
,`execute_par` int
,`expire` tinyint(1)
,`expire_calcule` int
,`id` int
,`required_role` enum('admin','manager','comptable','veterinaire')
,`resultat_execution` text
,`validation_token` varchar(64)
,`valide_par` int
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_versements_journaliers`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_versements_journaliers` (
`chauffeur_id` int
,`chauffeur_matricule` varchar(20)
,`chauffeur_nom` varchar(150)
,`cumul_jour_chauffeur` decimal(32,2)
,`cumul_mois_chauffeur` decimal(32,2)
,`date` date
,`date_mission` date
,`date_validation` datetime
,`description` text
,`destination` varchar(255)
,`id` int
,`marque` varchar(50)
,`modele` varchar(50)
,`montant` decimal(10,2)
,`valide` tinyint(1)
,`vehicule_immat` varchar(20)
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
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

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
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

--
-- AUTO_INCREMENT pour la table `traces`
--
ALTER TABLE `traces`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

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
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

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
