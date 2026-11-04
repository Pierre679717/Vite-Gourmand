import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Mon espace
 * Page provisoire : le contenu sera développé dans un prochain bloc du planning.
 */
@Component({
  selector: 'app-tableau-de-bord-utilisateur',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <h1 class="titre-section">Mon espace</h1>
      <p>Vos commandes, leur suivi et vos avis apparaîtront ici.</p>
    </section>
  `,
})
export class TableauDeBordUtilisateur {}
