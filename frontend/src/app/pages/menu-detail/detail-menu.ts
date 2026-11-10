import { CategoriePlat, Plat } from '../../core/models/menu';

/**
 * Logique de la page détail d'un menu, sans Angular :
 * de simples fonctions, testées dans detail-menu.spec.ts.
 */

// ---------------------------------------------------------------------
// 1. Plats rangés par catégorie (Entrées, Plats, Desserts)
// ---------------------------------------------------------------------

export interface GroupePlats {
  categorie: CategoriePlat;
  libelle: string;
  plats: Plat[];
}

const CATEGORIES: { categorie: CategoriePlat; libelle: string }[] = [
  { categorie: 'entree', libelle: 'Entrées' },
  { categorie: 'plat', libelle: 'Plats' },
  { categorie: 'dessert', libelle: 'Desserts' },
];

/** Range les plats dans l'ordre du repas. Une catégorie sans plat n'est pas affichée. */
export function platsParCategorie(plats: Plat[]): GroupePlats[] {
  return CATEGORIES.map(({ categorie, libelle }) => ({
    categorie,
    libelle,
    plats: plats.filter((plat) => plat.categorie === categorie),
  })).filter((groupe) => groupe.plats.length > 0);
}

// ---------------------------------------------------------------------
// 2. Conditions du menu : une puce par phrase, délai en gras
// ---------------------------------------------------------------------

/** Morceau de texte, en gras ou non (affiché sans innerHTML : pas de risque XSS) */
export interface Segment {
  texte: string;
  gras: boolean;
}

/** Condition commune à tous les menus (CGV : matériel prêté) */
export const CONDITION_MATERIEL =
  'Matériel prêté : à restituer sous 10 jours ouvrés, sinon 600 € de frais (CGV).';

/**
 * "À commander au moins 7 jours avant. À conserver au frais."
 * → [ [« À commander au moins », « 7 jours » en gras, « avant. »], [« À conserver au frais. »] ]
 * Les phrases sont coupées après un point suivi d'une majuscule.
 */
export function decouperConditions(texte: string | null | undefined): Segment[][] {
  const phrases = (texte ?? '')
    .split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/)
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase !== '');
  return phrases.map(mettreEnGrasLeDelai);
}

/** Met en gras « 7 jours », « 3 semaines »... : l'information la plus importante */
export function mettreEnGrasLeDelai(phrase: string): Segment[] {
  const correspondance = /\d+\s+(?:jours?|semaines?)/.exec(phrase);
  if (!correspondance) {
    return [{ texte: phrase, gras: false }];
  }
  const debut = correspondance.index;
  const fin = debut + correspondance[0].length;
  return [
    { texte: phrase.slice(0, debut), gras: false },
    { texte: correspondance[0], gras: true },
    { texte: phrase.slice(fin), gras: false },
  ].filter((segment) => segment.texte !== '');
}

// ---------------------------------------------------------------------
// 3. Estimation du prix (mêmes règles que backend/utils/prix.js)
// ---------------------------------------------------------------------

/** Convives en plus du minimum pour obtenir la réduction */
export const PERSONNES_EN_PLUS = 5;
const TAUX_REDUCTION = 0.1;

export interface Estimation {
  /** Nombre de convives × prix par personne */
  brut: number;
  /** Montant de la réduction (0 si non applicable) */
  reduction: number;
  /** Prix du menu, réduction déduite (hors livraison) */
  total: number;
  /** Convives à ajouter pour obtenir la réduction (0 si elle est déjà acquise) */
  convivesManquants: number;
}

/**
 * Estime le prix du menu, hors livraison.
 * Calcul en centimes (entiers) pour éviter les erreurs d'arrondi des décimaux,
 * exactement comme le serveur, qui reste le seul à fixer le prix final.
 */
export function estimerPrix(
  prixParPersonne: number,
  minimum: number,
  convives: number,
): Estimation {
  const brutCts = Math.round(prixParPersonne * 100) * convives;
  const seuil = minimum + PERSONNES_EN_PLUS;
  const reductionCts = convives >= seuil ? Math.round(brutCts * TAUX_REDUCTION) : 0;
  return {
    brut: brutCts / 100,
    reduction: reductionCts / 100,
    total: (brutCts - reductionCts) / 100,
    convivesManquants: Math.max(0, seuil - convives),
  };
}
