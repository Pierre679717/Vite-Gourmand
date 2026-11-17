import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { messageErreur } from '../../core/http/message-erreur';
import {
  CRITERES_MOT_DE_PASSE,
  LONGUEUR_MAX_MOT_DE_PASSE,
  champsIdentiques,
  motDePasseFort,
} from '../../core/validators/mot-de-passe.validators';
import { champsProfil, versDonneesProfil } from '../../core/validators/profil.validators';

/**
 * Création de compte client. Tous les champs sont obligatoires :
 * le sujet exige le téléphone (GSM) et l'adresse postale.
 */
@Component({
  selector: 'app-inscription',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './inscription.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inscription {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly longueurMax = LONGUEUR_MAX_MOT_DE_PASSE;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    {
      // Les 7 champs du profil : mêmes règles que « Mes informations » et que le serveur
      ...champsProfil(),
      mot_de_passe: ['', [Validators.required, motDePasseFort]],
      confirmation: ['', Validators.required],
    },
    { validators: champsIdentiques('mot_de_passe', 'confirmation') },
  );

  protected readonly c = this.formulaire.controls;

  /** Valeur du mot de passe sous forme de signal, pour la liste des critères */
  protected readonly motDePasse = toSignal(this.c.mot_de_passe.valueChanges, { initialValue: '' });

  /** Chaque critère avec son état (respecté ou non), mis à jour à chaque frappe */
  protected readonly criteres = computed(() =>
    CRITERES_MOT_DE_PASSE.map((critere) => ({
      libelle: critere.libelle,
      respecte: critere.test(this.motDePasse()),
    })),
  );

  protected readonly envoiEnCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  /** Erreur à afficher sous un champ : seulement après que l'utilisateur l'a quitté */
  protected aUneErreur(champ: keyof typeof this.c): boolean {
    const controle = this.c[champ];
    return controle.touched && controle.invalid;
  }

  protected confirmationDifferente(): boolean {
    return this.c.confirmation.touched && this.formulaire.hasError('confirmationDifferente');
  }

  /** Confirmation à signaler : vide, ou différente du mot de passe */
  protected erreurConfirmation(): boolean {
    return this.aUneErreur('confirmation') || this.confirmationDifferente();
  }

  protected envoyer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      // Après l'affichage des messages : focus sur le premier champ à corriger
      afterNextRender(() => this.focusPremiereErreur(), { injector: this.injector });
      return;
    }
    this.envoiEnCours.set(true);
    this.erreur.set(null);

    const { mot_de_passe, confirmation: _confirmation, ...profil } = this.formulaire.getRawValue();
    this.auth.inscription({ ...versDonneesProfil(profil), mot_de_passe }).subscribe({
      next: () => this.router.navigate(['/connexion'], { queryParams: { inscription: 'ok' } }),
      error: (erreur: unknown) => {
        this.erreur.set(messageErreur(erreur));
        this.envoiEnCours.set(false);
        // Remonte en haut du formulaire pour que le message soit vu
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  /**
   * Premier champ en erreur, dans l'ordre du formulaire. Si seuls les deux mots
   * de passe diffèrent (erreur portée par le formulaire, pas par un champ),
   * c'est la confirmation qui reçoit le focus.
   */
  private focusPremiereErreur(): void {
    const formulaire = this.hote.nativeElement;
    const champ =
      formulaire.querySelector<HTMLElement>('input.ng-invalid[id]') ??
      formulaire.querySelector<HTMLElement>('#confirmation');
    champ?.focus();
  }
}
