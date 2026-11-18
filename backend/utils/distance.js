/* ================================================================
   UTILS/DISTANCE.JS
   Distance entre Bordeaux et l'adresse de la prestation
   ================================================================
   Le prix de la livraison dépend de la distance (5 EUR + 0,59 EUR/km
   hors Bordeaux). Si le navigateur envoyait cette distance, un client
   pourrait écrire « distance_km: 0 » dans la console et ne rien payer.
   C'est donc le SERVEUR qui la calcule :

   1. il géocode l'adresse (adresse -> coordonnées GPS) avec l'API de
      géocodage de la Géoplateforme (IGN), qui a repris l'API Adresse
      de data.gouv.fr (l'ancienne URL api-adresse.data.gouv.fr a été
      fermée fin janvier 2026) ;
   2. il calcule la distance à vol d'oiseau depuis Bordeaux avec la
      formule de haversine (distance sur une sphère).

   La ville vient aussi de la réponse de l'API (code INSEE), et non de
   ce que le client a tapé : écrire « Bordeaux » avec une adresse de
   Pessac ne rend pas la livraison gratuite.

   Les fonctions de calcul sont « pures » (pas de réseau) pour être
   testées facilement. La fonction qui appelle l'API reçoit « fetch »
   en option : les tests lui passent un faux fetch, sans réseau.
   ================================================================ */

const URL_GEOCODAGE = 'https://data.geopf.fr/geocodage/search';

// Point de départ des livraisons : centre de Bordeaux (hôtel de ville)
const DEPART_BORDEAUX = { lat: 44.8378, lon: -0.5792 };

// Code INSEE de Bordeaux : plus fiable que le nom (« Bordeaux », « BORDEAUX »…)
const CODE_INSEE_BORDEAUX = '33063';

// En dessous de ce score (0 à 1), l'API n'est pas sûre d'avoir trouvé la bonne adresse
const SCORE_MINIMUM = 0.5;

const RAYON_TERRE_KM = 6371;
const LONGUEUR_MAX_RECHERCHE = 200; // limite de l'API pour le paramètre q
const DELAI_MAX_MS = 5000;

/**
 * Erreur métier : porte le code HTTP à renvoyer au client.
 * 400 = adresse introuvable (le client doit la corriger)
 * 503 = service de géocodage indisponible (réessayer plus tard)
 */
class ErreurDistance extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ErreurDistance';
        this.status = status;
    }
}

/**
 * Distance à vol d'oiseau entre deux points GPS, en km, arrondie à 0,1 km.
 * Formule de haversine.
 */
function distanceHaversineKm(a, b) {
    const enRadians = (degres) => (degres * Math.PI) / 180;
    const dLat = enRadians(b.lat - a.lat);
    const dLon = enRadians(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2
            + Math.cos(enRadians(a.lat)) * Math.cos(enRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
    const km = 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h));
    return Math.round(km * 10) / 10;
}

/**
 * Construit l'URL de recherche. URLSearchParams encode les espaces,
 * accents et caractères spéciaux (pas d'injection dans l'URL).
 */
function construireUrlGeocodage(adresse, ville) {
    const recherche = `${String(adresse).trim()} ${String(ville).trim()}`.slice(0, LONGUEUR_MAX_RECHERCHE);
    const parametres = new URLSearchParams({ q: recherche, index: 'address', limit: '1' });
    return `${URL_GEOCODAGE}?${parametres.toString()}`;
}

/**
 * Lit la réponse de l'API (format GeoJSON) et renvoie le premier résultat,
 * ou null si rien de fiable n'a été trouvé.
 * Attention : GeoJSON donne les coordonnées dans l'ordre [longitude, latitude].
 */
function extraireAdresse(reponse) {
    const premier = reponse && Array.isArray(reponse.features) ? reponse.features[0] : undefined;
    if (!premier || !premier.geometry || !premier.properties) {
        return null;
    }
    const [lon, lat] = premier.geometry.coordinates || [];
    const { score, label, city, postcode, citycode } = premier.properties;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(score >= SCORE_MINIMUM)) {
        return null;
    }
    return { lat, lon, label, ville: city, codePostal: postcode, codeInsee: citycode };
}

/**
 * Calcule la livraison pour une adresse : géocodage puis distance.
 * @returns {Promise<{distance_km:number, est_bordeaux:boolean, ville:string, code_postal:string, adresse_trouvee:string}>}
 * @throws {ErreurDistance}
 */
async function calculerDistanceLivraison(adresse, ville, { fetchFn = globalThis.fetch, delaiMaxMs = DELAI_MAX_MS } = {}) {
    if (!String(adresse || '').trim() || !String(ville || '').trim()) {
        throw new ErreurDistance('L\'adresse et la ville de la prestation sont requises.', 400);
    }

    let reponse;
    try {
        const resultat = await fetchFn(construireUrlGeocodage(adresse, ville), {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(delaiMaxMs)   // on n'attend pas indéfiniment
        });
        if (!resultat.ok) {
            throw new Error(`HTTP ${resultat.status}`);
        }
        reponse = await resultat.json();
    } catch (err) {
        console.error('Erreur géocodage :', err.message);
        throw new ErreurDistance('Le calcul de la distance est momentanément indisponible. Réessayez dans quelques instants.', 503);
    }

    const trouvee = extraireAdresse(reponse);
    if (!trouvee) {
        throw new ErreurDistance('Adresse introuvable. Vérifiez le numéro, la rue et la ville.', 400);
    }

    const estBordeaux = trouvee.codeInsee === CODE_INSEE_BORDEAUX;
    return {
        distance_km:     estBordeaux ? 0 : distanceHaversineKm(DEPART_BORDEAUX, trouvee),
        est_bordeaux:    estBordeaux,
        ville:           trouvee.ville,
        code_postal:     trouvee.codePostal,
        adresse_trouvee: trouvee.label
    };
}

module.exports = {
    calculerDistanceLivraison,
    distanceHaversineKm,
    construireUrlGeocodage,
    extraireAdresse,
    ErreurDistance,
    DEPART_BORDEAUX
};
