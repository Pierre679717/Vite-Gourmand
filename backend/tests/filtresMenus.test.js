/* ================================================================
   TESTS/FILTRESMENUS.TEST.JS
   Tests unitaires de la validation des filtres des menus.
   Lancement : cd backend && npm test
   (node:test est intégré à Node : aucune dépendance à installer)
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validerFiltresMenus, validerId } = require('../utils/filtresMenus');

describe('validerFiltresMenus', () => {

    test('sans paramètre : aucun filtre, aucune erreur', () => {
        assert.deepEqual(validerFiltresMenus({}), { filtres: {}, erreurs: [] });
    });

    test('convertit les paramètres valides en nombres', () => {
        const { filtres, erreurs } = validerFiltresMenus({
            prix_min: '300', prix_max: '450.50', theme: '2', regime: '3', personnes: '8'
        });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(filtres, {
            prixMin: 300, prixMax: 450.5, themeId: 2, regimeId: 3, personnes: 8
        });
    });

    test('un paramètre vide est ignoré', () => {
        const { filtres, erreurs } = validerFiltresMenus({ theme: '', prix_max: '  ' });
        assert.deepEqual(filtres, {});
        assert.deepEqual(erreurs, []);
    });

    test('les paramètres inconnus sont ignorés', () => {
        const { filtres, erreurs } = validerFiltresMenus({ tri: 'prix', regime: '1' });
        assert.deepEqual(filtres, { regimeId: 1 });
        assert.deepEqual(erreurs, []);
    });

    for (const valeur of ['abc', '12abc', '-5', '1e3', '45.555', '0x10', '1000000']) {
        test(`prix_max invalide refusé : "${valeur}"`, () => {
            const { filtres, erreurs } = validerFiltresMenus({ prix_max: valeur });
            assert.equal(filtres.prixMax, undefined);
            assert.equal(erreurs.length, 1);
        });
    }

    for (const valeur of ['0', '-1', '2.5', '1 OR 1=1', "1'; DROP TABLE menu;--"]) {
        test(`theme invalide refusé : "${valeur}"`, () => {
            const { erreurs } = validerFiltresMenus({ theme: valeur });
            assert.equal(erreurs.length, 1);
        });
    }

    test('personnes au-delà de 1000 refusé', () => {
        assert.equal(validerFiltresMenus({ personnes: '1001' }).erreurs.length, 1);
    });

    test('paramètre en double (tableau) refusé', () => {
        const { erreurs } = validerFiltresMenus({ theme: ['1', '2'] });
        assert.equal(erreurs.length, 1);
    });

    test('fourchette inversée refusée', () => {
        const { erreurs } = validerFiltresMenus({ prix_min: '500', prix_max: '300' });
        assert.deepEqual(erreurs, ['prix_min doit être inférieur ou égal à prix_max.']);
    });

    test('fourchette d’un seul prix acceptée (min = max)', () => {
        const { filtres, erreurs } = validerFiltresMenus({ prix_min: '390', prix_max: '390' });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(filtres, { prixMin: 390, prixMax: 390 });
    });

    test('plusieurs erreurs sont toutes renvoyées', () => {
        const { erreurs } = validerFiltresMenus({ prix_min: 'x', regime: 'y', personnes: '0' });
        assert.equal(erreurs.length, 3);
    });
});

describe('validerId', () => {
    test('accepte un entier positif', () => {
        assert.equal(validerId('7'), 7);
    });
    for (const valeur of ['0', 'abc', '7abc', '-1', '1.5', '99999999999', undefined]) {
        test(`refuse "${valeur}"`, () => {
            assert.equal(validerId(valeur), null);
        });
    }
});
