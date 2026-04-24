/* ================================================================
   CONTROLLERS/MENU.CONTROLLER.JS
   Logique métier pour les menus
   (Couche Controller du pattern MVC)
   ================================================================ */

const MenuModel = require('../models/menu.model');

class MenuController {

    /**
     * GET /api/menus
     * Retourner la liste de tous les menus actifs
     */
    static async lister(req, res) {
        try {
            const menus = await MenuModel.listerActifs();
            res.json(menus);
        } catch (err) {
            console.error('Erreur menus :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/menus/:id
     * Retourner le détail d'un menu avec ses plats
     */
    static async detail(req, res) {
        try {
            const resultat = await MenuModel.trouverParId(req.params.id);
            if (!resultat) {
                return res.status(404).json({ error: 'Menu non trouvé.' });
            }
            res.json(resultat);
        } catch (err) {
            console.error('Erreur détail menu :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/employe/menus
     * Créer un nouveau menu (employé ou admin)
     */
    static async creer(req, res) {
        try {
            const { nom, description, prix, theme, regime, image, minimum_personnes } = req.body;

            if (!nom || !prix) {
                return res.status(400).json({ error: 'Nom et prix requis.' });
            }

            const id = await MenuModel.creer({
                nom, description, prix, theme, regime, image,
                minimumPersonnes: minimum_personnes || 6
            });

            res.status(201).json({ message: 'Menu créé !', id });
        } catch (err) {
            console.error('Erreur création menu :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = MenuController;
