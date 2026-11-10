/* ================================================================
   TESTS/VALIDATIONCOMMANDE.TEST.JS
   Tests de la validation d'une commande et du délai des menus
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    validerCommande,
    validerDevis,
    verifierDelai,
    dateMinimumPrestation,
    ajouterJours,
    estDateValide,
    aujourdhuiParis
} = require('../utils/validationCommande');

// Date du jour fixée : les tests donnent le même résultat quel que soit le jour où on les lance
const AUJOURDHUI = '2026-11-10';

/** Une commande valide, que chaque test modifie sur un seul point */
function commandeValide(modifs = {}) {
    return {
        menu_id: 2,
        nombre_personne: 8,
        date_prestation: '2026-11-21',
        heure_livraison: '12:30',
        adresse_prestation: '12 avenue Jean Jaurès',
        ville_prestation: 'Pessac',
        pret_materiel: false,
        contact_nom: 'Laurent',
        contact_prenom: 'Camille',
        contact_email: 'utilisateur@vite-gourmand.fr',
        contact_telephone: '06 98 76 54 32',
        ...modifs
    };
}

describe('dates', () => {

    test('aujourdhuiParis : à 23 h 30 UTC le 10/11, il est déjà le 11/11 à Bordeaux', () => {
        assert.equal(aujourdhuiParis(new Date('2026-11-10T23:30:00Z')), '2026-11-11');
        assert.equal(aujourdhuiParis(new Date('2026-11-10T12:00:00Z')), '2026-11-10');
    });

    test('estDateValide refuse les dates qui n\'existent pas', () => {
        assert.equal(estDateValide('2026-11-21'), true);
        assert.equal(estDateValide('2028-02-29'), true);  // année bissextile
        assert.equal(estDateValide('2026-02-29'), false);
        assert.equal(estDateValide('2026-02-30'), false);
        assert.equal(estDateValide('2026-13-01'), false);
        assert.equal(estDateValide('21/11/2026'), false);
        assert.equal(estDateValide(undefined), false);
    });

    test('ajouterJours change de mois et d\'année', () => {
        assert.equal(ajouterJours('2026-11-10', 7), '2026-11-17');
        assert.equal(ajouterJours('2026-11-28', 5), '2026-12-03');
        assert.equal(ajouterJours('2026-12-20', 21), '2027-01-10');
    });
});

describe('délai minimum du menu', () => {

    test('date minimum = aujourd\'hui + délai', () => {
        assert.equal(dateMinimumPrestation(AUJOURDHUI, 7), '2026-11-17');
        assert.equal(dateMinimumPrestation(AUJOURDHUI, 21), '2026-12-01');
    });

    test('délai de 0 jour : au plus tôt demain', () => {
        assert.equal(dateMinimumPrestation(AUJOURDHUI, 0), '2026-11-11');
    });

    test('pile le jour minimum : accepté', () => {
        assert.equal(verifierDelai('2026-11-17', 7, AUJOURDHUI), null);
    });

    test('un jour trop tôt : refusé, avec la première date possible', () => {
        assert.equal(
            verifierDelai('2026-11-16', 7, AUJOURDHUI),
            'Ce menu se commande au moins 7 jour(s) à l\'avance : première date possible le 17/11/2026.'
        );
    });
});

describe('validerCommande', () => {

    test('commande valide : données nettoyées, aucune erreur', () => {
        const { donnees, erreurs } = validerCommande(commandeValide(), AUJOURDHUI);
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, {
            menuId: 2,
            nombrePersonne: 8,
            adressePrestation: '12 avenue Jean Jaurès',
            villePrestation: 'Pessac',
            datePrestation: '2026-11-21',
            heureLivraison: '12:30',
            pretMateriel: false,
            contactNom: 'Laurent',
            contactPrenom: 'Camille',
            contactEmail: 'utilisateur@vite-gourmand.fr',
            contactTelephone: '0698765432'
        });
    });

    test('les champs en trop (prix, distance) sont ignorés', () => {
        const { donnees, erreurs } = validerCommande(
            commandeValide({ prix_total: 1, distance_km: 0, utilisateur_id: 1 }),
            AUJOURDHUI
        );
        assert.deepEqual(erreurs, []);
        assert.equal('prixTotal' in donnees || 'distanceKm' in donnees || 'utilisateurId' in donnees, false);
    });

    test('espaces superflus retirés, e-mail en minuscules', () => {
        const { donnees } = validerCommande(commandeValide({
            adresse_prestation: '  12   avenue Jean Jaurès ',
            contact_email: ' Camille@Example.COM '
        }), AUJOURDHUI);
        assert.equal(donnees.adressePrestation, '12 avenue Jean Jaurès');
        assert.equal(donnees.contactEmail, 'camille@example.com');
    });

    test('pret_materiel absent : false', () => {
        const corps = commandeValide();
        delete corps.pret_materiel;
        assert.equal(validerCommande(corps, AUJOURDHUI).donnees.pretMateriel, false);
    });

    const casRefuses = [
        ['date d\'aujourd\'hui',          { date_prestation: '2026-11-10' }, /dans le futur/],
        ['date passée',                   { date_prestation: '2026-01-01' }, /dans le futur/],
        ['date inexistante',              { date_prestation: '2026-02-30' }, /Date de prestation invalide/],
        ['date au format français',       { date_prestation: '21/11/2026' }, /Date de prestation invalide/],
        ['heure 24:00',                   { heure_livraison: '24:00' },      /Heure de livraison/],
        ['heure sans minutes',            { heure_livraison: '12' },         /Heure de livraison/],
        ['menu en texte',                 { menu_id: '2' },                  /Menu invalide/],
        ['0 personne',                    { nombre_personne: 0 },            /nombre de personnes/],
        ['personnes en décimal',          { nombre_personne: 6.5 },          /nombre de personnes/],
        ['adresse trop courte',           { adresse_prestation: '12' },      /adresse/],
        ['ville avec des chiffres',       { ville_prestation: '33600' },     /ville/],
        ['ville avec une balise',         { ville_prestation: '<script>' },  /ville/],
        ['prêt de matériel en texte',     { pret_materiel: 'oui' },          /prêt de matériel/],
        ['nom vide',                      { contact_nom: '   ' },            /Nom invalide/],
        ['e-mail sans domaine',           { contact_email: 'camille@' },     /e-mail/],
        ['téléphone à 9 chiffres',        { contact_telephone: '069876543' },/téléphone/],
        ['téléphone commençant par 00',   { contact_telephone: '0098765432' },/téléphone/]
    ];
    for (const [nom, modif, attendu] of casRefuses) {
        test(`refusé : ${nom}`, () => {
            const { erreurs } = validerCommande(commandeValide(modif), AUJOURDHUI);
            assert.equal(erreurs.length, 1, erreurs.join(' | '));
            assert.match(erreurs[0], attendu);
        });
    }

    test('corps vide : une erreur par champ obligatoire', () => {
        const { erreurs } = validerCommande({}, AUJOURDHUI);
        assert.equal(erreurs.length, 10);
    });
});

describe('validerDevis', () => {

    test('ne demande que menu, personnes, adresse et ville', () => {
        const { donnees, erreurs } = validerDevis({
            menu_id: 2, nombre_personne: 8, adresse_prestation: '12 avenue Jean Jaurès', ville_prestation: 'Pessac'
        });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, {
            menuId: 2, nombrePersonne: 8, adressePrestation: '12 avenue Jean Jaurès', villePrestation: 'Pessac'
        });
    });

    test('corps absent : 4 erreurs', () => {
        assert.equal(validerDevis(undefined).erreurs.length, 4);
    });
});
