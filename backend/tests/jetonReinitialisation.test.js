/* ================================================================
   TESTS/JETONREINITIALISATION.TEST.JS
   Mot de passe oublié : jeton, empreinte, validations, état du jeton
   et enregistrement en base (transaction)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pool } = require('../config/db.mysql');
const {
    DUREE_VALIDITE_MINUTES, MESSAGE_DEMANDE, ETATS_JETON,
    empreinteJeton, genererJeton, jetonBienForme,
    validerDemande, validerReinitialisation, etatJeton
} = require('../utils/jetonReinitialisation');
const { MESSAGE_MOT_DE_PASSE } = require('../utils/motDePasse');
const TokenReinitialisationModel = require('../models/tokenReinitialisation.model');

const JETON = 'a'.repeat(64);

describe('genererJeton / empreinteJeton', () => {

    test('jeton de 64 caractères hexadécimaux (32 octets aléatoires)', () => {
        const { jeton } = genererJeton();
        assert.match(jeton, /^[a-f0-9]{64}$/);
    });

    test('deux jetons tirés de suite sont différents', () => {
        assert.notEqual(genererJeton().jeton, genererJeton().jeton);
    });

    test("l'empreinte est le SHA-256 du jeton, et différente du jeton", () => {
        const { jeton, empreinte } = genererJeton();
        const attendue = crypto.createHash('sha256').update(jeton).digest('hex');
        assert.equal(empreinte, attendue);
        assert.equal(empreinte.length, 64);
        assert.notEqual(empreinte, jeton);
    });

    test('même jeton → même empreinte (on peut le retrouver en base)', () => {
        assert.equal(empreinteJeton(JETON), empreinteJeton(JETON));
    });
});

describe('jetonBienForme', () => {

    test('accepte 64 caractères hexadécimaux minuscules', () => {
        assert.equal(jetonBienForme(JETON), true);
    });

    for (const [cas, valeur] of [
        ['trop court', 'a'.repeat(63)],
        ['trop long', 'a'.repeat(65)],
        ['majuscules', 'A'.repeat(64)],
        ['caractère interdit', 'g'.repeat(64)],
        ['injection SQL', "' OR 1=1 --".padEnd(64, 'a')],
        ['nombre', 12345],
        ['absent', undefined]
    ]) {
        test(`refuse : ${cas}`, () => {
            assert.equal(jetonBienForme(valeur), false);
        });
    }
});

describe('validerDemande', () => {

    test('e-mail nettoyé et mis en minuscules', () => {
        assert.deepEqual(validerDemande({ email: '  Utilisateur@Vite-Gourmand.FR ' }),
            { email: 'utilisateur@vite-gourmand.fr' });
    });

    for (const [cas, corps] of [
        ['vide', { email: '' }],
        ['sans @', { email: 'utilisateur.vite-gourmand.fr' }],
        ['pas une chaîne', { email: ['a@b.fr'] }],
        ['trop long', { email: 'a'.repeat(95) + '@b.fr.fr' }],
        ['corps absent', undefined]
    ]) {
        test(`refuse : ${cas}`, () => {
            assert.deepEqual(validerDemande(corps), { erreur: 'Saisissez une adresse e-mail valide.' });
        });
    }

    test('le message de réponse ne dit pas si le compte existe et donne la durée', () => {
        assert.match(MESSAGE_DEMANDE, /^Si un compte actif correspond/);
        assert.match(MESSAGE_DEMANDE, new RegExp(`${DUREE_VALIDITE_MINUTES} minutes`));
    });
});

describe('validerReinitialisation', () => {

    test('jeton et mot de passe valides : aucune erreur', () => {
        const { donnees, erreurs } = validerReinitialisation({ token: JETON, mot_de_passe: 'Nouveau#Pass26' });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, { token: JETON, mot_de_passe: 'Nouveau#Pass26' });
    });

    test('mêmes règles que l\'inscription (motDePasse.js)', () => {
        const { erreurs } = validerReinitialisation({ token: JETON, mot_de_passe: 'motdepasse' });
        assert.deepEqual(erreurs, [MESSAGE_MOT_DE_PASSE]);
    });

    test('jeton mal formé et mot de passe absent : deux erreurs', () => {
        const { donnees, erreurs } = validerReinitialisation({ token: 'abc' });
        assert.deepEqual(erreurs, [ETATS_JETON.invalide.message, MESSAGE_MOT_DE_PASSE]);
        assert.deepEqual(donnees, {});
    });

    test('un champ en trop (utilisateur_id) est ignoré', () => {
        const { donnees } = validerReinitialisation({ token: JETON, mot_de_passe: 'Nouveau#Pass26', utilisateur_id: 1 });
        assert.equal('utilisateur_id' in donnees, false);
    });
});

describe('etatJeton', () => {

    test('aucune ligne → invalide', () => assert.equal(etatJeton(null), 'invalide'));
    test('utilisé → utilise', () => assert.equal(etatJeton({ utilise: 1, expire: 0 }), 'utilise'));
    test('expiré → expire', () => assert.equal(etatJeton({ utilise: 0, expire: 1 }), 'expire'));
    test('utilisé ET expiré → utilise (le plus utile pour la personne)', () =>
        assert.equal(etatJeton({ utilise: 1, expire: 1 }), 'utilise'));
    test('ni utilisé ni expiré → valide', () => assert.equal(etatJeton({ utilise: 0, expire: 0 }), 'valide'));

    test('chaque état refusé a un code et un message en français', () => {
        for (const etat of ['invalide', 'utilise', 'expire']) {
            assert.match(ETATS_JETON[etat].code, /^LIEN_/);
            assert.match(ETATS_JETON[etat].message, /lien/i);
        }
    });
});

describe('TokenReinitialisationModel.creer', () => {

    afterEach(() => { delete pool.getConnection; });

    function fausseConnexion({ echecInsertion = false } = {}) {
        const journal = { requetes: [], commit: false, rollback: false, rendue: false };
        pool.getConnection = async () => ({
            async beginTransaction() {},
            async commit() { journal.commit = true; },
            async rollback() { journal.rollback = true; },
            release() { journal.rendue = true; },
            async query(sql, valeurs) {
                journal.requetes.push({ sql, valeurs });
                if (echecInsertion && /INSERT/.test(sql)) throw new Error('panne MySQL');
                return [{ affectedRows: 1 }];
            }
        });
        return journal;
    }

    test('invalide les anciens jetons du compte puis insère le nouveau, COMMIT', async () => {
        const journal = fausseConnexion();
        await TokenReinitialisationModel.creer(3, 'e'.repeat(64), 30);

        const [invalidation, insertion] = journal.requetes;
        assert.match(invalidation.sql, /UPDATE token_reinitialisation\s+SET utilise = 1/);
        assert.match(invalidation.sql, /utilisateur_id = \? AND utilise = 0/);
        assert.deepEqual(invalidation.valeurs, [3]);

        assert.match(insertion.sql, /INSERT INTO token_reinitialisation/);
        assert.match(insertion.sql, /DATE_ADD\(NOW\(\), INTERVAL \? MINUTE\)/);
        assert.deepEqual(insertion.valeurs, ['e'.repeat(64), 30, 3]);

        assert.equal(journal.commit, true);
        assert.equal(journal.rollback, false);
        assert.equal(journal.rendue, true);
    });

    test("seule l'empreinte est enregistrée (aucune colonne pour le jeton)", async () => {
        const journal = fausseConnexion();
        await TokenReinitialisationModel.creer(3, 'e'.repeat(64), 30);
        assert.match(journal.requetes[1].sql, /\(token_hash, expire_le, utilisateur_id\)/);
    });

    test('insertion en échec : ROLLBACK (les anciens liens restent valables), connexion rendue', async () => {
        const journal = fausseConnexion({ echecInsertion: true });
        await assert.rejects(TokenReinitialisationModel.creer(3, 'e'.repeat(64), 30), /panne MySQL/);
        assert.equal(journal.commit, false);
        assert.equal(journal.rollback, true);
        assert.equal(journal.rendue, true);
    });
});
