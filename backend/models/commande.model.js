/* ================================================================
   MODELS/COMMANDE.MODEL.JS
   Accès aux données de la table commandes
   (Couche Model du pattern MVC)
   ================================================================ */

const { pool } = require('../config/db.mysql');

class CommandeModel {

    /**
     * Créer une nouvelle commande
     */
    static async creer({ utilisateurId, menuId, nombrePersonnes, prixUnitaire, reduction, prixTotal, dateEvenement, adresseLivraison, commentaire }) {
        const [result] = await pool.query(
            `INSERT INTO commandes
             (utilisateur_id, menu_id, nombre_personnes, prix_unitaire, reduction, prix_total, date_evenement, adresse_livraison, commentaire)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [utilisateurId, menuId, nombrePersonnes, prixUnitaire, reduction, prixTotal,
             dateEvenement || null, adresseLivraison || null, commentaire || null]
        );
        return result.insertId;
    }

    /**
     * Récupérer les commandes d'un client
     */
    static async listerParClient(utilisateurId) {
        const [rows] = await pool.query(
            `SELECT c.*, m.nom AS menu_nom
             FROM commandes c
             JOIN menus m ON c.menu_id = m.id
             WHERE c.utilisateur_id = ?
             ORDER BY c.date_commande DESC`,
            [utilisateurId]
        );
        return rows;
    }

    /**
     * Récupérer toutes les commandes (admin/employé)
     */
    static async listerToutes() {
        const [rows] = await pool.query(
            `SELECT c.*, m.nom AS menu_nom, u.nom AS client_nom, u.prenom AS client_prenom, u.email AS client_email
             FROM commandes c
             JOIN menus m ON c.menu_id = m.id
             JOIN utilisateurs u ON c.utilisateur_id = u.id
             ORDER BY c.date_commande DESC`
        );
        return rows;
    }

    /**
     * Mettre à jour le statut d'une commande
     */
    static async mettreAJourStatut(id, statut) {
        await pool.query('UPDATE commandes SET statut = ? WHERE id = ?', [statut, id]);
    }

    /**
     * Compter les commandes et calculer le chiffre d'affaires
     */
    static async statistiques() {
        const [total] = await pool.query('SELECT COUNT(*) AS total FROM commandes');
        const [ca] = await pool.query('SELECT SUM(prix_total) AS total FROM commandes WHERE statut != "annulee"');
        return { total: total[0].total, chiffreAffaires: ca[0].total || 0 };
    }
}

module.exports = CommandeModel;
