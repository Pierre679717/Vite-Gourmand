import { Routes } from '@angular/router';

/**
 * Routes de l'espace utilisateur, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-utilisateur.
 */
export const UTILISATEUR_ROUTES: Routes = [
  {
    // Page d'accueil de l'espace : la liste « Mes commandes »
    path: '',
    title: 'Mes commandes — Vite & Gourmand',
    loadComponent: () => import('./mes-commandes/mes-commandes').then((m) => m.MesCommandes),
  },
  {
    // Le titre précis (« Commande VG-2026-0014 — ... ») est posé par le composant
    path: 'commandes/:id',
    title: 'Ma commande — Vite & Gourmand',
    loadComponent: () => import('./mes-commandes/commande-detail').then((m) => m.CommandeDetail),
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
