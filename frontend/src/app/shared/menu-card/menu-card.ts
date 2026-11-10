import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuResume } from '../../core/models/menu';

/**
 * Carte d'un menu, réutilisable :
 * - variante « catalogue » (page Menus) : régime, stock restant, bouton « Voir le détail » ;
 * - variante « compacte » (accueil, « Nos menus du moment ») : plus sobre, toute la carte est cliquable.
 *
 * Composant « de présentation » : il ne fait aucun appel à l'API, il affiche
 * seulement le menu qu'on lui donne en entrée.
 *
 * Utilisation : <app-menu-card [menu]="menu" /> ou <app-menu-card [menu]="menu" variante="compacte" />
 */
@Component({
  selector: 'app-menu-card',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './menu-card.html',
  styleUrl: './menu-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCard {
  /** Le menu à afficher (obligatoire) */
  readonly menu = input.required<MenuResume>();

  readonly variante = input<'catalogue' | 'compacte'>('catalogue');

  /** « 4 commandes encore possibles », « Plus que 2 commandes possibles »... */
  protected readonly stock = computed(() => texteStock(this.menu().quantite_restante));
}

/**
 * Texte du stock restant, comme sur la maquette.
 * Sous 4 commandes, on insiste (« Plus que ») pour signaler la rareté.
 */
export function texteStock(quantite: number): string {
  if (quantite <= 0) {
    return 'Épuisé pour le moment';
  }
  if (quantite === 1) {
    return 'Plus qu’une commande possible';
  }
  if (quantite <= 3) {
    return `Plus que ${quantite} commandes possibles`;
  }
  return `${quantite} commandes encore possibles`;
}
