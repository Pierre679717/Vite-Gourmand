import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PrixPipe } from '../../shared/prix.pipe';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { messageErreur } from '../../core/http/message-erreur';
import { MenuDetail as DetailDuMenu } from '../../core/models/menu';
import { MenuService } from '../../core/services/menu.service';
import { PageIntrouvable } from '../page-introuvable/page-introuvable';
import {
  CONDITION_MATERIEL,
  PERSONNES_EN_PLUS,
  decouperConditions,
  estimerPrix,
  platsParCategorie,
} from './detail-menu';

type EtatDetail =
  | { statut: 'chargement' }
  | { statut: 'succes'; detail: DetailDuMenu }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/** Plafond du compteur de convives (au-delà, on passe par le formulaire de contact) */
const CONVIVES_MAX = 500;

/**
 * Page détail d'un menu : /menus/:id (maquette « Détail d'un menu »).
 * L'identifiant arrive directement en input grâce à withComponentInputBinding()
 * (voir app.config.ts).
 */
@Component({
  selector: 'app-menu-detail',
  imports: [RouterLink, PrixPipe, PageIntrouvable],
  templateUrl: './menu-detail.html',
  styleUrl: './menu-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuDetail {
  /** Le :id de l'URL */
  readonly id = input.required<string>();

  private readonly menuService = inject(MenuService);
  private readonly auth = inject(AuthService);
  private readonly titre = inject(Title);

  protected readonly conditionMateriel = CONDITION_MATERIEL;
  protected readonly personnesEnPlus = PERSONNES_EN_PLUS;

  /** Chargement du menu à chaque changement d'identifiant (switchMap annule l'ancien) */
  protected readonly etat = toSignal(
    toObservable(this.id).pipe(
      switchMap((id): Observable<EtatDetail> =>
        this.menuService.detail(id).pipe(
          map((detail): EtatDetail => ({ statut: 'succes', detail })),
          catchError((erreur: { status?: number }) =>
            of<EtatDetail>(
              erreur?.status === 404
                ? { statut: 'introuvable' }
                : { statut: 'erreur', message: messageErreur(erreur) },
            ),
          ),
          startWith<EtatDetail>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatDetail },
  );

  /** Le détail chargé, ou null */
  protected readonly detail = computed(() => {
    const etat = this.etat();
    return etat.statut === 'succes' ? etat.detail : null;
  });

  // ---- Galerie ----
  /** Image affichée en grand : revient à la première quand on change de menu */
  protected readonly imageActive = linkedSignal(() => {
    this.detail();
    return 0;
  });
  protected readonly image = computed(() => this.detail()?.images[this.imageActive()] ?? null);

  // ---- Contenu ----
  protected readonly groupes = computed(() => platsParCategorie(this.detail()?.plats ?? []));
  protected readonly conditions = computed(() =>
    decouperConditions(this.detail()?.menu.conditions),
  );

  // ---- Estimation du prix ----
  /** Convives : commence au minimum du menu, et y revient si on change de menu */
  protected readonly convives = linkedSignal(() => this.detail()?.menu.nombre_personne_min ?? 1);
  protected readonly estimation = computed(() => {
    const menu = this.detail()?.menu;
    return menu
      ? estimerPrix(menu.prix_par_personne, menu.nombre_personne_min, this.convives())
      : null;
  });

  // ---- Commande ----
  protected readonly role = computed(() => this.auth.utilisateur()?.role ?? null);
  protected readonly epuise = computed(() => (this.detail()?.menu.quantite_restante ?? 0) <= 0);
  /** Les employés et administrateurs ne passent pas de commande pour eux-mêmes */
  protected readonly commandeReservee = computed(() => {
    const role = this.role();
    return role !== null && role !== 'utilisateur';
  });

  constructor() {
    // Titre de l'onglet : « Menu Gastronomique — Vite & Gourmand »
    effect(() => {
      const etat = this.etat();
      if (etat.statut === 'succes') {
        this.titre.setTitle(`${etat.detail.menu.titre} — Vite & Gourmand`);
      } else if (etat.statut === 'introuvable') {
        this.titre.setTitle('Menu introuvable — Vite & Gourmand');
      }
    });
  }

  protected retirerConvive(): void {
    const minimum = this.detail()?.menu.nombre_personne_min ?? 1;
    this.convives.update((n) => Math.max(minimum, n - 1));
  }

  protected ajouterConvive(): void {
    this.convives.update((n) => Math.min(CONVIVES_MAX, n + 1));
  }

  protected afficherImage(index: number): void {
    this.imageActive.set(index);
  }
}
