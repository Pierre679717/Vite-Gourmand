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

    /**
     * POST /api/employe/menus
     * Créer un nouveau menu (employé ou admin).
     * Les plats et les images seront associés depuis le back-office.
     */
    static async creer(req, res) {
        try {
            const {
                titre, description, nombre_personne_min, prix_par_personne,
                conditions, quantite_restante, theme_id, regime_id
            } = req.body;

            if (!titre || !description || !conditions || !theme_id || !regime_id) {
                return res.status(400).json({ error: 'Titre, description, conditions, thème et régime sont requis.' });
            }
            if (!Number.isInteger(nombre_personne_min) || nombre_personne_min < 1) {
                return res.status(400).json({ error: 'Le nombre minimum de personnes doit être un entier positif.' });
            }
            if (!(Number(prix_par_personne) > 0)) {
                return res.status(400).json({ error: 'Le prix par personne doit être supérieur à 0.' });
            }
            if (!Number.isInteger(quantite_restante) || quantite_restante < 0) {
                return res.status(400).json({ error: 'Le stock doit être un entier positif ou nul.' });
            }

            const id = await MenuModel.creer({
                titre, description, conditions,
                nombrePersonneMin: nombre_personne_min,
                prixParPersonne:   prix_par_personne,
                quantiteRestante:  quantite_restante,
                themeId:  theme_id,
                regimeId: regime_id
            });

            res.status(201).json({ message: 'Menu créé !', id });
        } catch (err) {
            // Contrainte UNIQUE sur le titre, ou thème / régime inexistant
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Un menu porte déjà ce titre.' });
            }
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'Thème ou régime inconnu.' });
            }
            console.error('Erreur création menu :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = MenuController;
