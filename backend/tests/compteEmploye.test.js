/* ================================================================
   TESTS/COMPTEEMPLOYE.TEST.JS
   Création d'un compte employé par l'administrateur
   Lancement : cd backend && npm test
   ================================================================
   Ni base ni serveur de mail : pool.query et transporter.sendMail
   sont remplacés par de fausses fonctions qui notent leurs appels.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { transporter } = require('../email/mailer');
const { validerCompteEmploye } = require('../utils/validationEmploye');
const { genererMailCompteEmploye } = require('../email/templateCompteEmploye');
const AdminController = require('../controllers/admin.controller');
const { envoyerMailCompteEmploye } = require('../controllers/admin.controller');

const MOT_DE_PASSE = 'Cuisine#Bordeaux26';

const corpsValide = (modifs = {}) => ({
    nom: 'Durand', prenom: 'Léa', email: 'lea.durand@vite-gourmand.fr', mot_de_passe: MOT_DE_PASSE, ...modifs
});

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

/** Fausse base : renvoie les réponses dans l'ordre et note chaque requête */
function fausseBase(...reponses) {
    const journal = [];
    pool.query = async (sql, valeurs) => {
        journal.push({ sql, valeurs });
        const reponse = reponses.shift();
        if (reponse instanceof Error) throw reponse;
        return [reponse];
    };
    return journal;
}

describe('validerCompteEmploye', () => {

    test('données valides : nettoyées, e-mail en minuscules', () => {
        const { donnees, motDePasse, erreurs } = validerCompteEmploye(
            corpsValide({ nom: '  Durand ', email: ' Lea.Durand@Vite-Gourmand.fr ' })
        );
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, { nom: 'Durand', prenom: 'Léa', email: 'lea.durand@vite-gourmand.fr' });
        assert.equal(motDePasse, MOT_DE_PASSE);
    });

    test('toutes les erreurs listées d\'un coup', () => {
        const { erreurs, motDePasse } = validerCompteEmploye({ email: 'pas-un-mail', mot_de_passe: 'court' });
        assert.equal(erreurs.length, 4); // nom, prénom, e-mail, mot de passe
        assert.equal(motDePasse, null);
    });

    test('mot de passe : mêmes règles que l\'inscription', () => {
        for (const faible of ['cuisine#bordeaux26', 'CUISINE#BORDEAUX26', 'Cuisine#Bordeaux', 'CuisineBordeaux26', 'Cu#1']) {
            assert.equal(validerCompteEmploye(corpsValide({ mot_de_passe: faible })).erreurs.length, 1, faible);
        }
    });

    test('rôle et état ignorés : seuls nom, prénom et e-mail sont gardés', () => {
        const { donnees } = validerCompteEmploye(corpsValide({ role: 'administrateur', actif: 0, role_id: 3 }));
        assert.deepEqual(Object.keys(donnees).sort(), ['email', 'nom', 'prenom']);
    });

    test('corps absent : pas d\'exception', () => {
        assert.equal(validerCompteEmploye(undefined).erreurs.length, 4);
        assert.equal(validerCompteEmploye(null).erreurs.length, 4);
    });
});

describe('genererMailCompteEmploye', () => {

    test('identifiant indiqué, lien de connexion, renvoi vers l\'administrateur', () => {
        const mail = genererMailCompteEmploye({ prenom: 'Léa', email: 'lea.durand@vite-gourmand.fr' });
        assert.equal(mail.subject, 'Votre compte employé Vite & Gourmand a été créé');
        for (const version of [mail.text, mail.html]) {
            assert.match(version, /lea\.durand@vite-gourmand\.fr/);
            assert.match(version, /rapprochez-vous de l’administrateur/);
        }
        assert.match(mail.text, /^Bonjour Léa,/);
        assert.match(mail.text, /Se connecter : https?:\/\/\S+\/connexion$/m);
    });

    test('le mot de passe n\'apparaît jamais, même s\'il est passé par erreur', () => {
        const mail = genererMailCompteEmploye({ prenom: 'Léa', email: 'lea@vg.fr', mot_de_passe: MOT_DE_PASSE });
        for (const version of [mail.subject, mail.text, mail.html]) {
            assert.ok(!version.includes(MOT_DE_PASSE));
        }
    });

    test('prénom échappé dans le HTML', () => {
        const mail = genererMailCompteEmploye({ prenom: '<img src=x onerror=alert(1)>', email: 'a@b.fr' });
        assert.doesNotMatch(mail.html, /<img/);
        assert.match(mail.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    });
});

describe('AdminController.creerEmploye', () => {

    const queryOriginal = pool.query;
    const sendMailOriginal = transporter.sendMail;
    afterEach(() => {
        pool.query = queryOriginal;
        transporter.sendMail = sendMailOriginal;
    });

    test('201 : compte créé avec le rôle employe, mot de passe haché, mail sans mot de passe', async () => {
        const journal = fausseBase([], { insertId: 7 }); // emailExiste → aucun, INSERT → id 7
        const envoyes = [];
        transporter.sendMail = async (options) => { envoyes.push(options); };
        const res = fauxRes();

        await AdminController.creerEmploye({ body: corpsValide() }, res);

        assert.equal(res.statut, 201);
        assert.deepEqual(res.corps.employe, {
            utilisateur_id: 7, nom: 'Durand', prenom: 'Léa', email: 'lea.durand@vite-gourmand.fr', actif: 1
        });
        const insertion = journal[1];
        assert.match(insertion.sql, /INSERT INTO utilisateur/);
        assert.equal(insertion.valeurs.at(-1), 'employe');
        assert.match(insertion.valeurs[7], /^\$2[aby]\$10\$/, 'empreinte bcrypt');
        assert.ok(!insertion.valeurs.includes(MOT_DE_PASSE), 'jamais le mot de passe en clair');

        await new Promise((r) => setImmediate(r)); // laisse partir le mail non attendu
        assert.equal(envoyes.length, 1);
        assert.equal(envoyes[0].to, 'lea.durand@vite-gourmand.fr');
        assert.ok(!envoyes[0].text.includes(MOT_DE_PASSE) && !envoyes[0].html.includes(MOT_DE_PASSE));
        assert.ok(!JSON.stringify(res.corps).includes(MOT_DE_PASSE), 'pas de mot de passe dans la réponse');
    });

    test('impossible de créer un administrateur : role envoyé dans la requête ignoré', async () => {
        const journal = fausseBase([], { insertId: 8 });
        transporter.sendMail = async () => {};
        const res = fauxRes();

        await AdminController.creerEmploye({ body: corpsValide({ role: 'administrateur', role_id: 3 }) }, res);

        assert.equal(res.statut, 201);
        assert.equal(journal[1].valeurs.at(-1), 'employe');
        assert.ok(!journal[1].valeurs.includes('administrateur'));
        assert.ok(!journal[1].valeurs.includes(3));
    });

    test('400 avec toutes les erreurs, sans requête', async () => {
        const journal = fausseBase();
        const res = fauxRes();
        await AdminController.creerEmploye({ body: { email: 'x' } }, res);
        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 4);
        assert.equal(journal.length, 0);
    });

    test('409 si l\'e-mail existe déjà, rien n\'est inséré', async () => {
        const journal = fausseBase([{ utilisateur_id: 2 }]);
        const res = fauxRes();
        await AdminController.creerEmploye({ body: corpsValide({ email: 'employe@vite-gourmand.fr' }) }, res);
        assert.equal(res.statut, 409);
        assert.equal(journal.length, 1);
    });

    test('409 aussi si la base refuse un doublon au même instant (ER_DUP_ENTRY)', async () => {
        const doublon = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
        fausseBase([], doublon);
        const res = fauxRes();
        await AdminController.creerEmploye({ body: corpsValide() }, res);
        assert.equal(res.statut, 409);
    });

    test('serveur de mail en panne : le compte est quand même créé (201)', async (t) => {
        t.mock.method(console, 'error', () => {});
        fausseBase([], { insertId: 9 });
        transporter.sendMail = async () => { throw new Error('550 5.7.0 Too many emails per second'); };
        const res = fauxRes();

        await AdminController.creerEmploye({ body: corpsValide() }, res);
        await new Promise((r) => setImmediate(r));

        assert.equal(res.statut, 201);
        assert.equal(console.error.mock.callCount(), 1);
    });
});

describe('envoyerMailCompteEmploye', () => {

    const sendMailOriginal = transporter.sendMail;
    afterEach(() => { transporter.sendMail = sendMailOriginal; });

    test('true si le mail part, false (sans exception) sinon', async (t) => {
        t.mock.method(console, 'error', () => {});
        const employe = { prenom: 'Léa', email: 'lea@vg.fr' };
        transporter.sendMail = async () => {};
        assert.equal(await envoyerMailCompteEmploye(employe), true);
        transporter.sendMail = async () => { throw new Error('panne'); };
        assert.equal(await envoyerMailCompteEmploye(employe), false);
    });
});
