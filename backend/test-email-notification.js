const db = require('./database/db');
const emailService = require('./api/emailService');

async function testEmailNotification() {
    console.log('--- Test de notification email ---');
    try {
        const salaire = {
            nom_complet: 'Vétérinaire Test',
            mois: 2,
            annee: 2026,
            salaire_net: 500000
        };

        console.log('1. Récupération des admins/managers...');
        const [admins] = await db.query(
            "SELECT nom_complet, email FROM utilisateurs WHERE role IN ('admin', 'manager') AND statut = 'actif'"
        );
        console.log(`Nombre d'admins/managers trouvés: ${admins ? admins.length : 0}`);

        if (admins && admins.length > 0) {
            console.log('2. Simulation de l\'envoi d\'emails (premiers 2 si plus)...');
            const toNotify = admins.slice(0, 2);
            for (const admin of toNotify) {
                console.log(`Envoi à: ${admin.email} (${admin.nom_complet})`);
                // Note: This will actually try to send emails if credentials are set
                // You might want to mock this in a real test environment
                const result = await emailService.envoyerNotificationConfirmationReception(
                    admin.email,
                    admin.nom_complet,
                    salaire.nom_complet,
                    salaire.mois,
                    salaire.annee,
                    salaire.salaire_net
                );
                console.log(`Résultat pour ${admin.email}:`, result.success ? 'Succès' : 'Échec (' + result.error + ')');
            }
        }
    } catch (error) {
        console.error('Erreur pendant le test:', error);
    } finally {
        // Enforce exit if needed
        setTimeout(() => process.exit(0), 5000);
    }
}

testEmailNotification();
