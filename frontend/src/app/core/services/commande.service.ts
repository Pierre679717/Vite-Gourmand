import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CommandeCreee,
  CommandeDetaillee,
  DemandeDevis,
  Devis,
  DonneesCommande,
  DonneesModification,
  ReponseAnnulation,
  ReponseCreationCommande,
  ResumeCommande,
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

  /** « Mes commandes » : les commandes du client connecté, la plus récente d'abord */
  lister(): Observable<ResumeCommande[]> {
    return this.http.get<ResumeCommande[]>('/api/commandes');
  }

  /** Détail d'une commande avec le suivi des statuts (404 si elle n'est pas au client) */
  detail(id: number): Observable<CommandeDetaillee> {
    return this.http.get<CommandeDetaillee>(`/api/commandes/${id}`);
  }

  /**
   * Modifie une commande « en attente » (tout sauf le menu).
   * Comme pour la création, aucun prix n'est envoyé : le serveur recalcule.
   */
  modifier(id: number, donnees: DonneesModification): Observable<CommandeCreee> {
    return this.http
      .put<ReponseCreationCommande>(`/api/commandes/${id}`, donnees)
      .pipe(map((reponse) => reponse.commande));
  }

  /** Annule une commande « en attente » (elle reste dans l'historique) */
  annuler(id: number): Observable<ReponseAnnulation> {
    return this.http.post<ReponseAnnulation>(`/api/commandes/${id}/annulation`, {});
  }
}
