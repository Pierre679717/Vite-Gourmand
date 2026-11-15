/* ================================================================
   TESTS/STATUTSCOMMANDE.TEST.JS
   Règles de changement de statut (utils/statutsCommande.js)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    STATUTS, etapeSuivante, statutsSuivants, verifierTransition
} = require('../utils/statutsCommande');

describe('etapeSuivante', () => {

    test('parcours complet sans prêt de matériel', () => {
        const parcours = ['en_attente'];
        let statut = 'en_attente';
        while ((statut = etapeSuivante(statut, false))) parcours.push(statut);
        assert.deepEqual(parcours,
            ['en_attente', 'accepte', 'en_preparation', 'en_cours_livraison', 'livre', 'terminee']);
    });

    test('parcours complet avec prêt de matériel : passe par le retour de matériel', () => {
        const parcours = ['en_attente'];
        let statut = 'en_attente';
        while ((statut = etapeSuivante(statut, true))) parcours.push(statut);
        assert.deepEqual(parcours, ['en_attente', 'accepte', 'en_preparation', 'en_cours_livraison',
            'livre', 'attente_retour_materiel', 'terminee']);
    });

    test('aucune étape après terminee, annulee ou un statut inconnu', () => {
        assert.equal(etapeSuivante('terminee', true), null);
        assert.equal(etapeSuivante('annulee', false), null);
        assert.equal(etapeSuivante('n_importe_quoi', false), null);
    });
});

describe('statutsSuivants', () => {

    test('annulation proposée tant que la commande n\'est pas partie', () => {
        assert.deepEqual(statutsSuivants('en_attente', false), ['accepte', 'annulee']);
        assert.deepEqual(statutsSuivants('accepte', false), ['en_preparation', 'annulee']);
        assert.deepEqual(statutsSuivants('en_preparation', true), ['en_cours_livraison', 'annulee']);
    });

    test('plus d\'annulation à partir de la livraison', () => {
        assert.deepEqual(statutsSuivants('en_cours_livraison', false), ['livre']);
        assert.deepEqual(statutsSuivants('livre', false), ['terminee']);
        assert.deepEqual(statutsSuivants('livre', true), ['attente_retour_materiel']);
        assert.deepEqual(statutsSuivants('attente_retour_materiel', true), ['terminee']);
    });

    test('rien pour une commande clôturée', () => {
        assert.deepEqual(statutsSuivants('terminee', false), []);
        assert.deepEqual(statutsSuivants('annulee', true), []);
    });
});

describe('verifierTransition', () => {

    test('accepte chaque étape du parcours, une à la fois', () => {
        assert.equal(verifierTransition('en_attente', 'accepte', false), null);
        assert.equal(verifierTransition('en_cours_livraison', 'livre', true), null);
        assert.equal(verifierTransition('livre', 'terminee', false), null);
        assert.equal(verifierTransition('livre', 'attente_retour_materiel', true), null);
        assert.equal(verifierTransition('attente_retour_materiel', 'terminee', true), null);
    });

    test('prêt de matériel : livre -> terminee refusé (cas de VG-2026-0013)', () => {
        assert.match(verifierTransition('livre', 'terminee', true), /retour de matériel/);
    });

    test('sans prêt de matériel : pas de passage par le retour de matériel', () => {
        assert.match(verifierTransition('livre', 'attente_retour_materiel', false), /impossible/);
    });

    test('refuse de sauter une étape', () => {
        assert.match(verifierTransition('en_attente', 'en_preparation', false),
            /l'étape suivante est « Acceptée »/);
        assert.match(verifierTransition('accepte', 'terminee', false), /impossible/);
    });

    test('refuse le retour en arrière et le même statut', () => {
        assert.match(verifierTransition('en_preparation', 'accepte', false), /impossible/);
        assert.match(verifierTransition('accepte', 'accepte', false), /impossible/);
        assert.match(verifierTransition('livre', 'en_attente', false), /impossible/);
    });

    test('annulation : permise avant le départ, refusée ensuite', () => {
        assert.equal(verifierTransition('en_preparation', 'annulee', false), null);
        assert.match(verifierTransition('en_cours_livraison', 'annulee', false), /partie en livraison/);
        assert.match(verifierTransition('livre', 'annulee', true), /partie en livraison/);
    });

    test('commande clôturée : plus aucun changement', () => {
        for (const nouveau of STATUTS) {
            assert.match(verifierTransition('terminee', nouveau, false), /clôturée/);
            assert.match(verifierTransition('annulee', nouveau, true), /clôturée/);
        }
    });
});
