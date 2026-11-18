import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { messageErreur } from '../../core/http/message-erreur';

/**
 * Page de connexion (formulaire réactif).
 * Après la connexion, l'utilisateur est renvoyé vers la page qu'il voulait
 * voir (?retour=...) ou, à défaut, vers l'espace de son rôle.
 */
@Component({
  selector: 'app-connexion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './connexion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Connexion {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Paramètres d'URL, reçus grâce à withComponentInputBinding() */
  readonly retour = input<string>();
  readonly inscription = input<string>();
  /** ?motDePasse=modifie : retour de la page « Nouveau mot de passe » */
  readonly motDePasse = input<string>();

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    mot_de_passe: ['', Validators.required],
  });

  protected readonly envoiEnCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly motDePasseVisible = signal(false);

  /** Erreur à afficher sous un champ : seulement après que l'utilisateur l'a quitté */
  protected aUneErreur(champ: 'email' | 'mot_de_passe'): boolean {
    const controle = this.formulaire.controls[champ];
    return controle.touched && controle.invalid;
  }

  protected envoyer(): void {
    if (this.formulaire.invalid) {
      // Affiche les erreurs de tous les champs, même ceux pas encore visités,
      // puis place le focus sur le premier champ à corriger (RGAA 11.10)
      this.formulaire.markAllAsTouched();
      afterNextRender(
        () => this.hote.nativeElement.querySelector<HTMLElement>('input.ng-invalid[id]')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.envoiEnCours.set(true);
    this.erreur.set(null);

    const { email, mot_de_passe } = this.formulaire.getRawValue();
    this.auth.connexion(email.trim(), mot_de_passe).subscribe({
      next: () => this.router.navigateByUrl(this.destination()),
      error: (erreur: unknown) => {
        this.erreur.set(messageErreur(erreur));
        this.envoiEnCours.set(false);
      },
    });
  }

  /**
   * Page où aller après la connexion. On n'accepte que les adresses internes
   * commençant par un seul « / » : un lien piégé du type ?retour=//site-pirate.com
   * ne doit pas pouvoir envoyer l'utilisateur ailleurs (redirection ouverte).
   */
  private destination(): string {
    const retour = this.retour();
    if (retour && retour.startsWith('/') && !retour.startsWith('//')) {
      return retour;
    }
    return this.auth.lienEspace();
  }
}
