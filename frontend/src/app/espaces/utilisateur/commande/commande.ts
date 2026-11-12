import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { Devis } from '../../../core/models/commande';
import { MenuInfos } from '../../../core/models/menu';
import { Profil } from '../../../core/models/utilisateur';
import { CommandeService } from '../../../core/services/commande.service';
import { MenuService } from '../../../core/services/menu.service';
import { ProfilService } from '../../../core/services/profil.service';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { PrixPipe } from '../../../shared/prix.pipe';
import {
  ActionErreurDevis,
  ETAPES,
  ETAPE_RECAPITULATIF,
  LIBELLES_ETAPES,
  NumeroEtape,
  PRET_MATERIEL_FRAIS,
  PRET_MATERIEL_JOURS_OUVRES,
  ValeursFormulaire,
  actionErreurDevis,
  adresseValide,
  aujourdhuiParis,
  dateAuPlusTot,
  dateFr,
  dateMinimumPrestation,
  emailValide,
  etapePrecedente,
  etapeSuivante,
  heureValide,
  indicationReduction,
  messageChamp,
  montantAvantReduction,
  nomValide,
  peutAllerA,
  personnesInitiales,
  personnesPourReduction,
  personnesValides,
  telephoneValide,
  valeursDepuisProfil,
  versDemandeDevis,
  versDonneesCommande,
  villeValide,
} from './commande-logique';

/** Chargement de la page : le menu et le profil, en parallèle */
type EtatPage =
  | { statut: 'chargement' }
  | { statut: 'pret'; menu: MenuInfos; image: string | null; imageAlt: string }
  | { statut: 'introuvable' }
  | { statut: 'erreur'; message: string };

/** Devis demandé au serveur en arrivant sur le récapitulatif */
type EtatDevis =
  | { statut: 'chargement' }
  | { statut: 'succes'; devis: Devis }
  | { statut: 'erreur'; message: string; action: ActionErreurDevis };

/** Envoi de la commande */
type EtatEnvoi =
  { statut: 'inactif' } | { statut: 'envoi' } | { statut: 'erreur'; messages: string[] };

/**
 * Formulaire de commande en 3 étapes + récapitulatif :
 * /espace-utilisateur/commander/:menuId?personnes=N
 *
 * La logique (dates, validateurs, étapes, données envoyées) est dans
 * commande-logique.ts ; ce composant relie le formulaire, l'API et l'affichage.
 * Le prix affiché vient toujours du serveur (devis), jamais d'un calcul du front.
 */
@Component({
  selector: 'app-commande',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, PrixPipe, PageIntrouvable],
  templateUrl: './commande.html',
  styleUrl: './commande.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Commande {
  /** :menuId de l'URL */
  readonly menuId = input.required<string>();
  /** ?personnes= envoyé par la page détail */
  readonly personnes = input<string>();

  private readonly menuService = inject(MenuService);
  private readonly profilService = inject(ProfilService);
  private readonly commandeService = inject(CommandeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly etapes = ETAPES;
  protected readonly libellesEtapes = LIBELLES_ETAPES;
  protected readonly numerosEtapes: NumeroEtape[] = [1, 2, 3, 4];
  protected readonly joursOuvres = PRET_MATERIEL_JOURS_OUVRES;
  protected readonly fraisMateriel = PRET_MATERIEL_FRAIS;
  protected readonly dateFr = dateFr;

  /** Le formulaire : un groupe par étape. Les règles liées au menu sont ajoutées au chargement. */
  protected readonly formulaire = this.fb.group({
    contact: this.fb.group({
      prenom: ['', [Validators.required, nomValide]],
      nom: ['', [Validators.required, nomValide]],
      email: ['', [Validators.required, emailValide]],
      telephone: ['', [Validators.required, telephoneValide]],
    }),
    livraison: this.fb.group({
      adresse: ['', [Validators.required, adresseValide]],
      ville: ['', [Validators.required, villeValide]],
      date: ['', [Validators.required]],
      heure: ['', [Validators.required, heureValide]],
      pretMateriel: [false],
    }),
    menu: this.fb.group({
      personnes: [1, [Validators.required]],
    }),
  });

  /** Première date possible, calculée avec le délai du menu (AAAA-MM-JJ) */
  protected readonly dateMinimum = signal('');

  /**
   * Chargement à chaque changement de menu : détail du menu + profil.
   * Si le profil ne répond pas, on pré-remplit avec le token (nom, prénom, e-mail) :
   * le client complète le téléphone lui-même, la commande reste possible.
   */
  protected readonly etat = toSignal(
    toObservable(this.menuId).pipe(
      switchMap((id): Observable<EtatPage> =>
        forkJoin({
          detail: this.menuService.detail(id),
          profil: this.profilService.lire().pipe(catchError(() => of(null))),
        }).pipe(
          tap(({ detail, profil }) => this.preparerFormulaire(detail.menu, profil)),
          map(({ detail }): EtatPage => ({
            statut: 'pret',
            menu: detail.menu,
            image: detail.images[0]?.chemin ?? null,
            imageAlt: detail.images[0]?.texte_alternatif ?? '',
          })),
          catchError((erreur: { status?: number }) =>
            of<EtatPage>(
              erreur?.status === 404
                ? { statut: 'introuvable' }
                : { statut: 'erreur', message: messageErreur(erreur) },
            ),
          ),
          startWith<EtatPage>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatPage },
  );

  protected readonly menu = computed(() => {
    const etat = this.etat();
    return etat.statut === 'pret' ? etat.menu : null;
  });

  // ---- Étapes ----
  protected readonly etape = signal<NumeroEtape>(1);
  /** Étape la plus avancée atteinte : on peut y revenir sans tout revalider */
  protected readonly etapeAtteinte = signal<NumeroEtape>(1);
  /** Titre de l'étape affichée : reçoit le focus à chaque changement d'étape */
  private readonly titreEtape = viewChild<ElementRef<HTMLElement>>('titreEtape');
  private readonly alerteEnvoi = viewChild<ElementRef<HTMLElement>>('alerteEnvoi');

  // ---- Nombre de personnes (signal pour l'indication de réduction en direct) ----
  private readonly personnesSaisies = toSignal(
    this.formulaire.controls.menu.controls.personnes.valueChanges,
    { initialValue: 1 },
  );
  protected readonly indicationReduction = computed(() => {
    const menu = this.menu();
    return menu ? indicationReduction(this.personnesSaisies(), menu.nombre_personne_min) : null;
  });
  protected readonly seuilReduction = computed(() =>
    personnesPourReduction(this.menu()?.nombre_personne_min ?? 0),
  );

  // ---- Récapitulatif ----
  protected readonly etatDevis = signal<EtatDevis>({ statut: 'chargement' });
  protected readonly etatEnvoi = signal<EtatEnvoi>({ statut: 'inactif' });
  /** Le devis reçu, ou null (chargement ou erreur) */
  protected readonly devis = computed(() => {
    const etat = this.etatDevis();
    return etat.statut === 'succes' ? etat.devis : null;
  });
  /** L'erreur du devis, ou null */
  protected readonly erreurDevis = computed(() => {
    const etat = this.etatDevis();
    return etat.statut === 'erreur' ? etat : null;
  });
  /** Messages du refus d'enregistrement, ou null */
  protected readonly erreursEnvoi = computed(() => {
    const etat = this.etatEnvoi();
    return etat.statut === 'erreur' ? etat.messages : null;
  });
  /** Valeurs du formulaire figées au moment du récapitulatif (pour l'affichage) */
  protected readonly recap = signal<ValeursFormulaire | null>(null);

  protected readonly prenomConnecte = computed(() => this.auth.utilisateur()?.prenom ?? '');

  // =====================================================================
  // Préparation
  // =====================================================================

  /** Règles liées au menu + pré-remplissage depuis le compte et l'URL */
  private preparerFormulaire(menu: MenuInfos, profil: Profil | null): void {
    const minimum = dateMinimumPrestation(aujourdhuiParis(), menu.delai_minimum_jours);
    this.dateMinimum.set(minimum);

    const { livraison, menu: groupeMenu, contact } = this.formulaire.controls;
    livraison.controls.date.setValidators([Validators.required, dateAuPlusTot(minimum)]);
    groupeMenu.controls.personnes.setValidators([
      Validators.required,
      personnesValides(menu.nombre_personne_min),
    ]);

    const utilisateur = this.auth.utilisateur();
    const depuisCompte = profil
      ? valeursDepuisProfil(profil)
      : {
          contact: {
            nom: utilisateur?.nom ?? '',
            prenom: utilisateur?.prenom ?? '',
            email: utilisateur?.email ?? '',
            telephone: '',
          },
          livraison: { adresse: '', ville: '' },
        };

    this.formulaire.reset();
    contact.patchValue(depuisCompte.contact);
    livraison.patchValue(depuisCompte.livraison);
    groupeMenu.patchValue({
      personnes: personnesInitiales(this.personnes(), menu.nombre_personne_min),
    });
    this.formulaire.updateValueAndValidity();

    this.etape.set(1);
    this.etapeAtteinte.set(1);
  }

  // =====================================================================
  // Navigation entre les étapes
  // =====================================================================

  /** « Continuer » : valide l'étape en cours avant d'avancer */
  protected continuer(): void {
    const etape = this.etape();
    if (etape === ETAPE_RECAPITULATIF) {
      return;
    }
    const groupe = this.formulaire.controls[ETAPES[etape - 1].groupe];
    if (groupe.invalid) {
      groupe.markAllAsTouched();
      this.focaliserPremiereErreur();
      return;
    }
    this.allerA(etapeSuivante(etape, true));
  }

  protected retour(): void {
    this.allerA(etapePrecedente(this.etape()));
  }

  /** Lien de l'indicateur de progression ou « Modifier » du récapitulatif */
  protected allerA(cible: NumeroEtape): void {
    if (cible > this.etapeAtteinte() && cible !== etapeSuivante(this.etape(), true)) {
      return;
    }
    this.etape.set(cible);
    if (cible > this.etapeAtteinte()) {
      this.etapeAtteinte.set(cible);
    }
    this.etatEnvoi.set({ statut: 'inactif' });
    if (cible === ETAPE_RECAPITULATIF) {
      this.demanderDevis();
    }
    // Le titre de la nouvelle étape reçoit le focus : au clavier et au lecteur
    // d'écran, on sait tout de suite où l'on est.
    afterNextRender(() => this.titreEtape()?.nativeElement.focus(), { injector: this.injector });
  }

  protected peutAllerA(cible: NumeroEtape): boolean {
    return peutAllerA(cible, this.etapeAtteinte());
  }

  /** Après un « Continuer » refusé : le focus va sur le premier champ en erreur */
  private focaliserPremiereErreur(): void {
    afterNextRender(
      () => document.querySelector<HTMLElement>('.commande__formulaire .ng-invalid[id]')?.focus(),
      { injector: this.injector },
    );
  }

  // =====================================================================
  // Récapitulatif et envoi
  // =====================================================================

  /** Devis : le serveur géocode l'adresse et calcule le prix (rien n'est enregistré) */
  protected demanderDevis(): void {
    const menu = this.menu();
    if (!menu) {
      return;
    }
    const valeurs = this.formulaire.getRawValue();
    this.recap.set(valeurs);
    this.etatDevis.set({ statut: 'chargement' });
    this.commandeService.devis(versDemandeDevis(menu.menu_id, valeurs)).subscribe({
      next: (devis) => this.etatDevis.set({ statut: 'succes', devis }),
      error: (erreur: HttpErrorResponse) =>
        this.etatDevis.set({
          statut: 'erreur',
          message: messageErreur(erreur),
          action: actionErreurDevis(erreur.status),
        }),
    });
  }

  protected montantAvantReduction(devis: Devis): number {
    return montantAvantReduction(devis.prix_par_personne, devis.nombre_personne);
  }

  /** Validation finale : le serveur revérifie tout et recalcule le prix */
  protected valider(): void {
    const menu = this.menu();
    if (!menu || this.etatEnvoi().statut === 'envoi') {
      return; // pas de double envoi si l'on clique deux fois
    }
    if (this.formulaire.invalid) {
      // Ne devrait pas arriver (chaque étape est validée), mais on reste prudent
      const premiere = ETAPES.find((e) => this.formulaire.controls[e.groupe].invalid);
      this.formulaire.markAllAsTouched();
      this.allerA((premiere?.numero ?? 1) as NumeroEtape);
      return;
    }

    const donnees = versDonneesCommande(menu.menu_id, this.formulaire.getRawValue());
    this.etatEnvoi.set({ statut: 'envoi' });
    this.commandeService.creer(donnees).subscribe({
      next: (commande) =>
        this.router.navigate(['/espace-utilisateur/commande-confirmee', commande.numero_commande], {
          // La page de confirmation affiche le détail sans nouvel appel à l'API
          state: { commande, email: donnees.contact_email },
        }),
      error: (erreur: unknown) => {
        this.etatEnvoi.set({ statut: 'erreur', messages: messagesErreur(erreur) });
        afterNextRender(() => this.alerteEnvoi()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
    });
  }

  // =====================================================================
  // Affichage des erreurs de champ
  // =====================================================================

  /** Message d'erreur d'un champ, affiché seulement après que le client l'a quitté */
  protected erreur(groupe: 'contact' | 'livraison' | 'menu', champ: string): string | null {
    const controle = this.formulaire.get([groupe, champ]);
    return controle && controle.invalid && controle.touched ? messageChamp(controle.errors) : null;
  }
}
