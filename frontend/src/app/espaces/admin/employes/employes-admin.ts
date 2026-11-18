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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { Employe } from '../../../core/models/admin';
import { AdminService } from '../../../core/services/admin.service';
import {
  CRITERES_MOT_DE_PASSE,
  LONGUEUR_MAX_MOT_DE_PASSE,
  motDePasseFort,
} from '../../../core/validators/mot-de-passe.validators';
import { MOTIF_EMAIL } from '../../../core/validators/profil.validators';
import { EmployeNav } from '../../employe/employe-nav';
import {
  EMPLOYE_VIDE,
  estActif,
  nomComplet,
  texteConfirmation,
  texteNombreEmployes,
  versNouvelEmploye,
} from '../admin-logique';

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'succes'; employes: Employe[] }
  | { statut: 'erreur'; message: string };

type Champ = 'prenom' | 'nom' | 'email' | 'mot_de_passe';

/**
 * Comptes employés : /espace-admin/employes
 * Exigences du sujet :
 * - créer un compte « employe » avec un e-mail (identifiant) et un mot de
 *   passe ; l'employé reçoit un mail SANS le mot de passe ;
 * - rendre un compte inutilisable (départ de l'entreprise) ;
 * - impossible de créer un administrateur : le formulaire n'a pas de champ
 *   « rôle », et le serveur ne lirait de toute façon pas ce champ.
 */
@Component({
  selector: 'app-employes-admin',
  imports: [ReactiveFormsModule, EmployeNav],
  templateUrl: './employes-admin.html',
  styleUrls: [
    '../../utilisateur/mes-commandes/mes-commandes.scss',
    '../../employe/catalogue/catalogue.scss',
    './employes-admin.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployesAdmin {
  private readonly admin = inject(AdminService);
  private readonly injector = inject(Injector);

  protected readonly estActif = estActif;
  protected readonly nomComplet = nomComplet;
  protected readonly texteConfirmation = texteConfirmation;
  protected readonly texteNombreEmployes = texteNombreEmployes;
  protected readonly longueurMax = LONGUEUR_MAX_MOT_DE_PASSE;

  // ---- Liste des comptes ------------------------------------------------
  private readonly version = signal(0);

  protected readonly etat = toSignal(
    toObservable(this.version).pipe(
      switchMap((): Observable<EtatListe> =>
        this.admin.listerEmployes().pipe(
          map((employes): EtatListe => ({ statut: 'succes', employes })),
          catchError((e) => of<EtatListe>({ statut: 'erreur', message: messageErreur(e) })),
        ),
      ),
      // Le squelette seulement au premier chargement : ensuite la liste reste affichée
      startWith<EtatListe>({ statut: 'chargement' }),
    ),
    { initialValue: { statut: 'chargement' } as EtatListe },
  );

  protected reessayer(): void {
    this.version.update((n) => n + 1);
  }

  // ---- Messages après une action (zone qui reçoit le focus) -------------
  protected readonly message = signal<string | null>(null);
  protected readonly erreur = signal<string | null>(null);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  private annoncer(message: string | null, erreur: string | null): void {
    this.message.set(message);
    this.erreur.set(erreur);
    afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), { injector: this.injector });
  }

  // ---- Création d'un compte (formulaire réactif) ------------------------
  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    prenom: ['', [Validators.required, Validators.maxLength(50)]],
    nom: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.pattern(MOTIF_EMAIL), Validators.maxLength(100)]],
    mot_de_passe: ['', [Validators.required, motDePasseFort]],
  });

  protected readonly motDePasseVisible = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreursServeur = signal<string[]>([]);

  private readonly motDePasse = toSignal(this.formulaire.controls.mot_de_passe.valueChanges, {
    initialValue: '',
  });

  /** Règles cochées à chaque frappe (mêmes règles que l'inscription et le serveur) */
  protected readonly criteres = computed(() =>
    CRITERES_MOT_DE_PASSE.map((critere) => ({
      libelle: critere.libelle,
      respecte: critere.test(this.motDePasse()),
    })),
  );
  protected readonly motDePasseSaisi = computed(() => this.motDePasse() !== '');

  /** Message d'erreur d'un champ, affiché seulement après l'avoir quitté */
  protected erreurChamp(champ: Champ): string | null {
    const c = this.formulaire.controls[champ];
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) {
      return {
        prenom: 'Le prénom est obligatoire.',
        nom: 'Le nom est obligatoire.',
        email: 'L’adresse e-mail est obligatoire : elle sert d’identifiant.',
        mot_de_passe: 'Le mot de passe est obligatoire.',
      }[champ];
    }
    if (c.hasError('maxlength')) return 'Ce champ est trop long.';
    if (c.hasError('pattern'))
      return 'Adresse e-mail invalide (exemple : prenom.nom@vite-gourmand.fr).';
    return 'Le mot de passe ne respecte pas toutes les règles ci-dessus.';
  }

  protected creer(): void {
    if (this.envoi()) return;
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      afterNextRender(
        () =>
          document.querySelector<HTMLElement>('.formulaire-employe [aria-invalid="true"]')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.envoi.set(true);
    this.erreursServeur.set([]);
    this.admin.creerEmploye(versNouvelEmploye(this.formulaire.getRawValue())).subscribe({
      next: (reponse) => {
        this.envoi.set(false);
        this.formulaire.reset(EMPLOYE_VIDE);
        this.motDePasseVisible.set(false);
        this.version.update((n) => n + 1);
        this.annoncer(reponse.message, null);
      },
      error: (e) => {
        this.envoi.set(false);
        // 409 : e-mail déjà pris ; 400 : liste des règles non respectées
        this.erreursServeur.set(messagesErreur(e));
        afterNextRender(() => document.getElementById('erreurs-serveur')?.focus(), {
          injector: this.injector,
        });
      },
    });
  }

  // ---- Désactiver / réactiver (avec confirmation) -----------------------
  /** Compte dont le changement attend une confirmation */
  protected readonly aConfirmer = signal<number | null>(null);
  protected readonly enCours = signal<number | null>(null);
  private readonly titreConfirmation = viewChild<ElementRef<HTMLElement>>('titreConfirmation');

  protected demanderChangement(employe: Employe): void {
    this.aConfirmer.set(employe.utilisateur_id);
    afterNextRender(() => this.titreConfirmation()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** « Annuler » ou Échap : le focus revient sur le bouton du compte */
  protected annulerChangement(employe: Employe): void {
    this.aConfirmer.set(null);
    afterNextRender(
      () => document.getElementById(`activation-${employe.utilisateur_id}`)?.focus(),
      { injector: this.injector },
    );
  }

  protected confirmerChangement(employe: Employe): void {
    if (this.enCours() !== null) return;
    this.enCours.set(employe.utilisateur_id);
    this.admin.changerActif(employe.utilisateur_id, !estActif(employe)).subscribe({
      next: (reponse) => this.terminerChangement(reponse.message, null),
      error: (e) => this.terminerChangement(null, messageErreur(e)),
    });
  }

  private terminerChangement(message: string | null, erreur: string | null): void {
    this.enCours.set(null);
    this.aConfirmer.set(null);
    this.version.update((n) => n + 1);
    this.annoncer(message, erreur);
  }
}
