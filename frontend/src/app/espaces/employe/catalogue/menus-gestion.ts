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
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur } from '../../../core/http/message-erreur';
import { MenuGestion } from '../../../core/models/catalogue';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { PrixPipe } from '../../../shared/prix.pipe';
import { EmployeNav } from '../employe-nav';
import { estSurLaCarte, peutSupprimerMenu, texteCommandes } from './catalogue-logique';

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'succes'; menus: MenuGestion[] }
  | { statut: 'erreur'; message: string };

/**
 * Menus du catalogue : /espace-employe/menus
 * Exigence du sujet : l'employé peut modifier / supprimer les menus.
 * - « Retirer de la carte » cache le menu du catalogue sans rien perdre ;
 * - « Supprimer » n'est proposé que pour un menu jamais commandé (la base
 *   garde les menus commandés pour l'historique des commandes) ;
 *   le serveur revérifie et répond 409 sinon.
 */
@Component({
  selector: 'app-menus-gestion',
  imports: [RouterLink, PrixPipe, EmployeNav],
  templateUrl: './menus-gestion.html',
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './catalogue.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenusGestion {
  private readonly catalogue = inject(CatalogueService);
  private readonly injector = inject(Injector);

  protected readonly estSurLaCarte = estSurLaCarte;
  protected readonly peutSupprimer = peutSupprimerMenu;
  protected readonly texteCommandes = texteCommandes;

  /** Message transmis par le formulaire après un enregistrement */
  protected readonly message = signal<string | null>(
    (inject(Router).currentNavigation()?.extras.state?.['message'] as string | undefined) ?? null,
  );
  protected readonly erreur = signal<string | null>(null);
  protected readonly enCours = signal<number | null>(null);
  /** Menu dont la suppression attend une confirmation */
  protected readonly aConfirmer = signal<number | null>(null);

  private readonly version = signal(0);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');
  private readonly titreConfirmation = viewChild<ElementRef<HTMLElement>>('titreConfirmation');

  protected readonly etat = toSignal(
    toObservable(this.version).pipe(
      switchMap((): Observable<EtatListe> =>
        this.catalogue.listerMenus().pipe(
          map((menus): EtatListe => ({ statut: 'succes', menus })),
          catchError((e) => of<EtatListe>({ statut: 'erreur', message: messageErreur(e) })),
        ),
      ),
      // Le squelette seulement au premier chargement : ensuite la liste reste affichée
      startWith<EtatListe>({ statut: 'chargement' }),
    ),
    { initialValue: { statut: 'chargement' } as EtatListe },
  );

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }

  /** Après une action : message, liste relue, focus sur le message */
  private terminer(message: string | null, erreur: string | null): void {
    this.enCours.set(null);
    this.aConfirmer.set(null);
    this.message.set(message);
    this.erreur.set(erreur);
    this.version.update((n) => n + 1);
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }

  protected changerCarte(menu: MenuGestion): void {
    if (this.enCours() !== null) return;
    this.enCours.set(menu.menu_id);
    this.catalogue.changerCarte(menu.menu_id, !estSurLaCarte(menu)).subscribe({
      next: (r) => this.terminer(`« ${menu.titre} » : ${r.message.toLowerCase()}`, null),
      error: (e) => this.terminer(null, messageErreur(e)),
    });
  }

  protected demanderSuppression(menu: MenuGestion): void {
    this.aConfirmer.set(menu.menu_id);
    afterNextRender(() => this.titreConfirmation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** « Annuler » ou Échap : le focus revient au bouton « Supprimer… » du menu */
  protected annulerSuppression(menu: MenuGestion): void {
    this.aConfirmer.set(null);
    afterNextRender(() => document.getElementById(`supprimer-menu-${menu.menu_id}`)?.focus(), {
      injector: this.injector,
    });
  }

  protected supprimer(menu: MenuGestion): void {
    if (this.enCours() !== null) return;
    this.enCours.set(menu.menu_id);
    this.catalogue.supprimerMenu(menu.menu_id).subscribe({
      next: (r) => this.terminer(r.message, null),
      // 409 : commandé entre-temps ; le message conseille de le retirer de la carte
      error: (e) => this.terminer(null, messageErreur(e)),
    });
  }
}
