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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { Allergene, PlatEdition } from '../../../core/models/catalogue';
import { CategoriePlat } from '../../../core/models/menu';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { EmployeNav } from '../employe-nav';
import {
  CATEGORIES,
  LIBELLE_CATEGORIE_SINGULIER,
  PLAT_VIDE,
  basculer,
  messageCatalogue,
  texteEntre,
  valeursDepuisPlat,
  versDonneesPlat,
} from './catalogue-logique';

type EtatFormulaire =
  | { statut: 'chargement' }
  | { statut: 'pret'; allergenes: Allergene[]; plat: PlatEdition | null }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/**
 * Création (/espace-employe/plats/nouveau) et modification
 * (/espace-employe/plats/:id) d'un plat : nom, catégorie, allergènes.
 */
@Component({
  selector: 'app-plat-formulaire',
  imports: [ReactiveFormsModule, RouterLink, PageIntrouvable, EmployeNav],
  templateUrl: './plat-formulaire.html',
  styleUrls: ['../../utilisateur/mes-commandes/mes-commandes.scss', './catalogue.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatFormulaire {
  readonly id = input<string>();

  private readonly catalogue = inject(CatalogueService);
  private readonly router = inject(Router);
  private readonly titre = inject(Title);
  private readonly injector = inject(Injector);

  protected readonly categories = CATEGORIES;
  protected readonly libelles = LIBELLE_CATEGORIE_SINGULIER;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    titre: ['', texteEntre(3, 150)],
    categorie: ['' as CategoriePlat | '', Validators.required],
    allergenes: [[] as number[]],
  });

  protected readonly etat = toSignal(
    toObservable(this.id).pipe(
      switchMap((id): Observable<EtatFormulaire> => {
        if (id !== undefined && !/^[1-9]\d{0,9}$/.test(id)) {
          return of<EtatFormulaire>({ statut: 'introuvable' });
        }
        return forkJoin({
          allergenes: this.catalogue.listerAllergenes(),
          plat: id === undefined ? of(null) : this.catalogue.plat(Number(id)),
        }).pipe(
          map(({ allergenes, plat }): EtatFormulaire => {
            this.formulaire.reset(plat ? valeursDepuisPlat(plat) : PLAT_VIDE);
            return { statut: 'pret', allergenes, plat };
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

  protected readonly allergenesChoisis = toSignal(
    this.formulaire.controls.allergenes.valueChanges.pipe(
      startWith(this.formulaire.controls.allergenes.value),
    ),
    { initialValue: [] as number[] },
  );

  protected basculerAllergene(id: number): void {
    const champ = this.formulaire.controls.allergenes;
    champ.setValue(basculer(champ.value, id));
  }

  protected erreurTitre(): string | null {
    const c = this.formulaire.controls.titre;
    return c.touched ? messageCatalogue(c.errors) : null;
  }

  protected erreurCategorie(): string | null {
    const c = this.formulaire.controls.categorie;
    return c.touched && c.invalid ? 'Choisissez la catégorie du plat.' : null;
  }

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
    const donnees = versDonneesPlat(this.formulaire.getRawValue());
    const id = this.id();
    this.envoi.set(true);
    this.erreursServeur.set([]);
    const requete =
      id === undefined
        ? this.catalogue.creerPlat(donnees)
        : this.catalogue.modifierPlat(Number(id), donnees);
    requete.subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.router.navigate(['/espace-employe/plats'], { state: { message: r.message } });
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
          `${e.plat ? `Modifier « ${e.plat.titre} »` : 'Nouveau plat'} — Espace employé — Vite & Gourmand`,
        );
      }
    });
  }
}
