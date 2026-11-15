/* ================================================================
   TESTS/CATALOGUEPLATS.TEST.JS
   Gestion des plats et de leurs allergènes par l'employé
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CatalogueModel, ErreurCatalogue } = require('../models/catalogue.model');
const CatalogueController = require('../controllers/catalogue.controller');

function fausseConnexion(repondre) {
    const journal = { requetes: [], commit: false, rollback: false };
    pool.getConnection = async () => ({
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() {},
        async query(sql, valeurs) {
            journal.requetes.push({ sql, valeurs });
            const reponse = repondre(sql, valeurs);
            if (reponse instanceof Error) throw reponse;
            return [reponse];
        }
    });
    return journal;
}

/** Plat 7 « Bûche glacée » ; `menus` = titres des menus qui l'utilisent */
const base = ({ absent = false, menus = [], erreurAllergenes = null } = {}) => (sql) => {
    if (/FROM plat WHERE plat_id = \? FOR UPDATE/.test(sql)) return absent ? [] : [{ plat_id: 7, titre: 'Bûche glacée' }];
    if (/FROM menu_plat mp JOIN menu m/.test(sql)) return menus.map((titre) => ({ titre }));
    if (/^INSERT INTO plat \(/.test(sql)) return { insertId: 40 };
    if (/INSERT INTO plat_allergene/.test(sql) && erreurAllergenes) return erreurAllergenes;
    return { affectedRows: 1 };
};

const ecritures = (journal) => journal.requetes.filter((r) => !/^\s*SELECT/.test(r.sql));

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

afterEach(() => { delete pool.getConnection; });

describe('création et modification d\'un plat', () => {

    test('plat + une ligne par allergène, en une transaction', async () => {
        const journal = fausseConnexion(base());
        const id = await CatalogueModel.creerPlat({ titre: 'Bûche glacée', categorie: 'dessert', allergenes: [3, 7] });

        assert.equal(id, 40);
        const [plat, effacement, allergenes] = ecritures(journal);
        assert.deepEqual(plat.valeurs, ['Bûche glacée', 'dessert']);
        assert.match(effacement.sql, /DELETE FROM plat_allergene/);
        assert.deepEqual(allergenes.valeurs, [[[40, 3], [40, 7]]]);
        assert.equal(journal.commit, true);
    });

    test('sans allergène : aucun INSERT dans plat_allergene', async () => {
        const journal = fausseConnexion(base());
        await CatalogueModel.creerPlat({ titre: 'Salade verte', categorie: 'entree', allergenes: [] });
        assert.equal(ecritures(journal).some((r) => /INSERT INTO plat_allergene/.test(r.sql)), false);
    });

    test('allergène inconnu (clé étrangère) : 400 et ROLLBACK', async () => {
        const journal = fausseConnexion(base({
            erreurAllergenes: Object.assign(new Error('fk'), { code: 'ER_NO_REFERENCED_ROW_2' })
        }));
        await assert.rejects(
            CatalogueModel.creerPlat({ titre: 'Bûche', categorie: 'dessert', allergenes: [99] }),
            (err) => err instanceof ErreurCatalogue && err.status === 400
        );
        assert.equal(journal.rollback, true);
    });

    test('modification : plat verrouillé, allergènes remplacés ; plat inconnu → 404', async () => {
        const journal = fausseConnexion(base());
        await CatalogueModel.modifierPlat(7, { titre: 'Bûche glacée vanille', categorie: 'dessert', allergenes: [3] });
        assert.match(journal.requetes[0].sql, /FOR UPDATE/);
        assert.deepEqual(ecritures(journal)[0].valeurs, ['Bûche glacée vanille', 'dessert', 7]);

        fausseConnexion(base({ absent: true }));
        await assert.rejects(
            CatalogueModel.modifierPlat(99, { titre: 'X y z', categorie: 'plat', allergenes: [] }),
            (err) => err.status === 404
        );
    });

    test('contrôleur : 201 ; catégorie inconnue → 400 sans requête', async () => {
        fausseConnexion(base());
        const res = fauxRes();
        await CatalogueController.creerPlat({ body: { titre: 'Bûche glacée', categorie: 'dessert', allergenes: [3] } }, res);
        assert.equal(res.statut, 201);
        assert.equal(res.corps.plat_id, 40);

        let appelee = false;
        pool.getConnection = async () => { appelee = true; };
        const invalide = fauxRes();
        await CatalogueController.creerPlat({ body: { titre: 'Jus', categorie: 'boisson' } }, invalide);
        assert.equal(invalide.statut, 400);
        assert.equal(appelee, false);
    });
});

describe('suppression d\'un plat', () => {

    test('dans aucun menu : supprimé', async () => {
        const journal = fausseConnexion(base());
        const res = fauxRes();
        await CatalogueController.supprimerPlat({ params: { id: '7' } }, res);
        assert.equal(res.statut, 200);
        assert.equal(res.corps.message, 'Plat « Bûche glacée » supprimé.');
        assert.deepEqual(ecritures(journal).map((r) => r.sql), ['DELETE FROM plat WHERE plat_id = ?']);
    });

    test('présent dans des menus : 409 qui les nomme, rien supprimé', async () => {
        const journal = fausseConnexion(base({ menus: ['Menu de Noël', 'Menu Prestige'] }));
        const res = fauxRes();
        await CatalogueController.supprimerPlat({ params: { id: '7' } }, res);
        assert.equal(res.statut, 409);
        assert.equal(res.corps.error,
            '« Bûche glacée » est dans les menus « Menu de Noël », « Menu Prestige » : retirez-le d\'abord de ces menus.');
        assert.deepEqual(ecritures(journal), []);
        assert.equal(journal.rollback, true);
    });

    test('un seul menu : message au singulier', async () => {
        fausseConnexion(base({ menus: ['Menu de Noël'] }));
        const res = fauxRes();
        await CatalogueController.supprimerPlat({ params: { id: '7' } }, res);
        assert.match(res.corps.error, /est dans le menu « Menu de Noël » : retirez-le d'abord de ce menu\./);
    });
});

describe('liste des plats', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    test('chaque plat reçoit ses allergènes et ses menus', async () => {
        const reponses = [
            [{ plat_id: 1, titre: 'Velouté', categorie: 'entree' }, { plat_id: 2, titre: 'Salade', categorie: 'entree' }],
            [{ plat_id: 1, allergene_id: 7, libelle: 'Lait' }],
            [{ plat_id: 1, menu_id: 2, titre: 'Menu Traditionnel' }]
        ];
        pool.query = async () => [reponses.shift()];
        const plats = await CatalogueModel.listerPlats();
        assert.deepEqual(plats[0].allergenes, [{ allergene_id: 7, libelle: 'Lait' }]);
        assert.deepEqual(plats[0].menus, [{ menu_id: 2, titre: 'Menu Traditionnel' }]);
        assert.deepEqual(plats[1].allergenes, []);
        assert.deepEqual(plats[1].menus, []);
    });
});
