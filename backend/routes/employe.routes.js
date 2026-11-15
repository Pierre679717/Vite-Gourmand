/* ================================================================
   ROUTES/EMPLOYE.ROUTES.JS
   ================================================================ */
const express              = require('express');
const router               = express.Router();
const CommandeController   = require('../controllers/commande.controller');
const CatalogueController  = require('../controllers/catalogue.controller');
const AvisController       = require('../controllers/avis.controller');
const { employeRequired }  = require('../middleware/auth.middleware');

router.get('/commandes',        employeRequired, CommandeController.toutesCommandes);
router.get('/commandes/:id',    employeRequired, CommandeController.detailEmploye);
router.put('/commandes/:id',    employeRequired, CommandeController.mettreAJourStatut);
router.get('/avis',             employeRequired, AvisController.listerPourModeration);
router.put('/avis/:id',         employeRequired, AvisController.moderer);

// Catalogue : menus (options déclarée avant '/:id', sinon « options » serait pris pour un id)
router.get('/menus',             employeRequired, CatalogueController.listerMenus);
router.get('/menus/options',     employeRequired, CatalogueController.optionsMenus);
router.get('/menus/:id',         employeRequired, CatalogueController.detailMenu);
router.post('/menus',            employeRequired, CatalogueController.creerMenu);
router.put('/menus/:id',         employeRequired, CatalogueController.modifierMenu);
router.put('/menus/:id/carte',   employeRequired, CatalogueController.changerCarte);
router.delete('/menus/:id',      employeRequired, CatalogueController.supprimerMenu);

// Catalogue : plats et allergènes
router.get('/allergenes',        employeRequired, CatalogueController.listerAllergenes);
router.get('/plats',             employeRequired, CatalogueController.listerPlats);
router.get('/plats/:id',         employeRequired, CatalogueController.detailPlat);
router.post('/plats',            employeRequired, CatalogueController.creerPlat);
router.put('/plats/:id',         employeRequired, CatalogueController.modifierPlat);
router.delete('/plats/:id',      employeRequired, CatalogueController.supprimerPlat);

module.exports = router;
