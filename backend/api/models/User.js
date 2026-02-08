const db = require('../../database/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

class User {
    // Create new user
    static async create(userData) {
        const {
            matricule, email, mot_de_passe, nom_complet, telephone,
            type_employe, role, id_departement, date_embauche,
            salaire_base, cree_par
        } = userData;

        // Hash password
        const hashedPassword = await bcrypt.hash(mot_de_passe, 12);
        
        // Generate QR code data
        const qrData = JSON.stringify({
            matricule,
            nom_complet,
            role,
            id_departement,
            date_creation: new Date()
        });
        
        const qrCode = await QRCode.toDataURL(qrData);

        const sql = `
            INSERT INTO utilisateurs (
                matricule, email, mot_de_passe_hash, nom_complet, telephone,
                type_employe, role, id_departement, date_embauche,
                salaire_base, qr_code, cree_par
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            matricule, email, hashedPassword, nom_complet, telephone,
            type_employe, role, id_departement, date_embauche,
            salaire_base, qrCode, cree_par
        ];

        const result = await db.query(sql, params);
        return result.insertId;
    }
    static async findByEmailComplete(email) {
        const sql = `
            SELECT u.*, d.nom as departement_nom, d.type as departement_type
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.email = ?
        `;
        const [user] = await db.query(sql, [email]);
        return user;
    }

    // Vérifier si le type d'employé existe et est valide dans la BD
    static async isValidEmployeeType(typeEmploye) {
        // Vérifier dans la table utilisateurs si ce type existe
        const sql = `
            SELECT COUNT(*) as count 
            FROM utilisateurs 
            WHERE type_employe = ? 
            LIMIT 1
        `;
        const [result] = await db.query(sql, [typeEmploye]);
        return result.count > 0;
    }

    // Vérifier si le rôle existe et est valide dans la BD
    static async isValidRole(role) {
        // Vérifier dans la table utilisateurs si ce rôle existe
        const sql = `
            SELECT COUNT(*) as count 
            FROM utilisateurs 
            WHERE role = ? 
            LIMIT 1
        `;
        const [result] = await db.query(sql, [role]);
        return result.count > 0;
    }

    // Vérifier si un utilisateur avec ce type d'employé peut se connecter
    static async canEmployeeTypeLogin(typeEmploye) {
        // Récupérer tous les types d'employés distincts qui sont actifs
        const sql = `
            SELECT DISTINCT type_employe 
            FROM utilisateurs 
            WHERE statut = 'actif'
        `;
        const results = await db.query(sql);
        const validTypes = results.map(r => r.type_employe);
        return validTypes.includes(typeEmploye);
    }

    // Vérifier si un utilisateur avec ce rôle peut se connecter
    static async canRoleLogin(role) {
        // Récupérer tous les rôles distincts qui sont actifs
        const sql = `
            SELECT DISTINCT role 
            FROM utilisateurs 
            WHERE statut = 'actif'
        `;
        const results = await db.query(sql);
        const validRoles = results.map(r => r.role);
        return validRoles.includes(role);
}

    // Find user by matricule
    static async findByMatricule(matricule) {
        const sql = `
            SELECT u.*, d.nom as departement_nom
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.matricule = ? AND u.statut = 'actif'
        `;
        const [user] = await db.query(sql, [matricule]);
        return user;
    }

    // Get user by ID
    static async findById(id) {
        const sql = `
            SELECT u.*, d.nom as departement_nom, d.type as departement_type
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE u.id = ?
        `;
        const [user] = await db.query(sql, [id]);
        return user;
    }

    // Update user
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        Object.entries(updateData).forEach(([key, value]) => {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        values.push(id);
        const sql = `UPDATE utilisateurs SET ${fields.join(', ')} WHERE id = ?`;
        
        await db.query(sql, values);
        return true;
    }

    // Update password
    static async updatePassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const sql = `
            UPDATE utilisateurs 
            SET mot_de_passe_hash = ?, date_modification_mdp = NOW() 
            WHERE id = ?
        `;
        await db.query(sql, [hashedPassword, id]);
        return true;
    }

    // Verify password
    static async verifyPassword(user, password) {
        return await bcrypt.compare(password, user.mot_de_passe_hash);
    }

    // Ajouter après verifyPassword dans User.js
static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

    // Generate JWT token
    static generateToken(user) {
        const payload = {
            id: user.id,
            matricule: user.matricule,
            email: user.email,
            role: user.role,
            departement: user.id_departement,
            departement_type: user.departement_type
        };

        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE
        });
    }

    // Get all users with filters
    static async getAll(filters = {}) {
        let sql = `
            SELECT u.*, d.nom as departement_nom, d.type as departement_type
            FROM utilisateurs u
            LEFT JOIN departements d ON u.id_departement = d.id
            WHERE 1=1
        `;
        const params = [];

        // Apply filters
        if (filters.role) {
            sql += ' AND u.role = ?';
            params.push(filters.role);
        }

        if (filters.departement) {
            sql += ' AND u.id_departement = ?';
            params.push(filters.departement);
        }

        if (filters.statut) {
            sql += ' AND u.statut = ?';
            params.push(filters.statut);
        }

        if (filters.search) {
            sql += ` AND (
                u.nom_complet LIKE ? OR 
                u.email LIKE ? OR 
                u.matricule LIKE ? OR 
                u.telephone LIKE ?
            )`;
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY u.nom_complet ASC';
        
        // Pagination
        if (filters.page && filters.limit) {
            const offset = (filters.page - 1) * filters.limit;
            sql += ' LIMIT ? OFFSET ?';
            params.push(filters.limit, offset);
        }

        return await db.query(sql, params);
    }

    // Count users
    static async count(filters = {}) {
        let sql = 'SELECT COUNT(*) as total FROM utilisateurs u WHERE 1=1';
        const params = [];

        if (filters.role) {
            sql += ' AND u.role = ?';
            params.push(filters.role);
        }

        if (filters.statut) {
            sql += ' AND u.statut = ?';
            params.push(filters.statut);
        }

        const [result] = await db.query(sql, params);
        return result.total;
    }

    // Get dashboard statistics
    static async getDashboardStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_employes,
                SUM(CASE WHEN statut = 'actif' THEN 1 ELSE 0 END) as actifs,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
                SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as managers,
                SUM(CASE WHEN type_employe = 'INSS' THEN 1 ELSE 0 END) as inss,
                SUM(CASE WHEN type_employe = 'temps_partiel' THEN 1 ELSE 0 END) as temps_partiel
            FROM utilisateurs
        `;
        const [stats] = await db.query(sql);
        return stats;
    }

    // Update last login
    static async updateLastLogin(id) {
        const sql = `
            UPDATE utilisateurs 
            SET derniere_connexion = NOW(), 
                nombre_connexions = nombre_connexions + 1 
            WHERE id = ?
        `;
        await db.query(sql, [id]);
    }

    // Get user presence for current month
    static async getUserPresence(userId, month, year) {
        const sql = `
            SELECT 
                COUNT(*) as jours_presence,
                SEC_TO_SEC(SUM(TIME_TO_SEC(duree_travail))) as total_heures
            FROM presences 
            WHERE id_utilisateur = ? 
            AND MONTH(date) = ? 
            AND YEAR(date) = ?
            AND statut = 'present'
        `;
        const [result] = await db.query(sql, [userId, month, year]);
        return result;
    }

    // Get user salary information
    static async getUserSalaryInfo(userId) {
        const sql = `
            SELECT 
                salaire_base,
                type_employe,
                numero_cnss,
                compte_bancaire,
                nom_banque
            FROM utilisateurs 
            WHERE id = ?
        `;
        const [info] = await db.query(sql, [userId]);
        return info;
    }

    // Get user leaves
    static async getUserLeaves(userId) {
        const sql = `
            SELECT 
                type_conge,
                date_debut,
                date_fin,
                statut,
                jours_demandes
            FROM conges 
            WHERE id_utilisateur = ?
            ORDER BY date_debut DESC
        `;
        return await db.query(sql, [userId]);
    }
}

module.exports = User;