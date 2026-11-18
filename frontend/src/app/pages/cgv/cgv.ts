import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Conditions générales de vente.
 * Elles reprennent les règles appliquées par le site (prix, réduction,
 * livraison, modification et annulation, prêt de matériel et frais de 600 €)
 * pour que le client trouve écrit ce que le site calcule.
 */
@Component({
  selector: 'app-cgv',
  imports: [RouterLink],
  templateUrl: './cgv.html',
  styleUrl: '../textes-legaux.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cgv {}
