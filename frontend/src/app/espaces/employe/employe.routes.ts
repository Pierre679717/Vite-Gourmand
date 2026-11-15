import { Routes } from '@angular/router';

/**
 * Routes de l'espace employé, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-employe.
 * L'administrateur y a aussi accès (roleGuard dans app.routes.ts).
 * Partie 2 du bloc : menus, plats et horaires s'ajouteront ici.
 */
export const EMPLOYE_ROUTES: Routes = [
  // /espace-employe mène à la liste des commandes (lien « Mon espace » du header)
  { path: '', pathMatch: 'full', redirectTo: 'commandes' },
  {
    // Filtres dans l'URL : /espace-employe/commandes?statut=livre&client=martin
    path: 'commandes',
    title: 'Commandes — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./commandes/commandes-employe').then((m) => m.CommandesEmploye),
  },
  {
    // Le titre précis (« Commande VG-2026-0013 — ... ») est posé par le composant
    path: 'commandes/:id',
    title: 'Commande — Espace employé — Vite & Gourmand',
    loadComponent: () =>
      import('./commandes/detail-commande-employe').then((m) => m.DetailCommandeEmploye),
  },
  {
    path: 'avis',
    title: 'Avis clients — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./avis/moderation-avis').then((m) => m.ModerationAvis),
  },
];
