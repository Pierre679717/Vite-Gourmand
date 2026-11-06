import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

/** Téléphone français : 10 chiffres commençant par 0, espaces ou points autorisés */
const MOTIF_TELEPHONE = /^0[1-9](?:[ .]?\d{2}){4}$/;
const MOTIF_CODE_POSTAL = /^\d{5}$/;

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

  protected readonly longueurMax = LONGUEUR_MAX_MOT_DE_PASSE;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    {
      prenom: ['', [Validators.required, Validators.maxLength(50)]],
      nom: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telephone: ['', [Validators.required, Validators.pattern(MOTIF_TELEPHONE)]],
      adresse_postale: ['', [Validators.required, Validators.maxLength(255)]],
      code_postal: ['', [Validators.required, Validators.pattern(MOTIF_CODE_POSTAL)]],
      ville: ['', [Validators.required, Validators.maxLength(100)]],
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

  protected envoyer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.envoiEnCours.set(true);
    this.erreur.set(null);

    const valeurs = this.formulaire.getRawValue();
    this.auth
      .inscription({
        prenom: valeurs.prenom.trim(),
        nom: valeurs.nom.trim(),
        email: valeurs.email.trim().toLowerCase(),
        telephone: valeurs.telephone.replace(/[ .]/g, ''), // 06 12 34 56 78 -> 0612345678
        adresse_postale: valeurs.adresse_postale.trim(),
        code_postal: valeurs.code_postal,
        ville: valeurs.ville.trim(),
        mot_de_passe: valeurs.mot_de_passe,
      })
      .subscribe({
        next: () => this.router.navigate(['/connexion'], { queryParams: { inscription: 'ok' } }),
        error: (erreur: unknown) => {
          this.erreur.set(messageErreur(erreur));
          this.envoiEnCours.set(false);
          // Remonte en haut du formulaire pour que le message soit vu
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
  }
}
