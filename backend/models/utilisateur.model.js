/* ================================================================
   MODELS/UTILISATEUR.MODEL.JS
   Accès aux données des tables utilisateur et role
   (Couche Model du pattern MVC)
   ================================================================
   Le rôle est stocké dans la table role (clé étrangère role_id).
   Les requêtes renvoient directement son libellé dans une colonne
   "role" ('utilisateur', 'employe' ou 'administrateur'), pour que
   les contrôleurs et le middleware n'aient pas à connaître role_id.
   ================================================================ */

const { pool } = require('../config/db.mysql');

// Colonnes renvoyées au front : jamais le mot de passe
const COLONNES_PUBLIQUES = `
    u.utilisateur_id, u.nom, u.prenom, u.email, u.telephone,
    u.adresse_postale, u.code_postal, u.ville, u.actif, r.libelle AS role`;

class UtilisateurModel {

    /**
     * Trouver un utilisateur par son email (connexion).
     * Renvoie aussi le hash du mot de passe pour bcrypt.compare().
     */
    static async trouverParEmail(email) {
        const [rows] = await pool.query(
            `SELECT ${COLONNES_PUBLIQUES}, u.mot_de_passe
             FROM utilisateur u
             JOIN role r ON r.role_id = u.role_id
             WHERE u.email = ?`,
            [email]
        );
        return rows[0] || null;
    }

    /**
     * Trouver un utilisateur par son ID (sans le mot de passe)
     */
    static async trouverParId(id) {
        const [rows] = await pool.query(
            `SELECT ${COLONNES_PUBLIQUES}
             FROM utilisateur u
             JOIN role r ON r.role_id = u.role_id
             WHERE u.utilisateur_id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Créer un utilisateur.
     * Le role_id est retrouvé à partir du libellé par une sous-requête :
     * si le libellé n'existe pas, role_id vaut NULL et MySQL refuse
     * l'insertion (colonne NOT NULL).
     */
    static async creer({ nom, prenom, email, telephone, adressePostale, codePostal, ville, motDePasseHash, role = 'utilisateur' }) {
        const [result] = await pool.query(
            `INSERT INTO utilisateur
             (nom, prenom, email, telephone, adresse_postale, code_postal, ville, mot_de_passe, role_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT role_id FROM role WHERE libelle = ?))`,
            [nom, prenom, email, telephone || null, adressePostale || null,
             codePostal || null, ville || null, motDePasseHash, role]
        );
        return result.insertId;
    }

    /**
     * Vérifier si un email est déjà utilisé
     */
    static async emailExiste(email) {
        const [rows] = await pool.query(
            'SELECT utilisateur_id FROM utilisateur WHERE email = ?',
            [email]
        );
        return rows.length > 0;
    }

    /**
     * Récupérer tous les employés (actifs et désactivés)
     */
    static async listerEmployes() {
        const [rows] = await pool.query(
            `SELECT u.utilisateur_id, u.nom, u.prenom, u.email, u.actif
             FROM utilisateur u
             JOIN role r ON r.role_id = u.role_id
             WHERE r.libelle = 'employe'
             ORDER BY u.nom, u.prenom`
        );
        return rows;
    }

    /**
     * Compter les comptes clients (rôle utilisateur)
     */
    static async compterClients() {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM utilisateur u
             JOIN role r ON r.role_id = u.role_id
             WHERE r.libelle = 'utilisateur'`
        );
        return rows[0].total;
    }
}

module.exports = UtilisateurModel;
