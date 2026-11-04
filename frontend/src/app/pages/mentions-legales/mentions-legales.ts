import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Mentions légales
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-mentions-legales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Mentions légales</h1>
      <p>Contenu à rédiger (éditeur, hébergeur, données personnelles).</p>
    </section>
  `,
})
export class MentionsLegales {}
