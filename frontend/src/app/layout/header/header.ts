import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

/**
 * En-tête du site : logo, navigation principale et zone de compte
 * (bouton Connexion, ou prénom + Mon espace + Déconnexion).
 * Sur mobile, la navigation est repliée derrière un bouton « burger ».
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Touche Échap : referme le menu mobile
    '(document:keydown.escape)': 'fermerMenu()',
  },
})
export class Header {
  protected readonly auth = inject(AuthService);

  /** État du menu mobile : un signal, lu dans le template avec menuOuvert() */
  protected readonly menuOuvert = signal(false);

  constructor() {
    // Referme le menu après chaque changement de page
    inject(Router)
      .events.pipe(
        filter((evenement) => evenement instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.fermerMenu());
  }

  protected basculerMenu(): void {
    this.menuOuvert.update((ouvert) => !ouvert);
  }

  protected fermerMenu(): void {
    this.menuOuvert.set(false);
  }

  protected seDeconnecter(): void {
    this.auth.deconnexion();
  }
}
