/* ================================================================
   UTILS/VALIDATIONPROFIL.JS
   Validation des informations personnelles d'un compte client
   ================================================================
   Utilisée par POST /api/inscription et par PUT /api/profil :
   les deux formulaires appliquent ainsi exactement les mêmes règles,
   identiques à celles du formulaire Angular (inscription.ts).

   validerProfil(corps) renvoie { donnees, erreurs } :
   - `donnees` ne contient QUE les 7 champs attendus, nettoyés
     (un champ en trop, comme role ou mot_de_passe, est ignoré) ;
   - `erreurs` liste tous les problèmes, pour les afficher d'un coup.
   ================================================================ */

const REGEX_EMAIL       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEPHONE   = /^0[1-9]\d{8}$/;   // après retrait des espaces et des points
const REGEX_CODE_POSTAL = /^\d{5}$/;

/** Texte nettoyé (espaces en trop retirés), ou null s'il est absent, vide ou trop long */
function texte(valeur, longueurMax) {
    if (typeof valeur !== 'string') return null;
    const propre = valeur.trim().replace(/\s+/g, ' ');
    return propre.length > 0 && propre.length <= longueurMax ? propre : null;
}

function validerProfil(corps = {}) {
    corps = corps || {};
    const erreurs = [];
    const donnees = {};

    const nom = texte(corps.nom, 50);
    if (nom) donnees.nom = nom;
    else erreurs.push('Le nom est requis (50 caractères au plus).');

    const prenom = texte(corps.prenom, 50);
    if (prenom) donnees.prenom = prenom;
    else erreurs.push('Le prénom est requis (50 caractères au plus).');

    const email = texte(corps.email, 100);
    if (email && REGEX_EMAIL.test(email)) donnees.email = email.toLowerCase();
    else erreurs.push('Adresse e-mail invalide.');

    const telephone = typeof corps.telephone === 'string' ? corps.telephone.replace(/[ .]/g, '') : '';
    if (REGEX_TELEPHONE.test(telephone)) donnees.telephone = telephone;
    else erreurs.push('Numéro de téléphone invalide (10 chiffres, ex. 06 12 34 56 78).');

    const adresse = texte(corps.adresse_postale, 255);
    if (adresse) donnees.adresse_postale = adresse;
    else erreurs.push('L\'adresse postale est requise (255 caractères au plus).');

    const codePostal = typeof corps.code_postal === 'string' ? corps.code_postal.trim() : '';
    if (REGEX_CODE_POSTAL.test(codePostal)) donnees.code_postal = codePostal;
    else erreurs.push('Le code postal doit contenir 5 chiffres.');

    const ville = texte(corps.ville, 100);
    if (ville) donnees.ville = ville;
    else erreurs.push('La ville est requise (100 caractères au plus).');

    return { donnees, erreurs };
}

module.exports = { validerProfil };
