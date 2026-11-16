/* ================================================================
   CONTROLLERS/ADMIN.CONTROLLER.JS
   Espace administrateur : comptes employés et statistiques
   ================================================================
   Toutes ces routes passent par adminRequired (routes/admin.routes.js).
   L'administrateur a aussi accès à toutes les routes /api/employe.
   ================================================================ */

const bcrypt = require('bcrypt');
const UtilisateurModel = require('../models/utilisateur.model');
const { statistiquesParMenu } = require('../models/statCommande.model');
const { validerFiltresStats, totaliser } = require('../utils/filtresStats');
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

    /**
     * GET /api/admin/statistiques?menu_id=&debut=AAAA-MM-JJ&fin=AAAA-MM-JJ
     * Lu dans MongoDB (collection commandes_stats), comme l'exige le sujet :
     * nombre de commandes par menu (graphique) et chiffre d'affaires par
     * menu, commandes annulées exclues. Filtres facultatifs.
     */
    static async statistiques(req, res) {
        try {
            const { filtres, erreur } = validerFiltresStats(req.query);
            if (erreur) {
                return res.status(400).json({ error: erreur });
            }
            const lignes = await statistiquesParMenu(filtres);
            if (lignes === null) {
                return res.status(503).json({ error: 'Statistiques indisponibles : la base MongoDB n\'est pas connectée.' });
            }
            res.json({
                filtres: { menu_id: filtres.menuId, debut: filtres.debut, fin: filtres.fin },
                menus: lignes,
                totaux: totaliser(lignes)
            });
        } catch (err) {
            console.error('Erreur statistiques MongoDB :', err.message);
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
