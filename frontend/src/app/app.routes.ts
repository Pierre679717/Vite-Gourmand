import { Routes } from '@angular/router';
import { roleGuard } from './core/auth/auth.guards';
import { Accueil } from './pages/accueil/accueil';

/**
 * Table des routes de l'application.
 * - L'accueil est chargé immédiatement (première page vue).
 * - Les autres pages et les trois espaces sont chargés à la demande
 *   (loadComponent / loadChildren) : chacun devient un fichier JavaScript
 *   séparé, téléchargé seulement quand on y navigue.
 * - « title » met à jour le titre de l'onglet du navigateur.
 */
export const routes: Routes = [
  { path: '', component: Accueil, title: 'Vite & Gourmand — Traiteur à Bordeaux' },
  {
    path: 'menus',
    title: 'Nos menus — Vite & Gourmand',
    loadComponent: () => import('./pages/menus/menus').then((m) => m.Menus),
  },
  {
    path: 'contact',
    title: 'Contact — Vite & Gourmand',
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'mentions-legales',
    title: 'Mentions légales — Vite & Gourmand',
    loadComponent: () =>
      import('./pages/mentions-legales/mentions-legales').then((m) => m.MentionsLegales),
  },
  {
    path: 'cgv',
    title: 'Conditions générales de vente — Vite & Gourmand',
    loadComponent: () => import('./pages/cgv/cgv').then((m) => m.Cgv),
  },

  // Espaces réservés : le guard vérifie le rôle avant même de télécharger le code
  {
    path: 'espace-utilisateur',
    title: 'Mon espace — Vite & Gourmand',
    canMatch: [roleGuard('utilisateur')],
    loadChildren: () =>
      import('./espaces/utilisateur/utilisateur.routes').then((m) => m.UTILISATEUR_ROUTES),
  },
  {
    path: 'espace-employe',
    title: 'Espace employé — Vite & Gourmand',
    // L'administrateur a aussi accès aux fonctions employé (comme côté API)
    canMatch: [roleGuard('employe', 'administrateur')],
    loadChildren: () => import('./espaces/employe/employe.routes').then((m) => m.EMPLOYE_ROUTES),
  },
  {
    path: 'espace-admin',
    title: 'Espace administrateur — Vite & Gourmand',
    canMatch: [roleGuard('administrateur')],
    loadChildren: () => import('./espaces/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  // Toute autre adresse : page 404 (doit rester en dernier)
  {
    path: '**',
    title: 'Page introuvable — Vite & Gourmand',
    loadComponent: () =>
      import('./pages/page-introuvable/page-introuvable').then((m) => m.PageIntrouvable),
  },
];
