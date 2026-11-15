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
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { StatutCommande } from '../../../core/models/commande';
import { CommandeEmployeDetaillee, ModeContact } from '../../../core/models/employe';
import { EmployeService } from '../../../core/services/employe.service';
import { FriseSuivi } from '../../../shared/frise-suivi/frise-suivi';
import { PrixPipe } from '../../../shared/prix.pipe';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { montantAvantReduction } from '../../utilisateur/commande/commande-logique';
import {
  LIBELLES_NOTE,
  LIBELLES_STATUT,
  NOTES,
  classeBadge,
  dateHeureFr,
  dateLongue,
  etapesFrise,
  heureFr,
  telephoneFr,
} from '../../utilisateur/mes-commandes/suivi-commande';
import {
  LIBELLES_AVIS,
  LIBELLES_MODE_CONTACT,
  MODES_CONTACT,
  MOTIF_MAX,
  classeBadgeAvis,
  effetAction,
  erreurMotif,
  etapesPossibles,
  libelleAction,
  messageSucces,
  peutAnnuler,
} from '../gestion-employe';
import { EmployeNav } from '../employe-nav';

type EtatDetail =
  | { statut: 'chargement' }
  | { statut: 'succes'; commande: CommandeEmployeDetaillee }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/** Motif validé avec les mêmes règles que le serveur (espaces ignorés) */
function motifValide(controle: AbstractControl): ValidationErrors | null {
  const message = erreurMotif(String(controle.value ?? ''));
  return message ? { motif: message } : null;
}

/**
 * Détail d'une commande pour l'employé : /espace-employe/commandes/:id
 * - frise du suivi (même composant que le client) ;
 * - un bouton par statut suivant possible, calculé par le serveur
 *   (statuts_suivants) : l'employé ne voit jamais un bouton interdit ;
 * - annulation seulement après avoir contacté le client : mode de contact
 *   (GSM ou e-mail) et motif obligatoires, puis confirmation.
 * Le serveur revérifie tout : si un collègue a changé le statut entre-temps,
 * il répond 409, le message s'affiche et la commande est relue.
 */
@Component({
  selector: 'app-detail-commande-employe',
  imports: [RouterLink, ReactiveFormsModule, PrixPipe, PageIntrouvable, FriseSuivi, EmployeNav],
  templateUrl: './detail-commande-employe.html',
  // Même mise en page que le détail côté client, plus le bloc des actions
  styleUrls: [
    '../../utilisateur/mes-commandes/commande-detail.scss',
    './detail-commande-employe.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailCommandeEmploye {
  /** :id de l'URL */
  readonly id = input.required<string>();

  private readonly employe = inject(EmployeService);
  private readonly titre = inject(Title);
  private readonly injector = inject(Injector);

  protected readonly libelles = LIBELLES_STATUT;
  protected readonly libellesNote = LIBELLES_NOTE;
  protected readonly libellesAvis = LIBELLES_AVIS;
  protected readonly libellesModeContact = LIBELLES_MODE_CONTACT;
  protected readonly modesContact = MODES_CONTACT;
  protected readonly notes = NOTES;
  protected readonly motifMax = MOTIF_MAX;
  protected readonly classeBadge = classeBadge;
  protected readonly classeBadgeAvis = classeBadgeAvis;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dateLongue = dateLongue;
  protected readonly heureFr = heureFr;
  protected readonly telephoneFr = telephoneFr;
  protected readonly libelleAction = libelleAction;
  protected readonly effetAction = effetAction;

  private derniere: CommandeEmployeDetaillee | null = null;

  /** Incrémenté après une action ou par « Réessayer » : relit la commande */
  private readonly version = signal(0);
  private readonly demande = computed(() => ({ id: this.id(), version: this.version() }));

  protected readonly etat = toSignal(
    toObservable(this.demande).pipe(
      switchMap(({ id }): Observable<EtatDetail> => {
        if (!/^[1-9]\d{0,9}$/.test(id)) {
          return of<EtatDetail>({ statut: 'introuvable' });
        }
        // Relecture après une action : on garde l'affichage pendant la requête
        const affichee = this.derniere?.commande_id === Number(id) ? this.derniere : null;
        return this.employe.detailCommande(Number(id)).pipe(
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

  /** Boutons « avancer » : seulement les statuts permis par le serveur */
  protected readonly etapes = computed(() =>
    etapesPossibles(this.commande()?.statuts_suivants ?? []),
  );
  protected readonly annulable = computed(() =>
    peutAnnuler(this.commande()?.statuts_suivants ?? []),
  );

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }

  protected montantAvantReduction(c: CommandeEmployeDetaillee): number {
    return montantAvantReduction(c.prix_par_personne, c.nombre_personne);
  }

  // ---- Messages après une action -------------------------------------
  protected readonly message = signal<string | null>(null);
  protected readonly erreurAction = signal<string | null>(null);
  protected readonly actionEnCours = signal<StatutCommande | null>(null);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  private apresAction(message: string | null, erreur: string | null): void {
    this.actionEnCours.set(null);
    this.message.set(message);
    this.erreurAction.set(erreur);
    this.version.update((n) => n + 1); // statut, frise et boutons à jour
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Fait avancer la commande d'une étape */
  protected avancer(c: CommandeEmployeDetaillee, statut: StatutCommande): void {
    if (this.actionEnCours() || statut === 'en_attente' || statut === 'annulee') return;
    this.actionEnCours.set(statut);
    this.message.set(null);
    this.erreurAction.set(null);

    this.employe.changerStatut(c.commande_id, { statut }).subscribe({
      next: () => {
        this.apresAction(messageSucces(c.numero_commande, statut), null);
      },
      // 409 : un collègue a pu changer le statut entre-temps ; la commande est relue
      error: (erreur) => this.apresAction(null, messageErreur(erreur)),
    });
  }

  // ---- Annulation -------------------------------------------------------
  protected readonly annulationOuverte = signal(false);
  protected readonly erreursAnnulation = signal<string[]>([]);

  protected readonly formAnnulation = new FormGroup({
    modeContact: new FormControl<ModeContact | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    motif: new FormControl('', { nonNullable: true, validators: [motifValide] }),
  });

  protected readonly longueurMotif = toSignal(
    this.formAnnulation.controls.motif.valueChanges.pipe(map((texte) => texte.length)),
    { initialValue: 0 },
  );

  private readonly titreAnnulation = viewChild<ElementRef<HTMLElement>>('titreAnnulation');
  private readonly boutonAnnuler = viewChild<ElementRef<HTMLButtonElement>>('boutonAnnuler');

  protected ouvrirAnnulation(): void {
    this.formAnnulation.reset();
    this.erreursAnnulation.set([]);
    this.annulationOuverte.set(true);
    afterNextRender(() => this.titreAnnulation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** « Revenir » ou Échap : on referme et le focus revient au bouton */
  protected fermerAnnulation(): void {
    this.annulationOuverte.set(false);
    afterNextRender(() => this.boutonAnnuler()?.nativeElement.focus(), { injector: this.injector });
  }

  protected erreurModeContact(): string | null {
    const champ = this.formAnnulation.controls.modeContact;
    return champ.touched && champ.invalid ? 'Indiquez comment vous avez contacté le client.' : null;
  }

  protected erreurMotifChamp(): string | null {
    const champ = this.formAnnulation.controls.motif;
    return champ.touched && champ.errors ? (champ.errors['motif'] as string) : null;
  }

  protected confirmerAnnulation(c: CommandeEmployeDetaillee): void {
    if (this.actionEnCours()) return;
    if (this.formAnnulation.invalid) {
      this.formAnnulation.markAllAsTouched();
      afterNextRender(
        () =>
          document
            .querySelector<HTMLElement>(
              '.annulation input[aria-invalid="true"], .annulation textarea[aria-invalid="true"]',
            )
            ?.focus(),
        { injector: this.injector },
      );
      return;
    }
    const { modeContact, motif } = this.formAnnulation.getRawValue();
    this.actionEnCours.set('annulee');
    this.erreursAnnulation.set([]);

    this.employe
      .changerStatut(c.commande_id, {
        statut: 'annulee',
        mode_contact: modeContact as ModeContact,
        motif: motif.trim(),
      })
      .subscribe({
        next: () => {
          this.annulationOuverte.set(false);
          this.apresAction(messageSucces(c.numero_commande, 'annulee'), null);
        },
        error: (erreur: { status?: number }) => {
          this.actionEnCours.set(null);
          if (erreur?.status === 409) {
            // Statut changé entre-temps : on referme et on relit la commande
            this.annulationOuverte.set(false);
            this.apresAction(null, messageErreur(erreur));
          } else {
            this.erreursAnnulation.set(messagesErreur(erreur));
          }
        },
      });
  }

  constructor() {
    effect(() => {
      const c = this.commande();
      if (c) {
        this.titre.setTitle(`Commande ${c.numero_commande} — Espace employé — Vite & Gourmand`);
      } else if (this.etat().statut === 'introuvable') {
        this.titre.setTitle('Commande introuvable — Vite & Gourmand');
      }
    });
  }
}
