import { Routes } from '@angular/router';

/**
 * Routes de l'espace utilisateur, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-utilisateur.
 * Les sous-pages (commandes, profil...) s'ajouteront ici.
 */
export const UTILISATEUR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tableau-de-bord').then((m) => m.TableauDeBordUtilisateur),
  },
  {
    // Bouton « Commander ce menu » de la page détail (?personnes=N)
    path: 'commander/:menuId',
    title: 'Commander — Vite & Gourmand',
    loadComponent: () => import('./commande/commande').then((m) => m.Commande),
  },
  {
    path: 'commande-confirmee/:numero',
    title: 'Commande enregistrée — Vite & Gourmand',
    loadComponent: () => import('./commande/commande-confirmee').then((m) => m.CommandeConfirmee),
  },
];
