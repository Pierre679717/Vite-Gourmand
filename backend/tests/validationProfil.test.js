/* ================================================================
   TESTS/VALIDATIONPROFIL.TEST.JS
   Règles des informations personnelles (inscription et « Mes informations »)
   Lancement : cd backend && npm test
   ================================================================ */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validerProfil } = require('../utils/validationProfil');

function profilValide(modifs = {}) {
    return {
        nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr',
        telephone: '06 12 34 56 78', adresse_postale: '12 rue Sainte-Catherine',
        code_postal: '33000', ville: 'Bordeaux', ...modifs
    };
}

describe('validerProfil', () => {

    test('profil valide : données nettoyées, aucune erreur', () => {
        const { donnees, erreurs } = validerProfil(profilValide({
            prenom: '  Camille ', email: ' Utilisateur@Vite-Gourmand.FR ', telephone: '06.12.34.56.78'
        }));
        assert.deepEqual(erreurs, []);
        assert.deepEqual(donnees, {
            nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr',
            telephone: '0612345678', adresse_postale: '12 rue Sainte-Catherine',
            code_postal: '33000', ville: 'Bordeaux'
        });
    });

    test('les champs en trop (rôle, mot de passe, actif) sont ignorés', () => {
        const { donnees } = validerProfil(profilValide({ role: 'administrateur', mot_de_passe: 'x', actif: 1 }));
        assert.deepEqual(Object.keys(donnees).sort(),
            ['adresse_postale', 'code_postal', 'email', 'nom', 'prenom', 'telephone', 'ville']);
    });

    const casRefuses = [
        ['nom vide',               { nom: '   ' },                 /nom est requis/],
        ['prénom trop long',       { prenom: 'a'.repeat(51) },     /prénom est requis/],
        ['e-mail sans point',      { email: 'camille@exemple' },   /e-mail invalide/],
        ['e-mail de 101 caractères',       { email: 'a'.repeat(96) + '@b.fr' }, /e-mail invalide/],
        ['téléphone à 9 chiffres', { telephone: '06 12 34 56 7' }, /téléphone invalide/],
        ['téléphone en 00',        { telephone: '0012345678' },    /téléphone invalide/],
        ['adresse absente',        { adresse_postale: undefined }, /adresse postale est requise/],
        ['code postal à 4 chiffres', { code_postal: '3300' },      /5 chiffres/],
        ['code postal en nombre',  { code_postal: 33000 },         /5 chiffres/],
        ['ville vide',             { ville: '' },                  /ville est requise/]
    ];
    for (const [cas, modif, message] of casRefuses) {
        test(`refusé : ${cas}`, () => {
            const { erreurs } = validerProfil(profilValide(modif));
            assert.equal(erreurs.length, 1, erreurs.join(' | '));
            assert.match(erreurs[0], message);
        });
    }

    test('corps absent : une erreur par champ', () => {
        assert.equal(validerProfil(undefined).erreurs.length, 7);
        assert.equal(validerProfil(null).erreurs.length, 7);
    });
});
