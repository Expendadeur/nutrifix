// Script de génération de hash bcrypt pour les mots de passe
// Usage: node generate_password_hash.js

const bcrypt = require('bcryptjs');

// Mot de passe par défaut
const DEFAULT_PASSWORD = 'NutriSoft2026!';

// Générer le hash avec 10 rounds (production standard)
async function generateHash() {
    try {
        console.log('\n==============================================');
        console.log('GÉNÉRATION DE HASH BCRYPT');
        console.log('==============================================\n');
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
        
        console.log('Mot de passe:', DEFAULT_PASSWORD);
        console.log('Salt rounds: 10');
        console.log('\nHash généré:');
        console.log(hash);
        
        // Vérifier que le hash fonctionne
        const isValid = await bcrypt.compare(DEFAULT_PASSWORD, hash);
        console.log('\nVérification du hash:', isValid ? '✓ VALIDE' : '✗ INVALIDE');
        
        // Générer plusieurs exemples avec des mots de passe différents
        console.log('\n\n==============================================');
        console.log('AUTRES EXEMPLES DE HASH');
        console.log('==============================================\n');
        
        const passwords = [
            'Admin@2026',
            'Manager@2026',
            'Comptable@2026',
            'EmployeINSS@2026',
            'Employe@2026'
        ];
        
        for (const pwd of passwords) {
            const h = await bcrypt.hash(pwd, 10);
            console.log(`Mot de passe: ${pwd}`);
            console.log(`Hash: ${h}\n`);
        }
        
        console.log('\n==============================================');
        console.log('MISE À JOUR SQL');
        console.log('==============================================\n');
        
        console.log('Pour mettre à jour le script SQL, remplacez:');
        console.log(`'$2b$10$YpNn5qHJPGvVQqXZ5xK0xO7vK0Y8N0XGJVzJ9QH3jKLmN5xZqXZ5q'`);
        console.log('par:');
        console.log(`'${hash}'`);
        
    } catch (error) {
        console.error('Erreur:', error.message);
    }
}

// Fonction pour vérifier un hash existant
async function verifyHash(password, hash) {
    try {
        const isValid = await bcrypt.compare(password, hash);
        console.log('\nVérification:');
        console.log('Mot de passe:', password);
        console.log('Hash:', hash);
        console.log('Résultat:', isValid ? '✓ VALIDE' : '✗ INVALIDE');
        return isValid;
    } catch (error) {
        console.error('Erreur de vérification:', error.message);
        return false;
    }
}

// Exécuter
generateHash().then(() => {
    console.log('\n✓ Terminé\n');
    process.exit(0);
});

module.exports = { generateHash, verifyHash };
