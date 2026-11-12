import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Profil } from '../models/utilisateur';

/**
 * Profil complet de l'utilisateur connecté.
 * AuthService lit seulement le token (identité et rôle) ; le téléphone
 * et l'adresse, utiles pour pré-remplir une commande, sont demandés au serveur.
 */
@Injectable({ providedIn: 'root' })
export class ProfilService {
  private readonly http = inject(HttpClient);

  lire(): Observable<Profil> {
    return this.http.get<{ user: Profil }>('/api/profil').pipe(map((reponse) => reponse.user));
  }
}
