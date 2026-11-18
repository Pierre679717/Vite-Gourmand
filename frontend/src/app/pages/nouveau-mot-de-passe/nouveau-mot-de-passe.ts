import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { messagesErreur } from '../../core/http/message-erreur';
import { MotDePasseService } from '../../core/services/mot-de-passe.service';
import {
  CRITERES_MOT_DE_PASSE,
  LONGUEUR_MAX_MOT_DE_PASSE,
  champsIdentiques,
  motDePasseFort,
} from '../../core/validators/mot-de-passe.validators';
import {
  LienRefuse,
  jetonBienForme,
  lienMalForme,
  lienRefuseDepuisErreur,
} from './nouveau-mot-de-passe-logique';

type Etat =
  | { statut: 'verification' }
  | { statut: 'formulaire' }
  | { statut: 'envoi' }
  | { statut: 'refuse'; refus: LienRefuse };

/**
 * Nouveau mot de passe : page ouverte depuis le lien reçu par e-mail
 * (/nouveau-mot-de-passe?token=...).
 * 1. Le lien est vérifié dès l'ouverture : s'il a expiré ou déjà servi,
 *    la personne le sait tout de suite, sans avoir rien saisi.
 * 2. Le mot de passe suit les mêmes règles qu'à l'inscription, avec les
 *    critères cochés à chaque frappe, et une confirmation.
 * 3. Après le changement : retour à la connexion avec un message.
 */
@Component({
  selector: 'app-nouveau-mot-de-passe',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './nouveau-mot-de-passe.html',
  styleUrl: '../mot-de-passe-oublie/mot-de-passe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouveauMotDePasse implements OnInit {
  private readonly service = inject(MotDePasseService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /** Paramètre ?token=... de l'adresse (withComponentInputBinding) */
  readonly token = input<string>();

  protected readonly longueurMax = LONGUEUR_MAX_MOT_DE_PASSE;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    {
      mot_de_passe: ['', [Validators.required, motDePasseFort]],
      confirmation: ['', Validators.required],
    },
    { validators: champsIdentiques('mot_de_passe', 'confirmation') },
  );
  protected readonly c = this.formulaire.controls;

  /** Critères cochés à la frappe, comme à l'inscription */
  private readonly motDePasse = toSignal(this.c.mot_de_passe.valueChanges, { initialValue: '' });
  protected readonly motDePasseSaisi = computed(() => this.motDePasse() !== '');
  protected readonly criteres = computed(() =>
    CRITERES_MOT_DE_PASSE.map((critere) => ({
      libelle: critere.libelle,
      respecte: critere.test(this.motDePasse()),
    })),
  );

  protected readonly etat = signal<Etat>({ statut: 'verification' });
  protected readonly refus = computed(() => {
    const etat = this.etat();
    return etat.statut === 'refuse' ? etat.refus : null;
  });
  /** Erreurs du serveur sur le mot de passe (400 erreurs[]) */
  protected readonly erreursServeur = signal<string[]>([]);

  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');
  private readonly champMotDePasse = viewChild<ElementRef<HTMLInputElement>>('champMotDePasse');
  private readonly champConfirmation = viewChild<ElementRef<HTMLInputElement>>('champConfirmation');

  ngOnInit(): void {
    this.verifierLien();
  }

  protected verifierLien(): void {
    const jeton = this.token();
    if (!jetonBienForme(jeton)) {
      this.refuser(lienMalForme());
      return;
    }
    this.etat.set({ statut: 'verification' });
    this.service.verifierLien(jeton).subscribe({
      next: () => {
        this.etat.set({ statut: 'formulaire' });
        this.focaliser(() => this.champMotDePasse());
      },
      error: (erreur: unknown) => this.refuser(lienRefuseDepuisErreur(erreur) ?? lienMalForme()),
    });
  }

  /** Erreur d'un champ, affichée après que la personne l'a quitté */
  protected aUneErreur(champ: 'mot_de_passe' | 'confirmation'): boolean {
    return this.c[champ].touched && this.c[champ].invalid;
  }

  protected confirmationDifferente(): boolean {
    return this.c.confirmation.touched && this.formulaire.hasError('confirmationDifferente');
  }

  protected envoyer(): void {
    const jeton = this.token();
    if (this.etat().statut !== 'formulaire' || !jetonBienForme(jeton)) return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      // Focus sur le premier champ à corriger (mot de passe, sinon confirmation)
      this.focaliser(() =>
        this.c.mot_de_passe.invalid ? this.champMotDePasse() : this.champConfirmation(),
      );
      return;
    }
    this.etat.set({ statut: 'envoi' });
    this.erreursServeur.set([]);

    this.service.reinitialiser(jeton, this.c.mot_de_passe.value).subscribe({
      // replaceUrl : l'adresse avec le jeton sort de l'historique du navigateur
      next: () =>
        this.router.navigate(['/connexion'], {
          queryParams: { motDePasse: 'modifie' },
          replaceUrl: true,
        }),
      error: (erreur: unknown) => {
        const refus = lienRefuseDepuisErreur(erreur);
        if (refus) {
          this.refuser(refus);
          return;
        }
        // 400 sur le mot de passe : le formulaire reste affiché avec les messages
        this.erreursServeur.set(messagesErreur(erreur));
        this.etat.set({ statut: 'formulaire' });
        this.focaliser(() => this.zoneMessage());
      },
    });
  }

  private refuser(refus: LienRefuse): void {
    this.etat.set({ statut: 'refuse', refus });
    this.focaliser(() => this.zoneMessage());
  }

  private focaliser(cible: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => cible()?.nativeElement.focus(), { injector: this.injector });
  }
}
