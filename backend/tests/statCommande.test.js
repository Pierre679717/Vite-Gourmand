/* ================================================================
   TESTS/STATCOMMANDE.TEST.JS
   Statistiques MongoDB : une panne de MongoDB ne bloque pas la commande
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { enregistrerStatCommande, StatCommande } = require('../models/statCommande.model');

describe('enregistrerStatCommande', () => {

    test('MongoDB non connecté : renvoie false tout de suite, sans erreur', async () => {
        const debut = Date.now();
        assert.equal(await enregistrerStatCommande({ commande_id: 1 }), false);
        assert.ok(Date.now() - debut < 1000, 'ne doit pas attendre le délai de 10 s de Mongoose');
    });

    test('le schéma refuse un document incomplet ou incohérent', () => {
        const erreur = new StatCommande({ commande_id: 1, nombre_personne: 0, prix_total: -5 }).validateSync();
        assert.ok(erreur.errors.numero_commande, 'numéro obligatoire');
        assert.ok(erreur.errors.menu_id, 'menu obligatoire');
        assert.ok(erreur.errors.nombre_personne, 'au moins 1 personne');
        assert.ok(erreur.errors.prix_total, 'prix positif');
    });

    test('un document complet est valide', () => {
        const stat = new StatCommande({
            commande_id: 10, numero_commande: 'VG-2026-0010', menu_id: 2, menu_titre: 'Menu Traditionnel',
            nombre_personne: 8, prix_total: 392.19, ville: 'Pessac', date_prestation: '2026-12-05'
        });
        assert.equal(stat.validateSync(), undefined);
        assert.equal(stat.statut, 'en_attente');
    });
});
