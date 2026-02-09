// backend/test-email-system.js
// Script de test pour le système d'emails

require('dotenv').config();
const emailService = require('./api/emailService');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testConfiguration() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 1: Vérification de la configuration');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '🔍 Vérification des variables d\'environnement...');
    
    if (!process.env.EMAIL_USER) {
      log(colors.red, '❌ EMAIL_USER n\'est pas défini dans .env');
      return false;
    }
    log(colors.green, `✅ EMAIL_USER: ${process.env.EMAIL_USER}`);
    
    if (!process.env.EMAIL_APP_PASSWORD) {
      log(colors.red, '❌ EMAIL_APP_PASSWORD n\'est pas défini dans .env');
      return false;
    }
    log(colors.green, `✅ EMAIL_APP_PASSWORD: ${'*'.repeat(16)}`);
    
    log(colors.blue, '\n🔍 Test de connexion au serveur SMTP...');
    const isValid = await emailService.verifierConfiguration();
    
    if (isValid) {
      log(colors.green, '✅ Connexion SMTP réussie!\n');
      return true;
    } else {
      log(colors.red, '❌ Échec de la connexion SMTP\n');
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testCodeVerification() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 2: Email de Code de Vérification');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'un email de code de vérification...');
    
    const result = await emailService.envoyerCodeVerification(
      process.env.EMAIL_USER, // Envoyer à soi-même pour le test
      '123456',
      'Jean Dupont (Test)',
      1, // Janvier
      2026
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}`);
      log(colors.yellow, '   ⚠️ Vérifiez votre boîte de réception\n');
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testNotificationConge() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 3: Notification de Demande de Congé');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'une notification de congé...');
    
    const result = await emailService.envoyerNotificationConge(
      process.env.EMAIL_USER,
      'Jean Dupont (Test)',
      'annuel',
      '2026-02-15',
      '2026-02-20',
      5
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}\n`);
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testConfirmationDemandeConge() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 4: Confirmation de Demande de Congé');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'une confirmation de demande...');
    
    const result = await emailService.envoyerConfirmationDemandeConge(
      process.env.EMAIL_USER,
      'Jean Dupont (Test)',
      'annuel',
      '2026-02-15',
      '2026-02-20',
      5
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}\n`);
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testNotificationDemandePaiement() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 5: Notification Demande de Paiement');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'une notification de demande de paiement...');
    
    const result = await emailService.envoyerNotificationDemandePaiement(
      process.env.EMAIL_USER,
      'Manager Test',
      'Jean Dupont (Test)',
      1, // Janvier
      2026,
      500000
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}\n`);
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testNotificationSalairePaye() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 6: Notification Salaire Payé');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'une notification de salaire payé...');
    
    const result = await emailService.envoyerNotificationSalairePaye(
      process.env.EMAIL_USER,
      'Jean Dupont (Test)',
      500000,
      1, // Janvier
      2026
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}\n`);
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function testNotificationConfirmationReception() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📧 TEST 7: Notification Confirmation Réception');
  log(colors.cyan, '========================================\n');
  
  try {
    log(colors.blue, '📤 Envoi d\'une notification de confirmation...');
    
    const result = await emailService.envoyerNotificationConfirmationReception(
      process.env.EMAIL_USER,
      'Manager Test',
      'Jean Dupont (Test)',
      1, // Janvier
      2026,
      500000
    );
    
    if (result.success) {
      log(colors.green, `✅ Email envoyé avec succès!`);
      log(colors.green, `   MessageId: ${result.messageId}\n`);
      return true;
    } else {
      log(colors.red, `❌ Échec de l\'envoi: ${result.error}\n`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Erreur: ${error.message}\n`);
    return false;
  }
}

async function runAllTests() {
  log(colors.blue, '\n╔════════════════════════════════════════╗');
  log(colors.blue, '║   TEST DU SYSTÈME D\'EMAILS NUTRIFIX   ║');
  log(colors.blue, '╚════════════════════════════════════════╝\n');
  
  const results = {
    configuration: false,
    codeVerification: false,
    notificationConge: false,
    confirmationConge: false,
    demandePaiement: false,
    salairePaye: false,
    confirmationReception: false
  };
  
  // Test 1: Configuration
  results.configuration = await testConfiguration();
  
  if (!results.configuration) {
    log(colors.red, '\n❌ La configuration a échoué. Impossible de continuer les tests.\n');
    log(colors.yellow, '💡 Vérifiez votre fichier .env et les variables EMAIL_USER et EMAIL_APP_PASSWORD\n');
    return;
  }
  
  // Demander confirmation pour continuer
  log(colors.yellow, '⚠️  Les tests suivants vont envoyer des emails réels.\n');
  log(colors.yellow, `   Destinataire: ${process.env.EMAIL_USER}\n`);
  
  // Attendre 2 secondes avant de continuer
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Tests d'envoi d'emails
  results.codeVerification = await testCodeVerification();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Délai entre les emails
  
  results.notificationConge = await testNotificationConge();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.confirmationConge = await testConfirmationDemandeConge();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.demandePaiement = await testNotificationDemandePaiement();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.salairePaye = await testNotificationSalairePaye();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.confirmationReception = await testNotificationConfirmationReception();
  
  // Résumé des résultats
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '📊 RÉSUMÉ DES TESTS');
  log(colors.cyan, '========================================\n');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;
  const failed = total - passed;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    const color = result ? colors.green : colors.red;
    log(color, `${icon} ${test}: ${result ? 'RÉUSSI' : 'ÉCHOUÉ'}`);
  });
  
  log(colors.cyan, '\n========================================');
  log(colors.blue, `Total: ${total} tests`);
  log(colors.green, `✅ Réussis: ${passed}`);
  log(colors.red, `❌ Échoués: ${failed}`);
  log(colors.cyan, '========================================\n');
  
  if (passed === total) {
    log(colors.green, '🎉 TOUS LES TESTS SONT RÉUSSIS!\n');
    log(colors.yellow, '📧 Vérifiez votre boîte email pour voir les emails de test.\n');
  } else {
    log(colors.red, '⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n');
    log(colors.yellow, '💡 Consultez les logs ci-dessus pour plus de détails.\n');
  }
}

// Exécuter les tests
runAllTests().catch(error => {
  log(colors.red, `\n❌ Erreur fatale: ${error.message}\n`);
  process.exit(1);
});