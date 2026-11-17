/* ================================================================
   TESTS/SECURITE.TEST.JS
   helmet (en-têtes), CORS et limitation des tentatives
   Lancement : cd backend && npm test
   ================================================================
   Une petite application Express est démarrée sur un port libre,
   avec les VRAIS middlewares de config/securite.js ; les requêtes
   passent par fetch, comme celles d'un navigateur.
   ================================================================ */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const {
    enTetesSecurite, origineCors, optionsCors, optionsHelmet,
    creerLimiteConnexion, creerLimiteDemandeReinitialisation,
    MESSAGE_TROP_CONNEXIONS, MESSAGE_TROP_DEMANDES
} = require('../config/securite');

/** Démarre une application sur un port libre ; renvoie { url, fermer } */
function demarrer(app) {
    return new Promise((resolve) => {
        const serveur = app.listen(0, '127.0.0.1', () => {
            resolve({
                url: `http://127.0.0.1:${serveur.address().port}`,
                fermer: () => new Promise((fin) => serveur.close(fin))
            });
        });
    });
}

describe('helmet : en-têtes de sécurité', () => {

    let serveur;
    before(async () => {
        const app = express();
        app.use(enTetesSecurite({}));
        app.get('/', (req, res) => res.send('<p>ok</p>'));
        serveur = await demarrer(app);
    });
    after(() => serveur.fermer());

    test('CSP : scripts du site seulement, aucun script en ligne, pas d\'iframe, pas d\'objet', async () => {
        const csp = (await fetch(serveur.url)).headers.get('content-security-policy');
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /script-src 'self'(;|$)/);
        assert.match(csp, /script-src-attr 'none'/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.match(csp, /object-src 'none'/);
        assert.equal(/unsafe-eval/.test(csp), false);
    });

    test('autres en-têtes : nosniff, no-referrer, X-Powered-By retiré', async () => {
        const reponse = await fetch(serveur.url);
        assert.equal(reponse.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(reponse.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(reponse.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.equal(reponse.headers.get('x-powered-by'), null);
    });

    test('upgrade-insecure-requests seulement en production (HTTPS)', () => {
        const directives = (env) => optionsHelmet(env).contentSecurityPolicy.directives;
        assert.equal('upgradeInsecureRequests' in directives({}), false);
        assert.equal('upgradeInsecureRequests' in directives({ NODE_ENV: 'production' }), true);
    });
});

describe('CORS', () => {

    test('production : seulement FRONTEND_URL (sans / final), jamais « * »', () => {
        assert.equal(origineCors({ NODE_ENV: 'production', FRONTEND_URL: 'https://vite-gourmand.up.railway.app/' }),
            'https://vite-gourmand.up.railway.app');
    });

    test('production sans FRONTEND_URL : aucun autre site accepté', () => {
        assert.equal(origineCors({ NODE_ENV: 'production' }), false);
    });

    test('développement : FRONTEND_URL, sinon localhost:4200', () => {
        assert.equal(origineCors({ FRONTEND_URL: 'http://localhost:4200' }), 'http://localhost:4200');
        assert.equal(origineCors({}), 'http://localhost:4200');
    });

    // Le serveur annonce toujours LE site autorisé ; le navigateur compare avec
    // le site qui appelle et bloque la réponse s'ils diffèrent.
    test('requête d\'un autre site : le navigateur ne reçoit pas son adresse comme autorisée', async () => {
        const app = express();
        app.use(cors(optionsCors({ NODE_ENV: 'production', FRONTEND_URL: 'https://vite-gourmand.fr' })));
        app.get('/api/menus', (req, res) => res.json([]));
        const serveur = await demarrer(app);
        try {
            const pirate = await fetch(`${serveur.url}/api/menus`, { headers: { Origin: 'https://site-pirate.com' } });
            assert.notEqual(pirate.headers.get('access-control-allow-origin'), 'https://site-pirate.com');
            assert.notEqual(pirate.headers.get('access-control-allow-origin'), '*');

            const site = await fetch(`${serveur.url}/api/menus`, { headers: { Origin: 'https://vite-gourmand.fr' } });
            assert.equal(site.headers.get('access-control-allow-origin'), 'https://vite-gourmand.fr');
        } finally {
            await serveur.fermer();
        }
    });
});

describe('limitation des tentatives', () => {

    test('connexion : 5 échecs acceptés, le 6e reçoit 429 + message en français + Retry-After', async () => {
        const app = express();
        app.post('/api/connexion', creerLimiteConnexion(), (req, res) =>
            res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' }));
        const serveur = await demarrer(app);
        try {
            for (let i = 1; i <= 5; i++) {
                const reponse = await fetch(`${serveur.url}/api/connexion`, { method: 'POST' });
                assert.equal(reponse.status, 401, `tentative ${i}`);
            }
            const bloquee = await fetch(`${serveur.url}/api/connexion`, { method: 'POST' });
            assert.equal(bloquee.status, 429);
            assert.deepEqual(await bloquee.json(), { error: MESSAGE_TROP_CONNEXIONS });
            assert.ok(Number(bloquee.headers.get('retry-after')) > 0);
        } finally {
            await serveur.fermer();
        }
    });

    test('connexion : les connexions RÉUSSIES ne sont pas comptées', async () => {
        const app = express();
        app.post('/api/connexion', creerLimiteConnexion(), (req, res) => res.json({ message: 'Connexion réussie' }));
        const serveur = await demarrer(app);
        try {
            for (let i = 1; i <= 8; i++) {
                const reponse = await fetch(`${serveur.url}/api/connexion`, { method: 'POST' });
                assert.equal(reponse.status, 200, `connexion ${i}`);
            }
        } finally {
            await serveur.fermer();
        }
    });

    test('mot de passe oublié : 5 demandes par heure, la 6e reçoit 429 (même si les précédentes ont « réussi »)', async () => {
        const app = express();
        app.post('/api/mot-de-passe-oublie', creerLimiteDemandeReinitialisation(), (req, res) => res.json({ message: 'ok' }));
        const serveur = await demarrer(app);
        try {
            for (let i = 1; i <= 5; i++) {
                assert.equal((await fetch(`${serveur.url}/api/mot-de-passe-oublie`, { method: 'POST' })).status, 200);
            }
            const bloquee = await fetch(`${serveur.url}/api/mot-de-passe-oublie`, { method: 'POST' });
            assert.equal(bloquee.status, 429);
            assert.deepEqual(await bloquee.json(), { error: MESSAGE_TROP_DEMANDES });
        } finally {
            await serveur.fermer();
        }
    });

    test('les routes réelles sont bien protégées (auth.routes.js)', () => {
        const router = require('../routes/auth.routes');
        const pile = (chemin) => router.stack.find((c) => c.route && c.route.path === chemin).route.stack.length;
        assert.equal(pile('/connexion'), 2, 'limite + contrôleur');
        assert.equal(pile('/mot-de-passe-oublie'), 2, 'limite + contrôleur');
        assert.equal(pile('/inscription'), 1);
    });
});
