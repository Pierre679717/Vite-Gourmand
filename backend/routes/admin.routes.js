/* ================================================================
   ROUTES/ADMIN.ROUTES.JS
   ================================================================ */
const express           = require('express');
const router            = express.Router();
const AdminController   = require('../controllers/admin.controller');
const CommandeController = require('../controllers/commande.controller');
const { adminRequired } = require('../middleware/auth.middleware');

router.get('/statistiques', adminRequired, AdminController.statistiques); // MongoDB
router.get('/commandes',  adminRequired, CommandeController.toutesCommandes);
router.get('/employes',   adminRequired, AdminController.listerEmployes);
router.post('/employes',  adminRequired, AdminController.creerEmploye);
router.put('/employes/:id/actif', adminRequired, AdminController.changerActifEmploye);

module.exports = router;
