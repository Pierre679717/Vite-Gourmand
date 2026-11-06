/* ================================================================
   ROUTES/HORAIRE.ROUTES.JS
   ================================================================ */
const express           = require('express');
const router            = express.Router();
const HoraireController = require('../controllers/horaire.controller');

router.get('/', HoraireController.lister);

module.exports = router;
