/* ================================================================
   MODELS/HORAIRE.MODEL.JS
   Accès aux horaires d'ouverture (table horaire : un jour par ligne)
   (Couche Model du pattern MVC)
   ================================================================ */

const { pool } = require('../config/db.mysql');

class HoraireModel {

    /**
     * Récupérer les 7 jours dans l'ordre de la semaine (lundi -> dimanche).
     * ORDER BY sur une colonne ENUM trie selon l'ordre de déclaration des
     * valeurs (lundi, mardi...), et non par ordre alphabétique.
     * TIME_FORMAT renvoie "09:00" au lieu de "09:00:00".
     * Un jour fermé a ses deux heures à NULL.
     */
    static async lister() {
        const [rows] = await pool.query(
            `SELECT jour,
                    TIME_FORMAT(heure_ouverture, '%H:%i') AS heure_ouverture,
                    TIME_FORMAT(heure_fermeture, '%H:%i') AS heure_fermeture
             FROM horaire
             ORDER BY jour`
        );
        return rows;
    }
}

module.exports = HoraireModel;
