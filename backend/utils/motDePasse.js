/* ================================================================
   UTILS/MOTDEPASSE.JS
   Politique de mot de passe partagée (inscription, création employé)
   ================================================================
   Règles : 10 caractères minimum, au moins une majuscule, une
   minuscule, un chiffre et un caractère spécial.
   Maximum 72 caractères : au-delà, bcrypt ignore la fin du mot
   de passe.
   La même regex sera reprise côté Angular pour l'affichage, mais
   c'est la vérification serveur qui fait foi.
   ================================================================ */

const REGEX_MOT_DE_PASSE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/;

const MESSAGE_MOT_DE_PASSE =
    'Le mot de passe doit contenir entre 10 et 72 caractères, dont une majuscule, ' +
    'une minuscule, un chiffre et un caractère spécial.';

/**
 * Retourne true si le mot de passe respecte la politique.
 */
function motDePasseValide(motDePasse) {
    return typeof motDePasse === 'string' && REGEX_MOT_DE_PASSE.test(motDePasse);
}

module.exports = { REGEX_MOT_DE_PASSE, MESSAGE_MOT_DE_PASSE, motDePasseValide };
