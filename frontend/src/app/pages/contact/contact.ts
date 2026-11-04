import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Nous contacter
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Nous contacter</h1>
      <p>Le formulaire de contact arrive dans un prochain bloc.</p>
    </section>
  `,
})
export class Contact {}
