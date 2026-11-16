/* ================================================================
   UTILS/VALIDATIONEMPLOYE.JS
   Validation du formulaire « Créer un compte employé » (administrateur)
   ================================================================
   Le sujet : l'administrateur fournit un e-mail (qui sert d'identifiant)
   et un mot de passe. Le nom et le prénom sont aussi demandés : ils sont
   obligatoires dans la table utilisateur et servent à saluer l'employé
   dans le mail et à le reconnaître dans la liste.

   Mêmes règles que l'inscription d'un client :
   - nom, prénom et e-mail : utils/validationProfil.js ;
   - mot de passe : utils/motDePasse.js.

   validerCompteEmploye(corps) renvoie { donnees, motDePasse, erreurs } :
   - `donnees` ne contient QUE nom, prenom et email, nettoyés.
     Un champ en trop (role, actif...) est ignoré : le rôle n'est jamais
     lu dans la requête, il est fixé à 'employe' par le contrôleur ;
   - `erreurs` liste tous les problèmes, pour les afficher d'un coup.
   ================================================================ */

const { texte, REGEX_EMAIL } = require('./validationProfil');
const { motDePasseValide, MESSAGE_MOT_DE_PASSE } = require('./motDePasse');

function validerCompteEmploye(corps) {
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

    // Le mot de passe n'est pas nettoyé : une espace fait partie du mot de passe
    const motDePasse = corps.mot_de_passe;
    if (!motDePasseValide(motDePasse)) erreurs.push(MESSAGE_MOT_DE_PASSE);

    return { donnees, motDePasse: erreurs.length === 0 ? motDePasse : null, erreurs };
}

module.exports = { validerCompteEmploye };
