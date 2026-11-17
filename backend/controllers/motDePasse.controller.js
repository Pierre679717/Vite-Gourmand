/* ================================================================
   CONTROLLERS/MOTDEPASSE.CONTROLLER.JS
   Mot de passe oublié
   ================================================================
   POST /api/mot-de-passe-oublie { email }
   - La réponse est TOUJOURS la même (MESSAGE_DEMANDE), que l'adresse
     corresponde à un compte ou non : un visiteur ne peut pas s'en
     servir pour savoir qui est client.
   - Le jeton et le mail sont traités APRÈS la réponse (sans await) :
     le temps de réponse ne trahit pas non plus l'existence du compte.
   - Compte désactivé : aucun mail (même règle qu'à la connexion).
   ================================================================ */

const UtilisateurModel = require('../models/utilisateur.model');
const TokenReinitialisationModel = require('../models/tokenReinitialisation.model');
const { transporter, EXPEDITEUR } = require('../email/mailer');
const { SITE } = require('../email/templates');
const { genererMailReinitialisation } = require('../email/templateReinitialisation');
const {
    DUREE_VALIDITE_MINUTES, MESSAGE_DEMANDE, genererJeton, validerDemande
} = require('../utils/jetonReinitialisation');

/** Adresse de la page Angular « Nouveau mot de passe » pour un jeton */
function lienReinitialisation(jeton) {
    return `${SITE}/nouveau-mot-de-passe?token=${encodeURIComponent(jeton)}`;
}

/**
 * Crée le jeton et envoie le mail, pour un compte actif.
 * Ne lève jamais d'erreur : la réponse est déjà partie, on journalise.
 * Renvoie true si le mail a été envoyé (utile aux tests).
 */
async function envoyerLienReinitialisation(user) {
    try {
        const { jeton, empreinte } = genererJeton();
        await TokenReinitialisationModel.creer(user.utilisateur_id, empreinte, DUREE_VALIDITE_MINUTES);

        const mail = genererMailReinitialisation({
            prenom: user.prenom,
            lien: lienReinitialisation(jeton),
            minutes: DUREE_VALIDITE_MINUTES
        });
        await transporter.sendMail({ from: EXPEDITEUR, to: user.email, ...mail });
        return true;
    } catch (err) {
        console.error('Lien de réinitialisation non envoyé :', err.message);
        return false;
    }
}

class MotDePasseController {

    /**
     * POST /api/mot-de-passe-oublie
     * Renvoie la promesse du traitement en arrière-plan (Express l'ignore,
     * les tests peuvent l'attendre).
     */
    static async demanderReinitialisation(req, res) {
        const { email, erreur } = validerDemande(req.body);
        if (erreur) {
            return res.status(400).json({ error: erreur });
        }

        let user;
        try {
            user = await UtilisateurModel.trouverParEmail(email);
        } catch (err) {
            console.error('Erreur demande de réinitialisation :', err.message);
            return res.status(500).json({ error: 'Erreur serveur.' });
        }

        // Même réponse dans tous les cas, envoyée AVANT le traitement
        res.json({ message: MESSAGE_DEMANDE });

        if (user && user.actif) {
            return envoyerLienReinitialisation(user);
        }
        return false;
    }
}

module.exports = MotDePasseController;
module.exports.lienReinitialisation = lienReinitialisation;
module.exports.envoyerLienReinitialisation = envoyerLienReinitialisation;
