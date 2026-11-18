/* ================================================================
   UTILS/JETONREINITIALISATION.JS
   Mot de passe oublié : jeton, empreinte et validation des demandes
   ================================================================
   Fonctions « pures » (aucun accès à la base ni au réseau), testées
   dans tests/jetonReinitialisation.test.js.

   Principe :
   - le jeton envoyé par e-mail est tiré au hasard par crypto.randomBytes
     (32 octets = 256 bits, impossible à deviner) ;
   - la base ne stocke que son empreinte SHA-256 : si la base fuite,
     les empreintes ne permettent pas de réinitialiser un compte
     (on ne peut pas retrouver le jeton à partir de l'empreinte) ;
   - le jeton est valable DUREE_VALIDITE_MINUTES et ne sert qu'une fois.
   ================================================================ */

const crypto = require('node:crypto');
const { motDePasseValide, MESSAGE_MOT_DE_PASSE } = require('./motDePasse');

/** Durée de validité d'un lien de réinitialisation */
const DUREE_VALIDITE_MINUTES = 30;

/** 32 octets écrits en hexadécimal = 64 caractères de 0-9 et a-f */
const REGEX_JETON = /^[a-f0-9]{64}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Message renvoyé à CHAQUE demande, que le compte existe ou non */
const MESSAGE_DEMANDE =
    'Si un compte actif correspond à cette adresse, un e-mail contenant un lien '
    + `de réinitialisation vient d'être envoyé. Ce lien est valable ${DUREE_VALIDITE_MINUTES} minutes.`;

/** Messages et codes renvoyés au front selon l'état du jeton */
const ETATS_JETON = {
    invalide: { code: 'LIEN_INVALIDE', message: 'Ce lien de réinitialisation n\'est pas valide. Faites une nouvelle demande.' },
    utilise:  { code: 'LIEN_UTILISE',  message: 'Ce lien a déjà été utilisé. Faites une nouvelle demande si besoin.' },
    expire:   { code: 'LIEN_EXPIRE',   message: `Ce lien a expiré (il est valable ${DUREE_VALIDITE_MINUTES} minutes). Faites une nouvelle demande.` }
};

/** Empreinte SHA-256 d'un jeton, en hexadécimal (64 caractères) */
function empreinteJeton(jeton) {
    return crypto.createHash('sha256').update(String(jeton)).digest('hex');
}

/**
 * Tire un nouveau jeton au hasard.
 * Renvoie { jeton, empreinte } : le jeton part dans l'e-mail,
 * l'empreinte va en base.
 */
function genererJeton() {
    const jeton = crypto.randomBytes(32).toString('hex');
    return { jeton, empreinte: empreinteJeton(jeton) };
}

/** Vrai si la valeur a la forme d'un jeton (évite une requête inutile) */
function jetonBienForme(jeton) {
    return typeof jeton === 'string' && REGEX_JETON.test(jeton);
}

/**
 * Validation de POST /api/mot-de-passe-oublie.
 * Renvoie { email } (nettoyé, en minuscules) ou { erreur }.
 */
function validerDemande(corps) {
    const valeur = corps && typeof corps.email === 'string' ? corps.email.trim() : '';
    if (!valeur || valeur.length > 100 || !REGEX_EMAIL.test(valeur)) {
        return { erreur: 'Saisissez une adresse e-mail valide.' };
    }
    return { email: valeur.toLowerCase() };
}

/**
 * Validation de POST /api/reinitialiser-mot-de-passe.
 * Renvoie { donnees: { token, mot_de_passe }, erreurs: [...] }.
 * Mêmes règles de mot de passe qu'à l'inscription (utils/motDePasse.js).
 */
function validerReinitialisation(corps) {
    corps = corps || {};
    const erreurs = [];
    const donnees = {};

    if (jetonBienForme(corps.token)) donnees.token = corps.token;
    else erreurs.push(ETATS_JETON.invalide.message);

    if (motDePasseValide(corps.mot_de_passe)) donnees.mot_de_passe = corps.mot_de_passe;
    else erreurs.push(MESSAGE_MOT_DE_PASSE);

    return { donnees, erreurs };
}

/**
 * État d'un jeton lu en base.
 * `ligne` : { utilise: 0|1, expire: 0|1 } (expire est calculé par MySQL :
 * expire_le < NOW()), ou null si aucune empreinte ne correspond.
 * Renvoie 'invalide', 'utilise', 'expire' ou 'valide'.
 * « Déjà utilisé » passe avant « expiré » : c'est l'information la plus utile.
 */
function etatJeton(ligne) {
    if (!ligne) return 'invalide';
    if (Number(ligne.utilise) === 1) return 'utilise';
    if (Number(ligne.expire) === 1) return 'expire';
    return 'valide';
}

module.exports = {
    DUREE_VALIDITE_MINUTES,
    MESSAGE_DEMANDE,
    ETATS_JETON,
    empreinteJeton,
    genererJeton,
    jetonBienForme,
    validerDemande,
    validerReinitialisation,
    etatJeton
};
