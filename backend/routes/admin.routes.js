/* ================================================================
   ROUTES/ADMIN.ROUTES.JS
   ================================================================ */
const express           = require('express');
const router            = express.Router();
const AdminController   = require('../controllers/admin.controller');
const CommandeController = require('../controllers/commande.controller');
const { adminRequired } = require('../middleware/auth.middleware');

router.get('/stats',      adminRequired, AdminController.statistiques);
router.get('/commandes',  adminRequired, CommandeController.toutesCommandes);
router.get('/employes',   adminRequired, AdminController.listerEmployes);
router.post('/employes',  adminRequired, AdminController.creerEmploye);

module.exports = router;
