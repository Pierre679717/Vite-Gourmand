import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DonneesProfil, Profil, ReponseModificationProfil } from '../models/utilisateur';

/**
 * Profil complet de l'utilisateur connecté.
 * AuthService lit seulement le token (identité et rôle) ; le téléphone
 * et l'adresse, utiles pour pré-remplir une commande, sont demandés au serveur.
 */
@Injectable({ providedIn: 'root' })
export class ProfilService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  lire(): Observable<Profil> {
    return this.http.get<{ user: Profil }>('/api/profil').pipe(map((reponse) => reponse.user));
  }

  /**
   * « Mes informations » : enregistre le profil puis remplace le token
   * par celui que renvoie le serveur (il contient le nouveau prénom,
   * nom et e-mail, affichés dans le header).
   */
  modifier(donnees: DonneesProfil): Observable<Profil> {
    return this.http.put<ReponseModificationProfil>('/api/profil', donnees).pipe(
      tap((reponse) => this.auth.remplacerToken(reponse.token)),
      map((reponse) => reponse.user),
    );
  }
}
