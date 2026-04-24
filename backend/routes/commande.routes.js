/* ================================================================
   ROUTES/COMMANDE.ROUTES.JS
   ================================================================ */
const express             = require('express');
const router              = express.Router();
const CommandeController  = require('../controllers/commande.controller');
const { authRequired }    = require('../middleware/auth.middleware');

router.post('/', authRequired, CommandeController.creer);
router.get('/',  authRequired, CommandeController.mesCommandes);

module.exports = router;
