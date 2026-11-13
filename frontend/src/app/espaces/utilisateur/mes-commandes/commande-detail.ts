import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { AvisCommande, CommandeDetaillee } from '../../../core/models/commande';
import { AvisService } from '../../../core/services/avis.service';
import { CommandeService } from '../../../core/services/commande.service';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { PrixPipe } from '../../../shared/prix.pipe';
import { montantAvantReduction } from '../commande/commande-logique';
import {
  COMMENTAIRE_MAX,
  LIBELLES_NOTE,
  LIBELLES_STATUT,
  LIBELLES_STATUT_AVIS,
  NOTES,
  classeBadge,
  dateHeureFr,
  dateHeureIso,
  dateLongue,
  erreurCommentaire,
  etapesFrise,
  heureFr,
  telephoneFr,
} from './suivi-commande';

type EtatDetail =
  | { statut: 'chargement' }
  | { statut: 'succes'; commande: CommandeDetaillee }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/** Le commentaire est validé avec les mêmes règles que le serveur (espaces ignorés) */
function commentaireValide(controle: AbstractControl): ValidationErrors | null {
  const message = erreurCommentaire(String(controle.value ?? ''));
  return message ? { commentaire: message } : null;
}

/**
 * Détail d'une commande : /espace-utilisateur/commandes/:id
 * - frise du suivi (chaque statut avec sa date et son heure) ;
 * - annulation avec confirmation, tant que la commande est « en attente » ;
 * - formulaire d'avis quand elle est « terminée ».
 * Les boutons dépendent des drapeaux du serveur (peut_modifier, peut_donner_avis),
 * qui revérifie de toute façon chaque action.
 */
@Component({
  selector: 'app-commande-detail',
  imports: [RouterLink, PrixPipe, PageIntrouvable, ReactiveFormsModule],
  templateUrl: './commande-detail.html',
  styleUrl: './commande-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandeDetail {
  /** :id de l'URL */
  readonly id = input.required<string>();

  private readonly commandes = inject(CommandeService);
  private readonly avisService = inject(AvisService);
  private readonly titre = inject(Title);
  private readonly injector = inject(Injector);

  protected readonly libelles = LIBELLES_STATUT;
  protected readonly libellesNote = LIBELLES_NOTE;
  protected readonly libellesStatutAvis = LIBELLES_STATUT_AVIS;
  protected readonly notes = NOTES;
  protected readonly commentaireMax = COMMENTAIRE_MAX;
  protected readonly classeBadge = classeBadge;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dateHeureIso = dateHeureIso;
  protected readonly dateLongue = dateLongue;
  protected readonly heureFr = heureFr;
  protected readonly telephoneFr = telephoneFr;

  /** Dernière commande reçue du serveur */
  private derniere: CommandeDetaillee | null = null;

  /** Incrémenté après une annulation ou par « Réessayer » : relit la commande */
  private readonly version = signal(0);
  private readonly demande = computed(() => ({ id: this.id(), version: this.version() }));

  protected readonly etat = toSignal(
    toObservable(this.demande).pipe(
      switchMap(({ id }): Observable<EtatDetail> => {
        // Un id qui n'est pas un entier ne peut pas exister : pas d'appel à l'API
        if (!/^[1-9]\d{0,9}$/.test(id)) {
          return of<EtatDetail>({ statut: 'introuvable' });
        }
        // Relecture de la même commande (après une annulation) : on garde l'affichage
        // pendant la requête, au lieu de repasser par le squelette de chargement
        const affichee = this.derniere?.commande_id === Number(id) ? this.derniere : null;
        return this.commandes.detail(Number(id)).pipe(
          map((commande): EtatDetail => {
            this.derniere = commande;
            return { statut: 'succes', commande };
          }),
          catchError((erreur: { status?: number }) =>
            of<EtatDetail>(
              erreur?.status === 404
                ? { statut: 'introuvable' }
                : { statut: 'erreur', message: messageErreur(erreur) },
            ),
          ),
          startWith<EtatDetail>(
            affichee ? { statut: 'succes', commande: affichee } : { statut: 'chargement' },
          ),
        );
      }),
    ),
    { initialValue: { statut: 'chargement' } as EtatDetail },
  );

  protected readonly commande = computed(() => {
    const etat = this.etat();
    return etat.statut === 'succes' ? etat.commande : null;
  });

  protected readonly frise = computed(() => {
    const c = this.commande();
    return c ? etapesFrise(c.suivi, c.statut, c.pret_materiel) : [];
  });

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }

  protected montantAvantReduction(c: CommandeDetaillee): number {
    return montantAvantReduction(c.prix_par_personne, c.nombre_personne);
  }

  // ---- Annulation ------------------------------------------------------
  protected readonly confirmationOuverte = signal(false);
  protected readonly annulationEnCours = signal(false);
  protected readonly erreurAnnulation = signal<string | null>(null);
  protected readonly messageAnnulation = signal<string | null>(null);
  /**
   * Message transmis par le formulaire après une modification réussie
   * (state de la navigation, lu seulement à l'arrivée : pas de nouveau
   * message si l'on recharge la page).
   */
  protected readonly messageModification = signal<string | null>(
    (inject(Router).currentNavigation()?.extras.state?.['message'] as string | undefined) ?? null,
  );

  private readonly titreConfirmation = viewChild<ElementRef<HTMLElement>>('titreConfirmation');
  private readonly boutonAnnuler = viewChild<ElementRef<HTMLButtonElement>>('boutonAnnuler');
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  /** Ouvre la confirmation et y place le focus (clavier et lecteur d'écran) */
  protected demanderAnnulation(): void {
    this.erreurAnnulation.set(null);
    this.confirmationOuverte.set(true);
    afterNextRender(() => this.titreConfirmation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** « Non, garder ma commande » ou Échap : on referme et le focus revient au bouton */
  protected fermerConfirmation(): void {
    this.confirmationOuverte.set(false);
    afterNextRender(() => this.boutonAnnuler()?.nativeElement.focus(), { injector: this.injector });
  }

  protected confirmerAnnulation(c: CommandeDetaillee): void {
    if (this.annulationEnCours()) return;
    this.annulationEnCours.set(true);
    this.erreurAnnulation.set(null);

    this.commandes.annuler(c.commande_id).subscribe({
      next: (reponse) => {
        this.annulationEnCours.set(false);
        this.confirmationOuverte.set(false);
        this.messageAnnulation.set(reponse.message);
        this.version.update((n) => n + 1); // relit la commande : statut et frise à jour
        afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
      error: (erreur) => {
        this.annulationEnCours.set(false);
        this.erreurAnnulation.set(messageErreur(erreur));
      },
    });
  }

  // ---- Avis --------------------------------------------------------------
  protected readonly formAvis = new FormGroup({
    note: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(5)],
    }),
    commentaire: new FormControl('', { nonNullable: true, validators: [commentaireValide] }),
  });

  /** Note choisie, pour colorer les étoiles */
  protected readonly noteChoisie = toSignal(this.formAvis.controls.note.valueChanges, {
    initialValue: 0,
  });
  protected readonly longueurCommentaire = toSignal(
    this.formAvis.controls.commentaire.valueChanges.pipe(map((texte) => texte.length)),
    { initialValue: 0 },
  );

  protected readonly envoiAvis = signal(false);
  protected readonly erreursAvis = signal<string[]>([]);
  /** Avis tout juste envoyé : affiché sans relire la commande */
  protected readonly avisEnvoye = signal<AvisCommande | null>(null);

  protected readonly avis = computed(() => this.avisEnvoye() ?? this.commande()?.avis ?? null);

  protected erreurNote(): string | null {
    const note = this.formAvis.controls.note;
    return note.touched && note.invalid ? 'Choisissez une note de 1 à 5 étoiles.' : null;
  }

  protected erreurTexte(): string | null {
    const champ = this.formAvis.controls.commentaire;
    return champ.touched && champ.errors ? (champ.errors['commentaire'] as string) : null;
  }

  protected envoyerAvis(c: CommandeDetaillee): void {
    if (this.envoiAvis()) return;
    if (this.formAvis.invalid) {
      this.formAvis.markAllAsTouched();
      afterNextRender(
        () =>
          document
            .querySelector<HTMLElement>(
              '.avis-form input[aria-invalid="true"], .avis-form textarea[aria-invalid="true"]',
            )
            ?.focus(),
        { injector: this.injector },
      );
      return;
    }
    const { note, commentaire } = this.formAvis.getRawValue();
    this.envoiAvis.set(true);
    this.erreursAvis.set([]);

    this.avisService
      .creer({ commande_id: c.commande_id, note, commentaire: commentaire.trim() })
      .subscribe({
        next: (avis) => {
          this.envoiAvis.set(false);
          this.avisEnvoye.set(avis);
          afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), {
            injector: this.injector,
          });
        },
        error: (erreur) => {
          this.envoiAvis.set(false);
          this.erreursAvis.set(messagesErreur(erreur));
        },
      });
  }

  constructor() {
    // Titre de l'onglet : « Commande VG-2026-0014 — Vite & Gourmand »
    effect(() => {
      const c = this.commande();
      if (c) {
        this.titre.setTitle(`Commande ${c.numero_commande} — Vite & Gourmand`);
      } else if (this.etat().statut === 'introuvable') {
        this.titre.setTitle('Commande introuvable — Vite & Gourmand');
      }
    });
  }
}
