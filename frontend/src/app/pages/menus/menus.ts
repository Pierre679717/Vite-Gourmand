import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Nos menus
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-menus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Nos menus</h1>
      <p>La liste des menus et leurs filtres arrivent dans le bloc « Menus » du planning.</p>
    </section>
  `,
})
export class Menus {}
