/* ================================================================
   ROUTES/MENU.ROUTES.JS
   ================================================================ */
const express         = require('express');
const router          = express.Router();
const MenuController  = require('../controllers/menu.controller');

router.get('/',        MenuController.lister);
// Avant '/:id' : sinon Express prendrait « filtres » pour un identifiant
router.get('/filtres', MenuController.optionsFiltres);
router.get('/:id',     MenuController.detail);

module.exports = router;
