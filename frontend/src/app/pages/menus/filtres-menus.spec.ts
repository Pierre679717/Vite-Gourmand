import { MENU_GASTRO } from '../../core/models/menus-de-test';
import {
  ETAT_INITIAL,
  FORMULAIRE_VIDE,
  bornesCurseur,
  construireFiltres,
  etatSuivant,
  memesFiltres,
} from './filtres-menus';

describe('construireFiltres', () => {
  it('formulaire vide : aucun filtre', () => {
    expect(construireFiltres(FORMULAIRE_VIDE)).toEqual({ filtres: {}, incoherent: false });
  });

  it('curseur de prix maximum seul', () => {
    const { filtres } = construireFiltres({ ...FORMULAIRE_VIDE, prixMax: 400 }, 850);
    expect(filtres).toEqual({ prix_max: 400 });
  });

  it('curseur poussé au maximum : pas de filtre de prix', () => {
    const { filtres } = construireFiltres({ ...FORMULAIRE_VIDE, prixMax: 850 }, 850);
    expect(filtres).toEqual({});
  });

  it('fourchette De / À', () => {
    const { filtres } = construireFiltres({
      ...FORMULAIRE_VIDE,
      fourchetteMin: 300,
      fourchetteMax: 400,
    });
    expect(filtres).toEqual({ prix_min: 300, prix_max: 400 });
  });

  it('fourchette ouverte (« De » seul)', () => {
    const { filtres } = construireFiltres({ ...FORMULAIRE_VIDE, fourchetteMin: 600 });
    expect(filtres).toEqual({ prix_min: 600 });
  });

  it('curseur plus bas que le « À » : le prix le plus bas gagne', () => {
    const { filtres } = construireFiltres(
      { ...FORMULAIRE_VIDE, prixMax: 350, fourchetteMin: 300, fourchetteMax: 400 },
      850,
    );
    expect(filtres).toEqual({ prix_min: 300, prix_max: 350 });
  });

  it('curseur plus haut que le « À » : la fourchette gagne', () => {
    const { filtres } = construireFiltres(
      { ...FORMULAIRE_VIDE, prixMax: 700, fourchetteMin: 300, fourchetteMax: 400 },
      850,
    );
    expect(filtres).toEqual({ prix_min: 300, prix_max: 400 });
  });

  it('prix maximum sous le « De » : incohérent', () => {
    const resultat = construireFiltres(
      { ...FORMULAIRE_VIDE, prixMax: 300, fourchetteMin: 600 },
      850,
    );
    expect(resultat.incoherent).toBe(true);
  });

  it('fourchette inversée (De > À) : incohérent', () => {
    const resultat = construireFiltres({
      ...FORMULAIRE_VIDE,
      fourchetteMin: 500,
      fourchetteMax: 300,
    });
    expect(resultat.incoherent).toBe(true);
  });

  it('thème, régime et personnes convertis en nombres', () => {
    const { filtres } = construireFiltres({
      ...FORMULAIRE_VIDE,
      theme: '4',
      regime: '2',
      personnes: 8,
    });
    expect(filtres).toEqual({ theme: 4, regime: 2, personnes: 8 });
  });

  it('ignore les saisies invalides (négatif, décimal, trop grand, texte)', () => {
    const { filtres, incoherent } = construireFiltres({
      prixMax: -5,
      fourchetteMin: 0,
      fourchetteMax: Number.NaN,
      theme: 'abc',
      regime: '1.5',
      personnes: 5000,
    });
    expect(filtres).toEqual({});
    expect(incoherent).toBe(false);
  });

  it('ignore un nombre de personnes décimal', () => {
    expect(construireFiltres({ ...FORMULAIRE_VIDE, personnes: 6.5 }).filtres).toEqual({});
  });
});

describe('bornesCurseur', () => {
  it('arrondit les bornes à 50 €', () => {
    expect(bornesCurseur(240, 850)).toEqual({ min: 200, max: 850 });
    expect(bornesCurseur(252, 801)).toEqual({ min: 250, max: 850 });
  });

  it('renvoie null sans bornes', () => {
    expect(bornesCurseur(null, null)).toBeNull();
  });
});

describe('memesFiltres', () => {
  it('reconnaît deux résultats identiques (pas de nouvelle requête)', () => {
    const a = construireFiltres({ ...FORMULAIRE_VIDE, theme: '4' });
    const b = construireFiltres({ ...FORMULAIRE_VIDE, theme: '4', personnes: null });
    expect(memesFiltres(a, b)).toBe(true);
  });

  it('distingue deux filtres différents', () => {
    const a = construireFiltres({ ...FORMULAIRE_VIDE, theme: '4' });
    const b = construireFiltres({ ...FORMULAIRE_VIDE, theme: '3' });
    expect(memesFiltres(a, b)).toBe(false);
  });
});

describe('etatSuivant', () => {
  it('affiche les menus reçus', () => {
    const etat = etatSuivant(ETAT_INITIAL, { type: 'succes', menus: [MENU_GASTRO] });
    expect(etat).toEqual({
      chargement: false,
      menus: [MENU_GASTRO],
      erreur: null,
      incoherent: false,
    });
  });

  it('garde les menus affichés pendant un nouveau chargement', () => {
    const avant = etatSuivant(ETAT_INITIAL, { type: 'succes', menus: [MENU_GASTRO] });
    const pendant = etatSuivant(avant, { type: 'chargement' });
    expect(pendant.chargement).toBe(true);
    expect(pendant.menus).toEqual([MENU_GASTRO]);
  });

  it('remplace la liste par le message en cas d’erreur', () => {
    const etat = etatSuivant(ETAT_INITIAL, { type: 'erreur', message: 'Serveur injoignable' });
    expect(etat).toEqual({
      chargement: false,
      menus: null,
      erreur: 'Serveur injoignable',
      incoherent: false,
    });
  });

  it('efface l’erreur quand on relance la recherche', () => {
    const enErreur = etatSuivant(ETAT_INITIAL, { type: 'erreur', message: 'Erreur' });
    expect(etatSuivant(enErreur, { type: 'chargement' }).erreur).toBeNull();
  });

  it('filtres incohérents : liste vide, sans appel au serveur', () => {
    const etat = etatSuivant(ETAT_INITIAL, { type: 'incoherent' });
    expect(etat).toEqual({ chargement: false, menus: [], erreur: null, incoherent: true });
  });
});
