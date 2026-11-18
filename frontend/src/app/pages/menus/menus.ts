import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  scan,
  startWith,
  switchMap,
} from 'rxjs';
import { messageErreur } from '../../core/http/message-erreur';
import { OptionFiltre } from '../../core/models/menu';
import { MenuService } from '../../core/services/menu.service';
import { MenuCard } from '../../shared/menu-card/menu-card';
import {
  ETAT_INITIAL,
  EvenementListe,
  FORMULAIRE_VIDE,
  ResultatFiltres,
  bornesCurseur,
  construireFiltres,
  etatSuivant,
  memesFiltres,
} from './filtres-menus';

/**
 * Page « Nos menus » : colonne de filtres + liste des menus (maquette Menus).
 *
 * Fonctionnement (sans rechargement de la page) :
 *   saisie dans le formulaire
 *   → attente de 300 ms sans frappe (debounceTime)
 *   → filtres de l'API (construireFiltres), requête seulement s'ils ont changé
 *   → GET /api/menus?... (switchMap annule la requête précédente si elle n'est pas finie)
 *   → état de la liste (scan + etatSuivant), exposé au template sous forme de signal.
 */
@Component({
  selector: 'app-menus',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, MenuCard],
  templateUrl: './menus.html',
  styleUrl: './menus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menus {
  private readonly menuService = inject(MenuService);

  // nonNullable : « Réinitialiser » remet les valeurs de départ, jamais null partout
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    prixMax: [FORMULAIRE_VIDE.prixMax],
    fourchetteMin: [FORMULAIRE_VIDE.fourchetteMin, [Validators.min(1)]],
    fourchetteMax: [FORMULAIRE_VIDE.fourchetteMax, [Validators.min(1)]],
    theme: [FORMULAIRE_VIDE.theme],
    regime: [FORMULAIRE_VIDE.regime],
    personnes: [
      FORMULAIRE_VIDE.personnes,
      [Validators.min(1), Validators.max(1000), Validators.pattern(/^\d+$/)],
    ],
  });

  /**
   * Thèmes, régimes et bornes de prix :
   * undefined = en cours, null = indisponibles (seule la pastille « Tous » reste).
   */
  protected readonly options = toSignal(
    this.menuService.optionsFiltres().pipe(catchError(() => of(null))),
    { initialValue: undefined },
  );

  /** Thèmes et régimes dans l'ordre de la base (celui des maquettes : Noël, Pâques...) */
  protected readonly themes = computed(() => parId(this.options()?.themes));
  protected readonly regimes = computed(() => parId(this.options()?.regimes));

  /** Bornes du curseur « Prix maximum » (200 € → 850 € avec les données de test) */
  protected readonly curseur = computed(() =>
    bornesCurseur(this.options()?.prix_min, this.options()?.prix_max),
  );

  /** Panneau des filtres sur mobile (toujours visible sur ordinateur) */
  protected readonly filtresOuverts = signal(true);

  /** Bouton « Réessayer » après une erreur */
  private readonly relance = new Subject<void>();

  /** Signal de la valeur du formulaire (pour l'affichage « Jusqu'à 700 € ») */
  protected readonly valeur = toSignal(this.formulaire.valueChanges, {
    initialValue: this.formulaire.getRawValue(),
  });

  /** Filtres courants, émis seulement quand ils changent vraiment */
  private readonly filtres$: Observable<ResultatFiltres> = this.formulaire.valueChanges.pipe(
    debounceTime(300),
    startWith(null), // premier chargement : tous les menus, tout de suite
    map(() => construireFiltres(this.formulaire.getRawValue(), this.curseur()?.max)),
    distinctUntilChanged(memesFiltres),
  );

  /** État de la liste : chargement, menus, erreur, filtres incohérents */
  protected readonly etat = toSignal(
    combineLatest([this.filtres$, this.relance.pipe(startWith(undefined))]).pipe(
      switchMap(([{ filtres, incoherent }]): Observable<EvenementListe> => {
        if (incoherent) {
          return of({ type: 'incoherent' });
        }
        return this.menuService.lister(filtres).pipe(
          map((menus): EvenementListe => ({ type: 'succes', menus })),
          catchError((erreur: unknown) =>
            of<EvenementListe>({ type: 'erreur', message: messageErreur(erreur) }),
          ),
          startWith<EvenementListe>({ type: 'chargement' }),
        );
      }),
      scan(etatSuivant, ETAT_INITIAL),
    ),
    { initialValue: ETAT_INITIAL },
  );

  /** « 8 menus correspondent » : annoncé aux lecteurs d'écran à chaque mise à jour */
  protected readonly resume = computed(() => {
    const { chargement, menus } = this.etat();
    if (chargement) {
      return 'Recherche des menus…';
    }
    if (!menus) {
      return '';
    }
    if (menus.length === 0) {
      return 'Aucun menu ne correspond';
    }
    return menus.length === 1 ? '1 menu correspond' : `${menus.length} menus correspondent`;
  });

  /** Nombre affiché sur le bouton « Voir 8 menus » (mobile) */
  protected readonly nombreMenus = computed(() => this.etat().menus?.length ?? 0);

  constructor() {
    // Quand les bornes arrivent, le curseur se place au maximum (= « pas de limite »)
    effect(() => {
      const bornes = this.curseur();
      if (bornes && this.formulaire.controls.prixMax.value === null) {
        this.formulaire.controls.prixMax.setValue(bornes.max);
      }
    });
  }

  protected reinitialiser(): void {
    this.formulaire.reset({ ...FORMULAIRE_VIDE, prixMax: this.curseur()?.max ?? null });
  }

  protected reessayer(): void {
    this.relance.next();
  }

  protected basculerFiltres(): void {
    this.filtresOuverts.update((ouverts) => !ouverts);
  }

  /** Mobile : « Voir 8 menus » referme le panneau et descend jusqu'aux résultats */
  protected voirResultats(): void {
    this.filtresOuverts.set(false);
    document.getElementById('resultats')?.focus();
  }
}

/** Copie triée par identifiant (sans modifier le tableau d'origine) */
function parId(options: OptionFiltre[] | undefined): OptionFiltre[] {
  return [...(options ?? [])].sort((a, b) => a.id - b.id);
}
