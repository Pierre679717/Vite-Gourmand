import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Role } from '../models/utilisateur';
import { AuthService } from './auth.service';

/**
 * Guard par rôle, utilisé avec canMatch sur les espaces.
 *
 * canMatch (plutôt que canActivate) : si l'accès est refusé, la route ne
 * « correspond » pas et son code chargé à la demande n'est même pas
 * téléchargé par le navigateur.
 *
 * - Visiteur non connecté -> page de connexion, avec l'adresse demandée
 *   (et ses paramètres) dans ?retour=... pour l'y renvoyer après la connexion.
 * - Connecté mais sans le bon rôle -> son propre espace.
 *
 * Ce guard améliore la navigation, mais la vraie protection reste côté
 * serveur : chaque route de l'API vérifie le JWT et le rôle.
 */
export function roleGuard(...roles: Role[]): CanMatchFn {
  return (_route, segments) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const utilisateur = auth.utilisateur();

    if (!utilisateur) {
      // Adresse demandée, avec ses paramètres (?personnes=8...) : on y revient après la connexion
      const parametres = router.currentNavigation()?.extractedUrl.queryParams ?? {};
      const retour = router.serializeUrl(
        router.createUrlTree(['/', ...segments.map((segment) => segment.path)], {
          queryParams: parametres,
        }),
      );
      return router.createUrlTree(['/connexion'], { queryParams: { retour } });
    }
    if (!roles.includes(utilisateur.role)) {
      return router.createUrlTree([auth.espaceDuRole(utilisateur.role)]);
    }
    return true;
  };
}

/**
 * Pages réservées aux visiteurs (connexion, inscription) :
 * un utilisateur déjà connecté est renvoyé vers son espace.
 */
export const visiteurGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const utilisateur = auth.utilisateur();
  return utilisateur ? inject(Router).createUrlTree([auth.espaceDuRole(utilisateur.role)]) : true;
};
