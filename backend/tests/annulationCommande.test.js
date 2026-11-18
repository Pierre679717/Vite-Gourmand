/* ================================================================
   TESTS/ANNULATIONCOMMANDE.TEST.JS
   POST /api/commandes/:id/annulation : le client annule sa commande
   Lancement : cd backend && npm test
   ================================================================
   Même principe que modificationCommande.test.js : une fausse
   connexion MySQL note les requêtes, le COMMIT et le ROLLBACK.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CommandeModel, ErreurCommande } = require('../models/commande.model');
const CommandeController = require('../controllers/commande.controller');

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

describe('CommandeModel.annulerParClient', () => {

    afterEach(() => { delete pool.getConnection; });

    test('en attente : statut annulee, unité rendue au stock, ligne de suivi, COMMIT', async () => {
        const journal = fausseConnexion({ numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 });

        const numero = await CommandeModel.annulerParClient(14, 3);

        assert.equal(numero, 'VG-2026-0014');
        const [statut, stock, suivi] = ecritures(journal);
        assert.match(statut.sql, /UPDATE commande SET statut = 'annulee'/);
        assert.deepEqual(statut.valeurs, [14]);
        assert.match(stock.sql, /quantite_restante = quantite_restante \+ 1/);
        assert.deepEqual(stock.valeurs, [2]);
        assert.match(suivi.sql, /INSERT INTO suivi_commande/);
        assert.match(suivi.sql, /'annulee'/);
        assert.equal(journal.commit, true);
        assert.equal(journal.rendue, true);
    });

    test('le SELECT filtre sur le client et verrouille la ligne', async () => {
        const journal = fausseConnexion({ numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 });

        await CommandeModel.annulerParClient(14, 3);

        assert.match(journal.requetes[0].sql, /commande_id = \? AND utilisateur_id = \?[\s\S]*FOR UPDATE/);
        assert.deepEqual(journal.requetes[0].valeurs, [14, 3]);
    });

    test('n\'enregistre ni mode de contact ni motif (réservés à l\'employé)', async () => {
        const journal = fausseConnexion({ numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 });

        await CommandeModel.annulerParClient(14, 3);

        assert.equal(journal.requetes.some((r) => /mode_contact|motif/.test(r.sql)), false);
    });

    for (const statut of ['accepte', 'en_preparation', 'terminee', 'annulee']) {
        test(`statut « ${statut} » : 409, aucune écriture, ROLLBACK`, async () => {
            const journal = fausseConnexion({ numero_commande: 'VG-2026-0014', statut, menu_id: 2 });

            await assert.rejects(
                CommandeModel.annulerParClient(14, 3),
                (err) => err instanceof ErreurCommande && err.status === 409
            );
            assert.equal(ecritures(journal).length, 0);
            assert.equal(journal.rollback, true);
        });
    }

    test('message adapté : « déjà annulée » ou « déjà prise en charge »', async () => {
        fausseConnexion({ numero_commande: 'VG-2026-0014', statut: 'annulee', menu_id: 2 });
        await assert.rejects(CommandeModel.annulerParClient(14, 3), { message: 'Cette commande est déjà annulée.' });

        fausseConnexion({ numero_commande: 'VG-2026-0014', statut: 'accepte', menu_id: 2 });
        await assert.rejects(CommandeModel.annulerParClient(14, 3), /prise en charge : elle ne peut plus être annulée en ligne/);
    });

    test('commande d\'un autre client ou inexistante : 404, aucune écriture', async () => {
        const journal = fausseConnexion(null);

        await assert.rejects(
            CommandeModel.annulerParClient(1, 3),
            (err) => err instanceof ErreurCommande && err.status === 404
        );
        assert.equal(ecritures(journal).length, 0);
    });
});

describe('POST /api/commandes/:id/annulation', () => {

    const original = CommandeModel.annulerParClient;
    afterEach(() => { CommandeModel.annulerParClient = original; });

    test('annulation réussie : 200 avec le numéro et le nouveau statut', async () => {
        let demande = null;
        CommandeModel.annulerParClient = async (id, utilisateurId) => { demande = { id, utilisateurId }; return 'VG-2026-0014'; };
        const res = fauxRes();

        await CommandeController.annuler({ params: { id: '14' }, user: { id: 3 } }, res);

        assert.deepEqual(demande, { id: 14, utilisateurId: 3 });
        assert.equal(res.statut, 200);
        assert.deepEqual(res.corps, { message: 'Commande VG-2026-0014 annulée.', numero_commande: 'VG-2026-0014', statut: 'annulee' });
    });

    test('erreur métier (409) transmise telle quelle', async () => {
        CommandeModel.annulerParClient = async () => { throw new ErreurCommande('Déjà prise en charge.', 409); };
        const res = fauxRes();

        await CommandeController.annuler({ params: { id: '14' }, user: { id: 3 } }, res);

        assert.equal(res.statut, 409);
        assert.deepEqual(res.corps, { error: 'Déjà prise en charge.' });
    });

    test('id invalide : 404 sans appeler le modèle', async () => {
        CommandeModel.annulerParClient = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await CommandeController.annuler({ params: { id: '0' }, user: { id: 3 } }, res);

        assert.equal(res.statut, 404);
    });

    test('erreur inattendue : 500 sans détail technique', async (t) => {
        t.mock.method(console, 'error', () => {});
        CommandeModel.annulerParClient = async () => { throw new Error('ECONNREFUSED'); };
        const res = fauxRes();

        await CommandeController.annuler({ params: { id: '14' }, user: { id: 3 } }, res);

        assert.equal(res.statut, 500);
        assert.deepEqual(res.corps, { error: 'Erreur serveur.' });
    });
});
