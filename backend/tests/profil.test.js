/* ================================================================
   TESTS/PROFIL.TEST.JS
   GET /api/profil : le profil est lu en base, pas dans le token
   Lancement : cd backend && npm test
   ================================================================
   La base n'est pas utilisée : on remplace UtilisateurModel.trouverParId
   par une fausse fonction le temps de chaque test.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const UtilisateurModel = require('../models/utilisateur.model');
const AuthController = require('../controllers/auth.controller');

const trouverParIdOriginal = UtilisateurModel.trouverParId;

// Ligne telle que la renvoie la base (COLONNES_PUBLIQUES)
const CAMILLE = {
    utilisateur_id: 3, nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr',
    telephone: '0612345678', adresse_postale: '12 rue Sainte-Catherine', code_postal: '33000',
    ville: 'Bordeaux', actif: 1, role: 'utilisateur'
};

// Faux objet "res" d'Express : retient le statut et le JSON envoyés
function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

// Contenu d'un token : pas de téléphone ni d'adresse
const reqConnecte = { user: { id: 3, nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr', role: 'utilisateur' } };

describe('GET /api/profil', () => {

    afterEach(() => { UtilisateurModel.trouverParId = trouverParIdOriginal; });

    test('lit le compte en base avec l\'id du token et renvoie téléphone et adresse', async () => {
        let idDemande = null;
        UtilisateurModel.trouverParId = async (id) => { idDemande = id; return CAMILLE; };
        const res = fauxRes();

        await AuthController.profil(reqConnecte, res);

        assert.equal(idDemande, 3);
        assert.equal(res.statut, 200);
        assert.deepEqual(res.corps.user, {
            id: 3, nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr',
            telephone: '0612345678', adresse_postale: '12 rue Sainte-Catherine', code_postal: '33000',
            ville: 'Bordeaux', role: 'utilisateur'
        });
    });

    test('ne renvoie jamais le mot de passe, même si la ligne en contient un', async () => {
        UtilisateurModel.trouverParId = async () => ({ ...CAMILLE, mot_de_passe: '$2b$10$hash' });
        const res = fauxRes();

        await AuthController.profil(reqConnecte, res);

        assert.equal('mot_de_passe' in res.corps.user, false);
    });

    test('compte supprimé depuis la connexion : 404', async () => {
        UtilisateurModel.trouverParId = async () => null;
        const res = fauxRes();

        await AuthController.profil(reqConnecte, res);

        assert.equal(res.statut, 404);
    });

    test('compte désactivé depuis la connexion : 403', async () => {
        UtilisateurModel.trouverParId = async () => ({ ...CAMILLE, actif: 0 });
        const res = fauxRes();

        await AuthController.profil(reqConnecte, res);

        assert.equal(res.statut, 403);
    });

    test('erreur de la base : 500 sans détail technique', async (t) => {
        t.mock.method(console, 'error', () => {});
        UtilisateurModel.trouverParId = async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:3306'); };
        const res = fauxRes();

        await AuthController.profil(reqConnecte, res);

        assert.equal(res.statut, 500);
        assert.deepEqual(res.corps, { error: 'Erreur serveur.' });
    });
});
