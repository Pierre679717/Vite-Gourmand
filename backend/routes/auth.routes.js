/* ================================================================
   ROUTES/AUTH.ROUTES.JS
   ================================================================ */
const express      = require('express');
const router       = express.Router();
const AuthController = require('../controllers/auth.controller');
const { authRequired } = require('../middleware/auth.middleware');

router.post('/inscription',          AuthController.inscription);
router.post('/connexion',            AuthController.connexion);
router.get('/deconnexion',           AuthController.deconnexion);
router.get('/profil',  authRequired, AuthController.profil);

module.exports = router;
