/* ================================================================
   MODELS/CATALOGUE.MODEL.JS
   Gestion du catalogue par l'employé : menus (composition en plats,
   carte, suppression), plats (allergènes) et horaires.
   (Couche Model du pattern MVC)
   ================================================================
   La lecture publique du catalogue reste dans menu.model.js (menus
   actifs seulement). Ici, l'employé voit tout, y compris les menus
   retirés de la carte, et chaque écriture qui touche plusieurs tables
   se fait dans une transaction : tout est enregistré, ou rien.
   ================================================================ */

const { pool } = require('../config/db.mysql');

/** Erreur prévue (404, 409, 400) : le contrôleur renvoie son statut et son message */
class ErreurCatalogue extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

/** Traduit les erreurs de contraintes MySQL en messages pour l'employé */
function traduireErreurSql(err, quoi) {
    if (err instanceof ErreurCatalogue) return err;
    if (err.code === 'ER_DUP_ENTRY') {
        return new ErreurCatalogue(`${quoi} porte déjà ce nom.`, 409);
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return new ErreurCatalogue('Thème, régime ou allergène inconnu.', 400);
    }
    return err;
}

/**
 * Exécute `travail(conn)` dans une transaction :
 * COMMIT si tout s'est bien passé, ROLLBACK sinon, connexion toujours rendue.
 */
async function enTransaction(travail, quoi) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const resultat = await travail(conn);
        await conn.commit();
        return resultat;
    } catch (err) {
        await conn.rollback();
        throw traduireErreurSql(err, quoi);
    } finally {
        conn.release();
    }
}

/** Les plats choisis existent-ils tous ? Sinon 400 (un plat supprimé entre-temps) */
async function verifierPlats(conn, ids) {
    const [rows] = await conn.query('SELECT plat_id FROM plat WHERE plat_id IN (?)', [ids]);
    if (rows.length !== ids.length) {
        throw new ErreurCatalogue('Un des plats choisis n\'existe plus : rechargez la page.', 400);
    }
}

/** Remplace la composition d'un menu : on efface puis on réinsère */
async function enregistrerPlats(conn, menuId, plats) {
    await conn.query('DELETE FROM menu_plat WHERE menu_id = ?', [menuId]);
    // VALUES ? avec un tableau de tableaux : une ligne (menu_id, plat_id) par plat
    await conn.query('INSERT INTO menu_plat (menu_id, plat_id) VALUES ?', [plats.map((p) => [menuId, p])]);
}

/** Colonnes d'un menu dans l'ordre de l'INSERT et de l'UPDATE */
const valeursMenu = (d) => [
    d.titre, d.description, d.conditions, d.nombre_personne_min, d.delai_minimum_jours,
    d.prix_par_personne, d.quantite_restante, d.theme_id, d.regime_id
];

class CatalogueModel {

    // -----------------------------------------------------------------
    // Menus
    // -----------------------------------------------------------------

    /**
     * Tous les menus, sur la carte ou non, avec le nombre de plats et de
     * commandes (un menu déjà commandé ne peut pas être supprimé).
     */
    static async listerMenus() {
        const [rows] = await pool.query(
            `SELECT m.menu_id, m.titre, m.actif, m.nombre_personne_min, m.prix_par_personne,
                    m.prix_par_personne * m.nombre_personne_min AS prix_minimum,
                    m.quantite_restante, t.libelle AS theme, r.libelle AS regime,
                    (SELECT COUNT(*) FROM menu_plat mp WHERE mp.menu_id = m.menu_id) AS nombre_plats,
                    (SELECT COUNT(*) FROM commande c WHERE c.menu_id = m.menu_id) AS nombre_commandes
             FROM menu m
             JOIN theme  t ON t.theme_id  = m.theme_id
             JOIN regime r ON r.regime_id = m.regime_id
             ORDER BY m.actif DESC, m.titre`
        );
        return rows;
    }

    /** Choix du formulaire de menu : thèmes, régimes et plats (par catégorie) */
    static async optionsMenus() {
        const [themes] = await pool.query('SELECT theme_id, libelle FROM theme ORDER BY libelle');
        const [regimes] = await pool.query('SELECT regime_id, libelle FROM regime ORDER BY libelle');
        const [plats] = await pool.query(
            `SELECT plat_id, titre, categorie FROM plat
             ORDER BY FIELD(categorie, 'entree', 'plat', 'dessert'), titre`
        );
        return { themes, regimes, plats };
    }

    /** Un menu tel que le formulaire l'édite (identifiants, pas libellés), ou null */
    static async trouverMenu(menuId) {
        const [menus] = await pool.query(
            `SELECT menu_id, titre, description, conditions, nombre_personne_min,
                    delai_minimum_jours, prix_par_personne, quantite_restante, actif,
                    theme_id, regime_id,
                    (SELECT COUNT(*) FROM commande c WHERE c.menu_id = menu.menu_id) AS nombre_commandes
             FROM menu WHERE menu_id = ?`,
            [menuId]
        );
        if (menus.length === 0) return null;
        const [plats] = await pool.query(
            'SELECT plat_id FROM menu_plat WHERE menu_id = ? ORDER BY plat_id',
            [menuId]
        );
        return { ...menus[0], plats: plats.map((p) => p.plat_id) };
    }

    /** Nouveau menu + sa composition, en une transaction. Renvoie son identifiant */
    static async creerMenu(donnees) {
        return enTransaction(async (conn) => {
            await verifierPlats(conn, donnees.plats);
            const [resultat] = await conn.query(
                `INSERT INTO menu (titre, description, conditions, nombre_personne_min, delai_minimum_jours,
                                   prix_par_personne, quantite_restante, theme_id, regime_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                valeursMenu(donnees)
            );
            await enregistrerPlats(conn, resultat.insertId, donnees.plats);
            return resultat.insertId;
        }, 'Un menu');
    }

    /**
     * Modifie un menu et remplace sa composition.
     * Les commandes déjà passées ne bougent pas : leurs prix sont figés.
     * FOR UPDATE : une commande en cours sur ce menu attend la fin de la
     * modification (le stock lu par la commande est donc à jour).
     */
    static async modifierMenu(menuId, donnees) {
        return enTransaction(async (conn) => {
            const [menus] = await conn.query('SELECT menu_id FROM menu WHERE menu_id = ? FOR UPDATE', [menuId]);
            if (menus.length === 0) throw new ErreurCatalogue('Menu introuvable.', 404);
            await verifierPlats(conn, donnees.plats);
            await conn.query(
                `UPDATE menu SET titre = ?, description = ?, conditions = ?, nombre_personne_min = ?,
                                 delai_minimum_jours = ?, prix_par_personne = ?, quantite_restante = ?,
                                 theme_id = ?, regime_id = ?
                 WHERE menu_id = ?`,
                [...valeursMenu(donnees), menuId]
            );
            await enregistrerPlats(conn, menuId, donnees.plats);
        }, 'Un menu');
    }

    /** Retire le menu de la carte (actif = 0) ou l'y remet (actif = 1) */
    static async changerCarte(menuId, actif) {
        const [resultat] = await pool.query('UPDATE menu SET actif = ? WHERE menu_id = ?', [actif ? 1 : 0, menuId]);
        if (resultat.affectedRows === 0) throw new ErreurCatalogue('Menu introuvable.', 404);
    }

    /**
     * Supprime un menu jamais commandé (ses plats associés et ses images
     * partent avec lui : ON DELETE CASCADE). Un menu déjà commandé reste
     * en base pour l'historique et les factures : 409.
     */
    static async supprimerMenu(menuId) {
        return enTransaction(async (conn) => {
            const [menus] = await conn.query('SELECT titre FROM menu WHERE menu_id = ? FOR UPDATE', [menuId]);
            if (menus.length === 0) throw new ErreurCatalogue('Menu introuvable.', 404);
            const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM commande WHERE menu_id = ?', [menuId]);
            if (total > 0) {
                throw new ErreurCatalogue(
                    `« ${menus[0].titre} » a déjà été commandé (${total} commande${total > 1 ? 's' : ''}) : `
                    + 'il reste en base pour l\'historique. Retirez-le plutôt de la carte.', 409);
            }
            await conn.query('DELETE FROM menu WHERE menu_id = ?', [menuId]);
            return menus[0].titre;
        }, 'Un menu');
    }
}

module.exports = { CatalogueModel, ErreurCatalogue, enTransaction };
