import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Onglets de l'espace client : « Mes commandes » et « Mes informations ».
 * routerLinkActive ajoute la classe et aria-current="page" sur l'onglet de
 * la page affichée (le lecteur d'écran annonce « page actuelle »).
 */
@Component({
  selector: 'app-espace-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="espace-nav" aria-label="Mon espace">
      <a
        class="espace-nav__lien"
        routerLink="/espace-utilisateur"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: true }"
        >Mes commandes</a
      >
      <a
        class="espace-nav__lien"
        routerLink="/espace-utilisateur/informations"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Mes informations</a
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
export class EspaceNav {}
