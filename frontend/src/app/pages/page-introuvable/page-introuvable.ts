import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Page affichée pour toute adresse qui ne correspond à aucune route. */
@Component({
  selector: 'app-page-introuvable',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Page introuvable</h1>
      <p>La page demandée n'existe pas ou a été déplacée.</p>
      <a class="btn btn--primaire" routerLink="/">Retour à l'accueil</a>
    </section>
  `,
})
export class PageIntrouvable {}
