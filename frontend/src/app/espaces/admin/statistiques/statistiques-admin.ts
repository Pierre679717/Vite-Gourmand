import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { messageErreur } from '../../../core/http/message-erreur';
import { FiltresStats, Statistiques } from '../../../core/models/admin';
import { AdminService } from '../../../core/services/admin.service';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { PrixPipe } from '../../../shared/prix.pipe';
import { EmployeNav } from '../../employe/employe-nav';
import {
  FILTRES_STATS_VIDES,
  filtresStatsDepuisUrl,
  partDuTotal,
  periodeValide,
  texteFiltres,
  versFiltresStats,
  versParametresUrlStats,
} from '../admin-logique';
import { GraphiqueCommandes } from './graphique-commandes';

type EtatStats =
  | { statut: 'chargement' }
  | { statut: 'succes'; stats: Statistiques; filtres: FiltresStats }
  | { statut: 'erreur'; message: string };

/**
 * Statistiques : /espace-admin/statistiques?menu_id=&debut=&fin=
 * Exigences du sujet :
 * - nombre de commandes par menu, comparées dans un graphique ;
 * - chiffre d'affaires par menu, filtrable par menu et sur une durée ;
 * - données lues dans une base NON relationnelle (MongoDB, côté serveur).
 *
 * Les filtres vivent dans l'URL : « Retour », F5 et un lien partagé
 * redonnent la même vue. Le graphique a son équivalent accessible :
 * le tableau, qui contient les mêmes chiffres.
 */
@Component({
  selector: 'app-statistiques-admin',
  imports: [ReactiveFormsModule, EmployeNav, GraphiqueCommandes, PrixPipe],
  templateUrl: './statistiques-admin.html',
  styleUrls: [
    '../../utilisateur/mes-commandes/mes-commandes.scss',
    '../../employe/catalogue/catalogue.scss',
    './statistiques-admin.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatistiquesAdmin {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly partDuTotal = partDuTotal;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    { ...FILTRES_STATS_VIDES },
    { validators: periodeValide },
  );

  /** Tous les menus (même retirés de la carte) pour la liste déroulante */
  protected readonly menus = toSignal(
    inject(CatalogueService)
      .listerMenus()
      .pipe(
        map((menus) => menus.map((m) => ({ id: m.menu_id, titre: m.titre }))),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );

  /** Incrémenté par « Réessayer » : relance la même requête */
  private readonly version = signal(0);

  /** URL → formulaire → requête : relu à chaque changement des paramètres */
  protected readonly etat = toSignal(
    combineLatest([this.route.queryParamMap, toObservable(this.version)]).pipe(
      map(([p]) =>
        filtresStatsDepuisUrl({
          menu_id: p.get('menu_id'),
          debut: p.get('debut'),
          fin: p.get('fin'),
        }),
      ),
      tap((valeurs) => this.formulaire.reset(valeurs)),
      map(versFiltresStats),
      switchMap((filtres): Observable<EtatStats> =>
        this.admin.statistiques(filtres).pipe(
          map((stats): EtatStats => ({ statut: 'succes', stats, filtres })),
          catchError((e) => of<EtatStats>({ statut: 'erreur', message: messageErreur(e) })),
          startWith<EtatStats>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatStats },
  );

  /** « Menu de Noël, du 01/10/2026 au 31/10/2026. » */
  protected readonly resume = computed(() => {
    const e = this.etat();
    if (e.statut !== 'succes') return '';
    const titre = this.menus().find((m) => m.id === e.filtres.menu_id)?.titre ?? null;
    return texteFiltres(e.filtres, titre);
  });

  protected erreurPeriode(): string | null {
    return this.formulaire.hasError('periodeInversee')
      ? 'La date de début doit précéder la date de fin.'
      : null;
  }

  /** « Afficher » : les filtres passent dans l'URL, qui relance la requête */
  protected appliquer(): void {
    if (this.formulaire.invalid) {
      document.getElementById('debut')?.focus();
      return;
    }
    const filtres = versFiltresStats(this.formulaire.getRawValue());
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: versParametresUrlStats(filtres),
    });
  }

  protected reinitialiser(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }
}
