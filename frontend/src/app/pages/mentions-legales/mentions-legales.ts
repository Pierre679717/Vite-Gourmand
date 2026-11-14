import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Mentions légales et données personnelles (RGPD).
 * La section #donnees-personnelles sert aussi de politique de
 * confidentialité (lien du pied de page).
 */
@Component({
  selector: 'app-mentions-legales',
  imports: [RouterLink],
  templateUrl: './mentions-legales.html',
  styleUrl: '../textes-legaux.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionsLegales {}
