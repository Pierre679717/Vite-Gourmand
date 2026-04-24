/* ================================================================
   MODELS/UTILISATEUR.MODEL.JS
   Accès aux données de la table utilisateurs
   (Couche Model du pattern MVC)
   ================================================================ */

const { pool } = require('../config/db.mysql');

class UtilisateurModel {

    /**
     * Trouver un utilisateur par son email
     */
    static async trouverParEmail(email) {
        const [rows] = await pool.query(
            'SELECT * FROM utilisateurs WHERE email = ?',
            [email]
        );
        return rows[0] || null;
    }

    /**
     * Trouver un utilisateur par son ID
     */
    static async trouverParId(id) {
        const [rows] = await pool.query(
            'SELECT id, nom, prenom, email, telephone, role FROM utilisateurs WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Créer un nouvel utilisateur
     */
    static async creer({ nom, prenom, email, telephone, motDePasseHash, role = 'client' }) {
        const [result] = await pool.query(
            'INSERT INTO utilisateurs (nom, prenom, email, telephone, mot_de_passe, role) VALUES (?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, telephone || null, motDePasseHash, role]
        );
        return result.insertId;
    }

    /**
     * Vérifier si un email est déjà utilisé
     */
    static async emailExiste(email) {
        const [rows] = await pool.query(
            'SELECT id FROM utilisateurs WHERE email = ?',
            [email]
        );
        return rows.length > 0;
    }

    /**
     * Récupérer tous les employés
     */
    static async listerEmployes() {
        const [rows] = await pool.query(
            'SELECT id, nom, prenom, email, role, date_creation FROM utilisateurs WHERE role = "employe"'
        );
        return rows;
    }

    /**
     * Compter le total des utilisateurs
     */
    static async compter() {
        const [rows] = await pool.query('SELECT COUNT(*) AS total FROM utilisateurs');
        return rows[0].total;
    }
}

module.exports = UtilisateurModel;
