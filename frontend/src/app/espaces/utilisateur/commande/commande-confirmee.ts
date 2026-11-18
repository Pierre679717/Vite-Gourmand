import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommandeCreee } from '../../../core/models/commande';
import { PageIntrouvable } from '../../../pages/page-introuvable/page-introuvable';
import { PrixPipe } from '../../../shared/prix.pipe';
import { dateFr, montantAvantReduction } from './commande-logique';

/** Ce que le formulaire transmet en naviguant (voir Commande.valider) */
interface EtatNavigation {
  commande?: CommandeCreee;
  email?: string;
}

/** VG-2026-0013 */
const REGEX_NUMERO = /^VG-\d{4}-\d{4,}$/;

/**
 * Page de confirmation : /espace-utilisateur/commande-confirmee/:numero
 *
 * Le détail arrive avec la navigation (state), sans nouvel appel à l'API.
 * Le navigateur garde ce state dans l'historique : il est encore là après
 * un rechargement de la page. S'il manque (adresse tapée à la main),
 * on affiche seulement le numéro et le lien vers l'espace client.
 */
@Component({
  selector: 'app-commande-confirmee',
  imports: [RouterLink, PrixPipe, PageIntrouvable],
  templateUrl: './commande-confirmee.html',
  styleUrl: './commande-confirmee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandeConfirmee {
  /** :numero de l'URL */
  readonly numero = input.required<string>();

  private readonly auth = inject(AuthService);
  private readonly etatNavigation: EtatNavigation =
    (inject(Router).currentNavigation()?.extras.state as EtatNavigation | undefined) ??
    (history.state as EtatNavigation | null) ??
    {};

  protected readonly dateFr = dateFr;
  protected readonly prenom = computed(() => this.auth.utilisateur()?.prenom ?? '');
  protected readonly numeroValide = computed(() => REGEX_NUMERO.test(this.numero()));

  /** Le détail, seulement s'il correspond bien au numéro de l'URL */
  protected readonly commande = computed(() => {
    const commande = this.etatNavigation.commande;
    return commande?.numero_commande === this.numero() ? commande : null;
  });
  protected readonly email = computed(() => (this.commande() ? this.etatNavigation.email : null));

  protected montantAvantReduction(commande: CommandeCreee): number {
    return montantAvantReduction(commande.prix_par_personne, commande.nombre_personne);
  }
}
