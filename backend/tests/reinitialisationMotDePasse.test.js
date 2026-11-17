/* ================================================================
   TESTS/REINITIALISATIONMOTDEPASSE.TEST.JS
   POST /api/reinitialiser-mot-de-passe (et /verifier) :
   jeton à usage unique, expiration, transaction, bcrypt
   Lancement : cd backend && npm test
   ================================================================
   Une fausse connexion MySQL renvoie la ligne du jeton choisie par
   le test et note les requêtes, le COMMIT et le ROLLBACK.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db.mysql');
const TokenReinitialisationModel = require('../models/tokenReinitialisation.model');
const MotDePasseController = require('../controllers/motDePasse.controller');
const { ETATS_JETON, empreinteJeton } = require('../utils/jetonReinitialisation');
const { MESSAGE_MOT_DE_PASSE } = require('../utils/motDePasse');

const JETON = 'd'.repeat(64);
const NOUVEAU = 'Nouveau#Gourmand26';

/** Ligne du jeton telle que la renvoie MySQL */
const ligne = (modifs = {}) => ({ utilisateur_id: 3, utilise: 0, expire: 0, actif: 1, ...modifs });

function fausseConnexion(jeton) {
    const journal = { requetes: [], commit: false, rollback: false, rendue: false };
    pool.getConnection = async () => ({
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() { journal.rendue = true; },
        async query(sql, valeurs) {
            journal.requetes.push({ sql, valeurs });
            if (/^\s*SELECT/.test(sql)) return [jeton ? [jeton] : []];
            return [{ affectedRows: 1 }];
        }
    });
    return journal;
}

const ecritures = (journal) => journal.requetes.filter((r) => !/^\s*SELECT/.test(r.sql));

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

describe('TokenReinitialisationModel.reinitialiser', () => {

    afterEach(() => { delete pool.getConnection; });

    test('jeton valable : SELECT … FOR UPDATE, nouveau hash, jetons du compte invalidés, COMMIT', async () => {
        const journal = fausseConnexion(ligne());
        const { etat } = await TokenReinitialisationModel.reinitialiser('h'.repeat(64), 'HASH');

        assert.equal(etat, 'valide');
        const [lecture] = journal.requetes;
        assert.match(lecture.sql, /WHERE t\.token_hash = \?\s+FOR UPDATE/);
        assert.match(lecture.sql, /\(t\.expire_le < NOW\(\)\) AS expire/);
        assert.deepEqual(lecture.valeurs, ['h'.repeat(64)]);

        const [motDePasse, jetons] = ecritures(journal);
        assert.match(motDePasse.sql, /UPDATE utilisateur SET mot_de_passe = \? WHERE utilisateur_id = \?/);
        assert.deepEqual(motDePasse.valeurs, ['HASH', 3]);
        assert.match(jetons.sql, /SET utilise = 1/);
        assert.deepEqual(jetons.valeurs, [3]);

        assert.equal(journal.commit, true);
        assert.equal(journal.rendue, true);
    });

    for (const [cas, jeton, attendu] of [
        ['empreinte inconnue', null, 'invalide'],
        ['déjà utilisé (2e clic)', ligne({ utilise: 1 }), 'utilise'],
        ['expiré', ligne({ expire: 1 }), 'expire'],
        ['compte désactivé depuis la demande', ligne({ actif: 0 }), 'desactive']
    ]) {
        test(`${cas} : « ${attendu} », aucune écriture, ROLLBACK`, async () => {
            const journal = fausseConnexion(jeton);
            const { etat } = await TokenReinitialisationModel.reinitialiser('h'.repeat(64), 'HASH');
            assert.equal(etat, attendu);
            assert.equal(ecritures(journal).length, 0);
            assert.equal(journal.commit, false);
            assert.equal(journal.rollback, true);
            assert.equal(journal.rendue, true);
        });
    }

    test('erreur MySQL pendant la mise à jour : ROLLBACK et erreur remontée', async () => {
        const journal = { rollback: false, rendue: false };
        pool.getConnection = async () => ({
            async beginTransaction() {},
            async commit() {},
            async rollback() { journal.rollback = true; },
            release() { journal.rendue = true; },
            async query(sql) {
                if (/^\s*SELECT/.test(sql)) return [[ligne()]];
                throw new Error('panne MySQL');
            }
        });
        await assert.rejects(TokenReinitialisationModel.reinitialiser('h'.repeat(64), 'HASH'), /panne MySQL/);
        assert.equal(journal.rollback, true);
        assert.equal(journal.rendue, true);
    });
});

describe('MotDePasseController.reinitialiser', () => {

    afterEach(() => { delete pool.getConnection; });

    const appeler = async (body) => {
        const res = fauxRes();
        await MotDePasseController.reinitialiser({ body }, res);
        return res;
    };

    test('succès : 200, message clair, empreinte (pas le jeton) cherchée, mot de passe haché par bcrypt', async () => {
        const journal = fausseConnexion(ligne());
        const res = await appeler({ token: JETON, mot_de_passe: NOUVEAU });

        assert.equal(res.statut, 200);
        assert.match(res.corps.message, /mot de passe a été modifié/);
        assert.deepEqual(journal.requetes[0].valeurs, [empreinteJeton(JETON)]);

        const hash = ecritures(journal)[0].valeurs[0];
        assert.notEqual(hash, NOUVEAU);
        assert.match(hash, /^\$2[aby]\$10\$/);
        assert.equal(await bcrypt.compare(NOUVEAU, hash), true);
    });

    for (const [etat, jeton] of [['utilise', ligne({ utilise: 1 })], ['expire', ligne({ expire: 1 })], ['invalide', null]]) {
        test(`lien ${etat} : 400 avec le code ${ETATS_JETON[etat].code} et un message clair`, async () => {
            fausseConnexion(jeton);
            const res = await appeler({ token: JETON, mot_de_passe: NOUVEAU });
            assert.equal(res.statut, 400);
            assert.equal(res.corps.code, ETATS_JETON[etat].code);
            assert.equal(res.corps.error, ETATS_JETON[etat].message);
        });
    }

    test('compte désactivé : 403 COMPTE_DESACTIVE', async () => {
        fausseConnexion(ligne({ actif: 0 }));
        const res = await appeler({ token: JETON, mot_de_passe: NOUVEAU });
        assert.equal(res.statut, 403);
        assert.equal(res.corps.code, 'COMPTE_DESACTIVE');
    });

    test('mot de passe trop faible : 400 erreurs[], aucune requête', async () => {
        const journal = fausseConnexion(ligne());
        const res = await appeler({ token: JETON, mot_de_passe: 'faible' });
        assert.equal(res.statut, 400);
        assert.deepEqual(res.corps.erreurs, [MESSAGE_MOT_DE_PASSE]);
        assert.equal(journal.requetes.length, 0);
    });

    test('jeton mal formé : 400 LIEN_INVALIDE, aucune requête', async () => {
        const journal = fausseConnexion(ligne());
        const res = await appeler({ token: "' OR 1=1 --", mot_de_passe: NOUVEAU });
        assert.equal(res.statut, 400);
        assert.equal(res.corps.code, 'LIEN_INVALIDE');
        assert.equal(journal.requetes.length, 0);
    });

    test('corps absent : 400 LIEN_INVALIDE', async () => {
        const res = await appeler(undefined);
        assert.equal(res.statut, 400);
        assert.equal(res.corps.code, 'LIEN_INVALIDE');
    });
});

describe('MotDePasseController.verifierJeton', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    const verifier = async (jeton, token = JETON) => {
        const journal = [];
        pool.query = async (sql, valeurs) => { journal.push({ sql, valeurs }); return [jeton ? [jeton] : []]; };
        const res = fauxRes();
        await MotDePasseController.verifierJeton({ body: { token } }, res);
        return { res, journal };
    };

    test('lien valable : 200 { valide: true }, lecture seule par empreinte', async () => {
        const { res, journal } = await verifier(ligne());
        assert.equal(res.statut, 200);
        assert.deepEqual(res.corps, { valide: true });
        assert.match(journal[0].sql, /^\s*SELECT/);
        assert.equal(/UPDATE|INSERT|DELETE/.test(journal[0].sql), false);
        assert.deepEqual(journal[0].valeurs, [empreinteJeton(JETON)]);
    });

    test('lien expiré : 400 LIEN_EXPIRE', async () => {
        const { res } = await verifier(ligne({ expire: 1 }));
        assert.equal(res.statut, 400);
        assert.equal(res.corps.code, 'LIEN_EXPIRE');
    });

    test('lien déjà utilisé : 400 LIEN_UTILISE', async () => {
        const { res } = await verifier(ligne({ utilise: 1 }));
        assert.equal(res.corps.code, 'LIEN_UTILISE');
    });

    test('jeton mal formé : 400 LIEN_INVALIDE sans requête', async () => {
        const { res, journal } = await verifier(ligne(), 'abc');
        assert.equal(res.corps.code, 'LIEN_INVALIDE');
        assert.equal(journal.length, 0);
    });
});
