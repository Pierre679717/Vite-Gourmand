/* ================================================================
   MODELS/COMMANDE.MODEL.JS
   Accès aux données des tables commande et suivi_commande
   (Couche Model du pattern MVC)
   ================================================================
   Créer une commande touche 3 tables : commande, suivi_commande et
   menu (le stock baisse de 1). On le fait dans une TRANSACTION :
   soit tout réussit (COMMIT), soit rien n'est enregistré (ROLLBACK).
   Sans transaction, une erreur au milieu pourrait laisser une
   commande sans historique ou un stock faux.
   ================================================================ */

const crypto = require('crypto');
const { pool } = require('../config/db.mysql');
const MenuModel = require('./menu.model');

// Erreur "métier" : le contrôleur la transforme en réponse 4xx
class ErreurCommande extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

class CommandeModel {

    /**
     * Créer une commande dans une transaction.
     * `calculerPrix(menu)` est fourni par le contrôleur : le prix est
     * calculé à partir du menu relu ET verrouillé dans la transaction.
     * Renvoie { commandeId, numeroCommande, menu, prix }.
     */
    static async creer(donnees, calculerPrix) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Relire le menu en le verrouillant (FOR UPDATE) : deux
            //    commandes simultanées ne peuvent pas prendre la dernière unité.
            const menu = await MenuModel.trouverPourCommande(donnees.menuId, conn);
            if (!menu) throw new ErreurCommande('Menu introuvable.', 404);
            if (donnees.nombrePersonne < menu.nombre_personne_min) {
                throw new ErreurCommande(`Minimum ${menu.nombre_personne_min} personnes pour ce menu.`);
            }
            if (menu.quantite_restante < 1) {
                throw new ErreurCommande('Ce menu n\'est plus disponible (stock épuisé).', 409);
            }

            const prix = calculerPrix(menu);

            // 2. Insérer la commande. Le numéro définitif dépend de l'id,
            //    qu'on ne connaît qu'après l'INSERT : on met un numéro
            //    provisoire unique, remplacé juste après (même transaction).
            const numeroProvisoire = 'TMP-' + crypto.randomBytes(6).toString('hex');
            const [result] = await conn.query(
                `INSERT INTO commande
                 (numero_commande, date_prestation, heure_livraison, adresse_prestation, ville_prestation,
                  distance_km, nombre_personne, prix_par_personne, reduction, prix_menu, prix_livraison,
                  prix_total, pret_materiel, utilisateur_id, menu_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [numeroProvisoire, donnees.datePrestation, donnees.heureLivraison,
                 donnees.adressePrestation, donnees.villePrestation, prix.distance_km,
                 donnees.nombrePersonne, prix.prix_par_personne, prix.reduction, prix.prix_menu,
                 prix.prix_livraison, prix.prix_total, donnees.pretMateriel ? 1 : 0,
                 donnees.utilisateurId, menu.menu_id]
            );
            const commandeId = result.insertId;

            // Numéro lisible : VG-<année>-<id sur 4 chiffres>, ex. VG-2026-0010
            const numeroCommande = `VG-${new Date().getFullYear()}-${String(commandeId).padStart(4, '0')}`;
            await conn.query(
                'UPDATE commande SET numero_commande = ? WHERE commande_id = ?',
                [numeroCommande, commandeId]
            );

            // 3. Premier état du suivi (employe_id NULL : c'est le client qui agit)
            await conn.query(
                'INSERT INTO suivi_commande (commande_id, statut) VALUES (?, \'en_attente\')',
                [commandeId]
            );

            // 4. Le stock baisse d'une commande
            await conn.query(
                'UPDATE menu SET quantite_restante = quantite_restante - 1 WHERE menu_id = ?',
                [menu.menu_id]
            );

            await conn.commit();
            return { commandeId, numeroCommande, menu, prix };

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release(); // toujours rendre la connexion au pool
        }
    }

    /**
     * Récupérer les commandes d'un client
     */
    static async listerParClient(utilisateurId) {
        const [rows] = await pool.query(
            `SELECT c.*, m.titre AS menu_titre
             FROM commande c
             JOIN menu m ON m.menu_id = c.menu_id
             WHERE c.utilisateur_id = ?
             ORDER BY c.date_commande DESC`,
            [utilisateurId]
        );
        return rows;
    }

    /**
     * Récupérer toutes les commandes (employé / admin)
     */
    static async listerToutes() {
        const [rows] = await pool.query(
            `SELECT c.*, m.titre AS menu_titre,
                    u.nom AS client_nom, u.prenom AS client_prenom,
                    u.email AS client_email, u.telephone AS client_telephone
             FROM commande c
             JOIN menu m        ON m.menu_id = c.menu_id
             JOIN utilisateur u ON u.utilisateur_id = c.utilisateur_id
             ORDER BY c.date_commande DESC`
        );
        return rows;
    }

    /**
     * Changer le statut d'une commande (employé / admin), en transaction :
     * mise à jour de la commande + nouvelle ligne de suivi.
     * En cas d'annulation, on enregistre le mode de contact et le motif,
     * et on rend l'unité au stock du menu.
     */
    static async changerStatut({ commandeId, statut, employeId, modeContact = null, motif = null }) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                'SELECT statut, menu_id FROM commande WHERE commande_id = ? FOR UPDATE',
                [commandeId]
            );
            if (rows.length === 0) throw new ErreurCommande('Commande introuvable.', 404);

            const ancien = rows[0];
            if (ancien.statut === 'annulee' || ancien.statut === 'terminee') {
                throw new ErreurCommande('Cette commande est clôturée : son statut ne peut plus changer.', 409);
            }

            if (statut === 'annulee') {
                await conn.query(
                    'UPDATE commande SET statut = ?, mode_contact = ?, motif = ? WHERE commande_id = ?',
                    [statut, modeContact, motif, commandeId]
                );
                await conn.query(
                    'UPDATE menu SET quantite_restante = quantite_restante + 1 WHERE menu_id = ?',
                    [ancien.menu_id]
                );
            } else {
                await conn.query(
                    'UPDATE commande SET statut = ? WHERE commande_id = ?',
                    [statut, commandeId]
                );
            }

            await conn.query(
                'INSERT INTO suivi_commande (commande_id, statut, employe_id) VALUES (?, ?, ?)',
                [commandeId, statut, employeId]
            );

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Nombre de commandes et chiffre d'affaires (hors commandes annulées)
     */
    static async statistiques() {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN statut <> 'annulee' THEN prix_total END), 0) AS chiffre_affaires
             FROM commande`
        );
        return { total: rows[0].total, chiffreAffaires: Number(rows[0].chiffre_affaires) };
    }
}

module.exports = { CommandeModel, ErreurCommande };
