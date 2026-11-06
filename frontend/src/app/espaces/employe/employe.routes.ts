import { Routes } from '@angular/router';

/**
 * Routes de l'espace employe, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-employe.
 * Les sous-pages (commandes, profil...) s'ajouteront ici.
 */
export const EMPLOYE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tableau-de-bord').then((m) => m.TableauDeBordEmploye),
  },
];
