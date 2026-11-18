/* ================================================================
   TESTS/PRIX.TEST.JS
   Tests des règles de prix (utils/prix.js)
   Les cas reprennent les commandes de test de database/vite_gourmand.sql
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { calculerPrixCommande, estBordeaux } = require('../utils/prix');

describe('calculerPrixCommande', () => {

    test('commande 1 : 12 pers. x 65 EUR à Bordeaux, réduction de 10 %', () => {
        assert.deepEqual(
            calculerPrixCommande({ prixParPersonne: 65, nombrePersonneMin: 6, nombrePersonne: 12, ville: 'Bordeaux', distanceKm: 0 }),
            { distance_km: 0, prix_par_personne: 65, reduction: 78, prix_menu: 702, prix_livraison: 0, prix_total: 702 }
        );
    });

    test('commande 2 : 8 pers. x 48 EUR à 12 km, sans réduction', () => {
        assert.deepEqual(
            calculerPrixCommande({ prixParPersonne: 48, nombrePersonneMin: 6, nombrePersonne: 8, ville: 'Mérignac', distanceKm: 12 }),
            { distance_km: 12, prix_par_personne: 48, reduction: 0, prix_menu: 384, prix_livraison: 12.08, prix_total: 396.08 }
        );
    });

    test('commande 8 : 15 pers. x 85 EUR à 65 km, réduction et livraison', () => {
        const prix = calculerPrixCommande({ prixParPersonne: 85, nombrePersonneMin: 10, nombrePersonne: 15, ville: 'Arcachon', distanceKm: 65 });
        assert.equal(prix.reduction, 127.5);
        assert.equal(prix.prix_livraison, 43.35);
        assert.equal(prix.prix_total, 1190.85);
    });

    test('réduction : pas à minimum + 4, oui à minimum + 5', () => {
        const base = { prixParPersonne: 48, nombrePersonneMin: 6, ville: 'Bordeaux', distanceKm: 0 };
        assert.equal(calculerPrixCommande({ ...base, nombrePersonne: 10 }).reduction, 0);
        assert.equal(calculerPrixCommande({ ...base, nombrePersonne: 11 }).reduction, 52.8);
    });

    test('distance décimale : 5 + 0,59 x 5,4 = 8,186 arrondi à 8,19', () => {
        const prix = calculerPrixCommande({ prixParPersonne: 48, nombrePersonneMin: 6, nombrePersonne: 8, ville: 'Pessac', distanceKm: 5.4 });
        assert.equal(prix.prix_livraison, 8.19);
        assert.equal(prix.prix_total, 392.19);
    });

    test('à Bordeaux, la distance envoyée est ignorée', () => {
        const prix = calculerPrixCommande({ prixParPersonne: 48, nombrePersonneMin: 6, nombrePersonne: 8, ville: 'BORDEAUX', distanceKm: 30 });
        assert.equal(prix.distance_km, 0);
        assert.equal(prix.prix_livraison, 0);
    });

    test('pas d\'erreur d\'arrondi : total = prix du menu + livraison, au centime', () => {
        const prix = calculerPrixCommande({ prixParPersonne: 42.1, nombrePersonneMin: 6, nombrePersonne: 13, ville: 'Talence', distanceKm: 3.3 });
        assert.equal(Math.round((prix.prix_menu + prix.prix_livraison) * 100), Math.round(prix.prix_total * 100));
    });
});

describe('estBordeaux', () => {
    test('insensible à la casse et aux espaces', () => {
        assert.equal(estBordeaux(' bordeaux '), true);
        assert.equal(estBordeaux('BORDEAUX'), true);
        assert.equal(estBordeaux('Bordeaux-Lac'), false);
        assert.equal(estBordeaux(undefined), false);
    });
});
