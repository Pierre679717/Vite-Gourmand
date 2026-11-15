import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  EtapeFrise,
  dateHeureFr,
  dateHeureIso,
} from '../../espaces/utilisateur/mes-commandes/suivi-commande';

/**
 * Frise du suivi d'une commande : chaque statut avec sa date et son heure,
 * l'étape actuelle mise en avant, puis les étapes à venir.
 * Partagée par le détail du client et celui de l'employé : les étapes
 * sont calculées par etapesFrise() (suivi-commande.ts, testée).
 * Pour un lecteur d'écran, « (étape actuelle) » et « (à venir) » sont lus
 * à la suite du libellé : la couleur n'est jamais la seule information.
 */
@Component({
  selector: 'app-frise-suivi',
  templateUrl: './frise-suivi.html',
  styleUrl: './frise-suivi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriseSuivi {
  readonly etapes = input.required<EtapeFrise[]>();

  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dateHeureIso = dateHeureIso;
}
