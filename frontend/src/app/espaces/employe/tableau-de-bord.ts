import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Espace employé
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-tableau-de-bord-employe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Espace employé</h1>
      <p>Gestion des commandes, des menus et des avis.</p>
    </section>
  `,
})
export class TableauDeBordEmploye {}
