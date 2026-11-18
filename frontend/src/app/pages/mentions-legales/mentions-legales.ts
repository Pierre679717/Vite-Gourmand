import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CREDITS_PHOTOS } from './credits-photos';

/**
 * Mentions légales et données personnelles (RGPD).
 * La section #donnees-personnelles sert aussi de politique de
 * confidentialité (lien du pied de page). La section #credits-photos
 * cite l'auteur et la page d'origine de chaque photo libre de droits.
 */
@Component({
  selector: 'app-mentions-legales',
  imports: [RouterLink],
  templateUrl: './mentions-legales.html',
  styleUrl: '../textes-legaux.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionsLegales {
  protected readonly credits = CREDITS_PHOTOS;
}
