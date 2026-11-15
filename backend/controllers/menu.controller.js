/* ================================================================
   CONTROLLERS/MENU.CONTROLLER.JS
   Logique métier pour les menus
   (Couche Controller du pattern MVC)
   ================================================================ */

const MenuModel = require('../models/menu.model');
const { validerFiltresMenus, validerId } = require('../utils/filtresMenus');

class MenuController {

    /**
     * GET /api/menus?prix_min=&prix_max=&theme=&regime=&personnes=
     * Retourner les menus actifs, filtrés côté serveur.
     * Paramètres invalides → 400 avec la liste des erreurs.
     */
    static async lister(req, res) {
        const { filtres, erreurs } = validerFiltresMenus(req.query);
        if (erreurs.length > 0) {
            return res.status(400).json({ error: 'Filtres invalides.', details: erreurs });
        }

        try {
            const menus = await MenuModel.listerActifs(filtres);
            res.json(menus);
        } catch (err) {
            console.error('Erreur menus :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/menus/filtres
     * Options de la barre de filtres (thèmes, régimes, bornes)
     */
    static async optionsFiltres(req, res) {
        try {
            res.json(await MenuModel.optionsFiltres());
        } catch (err) {
            console.error('Erreur options filtres :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/menus/:id
     * Retourner le détail d'un menu : galerie, plats et allergènes
     * Identifiant invalide (abc, -1...) → 404, comme un menu inexistant.
     */
    static async detail(req, res) {
        const id = validerId(req.params.id);
        if (id === null) {
            return res.status(404).json({ error: 'Menu non trouvé.' });
        }

        try {
            const resultat = await MenuModel.trouverParId(id);
            if (!resultat) {
                return res.status(404).json({ error: 'Menu non trouvé.' });
            }
            res.json(resultat);
        } catch (err) {
            console.error('Erreur détail menu :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = MenuController;
