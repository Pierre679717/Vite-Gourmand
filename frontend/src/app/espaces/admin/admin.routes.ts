import { Routes } from '@angular/router';

/**
 * Routes de l'espace administrateur, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-admin.
 * Pour les commandes, les avis et le catalogue, l'administrateur utilise
 * les pages de l'espace employé (/espace-employe/...), qui lui sont ouvertes.
 */
export const ADMIN_ROUTES: Routes = [
  // /espace-admin mène aux statistiques (lien « Mon espace » du header)
  { path: '', pathMatch: 'full', redirectTo: 'statistiques' },
  {
    // Filtres dans l'URL : /espace-admin/statistiques?menu_id=2&debut=2026-10-01&fin=2026-10-31
    path: 'statistiques',
    title: 'Statistiques — Espace administrateur — Vite & Gourmand',
    loadComponent: () =>
      import('./statistiques/statistiques-admin').then((m) => m.StatistiquesAdmin),
  },
  {
    path: 'employes',
    title: 'Employés — Espace administrateur — Vite & Gourmand',
    loadComponent: () => import('./employes/employes-admin').then((m) => m.EmployesAdmin),
  },
];
