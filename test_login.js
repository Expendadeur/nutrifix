// Script de test de connexion pour tous les utilisateurs
// Usage: node test_login.js

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5000/api/auth/login';
const DEFAULT_PASSWORD = 'NutriSoft2026!';

// Liste des comptes à tester
const ACCOUNTS = [
    { email: 'admin@nutrisoft.bi', role: 'admin', type: 'INSS' },
    { email: 'manager.finance@nutrisoft.bi', role: 'manager', type: 'INSS' },
    { email: 'comptable@nutrisoft.bi', role: 'comptable', type: 'INSS' },
    { email: 'manager.rh@nutrisoft.bi', role: 'manager', type: 'INSS' },
    { email: 'veterinaire@nutrisoft.bi', role: 'veterinaire', type: 'INSS' },
    { email: 'chauffeur1@nutrisoft.bi', role: 'chauffeur', type: 'INSS' },
    { email: 'agriculteur1@nutrisoft.bi', role: 'agriculteur', type: 'INSS' },
    { email: 'technicien1@nutrisoft.bi', role: 'technicien', type: 'INSS' },
    { email: 'employe1@nutrisoft.bi', role: 'employe', type: 'INSS' },
    { email: 'partiel1@nutrisoft.bi', role: 'employe', type: 'temps_partiel' },
    { email: 'partiel2@nutrisoft.bi', role: 'employe', type: 'temps_partiel' },
    { email: 'contractuel1@nutrisoft.bi', role: 'employe', type: 'contractuel' }
];

// Fonction de test de connexion
async function testLogin(email, password) {
    try {
        const response = await axios.post(API_URL, {
            email,
            password
        });

        if (response.data.success) {
            return {
                success: true,
                user: response.data.user,
                token: response.data.token.substring(0, 50) + '...'
            };
        } else {
            return {
                success: false,
                message: response.data.message
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

// Fonction principale de test
async function runTests() {
    console.log('\n==============================================');
    console.log('TEST DE CONNEXION - NUTRISOFT ERP');
    console.log('==============================================\n');
    console.log('URL API:', API_URL);
    console.log('Mot de passe testé:', DEFAULT_PASSWORD);
    console.log('Nombre de comptes:', ACCOUNTS.length);
    console.log('\n==============================================\n');

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const account of ACCOUNTS) {
        process.stdout.write(`Test ${account.email}... `);
        
        const result = await testLogin(account.email, DEFAULT_PASSWORD);
        
        if (result.success) {
            successCount++;
            console.log('✓ SUCCÈS');
            results.push({
                email: account.email,
                status: 'SUCCESS',
                role: result.user.role,
                type: result.user.type_employe,
                matricule: result.user.matricule,
                nom: result.user.nom_complet
            });
        } else {
            failCount++;
            console.log('✗ ÉCHEC');
            results.push({
                email: account.email,
                status: 'FAILED',
                error: result.error || result.message
            });
        }
        
        // Petit délai entre les requêtes
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Afficher le résumé
    console.log('\n==============================================');
    console.log('RÉSUMÉ DES TESTS');
    console.log('==============================================\n');
    console.log(`Total: ${ACCOUNTS.length}`);
    console.log(`Succès: ${successCount} ✓`);
    console.log(`Échecs: ${failCount} ✗`);
    console.log(`Taux de réussite: ${((successCount/ACCOUNTS.length)*100).toFixed(1)}%`);

    // Détails des succès
    if (successCount > 0) {
        console.log('\n==============================================');
        console.log('CONNEXIONS RÉUSSIES');
        console.log('==============================================\n');
        
        const successful = results.filter(r => r.status === 'SUCCESS');
        successful.forEach(r => {
            console.log(`✓ ${r.email}`);
            console.log(`  Matricule: ${r.matricule}`);
            console.log(`  Nom: ${r.nom}`);
            console.log(`  Rôle: ${r.role}`);
            console.log(`  Type: ${r.type}\n`);
        });
    }

    // Détails des échecs
    if (failCount > 0) {
        console.log('\n==============================================');
        console.log('CONNEXIONS ÉCHOUÉES');
        console.log('==============================================\n');
        
        const failed = results.filter(r => r.status === 'FAILED');
        failed.forEach(r => {
            console.log(`✗ ${r.email}`);
            console.log(`  Erreur: ${r.error}\n`);
        });
    }

    // Test d'authentification avec mauvais mot de passe
    console.log('\n==============================================');
    console.log('TEST AVEC MAUVAIS MOT DE PASSE');
    console.log('==============================================\n');
    
    const badPasswordTest = await testLogin('admin@nutrisoft.bi', 'WrongPassword123!');
    if (!badPasswordTest.success) {
        console.log('✓ Le système rejette correctement les mauvais mots de passe');
        console.log(`  Message: ${badPasswordTest.error}`);
    } else {
        console.log('✗ ERREUR: Le système a accepté un mauvais mot de passe!');
    }

    // Test avec email inexistant
    console.log('\n==============================================');
    console.log('TEST AVEC EMAIL INEXISTANT');
    console.log('==============================================\n');
    
    const nonExistentTest = await testLogin('inexistant@nutrisoft.bi', DEFAULT_PASSWORD);
    if (!nonExistentTest.success) {
        console.log('✓ Le système rejette correctement les emails inexistants');
        console.log(`  Message: ${nonExistentTest.error}`);
    } else {
        console.log('✗ ERREUR: Le système a accepté un email inexistant!');
    }

    console.log('\n==============================================');
    console.log('FIN DES TESTS');
    console.log('==============================================\n');
}

// Exécuter les tests
runTests().catch(error => {
    console.error('\n✗ Erreur fatale:', error.message);
    console.error('\nAssurez-vous que:');
    console.error('1. Le serveur backend est démarré (npm run dev)');
    console.error('2. La base de données est accessible');
    console.error('3. Les employés ont été créés avec init_employes.sql\n');
    process.exit(1);
});
