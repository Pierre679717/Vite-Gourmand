/* ================================================================
   TESTS/MODIFICATIONCOMMANDE.TEST.JS
   PUT /api/commandes/:id : le client modifie sa commande en attente
   Lancement : cd backend && npm test
   ================================================================
   La base n'est pas utilisée : pool.getConnection renvoie une fausse
   connexion qui répond aux requêtes et note tout ce qu'on lui demande
   (requêtes, COMMIT, ROLLBACK).
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CommandeModel, ErreurCommande } = require('../models/commande.model');
const CommandeController = require('../controllers/commande.controller');
const { validerModification } = require('../utils/validationCommande');
const { mettreAJourStatCommande } = require('../models/statCommande.model');

const AUJOURDHUI = '2026-11-12';

/** Corps valide d'une modification (VG-2026-0014) */
function corpsValide(modifs = {}) {
    return {
        nombre_personne: 12,
        date_prestation: '2026-12-05',
        heure_livraison: '19:00',
        adresse_prestation: '7 cours de l\'Intendance',
        ville_prestation: 'Bordeaux',
        pret_materiel: true,
        contact_nom: 'Laurent',
        contact_prenom: 'Camille',
        contact_email: 'utilisateur@vite-gourmand.fr',
        contact_telephone: '06 98 76 54 32',
        ...modifs
    };
}

/** Données validées, telles que le contrôleur les passe au modèle */
function donneesValides(modifs = {}) {
    return { ...validerModification(corpsValide(), AUJOURDHUI).donnees, ...modifs };
}

const MENU_TRADITIONNEL = {
    menu_id: 2, titre: 'Menu Traditionnel', nombre_personne_min: 6, delai_minimum_jours: 7,
    prix_par_personne: 48, quantite_restante: 0 // stock épuisé : sans effet sur une modification
};

/**
 * Fausse connexion : `commande` = ligne renvoyée par le SELECT ... FOR UPDATE
 * (null = aucune ligne), `menu` = ligne du menu.
 */
function fausseConnexion({ commande, menu = MENU_TRADITIONNEL }) {
    const journal = { requetes: [], commit: false, rollback: false, rendue: false };
    const conn = {
        journal,
        async beginTransaction() {},
        async commit() { journal.commit = true; },
        async rollback() { journal.rollback = true; },
        release() { journal.rendue = true; },
        async query(sql, valeurs) {
            journal.requetes.push({ sql, valeurs });
            if (/FROM commande/.test(sql)) return [commande ? [commande] : []];
            if (/FROM menu/.test(sql)) return [menu ? [menu] : []];
            return [{ affectedRows: 1 }];
        }
    };
    pool.getConnection = async () => conn;
    return journal;
}

const prixFictif = () => ({
    distance_km: 0, prix_par_personne: 48, reduction: 57.6, prix_menu: 518.4, prix_livraison: 0, prix_total: 518.4
});

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

describe('validerModification', () => {

    test('mêmes règles que la commande, sans le menu', () => {
        const { donnees, erreurs } = validerModification(corpsValide(), AUJOURDHUI);
        assert.deepEqual(erreurs, []);
        assert.equal('menuId' in donnees, false);
        assert.equal(donnees.contactTelephone, '0698765432');
    });

    test('un menu_id envoyé (même différent) est ignoré', () => {
        const { donnees, erreurs } = validerModification(corpsValide({ menu_id: 9 }), AUJOURDHUI);
        assert.deepEqual(erreurs, []);
        assert.equal('menuId' in donnees, false);
    });

    test('les erreurs habituelles sont toujours détectées', () => {
        const { erreurs } = validerModification(
            corpsValide({ date_prestation: AUJOURDHUI, contact_email: 'pas-un-mail', nombre_personne: 0 }),
            AUJOURDHUI
        );
        assert.equal(erreurs.length, 3);
    });
});

describe('CommandeModel.modifierParClient', () => {

    afterEach(() => { delete pool.getConnection; });

    const parametres = (donnees = donneesValides()) => ({ commandeId: 14, utilisateurId: 3, donnees, aujourdhui: AUJOURDHUI });

    test('commande en attente : mise à jour avec le prix recalculé, COMMIT, stock inchangé', async () => {
        const journal = fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 } });
        let menuRecu = null;

        const resultat = await CommandeModel.modifierParClient(parametres(), (menu) => { menuRecu = menu; return prixFictif(); });

        assert.equal(resultat.numeroCommande, 'VG-2026-0014');
        assert.equal(resultat.prix.prix_total, 518.4);
        assert.equal(menuRecu.menu_id, 2, 'le prix est calculé avec le menu de la commande');
        assert.equal(journal.commit, true);
        assert.equal(journal.rendue, true);

        const update = journal.requetes.find((r) => /^\s*UPDATE commande/.test(r.sql));
        assert.ok(update, 'la commande est mise à jour');
        assert.equal(update.valeurs.at(-1), 14, 'WHERE commande_id = 14');
        assert.equal(update.valeurs.includes(518.4), true, 'prix recalculé enregistré');
        assert.equal(journal.requetes.some((r) => /UPDATE menu/.test(r.sql)), false, 'le stock ne bouge pas');
        assert.equal(journal.requetes.some((r) => /INSERT INTO suivi_commande/.test(r.sql)), false, 'le statut ne change pas');
    });

    test('le SELECT filtre sur le client et verrouille la ligne', async () => {
        const journal = fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 } });

        await CommandeModel.modifierParClient(parametres(), prixFictif);

        const select = journal.requetes[0];
        assert.match(select.sql, /commande_id = \? AND utilisateur_id = \?/);
        assert.match(select.sql, /FOR UPDATE/);
        assert.deepEqual(select.valeurs, [14, 3]);
    });

    test('le menu est relu même s\'il a été retiré de la carte', async () => {
        const journal = fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 } });

        await CommandeModel.modifierParClient(parametres(), prixFictif);

        const selectMenu = journal.requetes.find((r) => /FROM menu/.test(r.sql));
        assert.doesNotMatch(selectMenu.sql, /actif = 1/);
    });

    test('commande d\'un autre client ou inexistante : 404 et ROLLBACK', async () => {
        const journal = fausseConnexion({ commande: null });

        await assert.rejects(
            CommandeModel.modifierParClient(parametres(), prixFictif),
            (err) => err instanceof ErreurCommande && err.status === 404
        );
        assert.equal(journal.rollback, true);
        assert.equal(journal.commit, false);
    });

    test('commande déjà acceptée : 409, rien n\'est modifié', async () => {
        const journal = fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'accepte', menu_id: 2 } });

        await assert.rejects(
            CommandeModel.modifierParClient(parametres(), prixFictif),
            (err) => err instanceof ErreurCommande && err.status === 409
        );
        assert.equal(journal.requetes.some((r) => /^\s*UPDATE/.test(r.sql)), false, 'aucun UPDATE');
        assert.equal(journal.rollback, true);
    });

    test('moins de personnes que le minimum du menu : 400', async () => {
        fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 } });

        await assert.rejects(
            CommandeModel.modifierParClient(parametres(donneesValides({ nombrePersonne: 5 })), prixFictif),
            (err) => err.status === 400 && /Minimum 6 personnes/.test(err.message)
        );
    });

    test('date trop proche pour le délai du menu (7 jours) : 400', async () => {
        fausseConnexion({ commande: { numero_commande: 'VG-2026-0014', statut: 'en_attente', menu_id: 2 } });

        await assert.rejects(
            CommandeModel.modifierParClient(parametres(donneesValides({ datePrestation: '2026-11-18' })), prixFictif),
            (err) => err.status === 400 && /19\/11\/2026/.test(err.message)
        );
    });
});

describe('PUT /api/commandes/:id', () => {

    test('id invalide : 404', async () => {
        const res = fauxRes();
        await CommandeController.modifier({ params: { id: 'x' }, body: corpsValide(), user: { id: 3 } }, res);
        assert.equal(res.statut, 404);
    });

    test('champs invalides : 400 avec la liste des erreurs, sans appeler le géocodage', async () => {
        const res = fauxRes();
        await CommandeController.modifier(
            { params: { id: '14' }, body: corpsValide({ heure_livraison: '25:00', contact_telephone: '12' }), user: { id: 3 } },
            res
        );
        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 2);
    });
});

describe('mettreAJourStatCommande', () => {

    test('MongoDB non connecté : renvoie false tout de suite, sans erreur', async () => {
        assert.equal(await mettreAJourStatCommande(14, { statut: 'annulee' }), false);
    });
});
