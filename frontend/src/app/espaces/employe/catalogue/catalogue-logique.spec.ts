import { FormControl } from '@angular/forms';
import {
  MENU_VIDE,
  auMoinsUn,
  basculer,
  entierEntre,
  erreurLigne,
  grouperParCategorie,
  messageCatalogue,
  peutSupprimerMenu,
  peutSupprimerPlat,
  prixValide,
  texteCommandes,
  texteEntre,
  texteMenusDuPlat,
  valeursDepuisMenu,
  versDonneesMenu,
  versDonneesPlat,
  versHoraires,
  versLignes,
} from './catalogue-logique';

const erreurs = (validateur: (c: FormControl) => unknown, valeur: unknown) =>
  validateur(new FormControl(valeur));

describe('catégories et cases à cocher', () => {
  it('range les plats entrée → plat → dessert', () => {
    const groupes = grouperParCategorie([
      { id: 1, categorie: 'dessert' as const },
      { id: 2, categorie: 'entree' as const },
    ]);
    expect(groupes.map((g) => g.libelle)).toEqual(['Entrées', 'Plats', 'Desserts']);
    expect(groupes[0].elements.map((e) => e.id)).toEqual([2]);
    expect(groupes[1].elements).toEqual([]);
  });

  it('coche et décoche un identifiant', () => {
    expect(basculer([1, 9], 4)).toEqual([1, 4, 9]);
    expect(basculer([1, 4, 9], 4)).toEqual([1, 9]);
  });
});

describe('validateurs', () => {
  it('texte : obligatoire, longueur hors espaces', () => {
    expect(erreurs(texteEntre(3, 100), '   ')).toEqual({ required: true });
    expect(erreurs(texteEntre(3, 100), ' ab ')).toEqual({ longueur: { min: 3, max: 100 } });
    expect(erreurs(texteEntre(3, 100), 'Menu')).toBeNull();
  });

  it('entier dans les bornes', () => {
    expect(erreurs(entierEntre(1, 500), null)).toEqual({ required: true });
    expect(erreurs(entierEntre(1, 500), 6.5)).toEqual({ entier: { min: 1, max: 500 } });
    expect(erreurs(entierEntre(0, 365), 0)).toBeNull();
  });

  it('prix : virgule acceptée, 2 décimales', () => {
    expect(erreurs(prixValide, '42,50')).toBeNull();
    expect(erreurs(prixValide, 10.005)).toEqual({ prix: true });
    expect(erreurs(prixValide, 0)).toEqual({ prix: true });
  });

  it('au moins un plat', () => {
    expect(erreurs(auMoinsUn, [])).toEqual({ auMoinsUn: true });
    expect(erreurs(auMoinsUn, [3])).toBeNull();
  });

  it('messages', () => {
    expect(messageCatalogue({ longueur: { min: 10, max: 2000 } })).toBe(
      'Entre 10 et 2000 caractères.',
    );
    expect(messageCatalogue({ entier: { min: 0, max: 10000 } })).toBe(
      'Nombre entier de 0 à 10 000.',
    );
    expect(messageCatalogue(null)).toBeNull();
  });
});

describe('formulaire de menu', () => {
  it('menu → formulaire → corps (textes nettoyés, prix arrondi)', () => {
    const v = valeursDepuisMenu({
      menu_id: 8,
      actif: 1,
      nombre_commandes: 2,
      titre: 'Menu de Noël',
      description: 'Repas de fête',
      conditions: 'Commander 7 jours avant',
      nombre_personne_min: 8,
      delai_minimum_jours: 7,
      prix_par_personne: 75,
      quantite_restante: 5,
      theme_id: 2,
      regime_id: 1,
      plats: [9, 1, 4],
    });
    expect(v.plats).toEqual([1, 4, 9]);
    expect(
      versDonneesMenu({ ...v, titre: '  Menu de Noël 2026 ', prix_par_personne: '74,5' }),
    ).toEqual({
      titre: 'Menu de Noël 2026',
      description: 'Repas de fête',
      conditions: 'Commander 7 jours avant',
      nombre_personne_min: 8,
      delai_minimum_jours: 7,
      prix_par_personne: 74.5,
      quantite_restante: 5,
      theme_id: 2,
      regime_id: 1,
      plats: [1, 4, 9],
    });
  });

  it('un formulaire neuf ne contient aucun plat', () => {
    expect(MENU_VIDE.plats).toEqual([]);
  });
});

describe('listes', () => {
  it('menu : supprimable seulement s’il n’a jamais été commandé', () => {
    expect(peutSupprimerMenu({ nombre_commandes: 0 })).toBe(true);
    expect(peutSupprimerMenu({ nombre_commandes: 6 })).toBe(false);
    expect(texteCommandes(0)).toBe('Jamais commandé');
    expect(texteCommandes(6)).toBe('Commandé 6 fois');
  });

  it('plat : supprimable seulement s’il n’est dans aucun menu', () => {
    expect(peutSupprimerPlat({ menus: [] })).toBe(true);
    const plat = {
      menus: [
        { menu_id: 8, titre: 'Menu de Noël' },
        { menu_id: 10, titre: 'Menu Prestige' },
      ],
    };
    expect(peutSupprimerPlat(plat)).toBe(false);
    expect(texteMenusDuPlat(plat)).toBe('Dans : Menu de Noël, Menu Prestige');
    expect(texteMenusDuPlat({ menus: [] })).toBe('Dans aucun menu');
  });

  it('plat : corps nettoyé', () => {
    expect(versDonneesPlat({ titre: ' Bûche ', categorie: 'dessert', allergenes: [3] })).toEqual({
      titre: 'Bûche',
      categorie: 'dessert',
      allergenes: [3],
    });
  });
});

describe('horaires', () => {
  it('API → 7 lignes dans l’ordre, jour absent ou sans heures = fermé', () => {
    const lignes = versLignes([
      { jour: 'dimanche', heure_ouverture: null, heure_fermeture: null },
      { jour: 'lundi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
    ]);
    expect(lignes.map((l) => l.jour)).toEqual([
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
      'dimanche',
    ]);
    expect(lignes[0]).toEqual({
      jour: 'lundi',
      ferme: false,
      ouverture: '09:00',
      fermeture: '19:00',
    });
    expect(lignes[1].ferme).toBe(true);
    expect(lignes[6].ferme).toBe(true);
  });

  it('lignes → API : un jour fermé a ses heures à null', () => {
    const corps = versHoraires([
      { jour: 'lundi', ferme: false, ouverture: '09:00', fermeture: '19:00' },
      { jour: 'dimanche', ferme: true, ouverture: '10:00', fermeture: '12:00' },
    ]);
    expect(corps).toEqual([
      { jour: 'lundi', heure_ouverture: '09:00', heure_fermeture: '19:00' },
      { jour: 'dimanche', heure_ouverture: null, heure_fermeture: null },
    ]);
  });

  it('erreurs d’une ligne', () => {
    expect(erreurLigne({ jour: 'lundi', ferme: true, ouverture: '', fermeture: '' })).toBeNull();
    expect(erreurLigne({ jour: 'lundi', ferme: false, ouverture: '09:00', fermeture: '' })).toMatch(
      /deux heures/,
    );
    expect(
      erreurLigne({ jour: 'lundi', ferme: false, ouverture: '19:00', fermeture: '09:00' }),
    ).toMatch(/après/);
    expect(
      erreurLigne({ jour: 'lundi', ferme: false, ouverture: '09:00', fermeture: '19:00' }),
    ).toBeNull();
  });
});
