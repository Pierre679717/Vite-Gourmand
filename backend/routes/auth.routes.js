/* ================================================================
   ROUTES/AUTH.ROUTES.JS
   ================================================================ */
const express      = require('express');
const router       = express.Router();
const AuthController = require('../controllers/auth.controller');
const MotDePasseController = require('../controllers/motDePasse.controller');
const { authRequired } = require('../middleware/auth.middleware');

router.post('/inscription',          AuthController.inscription);
router.post('/mot-de-passe-oublie',  MotDePasseController.demanderReinitialisation);
router.post('/reinitialiser-mot-de-passe/verifier', MotDePasseController.verifierJeton);
router.post('/reinitialiser-mot-de-passe',          MotDePasseController.reinitialiser);
router.post('/connexion',            AuthController.connexion);
router.get('/deconnexion',           AuthController.deconnexion);
router.get('/profil',  authRequired, AuthController.profil);
router.put('/profil',  authRequired, AuthController.modifierProfil);

module.exports = router;
