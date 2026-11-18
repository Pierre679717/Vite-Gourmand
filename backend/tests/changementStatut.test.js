/* ================================================================
   TESTS/CHANGEMENTSTATUT.TEST.JS
   PUT /api/employe/commandes/:id : l'employé fait avancer une commande
   Lancement : cd backend && npm test
   ================================================================
   Même principe que annulationCommande.test.js : une fausse
   connexion MySQL note les requêtes, le COMMIT et le ROLLBACK.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CommandeModel, ErreurCommande } = require('../models/commande.model');
const CommandeController = require('../controllers/commande.controller');
const { validerChangementStatut } = require('../controllers/commande.controller');

function fausseConnexion(commande) {
    const journal = { requetes: [], commit: false, rollback: false, rendue: false };
    pool.getConnection = async () => ({
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() { journal.rendue = true; },
        async query(sql, valeurs) {
            journal.requetes.push({ sql, valeurs });
            if (/^\s*SELECT/.test(sql)) return [commande ? [commande] : []];
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

/** Commande de test : VG-2026-0013, avec ou sans prêt de matériel */
const commande = (statut, pret = 0) => ({
    numero_commande: 'VG-2026-0013', statut, menu_id: 4, pret_materiel: pret,
    contact_prenom: 'Camille', contact_email: 'utilisateur@vite-gourmand.fr'
});

describe('validerChangementStatut', () => {

    test('un statut du parcours suffit (mode de contact et motif ignorés)', () => {
        const { donnees, erreurs } = validerChangementStatut({ statut: 'accepte', motif: 'x', mode_contact: 'gsm' });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, { statut: 'accepte', modeContact: null, motif: null });
    });

    test('refuse en_attente, un statut inconnu ou un corps vide', () => {
        assert.deepEqual(validerChangementStatut({ statut: 'en_attente' }).erreurs, ['Statut invalide.']);
        assert.deepEqual(validerChangementStatut({ statut: 'livree' }).erreurs, ['Statut invalide.']);
        assert.deepEqual(validerChangementStatut(undefined).erreurs, ['Statut invalide.']);
    });

    test('annulation : mode de contact et motif obligatoires', () => {
        const { erreurs } = validerChangementStatut({ statut: 'annulee' });
        assert.equal(erreurs.length, 2);
        assert.match(erreurs[0], /gsm ou mail/);
        assert.match(erreurs[1], /motif/);
    });

    test('annulation : motif nettoyé, trop court ou non texte refusé', () => {
        const ok = validerChangementStatut({ statut: 'annulee', mode_contact: 'mail', motif: '  Client absent ce jour-là  ' });
        assert.deepEqual(ok.donnees, { statut: 'annulee', modeContact: 'mail', motif: 'Client absent ce jour-là' });
        assert.equal(validerChangementStatut({ statut: 'annulee', mode_contact: 'gsm', motif: '   ab   ' }).erreurs.length, 1);
        assert.equal(validerChangementStatut({ statut: 'annulee', mode_contact: 'gsm', motif: 12345 }).erreurs.length, 1);
        assert.equal(validerChangementStatut({ statut: 'annulee', mode_contact: 'sms', motif: 'Client absent' }).erreurs.length, 1);
    });
});

describe('CommandeModel.changerStatut', () => {

    afterEach(() => { delete pool.getConnection; });

    test('étape suivante : statut, ligne de suivi avec l\'employé, COMMIT', async () => {
        const journal = fausseConnexion(commande('accepte'));

        const resultat = await CommandeModel.changerStatut({ commandeId: 13, statut: 'en_preparation', employeId: 2 });

        const [maj, suivi] = ecritures(journal);
        assert.match(maj.sql, /UPDATE commande SET statut = \? WHERE/);
        assert.deepEqual(maj.valeurs, ['en_preparation', 13]);
        assert.deepEqual(suivi.valeurs, [13, 'en_preparation', 2]);
        assert.equal(journal.commit, true);
        assert.equal(journal.rendue, true);
        assert.equal(resultat.numeroCommande, 'VG-2026-0013');
        assert.equal(resultat.contactEmail, 'utilisateur@vite-gourmand.fr');
    });

    test('la commande est relue avec FOR UPDATE', async () => {
        const journal = fausseConnexion(commande('accepte'));
        await CommandeModel.changerStatut({ commandeId: 13, statut: 'en_preparation', employeId: 2 });
        assert.match(journal.requetes[0].sql, /FOR UPDATE/);
        assert.deepEqual(journal.requetes[0].valeurs, [13]);
    });

    test('prêt de matériel : livre -> terminee refusé (409), rien n\'est écrit', async () => {
        const journal = fausseConnexion(commande('livre', 1));

        await assert.rejects(
            CommandeModel.changerStatut({ commandeId: 13, statut: 'terminee', employeId: 2 }),
            (err) => err instanceof ErreurCommande && err.status === 409 && /retour de matériel/.test(err.message)
        );
        assert.deepEqual(ecritures(journal), []);
        assert.equal(journal.rollback, true);
        assert.equal(journal.rendue, true);
    });

    test('retour de matériel -> terminee : materiel_restitue = 1', async () => {
        const journal = fausseConnexion(commande('attente_retour_materiel', 1));

        await CommandeModel.changerStatut({ commandeId: 13, statut: 'terminee', employeId: 2 });

        const [maj] = ecritures(journal);
        assert.match(maj.sql, /materiel_restitue = 1/);
        assert.deepEqual(maj.valeurs, ['terminee', 13]);
    });

    test('sans prêt : livre -> terminee ne touche pas materiel_restitue', async () => {
        const journal = fausseConnexion(commande('livre', 0));
        await CommandeModel.changerStatut({ commandeId: 13, statut: 'terminee', employeId: 2 });
        assert.equal(ecritures(journal).some((r) => /materiel_restitue/.test(r.sql)), false);
    });

    test('annulation : mode de contact, motif et unité rendue au stock', async () => {
        const journal = fausseConnexion(commande('en_preparation'));

        await CommandeModel.changerStatut({
            commandeId: 13, statut: 'annulee', employeId: 2, modeContact: 'gsm', motif: 'Client hospitalisé'
        });

        const [maj, stock, suivi] = ecritures(journal);
        assert.deepEqual(maj.valeurs, ['annulee', 'gsm', 'Client hospitalisé', 13]);
        assert.match(stock.sql, /quantite_restante = quantite_restante \+ 1/);
        assert.deepEqual(stock.valeurs, [4]);
        assert.deepEqual(suivi.valeurs, [13, 'annulee', 2]);
    });

    test('retour en arrière ou commande clôturée : 409 et ROLLBACK', async () => {
        for (const [ancien, nouveau] of [['en_preparation', 'accepte'], ['terminee', 'annulee'], ['annulee', 'accepte']]) {
            const journal = fausseConnexion(commande(ancien));
            await assert.rejects(
                CommandeModel.changerStatut({ commandeId: 13, statut: nouveau, employeId: 2 }),
                (err) => err.status === 409
            );
            assert.equal(journal.rollback, true);
        }
    });

    test('commande inconnue : 404', async () => {
        fausseConnexion(null);
        await assert.rejects(
            CommandeModel.changerStatut({ commandeId: 999, statut: 'accepte', employeId: 2 }),
            (err) => err.status === 404
        );
    });
});

describe('CommandeController.mettreAJourStatut', () => {

    afterEach(() => { delete pool.getConnection; });

    test('200 avec le numéro et le nouveau statut', async () => {
        fausseConnexion(commande('en_attente'));
        const res = fauxRes();

        await CommandeController.mettreAJourStatut(
            { params: { id: '13' }, body: { statut: 'accepte' }, user: { id: 2 } }, res);

        assert.equal(res.statut, 200);
        assert.deepEqual(res.corps, {
            message: 'Commande VG-2026-0013 : statut mis à jour.', numero_commande: 'VG-2026-0013', statut: 'accepte'
        });
    });

    test('id invalide : 404 sans toucher à la base', async () => {
        let appelee = false;
        pool.getConnection = async () => { appelee = true; };
        const res = fauxRes();

        await CommandeController.mettreAJourStatut({ params: { id: '13abc' }, body: { statut: 'accepte' }, user: { id: 2 } }, res);

        assert.equal(res.statut, 404);
        assert.equal(appelee, false);
    });

    test('annulation sans motif : 400 avec la liste des erreurs', async () => {
        const res = fauxRes();
        await CommandeController.mettreAJourStatut(
            { params: { id: '13' }, body: { statut: 'annulee', mode_contact: 'gsm' }, user: { id: 2 } }, res);
        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 1);
    });

    test('étape non permise : 409 avec le message du parcours', async () => {
        fausseConnexion(commande('livre', 1));
        const res = fauxRes();

        await CommandeController.mettreAJourStatut(
            { params: { id: '13' }, body: { statut: 'terminee' }, user: { id: 2 } }, res);

        assert.equal(res.statut, 409);
        assert.match(res.corps.error, /retour de matériel/);
    });
});
