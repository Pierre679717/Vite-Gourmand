import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur } from '../../../core/http/message-erreur';
import { PlatGestion } from '../../../core/models/catalogue';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { EmployeNav } from '../employe-nav';
import { grouperParCategorie, peutSupprimerPlat, texteMenusDuPlat } from './catalogue-logique';

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'succes'; plats: PlatGestion[] }
  | { statut: 'erreur'; message: string };

/**
 * Plats et allergènes : /espace-employe/plats
 * Exigence du sujet : l'employé peut modifier / supprimer les plats.
 * Chaque plat affiche ses allergènes et les menus qui l'utilisent ;
 * « Supprimer » n'est proposé que pour un plat présent dans aucun menu
 * (le serveur revérifie et répond 409 en nommant les menus).
 */
@Component({
  selector: 'app-plats-gestion',
  imports: [RouterLink, EmployeNav],
  templateUrl: './plats-gestion.html',
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './catalogue.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatsGestion {
  private readonly catalogue = inject(CatalogueService);
  private readonly injector = inject(Injector);

  protected readonly peutSupprimer = peutSupprimerPlat;
  protected readonly texteMenus = texteMenusDuPlat;

  protected readonly message = signal<string | null>(
    (inject(Router).currentNavigation()?.extras.state?.['message'] as string | undefined) ?? null,
  );
  protected readonly erreur = signal<string | null>(null);
  protected readonly enCours = signal<number | null>(null);
  protected readonly aConfirmer = signal<number | null>(null);

  private readonly version = signal(0);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');
  private readonly titreConfirmation = viewChild<ElementRef<HTMLElement>>('titreConfirmation');

  protected readonly etat = toSignal(
    toObservable(this.version).pipe(
      switchMap((): Observable<EtatListe> =>
        this.catalogue.listerPlats().pipe(
          map((plats): EtatListe => ({ statut: 'succes', plats })),
          catchError((e) => of<EtatListe>({ statut: 'erreur', message: messageErreur(e) })),
        ),
      ),
      startWith<EtatListe>({ statut: 'chargement' }),
    ),
    { initialValue: { statut: 'chargement' } as EtatListe },
  );

  /** Entrées, plats, desserts : une section par catégorie */
  protected readonly groupes = computed(() => {
    const e = this.etat();
    return e.statut === 'succes' ? grouperParCategorie(e.plats) : [];
  });

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }

  private terminer(message: string | null, erreur: string | null): void {
    this.enCours.set(null);
    this.aConfirmer.set(null);
    this.message.set(message);
    this.erreur.set(erreur);
    this.version.update((n) => n + 1);
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }

  protected demanderSuppression(plat: PlatGestion): void {
    this.aConfirmer.set(plat.plat_id);
    afterNextRender(() => this.titreConfirmation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected annulerSuppression(plat: PlatGestion): void {
    this.aConfirmer.set(null);
    afterNextRender(() => document.getElementById(`supprimer-plat-${plat.plat_id}`)?.focus(), {
      injector: this.injector,
    });
  }

  protected supprimer(plat: PlatGestion): void {
    if (this.enCours() !== null) return;
    this.enCours.set(plat.plat_id);
    this.catalogue.supprimerPlat(plat.plat_id).subscribe({
      next: (r) => this.terminer(r.message, null),
      error: (e) => this.terminer(null, messageErreur(e)),
    });
  }
}
