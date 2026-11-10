/* ================================================================
   MODELS/MENU.MODEL.JS
   Accès aux données des menus et de tout ce qui les décrit :
   theme, regime, menu_image, plat (via menu_plat) et allergene
   (via plat_allergene).
   (Couche Model du pattern MVC)
   ================================================================ */

const { pool } = require('../config/db.mysql');

// Colonnes communes à la liste et au détail.
// prix_minimum = prix pour le nombre minimum de personnes (exigé par le sujet).
const COLONNES_MENU = `
    m.menu_id, m.titre, m.description, m.nombre_personne_min,
    m.delai_minimum_jours, m.prix_par_personne,
    m.prix_par_personne * m.nombre_personne_min AS prix_minimum,
    m.conditions, m.quantite_restante, m.actif,
    t.libelle AS theme, r.libelle AS regime`;

class MenuModel {

    /**
     * Récupérer les menus actifs, avec leur image principale
     * (celle d'ordre 1 dans la galerie, s'il y en a une).
     *
     * `filtres` vient de validerFiltresMenus (utils/filtresMenus.js) :
     * ses valeurs sont déjà des nombres vérifiés. Malgré tout, aucune
     * valeur n'est collée dans le SQL : chaque condition ajoute un « ? »
     * et sa valeur va dans le tableau `params` (requête paramétrée,
     * protection contre l'injection SQL).
     */
    static async listerActifs(filtres = {}) {
        const conditions = ['m.actif = 1'];
        const params = [];

        // On répète le calcul : MySQL n'accepte pas l'alias prix_minimum dans le WHERE
        if (filtres.prixMin !== undefined) {
            conditions.push('m.prix_par_personne * m.nombre_personne_min >= ?');
            params.push(filtres.prixMin);
        }
        if (filtres.prixMax !== undefined) {
            conditions.push('m.prix_par_personne * m.nombre_personne_min <= ?');
            params.push(filtres.prixMax);
        }
        if (filtres.themeId !== undefined) {
            conditions.push('m.theme_id = ?');
            params.push(filtres.themeId);
        }
        if (filtres.regimeId !== undefined) {
            conditions.push('m.regime_id = ?');
            params.push(filtres.regimeId);
        }
        if (filtres.personnes !== undefined) {
            // Menus commandables pour ce nombre de convives
            conditions.push('m.nombre_personne_min <= ?');
            params.push(filtres.personnes);
        }

        const [rows] = await pool.query(
            `SELECT ${COLONNES_MENU},
                    m.theme_id, m.regime_id,
                    i.chemin AS image, i.texte_alternatif AS image_alt
             FROM menu m
             JOIN theme  t ON t.theme_id  = m.theme_id
             JOIN regime r ON r.regime_id = m.regime_id
             LEFT JOIN menu_image i ON i.menu_id = m.menu_id AND i.ordre = 1
             WHERE ${conditions.join(' AND ')}
             ORDER BY m.titre`,
            params
        );
        return rows;
    }

    /**
     * Données utiles pour construire la barre de filtres :
     * thèmes, régimes, bornes de prix et de nombre de personnes
     * calculées sur les menus actifs.
     */
    static async optionsFiltres() {
        const [themes] = await pool.query(
            'SELECT theme_id AS id, libelle FROM theme ORDER BY libelle'
        );
        const [regimes] = await pool.query(
            'SELECT regime_id AS id, libelle FROM regime ORDER BY libelle'
        );
        const [[bornes]] = await pool.query(
            `SELECT MIN(prix_par_personne * nombre_personne_min) AS prix_min,
                    MAX(prix_par_personne * nombre_personne_min) AS prix_max,
                    MIN(nombre_personne_min) AS personnes_min
             FROM menu
             WHERE actif = 1`
        );
        return { themes, regimes, ...bornes };
    }

    /**
     * Récupérer le détail d'un menu actif :
     * le menu, sa galerie et ses plats (chacun avec ses allergènes).
     * Renvoie null si le menu n'existe pas ou est désactivé.
     */
    static async trouverParId(id) {
        const [menus] = await pool.query(
            `SELECT ${COLONNES_MENU}
             FROM menu m
             JOIN theme  t ON t.theme_id  = m.theme_id
             JOIN regime r ON r.regime_id = m.regime_id
             WHERE m.menu_id = ? AND m.actif = 1`,
            [id]
        );
        if (menus.length === 0) return null;

        const [images] = await pool.query(
            `SELECT image_id, chemin, texte_alternatif, ordre
             FROM menu_image
             WHERE menu_id = ?
             ORDER BY ordre`,
            [id]
        );

        // Plats du menu : on passe par la table d'association menu_plat
        const [plats] = await pool.query(
            `SELECT p.plat_id, p.titre, p.categorie, p.photo
             FROM plat p
             JOIN menu_plat mp ON mp.plat_id = p.plat_id
             WHERE mp.menu_id = ?
             ORDER BY FIELD(p.categorie, 'entree', 'plat', 'dessert'), p.titre`,
            [id]
        );

        // Allergènes de tous ces plats, en une seule requête
        const [allergenes] = await pool.query(
            `SELECT pa.plat_id, a.libelle
             FROM plat_allergene pa
             JOIN allergene a  ON a.allergene_id = pa.allergene_id
             JOIN menu_plat mp ON mp.plat_id = pa.plat_id
             WHERE mp.menu_id = ?
             ORDER BY a.libelle`,
            [id]
        );

        // On range chaque allergène dans le tableau de son plat
        for (const plat of plats) {
            plat.allergenes = allergenes
                .filter((a) => a.plat_id === plat.plat_id)
                .map((a) => a.libelle);
        }

        return { menu: menus[0], images, plats };
    }

    /**
     * Version minimale utilisée par la commande :
     * prix, minimum de personnes, délai de commande et stock d'un menu actif.
     * `conn` permet de lire dans une transaction (SELECT ... FOR UPDATE).
     * Pour un simple devis, `verrouiller: false` : on lit sans bloquer
     * les autres clients, rien n'est enregistré.
     */
    static async trouverPourCommande(id, conn = pool, { verrouiller = true } = {}) {
        const [rows] = await conn.query(
            `SELECT menu_id, titre, nombre_personne_min, delai_minimum_jours,
                    prix_par_personne, quantite_restante
             FROM menu
             WHERE menu_id = ? AND actif = 1
             ${verrouiller ? 'FOR UPDATE' : ''}`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Créer un nouveau menu (sans plats ni images : ils s'ajoutent ensuite)
     */
    static async creer({ titre, description, nombrePersonneMin, delaiMinimumJours, prixParPersonne, conditions, quantiteRestante, themeId, regimeId }) {
        const [result] = await pool.query(
            `INSERT INTO menu
             (titre, description, nombre_personne_min, delai_minimum_jours, prix_par_personne, conditions, quantite_restante, theme_id, regime_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [titre, description, nombrePersonneMin, delaiMinimumJours, prixParPersonne, conditions, quantiteRestante, themeId, regimeId]
        );
        return result.insertId;
    }

    /**
     * Compter les menus actifs
     */
    static async compterActifs() {
        const [rows] = await pool.query('SELECT COUNT(*) AS total FROM menu WHERE actif = 1');
        return rows[0].total;
    }
}

module.exports = MenuModel;
