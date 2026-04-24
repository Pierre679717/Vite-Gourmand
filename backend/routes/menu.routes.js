/* ================================================================
   ROUTES/MENU.ROUTES.JS
   ================================================================ */
const express         = require('express');
const router          = express.Router();
const MenuController  = require('../controllers/menu.controller');

router.get('/',    MenuController.lister);
router.get('/:id', MenuController.detail);

module.exports = router;
