import { FiltresMenus, MenuResume } from '../../core/models/menu';

/**
 * Logique de la page Menus, sans Angular : de simples fonctions,
 * faciles à tester (voir filtres-menus.spec.ts).
 */

// ---------------------------------------------------------------------
// 1. Du formulaire aux filtres de l'API
// ---------------------------------------------------------------------

/** Valeur brute du formulaire de filtres (formulaire.getRawValue()) */
export interface ValeurFormulaireFiltres {
  /** Curseur « Prix maximum » (null tant que les bornes ne sont pas connues) */
  prixMax: number | null;
  /** Fourchette « De … À … » : champs number, null quand ils sont vides */
  fourchetteMin: number | null;
  fourchetteMax: number | null;
  /** Pastilles radio : '' = tous, sinon l'identifiant en texte */
  theme: string;
  regime: string;
  personnes: number | null;
}

export const FORMULAIRE_VIDE: ValeurFormulaireFiltres = {
  prixMax: null,
  fourchetteMin: null,
  fourchetteMax: null,
  theme: '',
  regime: '',
  personnes: null,
};

export interface ResultatFiltres {
  filtres: FiltresMenus;
  /** true si le prix maximum est sous le bas de la fourchette : aucun menu possible */
  incoherent: boolean;
}

/** Nombre strictement positif, sinon undefined */
function positif(valeur: number | null): number | undefined {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0 ? valeur : undefined;
}

/** Entier entre 1 et max (texte d'un bouton radio ou nombre), sinon undefined */
function entier(valeur: string | number | null, max: number): number | undefined {
  const nombre = typeof valeur === 'string' && valeur !== '' ? Number(valeur) : valeur;
  return typeof nombre === 'number' && Number.isInteger(nombre) && nombre >= 1 && nombre <= max
    ? nombre
    : undefined;
}

/**
 * Transforme la saisie de l'utilisateur en filtres pour l'API.
 * - Une valeur vide ou invalide n'est pas envoyée (pas de filtre).
 * - Curseur poussé au maximum (`plafond`) = « pas de limite » : pas de filtre.
 * - Le curseur et le « À » de la fourchette se combinent : on garde le plus bas.
 *   Si ce prix maximum est sous le « De », aucun menu ne peut correspondre :
 *   on le signale au lieu d'interroger le serveur.
 */
export function construireFiltres(
  valeur: ValeurFormulaireFiltres,
  plafond?: number,
): ResultatFiltres {
  const curseur = positif(valeur.prixMax);
  const curseurActif = curseur !== undefined && (plafond === undefined || curseur < plafond);

  const plafonds = [positif(valeur.fourchetteMax), curseurActif ? curseur : undefined].filter(
    (p): p is number => p !== undefined,
  );
  const prixMax = plafonds.length > 0 ? Math.min(...plafonds) : undefined;
  const prixMin = positif(valeur.fourchetteMin);

  const filtres: FiltresMenus = {};
  if (prixMin !== undefined) filtres.prix_min = prixMin;
  if (prixMax !== undefined) filtres.prix_max = prixMax;

  const theme = entier(valeur.theme, Number.MAX_SAFE_INTEGER);
  const regime = entier(valeur.regime, Number.MAX_SAFE_INTEGER);
  const personnes = entier(valeur.personnes, 1000);
  if (theme !== undefined) filtres.theme = theme;
  if (regime !== undefined) filtres.regime = regime;
  if (personnes !== undefined) filtres.personnes = personnes;

  const incoherent = prixMin !== undefined && prixMax !== undefined && prixMin > prixMax;
  return { filtres, incoherent };
}

/**
 * Bornes du curseur de prix, arrondies à 50 € : 240 → 200, 850 → 850.
 * null si l'API n'a pas renvoyé de bornes (aucun menu).
 */
export function bornesCurseur(
  prixMin: number | null | undefined,
  prixMax: number | null | undefined,
): { min: number; max: number } | null {
  if (typeof prixMin !== 'number' || typeof prixMax !== 'number') {
    return null;
  }
  return { min: Math.floor(prixMin / 50) * 50, max: Math.ceil(prixMax / 50) * 50 };
}

/** Comparaison pour distinctUntilChanged : ne relance pas la requête si rien n'a changé */
export function memesFiltres(a: ResultatFiltres, b: ResultatFiltres): boolean {
  return a.incoherent === b.incoherent && JSON.stringify(a.filtres) === JSON.stringify(b.filtres);
}

// ---------------------------------------------------------------------
// 2. État de la liste affichée (chargement, résultats, erreur)
// ---------------------------------------------------------------------

export interface EtatListe {
  chargement: boolean;
  /** null tant qu'aucune réponse n'est arrivée */
  menus: MenuResume[] | null;
  erreur: string | null;
  incoherent: boolean;
}

export const ETAT_INITIAL: EtatListe = {
  chargement: true,
  menus: null,
  erreur: null,
  incoherent: false,
};

export type EvenementListe =
  | { type: 'chargement' }
  | { type: 'succes'; menus: MenuResume[] }
  | { type: 'erreur'; message: string }
  | { type: 'incoherent' };

/**
 * Calcule le nouvel état à partir de l'état précédent et d'un événement.
 * Pendant un nouveau chargement, on garde les menus déjà affichés
 * (la liste ne « clignote » pas à chaque changement de filtre).
 */
export function etatSuivant(etat: EtatListe, evenement: EvenementListe): EtatListe {
  switch (evenement.type) {
    case 'chargement':
      return { ...etat, chargement: true, erreur: null, incoherent: false };
    case 'succes':
      return { chargement: false, menus: evenement.menus, erreur: null, incoherent: false };
    case 'erreur':
      return { chargement: false, menus: null, erreur: evenement.message, incoherent: false };
    case 'incoherent':
      return { chargement: false, menus: [], erreur: null, incoherent: true };
  }
}
