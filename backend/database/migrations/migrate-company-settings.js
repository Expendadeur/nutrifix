// Script de migration pour créer la table parametres_entreprise
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'nutrifix_db'
    });

    try {
        console.log('🔄 Création de la table parametres_entreprise...');

        await connection.execute(`
      CREATE TABLE IF NOT EXISTS parametres_entreprise (
        id int NOT NULL AUTO_INCREMENT,
        nom_entreprise varchar(150) NOT NULL DEFAULT 'NUTRIFIX',
        nif varchar(50) DEFAULT NULL COMMENT 'Numéro d''Identification Fiscale',
        numero_rc varchar(100) DEFAULT NULL COMMENT 'Numéro Registre de Commerce',
        boite_postale varchar(50) DEFAULT NULL,
        telephone varchar(50) DEFAULT NULL,
        email varchar(100) DEFAULT NULL,
        commune varchar(100) DEFAULT NULL,
        quartier varchar(100) DEFAULT NULL,
        avenue varchar(100) DEFAULT NULL,
        rue varchar(100) DEFAULT NULL,
        numero_batiment varchar(20) DEFAULT NULL,
        assujetti_tva tinyint(1) DEFAULT 1 COMMENT '1 = Oui, 0 = Non',
        taux_tva_defaut decimal(5,2) DEFAULT 18.00,
        centre_fiscal varchar(100) DEFAULT NULL,
        secteur_activite varchar(150) DEFAULT NULL,
        logo varchar(255) DEFAULT NULL,
        date_creation timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        date_modification timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        console.log('✅ Table créée avec succès');

        // Vérifier si des données existent déjà
        const [rows] = await connection.execute('SELECT COUNT(*) as count FROM parametres_entreprise');

        if (rows[0].count === 0) {
            console.log('🔄 Insertion des données initiales...');

            await connection.execute(`
        INSERT INTO parametres_entreprise (
          nom_entreprise, nif, numero_rc, boite_postale, telephone, email,
          commune, quartier, avenue, rue, numero_batiment,
          assujetti_tva, taux_tva_defaut, centre_fiscal, secteur_activite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
            ]);

            console.log('✅ Données initiales insérées');
        } else {
            console.log('ℹ️  Données déjà présentes, insertion ignorée');
        }

        console.log('🎉 Migration terminée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

migrate().catch(console.error);
