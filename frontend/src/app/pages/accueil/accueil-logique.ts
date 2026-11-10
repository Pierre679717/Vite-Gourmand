import { Avis } from '../../core/models/avis';
import { MenuResume } from '../../core/models/menu';

/**
 * Logique de la page d'accueil, sans Angular : testée dans accueil-logique.spec.ts.
 */

/**
 * « Nos menus du moment » : les premiers menus encore disponibles.
 * Un menu épuisé n'est pas mis en avant sur l'accueil.
 */
export function menusDuMoment(menus: MenuResume[], nombre = 3): MenuResume[] {
  return menus.filter((menu) => menu.quantite_restante > 0).slice(0, nombre);
}

/** Note moyenne arrondie à une décimale (4,5), ou null s'il n'y a aucun avis */
export function moyenneNotes(avis: Avis[]): number | null {
  if (avis.length === 0) {
    return null;
  }
  const somme = avis.reduce((total, unAvis) => total + unAvis.note, 0);
  return Math.round((somme / avis.length) * 10) / 10;
}

/**
 * Étoiles pleines et vides d'une note : 4 → [true, true, true, true, false].
 * La note est bornée entre 0 et 5 et arrondie à l'étoile la plus proche.
 */
export function etoiles(note: number): boolean[] {
  const pleines = Math.min(5, Math.max(0, Math.round(note)));
  return Array.from({ length: 5 }, (_, index) => index < pleines);
}
