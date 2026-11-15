import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  DonneesMenu,
  DonneesPlat,
  Horaire,
  Jour,
  MenuEdition,
  MenuGestion,
  PlatEdition,
  PlatGestion,
} from '../../../core/models/catalogue';
import { CategoriePlat } from '../../../core/models/menu';

/**
 * Logique pure de la gestion du catalogue (menus, plats, horaires),
 * testée sans Angular. Les limites sont les mêmes que celles du serveur
 * (backend/utils/validationCatalogue.js), qui fait foi : le front aide
 * l'employé à corriger avant d'envoyer.
 */

// ---------------------------------------------------------------------
// 1. Catégories de plats
// ---------------------------------------------------------------------

export const CATEGORIES: readonly CategoriePlat[] = ['entree', 'plat', 'dessert'];

export const LIBELLES_CATEGORIE: Record<CategoriePlat, string> = {
  entree: 'Entrées',
  plat: 'Plats',
  dessert: 'Desserts',
};

export const LIBELLE_CATEGORIE_SINGULIER: Record<CategoriePlat, string> = {
  entree: 'Entrée',
  plat: 'Plat',
  dessert: 'Dessert',
};

/** Range des éléments par catégorie, dans l'ordre entrée → plat → dessert */
export function grouperParCategorie<T extends { categorie: CategoriePlat }>(
  elements: readonly T[],
): { categorie: CategoriePlat; libelle: string; elements: T[] }[] {
  return CATEGORIES.map((categorie) => ({
    categorie,
    libelle: LIBELLES_CATEGORIE[categorie],
    elements: elements.filter((e) => e.categorie === categorie),
  }));
}

/** Coche ou décoche un identifiant (liste triée, sans doublon) */
export function basculer(liste: readonly number[], id: number): number[] {
  return liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------
// 2. Validateurs (mêmes bornes que le serveur)
// ---------------------------------------------------------------------

/** Texte de min à max caractères, espaces du début et de la fin ignorés */
export function texteEntre(min: number, max: number): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const longueur = String(controle.value ?? '').trim().length;
    if (longueur === 0) return { required: true };
    return longueur < min || longueur > max ? { longueur: { min, max } } : null;
  };
}

/** Nombre entier de min à max */
export function entierEntre(min: number, max: number): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const v = controle.value;
    if (v === null || v === '' || v === undefined) return { required: true };
    return Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max
      ? null
      : { entier: { min, max } };
  };
}

/** Prix par personne : supérieur à 0, au plus 9 999,99, 2 décimales */
export function prixValide(controle: AbstractControl): ValidationErrors | null {
  const v = controle.value;
  if (v === null || v === '' || v === undefined) return { required: true };
  const prix = Number(String(v).replace(',', '.'));
  const deuxDecimales = Math.abs(prix * 100 - Math.round(prix * 100)) < 1e-6;
  return Number.isFinite(prix) && prix > 0 && prix <= 9999.99 && deuxDecimales
    ? null
    : { prix: true };
}

/** Liste d'identifiants non vide (plats d'un menu) */
export function auMoinsUn(controle: AbstractControl): ValidationErrors | null {
  return Array.isArray(controle.value) && controle.value.length > 0 ? null : { auMoinsUn: true };
}

/** Message sous un champ (le premier problème suffit) */
export function messageCatalogue(erreurs: ValidationErrors | null | undefined): string | null {
  if (!erreurs) return null;
  if (erreurs['required']) return 'Ce champ est obligatoire.';
  if (erreurs['longueur']) {
    return `Entre ${erreurs['longueur'].min} et ${erreurs['longueur'].max} caractères.`;
  }
  if (erreurs['entier']) {
    return `Nombre entier de ${erreurs['entier'].min} à ${erreurs['entier'].max.toLocaleString('fr-FR')}.`;
  }
  if (erreurs['prix']) return 'Prix supérieur à 0, avec 2 décimales au plus (ex. 42,50).';
  if (erreurs['auMoinsUn']) return 'Choisissez au moins un plat.';
  return 'Valeur invalide.';
}

// ---------------------------------------------------------------------
// 3. Formulaire de menu
// ---------------------------------------------------------------------

/** Valeurs du formulaire (null tant que l'employé n'a rien choisi) */
export interface ValeursMenu {
  titre: string;
  description: string;
  conditions: string;
  theme_id: number | null;
  regime_id: number | null;
  nombre_personne_min: number | null;
  delai_minimum_jours: number | null;
  prix_par_personne: number | string | null;
  quantite_restante: number | null;
  plats: number[];
}

export const MENU_VIDE: ValeursMenu = {
  titre: '',
  description: '',
  conditions: '',
  theme_id: null,
  regime_id: null,
  nombre_personne_min: null,
  delai_minimum_jours: null,
  prix_par_personne: null,
  quantite_restante: null,
  plats: [],
};

export function valeursDepuisMenu(menu: MenuEdition): ValeursMenu {
  return {
    titre: menu.titre,
    description: menu.description,
    conditions: menu.conditions,
    theme_id: menu.theme_id,
    regime_id: menu.regime_id,
    nombre_personne_min: menu.nombre_personne_min,
    delai_minimum_jours: menu.delai_minimum_jours,
    prix_par_personne: menu.prix_par_personne,
    quantite_restante: menu.quantite_restante,
    plats: [...menu.plats].sort((a, b) => a - b),
  };
}

/** Formulaire valide → corps de POST / PUT (textes nettoyés, nombres, virgule acceptée) */
export function versDonneesMenu(v: ValeursMenu): DonneesMenu {
  return {
    titre: v.titre.trim(),
    description: v.description.trim(),
    conditions: v.conditions.trim(),
    nombre_personne_min: Number(v.nombre_personne_min),
    delai_minimum_jours: Number(v.delai_minimum_jours),
    prix_par_personne:
      Math.round(Number(String(v.prix_par_personne).replace(',', '.')) * 100) / 100,
    quantite_restante: Number(v.quantite_restante),
    theme_id: Number(v.theme_id),
    regime_id: Number(v.regime_id),
    plats: [...v.plats],
  };
}

// ---------------------------------------------------------------------
// 4. Listes
// ---------------------------------------------------------------------

export const estSurLaCarte = (menu: Pick<MenuGestion, 'actif'>): boolean => menu.actif === 1;

/** Seul un menu jamais commandé peut être supprimé (sinon : retirer de la carte) */
export const peutSupprimerMenu = (menu: Pick<MenuGestion, 'nombre_commandes'>): boolean =>
  menu.nombre_commandes === 0;

export function texteCommandes(nombre: number): string {
  if (nombre === 0) return 'Jamais commandé';
  return `Commandé ${nombre} fois`;
}

/** Seul un plat présent dans aucun menu peut être supprimé */
export const peutSupprimerPlat = (plat: Pick<PlatGestion, 'menus'>): boolean =>
  plat.menus.length === 0;

export function texteMenusDuPlat(plat: Pick<PlatGestion, 'menus'>): string {
  if (plat.menus.length === 0) return 'Dans aucun menu';
  return `Dans : ${plat.menus.map((m) => m.titre).join(', ')}`;
}

// ---------------------------------------------------------------------
// 5. Formulaire de plat
// ---------------------------------------------------------------------

export interface ValeursPlat {
  titre: string;
  categorie: CategoriePlat | '';
  allergenes: number[];
}

export const PLAT_VIDE: ValeursPlat = { titre: '', categorie: '', allergenes: [] };

export function valeursDepuisPlat(plat: PlatEdition): ValeursPlat {
  return {
    titre: plat.titre,
    categorie: plat.categorie,
    allergenes: [...plat.allergenes].sort((a, b) => a - b),
  };
}

export function versDonneesPlat(v: ValeursPlat): DonneesPlat {
  return {
    titre: v.titre.trim(),
    categorie: v.categorie as CategoriePlat,
    allergenes: [...v.allergenes],
  };
}

// ---------------------------------------------------------------------
// 6. Horaires
// ---------------------------------------------------------------------

export const JOURS: readonly Jour[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

export const libelleJour = (jour: Jour): string => jour.charAt(0).toUpperCase() + jour.slice(1);

/** Une ligne du formulaire : « fermé » ou deux heures */
export interface LigneHoraire {
  jour: Jour;
  ferme: boolean;
  ouverture: string;
  fermeture: string;
}

/** Horaires de l'API → 7 lignes, lundi → dimanche (un jour absent = fermé) */
export function versLignes(horaires: readonly Horaire[]): LigneHoraire[] {
  return JOURS.map((jour) => {
    const h = horaires.find((x) => x.jour === jour);
    const ouvert = Boolean(h?.heure_ouverture && h?.heure_fermeture);
    return {
      jour,
      ferme: !ouvert,
      ouverture: ouvert ? h!.heure_ouverture!.slice(0, 5) : '',
      fermeture: ouvert ? h!.heure_fermeture!.slice(0, 5) : '',
    };
  });
}

/** 7 lignes → corps de PUT /api/employe/horaires (jour fermé = heures à null) */
export function versHoraires(lignes: readonly LigneHoraire[]): Horaire[] {
  return lignes.map((l) =>
    l.ferme
      ? { jour: l.jour, heure_ouverture: null, heure_fermeture: null }
      : { jour: l.jour, heure_ouverture: l.ouverture, heure_fermeture: l.fermeture },
  );
}

/** Erreur d'une ligne (mêmes règles que le serveur), ou null */
export function erreurLigne(ligne: LigneHoraire): string | null {
  if (ligne.ferme) return null;
  const heure = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!heure.test(ligne.ouverture) || !heure.test(ligne.fermeture)) {
    return 'Indiquez les deux heures, ou cochez « Fermé ».';
  }
  // Même longueur et même format : la comparaison de textes suffit
  return ligne.fermeture > ligne.ouverture ? null : 'La fermeture doit être après l’ouverture.';
}
