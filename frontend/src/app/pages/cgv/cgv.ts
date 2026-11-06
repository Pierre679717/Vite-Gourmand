import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Conditions générales de vente
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-cgv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Conditions générales de vente</h1>
      <p>Contenu à rédiger (commande, livraison, annulation, prêt de matériel).</p>
    </section>
  `,
})
export class Cgv {}
