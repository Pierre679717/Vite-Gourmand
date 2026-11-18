import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReponseMessage } from '../models/mot-de-passe';

/**
 * Mot de passe oublié (pages publiques, pas besoin d'être connecté).
 * Le jeton n'est jamais mis dans l'adresse d'une requête : il voyage
 * dans le corps d'un POST, qui n'apparaît pas dans les journaux du serveur.
 */
@Injectable({ providedIn: 'root' })
export class MotDePasseService {
  private readonly http = inject(HttpClient);

  /** Demande un lien par e-mail. La réponse est la même que le compte existe ou non. */
  demanderLien(email: string): Observable<ReponseMessage> {
    return this.http.post<ReponseMessage>('/api/mot-de-passe-oublie', { email });
  }

  /** Vérifie qu'un lien est encore utilisable (400 + code sinon) */
  verifierLien(token: string): Observable<{ valide: true }> {
    return this.http.post<{ valide: true }>('/api/reinitialiser-mot-de-passe/verifier', { token });
  }

  /** Enregistre le nouveau mot de passe ; le lien ne pourra plus resservir */
  reinitialiser(token: string, motDePasse: string): Observable<ReponseMessage> {
    return this.http.post<ReponseMessage>('/api/reinitialiser-mot-de-passe', {
      token,
      mot_de_passe: motDePasse,
    });
  }
}
