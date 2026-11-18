import { Avis } from '../../core/models/avis';
import { MENU_GASTRO, MENU_PAQUES_EPUISE } from '../../core/models/menus-de-test';
import { etoiles, menusDuMoment, moyenneNotes } from './accueil-logique';

const avis = (note: number): Avis => ({
  avis_id: note,
  note,
  commentaire: 'Très bien',
  date_creation: '2026-10-01 12:00:00',
  prenom: 'Sophie',
  initiale_nom: 'B.',
  menu: 'Menu Gastronomique',
});

describe('menusDuMoment', () => {
  it('écarte les menus épuisés', () => {
    expect(menusDuMoment([MENU_PAQUES_EPUISE, MENU_GASTRO])).toEqual([MENU_GASTRO]);
  });

  it('garde au plus 3 menus', () => {
    const menus = [1, 2, 3, 4, 5].map((id) => ({ ...MENU_GASTRO, menu_id: id }));
    expect(menusDuMoment(menus).map((m) => m.menu_id)).toEqual([1, 2, 3]);
  });

  it('liste vide : aucun menu', () => {
    expect(menusDuMoment([])).toEqual([]);
  });
});

describe('moyenneNotes', () => {
  it('calcule la moyenne à une décimale', () => {
    expect(moyenneNotes([avis(5), avis(4)])).toBe(4.5);
    expect(moyenneNotes([avis(5), avis(4), avis(4)])).toBe(4.3);
  });

  it('aucun avis : pas de moyenne', () => {
    expect(moyenneNotes([])).toBeNull();
  });
});

describe('etoiles', () => {
  it('4 sur 5 : quatre pleines, une vide', () => {
    expect(etoiles(4)).toEqual([true, true, true, true, false]);
  });

  it('arrondit à l’étoile la plus proche', () => {
    expect(etoiles(4.5).filter(Boolean).length).toBe(5);
    expect(etoiles(4.3).filter(Boolean).length).toBe(4);
  });

  it('borne la note entre 0 et 5', () => {
    expect(etoiles(9).filter(Boolean).length).toBe(5);
    expect(etoiles(-2).filter(Boolean).length).toBe(0);
  });
});
