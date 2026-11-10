/* ================================================================
   TESTS/DISTANCE.TEST.JS
   Tests du calcul de distance (sans réseau : on passe un faux fetch)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    calculerDistanceLivraison,
    distanceHaversineKm,
    construireUrlGeocodage,
    extraireAdresse,
    ErreurDistance,
    DEPART_BORDEAUX
} = require('../utils/distance');

/** Réponse GeoJSON minimale, au format de l'API de la Géoplateforme */
function reponseApi({ lon, lat, score = 0.9, city, citycode, postcode = '33000' }) {
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: { label: `1 rue Test ${postcode} ${city}`, score, city, citycode, postcode }
        }]
    };
}

/** Faux fetch : renvoie la réponse donnée et garde l'URL appelée */
function fauxFetch(corps, { ok = true, status = 200 } = {}) {
    const appels = [];
    const fn = async (url) => {
        appels.push(url);
        return { ok, status, json: async () => corps };
    };
    fn.appels = appels;
    return fn;
}

const PESSAC = { lon: -0.6311, lat: 44.8067, city: 'Pessac', citycode: '33318', postcode: '33600' };

describe('distanceHaversineKm', () => {

    test('deux points identiques : 0 km', () => {
        assert.equal(distanceHaversineKm(DEPART_BORDEAUX, DEPART_BORDEAUX), 0);
    });

    test('Bordeaux -> Pessac : environ 5,4 km, arrondi à 0,1 km', () => {
        assert.equal(distanceHaversineKm(DEPART_BORDEAUX, PESSAC), 5.4);
    });

    test('Bordeaux -> Paris : environ 500 km (ordre de grandeur)', () => {
        const km = distanceHaversineKm(DEPART_BORDEAUX, { lat: 48.8566, lon: 2.3522 });
        assert.ok(km > 490 && km < 510, `distance obtenue : ${km}`);
    });

    test('la distance est la même dans les deux sens', () => {
        assert.equal(distanceHaversineKm(DEPART_BORDEAUX, PESSAC), distanceHaversineKm(PESSAC, DEPART_BORDEAUX));
    });
});

describe('construireUrlGeocodage', () => {

    test('encode les espaces et les accents, une seule réponse demandée', () => {
        const url = new URL(construireUrlGeocodage(' 12 allée des Écoles ', 'Mérignac'));
        assert.equal(url.origin + url.pathname, 'https://data.geopf.fr/geocodage/search');
        assert.equal(url.searchParams.get('q'), '12 allée des Écoles Mérignac');
        assert.equal(url.searchParams.get('limit'), '1');
        assert.equal(url.searchParams.get('index'), 'address');
    });

    test('un & dans l\'adresse ne crée pas de nouveau paramètre', () => {
        const url = new URL(construireUrlGeocodage('1 rue A&limit=50', 'Pessac'));
        assert.equal(url.searchParams.get('limit'), '1');
        assert.equal(url.searchParams.get('q'), '1 rue A&limit=50 Pessac');
    });

    test('la recherche est coupée à 200 caractères', () => {
        const url = new URL(construireUrlGeocodage('a'.repeat(300), 'Pessac'));
        assert.equal(url.searchParams.get('q').length, 200);
    });
});

describe('extraireAdresse', () => {

    test('lit les coordonnées dans l\'ordre GeoJSON [longitude, latitude]', () => {
        const adresse = extraireAdresse(reponseApi(PESSAC));
        assert.equal(adresse.lat, 44.8067);
        assert.equal(adresse.lon, -0.6311);
        assert.equal(adresse.ville, 'Pessac');
        assert.equal(adresse.codeInsee, '33318');
    });

    test('aucun résultat : null', () => {
        assert.equal(extraireAdresse({ type: 'FeatureCollection', features: [] }), null);
    });

    test('score trop faible (< 0,5) : null', () => {
        assert.equal(extraireAdresse(reponseApi({ ...PESSAC, score: 0.3 })), null);
    });

    test('réponse mal formée : null', () => {
        assert.equal(extraireAdresse(null), null);
        assert.equal(extraireAdresse({}), null);
        assert.equal(extraireAdresse({ features: [{ geometry: { coordinates: [] }, properties: { score: 1 } }] }), null);
    });
});

describe('calculerDistanceLivraison', () => {

    test('adresse hors Bordeaux : distance calculée, ville issue de l\'API', async () => {
        const fetchFn = fauxFetch(reponseApi(PESSAC));
        const resultat = await calculerDistanceLivraison('10 avenue Jean Jaurès', 'Pessac', { fetchFn });
        assert.deepEqual(resultat, {
            distance_km: 5.4,
            est_bordeaux: false,
            ville: 'Pessac',
            code_postal: '33600',
            adresse_trouvee: '1 rue Test 33600 Pessac'
        });
        assert.equal(fetchFn.appels.length, 1);
    });

    test('adresse à Bordeaux (code INSEE 33063) : 0 km', async () => {
        const fetchFn = fauxFetch(reponseApi({ lon: -0.57, lat: 44.84, city: 'Bordeaux', citycode: '33063' }));
        const resultat = await calculerDistanceLivraison('5 cours Victor Hugo', 'Bordeaux', { fetchFn });
        assert.equal(resultat.distance_km, 0);
        assert.equal(resultat.est_bordeaux, true);
    });

    test('« Bordeaux » tapé par le client mais adresse trouvée à Pessac : pas de gratuité', async () => {
        const fetchFn = fauxFetch(reponseApi(PESSAC));
        const resultat = await calculerDistanceLivraison('10 avenue Jean Jaurès', 'Bordeaux', { fetchFn });
        assert.equal(resultat.est_bordeaux, false);
        assert.equal(resultat.ville, 'Pessac');
        assert.ok(resultat.distance_km > 0);
    });

    test('adresse ou ville vide : erreur 400 sans appeler l\'API', async () => {
        const fetchFn = fauxFetch(reponseApi(PESSAC));
        await assert.rejects(
            calculerDistanceLivraison('  ', 'Pessac', { fetchFn }),
            (err) => err instanceof ErreurDistance && err.status === 400
        );
        await assert.rejects(
            calculerDistanceLivraison('1 rue A', '', { fetchFn }),
            (err) => err instanceof ErreurDistance && err.status === 400
        );
        assert.equal(fetchFn.appels.length, 0);
    });

    test('adresse introuvable : erreur 400', async () => {
        const fetchFn = fauxFetch({ type: 'FeatureCollection', features: [] });
        await assert.rejects(
            calculerDistanceLivraison('zzzz', 'Nullepart', { fetchFn }),
            (err) => err instanceof ErreurDistance && err.status === 400 && /introuvable/.test(err.message)
        );
    });

    test('l\'API répond en erreur (HTTP 500) : erreur 503', async () => {
        const fetchFn = fauxFetch({}, { ok: false, status: 500 });
        await assert.rejects(
            calculerDistanceLivraison('1 rue A', 'Pessac', { fetchFn }),
            (err) => err instanceof ErreurDistance && err.status === 503
        );
    });

    test('API injoignable (réseau coupé ou délai dépassé) : erreur 503', async () => {
        const fetchFn = async () => { throw new Error('fetch failed'); };
        await assert.rejects(
            calculerDistanceLivraison('1 rue A', 'Pessac', { fetchFn }),
            (err) => err instanceof ErreurDistance && err.status === 503
        );
    });
});
