import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import {
  DonneesInscription,
  ReponseConnexion,
  Role,
  Utilisateur,
} from '../models/utilisateur';

/** Clé du token dans le localStorage du navigateur */
const CLE_TOKEN = 'vg_token';

/** Page d'accueil de chaque espace, selon le rôle */
const ESPACE_PAR_ROLE: Record<Role, string> = {
  utilisateur: '/espace-utilisateur',
  employe: '/espace-employe',
  administrateur: '/espace-admin',
};

/** Contenu (payload) d'un JWT : l'utilisateur + la date d'expiration */
interface PayloadJwt extends Utilisateur {
  exp: number; // en secondes depuis le 01/01/1970
}

/**
 * Gère la session de l'utilisateur côté front.
 *
 * Le serveur ne garde aucune session (JWT « stateless ») : le front conserve
 * le token, l'envoie à chaque requête (voir auth.interceptor.ts) et lit
 * l'utilisateur dans son contenu. L'utilisateur courant est un signal :
 * tous les composants qui le lisent (header, guards...) se mettent à jour
 * automatiquement à la connexion et à la déconnexion.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Au démarrage, on reprend la session si un token valide est déjà stocké
  private readonly _token = signal<string | null>(lireTokenValide());

  /** Token brut, utilisé par l'intercepteur */
  readonly token = this._token.asReadonly();

  /** Utilisateur connecté, ou null (calculé à partir du token) */
  readonly utilisateur = computed<Utilisateur | null>(() => {
    const token = this._token();
    if (!token) {
      return null;
    }
    const { id, nom, prenom, email, role } = decoderPayload(token)!;
    return { id, nom, prenom, email, role };
  });

  readonly estConnecte = computed(() => this.utilisateur() !== null);

  /** Lien vers l'espace de l'utilisateur connecté (pour le header) */
  readonly lienEspace = computed(() => {
    const utilisateur = this.utilisateur();
    return utilisateur ? ESPACE_PAR_ROLE[utilisateur.role] : '/connexion';
  });

  connexion(email: string, motDePasse: string): Observable<Utilisateur> {
    return this.http
      .post<ReponseConnexion>('/api/connexion', { email, mot_de_passe: motDePasse })
      .pipe(
        tap((reponse) => {
          localStorage.setItem(CLE_TOKEN, reponse.token);
          this._token.set(reponse.token);
        }),
        map((reponse) => reponse.user),
      );
  }

  inscription(donnees: DonneesInscription): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>('/api/inscription', donnees);
  }

  /** Avec un JWT, se déconnecter = oublier le token côté client. */
  deconnexion(redirection = '/'): void {
    localStorage.removeItem(CLE_TOKEN);
    this._token.set(null);
    this.router.navigateByUrl(redirection);
  }

  /** Vrai si l'utilisateur connecté possède l'un des rôles donnés. */
  aLeRole(roles: readonly Role[]): boolean {
    const utilisateur = this.utilisateur();
    return utilisateur !== null && roles.includes(utilisateur.role);
  }

  /** Adresse de l'espace correspondant à un rôle */
  espaceDuRole(role: Role): string {
    return ESPACE_PAR_ROLE[role];
  }
}

/**
 * Lit le payload d'un JWT (la partie du milieu, encodée en base64url).
 * Ce n'est PAS une vérification de sécurité : seul le serveur, qui connaît
 * la clé secrète, peut vérifier la signature. Le front s'en sert seulement
 * pour l'affichage (prénom, rôle) et pour connaître la date d'expiration.
 */
function decoderPayload(token: string): PayloadJwt | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const octets = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
    // TextDecoder : les accents (ex. « Hélène ») sont encodés en UTF-8
    return JSON.parse(new TextDecoder().decode(octets)) as PayloadJwt;
  } catch {
    return null;
  }
}

/** Token stocké s'il est lisible et pas encore expiré ; sinon il est supprimé. */
function lireTokenValide(): string | null {
  const token = localStorage.getItem(CLE_TOKEN);
  if (!token) {
    return null;
  }
  const payload = decoderPayload(token);
  if (!payload || payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem(CLE_TOKEN);
    return null;
  }
  return token;
}
