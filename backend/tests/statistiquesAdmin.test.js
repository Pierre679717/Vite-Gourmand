/* ================================================================
   TESTS/STATISTIQUESADMIN.TEST.JS
   Statistiques de l'administrateur (MongoDB, collection commandes_stats)
   Lancement : cd backend && npm test
   ================================================================
   La requête d'agrégation est vérifiée telle qu'elle est fabriquée :
   pas besoin de MongoDB pour ces tests. Elle a aussi été essayée sur
   un vrai MongoDB 8 (fuseau horaire, annulées, arrondi) avant livraison.
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validerFiltresStats, construirePipeline, totaliser, dateValide } = require('../utils/filtresStats');
const AdminController = require('../controllers/admin.controller');

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

describe('validerFiltresStats', () => {

    test('aucun filtre (absent ou vide) : toutes les commandes', () => {
        const attendu = { filtres: { menuId: null, debut: null, fin: null }, erreur: null };
        assert.deepEqual(validerFiltresStats({}), attendu);
        assert.deepEqual(validerFiltresStats({ menu_id: '', debut: '', fin: '' }), attendu);
        assert.deepEqual(validerFiltresStats(undefined), attendu);
    });

    test('menu et période valides', () => {
        assert.deepEqual(
            validerFiltresStats({ menu_id: '2', debut: '2026-10-01', fin: '2026-10-31' }),
            { filtres: { menuId: 2, debut: '2026-10-01', fin: '2026-10-31' }, erreur: null }
        );
        // Une seule borne suffit, et un seul jour (début = fin) est permis
        assert.equal(validerFiltresStats({ debut: '2026-10-01' }).erreur, null);
        assert.equal(validerFiltresStats({ debut: '2026-10-01', fin: '2026-10-01' }).erreur, null);
    });

    test('menu invalide refusé', () => {
        for (const menu_id of ['abc', '0', '-1', '1.5', '1 OR 1=1']) {
            assert.ok(validerFiltresStats({ menu_id }).erreur, menu_id);
        }
    });

    test('dates impossibles ou mal écrites refusées', () => {
        for (const debut of ['2026-11-31', '2026-02-29', '16/11/2026', '2026-1-5', 'demain']) {
            assert.ok(validerFiltresStats({ debut }).erreur, debut);
        }
        assert.equal(dateValide('2028-02-29'), true, 'année bissextile');
    });

    test('début après la fin refusé', () => {
        assert.match(validerFiltresStats({ debut: '2026-11-02', fin: '2026-11-01' }).erreur, /précéder/);
    });

    test('paramètre répété ou objet (tentative d\'injection) refusé', () => {
        assert.ok(validerFiltresStats({ menu_id: ['1', '2'] }).erreur);
        assert.ok(validerFiltresStats({ debut: { $gt: '' } }).erreur);
    });
});

describe('construirePipeline', () => {

    const etapes = (pipeline) => pipeline.map((e) => Object.keys(e)[0]);
    const groupe = (pipeline) => pipeline.find((e) => e.$group).$group;

    test('sans filtre : regroupement par menu, sans $match', () => {
        const pipeline = construirePipeline({});
        assert.deepEqual(etapes(pipeline), ['$sort', '$group', '$project', '$sort']);
        assert.equal(groupe(pipeline)._id, '$menu_id');
    });

    test('commandes annulées : exclues du nombre et du chiffre d\'affaires, comptées à part', () => {
        const g = groupe(construirePipeline({}));
        const annulee = { $eq: ['$statut', 'annulee'] };
        assert.deepEqual(g.nombre_commandes, { $sum: { $cond: [annulee, 0, 1] } });
        assert.deepEqual(g.nombre_annulees, { $sum: { $cond: [annulee, 1, 0] } });
        assert.deepEqual(g.chiffre_affaires, { $sum: { $cond: [annulee, 0, '$prix_total'] } });
    });

    test('filtre par menu en premier ($eq : la valeur n\'est jamais interprétée)', () => {
        const pipeline = construirePipeline({ menuId: 3 });
        assert.deepEqual(pipeline[0], { $match: { menu_id: { $eq: 3 } } });
    });

    test('période : jour de la commande à l\'heure de Paris, bornes incluses', () => {
        const pipeline = construirePipeline({ debut: '2026-10-01', fin: '2026-10-31' });
        assert.deepEqual(etapes(pipeline).slice(0, 2), ['$addFields', '$match']);
        assert.equal(pipeline[0].$addFields.jour.$dateToString.timezone, 'Europe/Paris');
        assert.deepEqual(pipeline[1], { $match: { jour: { $gte: '2026-10-01', $lte: '2026-10-31' } } });
    });

    test('une seule borne de période', () => {
        assert.deepEqual(construirePipeline({ fin: '2026-10-31' })[1], { $match: { jour: { $lte: '2026-10-31' } } });
    });

    test('chiffre d\'affaires arrondi au centime, menus triés du plus rentable au moins rentable', () => {
        const pipeline = construirePipeline({});
        const projection = pipeline.find((e) => e.$project).$project;
        assert.deepEqual(projection.chiffre_affaires, { $round: ['$chiffre_affaires', 2] });
        assert.deepEqual(pipeline.at(-1), { $sort: { chiffre_affaires: -1, menu_titre: 1 } });
    });
});

describe('totaliser', () => {

    test('additionne les lignes et arrondit au centime (0,1 + 0,2)', () => {
        const totaux = totaliser([
            { nombre_commandes: 2, nombre_annulees: 1, chiffre_affaires: 0.1 },
            { nombre_commandes: 3, nombre_annulees: 0, chiffre_affaires: 0.2 }
        ]);
        assert.deepEqual(totaux, { nombre_commandes: 5, nombre_annulees: 1, chiffre_affaires: 0.3 });
    });

    test('aucune commande : zéros', () => {
        assert.deepEqual(totaliser([]), { nombre_commandes: 0, nombre_annulees: 0, chiffre_affaires: 0 });
    });
});

describe('AdminController.statistiques', () => {

    test('filtre invalide : 400', async () => {
        const res = fauxRes();
        await AdminController.statistiques({ query: { debut: '2026-13-01' } }, res);
        assert.equal(res.statut, 400);
    });

    test('MongoDB non connecté : 503 avec un message clair (pas d\'attente de 10 s)', async () => {
        const res = fauxRes();
        const debut = Date.now();
        await AdminController.statistiques({ query: {} }, res);
        assert.equal(res.statut, 503);
        assert.match(res.corps.error, /MongoDB/);
        assert.ok(Date.now() - debut < 1000);
    });
});
