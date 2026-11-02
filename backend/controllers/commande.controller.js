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
const { calculerPrixCommande, estBordeaux } = require('../utils/prix');
const { sauvegarderStat } = require('../config/db.mongo');

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

const REGEX_DATE  = /^\d{4}-\d{2}-\d{2}$/;      // 2026-11-21
const REGEX_HEURE = /^\d{2}:\d{2}(:\d{2})?$/;   // 12:30 ou 12:30:00

class CommandeController {

    /**
     * POST /api/commandes
     * Passer une nouvelle commande
     */
    static async creer(req, res) {
        try {
            const {
                menu_id, nombre_personne, date_prestation, heure_livraison,
                adresse_prestation, ville_prestation, distance_km, pret_materiel
            } = req.body;

            // --- Validation des données reçues ---
            if (!menu_id || !date_prestation || !heure_livraison || !adresse_prestation || !ville_prestation) {
                return res.status(400).json({ error: 'Menu, date, heure, adresse et ville de la prestation sont requis.' });
            }
            if (!Number.isInteger(nombre_personne) || nombre_personne < 1) {
                return res.status(400).json({ error: 'Le nombre de personnes doit être un entier positif.' });
            }
            if (!REGEX_DATE.test(date_prestation) || !REGEX_HEURE.test(heure_livraison)) {
                return res.status(400).json({ error: 'Date (AAAA-MM-JJ) ou heure (HH:MM) invalide.' });
            }
            const aujourdHui = new Date().toISOString().slice(0, 10);
            if (date_prestation <= aujourdHui) {
                return res.status(400).json({ error: 'La date de prestation doit être dans le futur.' });
            }
            // Hors Bordeaux, la distance est nécessaire au calcul de la livraison.
            // (Elle sera calculée côté serveur via l'API Adresse dans une étape suivante.)
            const distanceValide = typeof distance_km === 'number' && Number.isFinite(distance_km) && distance_km >= 0;
            if (!estBordeaux(ville_prestation) && !distanceValide) {
                return res.status(400).json({ error: 'La distance (en km) est requise pour une livraison hors de Bordeaux.' });
            }

            // --- Création en transaction (le modèle vérifie minimum et stock) ---
            const { commandeId, numeroCommande, menu, prix } = await CommandeModel.creer(
                {
                    utilisateurId:     req.user.id,
                    menuId:            menu_id,
                    nombrePersonne:    nombre_personne,
                    datePrestation:    date_prestation,
                    heureLivraison:    heure_livraison,
                    adressePrestation: adresse_prestation,
                    villePrestation:   ville_prestation.trim(),
                    pretMateriel:      pret_materiel === true
                },
                (menuVerrouille) => calculerPrixCommande({
                    prixParPersonne:   menuVerrouille.prix_par_personne,
                    nombrePersonneMin: menuVerrouille.nombre_personne_min,
                    nombrePersonne:    nombre_personne,
                    ville:             ville_prestation,
                    distanceKm:        distance_km
                })
            );

            await sauvegarderStat('commande', { menu_id, prix_total: prix.prix_total, personnes: nombre_personne });

            res.status(201).json({
                message: 'Commande enregistrée !',
                commande: {
                    commande_id:     commandeId,
                    numero_commande: numeroCommande,
                    menu:            menu.titre,
                    nombre_personne,
                    ...prix
                }
            });

        } catch (err) {
            if (err instanceof ErreurCommande) {
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
