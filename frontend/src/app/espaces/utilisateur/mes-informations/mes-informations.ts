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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { ProfilService } from '../../../core/services/profil.service';
import {
  champsProfil,
  valeursDepuisProfil,
  versDonneesProfil,
} from '../../../core/validators/profil.validators';
import { EspaceNav } from '../espace-nav';

type EtatChargement =
  { statut: 'chargement' } | { statut: 'pret' } | { statut: 'erreur'; message: string };

type EtatEnvoi =
  | { statut: 'inactif' }
  | { statut: 'envoi' }
  | { statut: 'succes' }
  | { statut: 'erreur'; messages: string[] };

/**
 * « Mes informations » : /espace-utilisateur/informations
 * Formulaire réactif pré-rempli depuis GET /api/profil, avec les mêmes
 * règles que l'inscription (core/validators/profil.validators.ts).
 * Le mot de passe ne se change pas ici (« Mot de passe oublié »).
 */
@Component({
  selector: 'app-mes-informations',
  imports: [ReactiveFormsModule, EspaceNav],
  templateUrl: './mes-informations.html',
  styleUrl: './mes-informations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MesInformations {
  private readonly profils = inject(ProfilService);
  private readonly injector = inject(Injector);

  protected readonly formulaire = inject(FormBuilder).nonNullable.group(champsProfil());
  protected readonly c = this.formulaire.controls;

  private readonly essai = signal(0);

  /** Chargement du profil, puis pré-remplissage du formulaire */
  protected readonly chargement = toSignal(
    toObservable(this.essai).pipe(
      switchMap((): Observable<EtatChargement> =>
        this.profils.lire().pipe(
          tap((profil) => this.formulaire.reset(valeursDepuisProfil(profil))),
          map((): EtatChargement => ({ statut: 'pret' })),
          catchError((erreur) =>
            of<EtatChargement>({ statut: 'erreur', message: messageErreur(erreur) }),
          ),
          startWith<EtatChargement>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatChargement },
  );

  protected readonly envoi = signal<EtatEnvoi>({ statut: 'inactif' });
  /** Messages du refus d'enregistrement (liste vide sinon) */
  protected readonly erreursEnvoi = computed(() => {
    const etat = this.envoi();
    return etat.statut === 'erreur' ? etat.messages : [];
  });
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  protected reessayer(): void {
    this.essai.update((n) => n + 1);
  }

  /** Erreur à afficher sous un champ : seulement après que l'utilisateur l'a quitté */
  protected aUneErreur(champ: keyof typeof this.c): boolean {
    const controle = this.c[champ];
    return controle.touched && controle.invalid;
  }

  protected enregistrer(): void {
    if (this.envoi().statut === 'envoi') return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      afterNextRender(
        () => document.querySelector<HTMLElement>('.informations .ng-invalid[id]')?.focus(),
        { injector: this.injector },
      );
      return;
    }

    this.envoi.set({ statut: 'envoi' });
    this.profils.modifier(versDonneesProfil(this.formulaire.getRawValue())).subscribe({
      next: (profil) => {
        // Les valeurs nettoyées par le serveur (e-mail en minuscules, téléphone sans espaces)
        this.formulaire.reset(valeursDepuisProfil(profil));
        this.envoi.set({ statut: 'succes' });
        this.focaliserMessage();
      },
      error: (erreur) => {
        this.envoi.set({ statut: 'erreur', messages: messagesErreur(erreur) });
        this.focaliserMessage();
      },
    });
  }

  /** Le message (succès ou erreurs) reçoit le focus : il est lu par le lecteur d'écran */
  private focaliserMessage(): void {
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }
}
