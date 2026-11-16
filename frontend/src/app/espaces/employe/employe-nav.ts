import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Onglets de l'espace employé : commandes, avis, puis le catalogue
 * (menus, plats, horaires). Même style que les onglets de l'espace client.
 * Un onglet reste actif sur ses sous-pages (/commandes/13, /menus/nouveau).
 *
 * L'administrateur fait tout ce que fait un employé (exigence du sujet) :
 * il voit ces mêmes onglets, précédés de ses deux onglets à lui
 * (Statistiques, Employés). Une seule barre, les pages employé ne sont
 * pas recopiées : elles sont réutilisées telles quelles.
 */
@Component({
  selector: 'app-employe-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="espace-nav"
      [attr.aria-label]="estAdmin() ? 'Espace administrateur' : 'Espace employé'"
    >
      @if (estAdmin()) {
        <a
          class="espace-nav__lien"
          routerLink="/espace-admin/statistiques"
          routerLinkActive="espace-nav__lien--actif"
          ariaCurrentWhenActive="page"
          >Statistiques</a
        >
        <a
          class="espace-nav__lien"
          routerLink="/espace-admin/employes"
          routerLinkActive="espace-nav__lien--actif"
          ariaCurrentWhenActive="page"
          >Employés</a
        >
      }
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
      <a
        class="espace-nav__lien"
        routerLink="/espace-employe/menus"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Menus</a
      >
      <a
        class="espace-nav__lien"
        routerLink="/espace-employe/plats"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Plats</a
      >
      <a
        class="espace-nav__lien"
        routerLink="/espace-employe/horaires"
        routerLinkActive="espace-nav__lien--actif"
        ariaCurrentWhenActive="page"
        >Horaires</a
      >
    </nav>
  `,
  styles: `
    @use 'variables' as *;
    @use 'mixins' as *;

    // flex-wrap : les onglets (5, ou 7 pour l'admin) passent sur plusieurs lignes sur mobile
    .espace-nav {
      display: flex;
      flex-wrap: wrap;
      column-gap: $espace-6;
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
export class EmployeNav {
  private readonly auth = inject(AuthService);
  protected readonly estAdmin = computed(() => this.auth.utilisateur()?.role === 'administrateur');
}
