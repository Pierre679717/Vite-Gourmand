/* ================================================================
   TESTS/SYNCHROSTATS.TEST.JS
   Script de synchronisation MySQL → MongoDB (commandes_stats)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { versDocumentStat, operationsSynchro } = require('../scripts/synchroniser-stats');

const ligne = (modifs = {}) => ({
    commande_id: 3, numero_commande: 'VG-2026-0003', menu_id: 2, menu_titre: 'Menu Prestige',
    nombre_personne: 10, prix_total: 850, reduction: 0, prix_livraison: 0,
    ville_prestation: 'Bordeaux', date_prestation: '2026-10-03', date_commande: '2026-09-20 14:05:00',
    statut: 'terminee', ...modifs
});

describe('versDocumentStat', () => {

    test('mêmes champs que ceux écrits par le site, statut compris', () => {
        const doc = versDocumentStat(ligne());
        assert.deepEqual(Object.keys(doc).sort(), [
            'commande_id', 'date_commande', 'date_prestation', 'menu_id', 'menu_titre', 'nombre_personne',
            'numero_commande', 'prix_livraison', 'prix_total', 'reduction', 'statut', 'ville'
        ]);
        assert.equal(doc.ville, 'Bordeaux');
        assert.equal(doc.statut, 'terminee');
        assert.equal(doc.date_prestation, '2026-10-03');
    });

    test('date de commande convertie en vraie date (pour le filtre de période)', () => {
        const doc = versDocumentStat(ligne());
        assert.ok(doc.date_commande instanceof Date);
        assert.ok(!Number.isNaN(doc.date_commande.getTime()));
        assert.equal(doc.date_commande.getDate(), 20);
        assert.equal(doc.date_commande.getHours(), 14);
    });

    test('prix en nombres, même si MySQL les renvoie en texte', () => {
        const doc = versDocumentStat(ligne({ prix_total: '539.40', reduction: '59.94', prix_livraison: '5.00' }));
        assert.equal(doc.prix_total, 539.4);
        assert.equal(doc.reduction, 59.94);
        assert.equal(doc.prix_livraison, 5);
    });
});

describe('operationsSynchro', () => {

    test('un upsert par commande, repéré par commande_id : relancer ne crée pas de doublon', () => {
        const operations = operationsSynchro([ligne(), ligne({ commande_id: 4, numero_commande: 'VG-2026-0004' })]);
        assert.equal(operations.length, 2);
        const { filter, update, upsert } = operations[1].updateOne;
        assert.deepEqual(filter, { commande_id: 4 });
        assert.equal(upsert, true);
        assert.equal(update.$set.numero_commande, 'VG-2026-0004');
    });

    test('aucune commande : aucune opération', () => {
        assert.deepEqual(operationsSynchro([]), []);
    });
});
