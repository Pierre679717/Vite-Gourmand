import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, map, of, startWith } from 'rxjs';
import { messageErreur, messagesErreur } from '../../../core/http/message-erreur';
import { Jour } from '../../../core/models/catalogue';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { EmployeNav } from '../employe-nav';
import {
  LigneHoraire,
  erreurLigne,
  libelleJour,
  versHoraires,
  versLignes,
} from './catalogue-logique';

type EtatHoraires =
  { statut: 'chargement' } | { statut: 'pret' } | { statut: 'erreur'; message: string };

/**
 * Horaires d'ouverture : /espace-employe/horaires
 * Exigence du sujet : l'employé peut modifier les horaires (affichés dans
 * le pied de page). Un FormArray de 7 lignes : « Fermé » ou deux heures.
 * Les 7 jours partent ensemble (PUT), enregistrés en une transaction.
 */
@Component({
  selector: 'app-horaires-gestion',
  imports: [ReactiveFormsModule, EmployeNav],
  templateUrl: './horaires-gestion.html',
  styleUrls: [
    '../../utilisateur/mes-commandes/mes-commandes.scss',
    './catalogue.scss',
    './horaires-gestion.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorairesGestion {
  private readonly catalogue = inject(CatalogueService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly injector = inject(Injector);

  protected readonly libelleJour = libelleJour;

  /**
   * Le formulaire : un FormArray d'une ligne par jour, lundi → dimanche.
   * [formGroup] sur la balise <form> est indispensable : sans lui, Angular
   * n'intercepte pas l'envoi et le navigateur recharge la page.
   */
  protected readonly formulaire = this.fb.group({
    jours: this.fb.array<ReturnType<HorairesGestion['ligne']>>([]),
  });
  protected readonly jours = this.formulaire.controls.jours;

  private ligne(l: LigneHoraire) {
    return this.fb.group({
      jour: [l.jour as Jour],
      ferme: [l.ferme],
      ouverture: [l.ouverture],
      fermeture: [l.fermeture],
    });
  }

  protected readonly etat = toSignal(this.charger(), {
    initialValue: { statut: 'chargement' } as EtatHoraires,
  });

  private charger(): Observable<EtatHoraires> {
    return this.catalogue.horaires().pipe(
      map((horaires): EtatHoraires => {
        this.jours.clear();
        for (const l of versLignes(horaires)) this.jours.push(this.ligne(l));
        return { statut: 'pret' };
      }),
      catchError((e) => of<EtatHoraires>({ statut: 'erreur', message: messageErreur(e) })),
      startWith<EtatHoraires>({ statut: 'chargement' }),
    );
  }

  protected lignes(): LigneHoraire[] {
    return this.jours.getRawValue() as LigneHoraire[];
  }

  /** Erreurs affichées après une tentative d'envoi (une par jour) */
  protected readonly tentative = signal(false);
  protected erreurDuJour(index: number): string | null {
    return this.tentative() ? erreurLigne(this.lignes()[index]) : null;
  }

  protected readonly envoi = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly erreursServeur = signal<string[]>([]);
  private readonly zoneMessage = viewChild<ElementRef<HTMLElement>>('zoneMessage');

  protected enregistrer(): void {
    if (this.envoi()) return;
    this.tentative.set(true);
    this.message.set(null);
    const lignes = this.lignes();
    const premiere = lignes.findIndex((l) => erreurLigne(l) !== null);
    if (premiere !== -1) {
      afterNextRender(
        () => document.getElementById(`ouverture-${lignes[premiere].jour}`)?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.envoi.set(true);
    this.erreursServeur.set([]);
    this.catalogue.modifierHoraires(versHoraires(lignes)).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.tentative.set(false);
        this.message.set(r.message);
        afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
      error: (e) => {
        this.envoi.set(false);
        this.erreursServeur.set(messagesErreur(e));
        afterNextRender(() => this.zoneMessage()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
    });
  }
}
