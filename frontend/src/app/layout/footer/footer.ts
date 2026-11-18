import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Horaire } from '../../core/models/horaire';
import { HoraireService } from '../../core/services/horaire.service';

/**
 * Pied de page : présentation, horaires (lus depuis l'API) et liens légaux.
 */
@Component({
  selector: 'app-footer',
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  /**
   * Les horaires sous forme de signal :
   * - undefined : requête en cours
   * - null      : l'API n'a pas répondu (erreur)
   * - tableau   : les 7 jours
   */
  protected readonly horaires = toSignal<Horaire[] | null | undefined>(
    inject(HoraireService)
      .lister()
      .pipe(catchError(() => of(null))),
    { initialValue: undefined },
  );

  protected readonly annee = new Date().getFullYear();

  /** "09:00" + "19:00" -> "9h – 19h" (comme sur la maquette), ou "Fermé" */
  protected plage(horaire: Horaire): string {
    if (!horaire.heure_ouverture || !horaire.heure_fermeture) {
      return 'Fermé';
    }
    return `${this.heure(horaire.heure_ouverture)} – ${this.heure(horaire.heure_fermeture)}`;
  }

  private heure(valeur: string): string {
    const [heures, minutes] = valeur.split(':');
    // "09:30" -> "9h30", mais "09:00" -> "9h"
    return minutes === '00' ? `${Number(heures)}h` : `${Number(heures)}h${minutes}`;
  }
}
