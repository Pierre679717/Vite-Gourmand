/* ================================================================
   TESTS/COMMANDECLIENT.TEST.JS
   Espace client : id d'URL, règle de modification, mise en forme
   et GET /api/commandes/:id (base remplacée par de fausses fonctions)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { CommandeModel } = require('../models/commande.model');
const CommandeController = require('../controllers/commande.controller');
const {
    idValide,
    peutEtreModifiee,
    versResumeCommande,
    versCommandeClient
} = require('../utils/commandeClient');

/** Ligne telle que la renvoie trouverPourClient (VG-2026-0014, Bordeaux) */
function ligne(modifs = {}) {
    return {
        commande_id: 14, numero_commande: 'VG-2026-0014', date_commande: '2026-11-12 15:02:11',
        date_prestation: '2026-11-28', heure_livraison: '12:30:00',
        adresse_prestation: '12 rue Sainte-Catherine', ville_prestation: 'Bordeaux', distance_km: 0,
        nombre_personne: 12, prix_par_personne: 44, reduction: 52.8, prix_menu: 475.2,
        prix_livraison: 0, prix_total: 475.2, statut: 'en_attente', pret_materiel: 1, materiel_restitue: 0,
        contact_nom: 'Martin', contact_prenom: 'Camille', contact_email: 'utilisateur@vite-gourmand.fr',
        contact_telephone: '0612345678', menu_id: 2, menu_titre: 'Menu Traditionnel',
        nombre_personne_min: 6, delai_minimum_jours: 7,
        avis_note: null, avis_commentaire: null, avis_statut: null,
        ...modifs
    };
}

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

const CAMILLE = { id: 3, role: 'utilisateur' };

describe('idValide', () => {

    test('accepte un entier positif écrit en chiffres', () => {
        assert.equal(idValide('14'), 14);
        assert.equal(idValide('2147483647'), 2147483647);
    });

    test('refuse tout le reste', () => {
        for (const texte of ['0', '-1', '014', '12abc', '1e3', '1.5', ' 14', '', '2147483648', undefined]) {
            assert.equal(idValide(texte), null, `« ${texte} » devrait être refusé`);
        }
    });
});

describe('peutEtreModifiee', () => {

    test('seulement « en_attente » (le sujet : tant qu\'un employé n\'a pas accepté)', () => {
        assert.equal(peutEtreModifiee('en_attente'), true);
        for (const statut of ['accepte', 'en_preparation', 'livre', 'terminee', 'annulee']) {
            assert.equal(peutEtreModifiee(statut), false, statut);
        }
    });
});

describe('versCommandeClient', () => {

    test('met en forme la ligne : heure courte, booléens, menu groupé, suivi', () => {
        const commande = versCommandeClient(ligne(), [
            { statut: 'en_attente', date_changement: '2026-11-12 15:02:11' }
        ]);
        assert.equal(commande.heure_livraison, '12:30');
        assert.equal(commande.pret_materiel, true);
        assert.equal(commande.materiel_restitue, false);
        assert.deepEqual(commande.menu, { menu_id: 2, titre: 'Menu Traditionnel', nombre_personne_min: 6, delai_minimum_jours: 7 });
        assert.deepEqual(commande.suivi, [{ statut: 'en_attente', date: '2026-11-12 15:02:11' }]);
        assert.equal(commande.avis, null);
    });

    test('en attente : modifiable, pas encore d\'avis possible', () => {
        const commande = versCommandeClient(ligne());
        assert.equal(commande.peut_modifier, true);
        assert.equal(commande.peut_donner_avis, false);
    });

    test('terminée sans avis : avis possible, plus modifiable', () => {
        const commande = versCommandeClient(ligne({ statut: 'terminee' }));
        assert.equal(commande.peut_modifier, false);
        assert.equal(commande.peut_donner_avis, true);
    });

    test('terminée avec un avis : l\'avis est renvoyé et on ne peut pas en donner un second', () => {
        const commande = versCommandeClient(ligne({
            statut: 'terminee', avis_note: 5, avis_commentaire: 'Parfait', avis_statut: 'en_attente'
        }));
        assert.deepEqual(commande.avis, { note: 5, commentaire: 'Parfait', statut: 'en_attente' });
        assert.equal(commande.peut_donner_avis, false);
    });

    test('n\'expose pas les colonnes internes (motif, mode de contact, utilisateur)', () => {
        const commande = versCommandeClient(ligne({ motif: 'note interne', mode_contact: 'gsm', utilisateur_id: 3 }));
        assert.equal('motif' in commande, false);
        assert.equal('mode_contact' in commande, false);
        assert.equal('utilisateur_id' in commande, false);
    });
});

describe('versResumeCommande', () => {

    test('heure courte et avis_donne en booléen', () => {
        const resume = versResumeCommande({ ...ligne(), avis_donne: 1 });
        assert.equal(resume.heure_livraison, '12:30');
        assert.equal(resume.avis_donne, true);
        assert.equal(resume.menu_titre, 'Menu Traditionnel');
    });
});

describe('CommandeModel.trouverPourClient', () => {

    afterEach(() => { delete pool.query; });

    test('la requête filtre sur la commande ET sur le client connecté', async () => {
        let sql = '';
        let parametres = [];
        // Propriété posée sur l'objet : elle masque la vraie méthode le temps du test
        pool.query = async (requete, valeurs) => { sql = requete; parametres = valeurs; return [[]]; };

        const resultat = await CommandeModel.trouverPourClient(14, 3);

        assert.match(sql, /WHERE c\.commande_id = \? AND c\.utilisateur_id = \?/);
        assert.deepEqual(parametres, [14, 3]);
        assert.equal(resultat, null);
    });
});

describe('GET /api/commandes/:id', () => {

    const originaux = { trouver: CommandeModel.trouverPourClient, suivi: CommandeModel.listerSuivi };
    afterEach(() => {
        CommandeModel.trouverPourClient = originaux.trouver;
        CommandeModel.listerSuivi = originaux.suivi;
    });

    test('renvoie la commande du client avec son suivi', async () => {
        let demande = null;
        CommandeModel.trouverPourClient = async (id, utilisateurId) => { demande = { id, utilisateurId }; return ligne(); };
        CommandeModel.listerSuivi = async () => [{ statut: 'en_attente', date_changement: '2026-11-12 15:02:11' }];
        const res = fauxRes();

        await CommandeController.detail({ params: { id: '14' }, user: CAMILLE }, res);

        assert.deepEqual(demande, { id: 14, utilisateurId: 3 });
        assert.equal(res.statut, 200);
        assert.equal(res.corps.numero_commande, 'VG-2026-0014');
        assert.equal(res.corps.suivi.length, 1);
    });

    test('commande d\'un autre client (le modèle ne la trouve pas) : 404', async () => {
        CommandeModel.trouverPourClient = async () => null;
        CommandeModel.listerSuivi = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await CommandeController.detail({ params: { id: '13' }, user: CAMILLE }, res);

        assert.equal(res.statut, 404);
        assert.deepEqual(res.corps, { error: 'Commande introuvable.' });
    });

    test('id invalide : 404 sans interroger la base', async () => {
        CommandeModel.trouverPourClient = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await CommandeController.detail({ params: { id: 'abc' }, user: CAMILLE }, res);

        assert.equal(res.statut, 404);
    });

    test('erreur de la base : 500 sans détail technique', async (t) => {
        t.mock.method(console, 'error', () => {});
        CommandeModel.trouverPourClient = async () => { throw new Error('connect ECONNREFUSED'); };
        const res = fauxRes();

        await CommandeController.detail({ params: { id: '14' }, user: CAMILLE }, res);

        assert.equal(res.statut, 500);
        assert.deepEqual(res.corps, { error: 'Erreur serveur.' });
    });
});
