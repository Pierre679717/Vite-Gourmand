import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { MenuEdition, OptionsMenu } from '../../../core/models/catalogue';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { EmployeNav } from '../employe-nav';
import {
  MENU_VIDE,
  ValeursMenu,
  auMoinsUn,
  basculer,
  entierEntre,
  grouperParCategorie,
  messageCatalogue,
  prixValide,
  texteEntre,
  valeursDepuisMenu,
  versDonneesMenu,
} from './catalogue-logique';

type EtatFormulaire =
  | { statut: 'chargement' }
  | { statut: 'pret'; options: OptionsMenu; menu: MenuEdition | null }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/**
 * Création (/espace-employe/menus/nouveau) et modification
 * (/espace-employe/menus/:id) d'un menu, avec le choix de ses plats.
 * Mêmes limites que le serveur (catalogue-logique.ts), qui revalide tout.
 */
@Component({
  selector: 'app-menu-formulaire',
  imports: [ReactiveFormsModule, RouterLink, PageIntrouvable, EmployeNav],
  templateUrl: './menu-formulaire.html',
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './catalogue.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuFormulaire {
  /** :id de l'URL ; absent sur /menus/nouveau */
  readonly id = input<string>();

  private readonly catalogue = inject(CatalogueService);
  private readonly router = inject(Router);
  private readonly titre = inject(Title);
  private readonly injector = inject(Injector);

  protected readonly message = messageCatalogue;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    titre: ['', texteEntre(3, 100)],
    description: ['', texteEntre(10, 2000)],
    conditions: ['', texteEntre(10, 2000)],
    theme_id: [null as number | null, entierEntre(1, 2147483647)],
    regime_id: [null as number | null, entierEntre(1, 2147483647)],
    nombre_personne_min: [null as number | null, entierEntre(1, 500)],
    delai_minimum_jours: [null as number | null, entierEntre(0, 365)],
    prix_par_personne: [null as number | string | null, prixValide],
    quantite_restante: [null as number | null, entierEntre(0, 10000)],
    plats: [[] as number[], auMoinsUn],
  });

  protected readonly etat = toSignal(
    toObservable(this.id).pipe(
      switchMap((id): Observable<EtatFormulaire> => {
        if (id !== undefined && !/^[1-9]\d{0,9}$/.test(id)) {
          return of<EtatFormulaire>({ statut: 'introuvable' });
        }
        return forkJoin({
          options: this.catalogue.optionsMenu(),
          menu: id === undefined ? of(null) : this.catalogue.menu(Number(id)),
        }).pipe(
          map(({ options, menu }): EtatFormulaire => {
            this.formulaire.reset(menu ? valeursDepuisMenu(menu) : MENU_VIDE);
            return { statut: 'pret', options, menu };
          }),
          catchError((e: { status?: number }) =>
            of<EtatFormulaire>(
              e?.status === 404
                ? { statut: 'introuvable' }
                : { statut: 'erreur', message: messageErreur(e) },
            ),
          ),
          startWith<EtatFormulaire>({ statut: 'chargement' }),
        );
      }),
    ),
    { initialValue: { statut: 'chargement' } as EtatFormulaire },
  );

  protected readonly creation = computed(() => this.id() === undefined);

  /** Plats proposés, rangés entrée → plat → dessert */
  protected readonly groupes = computed(() => {
    const e = this.etat();
    return e.statut === 'pret' ? grouperParCategorie(e.options.plats) : [];
  });

  /** Plats cochés (suit le formulaire) */
  protected readonly platsChoisis = toSignal(
    this.formulaire.controls.plats.valueChanges.pipe(
      startWith(this.formulaire.controls.plats.value),
    ),
    { initialValue: [] as number[] },
  );

  protected basculerPlat(id: number): void {
    const champ = this.formulaire.controls.plats;
    champ.setValue(basculer(champ.value, id));
    champ.markAsTouched();
  }

  /** Message d'erreur d'un champ, seulement après que l'employé l'a quitté (ou à l'envoi) */
  protected erreur(champ: keyof ValeursMenu): string | null {
    const controle = this.formulaire.controls[champ];
    return controle.touched ? messageCatalogue(controle.errors) : null;
  }

  // ---- Envoi -------------------------------------------------------------
  protected readonly envoi = signal(false);
  protected readonly erreursServeur = signal<string[]>([]);

  protected enregistrer(): void {
    if (this.envoi()) return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      afterNextRender(
        () =>
          document
            .querySelector<HTMLElement>('.formulaire-catalogue [aria-invalid="true"]')
            ?.focus(),
        { injector: this.injector },
      );
      return;
    }
    const donnees = versDonneesMenu(this.formulaire.getRawValue());
    const id = this.id();
    this.envoi.set(true);
    this.erreursServeur.set([]);
    const requete =
      id === undefined
        ? this.catalogue.creerMenu(donnees)
        : this.catalogue.modifierMenu(Number(id), donnees);
    requete.subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.router.navigate(['/espace-employe/menus'], { state: { message: r.message } });
      },
      error: (e) => {
        this.envoi.set(false);
        this.erreursServeur.set(messagesErreur(e));
        afterNextRender(() => document.getElementById('erreurs-serveur')?.focus(), {
          injector: this.injector,
        });
      },
    });
  }

  constructor() {
    effect(() => {
      const e = this.etat();
      if (e.statut === 'pret') {
        this.titre.setTitle(
          `${e.menu ? `Modifier « ${e.menu.titre} »` : 'Nouveau menu'} — Espace employé — Vite & Gourmand`,
        );
      }
    });
  }
}
