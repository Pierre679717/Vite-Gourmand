/* ================================================================
   TESTS/ACTIVATIONEMPLOYE.TEST.JS
   Désactiver / réactiver un compte employé, et effet immédiat
   sur l'accès (middleware relit le compte en base)
   Lancement : cd backend && npm test
   ================================================================ */

// Secret de test si .env n'en fournit pas (lu par config/jwt au chargement)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-pour-node-test-0123456789';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db.mysql');
const { JWT_SECRET } = require('../config/jwt');
const AdminController = require('../controllers/admin.controller');
const { adminRequired, employeRequired } = require('../middleware/auth.middleware');

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

function fausseBase(...reponses) {
    const journal = [];
    pool.query = async (sql, valeurs) => {
        journal.push({ sql, valeurs });
        return [reponses.shift()];
    };
    return journal;
}

const compte = (modifs = {}) => ({
    utilisateur_id: 2, nom: 'Girard', prenom: 'Thomas', email: 'employe@vite-gourmand.fr',
    actif: 1, role: 'employe', ...modifs
});

const ADMIN = { id: 1, role: 'administrateur' };

describe('AdminController.changerActifEmploye', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    const appeler = async (id, body, user = ADMIN) => {
        const res = fauxRes();
        await AdminController.changerActifEmploye({ params: { id }, body, user }, res);
        return res;
    };

    test('désactiver un employé : UPDATE limité aux employés, message clair', async () => {
        const journal = fausseBase([compte()], { affectedRows: 1 });
        const res = await appeler('2', { actif: false });

        assert.equal(res.statut, 200);
        assert.equal(res.corps.employe.actif, 0);
        assert.match(res.corps.message, /Thomas Girard est désactivé/);
        assert.match(journal[1].sql, /SET u\.actif = \?/);
        assert.match(journal[1].sql, /r\.libelle = 'employe'/);
        assert.deepEqual(journal[1].valeurs, [0, 2]);
    });

    test('réactiver un employé', async () => {
        const journal = fausseBase([compte({ actif: 0 })], { affectedRows: 1 });
        const res = await appeler('2', { actif: true });
        assert.equal(res.statut, 200);
        assert.equal(res.corps.employe.actif, 1);
        assert.deepEqual(journal[1].valeurs, [1, 2]);
    });

    test('jamais sur son propre compte : 403 sans requête', async () => {
        const journal = fausseBase();
        const res = await appeler('1', { actif: false });
        assert.equal(res.statut, 403);
        assert.equal(journal.length, 0);
    });

    test('jamais sur un administrateur ni sur un client : 403, rien modifié', async () => {
        for (const role of ['administrateur', 'utilisateur']) {
            const journal = fausseBase([compte({ utilisateur_id: 9, role })]);
            const res = await appeler('9', { actif: false });
            assert.equal(res.statut, 403, role);
            assert.equal(journal.length, 1, 'seulement la lecture du compte');
        }
    });

    test('compte inconnu ou id invalide : 404', async () => {
        fausseBase([]); // aucun compte trouvé
        assert.equal((await appeler('99', { actif: false })).statut, 404);
        for (const id of ['abc', '0', '-2', '2.5']) {
            const journal = fausseBase();
            assert.equal((await appeler(id, { actif: false })).statut, 404, id);
            assert.equal(journal.length, 0);
        }
    });

    test('actif doit être un booléen : 400', async () => {
        for (const body of [{}, { actif: 0 }, { actif: 'false' }, undefined]) {
            const journal = fausseBase();
            assert.equal((await appeler('2', body)).statut, 400);
            assert.equal(journal.length, 0);
        }
    });
});

describe('middleware : un compte désactivé perd l\'accès tout de suite', () => {

    const queryOriginal = pool.query;
    afterEach(() => { pool.query = queryOriginal; });

    /** Exécute le middleware ; renvoie la réponse et si next() a été appelé */
    async function passer(middleware, payload) {
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = fauxRes();
        let suivant = false;
        await new Promise((fin) => {
            res.json = function (donnees) { this.corps = donnees; fin(); return this; };
            middleware(req, res, () => { suivant = true; fin(); });
        });
        return { res, suivant, req };
    }

    test('employé actif : accès accordé, compte relu en base', async () => {
        const journal = fausseBase([compte()]);
        const { suivant } = await passer(employeRequired, { id: 2, role: 'employe' });
        assert.equal(suivant, true);
        assert.deepEqual(journal[0].valeurs, [2]);
    });

    test('employé désactivé avec un token encore valide : 401', async () => {
        fausseBase([compte({ actif: 0 })]);
        const { res, suivant } = await passer(employeRequired, { id: 2, role: 'employe' });
        assert.equal(suivant, false);
        assert.equal(res.statut, 401);
        assert.match(res.corps.error, /désactivé/);
    });

    test('compte supprimé depuis la connexion : 401', async () => {
        fausseBase([]); // aucun compte trouvé
        const { res } = await passer(employeRequired, { id: 2, role: 'employe' });
        assert.equal(res.statut, 401);
    });

    test('le rôle en base fait foi, pas celui du token', async () => {
        fausseBase([compte({ role: 'employe' })]);
        const { res, suivant } = await passer(adminRequired, { id: 2, role: 'administrateur' });
        assert.equal(suivant, false);
        assert.equal(res.statut, 403);
    });

    test('administrateur actif : accès aux routes admin et employé', async () => {
        const admin = compte({ utilisateur_id: 1, role: 'administrateur' });
        fausseBase([admin], [admin]);
        assert.equal((await passer(adminRequired, { id: 1, role: 'administrateur' })).suivant, true);
        assert.equal((await passer(employeRequired, { id: 1, role: 'administrateur' })).suivant, true);
    });

    test('client : 403 sur les routes employé', async () => {
        fausseBase([compte({ utilisateur_id: 3, role: 'utilisateur' })]);
        const { res } = await passer(employeRequired, { id: 3, role: 'utilisateur' });
        assert.equal(res.statut, 403);
    });

    test('sans token : 401 sans requête en base', async () => {
        const journal = fausseBase();
        const res = fauxRes();
        employeRequired({ headers: {} }, res, () => {});
        assert.equal(res.statut, 401);
        assert.equal(journal.length, 0);
    });
});
