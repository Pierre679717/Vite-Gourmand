/* ================================================================
   MODELS/MENU.MODEL.JS
   Accès aux données des tables menus et plats
   (Couche Model du pattern MVC)
   ================================================================ */

const { pool } = require('../config/db.mysql');

class MenuModel {

    /**
     * Récupérer tous les menus actifs
     */
    static async listerActifs() {
        const [rows] = await pool.query('SELECT * FROM menus WHERE actif = 1');
        return rows;
    }

    /**
     * Récupérer un menu par son ID avec ses plats
     */
    static async trouverParId(id) {
        const [menus] = await pool.query(
            'SELECT * FROM menus WHERE id = ?',
            [id]
        );
        if (menus.length === 0) return null;

        const [plats] = await pool.query(
            `SELECT * FROM plats WHERE menu_id = ?
             ORDER BY FIELD(categorie, 'entree', 'poisson', 'plat_principal', 'fromage', 'dessert')`,
            [id]
        );

        return { menu: menus[0], plats };
    }

    /**
     * Créer un nouveau menu
     */
    static async creer({ nom, description, prix, theme, regime, image, minimumPersonnes = 6 }) {
        const [result] = await pool.query(
            'INSERT INTO menus (nom, description, prix, theme, regime, image, minimum_personnes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nom, description, prix, theme, regime, image, minimumPersonnes]
        );
        return result.insertId;
    }

    /**
     * Compter les menus actifs
     */
    static async compterActifs() {
        const [rows] = await pool.query('SELECT COUNT(*) AS total FROM menus WHERE actif = 1');
        return rows[0].total;
    }
}

module.exports = MenuModel;
