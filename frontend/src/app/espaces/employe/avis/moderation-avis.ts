import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur } from '../../../core/http/message-erreur';
import { AvisModeration, DecisionAvis } from '../../../core/models/employe';
import { EmployeService } from '../../../core/services/employe.service';
import {
  LIBELLES_NOTE,
  NOTES,
  dateHeureFr,
  dateHeureIso,
} from '../../utilisateur/mes-commandes/suivi-commande';
import { EmployeNav } from '../employe-nav';
import {
  FILTRES_AVIS,
  FiltreAvis,
  LIBELLES_AVIS,
  classeBadgeAvis,
  statutAvisDepuisFiltre,
  texteAucunAvis,
} from '../gestion-employe';

type EtatAvis =
  | { statut: 'chargement' }
  | { statut: 'succes'; avis: AvisModeration[] }
  | { statut: 'erreur'; message: string };

/**
 * Modération des avis : /espace-employe/avis
 * Exigence du sujet : « L'employé peut valider les avis reçus par les
 * utilisateurs afin qu'ils soient visibles sur la page d'accueil. Il peut
 * également en refuser. »
 * Par défaut, la page montre les avis « à modérer ». Une décision peut être
 * changée ensuite (filtre « Publiés » ou « Refusés ») : rien n'est supprimé.
 */
@Component({
  selector: 'app-moderation-avis',
  imports: [ReactiveFormsModule, RouterLink, EmployeNav],
  templateUrl: './moderation-avis.html',
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './moderation-avis.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationAvis {
  private readonly employe = inject(EmployeService);
  private readonly injector = inject(Injector);

  protected readonly filtres = FILTRES_AVIS;
  protected readonly notes = NOTES;
  protected readonly libellesNote = LIBELLES_NOTE;
  protected readonly libellesAvis = LIBELLES_AVIS;
  protected readonly classeBadgeAvis = classeBadgeAvis;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dateHeureIso = dateHeureIso;
  protected readonly texteAucunAvis = texteAucunAvis;

  /** Pastilles radio : les flèches du clavier changent de filtre */
  protected readonly filtre = new FormControl<FiltreAvis>('en_attente', { nonNullable: true });
  protected readonly filtreActuel = toSignal(this.filtre.valueChanges, {
    initialValue: this.filtre.value,
  });

  /** Incrémenté après une décision ou par « Réessayer » : relit la liste */
  private readonly version = signal(0);

  protected readonly etat = toSignal(
    combineLatest([
      this.filtre.valueChanges.pipe(startWith(this.filtre.value)),
      toObservable(this.version),
    ]).pipe(
      switchMap(([filtre]): Observable<EtatAvis> =>
        this.employe.listerAvis(statutAvisDepuisFiltre(filtre)).pipe(
          map((avis): EtatAvis => ({ statut: 'succes', avis })),
          catchError((erreur) =>
            of<EtatAvis>({ statut: 'erreur', message: messageErreur(erreur) }),
          ),
          startWith<EtatAvis>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatAvis },
  );

  // ---- Décision ----------------------------------------------------------
  /** Avis en cours d'enregistrement (boutons désactivés) */
  protected readonly enCours = signal<number | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly erreur = signal<string | null>(null);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  protected decider(avis: AvisModeration, decision: DecisionAvis): void {
    if (this.enCours() !== null) return;
    this.enCours.set(avis.avis_id);
    this.message.set(null);
    this.erreur.set(null);

    this.employe.modererAvis(avis.avis_id, decision).subscribe({
      next: (reponse) =>
        this.terminer(`${reponse.message} (${avis.prenom}, ${avis.numero_commande})`, null),
      error: (erreur) => this.terminer(null, messageErreur(erreur)),
    });
  }

  /**
   * Après une décision, l'avis peut quitter la liste (filtre « À modérer ») :
   * le focus va sur le message, sinon il serait perdu avec le bouton disparu.
   */
  private terminer(message: string | null, erreur: string | null): void {
    this.enCours.set(null);
    this.message.set(message);
    this.erreur.set(erreur);
    this.version.update((n) => n + 1);
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }
}
