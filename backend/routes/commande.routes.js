/* ================================================================
   ROUTES/COMMANDE.ROUTES.JS
   ================================================================ */
const express             = require('express');
const router              = express.Router();
const CommandeController  = require('../controllers/commande.controller');
const { authRequired }    = require('../middleware/auth.middleware');

// Devis : calcul du prix sans enregistrer (récapitulatif avant validation)
router.post('/devis', authRequired, CommandeController.devis);
router.post('/',      authRequired, CommandeController.creer);
router.get('/',       authRequired, CommandeController.mesCommandes);
router.get('/:id',    authRequired, CommandeController.detail);
router.put('/:id',    authRequired, CommandeController.modifier);
// Annuler = changer le statut (la commande reste dans l'historique), pas supprimer
router.post('/:id/annulation', authRequired, CommandeController.annuler);

module.exports = router;
