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

   POST /api/reinitialiser-mot-de-passe/verifier { token }
   - Dit si le lien est encore utilisable, sans rien modifier : la page
     Angular affiche « lien expiré » dès son ouverture.

   POST /api/reinitialiser-mot-de-passe { token, mot_de_passe }
   - Jeton à usage unique et non expiré, mêmes règles de mot de passe
     qu'à l'inscription, hachage bcrypt, transaction (voir le modèle).
   - En cas de refus, la réponse contient un `code` (LIEN_EXPIRE,
     LIEN_UTILISE, LIEN_INVALIDE) que le front utilise pour proposer
     une nouvelle demande.
   ================================================================ */

const bcrypt = require('bcrypt');
const UtilisateurModel = require('../models/utilisateur.model');
const TokenReinitialisationModel = require('../models/tokenReinitialisation.model');
const { transporter, EXPEDITEUR } = require('../email/mailer');
const { SITE } = require('../email/templates');
const { genererMailReinitialisation } = require('../email/templateReinitialisation');
const {
    DUREE_VALIDITE_MINUTES, MESSAGE_DEMANDE, ETATS_JETON,
    genererJeton, validerDemande, validerReinitialisation, jetonBienForme,
    empreinteJeton, etatJeton
} = require('../utils/jetonReinitialisation');

const MESSAGE_SUCCES = 'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.';
const MESSAGE_DESACTIVE = 'Ce compte est désactivé. Contactez Vite & Gourmand.';

/** Envoie la réponse d'un jeton refusé (400 + code, ou 403 si compte désactivé) */
function refuserJeton(res, etat) {
    if (etat === 'desactive') {
        return res.status(403).json({ error: MESSAGE_DESACTIVE, code: 'COMPTE_DESACTIVE' });
    }
    const { code, message } = ETATS_JETON[etat];
    return res.status(400).json({ error: message, code });
}

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

    /**
     * POST /api/reinitialiser-mot-de-passe/verifier
     * 200 { valide: true } ou refus (même format que la réinitialisation).
     */
    static async verifierJeton(req, res) {
        const token = req.body ? req.body.token : undefined;
        if (!jetonBienForme(token)) {
            return refuserJeton(res, 'invalide');
        }
        try {
            const ligne = await TokenReinitialisationModel.trouver(empreinteJeton(token));
            let etat = etatJeton(ligne);
            if (etat === 'valide' && !Number(ligne.actif)) etat = 'desactive';
            if (etat !== 'valide') {
                return refuserJeton(res, etat);
            }
            res.json({ valide: true });
        } catch (err) {
            console.error('Erreur vérification du lien :', err.message);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/reinitialiser-mot-de-passe
     * 200 { message } ; 400 erreurs[] (mot de passe) ou code (lien) ; 403.
     */
    static async reinitialiser(req, res) {
        const { donnees, erreurs } = validerReinitialisation(req.body);
        if (!donnees.token) {
            return refuserJeton(res, 'invalide');
        }
        if (erreurs.length > 0) {
            return res.status(400).json({ error: erreurs[0], erreurs });
        }

        try {
            // Hachage avant la transaction : bcrypt prend ~100 ms,
            // inutile de garder la ligne du jeton verrouillée pendant ce temps
            const motDePasseHash = await bcrypt.hash(donnees.mot_de_passe, 10);
            const { etat } = await TokenReinitialisationModel.reinitialiser(
                empreinteJeton(donnees.token), motDePasseHash
            );
            if (etat !== 'valide') {
                return refuserJeton(res, etat);
            }
            res.json({ message: MESSAGE_SUCCES });
        } catch (err) {
            console.error('Erreur réinitialisation du mot de passe :', err.message);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = MotDePasseController;
module.exports.lienReinitialisation = lienReinitialisation;
module.exports.envoyerLienReinitialisation = envoyerLienReinitialisation;
