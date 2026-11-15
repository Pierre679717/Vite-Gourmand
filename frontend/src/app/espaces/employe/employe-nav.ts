import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Onglets de l'espace employé : « Commandes » et « Avis clients ».
 * Même composant visuel que les onglets de l'espace client.
 * « Commandes » reste actif sur le détail d'une commande (/commandes/13).
 */
@Component({
  selector: 'app-employe-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="espace-nav" aria-label="Espace employé">
      <a
        class="espace-nav__lien"
        routerLink="/espace-employe/commandes"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Commandes</a
      >
      <a
        class="espace-nav__lien"
        routerLink="/espace-employe/avis"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Avis clients</a
      >
    </nav>
  `,
  styles: `
    @use 'variables' as *;
    @use 'mixins' as *;

    .espace-nav {
      display: flex;
      gap: $espace-6;
      margin-bottom: $espace-8;
      border-bottom: 1px solid $bordure;
    }

    .espace-nav__lien {
      padding: $espace-3 0;
      border-bottom: 3px solid transparent;
      margin-bottom: -1px;
      color: $texte-doux;
      font-weight: 600;
      text-decoration: none;

      @include focus-clavier;

      &:hover {
        color: $vert;
      }

      &--actif {
        border-bottom-color: $vert;
        color: $vert;
      }
    }
  `,
})
export class EmployeNav {}
