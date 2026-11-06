import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

/**
 * Mot de passe oublié — page seulement pour l'instant.
 * L'envoi du lien de réinitialisation par e-mail demande une route API
 * (jeton à usage unique, avec une date d'expiration) qui sera développée
 * plus tard : la page le dit honnêtement à l'utilisateur.
 */
@Component({
  selector: 'app-mot-de-passe-oublie',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './mot-de-passe-oublie.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotDePasseOublie {
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly demandeEnvoyee = signal(false);

  protected envoyer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    this.demandeEnvoyee.set(true);
  }
}
