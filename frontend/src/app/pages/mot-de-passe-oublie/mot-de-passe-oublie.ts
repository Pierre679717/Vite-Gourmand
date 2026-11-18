import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../core/http/message-erreur';
import { MotDePasseService } from '../../core/services/mot-de-passe.service';

type Etat =
  | { statut: 'saisie' }
  | { statut: 'envoi' }
  | { statut: 'envoye'; message: string }
  | { statut: 'erreur'; message: string };

/**
 * Mot de passe oublié : la personne saisit son e-mail et reçoit un lien.
 * Le message affiché après l'envoi est celui du serveur, IDENTIQUE que
 * l'adresse corresponde à un compte ou non (on ne révèle pas qui est client).
 */
@Component({
  selector: 'app-mot-de-passe-oublie',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './mot-de-passe-oublie.html',
  styleUrl: './mot-de-passe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotDePasseOublie {
  private readonly service = inject(MotDePasseService);
  private readonly injector = inject(Injector);

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly etat = signal<Etat>({ statut: 'saisie' });
  /** Texte du message affiché (succès ou erreur) */
  protected readonly message = computed(() => {
    const etat = this.etat();
    return 'message' in etat ? etat.message : '';
  });
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');
  private readonly champEmail = viewChild<ElementRef<HTMLInputElement>>('champEmail');

  protected envoyer(): void {
    if (this.etat().statut === 'envoi') return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.champEmail()?.nativeElement.focus();
      return;
    }
    this.etat.set({ statut: 'envoi' });

    const email = this.formulaire.getRawValue().email.trim();
    this.service.demanderLien(email).subscribe({
      next: (reponse) => {
        this.etat.set({ statut: 'envoye', message: reponse.message });
        this.focaliser(() => this.zoneMessage());
      },
      error: (erreur: unknown) => {
        // 400 (adresse refusée), 429 (trop de demandes), serveur injoignable...
        this.etat.set({ statut: 'erreur', message: messageErreur(erreur) });
        this.focaliser(() => this.zoneMessage());
      },
    });
  }

  /** « Faire une nouvelle demande » : retour au formulaire, e-mail conservé */
  protected recommencer(): void {
    this.etat.set({ statut: 'saisie' });
    this.focaliser(() => this.champEmail());
  }

  /** Place le focus clavier après l'affichage (lecteurs d'écran, navigation au clavier) */
  private focaliser(cible: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => cible()?.nativeElement.focus(), { injector: this.injector });
  }
}
