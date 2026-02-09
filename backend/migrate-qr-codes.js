// backend/scripts/migrate-qr-codes.js
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '00000000',  // ✅ Mot de passe ajouté
  database: process.env.DB_NAME || 'nutrifix_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function migrateQRCodes() {
  let connection;
  
  try {
    console.log('🔄 Connexion à la base de données...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connecté à la base de données');
    
    // Récupérer tous les employés
    const [employes] = await connection.query(
      'SELECT id, matricule, nom_complet, type_employe FROM employes WHERE statut = "actif"'
    );
    
    console.log(`📊 ${employes.length} employés trouvés`);  // ✅ Correction syntaxe
    
    let updated = 0;
    let errors = 0;
    
    for (const employe of employes) {
      try {
        console.log(`\n🔄 Traitement: ${employe.nom_complet} (ID: ${employe.id})`);  // ✅ Correction syntaxe
        
        // Créer le payload pour le QR code
        const payload = JSON.stringify({
          id: employe.id,
          matricule: employe.matricule,
          nom: employe.nom_complet,
          type: employe.type_employe || 'INSS',
          timestamp: Date.now()
        });
        
        // Générer le QR code comme Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#1E3A8A',
            light: '#FFFFFF'
          }
        });
        
        // Mettre à jour dans la base de données
        await connection.query(
          'UPDATE employes SET qr_code = ? WHERE id = ?',
          [qrCodeDataUrl, employe.id]
        );
        
        console.log(`✅ QR Code généré et sauvegardé (${qrCodeDataUrl.length} caractères)`);  // ✅ Correction syntaxe
        updated++;
        
      } catch (error) {
        console.error(`❌ Erreur pour ${employe.nom_complet}:`, error.message);  // ✅ Correction syntaxe
        errors++;
      }
    }
    
    console.log('\n========================================');
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('========================================');
    console.log(`✅ QR Codes générés: ${updated}`);  // ✅ Correction syntaxe
    console.log(`❌ Erreurs: ${errors}`);  // ✅ Correction syntaxe
    console.log(`📊 Total: ${employes.length}`);  // ✅ Correction syntaxe
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connexion fermée');
    }
  }
}

// Exécuter la migration
migrateQRCodes();