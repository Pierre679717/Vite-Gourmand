/* ================================================================
   TESTS/CONTACT.TEST.JS
   POST /api/contact : titre, description, e-mail ; HTML échappé
   Lancement : cd backend && npm test
   ================================================================
   transporter.sendMail est remplacé par une fausse fonction :
   aucun mail ne part, on regarde ce qui aurait été envoyé.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { transporter } = require('../email/mailer');
const ContactController = require('../controllers/contact.controller');
const { validerContact } = require('../controllers/contact.controller');
const { genererMailContact } = require('../email/templateContact');
const { echapperHtml } = require('../utils/echapperHtml');

const corpsValide = (modifs = {}) => ({
    titre: 'Mariage le 20 juin',
    description: 'Bonjour,\nPouvez-vous nous proposer un menu pour 80 personnes ?',
    email: 'Camille.Martin@Example.com',
    ...modifs
});

function fauxRes() {
    return {
        statut: 200, corps: null,
        status(code) { this.statut = code; return this; },
        json(donnees) { this.corps = donnees; return this; }
    };
}

const envoiOriginal = transporter.sendMail;
afterEach(() => {
    transporter.sendMail = envoiOriginal;
    delete process.env.CONTACT_DESTINATAIRE;
});

describe('echapperHtml', () => {

    test('les 5 caractères spéciaux sont remplacés, & en premier', () => {
        assert.equal(echapperHtml('<a href="x">Tom & Jerry\'s</a>'),
            '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
        assert.equal(echapperHtml('&lt;'), '&amp;lt;');
    });
});

describe('validerContact', () => {

    test('message valide : e-mail en minuscules, titre sur une ligne', () => {
        const { donnees, erreurs } = validerContact(corpsValide({ titre: '  Mariage\n le 20 juin ' }));
        assert.deepEqual(erreurs, []);
        assert.equal(donnees.titre, 'Mariage le 20 juin');
        assert.equal(donnees.email, 'camille.martin@example.com');
    });

    test('les anciens champs (nom, sujet, message) ne suffisent plus', () => {
        const { erreurs } = validerContact({ nom: 'Camille', sujet: 'Mariage', message: 'Bonjour', email: 'a@b.fr' });
        assert.equal(erreurs.length, 2);
    });

    const casRefuses = [
        ['titre de 2 caractères',   { titre: 'ok' },                 /titre est requis/],
        ['titre trop long',         { titre: 'a'.repeat(101) },      /titre est requis/],
        ['message trop court',      { description: 'Bonjour' },      /message est requis/],
        ['message trop long',       { description: 'a'.repeat(2001) }, /message est requis/],
        ['e-mail sans point',       { email: 'camille@exemple' },    /e-mail invalide/],
        ['e-mail absent',           { email: undefined },            /e-mail invalide/],
        ['message non texte',       { description: 123456789012 },   /message est requis/]
    ];
    for (const [cas, modif, message] of casRefuses) {
        test(`refusé : ${cas}`, () => {
            const { erreurs } = validerContact(corpsValide(modif));
            assert.equal(erreurs.length, 1, erreurs.join(' | '));
            assert.match(erreurs[0], message);
        });
    }
});

describe('genererMailContact', () => {

    test('le HTML tapé par le visiteur est échappé (dette corrigée)', () => {
        const { html, texte, sujet } = genererMailContact({
            titre: '<b>Urgent</b>',
            description: '<script>alert(1)</script>\n<a href="https://piege.example">Cliquez</a>',
            email: 'pirate@example.com'
        });
        assert.equal(html.includes('<script>'), false);
        assert.equal(html.includes('<a href="https://piege.example">'), false);
        assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;a href=&quot;https://piege.example&quot;&gt;'), true);
        assert.equal(html.includes('&lt;b&gt;Urgent&lt;/b&gt;'), true);
        assert.equal(sujet, '[Contact] <b>Urgent</b>', 'le sujet est du texte brut, pas du HTML');
        assert.match(texte, /<script>alert\(1\)<\/script>/, 'la version texte garde le message tel quel');
    });

    test('les retours à la ligne du message deviennent des <br>', () => {
        const { html } = genererMailContact({ titre: 'Titre', description: 'ligne 1\nligne 2\r\nligne 3', email: 'a@b.fr' });
        assert.equal(html.includes('ligne 1<br>ligne 2<br>ligne 3'), true);
    });
});

describe('POST /api/contact', () => {

    test('envoi réussi : 201, mail vers l\'entreprise avec réponse au visiteur', async () => {
        let mail = null;
        transporter.sendMail = async (options) => { mail = options; return { messageId: '1' }; };
        process.env.CONTACT_DESTINATAIRE = 'julie@vite-gourmand.fr';
        const res = fauxRes();

        await ContactController.envoyer({ body: corpsValide() }, res);

        assert.equal(res.statut, 201);
        assert.equal(mail.to, 'julie@vite-gourmand.fr');
        assert.equal(mail.replyTo, 'camille.martin@example.com');
        assert.equal(mail.subject, '[Contact] Mariage le 20 juin');
        assert.ok(mail.html && mail.text, 'versions HTML et texte');
    });

    test('destinataire par défaut si CONTACT_DESTINATAIRE est absent', async () => {
        let mail = null;
        transporter.sendMail = async (options) => { mail = options; };

        await ContactController.envoyer({ body: corpsValide() }, fauxRes());

        assert.equal(mail.to, 'contact@vite-gourmand.fr');
    });

    test('échec de l\'envoi : 503 (le message serait perdu, le visiteur doit le savoir)', async (t) => {
        t.mock.method(console, 'error', () => {});
        transporter.sendMail = async () => { throw new Error('Invalid login: 535'); };
        const res = fauxRes();

        await ContactController.envoyer({ body: corpsValide() }, res);

        assert.equal(res.statut, 503);
        assert.doesNotMatch(res.corps.error, /535|login/, 'pas de détail technique');
    });

    test('champs invalides : 400 avec toutes les erreurs, aucun mail', async () => {
        transporter.sendMail = async () => { throw new Error('ne doit pas être appelé'); };
        const res = fauxRes();

        await ContactController.envoyer({ body: { titre: '', description: '', email: 'x' } }, res);

        assert.equal(res.statut, 400);
        assert.equal(res.corps.erreurs.length, 3);
    });

    test('corps absent : 400 sans planter', async () => {
        const res = fauxRes();
        await ContactController.envoyer({ body: undefined }, res);
        assert.equal(res.statut, 400);
    });
});
