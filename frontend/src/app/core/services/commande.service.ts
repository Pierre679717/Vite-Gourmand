import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CommandeCreee,
  DemandeDevis,
  Devis,
  DonneesCommande,
  ReponseCreationCommande,
} from '../models/commande';

/**
 * Accès aux commandes du client.
 * Le prix n'est jamais calculé ici : le serveur fait foi. Le front demande
 * un devis pour l'afficher, puis envoie la commande sans aucun montant.
 * Le token est ajouté automatiquement par auth.interceptor.ts.
 */
@Injectable({ providedIn: 'root' })
export class CommandeService {
  private readonly http = inject(HttpClient);

  /** Détail du prix (menu, réduction, livraison) sans rien enregistrer */
  devis(demande: DemandeDevis): Observable<Devis> {
    return this.http.post<Devis>('/api/commandes/devis', demande);
  }

  /** Enregistre la commande et renvoie la commande créée (numéro VG-AAAA-NNNN) */
  creer(donnees: DonneesCommande): Observable<CommandeCreee> {
    return this.http
      .post<ReponseCreationCommande>('/api/commandes', donnees)
      .pipe(map((reponse) => reponse.commande));
  }
}
