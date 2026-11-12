/* ================================================================
   TESTS/MODIFIERPROFIL.TEST.JS
   PUT /api/profil (« Mes informations ») et POST /api/inscription
   Lancement : cd backend && npm test
   ================================================================
   La base n'est pas utilisée : les méthodes de UtilisateurModel sont
   remplacées par de fausses fonctions le temps de chaque test.
   ================================================================ */

// Secret de test, défini AVANT de charger config/jwt.js (lu au chargement)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-uniquement-0123456789abcdef';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const UtilisateurModel = require('../models/utilisateur.model');
const AuthController = require('../controllers/auth.controller');
const { JWT_SECRET } = require('../config/jwt');

const originaux = { ...Object.fromEntries(
    ['trouverParId', 'emailUtiliseParAutre', 'mettreAJourProfil', 'emailExiste', 'creer']
        .map((nom) => [nom, UtilisateurModel[nom]])
) };

const CAMILLE = {
    utilisateur_id: 3, nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr',
    telephone: '0612345678', adresse_postale: '12 rue Sainte-Catherine', code_postal: '33000',
    ville: 'Bordeaux', actif: 1, role: 'utilisateur'
};

function corpsValide(modifs = {}) {
    return {
        nom: 'Martin', prenom: 'Camille', email: 'camille.martin@example.com',
        telephone: '06 11 22 33 44', adresse_postale: '3 place de la Bourse',
        code_postal: '33000', ville: 'Bordeaux', ...modifs
    };
}

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

const reqCamille = (body) => ({ user: { id: 3, role: 'utilisateur' }, body });

afterEach(() => { Object.assign(UtilisateurModel, originaux); });

describe('PUT /api/profil', () => {

    test('enregistre les données nettoyées et renvoie le profil + un nouveau token', async () => {
        let enregistre = null;
        UtilisateurModel.trouverParId = async () => CAMILLE;
        UtilisateurModel.emailUtiliseParAutre = async () => false;
        UtilisateurModel.mettreAJourProfil = async (id, donnees) => { enregistre = { id, donnees }; };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 200);
        assert.equal(enregistre.id, 3);
        assert.equal(enregistre.donnees.telephone, '0611223344');
        assert.equal(res.corps.user.email, 'camille.martin@example.com');
        assert.equal(res.corps.user.role, 'utilisateur');

        const payload = jwt.verify(res.corps.token, JWT_SECRET);
        assert.equal(payload.id, 3);
        assert.equal(payload.email, 'camille.martin@example.com');
        assert.equal(payload.role, 'utilisateur');
    });

    test('un rôle envoyé dans la requête est ignoré (pas d\'élévation de droits)', async () => {
        let enregistre = null;
        UtilisateurModel.trouverParId = async () => CAMILLE;
        UtilisateurModel.emailUtiliseParAutre = async () => false;
        UtilisateurModel.mettreAJourProfil = async (id, donnees) => { enregistre = donnees; };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide({ role: 'administrateur' })), res);

        assert.equal('role' in enregistre, false);
        assert.equal(jwt.verify(res.corps.token, JWT_SECRET).role, 'utilisateur');
    });

    test('e-mail déjà pris par un autre compte : 409, rien n\'est enregistré', async () => {
        let idExclu = null;
        UtilisateurModel.trouverParId = async () => CAMILLE;
        UtilisateurModel.emailUtiliseParAutre = async (email, id) => { idExclu = id; return true; };
        UtilisateurModel.mettreAJourProfil = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide({ email: 'employe@vite-gourmand.fr' })), res);

        assert.equal(idExclu, 3, 'son propre compte est exclu de la recherche');
        assert.equal(res.statut, 409);
    });

    test('doublon détecté par la base (contrainte UNIQUE) : 409', async () => {
        UtilisateurModel.trouverParId = async () => CAMILLE;
        UtilisateurModel.emailUtiliseParAutre = async () => false;
        UtilisateurModel.mettreAJourProfil = async () => { throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' }); };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 409);
    });

    test('champs invalides : 400 avec toutes les erreurs', async () => {
        UtilisateurModel.trouverParId = async () => CAMILLE;
        UtilisateurModel.mettreAJourProfil = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide({ code_postal: '330', telephone: '12' })), res);

        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 2);
    });

    test('compte supprimé : 404 ; compte désactivé : 403', async () => {
        UtilisateurModel.trouverParId = async () => null;
        const res404 = fauxRes();
        await AuthController.modifierProfil(reqCamille(corpsValide()), res404);
        assert.equal(res404.statut, 404);

        UtilisateurModel.trouverParId = async () => ({ ...CAMILLE, actif: 0 });
        const res403 = fauxRes();
        await AuthController.modifierProfil(reqCamille(corpsValide()), res403);
        assert.equal(res403.statut, 403);
    });

    test('erreur de la base : 500 sans détail technique', async (t) => {
        t.mock.method(console, 'error', () => {});
        UtilisateurModel.trouverParId = async () => { throw new Error('connect ECONNREFUSED'); };
        const res = fauxRes();

        await AuthController.modifierProfil(reqCamille(corpsValide()), res);

        assert.equal(res.statut, 500);
        assert.deepEqual(res.corps, { error: 'Erreur serveur.' });
    });
});

describe('POST /api/inscription (mêmes règles que le profil)', () => {

    test('téléphone et mot de passe invalides : 400, aucun compte créé', async () => {
        UtilisateurModel.emailExiste = async () => { throw new Error('ne doit pas être appelé'); };
        UtilisateurModel.creer = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await AuthController.inscription({ body: corpsValide({ telephone: '123', mot_de_passe: 'court' }) }, res);

        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 2);
    });

    test('corps vide : 400 sans planter', async () => {
        const res = fauxRes();
        await AuthController.inscription({ body: undefined }, res);
        assert.equal(res.statut, 400);
    });
});
