/* ================================================================
   TESTS/DEMANDEREINITIALISATION.TEST.JS
   POST /api/mot-de-passe-oublie et mail de réinitialisation
   Lancement : cd backend && npm test
   ================================================================
   Ni base ni serveur de mail : pool.query, pool.getConnection et
   transporter.sendMail sont remplacés par de fausses fonctions qui
   notent leurs appels.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db.mysql');
const { transporter } = require('../email/mailer');
const { SITE } = require('../email/templates');
const { genererMailReinitialisation, SUJET } = require('../email/templateReinitialisation');
const MotDePasseController = require('../controllers/motDePasse.controller');
const { lienReinitialisation } = require('../controllers/motDePasse.controller');
const { MESSAGE_DEMANDE, empreinteJeton } = require('../utils/jetonReinitialisation');

const LIEN = 'http://localhost:4200/nouveau-mot-de-passe?token=' + 'c'.repeat(64);

describe('genererMailReinitialisation', () => {

    const mail = genererMailReinitialisation({ prenom: 'Camille', lien: LIEN, minutes: 30 });

    test('sujet, salutation, lien et durée dans les deux versions', () => {
        assert.equal(mail.subject, SUJET);
        for (const version of [mail.text, mail.html]) {
            assert.match(version, /Bonjour Camille,/);
            assert.ok(version.includes(LIEN));
            assert.match(version, /valable 30 minutes/);
            assert.match(version, /une seule fois/);
        }
    });

    test('rassure si la demande ne vient pas de la personne', () => {
        assert.match(mail.text, /Ignorez simplement ce message/);
        assert.match(mail.html, /Ignorez simplement ce message/);
    });

    test('le prénom est échappé dans le HTML (pas de balise interprétée)', () => {
        const piege = genererMailReinitialisation({ prenom: '<script>alert(1)</script>', lien: LIEN, minutes: 30 });
        assert.equal(piege.html.includes('<script>'), false);
        assert.match(piege.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    });

    test('un lien contenant des guillemets ne peut pas sortir de href', () => {
        const piege = genererMailReinitialisation({ prenom: 'A', lien: 'http://x/"onmouseover="alert(1)', minutes: 30 });
        assert.equal(piege.html.includes('"onmouseover="'), false);
        assert.match(piege.html, /&quot;onmouseover=&quot;/);
    });
});

describe('lienReinitialisation', () => {

    test('pointe vers la page Angular sur FRONTEND_URL, jeton en paramètre', () => {
        assert.equal(lienReinitialisation('c'.repeat(64)), `${SITE}/nouveau-mot-de-passe?token=${'c'.repeat(64)}`);
    });
});

describe('MotDePasseController.demanderReinitialisation', () => {

    const queryOriginal = pool.query;
    const sendMailOriginal = transporter.sendMail;
    afterEach(() => {
        pool.query = queryOriginal;
        delete pool.getConnection;
        transporter.sendMail = sendMailOriginal;
    });

    function fauxRes() {
        return {
            statut: 200, corps: null,
            status(code) { this.statut = code; return this; },
            json(donnees) { this.corps = donnees; return this; }
        };
    }

    /** Compte trouvé par trouverParEmail (null = adresse inconnue) */
    function preparer(compte, { panneMail = false } = {}) {
        const journal = { recherches: [], ecritures: [], mails: [] };
        pool.query = async (sql, valeurs) => {
            journal.recherches.push({ sql, valeurs });
            return [compte ? [compte] : []];
        };
        pool.getConnection = async () => ({
            async beginTransaction() {},
            async commit() {},
            async rollback() {},
            release() {},
            async query(sql, valeurs) { journal.ecritures.push({ sql, valeurs }); return [{ affectedRows: 1 }]; }
        });
        transporter.sendMail = async (mail) => {
            if (panneMail) throw new Error('Mailtrap indisponible');
            journal.mails.push(mail);
        };
        return journal;
    }

    const cliente = (modifs = {}) => ({
        utilisateur_id: 3, prenom: 'Camille', nom: 'Martin',
        email: 'utilisateur@vite-gourmand.fr', actif: 1, role: 'utilisateur', ...modifs
    });

    const appeler = async (body) => {
        const res = fauxRes();
        const traitement = await MotDePasseController.demanderReinitialisation({ body }, res);
        return { res, traitement };
    };

    test('compte actif : message neutre, jeton enregistré, mail envoyé avec le lien', async () => {
        const journal = preparer(cliente());
        const { res, traitement } = await appeler({ email: ' Utilisateur@Vite-Gourmand.fr ' });

        assert.equal(res.statut, 200);
        assert.deepEqual(res.corps, { message: MESSAGE_DEMANDE });
        assert.equal(await traitement, true);

        assert.deepEqual(journal.recherches[0].valeurs, ['utilisateur@vite-gourmand.fr']);
        assert.equal(journal.mails.length, 1);
        assert.equal(journal.mails[0].to, 'utilisateur@vite-gourmand.fr');

        // Le jeton du lien correspond à l'empreinte enregistrée en base
        const jeton = journal.mails[0].text.match(/token=([a-f0-9]{64})/)[1];
        const insertion = journal.ecritures.find((e) => /INSERT/.test(e.sql));
        assert.equal(insertion.valeurs[0], empreinteJeton(jeton));
        assert.notEqual(insertion.valeurs[0], jeton);
        assert.equal(insertion.valeurs[1], 30);
        assert.equal(insertion.valeurs[2], 3);
    });

    test('adresse inconnue : EXACTEMENT la même réponse, aucun jeton, aucun mail', async () => {
        const journalConnu = preparer(cliente());
        const connu = await appeler({ email: 'utilisateur@vite-gourmand.fr' });
        await connu.traitement;

        const journal = preparer(null);
        const inconnu = await appeler({ email: 'personne@exemple.fr' });

        assert.equal(inconnu.res.statut, connu.res.statut);
        assert.deepEqual(inconnu.res.corps, connu.res.corps);
        assert.equal(await inconnu.traitement, false);
        assert.equal(journal.ecritures.length, 0);
        assert.equal(journal.mails.length, 0);
        assert.equal(journalConnu.mails.length, 1);
    });

    test('compte désactivé : même réponse, aucun jeton, aucun mail', async () => {
        const journal = preparer(cliente({ actif: 0, role: 'employe' }));
        const { res, traitement } = await appeler({ email: 'utilisateur@vite-gourmand.fr' });

        assert.deepEqual(res.corps, { message: MESSAGE_DEMANDE });
        assert.equal(await traitement, false);
        assert.equal(journal.ecritures.length, 0);
        assert.equal(journal.mails.length, 0);
    });

    test('e-mail invalide : 400, aucune recherche en base', async () => {
        const journal = preparer(cliente());
        const { res } = await appeler({ email: 'pas-un-email' });

        assert.equal(res.statut, 400);
        assert.equal(res.corps.error, 'Saisissez une adresse e-mail valide.');
        assert.equal(journal.recherches.length, 0);
    });

    test("panne du serveur de mail : la réponse est déjà partie, l'erreur est seulement journalisée", async () => {
        preparer(cliente(), { panneMail: true });
        const erreurOriginale = console.error;
        console.error = () => {};
        try {
            const { res, traitement } = await appeler({ email: 'utilisateur@vite-gourmand.fr' });
            assert.deepEqual(res.corps, { message: MESSAGE_DEMANDE });
            assert.equal(await traitement, false);
        } finally {
            console.error = erreurOriginale;
        }
    });

    test('panne MySQL pendant la recherche : 500', async () => {
        pool.query = async () => { throw new Error('MySQL arrêté'); };
        const erreurOriginale = console.error;
        console.error = () => {};
        try {
            const { res } = await appeler({ email: 'utilisateur@vite-gourmand.fr' });
            assert.equal(res.statut, 500);
        } finally {
            console.error = erreurOriginale;
        }
    });
});
