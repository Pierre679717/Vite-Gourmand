/* ================================================================
   ROUTES/EMPLOYE.ROUTES.JS
   ================================================================ */
const express              = require('express');
const router               = express.Router();
const CommandeController   = require('../controllers/commande.controller');
const MenuController       = require('../controllers/menu.controller');
const { employeRequired }  = require('../middleware/auth.middleware');

router.get('/commandes',        employeRequired, CommandeController.toutesCommandes);
router.get('/commandes/:id',    employeRequired, CommandeController.detailEmploye);
router.put('/commandes/:id',    employeRequired, CommandeController.mettreAJourStatut);
router.post('/menus',           employeRequired, MenuController.creer);

module.exports = router;
