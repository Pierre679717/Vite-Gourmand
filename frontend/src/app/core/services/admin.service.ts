import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Employe,
  FiltresStats,
  NouvelEmploye,
  ReponseEmploye,
  Statistiques,
} from '../models/admin';

/**
 * Accès à l'API de l'espace administrateur (/api/admin/...).
 * Le serveur vérifie le rôle EN BASE à chaque requête (adminRequired) :
 * cacher les pages ne suffirait pas à les protéger.
 * Pour tout ce que fait aussi un employé, l'admin utilise EmployeService
 * et CatalogueService : pas de doublon.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/admin';

  /** Tous les comptes employés, actifs puis désactivés */
  listerEmployes(): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.api}/employes`);
  }

  /** Crée un compte employé (le serveur envoie le mail, sans le mot de passe) */
  creerEmploye(donnees: NouvelEmploye): Observable<ReponseEmploye> {
    return this.http.post<ReponseEmploye>(`${this.api}/employes`, donnees);
  }

  /** Désactive (départ de l'entreprise) ou réactive un compte employé */
  changerActif(id: number, actif: boolean): Observable<ReponseEmploye> {
    return this.http.put<ReponseEmploye>(`${this.api}/employes/${id}/actif`, { actif });
  }

  /** Commandes et chiffre d'affaires par menu, filtrables par menu et par période */
  statistiques(filtres: FiltresStats = {}): Observable<Statistiques> {
    let params = new HttpParams();
    if (filtres.menu_id) params = params.set('menu_id', filtres.menu_id);
    if (filtres.debut) params = params.set('debut', filtres.debut);
    if (filtres.fin) params = params.set('fin', filtres.fin);
    return this.http.get<Statistiques>(`${this.api}/statistiques`, { params });
  }
}
