import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Avis } from '../models/avis';

/** Avis clients. Seuls les avis validés par un employé sont publics. */
@Injectable({ providedIn: 'root' })
export class AvisService {
  private readonly http = inject(HttpClient);

  /** Avis validés, du plus récent au plus ancien (page d'accueil) */
  listerValides(): Observable<Avis[]> {
    return this.http.get<Avis[]>('/api/avis');
  }
}
