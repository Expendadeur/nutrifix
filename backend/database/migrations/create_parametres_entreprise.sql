-- ============================================
-- Table: parametres_entreprise
-- Description: Stocke les informations de l'entreprise pour les factures OBR et autres documents
-- ============================================

CREATE TABLE IF NOT EXISTS `parametres_entreprise` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom_entreprise` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NUTRIFIX',
  `nif` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Numéro d''Identification Fiscale',
  `numero_rc` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Numéro Registre de Commerce',
  `boite_postale` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telephone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `commune` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quartier` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avenue` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rue` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_batiment` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assujetti_tva` tinyint(1) DEFAULT 1 COMMENT '1 = Oui, 0 = Non',
  `taux_tva_defaut` decimal(5,2) DEFAULT 18.00,
  `centre_fiscal` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `secteur_activite` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `date_modification` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paramètres de l''entreprise pour factures OBR';

-- ============================================
-- Données initiales
-- ============================================

INSERT INTO `parametres_entreprise` (
  `nom_entreprise`, `nif`, `numero_rc`, `boite_postale`, `telephone`, `email`,
  `commune`, `quartier`, `avenue`, `rue`, `numero_batiment`,
  `assujetti_tva`, `taux_tva_defaut`, `centre_fiscal`, `secteur_activite`
) VALUES (
  'NUTRIFIX',
  '4001234567',
  'RC/ Bujumbura / 1234',
  '1234 Bujumbura',
  '+257 22 22 22 22',
  'contact@nutrifix.bi',
  'Mukaza',
  'Rohero I',
  'de la France',
  'n/a',
  '10',
  1,
  18.00,
  'DMC',
  'Commerce'
);
