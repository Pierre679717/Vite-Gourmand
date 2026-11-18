/* ================================================================
   TESTS/CATALOGUEHORAIRES.TEST.JS
   PUT /api/employe/horaires : la semaine entière, en une transaction
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const CatalogueController = require('../controllers/catalogue.controller');

function fausseConnexion(erreurAu = -1) {
    const journal = { requetes: [], commit: false, rollback: false };
    pool.getConnection = async () => ({
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() {},
        async query(sql, valeurs) {
            if (journal.requetes.length === erreurAu) throw new Error('connexion perdue');
            journal.requetes.push({ sql, valeurs });
            return [{ affectedRows: 1 }];
        }
    });
    return journal;
}

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const semaine = () => JOURS.map((jour) => jour === 'dimanche'
    ? { jour, heure_ouverture: null, heure_fermeture: null }
    : { jour, heure_ouverture: '09:00', heure_fermeture: '19:00' });

describe('modification des horaires', () => {

    afterEach(() => { delete pool.getConnection; });

    test('7 UPDATE paramétrés, un par jour, puis COMMIT', async () => {
        const journal = fausseConnexion();
        const res = fauxRes();
        await CatalogueController.modifierHoraires({ body: { horaires: semaine() } }, res);

        assert.equal(res.statut, 200);
        assert.equal(journal.requetes.length, 7);
        assert.deepEqual(journal.requetes[0].valeurs, ['09:00', '19:00', 'lundi']);
        assert.deepEqual(journal.requetes[6].valeurs, [null, null, 'dimanche']);
        assert.equal(journal.commit, true);
        assert.equal(res.corps.horaires.length, 7);
    });

    test('semaine invalide : 400 avec les erreurs, aucune requête', async () => {
        const journal = fausseConnexion();
        const s = semaine();
        s[0].heure_fermeture = '08:00';
        const res = fauxRes();
        await CatalogueController.modifierHoraires({ body: { horaires: s } }, res);
        assert.equal(res.statut, 400);
        assert.deepEqual(res.corps.erreurs, ['Lundi : la fermeture doit être après l\'ouverture.']);
        assert.equal(journal.requetes.length, 0);
    });

    test('panne au milieu : ROLLBACK, la semaine reste entière (500)', async (t) => {
        t.mock.method(console, 'error', () => {});
        const journal = fausseConnexion(3);
        const res = fauxRes();
        await CatalogueController.modifierHoraires({ body: { horaires: semaine() } }, res);
        assert.equal(res.statut, 500);
        assert.equal(journal.rollback, true);
        assert.equal(journal.commit, false);
    });
});
