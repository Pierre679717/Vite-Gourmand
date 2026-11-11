/* ================================================================
   CONTROLLERS/COMMANDE.CONTROLLER.JS
   Logique métier pour les commandes
   (Couche Controller du pattern MVC)
   ================================================================
   Règle de sécurité : le prix n'est JAMAIS lu dans req.body.
   Le serveur le recalcule à partir du menu en base, sinon un client
   pourrait envoyer "prix_total: 1" depuis la console du navigateur.
   ================================================================ */

const { CommandeModel, ErreurCommande } = require('../models/commande.model');
const MenuModel = require('../models/menu.model');
const { calculerPrixCommande, PERSONNES_EN_PLUS } = require('../utils/prix');
const { calculerDistanceLivraison, ErreurDistance } = require('../utils/distance');
const { validerCommande, validerDevis, aujourdhuiParis } = require('../utils/validationCommande');
const { sauvegarderStat } = require('../config/db.mongo');
const { genererMailConfirmationCommande } = require('../email/templateCommande');
const { transporter, EXPEDITEUR } = require('../email/mailer');

/**
 * Envoie le mail de confirmation sans bloquer la réponse :
 * la commande est déjà enregistrée, un serveur de mail lent ou en panne
 * ne doit pas faire croire au client que sa commande a échoué.
 */
async function envoyerMailConfirmation(commande, destinataire) {
    try {
        const mail = genererMailConfirmationCommande(commande);
        await transporter.sendMail({ from: EXPEDITEUR, to: destinataire, ...mail });
    } catch (err) {
        console.error(`Mail de confirmation non envoyé (${commande.numero_commande}) :`, err.message);
    }
}

// Statuts qu'un employé peut appliquer ('en_attente' est l'état de départ)
const STATUTS_EMPLOYE = [
    'accepte',
    'en_preparation',
    'en_cours_livraison',
    'livre',
    'attente_retour_materiel',
    'terminee',
    'annulee'
];
const MODES_CONTACT = ['gsm', 'mail'];

class CommandeController {

    /**
     * POST /api/commandes/devis
     * Calcule le prix d'une commande SANS l'enregistrer, pour le
     * récapitulatif affiché avant validation.
     * Le navigateur ne connaît pas la distance (calculée ici, via l'API
     * de géocodage) : il demande donc le détail du prix au serveur.
     * Rien n'est verrouillé ni modifié. Au moment de valider, POST
     * /api/commandes refait tout le calcul : le devis n'engage à rien.
     */
    static async devis(req, res) {
        try {
            const { donnees, erreurs } = validerDevis(req.body);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }

            const menu = await MenuModel.trouverPourCommande(donnees.menuId, undefined, { verrouiller: false });
            if (!menu) {
                return res.status(404).json({ error: 'Menu introuvable.' });
            }
            if (donnees.nombrePersonne < menu.nombre_personne_min) {
                return res.status(400).json({ error: `Minimum ${menu.nombre_personne_min} personnes pour ce menu.` });
            }
            if (menu.quantite_restante < 1) {
                return res.status(409).json({ error: 'Ce menu n\'est plus disponible (stock épuisé).' });
            }

            const livraison = await calculerDistanceLivraison(donnees.adressePrestation, donnees.villePrestation);
            const prix = calculerPrixCommande({
                prixParPersonne:   menu.prix_par_personne,
                nombrePersonneMin: menu.nombre_personne_min,
                nombrePersonne:    donnees.nombrePersonne,
                ville:             livraison.ville,
                distanceKm:        livraison.distance_km
            });

            res.json({
                menu: {
                    menu_id:             menu.menu_id,
                    titre:               menu.titre,
                    nombre_personne_min: menu.nombre_personne_min,
                    delai_minimum_jours: menu.delai_minimum_jours
                },
                nombre_personne: donnees.nombrePersonne,
                // Pour afficher « réduction de 10 % à partir de N personnes »
                personnes_pour_reduction: menu.nombre_personne_min + PERSONNES_EN_PLUS,
                livraison: {
                    adresse_trouvee: livraison.adresse_trouvee,
                    ville:           livraison.ville,
                    code_postal:     livraison.code_postal,
                    est_bordeaux:    livraison.est_bordeaux
                },
                ...prix
            });

        } catch (err) {
            if (err instanceof ErreurDistance) {
                return res.status(err.status).json({ error: err.message });
            }
            console.error('Erreur devis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/commandes
     * Passer une nouvelle commande (client connecté uniquement).
     *
     * Ordre des étapes :
     *  1. valider les champs reçus (utils/validationCommande.js) ;
     *  2. calculer la distance via l'API de géocodage, AVANT d'ouvrir la
     *     transaction : un appel réseau peut prendre plusieurs secondes,
     *     on ne garde pas le menu verrouillé pendant ce temps ;
     *  3. transaction : minimum de personnes, stock, délai du menu, prix
     *     recalculé, insertion, suivi, stock décrémenté.
     */
    static async creer(req, res) {
        try {
            // Les comptes employé et administrateur ne passent pas de commande
            if (req.user.role !== 'utilisateur') {
                return res.status(403).json({ error: 'Seuls les clients peuvent passer commande.' });
            }

            // --- 1. Validation (les champs inattendus sont ignorés) ---
            const aujourdhui = aujourdhuiParis();
            const { donnees, erreurs } = validerCommande(req.body, aujourdhui);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }

            // --- 2. Distance calculée par le serveur (jamais lue dans la requête) ---
            const livraison = await calculerDistanceLivraison(donnees.adressePrestation, donnees.villePrestation);

            // --- 3. Création en transaction (le modèle vérifie minimum, stock et délai) ---
            const { commandeId, numeroCommande, menu, prix } = await CommandeModel.creer(
                {
                    ...donnees,
                    villePrestation: livraison.ville,   // ville officielle renvoyée par l'API
                    utilisateurId:   req.user.id,
                    aujourdhui
                },
                (menuVerrouille) => calculerPrixCommande({
                    prixParPersonne:   menuVerrouille.prix_par_personne,
                    nombrePersonneMin: menuVerrouille.nombre_personne_min,
                    nombrePersonne:    donnees.nombrePersonne,
                    ville:             livraison.ville,
                    distanceKm:        livraison.distance_km
                })
            );

            const commande = {
                commande_id:        commandeId,
                numero_commande:    numeroCommande,
                menu:               menu.titre,
                nombre_personne:    donnees.nombrePersonne,
                date_prestation:    donnees.datePrestation,
                heure_livraison:    donnees.heureLivraison,
                adresse_prestation: donnees.adressePrestation,
                ville_prestation:   livraison.ville,
                pret_materiel:      donnees.pretMateriel,
                ...prix
            };

            // Lancés sans « await » : la réponse part tout de suite.
            // Les fonctions attrapent leurs propres erreurs.
            envoyerMailConfirmation({ ...commande, contact_prenom: donnees.contactPrenom }, donnees.contactEmail);
            sauvegarderStat('commande', {
                menu_id: menu.menu_id, prix_total: prix.prix_total, personnes: donnees.nombrePersonne
            });

            res.status(201).json({ message: 'Commande enregistrée !', commande });

        } catch (err) {
            if (err instanceof ErreurCommande || err instanceof ErreurDistance) {
                return res.status(err.status).json({ error: err.message });
            }
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
            const commandes = await CommandeModel.listerParClient(req.user.id);
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
     * Modifier le statut d'une commande.
     * Pour une annulation, le sujet impose de contacter le client
     * avant : on exige le mode de contact (gsm / mail) et le motif.
     */
    static async mettreAJourStatut(req, res) {
        try {
            const { statut, mode_contact, motif } = req.body;

            if (!STATUTS_EMPLOYE.includes(statut)) {
                return res.status(400).json({ error: 'Statut invalide.' });
            }
            if (statut === 'annulee' && (!MODES_CONTACT.includes(mode_contact) || !motif)) {
                return res.status(400).json({ error: 'Pour annuler, indiquez le mode de contact (gsm ou mail) et le motif.' });
            }

            await CommandeModel.changerStatut({
                commandeId:  req.params.id,
                statut,
                employeId:   req.user.id,
                modeContact: statut === 'annulee' ? mode_contact : null,
                motif:       statut === 'annulee' ? motif : null
            });
            res.json({ message: 'Statut mis à jour.' });
        } catch (err) {
            if (err instanceof ErreurCommande) {
                return res.status(err.status).json({ error: err.message });
            }
            console.error('Erreur mise à jour statut :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = CommandeController;
