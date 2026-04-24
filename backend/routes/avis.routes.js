/* ================================================================
   ROUTES/AVIS.ROUTES.JS
   ================================================================ */
const express          = require('express');
const router           = express.Router();
const AvisController   = require('../controllers/avis.controller');
const { authRequired } = require('../middleware/auth.middleware');

router.post('/', authRequired, AvisController.creer);
router.get('/',               AvisController.lister);

module.exports = router;
