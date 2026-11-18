/* ================================================================
   CONTROLLERS/HORAIRE.CONTROLLER.JS
   Horaires d'ouverture, affichés dans le pied de page du site
   (Couche Controller du pattern MVC)
   ================================================================ */

const HoraireModel = require('../models/horaire.model');

class HoraireController {

    /**
     * GET /api/horaires
     * Route publique : [{ jour, heure_ouverture, heure_fermeture }]
     */
    static async lister(req, res) {
        try {
            const horaires = await HoraireModel.lister();
            res.json(horaires);
        } catch (err) {
            console.error('Erreur horaires :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = HoraireController;
