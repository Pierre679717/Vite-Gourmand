import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Intercepteur HTTP : s'exécute avant chaque requête envoyée avec HttpClient.
 *
 * 1. Ajoute l'en-tête « Authorization: Bearer <token> » si l'utilisateur
 *    est connecté, UNIQUEMENT vers notre API (/api/...) : le token ne doit
 *    jamais partir vers un site tiers (ex. l'API Adresse du gouvernement).
 * 2. Si l'API répond 401 alors qu'un token a été envoyé, c'est qu'il a expiré
 *    ou qu'il est invalide : on déconnecte et on renvoie vers la connexion.
 */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (!token || !requete.url.startsWith('/api/')) {
    return suivant(requete);
  }

  const requeteAvecToken = requete.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return suivant(requeteAvecToken).pipe(
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && erreur.status === 401) {
        auth.deconnexion('/connexion');
      }
      return throwError(() => erreur);
    }),
  );
};
