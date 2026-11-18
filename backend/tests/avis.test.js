/* ================================================================
   TESTS/AVIS.TEST.JS
   POST /api/avis : note 1 à 5 + commentaire, sur une commande
   « terminee » du client, un seul avis par commande, en attente
   Lancement : cd backend && npm test
   ================================================================
   pool.query est remplacé par une fausse fonction : le SELECT renvoie
   la commande choisie par le test, l'INSERT est noté.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const AvisController = require('../controllers/avis.controller');
const { validerAvis } = require('../controllers/avis.controller');

const corpsValide = (modifs = {}) => ({ note: 5, commentaire: '  Parfait, merci !  ', commande_id: 14, ...modifs });

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

/** `commande` = ligne renvoyée par le SELECT (null = aucune), `erreurInsert` = erreur levée par l'INSERT */
function fausseBase({ commande, erreurInsert = null }) {
    const journal = { requetes: [] };
    pool.query = async (sql, valeurs) => {
        journal.requetes.push({ sql, valeurs });
        if (/^\s*SELECT/.test(sql)) return [commande ? [commande] : []];
        if (erreurInsert) throw erreurInsert;
        return [{ insertId: 7 }];
    };
    return journal;
}

const reqCamille = (body) => ({ user: { id: 3, role: 'utilisateur' }, body });

describe('validerAvis', () => {

    test('avis valide : commentaire nettoyé', () => {
        const { donnees, erreurs } = validerAvis(corpsValide());
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, { note: 5, commentaire: 'Parfait, merci !', commandeId: 14 });
    });

    const casRefuses = [
        ['note 0',               { note: 0 },                         /entier entre 1 et 5/],
        ['note 6',               { note: 6 },                         /entier entre 1 et 5/],
        ['note décimale',        { note: 4.5 },                       /entier entre 1 et 5/],
        ['note en texte',        { note: '5' },                       /entier entre 1 et 5/],
        ['commentaire vide',     { commentaire: '   ' },              /commentaire est requis/],
        ['commentaire de 2 car.', { commentaire: 'ok' },              /commentaire est requis/],
        ['commentaire trop long', { commentaire: 'a'.repeat(1001) },  /commentaire est requis/],
        ['commentaire non texte', { commentaire: 42 },                /commentaire est requis/],
        ['commande absente',     { commande_id: undefined },          /commande concernée/],
        ['commande en texte',    { commande_id: '14' },               /commande concernée/]
    ];
    for (const [cas, modif, message] of casRefuses) {
        test(`refusé : ${cas}`, () => {
            const { erreurs } = validerAvis(corpsValide(modif));
            assert.equal(erreurs.length, 1, erreurs.join(' | '));
            assert.match(erreurs[0], message);
        });
    }

    test('un statut envoyé (« valide ») est ignoré', () => {
        assert.equal('statut' in validerAvis(corpsValide({ statut: 'valide' })).donnees, false);
    });
});

describe('POST /api/avis', () => {

    afterEach(() => { delete pool.query; });

    test('commande terminée du client : 201, avis enregistré en attente', async () => {
        const journal = fausseBase({ commande: { statut: 'terminee' } });
        const res = fauxRes();

        await AvisController.creer(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 201);
        assert.deepEqual(res.corps.avis, { note: 5, commentaire: 'Parfait, merci !', statut: 'en_attente' });
        const [select, insert] = journal.requetes;
        assert.match(select.sql, /commande_id = \? AND utilisateur_id = \?/);
        assert.deepEqual(select.valeurs, [14, 3]);
        assert.deepEqual(insert.valeurs, [5, 'Parfait, merci !', 14, 3]);
        assert.doesNotMatch(insert.sql, /statut/, 'le statut prend la valeur par défaut de la base (en_attente)');
    });

    test('commande d\'un autre client : 404, aucun INSERT', async () => {
        const journal = fausseBase({ commande: null });
        const res = fauxRes();

        await AvisController.creer(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 404);
        assert.equal(journal.requetes.length, 1);
    });

    test('commande pas encore terminée : 409, aucun INSERT', async () => {
        const journal = fausseBase({ commande: { statut: 'livre' } });
        const res = fauxRes();

        await AvisController.creer(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 409);
        assert.equal(journal.requetes.length, 1);
    });

    test('deuxième avis sur la même commande (contrainte UNIQUE) : 409', async () => {
        fausseBase({ commande: { statut: 'terminee' }, erreurInsert: Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' }) });
        const res = fauxRes();

        await AvisController.creer(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 409);
        assert.match(res.corps.error, /déjà donné votre avis/);
    });

    test('corps invalide : 400 avec toutes les erreurs, sans interroger la base', async () => {
        const journal = fausseBase({ commande: { statut: 'terminee' } });
        const res = fauxRes();

        await AvisController.creer(reqCamille({ note: 9 }), res);

        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 3);
        assert.equal(journal.requetes.length, 0);
    });
});
