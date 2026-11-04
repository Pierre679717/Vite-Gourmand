import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Page d'accueil
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-accueil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Bienvenue chez Vite &amp; Gourmand</h1>
      <p>Traiteur à Bordeaux depuis 25 ans. Page d'accueil en construction.</p>
    </section>
  `,
})
export class Accueil {}
