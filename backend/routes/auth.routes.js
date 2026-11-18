/* ================================================================
   ROUTES/AUTH.ROUTES.JS
   ================================================================ */
const express      = require('express');
const router       = express.Router();
const AuthController = require('../controllers/auth.controller');
const MotDePasseController = require('../controllers/motDePasse.controller');
const { authRequired } = require('../middleware/auth.middleware');
const { creerLimiteConnexion, creerLimiteDemandeReinitialisation } = require('../config/securite');

// Limitation des tentatives (429 en français au-delà) : voir config/securite.js
const limiteConnexion = creerLimiteConnexion();
const limiteDemandeReinitialisation = creerLimiteDemandeReinitialisation();

router.post('/inscription',          AuthController.inscription);
router.post('/mot-de-passe-oublie',  limiteDemandeReinitialisation, MotDePasseController.demanderReinitialisation);
router.post('/reinitialiser-mot-de-passe/verifier', MotDePasseController.verifierJeton);
router.post('/reinitialiser-mot-de-passe',          MotDePasseController.reinitialiser);
router.post('/connexion',            limiteConnexion, AuthController.connexion);
router.get('/deconnexion',           AuthController.deconnexion);
router.get('/profil',  authRequired, AuthController.profil);
router.put('/profil',  authRequired, AuthController.modifierProfil);

module.exports = router;
