/* ================================================================
   TESTS/VALIDATIONCATALOGUE.TEST.JS
   Validation des menus, plats et horaires (utils/validationCatalogue.js)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    entier, listeIds, validerMenu, validerPlat, validerHoraires
} = require('../utils/validationCatalogue');

describe('entier et listeIds', () => {

    test('accepte un nombre ou un texte de chiffres dans les bornes', () => {
        assert.equal(entier(12, 1, 500), 12);
        assert.equal(entier(' 12 ', 1, 500), 12);
        assert.equal(entier(0, 0, 365), 0);
    });

    test('refuse décimales, texte mélangé, booléens, hors bornes', () => {
        for (const v of [12.5, '12abc', '1e3', true, null, [], 501, -1]) {
            assert.equal(entier(v, 0, 500), null, String(v));
        }
    });

    test('listeIds : entiers positifs sans doublon, sinon null', () => {
        assert.deepEqual(listeIds([3, '5', 3]), [3, 5]);
        assert.deepEqual(listeIds([]), []);
        assert.equal(listeIds([1, 0]), null);
        assert.equal(listeIds('1,2'), null);
    });
});

/** Un menu valide ; chaque test en modifie un champ */
const menu = (modifs = {}) => ({
    titre: '  Menu de Noël  ',
    description: 'Un repas de fête pour toute la famille.',
    conditions: 'Commander au moins 7 jours avant la prestation.',
    nombre_personne_min: 6,
    delai_minimum_jours: 7,
    prix_par_personne: 75,
    quantite_restante: 10,
    theme_id: 1,
    regime_id: 1,
    plats: [1, 4, 9],
    ...modifs
});

describe('validerMenu', () => {

    test('menu valide : texte nettoyé, liste blanche', () => {
        const { donnees, erreurs } = validerMenu(menu({ actif: 0, menu_id: 99 }));
        assert.deepEqual(erreurs, []);
        assert.equal(donnees.titre, 'Menu de Noël');
        assert.deepEqual(donnees.plats, [1, 4, 9]);
        assert.equal('actif' in donnees, false);
        assert.equal('menu_id' in donnees, false);
    });

    test('prix : virgule acceptée, 2 décimales au plus', () => {
        assert.equal(validerMenu(menu({ prix_par_personne: '42,50' })).donnees.prix_par_personne, 42.5);
        // 0,1 + 0,2 = 0,30000000000000004 en binaire : accepté et arrondi à 0,30
        assert.equal(validerMenu(menu({ prix_par_personne: 0.1 + 0.2 })).donnees.prix_par_personne, 0.3);
        assert.equal(validerMenu(menu({ prix_par_personne: 19.99 })).erreurs.length, 0);
        assert.equal(validerMenu(menu({ prix_par_personne: 10.005 })).erreurs.length, 1);
        assert.equal(validerMenu(menu({ prix_par_personne: 0 })).erreurs.length, 1);
        assert.equal(validerMenu(menu({ prix_par_personne: 10000 })).erreurs.length, 1);
    });

    test('au moins un plat, 30 au maximum', () => {
        assert.deepEqual(validerMenu(menu({ plats: [] })).erreurs, ['Choisissez au moins un plat.']);
        assert.deepEqual(validerMenu(menu({ plats: undefined })).erreurs, ['Choisissez au moins un plat.']);
        const trop = Array.from({ length: 31 }, (_, i) => i + 1);
        assert.deepEqual(validerMenu(menu({ plats: trop })).erreurs, ['30 plats au maximum par menu.']);
    });

    test('corps vide : toutes les erreurs listées', () => {
        assert.equal(validerMenu(undefined).erreurs.length, 10);
    });

    test('textes trop courts ou non texte', () => {
        const { erreurs } = validerMenu(menu({ titre: 'ab', description: 42 }));
        assert.equal(erreurs.length, 2);
        assert.match(erreurs[0], /Titre/);
        assert.match(erreurs[1], /Description/);
    });
});

describe('validerPlat', () => {

    test('plat valide, allergènes facultatifs', () => {
        assert.deepEqual(validerPlat({ titre: ' Bûche glacée ', categorie: 'dessert', allergenes: [1, '7', 7] }), {
            donnees: { titre: 'Bûche glacée', categorie: 'dessert', allergenes: [1, 7] },
            erreurs: []
        });
        assert.deepEqual(validerPlat({ titre: 'Salade verte', categorie: 'entree' }).donnees.allergenes, []);
    });

    test('catégorie inconnue, allergènes invalides', () => {
        const { erreurs } = validerPlat({ titre: 'Salade', categorie: 'boisson', allergenes: [0] });
        assert.equal(erreurs.length, 2);
    });
});

/** Semaine valide : fermé le dimanche */
const semaine = () => [
    { jour: 'lundi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
    { jour: 'mardi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
    { jour: 'mercredi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
    { jour: 'jeudi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
    { jour: 'vendredi', heure_ouverture: '09:00', heure_fermeture: '20:30' },
    { jour: 'dimanche', heure_ouverture: null, heure_fermeture: null },
    { jour: 'samedi', heure_ouverture: '10:00', heure_fermeture: '18:00' }
];

describe('validerHoraires', () => {

    test('semaine valide, remise dans l’ordre lundi → dimanche', () => {
        const { donnees, erreurs } = validerHoraires({ horaires: semaine() });
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees.map((h) => h.jour),
            ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']);
        assert.equal(donnees[6].heure_ouverture, null);
    });

    test('7 jours, chacun une seule fois', () => {
        assert.match(validerHoraires(semaine().slice(1)).erreurs[0], /7 jours/);
        const doublon = semaine();
        doublon[6].jour = 'lundi';
        assert.match(validerHoraires(doublon).erreurs[0], /une seule fois/);
    });

    test('heures invalides, inversées ou une seule renseignée', () => {
        const s = semaine();
        s[0].heure_fermeture = '08:00';
        s[1].heure_ouverture = '9h';
        s[2].heure_fermeture = null;
        const { donnees, erreurs } = validerHoraires(s);
        assert.deepEqual(donnees, []);
        assert.deepEqual(erreurs, [
            'Lundi : la fermeture doit être après l\'ouverture.',
            'Mardi : heures au format HH:MM, ou les deux vides si fermé.',
            'Mercredi : heures au format HH:MM, ou les deux vides si fermé.'
        ]);
    });
});
