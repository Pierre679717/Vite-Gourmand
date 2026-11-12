/* ================================================================
   UTILS/VALIDATIONCOMMANDE.JS
   Validation des données envoyées pour une commande
   ================================================================
   Le formulaire Angular vérifie déjà tout cela, mais une requête peut
   être envoyée sans passer par le site (curl, Postman, console).
   Le serveur revérifie donc chaque champ : c'est lui qui fait foi.

   - validerCommande(corps, aujourdhui) : tous les champs de
     POST /api/commandes. Renvoie { donnees, erreurs }.
     `donnees` ne contient QUE les champs attendus, nettoyés : un champ
     en trop (prix_total, distance_km...) est simplement ignoré.
   - validerDevis(corps) : les champs utiles au calcul du prix.
   - verifierDelai(date, delaiJours, aujourdhui) : délai du menu.

   Les dates sont des chaînes AAAA-MM-JJ, comparées dans le fuseau de
   Bordeaux (Europe/Paris) : à 0 h 30 en France, le serveur (souvent
   réglé en UTC) serait encore la veille.
   ================================================================ */

const REGEX_DATE      = /^(\d{4})-(\d{2})-(\d{2})$/;     // 2026-11-21
const REGEX_HEURE     = /^([01]\d|2[0-3]):([0-5]\d)$/;   // 00:00 à 23:59
const REGEX_NOM       = /^\p{L}[\p{L}' -]*$/u;           // lettres, accents, espace, tiret, apostrophe
const REGEX_EMAIL     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEPHONE = /^0[1-9]\d{8}$/;                 // après retrait des espaces et des points

const PERSONNES_MAX = 1000;

/** Date du jour à Bordeaux, au format AAAA-MM-JJ */
function aujourdhuiParis(maintenant = new Date()) {
    // La locale « en-CA » écrit justement les dates en AAAA-MM-JJ
    return maintenant.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

/** Vrai si la chaîne est une date du calendrier (refuse 2026-02-30) */
function estDateValide(texte) {
    const morceaux = REGEX_DATE.exec(String(texte));
    if (!morceaux) return false;
    const [, annee, mois, jour] = morceaux.map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    return date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour;
}

/** '2026-11-10' + 7 -> '2026-11-17' (calcul en UTC : pas de souci d'heure d'été) */
function ajouterJours(dateIso, jours) {
    const [annee, mois, jour] = dateIso.split('-').map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, jour + jours));
    return date.toISOString().slice(0, 10);
}

/**
 * Première date de prestation possible pour un menu.
 * Toujours au moins demain (la date doit être dans le futur), même si
 * le délai du menu vaut 0.
 */
function dateMinimumPrestation(aujourdhui, delaiJours) {
    return ajouterJours(aujourdhui, Math.max(1, delaiJours));
}

/** null si le délai est respecté, sinon le message d'erreur */
function verifierDelai(datePrestation, delaiJours, aujourdhui) {
    const minimum = dateMinimumPrestation(aujourdhui, delaiJours);
    if (datePrestation >= minimum) return null; // AAAA-MM-JJ se compare comme du texte
    const [annee, mois, jour] = minimum.split('-');
    return `Ce menu se commande au moins ${delaiJours} jour(s) à l'avance : première date possible le ${jour}/${mois}/${annee}.`;
}

/** Texte nettoyé, ou null s'il est absent, vide ou trop long */
function texte(valeur, longueurMax) {
    if (typeof valeur !== 'string') return null;
    const propre = valeur.trim().replace(/\s+/g, ' ');
    return propre.length > 0 && propre.length <= longueurMax ? propre : null;
}

/** Champs communs au devis et à la commande */
function validerBase(corps, erreurs) {
    const donnees = {};

    if (Number.isInteger(corps.menu_id) && corps.menu_id > 0) {
        donnees.menuId = corps.menu_id;
    } else {
        erreurs.push('Menu invalide.');
    }

    if (Number.isInteger(corps.nombre_personne) && corps.nombre_personne >= 1 && corps.nombre_personne <= PERSONNES_MAX) {
        donnees.nombrePersonne = corps.nombre_personne;
    } else {
        erreurs.push(`Le nombre de personnes doit être un entier entre 1 et ${PERSONNES_MAX}.`);
    }

    const adresse = texte(corps.adresse_prestation, 255);
    if (adresse && adresse.length >= 5) {
        donnees.adressePrestation = adresse;
    } else {
        erreurs.push('L\'adresse de la prestation est requise (5 à 255 caractères).');
    }

    const ville = texte(corps.ville_prestation, 100);
    if (ville && REGEX_NOM.test(ville)) {
        donnees.villePrestation = ville;
    } else {
        erreurs.push('La ville de la prestation est requise (lettres, espaces, tirets).');
    }

    return donnees;
}

/** Champs nécessaires au devis (calcul du prix avant validation) */
function validerDevis(corps = {}) {
    const erreurs = [];
    const donnees = validerBase(corps || {}, erreurs);
    return { donnees, erreurs };
}

/** Tous les champs de la commande */
function validerCommande(corps = {}, aujourdhui = aujourdhuiParis()) {
    corps = corps || {};
    const erreurs = [];
    const donnees = validerBase(corps, erreurs);

    // --- Livraison ---
    if (estDateValide(corps.date_prestation)) {
        if (corps.date_prestation > aujourdhui) {
            donnees.datePrestation = corps.date_prestation;
        } else {
            erreurs.push('La date de prestation doit être dans le futur.');
        }
    } else {
        erreurs.push('Date de prestation invalide (format AAAA-MM-JJ).');
    }

    if (typeof corps.heure_livraison === 'string' && REGEX_HEURE.test(corps.heure_livraison)) {
        donnees.heureLivraison = corps.heure_livraison;
    } else {
        erreurs.push('Heure de livraison invalide (format HH:MM).');
    }

    if (corps.pret_materiel === undefined || typeof corps.pret_materiel === 'boolean') {
        donnees.pretMateriel = corps.pret_materiel === true;
    } else {
        erreurs.push('Le prêt de matériel doit valoir true ou false.');
    }

    // --- Coordonnées du client pour cette commande ---
    const nom = texte(corps.contact_nom, 50);
    const prenom = texte(corps.contact_prenom, 50);
    if (nom && REGEX_NOM.test(nom)) donnees.contactNom = nom;
    else erreurs.push('Nom invalide (lettres, espaces, tirets, 50 caractères au plus).');
    if (prenom && REGEX_NOM.test(prenom)) donnees.contactPrenom = prenom;
    else erreurs.push('Prénom invalide (lettres, espaces, tirets, 50 caractères au plus).');

    const email = texte(corps.contact_email, 254);
    if (email && REGEX_EMAIL.test(email)) donnees.contactEmail = email.toLowerCase();
    else erreurs.push('Adresse e-mail invalide.');

    const telephone = typeof corps.contact_telephone === 'string' ? corps.contact_telephone.replace(/[ .]/g, '') : '';
    if (REGEX_TELEPHONE.test(telephone)) donnees.contactTelephone = telephone;
    else erreurs.push('Numéro de téléphone invalide (10 chiffres, ex. 06 12 34 56 78).');

    return { donnees, erreurs };
}

module.exports = {
    validerCommande,
    validerDevis,
    verifierDelai,
    dateMinimumPrestation,
    ajouterJours,
    estDateValide,
    aujourdhuiParis
};
