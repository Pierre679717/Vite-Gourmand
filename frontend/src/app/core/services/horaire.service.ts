import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Horaire } from '../models/horaire';

/**
 * Accès aux horaires d'ouverture.
 * L'URL est relative (/api/...) : en développement, le proxy d'Angular CLI
 * la transmet à Express ; en production, Express sert le site et l'API.
 */
@Injectable({ providedIn: 'root' })
export class HoraireService {
  private readonly http = inject(HttpClient);

  lister(): Observable<Horaire[]> {
    return this.http.get<Horaire[]>('/api/horaires');
  }
}
