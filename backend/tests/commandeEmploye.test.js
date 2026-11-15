/* ================================================================
   TESTS/COMMANDEEMPLOYE.TEST.JS
   Liste filtrée et détail des commandes pour l'employé
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const {
    COLONNES_CLIENT, validerFiltresCommandes, echapperLike, clauseFiltres,
    versResumeEmploye, versCommandeEmploye
} = require('../utils/commandeEmploye');
const CommandeController = require('../controllers/commande.controller');

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

/** Remplace pool.query : renvoie `lignes` et note les requêtes */
function fausseBase(...reponses) {
    const journal = [];
    pool.query = async (sql, valeurs) => {
        journal.push({ sql, valeurs });
        return [reponses.shift() || []];
    };
    return journal;
}

const ligneCommande = (modifs = {}) => ({
    commande_id: 13, numero_commande: 'VG-2026-0013', date_commande: '2026-11-13 22:40:00',
    date_prestation: '2026-11-20', heure_livraison: '12:30:00', adresse_prestation: 'Avenue Jean Jaurès',
    ville_prestation: 'Pessac', distance_km: 4.5, nombre_personne: 8, prix_par_personne: 48,
    reduction: 0, prix_menu: 384, prix_livraison: 7.66, prix_total: 482.86, statut: 'livre',
    pret_materiel: 1, materiel_restitue: 0, mode_contact: null, motif: null,
    contact_nom: 'Martin', contact_prenom: 'Camille', contact_email: 'utilisateur@vite-gourmand.fr',
    contact_telephone: '0612345678', menu_id: 4, menu_titre: 'Menu Traditionnel',
    nombre_personne_min: 6, delai_minimum_jours: 3, utilisateur_id: 3,
    client_nom: 'Martin', client_prenom: 'Camille', client_email: 'utilisateur@vite-gourmand.fr',
    client_telephone: '0612345678', avis_note: null, avis_commentaire: null, avis_statut: null,
    mot_de_passe: 'NE DOIT JAMAIS SORTIR',
    ...modifs
});

describe('validerFiltresCommandes', () => {

    test('aucun filtre, ou des paramètres vides', () => {
        assert.deepEqual(validerFiltresCommandes({}), { filtres: {}, erreurs: [] });
        assert.deepEqual(validerFiltresCommandes({ statut: '', client: '   ' }), { filtres: {}, erreurs: [] });
        assert.deepEqual(validerFiltresCommandes(undefined), { filtres: {}, erreurs: [] });
    });

    test('statut connu et recherche découpée en mots', () => {
        assert.deepEqual(validerFiltresCommandes({ statut: 'livre', client: '  Camille   Martin ' }).filtres,
            { statut: 'livre', mots: ['Camille', 'Martin'] });
    });

    test('statut inconnu ou répété : 400', () => {
        assert.equal(validerFiltresCommandes({ statut: 'livree' }).erreurs.length, 1);
        assert.equal(validerFiltresCommandes({ statut: ['livre', 'terminee'] }).erreurs.length, 1);
    });

    test('recherche trop longue ou répétée refusée, 5 mots au plus', () => {
        assert.equal(validerFiltresCommandes({ client: 'a'.repeat(101) }).erreurs.length, 1);
        assert.equal(validerFiltresCommandes({ client: ['a', 'b'] }).erreurs.length, 1);
        assert.equal(validerFiltresCommandes({ client: 'a b c d e f g' }).filtres.mots.length, 5);
    });
});

describe('clauseFiltres', () => {

    test('sans filtre : pas de WHERE', () => {
        assert.deepEqual(clauseFiltres({}), { where: '', valeurs: [] });
    });

    test('statut seul', () => {
        assert.deepEqual(clauseFiltres({ statut: 'livre' }), { where: 'WHERE c.statut = ?', valeurs: ['livre'] });
    });

    test('chaque mot est cherché dans toutes les colonnes du client, avec des « ? »', () => {
        const { where, valeurs } = clauseFiltres({ statut: 'accepte', mots: ['martin', '0013'] });
        assert.equal((where.match(/\?/g) || []).length, 1 + 2 * COLONNES_CLIENT.length);
        assert.equal(valeurs.length, 1 + 2 * COLONNES_CLIENT.length);
        assert.match(where, /^WHERE c\.statut = \? AND \(u\.nom LIKE \? OR .* c\.numero_commande LIKE \?\) AND \(/);
        assert.equal(valeurs[1], '%martin%');
        assert.equal(valeurs.at(-1), '%0013%');
    });

    test('injection : la saisie reste dans les valeurs, jamais dans le SQL', () => {
        const { where, valeurs } = clauseFiltres({ mots: ["'OR'1'='1"] });
        assert.doesNotMatch(where, /'/);
        assert.equal(valeurs[0], "%'OR'1'='1%");
    });

    test('% et _ sont cherchés tels quels', () => {
        assert.equal(echapperLike('50%_off\\'), '50\\%\\_off\\\\');
    });
});

describe('mise en forme', () => {

    test('résumé : liste blanche, prêt de matériel et statuts suivants', () => {
        const resume = versResumeEmploye(ligneCommande());
        assert.equal(resume.heure_livraison, '12:30');
        assert.equal(resume.pret_materiel, true);
        assert.deepEqual(resume.client, { nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr' });
        assert.deepEqual(resume.statuts_suivants, ['attente_retour_materiel']);
        assert.equal('mot_de_passe' in resume, false);
    });

    test('détail : coordonnées du client, motif, sans les drapeaux du client', () => {
        const detail = versCommandeEmploye(
            ligneCommande({ statut: 'annulee', mode_contact: 'gsm', motif: 'Client absent' }),
            [{ statut: 'en_attente', date_changement: '2026-11-13 22:40:00' }]
        );
        assert.equal(detail.client.telephone, '0612345678');
        assert.equal(detail.mode_contact, 'gsm');
        assert.equal(detail.motif, 'Client absent');
        assert.deepEqual(detail.statuts_suivants, []);
        assert.deepEqual(detail.suivi, [{ statut: 'en_attente', date: '2026-11-13 22:40:00' }]);
        assert.equal('peut_modifier' in detail, false);
        assert.equal('peut_donner_avis' in detail, false);
        assert.equal('mot_de_passe' in detail, false);
    });
});

describe('contrôleur', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    test('GET /api/employe/commandes?statut=livre : requête paramétrée, résumés', async () => {
        const journal = fausseBase([ligneCommande()]);
        const res = fauxRes();

        await CommandeController.toutesCommandes({ query: { statut: 'livre', client: 'martin' } }, res);

        assert.equal(res.statut, 200);
        assert.equal(res.corps.length, 1);
        assert.equal(res.corps[0].numero_commande, 'VG-2026-0013');
        assert.match(journal[0].sql, /WHERE c\.statut = \? AND \(/);
        assert.equal(journal[0].valeurs[0], 'livre');
    });

    test('filtre invalide : 400 sans requête', async () => {
        const journal = fausseBase();
        const res = fauxRes();
        await CommandeController.toutesCommandes({ query: { statut: 'DROP TABLE' } }, res);
        assert.equal(res.statut, 400);
        assert.equal(journal.length, 0);
    });

    test('GET /api/employe/commandes/:id : détail avec le suivi', async () => {
        fausseBase([ligneCommande()], [{ statut: 'en_attente', date_changement: '2026-11-13 22:40:00' }]);
        const res = fauxRes();

        await CommandeController.detailEmploye({ params: { id: '13' } }, res);

        assert.equal(res.statut, 200);
        assert.equal(res.corps.client.email, 'utilisateur@vite-gourmand.fr');
        assert.equal(res.corps.suivi.length, 1);
    });

    test('détail : id invalide ou commande inconnue -> 404', async () => {
        fausseBase([]);
        for (const id of ['abc', '999']) {
            const res = fauxRes();
            await CommandeController.detailEmploye({ params: { id } }, res);
            assert.equal(res.statut, 404);
        }
    });
});
