/* ================================================================
   UTILS/FILTRESMENUS.JS
   Validation des filtres de GET /api/menus (query string)
   ================================================================
   Filtres acceptés (tous facultatifs) :
   - prix_min, prix_max : fourchette sur le prix du menu pour le
     nombre minimum de personnes (prix_minimum, celui affiché sur
     la carte). prix_max seul = « prix maximum ».
   - theme, regime : identifiants (entiers positifs)
   - personnes : nombre de convives prévu. On garde les menus dont
     le minimum de personnes est inférieur ou égal à ce nombre,
     c'est-à-dire les menus que le client peut réellement commander.

   Tout arrive en texte dans req.query : on vérifie le format avec
   une regex AVANT de convertir, pour refuser "12abc", "1e3", "-5"...
   Un paramètre vide ("") est considéré comme absent.
   Un paramètre en double (?theme=1&theme=2 → tableau) est refusé.
   Les paramètres inconnus sont ignorés.

   Fonction pure (sans base de données) : facile à tester.
   ================================================================ */

const PRIX_MAX_AUTORISE = 100000;   // garde-fou contre les valeurs absurdes
const PERSONNES_MAX_AUTORISE = 1000;
const ID_MAX_AUTORISE = 2147483647; // limite d'un INT MySQL

const REGEX_PRIX   = /^\d{1,6}(\.\d{1,2})?$/; // 45 ou 45.5 ou 45.50
const REGEX_ENTIER = /^[1-9]\d{0,9}$/;        // entier strictement positif

/**
 * Lit un paramètre texte. Renvoie :
 * - undefined s'il est absent ou vide,
 * - null s'il est invalide (tableau, objet...),
 * - la chaîne nettoyée sinon.
 */
function lireTexte(valeur) {
    if (valeur === undefined) return undefined;
    if (typeof valeur !== 'string') return null;
    const texte = valeur.trim();
    return texte === '' ? undefined : texte;
}

function lirePrix(query, nom, erreurs) {
    const texte = lireTexte(query[nom]);
    if (texte === undefined) return undefined;
    if (texte === null || !REGEX_PRIX.test(texte) || Number(texte) > PRIX_MAX_AUTORISE) {
        erreurs.push(`${nom} doit être un prix positif (ex. 450 ou 450.50).`);
        return undefined;
    }
    return Number(texte);
}

function lireEntier(query, nom, max, erreurs) {
    const texte = lireTexte(query[nom]);
    if (texte === undefined) return undefined;
    if (texte === null || !REGEX_ENTIER.test(texte) || Number(texte) > max) {
        erreurs.push(`${nom} doit être un entier positif.`);
        return undefined;
    }
    return Number(texte);
}

/**
 * Valide la query string de GET /api/menus.
 * @returns {{ filtres: object, erreurs: string[] }}
 *          filtres ne contient que les clés présentes et valides.
 */
function validerFiltresMenus(query = {}) {
    const erreurs = [];
    const filtres = {};

    const prixMin   = lirePrix(query, 'prix_min', erreurs);
    const prixMax   = lirePrix(query, 'prix_max', erreurs);
    const theme     = lireEntier(query, 'theme', ID_MAX_AUTORISE, erreurs);
    const regime    = lireEntier(query, 'regime', ID_MAX_AUTORISE, erreurs);
    const personnes = lireEntier(query, 'personnes', PERSONNES_MAX_AUTORISE, erreurs);

    if (prixMin !== undefined && prixMax !== undefined && prixMin > prixMax) {
        erreurs.push('prix_min doit être inférieur ou égal à prix_max.');
    }

    if (prixMin   !== undefined) filtres.prixMin   = prixMin;
    if (prixMax   !== undefined) filtres.prixMax   = prixMax;
    if (theme     !== undefined) filtres.themeId   = theme;
    if (regime    !== undefined) filtres.regimeId  = regime;
    if (personnes !== undefined) filtres.personnes = personnes;

    return { filtres, erreurs };
}

/**
 * Valide un identifiant de route (/api/menus/:id).
 * Renvoie le nombre, ou null s'il est invalide.
 */
function validerId(valeur) {
    return typeof valeur === 'string' && REGEX_ENTIER.test(valeur) && Number(valeur) <= ID_MAX_AUTORISE
        ? Number(valeur)
        : null;
}

module.exports = { validerFiltresMenus, validerId };
