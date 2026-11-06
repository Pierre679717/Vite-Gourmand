import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Espace administrateur
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-tableau-de-bord-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Espace administrateur</h1>
      <p>Comptes employés et statistiques.</p>
    </section>
  `,
})
export class TableauDeBordAdmin {}
