import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Page provisoire : point d'arrivée du bouton « Commander ce menu ».
 * Elle prouve que la redirection connexion → retour fonctionne.
 * Le formulaire de commande en étapes la remplacera (bloc « Commande »).
 */
@Component({
  selector: 'app-commander',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conteneur page">
      <p class="surtitre">Commande</p>
      <h1>Commander le menu n° {{ menuId() }}</h1>
      @if (personnes(); as nombre) {
        <p>Nombre de convives choisi : {{ nombre }}.</p>
      }
      <p>Le formulaire de commande sera disponible très bientôt.</p>
      <a class="btn btn--secondaire" [routerLink]="['/menus', menuId()]">Revenir au menu</a>
    </section>
  `,
})
export class Commander {
  /** :menuId de l'URL */
  readonly menuId = input.required<string>();
  /** ?personnes=... envoyé par la page détail */
  readonly personnes = input<string>();
}
