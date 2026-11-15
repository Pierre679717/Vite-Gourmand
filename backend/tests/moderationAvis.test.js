/* ================================================================
   TESTS/MODERATIONAVIS.TEST.JS
   Modération des avis par l'employé : liste filtrée, valider, refuser
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const AvisController = require('../controllers/avis.controller');
const { validerFiltreAvis } = require('../controllers/avis.controller');

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

function fausseBase(reponse) {
    const journal = [];
    pool.query = async (sql, valeurs) => {
        journal.push({ sql, valeurs });
        return [reponse];
    };
    return journal;
}

describe('validerFiltreAvis', () => {

    test('vide ou absent : tous les avis', () => {
        assert.deepEqual(validerFiltreAvis({}), { statut: null, erreur: null });
        assert.deepEqual(validerFiltreAvis({ statut: '' }), { statut: null, erreur: null });
        assert.deepEqual(validerFiltreAvis(undefined), { statut: null, erreur: null });
    });

    test('statuts connus acceptés, le reste refusé', () => {
        for (const statut of ['en_attente', 'valide', 'refuse']) {
            assert.deepEqual(validerFiltreAvis({ statut }), { statut, erreur: null });
        }
        assert.ok(validerFiltreAvis({ statut: 'publie' }).erreur);
        assert.ok(validerFiltreAvis({ statut: ['valide', 'refuse'] }).erreur);
    });
});

describe('AvisController.listerPourModeration', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    test('avec filtre : WHERE paramétré', async () => {
        const journal = fausseBase([{ avis_id: 3, statut: 'en_attente' }]);
        const res = fauxRes();

        await AvisController.listerPourModeration({ query: { statut: 'en_attente' } }, res);

        assert.equal(res.statut, 200);
        assert.equal(res.corps.length, 1);
        assert.match(journal[0].sql, /WHERE a\.statut = \?/);
        assert.deepEqual(journal[0].valeurs, ['en_attente']);
    });

    test('sans filtre : tous les statuts, y compris refusés', async () => {
        const journal = fausseBase([]);
        await AvisController.listerPourModeration({ query: {} }, fauxRes());
        assert.doesNotMatch(journal[0].sql, /WHERE/);
        assert.deepEqual(journal[0].valeurs, []);
    });

    test('filtre inconnu : 400 sans requête', async () => {
        const journal = fausseBase([]);
        const res = fauxRes();
        await AvisController.listerPourModeration({ query: { statut: 'x' } }, res);
        assert.equal(res.statut, 400);
        assert.equal(journal.length, 0);
    });
});

describe('AvisController.moderer', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    test('valider : UPDATE paramétré et message pour l\'accueil', async () => {
        const journal = fausseBase({ affectedRows: 1 });
        const res = fauxRes();

        await AvisController.moderer({ params: { id: '5' }, body: { statut: 'valide' } }, res);

        assert.equal(res.statut, 200);
        assert.deepEqual(journal[0].valeurs, ['valide', 5]);
        assert.equal(res.corps.statut, 'valide');
        assert.match(res.corps.message, /accueil/);
    });

    test('refuser', async () => {
        fausseBase({ affectedRows: 1 });
        const res = fauxRes();
        await AvisController.moderer({ params: { id: '5' }, body: { statut: 'refuse' } }, res);
        assert.equal(res.statut, 200);
        assert.equal(res.corps.message, 'Avis refusé.');
    });

    test('décision invalide (dont en_attente) : 400 sans requête', async () => {
        for (const body of [{ statut: 'en_attente' }, { statut: 'VALIDE' }, {}, undefined]) {
            const journal = fausseBase({ affectedRows: 1 });
            const res = fauxRes();
            await AvisController.moderer({ params: { id: '5' }, body }, res);
            assert.equal(res.statut, 400);
            assert.equal(journal.length, 0);
        }
    });

    test('id invalide ou avis inconnu : 404', async () => {
        fausseBase({ affectedRows: 0 });
        for (const id of ['abc', '999']) {
            const res = fauxRes();
            await AvisController.moderer({ params: { id }, body: { statut: 'valide' } }, res);
            assert.equal(res.statut, 404);
        }
    });
});
