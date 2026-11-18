/* ================================================================
   TESTS/ENVOIAPIMAILTRAP.TEST.JS
   Envoi des mails par l'API HTTPS de Mailtrap (production Railway)
   Lancement : cd backend && npm test
   ================================================================
   fetch est remplacé par une fausse fonction : aucune requête ne part,
   on regarde l'adresse, les en-têtes et le corps qui auraient été envoyés.
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    analyserAdresse, construireCorps, creerTransportApi, URL_API_SANDBOX
} = require('../email/envoiApiMailtrap');
const { creerTransporter } = require('../email/mailer');

/** Faux fetch : mémorise l'appel et renvoie la réponse demandée */
function fauxFetch(statut, donnees) {
    const appels = [];
    const fonction = async (url, options) => {
        appels.push({ url, options, corps: JSON.parse(options.body) });
        return { ok: statut >= 200 && statut < 300, status: statut, json: async () => donnees };
    };
    return { fonction, appels };
}

const optionsMail = {
    from: 'Vite & Gourmand <no-reply@vite-gourmand.fr>',
    to: 'utilisateur@vite-gourmand.fr',
    subject: 'Commande VG-2026-0010 confirmée — Vite & Gourmand',
    html: '<p>Bonjour Camille</p>',
    text: 'Bonjour Camille'
};

describe('analyserAdresse', () => {
    test('« Nom <adresse> » est découpé en nom et e-mail', () => {
        assert.deepEqual(analyserAdresse('Vite & Gourmand <no-reply@vite-gourmand.fr>'),
            { name: 'Vite & Gourmand', email: 'no-reply@vite-gourmand.fr' });
    });
    test('une adresse seule donne seulement l\'e-mail', () => {
        assert.deepEqual(analyserAdresse(' camille@example.com '), { email: 'camille@example.com' });
    });
    test('les guillemets autour du nom sont retirés', () => {
        assert.deepEqual(analyserAdresse('"Contact" <contact@vite-gourmand.fr>'),
            { name: 'Contact', email: 'contact@vite-gourmand.fr' });
    });
});

describe('construireCorps', () => {
    test('to devient un tableau, reply_to un objet, html et text sont gardés', () => {
        const corps = construireCorps({ ...optionsMail, replyTo: 'visiteur@example.com' });
        assert.deepEqual(corps.from, { name: 'Vite & Gourmand', email: 'no-reply@vite-gourmand.fr' });
        assert.deepEqual(corps.to, [{ email: 'utilisateur@vite-gourmand.fr' }]);
        assert.deepEqual(corps.reply_to, { email: 'visiteur@example.com' });
        assert.equal(corps.subject, optionsMail.subject);
        assert.equal(corps.html, optionsMail.html);
        assert.equal(corps.text, optionsMail.text);
    });
    test('sans replyTo, le champ reply_to est absent', () => {
        assert.equal('reply_to' in construireCorps(optionsMail), false);
    });
    test('plusieurs destinataires séparés par des virgules', () => {
        const corps = construireCorps({ ...optionsMail, to: 'a@example.com, b@example.com' });
        assert.deepEqual(corps.to, [{ email: 'a@example.com' }, { email: 'b@example.com' }]);
    });
});

describe('creerTransportApi', () => {
    test('refuse de se créer sans jeton', () => {
        assert.throws(() => creerTransportApi({ idBoite: '123' }), /MAILTRAP_API_TOKEN/);
    });
    test('refuse un identifiant de boîte absent ou non numérique', () => {
        assert.throws(() => creerTransportApi({ jeton: 'j' }), /MAILTRAP_INBOX_ID/);
        assert.throws(() => creerTransportApi({ jeton: 'j', idBoite: 'abc' }), /MAILTRAP_INBOX_ID/);
    });

    test('sendMail appelle l\'API de la boîte avec le jeton dans Api-Token', async () => {
        const faux = fauxFetch(200, { success: true, message_ids: ['42'] });
        const transport = creerTransportApi({ jeton: 'jeton-test', idBoite: '2564102', fetch: faux.fonction });
        const info = await transport.sendMail(optionsMail);

        assert.equal(faux.appels.length, 1);
        const { url, options, corps } = faux.appels[0];
        assert.equal(url, URL_API_SANDBOX + '2564102');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Api-Token'], 'jeton-test');
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.deepEqual(corps.to, [{ email: 'utilisateur@vite-gourmand.fr' }]);
        assert.equal(info.messageId, '42');
    });

    test('une réponse en erreur devient une exception lisible (comme nodemailer)', async () => {
        const faux = fauxFetch(401, { success: false, errors: ['Unauthorized'] });
        const transport = creerTransportApi({ jeton: 'faux', idBoite: '1', fetch: faux.fonction });
        await assert.rejects(transport.sendMail(optionsMail), /API Mailtrap 401 : Unauthorized/);
    });

    test('success: false avec un code 200 est aussi une erreur', async () => {
        const faux = fauxFetch(200, { success: false, errors: ['Invalid from'] });
        const transport = creerTransportApi({ jeton: 'j', idBoite: '1', fetch: faux.fonction });
        await assert.rejects(transport.sendMail(optionsMail), /Invalid from/);
    });
});

describe('creerTransporter (choix selon les variables)', () => {
    test('avec MAILTRAP_API_TOKEN : envoi par l\'API', () => {
        const t = creerTransporter({ MAILTRAP_API_TOKEN: 'j', MAILTRAP_INBOX_ID: '123' });
        assert.equal(t.mode, 'api-mailtrap');
    });
    test('sans MAILTRAP_API_TOKEN : SMTP nodemailer (développement)', () => {
        const t = creerTransporter({ EMAIL_HOST: 'sandbox.smtp.mailtrap.io', EMAIL_PORT: '2525' });
        assert.equal(t.mode, undefined);
        assert.equal(typeof t.sendMail, 'function');
        assert.equal(t.options.port, 2525);
    });
});
