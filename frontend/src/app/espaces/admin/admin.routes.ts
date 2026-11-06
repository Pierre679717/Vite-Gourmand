import { Routes } from '@angular/router';

/**
 * Routes de l'espace admin, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-admin.
 * Les sous-pages (commandes, profil...) s'ajouteront ici.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tableau-de-bord').then((m) => m.TableauDeBordAdmin),
  },
];
