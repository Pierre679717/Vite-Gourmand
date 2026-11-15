/* ================================================================
   TESTS/TEMPLATESTATUT.TEST.JS
   Mails « retour de matériel » et « commande terminée »
   Lancement : cd backend && npm test
   ================================================================
   Aucun mail réel n'est envoyé : transporter.sendMail est remplacé
   par une fausse fonction qui note ce qu'on lui passe.
   ================================================================ */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { genererMailStatut, STATUTS_AVEC_MAIL } = require('../email/templateStatut');
const { transporter } = require('../email/mailer');
const { envoyerMailStatut } = require('../controllers/commande.controller');

const commande = (modifs = {}) => ({
    commande_id: 13, numero_commande: 'VG-2026-0013', contact_prenom: 'Camille', ...modifs
});

describe('genererMailStatut', () => {

    test('deux statuts seulement déclenchent un mail', () => {
        assert.deepEqual(STATUTS_AVEC_MAIL, ['attente_retour_materiel', 'terminee']);
        for (const statut of ['accepte', 'en_preparation', 'en_cours_livraison', 'livre', 'annulee']) {
            assert.equal(genererMailStatut(statut, commande()), null);
        }
    });

    test('retour de matériel : 10 jours ouvrés, 600 €, CGV, prise de contact', () => {
        const mail = genererMailStatut('attente_retour_materiel', commande());
        assert.equal(mail.subject, 'Commande VG-2026-0013 : matériel à restituer — Vite & Gourmand');
        for (const version of [mail.text, mail.html]) {
            assert.match(version, /10 jours ouvrés/);
            assert.match(version, /600 €/);
            assert.match(version, /conditions générales de vente/);
            assert.match(version, /\/contact/);
        }
        assert.match(mail.text, /^Bonjour Camille,/);
    });

    test('terminée : invitation à donner son avis, lien vers le suivi de la commande', () => {
        const mail = genererMailStatut('terminee', commande());
        assert.equal(mail.subject, 'Commande VG-2026-0013 terminée — donnez votre avis');
        assert.match(mail.text, /Donner mon avis : https:\/\/\S+\/espace-utilisateur\/commandes\/13$/m);
        assert.match(mail.html, /href="https:\/\/[^"]+\/espace-utilisateur\/commandes\/13"/);
        assert.doesNotMatch(mail.text, /600 €/);
    });

    test('le prénom est échappé dans le HTML, laissé tel quel dans le texte', () => {
        const mail = genererMailStatut('terminee', commande({ contact_prenom: '<script>alert(1)</script>' }));
        assert.doesNotMatch(mail.html, /<script>/);
        assert.match(mail.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
        assert.match(mail.text, /Merci <script>alert\(1\)<\/script> !/);
    });
});

describe('envoyerMailStatut', () => {

    const sendMailOriginal = transporter.sendMail;
    afterEach(() => { transporter.sendMail = sendMailOriginal; });

    const resultat = (statut) => ({
        statut, numeroCommande: 'VG-2026-0013', contactPrenom: 'Camille',
        contactEmail: 'utilisateur@vite-gourmand.fr'
    });

    test('envoie le mail au contact de la commande', async () => {
        const envoyes = [];
        transporter.sendMail = async (options) => { envoyes.push(options); };

        assert.equal(await envoyerMailStatut(13, resultat('attente_retour_materiel')), true);

        assert.equal(envoyes.length, 1);
        assert.equal(envoyes[0].to, 'utilisateur@vite-gourmand.fr');
        assert.match(envoyes[0].subject, /matériel à restituer/);
        assert.ok(envoyes[0].html && envoyes[0].text);
    });

    test('aucun mail pour un statut intermédiaire', async () => {
        let appele = false;
        transporter.sendMail = async () => { appele = true; };
        assert.equal(await envoyerMailStatut(13, resultat('en_preparation')), false);
        assert.equal(appele, false);
    });

    test('serveur de mail en panne : pas d\'exception (le statut est déjà enregistré)', async (t) => {
        t.mock.method(console, 'error', () => {});
        transporter.sendMail = async () => { throw new Error('Invalid login: 535'); };
        assert.equal(await envoyerMailStatut(13, resultat('terminee')), false);
        assert.equal(console.error.mock.callCount(), 1);
    });
});
