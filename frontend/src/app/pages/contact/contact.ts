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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { messagesErreur } from '../../core/http/message-erreur';
import { MessageContact } from '../../core/models/contact';
import { ContactService } from '../../core/services/contact.service';
import {
  DESCRIPTION_MAX,
  TITRE_MAX,
  champsContact,
  messageChampContact,
  versMessageContact,
} from './contact-logique';

type EtatEnvoi =
  | { statut: 'inactif' }
  | { statut: 'envoi' }
  | { statut: 'succes' }
  | { statut: 'erreur'; messages: string[] };

/**
 * Nous contacter : /contact (page publique).
 * Les trois champs imposés par le sujet : titre, description, e-mail.
 * L'e-mail est pré-rempli si le visiteur est connecté. Le message n'est
 * pas enregistré : le serveur l'envoie par mail à l'entreprise.
 */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contact {
  private readonly contact = inject(ContactService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  protected readonly titreMax = TITRE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(
    champsContact(this.auth.utilisateur()?.email ?? ''),
  );

  protected readonly envoi = signal<EtatEnvoi>({ statut: 'inactif' });
  protected readonly erreursEnvoi = computed(() => {
    const etat = this.envoi();
    return etat.statut === 'erreur' ? etat.messages : [];
  });
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  /** Message d'erreur d'un champ, affiché après que le visiteur l'a quitté */
  protected erreur(champ: keyof MessageContact): string | null {
    const controle = this.formulaire.controls[champ];
    return controle.touched ? messageChampContact(champ, controle.errors) : null;
  }

  protected envoyer(): void {
    if (this.envoi().statut === 'envoi') return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      afterNextRender(
        () => document.querySelector<HTMLElement>('.contact__formulaire .ng-invalid[id]')?.focus(),
        { injector: this.injector },
      );
      return;
    }

    const message = versMessageContact(this.formulaire.getRawValue());
    this.envoi.set({ statut: 'envoi' });
    this.contact.envoyer(message).subscribe({
      next: () => {
        // On vide le titre et le message, on garde l'e-mail (nettoyé) pour un éventuel second message
        this.formulaire.reset({ titre: '', description: '', email: message.email });
        this.envoi.set({ statut: 'succes' });
        this.focaliserMessage();
      },
      error: (erreur) => {
        this.envoi.set({ statut: 'erreur', messages: messagesErreur(erreur) });
        this.focaliserMessage();
      },
    });
  }

  private focaliserMessage(): void {
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }
}
