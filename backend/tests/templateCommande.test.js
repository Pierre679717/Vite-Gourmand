/* ================================================================
   TESTS/TEMPLATECOMMANDE.TEST.JS
   Tests du mail de confirmation de commande (aucun mail n'est envoyé)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    genererMailConfirmationCommande,
    echapperHtml,
    formaterEuros,
    formaterDate,
    formaterHeure
} = require('../email/templateCommande');

/** Commande Pessac vérifiée le 10/11 avec la vraie API de l'IGN */
function commande(modifs = {}) {
    return {
        numero_commande: 'VG-2026-0010',
        menu: 'Menu Traditionnel',
        nombre_personne: 8,
        date_prestation: '2026-12-05',
        heure_livraison: '12:30',
        adresse_prestation: 'Place de la Ve République',
        ville_prestation: 'Pessac',
        pret_materiel: false,
        contact_prenom: 'Camille',
        distance_km: 5.4,
        prix_par_personne: 48,
        reduction: 0,
        prix_menu: 384,
        prix_livraison: 8.19,
        prix_total: 392.19,
        ...modifs
    };
}

describe('mise en forme', () => {

    test('montants en euros à la française', () => {
        assert.equal(formaterEuros(392.19), '392,19 €');
        assert.equal(formaterEuros(1190.85), '1 190,85 €');
        assert.equal(formaterEuros(0), '0,00 €');
    });

    test('date et heure lisibles', () => {
        assert.equal(formaterDate('2026-12-05'), 'samedi 5 décembre 2026');
        assert.equal(formaterHeure('09:05'), '9 h 05');
    });

    test('echapperHtml neutralise les 5 caractères spéciaux', () => {
        assert.equal(echapperHtml(`<a href="x" onclick='y'>&</a>`),
            '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    });
});

describe('genererMailConfirmationCommande', () => {

    test('objet avec le numéro de commande', () => {
        assert.equal(genererMailConfirmationCommande(commande()).subject,
            'Commande VG-2026-0010 confirmée — Vite & Gourmand');
    });

    test('version texte : détail du prix et total', () => {
        const { text } = genererMailConfirmationCommande(commande());
        assert.match(text, /Bonjour Camille,/);
        assert.match(text, /samedi 5 décembre 2026, livraison à 12 h 30/);
        assert.match(text, /Menu : 8 pers\. × 48,00 € : 384,00 €/);
        assert.match(text, /Livraison \(5,4 km\) : 8,19 €/);
        assert.match(text, /Total TTC : 392,19 €/);
    });

    test('sans réduction : pas de ligne de réduction', () => {
        const { text, html } = genererMailConfirmationCommande(commande());
        assert.doesNotMatch(text, /Réduction/);
        assert.doesNotMatch(html, /Réduction/);
    });

    test('avec réduction et à Bordeaux : réduction affichée, livraison offerte', () => {
        const { text } = genererMailConfirmationCommande(commande({
            nombre_personne: 11, reduction: 52.8, prix_menu: 475.2,
            ville_prestation: 'Bordeaux', distance_km: 0, prix_livraison: 0, prix_total: 475.2
        }));
        assert.match(text, /Réduction de 10 % : − 52,80 €/);
        assert.match(text, /Livraison \(Bordeaux\) : Offerte/);
        assert.match(text, /Total TTC : 475,20 €/);
    });

    test('prêt de matériel : rappel des conditions (10 jours, 600 €)', () => {
        assert.doesNotMatch(genererMailConfirmationCommande(commande()).text, /600 €/);
        const { text, html } = genererMailConfirmationCommande(commande({ pret_materiel: true }));
        assert.match(text, /10 jours ouvrés.*600 €/);
        assert.match(html, /600 €/);
    });

    test('les champs saisis par le client sont échappés dans le HTML', () => {
        const { html } = genererMailConfirmationCommande(commande({
            adresse_prestation: '<img src=x onerror=alert(1)> 1 rue',
            contact_prenom: '<b>Camille</b>'
        }));
        assert.doesNotMatch(html, /<img src=x/);
        assert.doesNotMatch(html, /<b>Camille<\/b>/);
        assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; 1 rue/);
    });

    test('lien vers l\'espace client', () => {
        const { html, text } = genererMailConfirmationCommande(commande());
        assert.match(html, /href="https:\/\/[^"]+\/espace-utilisateur"/);
        assert.match(text, /Suivre ma commande : https:\/\/\S+\/espace-utilisateur/);
    });
});
