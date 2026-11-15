import { Routes } from '@angular/router';

/**
 * Routes de l'espace employé, chargées à la demande (lazy loading) :
 * ce code n'est téléchargé que lorsqu'on visite /espace-employe.
 * L'administrateur y a aussi accès (roleGuard dans app.routes.ts).
 * Catalogue (partie 2) : menus, plats et horaires.
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
  // ---- Catalogue : menus (« nouveau » déclaré avant « :id ») ----
  {
    path: 'menus',
    title: 'Menus — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/menus-gestion').then((m) => m.MenusGestion),
  },
  {
    path: 'menus/nouveau',
    title: 'Nouveau menu — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/menu-formulaire').then((m) => m.MenuFormulaire),
  },
  {
    path: 'menus/:id',
    title: 'Modifier un menu — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/menu-formulaire').then((m) => m.MenuFormulaire),
  },
  // ---- Catalogue : plats et allergènes ----
  {
    path: 'plats',
    title: 'Plats — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/plats-gestion').then((m) => m.PlatsGestion),
  },
  {
    path: 'plats/nouveau',
    title: 'Nouveau plat — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/plat-formulaire').then((m) => m.PlatFormulaire),
  },
  {
    path: 'plats/:id',
    title: 'Modifier un plat — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/plat-formulaire').then((m) => m.PlatFormulaire),
  },
  // ---- Catalogue : horaires ----
  {
    path: 'horaires',
    title: 'Horaires — Espace employé — Vite & Gourmand',
    loadComponent: () => import('./catalogue/horaires-gestion').then((m) => m.HorairesGestion),
  },
];
