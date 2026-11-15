/* ================================================================
   CONTROLLERS/CATALOGUE.CONTROLLER.JS
   Espace employé : gestion des menus, des plats et des horaires
   (Couche Controller du pattern MVC)
   ================================================================
   Chaque action : identifiant vérifié (idValide), corps validé
   (utils/validationCatalogue.js, liste blanche), puis modèle.
   Les routes sont protégées par employeRequired (employé ou admin).
   ================================================================ */

const { CatalogueModel, ErreurCatalogue } = require('../models/catalogue.model');
const { idValide } = require('../utils/commandeClient');
const { validerMenu, validerPlat, validerHoraires } = require('../utils/validationCatalogue');

/** Réponse commune aux erreurs : prévue (404/409/400) ou 500 sans détail */
function repondreErreur(res, err, contexte) {
    if (err instanceof ErreurCatalogue) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(`Erreur ${contexte} :`, err);
    return res.status(500).json({ error: 'Erreur serveur.' });
}

/** 400 avec la liste des erreurs de validation */
function repondreInvalide(res, erreurs) {
    return res.status(400).json({ error: erreurs[0], erreurs });
}

class CatalogueController {

    // -----------------------------------------------------------------
    // Menus
    // -----------------------------------------------------------------

    /** GET /api/employe/menus : tous les menus, sur la carte ou non */
    static async listerMenus(req, res) {
        try {
            res.json(await CatalogueModel.listerMenus());
        } catch (err) {
            repondreErreur(res, err, 'liste des menus (employé)');
        }
    }

    /** GET /api/employe/menus/options : thèmes, régimes et plats pour le formulaire */
    static async optionsMenus(req, res) {
        try {
            res.json(await CatalogueModel.optionsMenus());
        } catch (err) {
            repondreErreur(res, err, 'options des menus');
        }
    }

    /** GET /api/employe/menus/:id : le menu à modifier */
    static async detailMenu(req, res) {
        try {
            const menuId = idValide(req.params.id);
            const menu = menuId === null ? null : await CatalogueModel.trouverMenu(menuId);
            if (!menu) return res.status(404).json({ error: 'Menu introuvable.' });
            res.json(menu);
        } catch (err) {
            repondreErreur(res, err, 'détail du menu (employé)');
        }
    }

    /** POST /api/employe/menus → 201 { message, menu_id } */
    static async creerMenu(req, res) {
        try {
            const { donnees, erreurs } = validerMenu(req.body);
            if (erreurs.length > 0) return repondreInvalide(res, erreurs);
            const menuId = await CatalogueModel.creerMenu(donnees);
            res.status(201).json({ message: `Menu « ${donnees.titre} » créé.`, menu_id: menuId });
        } catch (err) {
            repondreErreur(res, err, 'création du menu');
        }
    }

    /** PUT /api/employe/menus/:id → 200 { message } */
    static async modifierMenu(req, res) {
        try {
            const menuId = idValide(req.params.id);
            if (menuId === null) return res.status(404).json({ error: 'Menu introuvable.' });
            const { donnees, erreurs } = validerMenu(req.body);
            if (erreurs.length > 0) return repondreInvalide(res, erreurs);
            await CatalogueModel.modifierMenu(menuId, donnees);
            res.json({ message: `Menu « ${donnees.titre} » enregistré.` });
        } catch (err) {
            repondreErreur(res, err, 'modification du menu');
        }
    }

    /**
     * PUT /api/employe/menus/:id/carte  { actif: true | false }
     * Retirer un menu de la carte le cache du catalogue sans rien supprimer.
     */
    static async changerCarte(req, res) {
        try {
            const menuId = idValide(req.params.id);
            if (menuId === null) return res.status(404).json({ error: 'Menu introuvable.' });
            const actif = req.body ? req.body.actif : undefined;
            if (typeof actif !== 'boolean') {
                return res.status(400).json({ error: 'Indiquez actif : true ou false.' });
            }
            await CatalogueModel.changerCarte(menuId, actif);
            res.json({
                message: actif ? 'Menu remis sur la carte.' : 'Menu retiré de la carte.',
                actif
            });
        } catch (err) {
            repondreErreur(res, err, 'carte du menu');
        }
    }

    /** DELETE /api/employe/menus/:id : seulement s'il n'a jamais été commandé (sinon 409) */
    static async supprimerMenu(req, res) {
        try {
            const menuId = idValide(req.params.id);
            if (menuId === null) return res.status(404).json({ error: 'Menu introuvable.' });
            const titre = await CatalogueModel.supprimerMenu(menuId);
            res.json({ message: `Menu « ${titre} » supprimé.` });
        } catch (err) {
            repondreErreur(res, err, 'suppression du menu');
        }
    }
    // -----------------------------------------------------------------
    // Plats et allergènes
    // -----------------------------------------------------------------

    /** GET /api/employe/allergenes */
    static async listerAllergenes(req, res) {
        try {
            res.json(await CatalogueModel.listerAllergenes());
        } catch (err) {
            repondreErreur(res, err, 'liste des allergènes');
        }
    }

    /** GET /api/employe/plats : plats + allergènes + menus qui les utilisent */
    static async listerPlats(req, res) {
        try {
            res.json(await CatalogueModel.listerPlats());
        } catch (err) {
            repondreErreur(res, err, 'liste des plats');
        }
    }

    /** GET /api/employe/plats/:id : le plat à modifier */
    static async detailPlat(req, res) {
        try {
            const platId = idValide(req.params.id);
            const plat = platId === null ? null : await CatalogueModel.trouverPlat(platId);
            if (!plat) return res.status(404).json({ error: 'Plat introuvable.' });
            res.json(plat);
        } catch (err) {
            repondreErreur(res, err, 'détail du plat');
        }
    }

    /** POST /api/employe/plats → 201 { message, plat_id } */
    static async creerPlat(req, res) {
        try {
            const { donnees, erreurs } = validerPlat(req.body);
            if (erreurs.length > 0) return repondreInvalide(res, erreurs);
            const platId = await CatalogueModel.creerPlat(donnees);
            res.status(201).json({ message: `Plat « ${donnees.titre} » créé.`, plat_id: platId });
        } catch (err) {
            repondreErreur(res, err, 'création du plat');
        }
    }

    /** PUT /api/employe/plats/:id → 200 { message } */
    static async modifierPlat(req, res) {
        try {
            const platId = idValide(req.params.id);
            if (platId === null) return res.status(404).json({ error: 'Plat introuvable.' });
            const { donnees, erreurs } = validerPlat(req.body);
            if (erreurs.length > 0) return repondreInvalide(res, erreurs);
            await CatalogueModel.modifierPlat(platId, donnees);
            res.json({ message: `Plat « ${donnees.titre} » enregistré.` });
        } catch (err) {
            repondreErreur(res, err, 'modification du plat');
        }
    }

    /** DELETE /api/employe/plats/:id : seulement s'il n'est dans aucun menu (sinon 409) */
    static async supprimerPlat(req, res) {
        try {
            const platId = idValide(req.params.id);
            if (platId === null) return res.status(404).json({ error: 'Plat introuvable.' });
            const titre = await CatalogueModel.supprimerPlat(platId);
            res.json({ message: `Plat « ${titre} » supprimé.` });
        } catch (err) {
            repondreErreur(res, err, 'suppression du plat');
        }
    }
    // -----------------------------------------------------------------
    // Horaires (lecture publique : GET /api/horaires)
    // -----------------------------------------------------------------

    /**
     * PUT /api/employe/horaires  { horaires: [7 jours] }
     * → 200 { message, horaires } (la semaine enregistrée, lundi → dimanche)
     */
    static async modifierHoraires(req, res) {
        try {
            const { donnees, erreurs } = validerHoraires(req.body);
            if (erreurs.length > 0) return repondreInvalide(res, erreurs);
            await CatalogueModel.modifierHoraires(donnees);
            res.json({ message: 'Horaires enregistrés : le pied de page est à jour.', horaires: donnees });
        } catch (err) {
            repondreErreur(res, err, 'modification des horaires');
        }
    }
}

module.exports = CatalogueController;
module.exports.repondreErreur = repondreErreur;
module.exports.repondreInvalide = repondreInvalide;
