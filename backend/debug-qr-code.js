const db = require('./database/db');

async function debugQRCode() {
    try {
        const users = await db.query("SELECT id, nom_complet, role, matricule, LENGTH(qr_code) as qr_len, qr_code FROM utilisateurs WHERE role = 'veterinaire' AND statut = 'actif'");

        console.log(`Trouvé ${users.length} vétérinaires actifs.`);

        users.forEach(user => {
            console.log(`\nUtilisateur: ${user.nom_complet} (${user.id})`);
            console.log(`Matricule: ${user.matricule}`);
            console.log(`Longueur QR Code: ${user.qr_len || 0} caractères`);
            if (user.qr_code) {
                console.log(`Début du QR Code: ${user.qr_code.substring(0, 50)}...`);
            } else {
                console.log('QR Code est NULL');
            }
        });

        process.exit(0);
    } catch (error) {
        console.error('Erreur:', error);
        process.exit(1);
    }
}

debugQRCode();
