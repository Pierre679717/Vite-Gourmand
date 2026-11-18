import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AvisModeration,
  ChangementStatut,
  CommandeEmploye,
  CommandeEmployeDetaillee,
  DecisionAvis,
  FiltresCommandes,
  ReponseChangementStatut,
  ReponseModeration,
  StatutAvis,
} from '../models/employe';

/**
 * Accès à l'API de l'espace employé (/api/employe/...).
 * Ces routes sont réservées aux employés et aux administrateurs : le serveur
 * le vérifie avec le token (ajouté par auth.interceptor.ts), qu'il ne suffit
 * donc pas de cacher les pages pour protéger.
 */
@Injectable({ providedIn: 'root' })
export class EmployeService {
  private readonly http = inject(HttpClient);

  /** Commandes de tous les clients, filtrables par statut et par client */
  listerCommandes(filtres: FiltresCommandes = {}): Observable<CommandeEmploye[]> {
    let params = new HttpParams();
    if (filtres.statut) params = params.set('statut', filtres.statut);
    const client = filtres.client?.trim();
    if (client) params = params.set('client', client);
    return this.http.get<CommandeEmploye[]>('/api/employe/commandes', { params });
  }

  /** Détail d'une commande, avec le suivi et les coordonnées du client */
  detailCommande(id: number): Observable<CommandeEmployeDetaillee> {
    return this.http.get<CommandeEmployeDetaillee>(`/api/employe/commandes/${id}`);
  }

  /** Fait avancer la commande d'une étape, ou l'annule (mode de contact + motif) */
  changerStatut(id: number, changement: ChangementStatut): Observable<ReponseChangementStatut> {
    return this.http.put<ReponseChangementStatut>(`/api/employe/commandes/${id}`, changement);
  }

  /** Avis à modérer ; sans statut : tous les avis */
  listerAvis(statut: StatutAvis | null = null): Observable<AvisModeration[]> {
    const params = statut ? new HttpParams().set('statut', statut) : new HttpParams();
    return this.http.get<AvisModeration[]>('/api/employe/avis', { params });
  }

  /** Valide (publié sur l'accueil) ou refuse un avis */
  modererAvis(id: number, statut: DecisionAvis): Observable<ReponseModeration> {
    return this.http.put<ReponseModeration>(`/api/employe/avis/${id}`, { statut });
  }
}
