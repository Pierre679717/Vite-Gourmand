/* ================================================================
   TESTS/CATALOGUEMENUS.TEST.JS
   Gestion des menus par l'employé (models/catalogue.model.js,
   controllers/catalogue.controller.js)
   Lancement : cd backend && npm test
   ================================================================
   Une fausse connexion MySQL note les requêtes, le COMMIT et le
   ROLLBACK ; `repondre(sql, valeurs)` décide de ce que renvoie chaque
   requête (comme le ferait la base).
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CatalogueModel, ErreurCatalogue } = require('../models/catalogue.model');
const CatalogueController = require('../controllers/catalogue.controller');

function fausseConnexion(repondre) {
    const journal = { requetes: [], commit: false, rollback: false, rendue: false };
    pool.getConnection = async () => ({
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() { journal.rendue = true; },
        async query(sql, valeurs) {
            journal.requetes.push({ sql, valeurs });
            const reponse = repondre(sql, valeurs);
            if (reponse instanceof Error) throw reponse;
            return [reponse];
        }
    });
    return journal;
}

/** Réponses d'une base où les plats 1, 4 et 9 existent et le menu 3 aussi */
function baseNormale(modifs = {}) {
    return (sql, valeurs) => {
        if (/FROM plat WHERE plat_id IN/.test(sql)) {
            const existants = modifs.plats || [1, 4, 9];
            return valeurs[0].filter((id) => existants.includes(id)).map((plat_id) => ({ plat_id }));
        }
        if (/FROM menu WHERE menu_id = \? FOR UPDATE/.test(sql)) {
            return modifs.menuAbsent ? [] : [{ menu_id: 3, titre: 'Menu de Noël' }];
        }
        if (/COUNT\(\*\) AS total FROM commande/.test(sql)) return [{ total: modifs.commandes || 0 }];
        if (/^\s*INSERT INTO menu\s/.test(sql)) {
            return modifs.erreurInsert || { insertId: 12 };
        }
        return { affectedRows: 1 };
    };
}

const ecritures = (journal) => journal.requetes.filter((r) => !/^\s*SELECT/.test(r.sql));

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

const corpsMenu = (modifs = {}) => ({
    titre: 'Menu de Noël',
    description: 'Un repas de fête pour toute la famille.',
    conditions: 'Commander au moins 7 jours avant la prestation.',
    nombre_personne_min: 6, delai_minimum_jours: 7, prix_par_personne: 75,
    quantite_restante: 10, theme_id: 1, regime_id: 1, plats: [1, 4, 9],
    ...modifs
});

afterEach(() => { delete pool.getConnection; });

describe('création d\'un menu', () => {

    test('menu + une ligne menu_plat par plat, en une transaction', async () => {
        const journal = fausseConnexion(baseNormale());
        const id = await CatalogueModel.creerMenu(corpsMenu());

        assert.equal(id, 12);
        const [menu, effacement, composition] = ecritures(journal);
        assert.match(menu.sql, /INSERT INTO menu/);
        assert.equal(menu.valeurs[0], 'Menu de Noël');
        assert.match(effacement.sql, /DELETE FROM menu_plat/);
        assert.deepEqual(composition.valeurs, [[[12, 1], [12, 4], [12, 9]]]);
        assert.equal(journal.commit, true);
        assert.equal(journal.rendue, true);
    });

    test('plat inexistant : 400, rien n\'est écrit', async () => {
        const journal = fausseConnexion(baseNormale({ plats: [1, 4] }));
        await assert.rejects(CatalogueModel.creerMenu(corpsMenu()),
            (err) => err instanceof ErreurCatalogue && err.status === 400);
        assert.deepEqual(ecritures(journal), []);
        assert.equal(journal.rollback, true);
    });

    test('titre déjà pris : 409', async () => {
        fausseConnexion(baseNormale({ erreurInsert: Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }) }));
        await assert.rejects(CatalogueModel.creerMenu(corpsMenu()),
            (err) => err.status === 409 && /déjà ce nom/.test(err.message));
    });

    test('contrôleur : 201 avec l\'identifiant ; corps invalide : 400 sans requête', async () => {
        fausseConnexion(baseNormale());
        const res = fauxRes();
        await CatalogueController.creerMenu({ body: corpsMenu() }, res);
        assert.equal(res.statut, 201);
        assert.equal(res.corps.menu_id, 12);

        let appelee = false;
        pool.getConnection = async () => { appelee = true; };
        const invalide = fauxRes();
        await CatalogueController.creerMenu({ body: corpsMenu({ plats: [] }) }, invalide);
        assert.equal(invalide.statut, 400);
        assert.deepEqual(invalide.corps.erreurs, ['Choisissez au moins un plat.']);
        assert.equal(appelee, false);
    });
});

describe('modification d\'un menu', () => {

    test('menu verrouillé (FOR UPDATE), mis à jour, composition remplacée', async () => {
        const journal = fausseConnexion(baseNormale());
        await CatalogueModel.modifierMenu(3, corpsMenu({ plats: [4, 9] }));

        assert.match(journal.requetes[0].sql, /FOR UPDATE/);
        const [maj, effacement, composition] = ecritures(journal);
        assert.match(maj.sql, /UPDATE menu SET/);
        assert.equal(maj.valeurs.at(-1), 3);
        assert.deepEqual(effacement.valeurs, [3]);
        assert.deepEqual(composition.valeurs, [[[3, 4], [3, 9]]]);
        assert.equal(journal.commit, true);
    });

    test('menu inconnu : 404 et ROLLBACK', async () => {
        const journal = fausseConnexion(baseNormale({ menuAbsent: true }));
        await assert.rejects(CatalogueModel.modifierMenu(99, corpsMenu()), (err) => err.status === 404);
        assert.equal(journal.rollback, true);
    });

    test('contrôleur : id invalide → 404', async () => {
        const res = fauxRes();
        await CatalogueController.modifierMenu({ params: { id: 'abc' }, body: corpsMenu() }, res);
        assert.equal(res.statut, 404);
    });
});

describe('carte et suppression', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    test('retirer de la carte : actif = 0 ; actif doit être un booléen', async () => {
        const journal = [];
        pool.query = async (sql, valeurs) => { journal.push(valeurs); return [{ affectedRows: 1 }]; };
        const res = fauxRes();
        await CatalogueController.changerCarte({ params: { id: '3' }, body: { actif: false } }, res);
        assert.equal(res.statut, 200);
        assert.deepEqual(journal[0], [0, 3]);
        assert.equal(res.corps.message, 'Menu retiré de la carte.');

        const invalide = fauxRes();
        await CatalogueController.changerCarte({ params: { id: '3' }, body: { actif: 'non' } }, invalide);
        assert.equal(invalide.statut, 400);
    });

    test('menu jamais commandé : supprimé', async () => {
        const journal = fausseConnexion(baseNormale({ commandes: 0 }));
        const res = fauxRes();
        await CatalogueController.supprimerMenu({ params: { id: '3' } }, res);
        assert.equal(res.statut, 200);
        assert.deepEqual(ecritures(journal).map((r) => r.sql), ['DELETE FROM menu WHERE menu_id = ?']);
        assert.equal(journal.commit, true);
    });

    test('menu déjà commandé : 409, conseil de le retirer de la carte, rien supprimé', async () => {
        const journal = fausseConnexion(baseNormale({ commandes: 4 }));
        const res = fauxRes();
        await CatalogueController.supprimerMenu({ params: { id: '3' } }, res);
        assert.equal(res.statut, 409);
        assert.match(res.corps.error, /4 commandes.*Retirez-le plutôt de la carte/);
        assert.deepEqual(ecritures(journal), []);
        assert.equal(journal.rollback, true);
    });
});
