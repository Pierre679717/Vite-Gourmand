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
const { validerCommande, validerDevis, validerModification, aujourdhuiParis } = require('../utils/validationCommande');
const { enregistrerStatCommande, mettreAJourStatCommande } = require('../models/statCommande.model');
const { genererMailConfirmationCommande } = require('../email/templateCommande');
const { genererMailStatut } = require('../email/templateStatut');
const { transporter, EXPEDITEUR } = require('../email/mailer');
const { idValide, versResumeCommande, versCommandeClient } = require('../utils/commandeClient');
const { STATUTS } = require('../utils/statutsCommande');

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

/**
 * Mail au client après un changement de statut (retour de matériel,
 * commande terminée). Même principe que la confirmation : non bloquant,
 * le statut est déjà enregistré ; un échec est seulement noté dans la console.
 * Renvoie true si un mail est parti (utile aux tests).
 */
async function envoyerMailStatut(commandeId, resultat) {
    const mail = genererMailStatut(resultat.statut, {
        commande_id:     commandeId,
        numero_commande: resultat.numeroCommande,
        contact_prenom:  resultat.contactPrenom
    });
    if (!mail) return false; // pas de mail pour ce statut
    try {
        await transporter.sendMail({ from: EXPEDITEUR, to: resultat.contactEmail, ...mail });
        return true;
    } catch (err) {
        console.error(`Mail « ${resultat.statut} » non envoyé (${resultat.numeroCommande}) :`, err.message);
        return false;
    }
}

// Statuts qu'un employé peut demander ('en_attente' est l'état de départ).
// Le parcours lui-même est vérifié dans le modèle (utils/statutsCommande.js).
const STATUTS_EMPLOYE = STATUTS.filter((statut) => statut !== 'en_attente');
const MODES_CONTACT = ['gsm', 'mail'];
const MOTIF_MIN = 5;
const MOTIF_MAX = 1000;

/**
 * Vérifie le corps de PUT /api/employe/commandes/:id.
 * Renvoie { donnees, erreurs }. mode_contact et motif ne sont lus que
 * pour une annulation : le sujet impose d'avoir contacté le client.
 */
function validerChangementStatut(corps) {
    corps = corps || {};
    const erreurs = [];
    const donnees = { modeContact: null, motif: null };

    if (STATUTS_EMPLOYE.includes(corps.statut)) {
        donnees.statut = corps.statut;
    } else {
        erreurs.push('Statut invalide.');
    }

    if (corps.statut === 'annulee') {
        if (MODES_CONTACT.includes(corps.mode_contact)) {
            donnees.modeContact = corps.mode_contact;
        } else {
            erreurs.push('Indiquez comment le client a été contacté (gsm ou mail).');
        }
        const motif = typeof corps.motif === 'string' ? corps.motif.trim() : '';
        if (motif.length >= MOTIF_MIN && motif.length <= MOTIF_MAX) {
            donnees.motif = motif;
        } else {
            erreurs.push(`Le motif d'annulation est requis (${MOTIF_MIN} à ${MOTIF_MAX} caractères).`);
        }
    }

    return { donnees, erreurs };
}

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
            // Les deux fonctions attrapent leurs propres erreurs.
            envoyerMailConfirmation({ ...commande, contact_prenom: donnees.contactPrenom }, donnees.contactEmail);
            enregistrerStatCommande({
                commande_id:     commandeId,
                numero_commande: numeroCommande,
                menu_id:         menu.menu_id,
                menu_titre:      menu.titre,
                nombre_personne: donnees.nombrePersonne,
                prix_total:      prix.prix_total,
                reduction:       prix.reduction,
                prix_livraison:  prix.prix_livraison,
                ville:           livraison.ville,
                date_prestation: donnees.datePrestation
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
            res.json(commandes.map(versResumeCommande));
        } catch (err) {
            console.error('Erreur mes commandes :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/commandes/:id
     * Détail d'une commande du client connecté, avec l'historique de
     * ses statuts (frise du suivi) et son avis s'il en a donné un.
     * La commande d'un autre client renvoie 404, comme une commande qui
     * n'existe pas : on ne révèle pas qu'elle existe.
     */
    static async detail(req, res) {
        try {
            const commandeId = idValide(req.params.id);
            if (commandeId === null) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }
            const ligne = await CommandeModel.trouverPourClient(commandeId, req.user.id);
            if (!ligne) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }
            const suivi = await CommandeModel.listerSuivi(commandeId);
            res.json(versCommandeClient(ligne, suivi));
        } catch (err) {
            console.error('Erreur détail commande :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * PUT /api/commandes/:id
     * Le client modifie sa commande tant qu'elle est « en attente ».
     * Tout est modifiable sauf le menu. Mêmes étapes que la création :
     * validation, distance AVANT la transaction, puis contrôles et prix
     * recalculé dans la transaction (voir CommandeModel.modifierParClient).
     */
    static async modifier(req, res) {
        try {
            const commandeId = idValide(req.params.id);
            if (commandeId === null) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }

            const aujourdhui = aujourdhuiParis();
            const { donnees, erreurs } = validerModification(req.body, aujourdhui);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }

            const livraison = await calculerDistanceLivraison(donnees.adressePrestation, donnees.villePrestation);
            const donneesModifiees = { ...donnees, villePrestation: livraison.ville };

            const { numeroCommande, menu, prix } = await CommandeModel.modifierParClient(
                { commandeId, utilisateurId: req.user.id, donnees: donneesModifiees, aujourdhui },
                (menuVerrouille) => calculerPrixCommande({
                    prixParPersonne:   menuVerrouille.prix_par_personne,
                    nombrePersonneMin: menuVerrouille.nombre_personne_min,
                    nombrePersonne:    donnees.nombrePersonne,
                    ville:             livraison.ville,
                    distanceKm:        livraison.distance_km
                })
            );

            // Non bloquant : la statistique suit la commande modifiée
            mettreAJourStatCommande(commandeId, {
                nombre_personne: donnees.nombrePersonne,
                prix_total:      prix.prix_total,
                reduction:       prix.reduction,
                prix_livraison:  prix.prix_livraison,
                ville:           livraison.ville,
                date_prestation: donnees.datePrestation
            });

            res.json({
                message: 'Commande modifiée.',
                commande: {
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
                }
            });

        } catch (err) {
            if (err instanceof ErreurCommande || err instanceof ErreurDistance) {
                return res.status(err.status).json({ error: err.message });
            }
            console.error('Erreur modification commande :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/commandes/:id/annulation
     * Le client annule sa commande tant qu'elle est « en attente ».
     * POST et non DELETE : rien n'est supprimé, la commande passe au
     * statut « annulee » (voir CommandeModel.annulerParClient).
     */
    static async annuler(req, res) {
        try {
            const commandeId = idValide(req.params.id);
            if (commandeId === null) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }

            const numeroCommande = await CommandeModel.annulerParClient(commandeId, req.user.id);

            // Non bloquant : les commandes annulées sont exclues du chiffre d'affaires
            mettreAJourStatCommande(commandeId, { statut: 'annulee' });

            res.json({ message: `Commande ${numeroCommande} annulée.`, numero_commande: numeroCommande, statut: 'annulee' });

        } catch (err) {
            if (err instanceof ErreurCommande) {
                return res.status(err.status).json({ error: err.message });
            }
            console.error('Erreur annulation commande :', err);
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
     * Faire avancer une commande d'une étape, ou l'annuler.
     * Pour une annulation, le sujet impose de contacter le client
     * avant : on exige le mode de contact (gsm / mail) et le motif.
     * Corps : { statut, mode_contact?, motif? } -> 200 { message, numero_commande, statut }
     * 400 corps invalide, 404 commande inconnue, 409 étape non permise.
     */
    static async mettreAJourStatut(req, res) {
        try {
            const commandeId = idValide(req.params.id);
            if (commandeId === null) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }
            const { donnees, erreurs } = validerChangementStatut(req.body);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }

            const resultat = await CommandeModel.changerStatut({
                commandeId,
                statut:      donnees.statut,
                employeId:   req.user.id,
                modeContact: donnees.modeContact,
                motif:       donnees.motif
            });

            // Non bloquant : MySQL fait foi, MongoDB sert aux statistiques
            mettreAJourStatCommande(commandeId, { statut: resultat.statut });
            // Sans await : la réponse n'attend pas le serveur de mail
            envoyerMailStatut(commandeId, resultat);

            res.json({
                message: `Commande ${resultat.numeroCommande} : statut mis à jour.`,
                numero_commande: resultat.numeroCommande,
                statut: resultat.statut
            });
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
module.exports.validerChangementStatut = validerChangementStatut;
module.exports.envoyerMailStatut = envoyerMailStatut;
