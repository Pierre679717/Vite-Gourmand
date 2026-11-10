import { Plat } from '../../core/models/menu';
import {
  decouperConditions,
  estimerPrix,
  mettreEnGrasLeDelai,
  platsParCategorie,
} from './detail-menu';

const plat = (plat_id: number, categorie: Plat['categorie']): Plat => ({
  plat_id,
  titre: `Plat ${plat_id}`,
  categorie,
  photo: null,
  allergenes: [],
});

describe('platsParCategorie', () => {
  it('range les plats dans l’ordre du repas', () => {
    const groupes = platsParCategorie([
      plat(1, 'dessert'),
      plat(2, 'entree'),
      plat(3, 'plat'),
      plat(4, 'entree'),
    ]);
    expect(groupes.map((g) => g.libelle)).toEqual(['Entrées', 'Plats', 'Desserts']);
    expect(groupes[0].plats.map((p) => p.plat_id)).toEqual([2, 4]);
  });

  it('n’affiche pas une catégorie sans plat', () => {
    const groupes = platsParCategorie([plat(1, 'plat')]);
    expect(groupes.map((g) => g.categorie)).toEqual(['plat']);
  });

  it('liste vide : aucun groupe', () => {
    expect(platsParCategorie([])).toEqual([]);
  });
});

describe('decouperConditions', () => {
  it('fait une puce par phrase', () => {
    const puces = decouperConditions(
      'À commander au moins 7 jours avant la prestation. À conserver au réfrigérateur entre 0 et 4 °C.',
    );
    expect(puces.length).toBe(2);
    expect(puces[1]).toEqual([
      { texte: 'À conserver au réfrigérateur entre 0 et 4 °C.', gras: false },
    ]);
  });

  it('ne coupe pas après un nombre décimal ou une abréviation suivie d’une minuscule', () => {
    expect(decouperConditions('Prévoir 4.5 kg. puis servir.').length).toBe(1);
  });

  it('texte vide ou absent : aucune puce', () => {
    expect(decouperConditions('')).toEqual([]);
    expect(decouperConditions(null)).toEqual([]);
  });
});

describe('mettreEnGrasLeDelai', () => {
  it('met le délai en gras', () => {
    expect(mettreEnGrasLeDelai('À commander au moins 7 jours avant.')).toEqual([
      { texte: 'À commander au moins ', gras: false },
      { texte: '7 jours', gras: true },
      { texte: ' avant.', gras: false },
    ]);
  });

  it('ne met pas en gras un autre délai que celui de la commande', () => {
    expect(mettreEnGrasLeDelai('Chauffe-plats prêtés, à restituer sous 10 jours ouvrés.')).toEqual([
      { texte: 'Chauffe-plats prêtés, à restituer sous 10 jours ouvrés.', gras: false },
    ]);
  });

  it('reconnaît aussi les semaines', () => {
    expect(mettreEnGrasLeDelai('Au moins 3 semaines avant.')[1]).toEqual({
      texte: '3 semaines',
      gras: true,
    });
  });

  it('phrase sans délai : un seul morceau, sans gras', () => {
    expect(mettreEnGrasLeDelai('À conserver au frais.')).toEqual([
      { texte: 'À conserver au frais.', gras: false },
    ]);
  });
});

describe('estimerPrix', () => {
  it('au minimum : pas de réduction, il manque 5 convives', () => {
    expect(estimerPrix(55, 6, 6)).toEqual({
      brut: 330,
      reduction: 0,
      total: 330,
      convivesManquants: 5,
    });
  });

  it('minimum + 4 : toujours pas de réduction', () => {
    expect(estimerPrix(55, 6, 10)).toEqual({
      brut: 550,
      reduction: 0,
      total: 550,
      convivesManquants: 1,
    });
  });

  it('minimum + 5 : réduction de 10 %', () => {
    expect(estimerPrix(55, 6, 11)).toEqual({
      brut: 605,
      reduction: 60.5,
      total: 544.5,
      convivesManquants: 0,
    });
  });

  it('calcule juste avec des centimes (pas d’erreur d’arrondi)', () => {
    // 19,99 € × 13 = 259,87 € ; −10 % = 25,99 € (arrondi au centime) → 233,88 €
    expect(estimerPrix(19.99, 8, 13)).toEqual({
      brut: 259.87,
      reduction: 25.99,
      total: 233.88,
      convivesManquants: 0,
    });
  });
});
