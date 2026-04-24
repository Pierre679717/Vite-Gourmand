/* ================================================================
   CONTROLLERS/COMMANDE.CONTROLLER.JS
   Logique métier pour les commandes
   (Couche Controller du pattern MVC)
   ================================================================ */

const CommandeModel = require('../models/commande.model');
const MenuModel     = require('../models/menu.model');
const { sauvegarderStat } = require('../config/db.mongo');

const STATUTS_VALIDES = ['en_attente', 'confirmee', 'en_cours', 'livree', 'annulee'];

class CommandeController {

    /**
     * POST /api/commandes
     * Passer une nouvelle commande
     * Règle métier : réduction 10% si plus de 5 personnes
     */
    static async creer(req, res) {
        try {
            const { menu_id, nombre_personnes, date_evenement, adresse_livraison, commentaire } = req.body;

            if (!menu_id || !nombre_personnes) {
                return res.status(400).json({ error: 'Menu et nombre de personnes requis.' });
            }

            // Vérifier que le menu existe
            const resultat = await MenuModel.trouverParId(menu_id);
            if (!resultat) {
                return res.status(404).json({ error: 'Menu non trouvé.' });
            }

            const menu = resultat.menu;

            // Vérifier le minimum de personnes
            if (nombre_personnes < menu.minimum_personnes) {
                return res.status(400).json({ error: `Minimum ${menu.minimum_personnes} personnes pour ce menu.` });
            }

            // Calcul du prix avec réduction éventuelle
            const prixUnitaire = parseFloat(menu.prix);
            let reduction = 0;
            let prixTotal = prixUnitaire * nombre_personnes;

            if (nombre_personnes > 5) {
                reduction = 10;
                prixTotal = prixTotal * 0.9;
            }

            const id = await CommandeModel.creer({
                utilisateurId: req.session.user.id,
                menuId: menu_id,
                nombrePersonnes: nombre_personnes,
                prixUnitaire,
                reduction,
                prixTotal,
                dateEvenement: date_evenement,
                adresseLivraison: adresse_livraison,
                commentaire
            });

            await sauvegarderStat('commande', { menu_id, prix_total: prixTotal, personnes: nombre_personnes });

            res.status(201).json({
                message: 'Commande enregistrée !',
                commande: {
                    id,
                    menu: menu.nom,
                    nombre_personnes,
                    prix_unitaire: prixUnitaire,
                    reduction: reduction + '%',
                    prix_total: prixTotal.toFixed(2) + ' €'
                }
            });

        } catch (err) {
            console.error('Erreur commande :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/commandes
     * Récupérer les commandes du client connecté
     */
    static async mesCommandes(req, res) {
        try {
            const commandes = await CommandeModel.listerParClient(req.session.user.id);
            res.json(commandes);
        } catch (err) {
            console.error('Erreur mes commandes :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/employe/commandes ou /api/admin/commandes
     * Récupérer toutes les commandes
     */
    static async toutesCommandes(req, res) {
        try {
            const commandes = await CommandeModel.listerToutes();
            res.json(commandes);
        } catch (err) {
            console.error('Erreur toutes commandes :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * PUT /api/employe/commandes/:id
     * Modifier le statut d'une commande
     */
    static async mettreAJourStatut(req, res) {
        try {
            const { statut } = req.body;

            if (!STATUTS_VALIDES.includes(statut)) {
                return res.status(400).json({ error: 'Statut invalide.' });
            }

            await CommandeModel.mettreAJourStatut(req.params.id, statut);
            res.json({ message: 'Statut mis à jour.' });
        } catch (err) {
            console.error('Erreur mise à jour statut :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = CommandeController;
