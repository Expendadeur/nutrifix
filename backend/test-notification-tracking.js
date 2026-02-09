// backend/test-notification-tracking.js

require('dotenv').config();
const emailService = require('./api/emailService');
const db = require('./database/db');

// Email de test
const EMPLOYE_EMAIL = "kmugishawimana@gmail.com";

// =============================
// 1. Envoyer notification congé rejeté
// =============================
async function testEnvoyerCongeRejete() {
  console.log("\n📧 Envoi notification congé rejeté...");

  const result = await emailService.envoyerNotificationCongeRejete(
    EMPLOYE_EMAIL,
    "MUGISHAWIMANA Kelly",
    "annuel",
    "2026-02-15",
    "2026-02-20",
    "Motif test : période critique"
  );

  console.log("Résultat:", result);
  return result;
}


// =============================
// 4. Test complet
// =============================
async function runTest() {
  console.log("\n====================================");
  console.log(" TEST NOTIFICATION EMPLOYÉ ");
  console.log("====================================\n");

  await testEnvoyerCongeRejete();
  await new Promise(r => setTimeout(r, 2000));


  console.log("\n✅ Test terminé\n");
  process.exit();
}

runTest().catch(err => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
