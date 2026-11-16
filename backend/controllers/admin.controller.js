/* ================================================================
   CONTROLLERS/ADMIN.CONTROLLER.JS
   Espace administrateur : comptes employés et statistiques
   ================================================================
   Toutes ces routes passent par adminRequired (routes/admin.routes.js).
   L'administrateur a aussi accès à toutes les routes /api/employe.
   ================================================================ */

const bcrypt = require('bcrypt');
const UtilisateurModel = require('../models/utilisateur.model');
const { CommandeModel } = require('../models/commande.model');
const MenuModel        = require('../models/menu.model');
const { pool }         = require('../config/db.mysql');
const { getStatModel } = require('../config/db.mongo');
const { validerCompteEmploye } = require('../utils/validationEmploye');
const { genererMailCompteEmploye } = require('../email/templateCompteEmploye');
const { transporter, EXPEDITEUR } = require('../email/mailer');
const { idValide } = require('../utils/commandeClient');

const MESSAGE_EMAIL_PRIS = 'Cet e-mail est déjà utilisé par un autre compte.';

/**
 * Envoie le mail « votre compte a été créé » (sans le mot de passe).
 * Appelée SANS await : le compte est créé même si le serveur de mail
 * refuse l'envoi (panne, limite Mailtrap) ; l'erreur est notée en console.
 * Renvoie true si le mail est parti, false sinon (utile aux tests).
 */
async function envoyerMailCompteEmploye(employe) {
    try {
        const mail = genererMailCompteEmploye({ prenom: employe.prenom, email: employe.email });
        await transporter.sendMail({ from: EXPEDITEUR, to: employe.email, ...mail });
        return true;
    } catch (err) {
        console.error(`Mail « compte employé » non envoyé (${employe.email}) :`, err.message);
        return false;
    }
}

class AdminController {

    static async statistiques(req, res) {
        try {
            const totalClients   = await UtilisateurModel.compterClients();
            const statsCommandes = await CommandeModel.statistiques();
            const totalMenus     = await MenuModel.compterActifs();
            // Moyenne calculée sur les avis validés seulement (ceux affichés au public)
            const [moyenneAvis]  = await pool.query(
                "SELECT AVG(note) AS moyenne FROM avis WHERE statut = 'valide'"
            );

            let mongoStats = null;
            const StatModel = getStatModel();
            if (StatModel) {
                mongoStats = {
                    visites:   await StatModel.countDocuments({ type: 'visite' }),
                    commandes: await StatModel.countDocuments({ type: 'commande' })
                };
            }

            res.json({
                utilisateurs:    totalClients,
                commandes:       statsCommandes.total,
                chiffre_affaires: statsCommandes.chiffreAffaires,
                menus_actifs:    totalMenus,
                note_moyenne:    moyenneAvis[0].moyenne ? parseFloat(moyenneAvis[0].moyenne).toFixed(1) : 'N/A',
                mongodb_stats:   mongoStats
            });
        } catch (err) {
            console.error('Erreur stats :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/admin/employes
     * Tous les comptes employés, actifs et désactivés (jamais le mot de passe).
     */
    static async listerEmployes(req, res) {
        try {
            const employes = await UtilisateurModel.listerEmployes();
            res.json(employes);
        } catch (err) {
            console.error('Erreur liste employés :', err.message);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/admin/employes  { nom, prenom, email, mot_de_passe }
     * - mêmes règles que l'inscription (utils/validationEmploye.js) ;
     * - le rôle est écrit en dur : 'employe'. Il n'est jamais lu dans la
     *   requête : aucune route ne permet de créer un administrateur ;
     * - 409 si l'e-mail (identifiant de connexion) existe déjà ;
     * - mail sans le mot de passe, envoyé sans bloquer la réponse.
     */
    static async creerEmploye(req, res) {
        try {
            const { donnees, motDePasse, erreurs } = validerCompteEmploye(req.body);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }

            if (await UtilisateurModel.emailExiste(donnees.email)) {
                return res.status(409).json({ error: MESSAGE_EMAIL_PRIS });
            }

            const motDePasseHash = await bcrypt.hash(motDePasse, 10);
            // Téléphone et adresse restent NULL : ils ne sont pas demandés pour un employé
            const id = await UtilisateurModel.creer({ ...donnees, motDePasseHash, role: 'employe' });

            const employe = { utilisateur_id: id, ...donnees, actif: 1 };
            envoyerMailCompteEmploye(employe); // sans await : non bloquant

            res.status(201).json({
                message: `Compte de ${donnees.prenom} ${donnees.nom} créé. Un mail lui a été envoyé, sans le mot de passe.`,
                employe
            });
        } catch (err) {
            // Deux créations simultanées avec le même e-mail : la contrainte UNIQUE refuse la seconde
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: MESSAGE_EMAIL_PRIS });
            }
            console.error('Erreur création employé :', err.message);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * PUT /api/admin/employes/:id/actif  { actif: true | false }
     * Rendre un compte employé inutilisable (départ de l'entreprise),
     * ou le réactiver. Rien n'est supprimé : les commandes que l'employé
     * a fait avancer gardent leur historique (suivi_commande).
     * - jamais sur son propre compte (403) ;
     * - jamais sur un administrateur ni sur un client (403) ;
     * - l'effet est immédiat : le middleware relit le compte à chaque
     *   requête (voir middleware/auth.middleware.js).
     */
    static async changerActifEmploye(req, res) {
        try {
            const id = idValide(req.params.id);
            if (id === null) {
                return res.status(404).json({ error: 'Employé introuvable.' });
            }
            const actif = req.body ? req.body.actif : undefined;
            if (typeof actif !== 'boolean') {
                return res.status(400).json({ error: 'Indiquez actif : true ou false.' });
            }
            if (id === req.user.id) {
                return res.status(403).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
            }

            const compte = await UtilisateurModel.trouverParId(id);
            if (!compte) {
                return res.status(404).json({ error: 'Employé introuvable.' });
            }
            if (compte.role !== 'employe') {
                return res.status(403).json({ error: 'Seuls les comptes employés peuvent être désactivés ou réactivés.' });
            }

            await UtilisateurModel.changerActifEmploye(id, actif);

            const nomComplet = `${compte.prenom} ${compte.nom}`;
            res.json({
                message: actif
                    ? `Le compte de ${nomComplet} est réactivé : il peut de nouveau se connecter.`
                    : `Le compte de ${nomComplet} est désactivé : il ne peut plus se connecter.`,
                employe: {
                    utilisateur_id: compte.utilisateur_id, nom: compte.nom, prenom: compte.prenom,
                    email: compte.email, actif: actif ? 1 : 0
                }
            });
        } catch (err) {
            console.error('Erreur activation employé :', err.message);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AdminController;
module.exports.envoyerMailCompteEmploye = envoyerMailCompteEmploye;
