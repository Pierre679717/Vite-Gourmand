import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { messageErreur } from '../../../core/http/message-erreur';
import { ResumeCommande } from '../../../core/models/commande';
import { CommandeService } from '../../../core/services/commande.service';
import { PrixPipe } from '../../../shared/prix.pipe';
import {
  LIBELLES_STATUT,
  classeBadge,
  dateLongue,
  heureFr,
  repartirCommandes,
} from './suivi-commande';

/** Un groupe de la liste : « En cours » ou « Historique » */
interface GroupeCommandes {
  id: string;
  titre: string;
  commandes: ResumeCommande[];
}

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'succes'; groupes: GroupeCommandes[]; total: number }
  | { statut: 'erreur'; message: string };

/** Les deux groupes, sans ceux qui sont vides */
function grouper(liste: ResumeCommande[]): GroupeCommandes[] {
  const { enCours, passees } = repartirCommandes(liste);
  return [
    { id: 'en-cours', titre: 'En cours', commandes: enCours },
    { id: 'historique', titre: 'Historique', commandes: passees },
  ].filter((groupe) => groupe.commandes.length > 0);
}

/**
 * « Mes commandes » : /espace-utilisateur (page d'accueil de l'espace client).
 * Remplace le tableau de bord provisoire. Deux groupes : les commandes en
 * cours (à suivre) puis l'historique (terminées et annulées).
 */
@Component({
  selector: 'app-mes-commandes',
  imports: [RouterLink, PrixPipe],
  templateUrl: './mes-commandes.html',
  styleUrl: './mes-commandes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MesCommandes {
  private readonly commandes = inject(CommandeService);
  private readonly auth = inject(AuthService);

  protected readonly libelles = LIBELLES_STATUT;
  protected readonly classeBadge = classeBadge;
  protected readonly dateLongue = dateLongue;
  protected readonly heureFr = heureFr;

  protected readonly prenom = computed(() => this.auth.utilisateur()?.prenom ?? '');

  /** Incrémenté par « Réessayer » : relance le chargement */
  private readonly essai = signal(0);

  protected readonly etat = toSignal(
    toObservable(this.essai).pipe(
      switchMap((): Observable<EtatListe> =>
        this.commandes.lister().pipe(
          map((liste): EtatListe => ({
            statut: 'succes',
            groupes: grouper(liste),
            total: liste.length,
          })),
          catchError((erreur) =>
            of<EtatListe>({ statut: 'erreur', message: messageErreur(erreur) }),
          ),
          startWith<EtatListe>({ statut: 'chargement' }),
        ),
      ),
    ),
    { initialValue: { statut: 'chargement' } as EtatListe },
  );

  protected reessayer(): void {
    this.essai.update((n) => n + 1);
  }
}
