import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Avis, NouvelAvis, ReponseAvis } from '../models/avis';

/** Avis clients. Seuls les avis validés par un employé sont publics. */
@Injectable({ providedIn: 'root' })
export class AvisService {
  private readonly http = inject(HttpClient);

  /** Avis validés, du plus récent au plus ancien (page d'accueil) */
  listerValides(): Observable<Avis[]> {
    return this.http.get<Avis[]>('/api/avis');
  }

  /** Donne un avis sur une commande terminée (publié après validation par un employé) */
  creer(avis: NouvelAvis): Observable<ReponseAvis['avis']> {
    return this.http.post<ReponseAvis>('/api/avis', avis).pipe(map((reponse) => reponse.avis));
  }
}
