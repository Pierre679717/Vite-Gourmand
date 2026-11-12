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
const { verifierDelai } = require('../utils/validationCommande');

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
            // Délai lu dans la même transaction que le stock : c'est la valeur à jour
            const erreurDelai = verifierDelai(donnees.datePrestation, menu.delai_minimum_jours, donnees.aujourdhui);
            if (erreurDelai) {
                throw new ErreurCommande(erreurDelai);
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
                  prix_total, pret_materiel, contact_nom, contact_prenom, contact_email,
                  contact_telephone, utilisateur_id, menu_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [numeroProvisoire, donnees.datePrestation, donnees.heureLivraison,
                 donnees.adressePrestation, donnees.villePrestation, prix.distance_km,
                 donnees.nombrePersonne, prix.prix_par_personne, prix.reduction, prix.prix_menu,
                 prix.prix_livraison, prix.prix_total, donnees.pretMateriel ? 1 : 0,
                 donnees.contactNom, donnees.contactPrenom, donnees.contactEmail,
                 donnees.contactTelephone, donnees.utilisateurId, menu.menu_id]
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
     * Modifier une commande par le client, dans une transaction.
     * Règles :
     *  - la commande doit être à lui (sinon 404, comme une commande inexistante) ;
     *  - son statut doit être « en_attente » (relu avec FOR UPDATE : si un
     *    employé l'accepte au même moment, l'une des deux opérations attend
     *    l'autre) ;
     *  - le menu ne change pas : on relit celui de la commande ;
     *  - mêmes contrôles qu'à la création (minimum de personnes, délai),
     *    prix recalculé par `calculerPrix(menu)` ;
     *  - le stock ne bouge pas : la commande garde son unité.
     * Renvoie { numeroCommande, menu, prix }.
     */
    static async modifierParClient({ commandeId, utilisateurId, donnees, aujourdhui }, calculerPrix) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                `SELECT numero_commande, statut, menu_id
                 FROM commande
                 WHERE commande_id = ? AND utilisateur_id = ?
                 FOR UPDATE`,
                [commandeId, utilisateurId]
            );
            if (rows.length === 0) throw new ErreurCommande('Commande introuvable.', 404);
            const commande = rows[0];
            if (commande.statut !== 'en_attente') {
                throw new ErreurCommande(
                    'Cette commande a déjà été prise en charge : elle ne peut plus être modifiée. Contactez-nous.', 409
                );
            }

            // Menu de la commande, même s'il a été retiré de la carte depuis
            const menu = await MenuModel.trouverPourCommande(commande.menu_id, conn, { actifSeulement: false });
            if (!menu) throw new ErreurCommande('Menu introuvable.', 404);
            if (donnees.nombrePersonne < menu.nombre_personne_min) {
                throw new ErreurCommande(`Minimum ${menu.nombre_personne_min} personnes pour ce menu.`);
            }
            const erreurDelai = verifierDelai(donnees.datePrestation, menu.delai_minimum_jours, aujourdhui);
            if (erreurDelai) {
                throw new ErreurCommande(erreurDelai);
            }

            const prix = calculerPrix(menu);

            await conn.query(
                `UPDATE commande
                 SET date_prestation = ?, heure_livraison = ?, adresse_prestation = ?, ville_prestation = ?,
                     distance_km = ?, nombre_personne = ?, prix_par_personne = ?, reduction = ?,
                     prix_menu = ?, prix_livraison = ?, prix_total = ?, pret_materiel = ?,
                     contact_nom = ?, contact_prenom = ?, contact_email = ?, contact_telephone = ?
                 WHERE commande_id = ?`,
                [donnees.datePrestation, donnees.heureLivraison, donnees.adressePrestation,
                 donnees.villePrestation, prix.distance_km, donnees.nombrePersonne, prix.prix_par_personne,
                 prix.reduction, prix.prix_menu, prix.prix_livraison, prix.prix_total,
                 donnees.pretMateriel ? 1 : 0, donnees.contactNom, donnees.contactPrenom,
                 donnees.contactEmail, donnees.contactTelephone, commandeId]
            );

            await conn.commit();
            return { numeroCommande: commande.numero_commande, menu, prix };

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Récupérer les commandes d'un client (liste de « Mes commandes »).
     * Colonnes choisies une par une : la liste n'a besoin que du résumé.
     * avis_donne vaut 1 si le client a déjà laissé un avis (LEFT JOIN :
     * les commandes sans avis restent dans la liste).
     */
    static async listerParClient(utilisateurId) {
        const [rows] = await pool.query(
            `SELECT c.commande_id, c.numero_commande, c.date_commande, c.date_prestation,
                    c.heure_livraison, c.ville_prestation, c.nombre_personne, c.prix_total,
                    c.statut, m.titre AS menu_titre,
                    (a.avis_id IS NOT NULL) AS avis_donne
             FROM commande c
             JOIN menu m      ON m.menu_id = c.menu_id
             LEFT JOIN avis a ON a.commande_id = c.commande_id
             WHERE c.utilisateur_id = ?
             ORDER BY c.date_commande DESC, c.commande_id DESC`,
            [utilisateurId]
        );
        return rows;
    }

    /**
     * Une commande, seulement si elle appartient à ce client.
     * La condition « utilisateur_id = ? » est dans la requête elle-même :
     * la commande d'un autre client est introuvable (null), exactement
     * comme une commande qui n'existe pas.
     */
    static async trouverPourClient(commandeId, utilisateurId) {
        const [rows] = await pool.query(
            `SELECT c.commande_id, c.numero_commande, c.date_commande, c.date_prestation,
                    c.heure_livraison, c.adresse_prestation, c.ville_prestation, c.distance_km,
                    c.nombre_personne, c.prix_par_personne, c.reduction, c.prix_menu,
                    c.prix_livraison, c.prix_total, c.statut, c.pret_materiel, c.materiel_restitue,
                    c.contact_nom, c.contact_prenom, c.contact_email, c.contact_telephone,
                    c.menu_id, m.titre AS menu_titre, m.nombre_personne_min, m.delai_minimum_jours,
                    a.note AS avis_note, a.commentaire AS avis_commentaire, a.statut AS avis_statut
             FROM commande c
             JOIN menu m      ON m.menu_id = c.menu_id
             LEFT JOIN avis a ON a.commande_id = c.commande_id
             WHERE c.commande_id = ? AND c.utilisateur_id = ?`,
            [commandeId, utilisateurId]
        );
        return rows[0] || null;
    }

    /**
     * Historique des statuts d'une commande, du plus ancien au plus récent.
     * suivi_id départage deux changements faits dans la même seconde.
     */
    static async listerSuivi(commandeId) {
        const [rows] = await pool.query(
            `SELECT statut, date_changement
             FROM suivi_commande
             WHERE commande_id = ?
             ORDER BY date_changement, suivi_id`,
            [commandeId]
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
