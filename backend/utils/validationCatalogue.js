/* ================================================================
   UTILS/VALIDATIONCATALOGUE.JS
   Vérification des données envoyées par l'employé pour gérer le
   catalogue : menus, plats (avec allergènes) et horaires.
   ================================================================
   Fonctions pures (sans base de données) : chacune renvoie
   { donnees, erreurs }. `donnees` ne contient QUE les champs attendus,
   nettoyés (liste blanche) ; un champ inconnu envoyé par le client
   (actif, menu_id, rôle…) est ignoré.
   Ce qui demande la base (thème existant, plat existant, titre déjà
   pris) est vérifié ensuite par le modèle.
   ================================================================ */

const CATEGORIES_PLAT = ['entree', 'plat', 'dessert'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Texte nettoyé (espaces au début et à la fin), ou null si ce n'est pas du texte */
function texte(valeur) {
    return typeof valeur === 'string' ? valeur.trim() : null;
}

/**
 * Entier dans [min, max], ou null.
 * Accepte 12 ou '12' (un champ de formulaire), refuse 12.5, '12abc', true, [].
 */
function entier(valeur, min, max) {
    if (typeof valeur === 'string' && /^\d{1,9}$/.test(valeur.trim())) valeur = Number(valeur);
    return Number.isInteger(valeur) && valeur >= min && valeur <= max ? valeur : null;
}

/** Liste d'identifiants : entiers positifs, sans doublon (dans l'ordre reçu) */
function listeIds(valeur) {
    if (!Array.isArray(valeur)) return null;
    const ids = valeur.map((v) => entier(v, 1, 2147483647));
    if (ids.includes(null)) return null;
    return [...new Set(ids)];
}

/** Vérifie un texte obligatoire de longueur min..max ; ajoute l'erreur si besoin */
function texteObligatoire(corps, champ, nom, min, max, donnees, erreurs) {
    const t = texte(corps[champ]);
    if (t !== null && t.length >= min && t.length <= max) {
        donnees[champ] = t;
    } else {
        erreurs.push(`${nom} : ${min} à ${max} caractères.`);
    }
}

// ---------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------

/**
 * Corps de POST /api/employe/menus et PUT /api/employe/menus/:id.
 * `plats` = identifiants des plats qui composent le menu (au moins un).
 */
function validerMenu(corps) {
    corps = corps && typeof corps === 'object' ? corps : {};
    const donnees = {};
    const erreurs = [];

    texteObligatoire(corps, 'titre', 'Titre', 3, 100, donnees, erreurs);
    texteObligatoire(corps, 'description', 'Description', 10, 2000, donnees, erreurs);
    texteObligatoire(corps, 'conditions', 'Conditions', 10, 2000, donnees, erreurs);

    const nombres = [
        ['nombre_personne_min', 'Nombre minimum de personnes : entier de 1 à 500.', 1, 500],
        ['delai_minimum_jours', 'Délai de commande : nombre de jours de 0 à 365.', 0, 365],
        ['quantite_restante', 'Stock : entier de 0 à 10 000.', 0, 10000],
        ['theme_id', 'Thème inconnu.', 1, 2147483647],
        ['regime_id', 'Régime inconnu.', 1, 2147483647]
    ];
    for (const [champ, message, min, max] of nombres) {
        const n = entier(corps[champ], min, max);
        if (n === null) erreurs.push(message);
        else donnees[champ] = n;
    }

    // Prix par personne : nombre > 0, au plus 2 décimales (DECIMAL(6,2) en base)
    const prix = typeof corps.prix_par_personne === 'string'
        ? Number(corps.prix_par_personne.replace(',', '.'))
        : corps.prix_par_personne;
    // 2 décimales au plus : prix × 100 doit être (presque) entier — 0,1 + 0,2 n'est
    // pas exact en binaire, d'où la petite tolérance
    if (typeof prix === 'number' && Number.isFinite(prix) && prix > 0 && prix <= 9999.99
        && Math.abs(prix * 100 - Math.round(prix * 100)) < 1e-6) {
        donnees.prix_par_personne = Math.round(prix * 100) / 100;
    } else {
        erreurs.push('Prix par personne : nombre supérieur à 0, au plus 9 999,99 € et 2 décimales.');
    }

    const plats = listeIds(corps.plats);
    if (plats === null || plats.length === 0) {
        erreurs.push('Choisissez au moins un plat.');
    } else if (plats.length > 30) {
        erreurs.push('30 plats au maximum par menu.');
    } else {
        donnees.plats = plats;
    }

    return { donnees, erreurs };
}

// ---------------------------------------------------------------------
// Plat
// ---------------------------------------------------------------------

/**
 * Corps de POST /api/employe/plats et PUT /api/employe/plats/:id.
 * `allergenes` = identifiants des allergènes (liste vide = aucun allergène).
 */
function validerPlat(corps) {
    corps = corps && typeof corps === 'object' ? corps : {};
    const donnees = {};
    const erreurs = [];

    texteObligatoire(corps, 'titre', 'Nom du plat', 3, 150, donnees, erreurs);

    if (CATEGORIES_PLAT.includes(corps.categorie)) {
        donnees.categorie = corps.categorie;
    } else {
        erreurs.push('Catégorie : entrée, plat ou dessert.');
    }

    const allergenes = listeIds(corps.allergenes === undefined ? [] : corps.allergenes);
    if (allergenes === null || allergenes.length > 14) {
        erreurs.push('Allergènes invalides.');
    } else {
        donnees.allergenes = allergenes;
    }

    return { donnees, erreurs };
}

// ---------------------------------------------------------------------
// Horaires
// ---------------------------------------------------------------------

/** 'HH:MM' valide (00:00 à 23:59) → minutes depuis minuit, sinon null */
function minutes(heure) {
    const m = typeof heure === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(heure) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Corps de PUT /api/employe/horaires : la semaine entière, 7 jours.
 * Un jour fermé : les deux heures à null. Sinon fermeture > ouverture.
 * Renvoie les jours dans l'ordre de la semaine.
 */
function validerHoraires(corps) {
    const erreurs = [];
    const liste = Array.isArray(corps) ? corps : corps && Array.isArray(corps.horaires) ? corps.horaires : null;
    if (liste === null || liste.length !== 7) {
        return { donnees: [], erreurs: ['Les horaires des 7 jours sont attendus.'] };
    }

    const parJour = new Map();
    for (const ligne of liste) {
        const jour = ligne && ligne.jour;
        if (!JOURS.includes(jour) || parJour.has(jour)) {
            return { donnees: [], erreurs: ['Chaque jour de la semaine doit apparaître une seule fois.'] };
        }
        parJour.set(jour, ligne);
    }

    const donnees = JOURS.map((jour) => {
        const { heure_ouverture: ouverture = null, heure_fermeture: fermeture = null } = parJour.get(jour);
        const nom = jour.charAt(0).toUpperCase() + jour.slice(1);
        if (ouverture === null && fermeture === null) {
            return { jour, heure_ouverture: null, heure_fermeture: null };
        }
        const debut = minutes(ouverture);
        const fin = minutes(fermeture);
        if (debut === null || fin === null) {
            erreurs.push(`${nom} : heures au format HH:MM, ou les deux vides si fermé.`);
        } else if (fin <= debut) {
            erreurs.push(`${nom} : la fermeture doit être après l'ouverture.`);
        }
        return { jour, heure_ouverture: ouverture, heure_fermeture: fermeture };
    });

    return { donnees: erreurs.length > 0 ? [] : donnees, erreurs };
}

module.exports = {
    CATEGORIES_PLAT,
    JOURS,
    entier,
    listeIds,
    validerMenu,
    validerPlat,
    validerHoraires
};
