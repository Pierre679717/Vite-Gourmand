import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { messageErreur } from '../../../core/http/message-erreur';
import { CommandeEmploye, FiltresCommandes } from '../../../core/models/employe';
import { EmployeService } from '../../../core/services/employe.service';
import { PrixPipe } from '../../../shared/prix.pipe';
import {
  LIBELLES_STATUT,
  classeBadge,
  dateLongue,
  heureFr,
} from '../../utilisateur/mes-commandes/suivi-commande';
import { EmployeNav } from '../employe-nav';
import {
  FILTRES_VIDES,
  STATUTS_FILTRE,
  filtresDepuisUrl,
  memesFiltres,
  texteResultats,
  versFiltres,
  versParametresUrl,
} from '../gestion-employe';

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'succes'; commandes: CommandeEmploye[]; filtree: boolean; actualisation: boolean }
  | { statut: 'erreur'; message: string };

/**
 * Commandes de tous les clients : /espace-employe/commandes
 * Exigence du sujet : « un filtre sur les commandes […] afin de vite retrouver
 * les commandes à effectuer (par statut) ou d'un client en particulier ».
 *
 * Formulaire réactif → attente de 300 ms sans frappe (debounceTime)
 * → filtres de l'API, requête seulement s'ils ont changé (distinctUntilChanged)
 * → filtres recopiés dans l'URL (le bouton « Retour » retrouve la liste filtrée)
 * → GET /api/employe/commandes (switchMap annule la requête précédente).
 */
@Component({
  selector: 'app-commandes-employe',
  imports: [ReactiveFormsModule, RouterLink, PrixPipe, EmployeNav],
  templateUrl: './commandes-employe.html',
  // Mise en page commune avec « Mes commandes » (en-tête, cartes, squelettes)
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './commandes-employe.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandesEmploye {
  private readonly employe = inject(EmployeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly statuts = STATUTS_FILTRE;
  protected readonly libelles = LIBELLES_STATUT;
  protected readonly classeBadge = classeBadge;
  protected readonly dateLongue = dateLongue;
  protected readonly heureFr = heureFr;
  protected readonly texteResultats = texteResultats;

  // Valeurs de départ lues dans l'URL (?statut=…&client=…)
  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    filtresDepuisUrl({
      statut: this.route.snapshot.queryParamMap.get('statut'),
      client: this.route.snapshot.queryParamMap.get('client'),
    }),
  );

  /** Incrémenté par « Réessayer » : relance la requête avec les mêmes filtres */
  private readonly essai = signal(0);
  /** Dernière liste reçue : gardée à l'écran pendant qu'une nouvelle recherche se charge */
  private derniere: CommandeEmploye[] | null = null;

  private readonly filtres$: Observable<FiltresCommandes> = this.formulaire.valueChanges.pipe(
    debounceTime(300),
    map(() => versFiltres(this.formulaire.getRawValue())),
    startWith(versFiltres(this.formulaire.getRawValue())),
    distinctUntilChanged(memesFiltres),
    tap((filtres) =>
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: versParametresUrl(filtres),
        replaceUrl: true, // pas une entrée d'historique par lettre tapée
      }),
    ),
  );

  protected readonly etat = toSignal(
    combineLatest([this.filtres$, toObservable(this.essai)]).pipe(
      switchMap(([filtres]): Observable<EtatListe> => {
        const filtree = Boolean(filtres.statut || filtres.client);
        const precedente = this.derniere;
        return this.employe.listerCommandes(filtres).pipe(
          map((commandes): EtatListe => {
            this.derniere = commandes;
            return { statut: 'succes', commandes, filtree, actualisation: false };
          }),
          catchError((erreur) =>
            of<EtatListe>({ statut: 'erreur', message: messageErreur(erreur) }),
          ),
          startWith<EtatListe>(
            precedente
              ? { statut: 'succes', commandes: precedente, filtree, actualisation: true }
              : { statut: 'chargement' },
          ),
        );
      }),
    ),
    { initialValue: { statut: 'chargement' } as EtatListe },
  );

  /** Vrai si un filtre est rempli : affiche « Effacer les filtres » */
  protected readonly filtresActifs = toSignal(
    this.formulaire.valueChanges.pipe(
      startWith(this.formulaire.getRawValue()),
      map(() => Object.keys(versFiltres(this.formulaire.getRawValue())).length > 0),
    ),
    { initialValue: false },
  );

  protected effacerFiltres(): void {
    this.formulaire.setValue(FILTRES_VIDES);
  }

  protected reessayer(): void {
    this.essai.update((n) => n + 1);
  }
}
