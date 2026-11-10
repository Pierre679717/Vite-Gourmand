import { Routes } from '@angular/router';
import { roleGuard, visiteurGuard } from './core/auth/auth.guards';
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
    // Le titre précis (« Menu Gastronomique — ... ») est posé par le composant une fois le menu chargé
    path: 'menus/:id',
    title: 'Menu — Vite & Gourmand',
    loadComponent: () => import('./pages/menu-detail/menu-detail').then((m) => m.MenuDetail),
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

  // Authentification : réservée aux visiteurs (un connecté va vers son espace)
  {
    path: 'connexion',
    title: 'Connexion — Vite & Gourmand',
    canMatch: [visiteurGuard],
    loadComponent: () => import('./pages/connexion/connexion').then((m) => m.Connexion),
  },
  {
    path: 'inscription',
    title: 'Créer un compte — Vite & Gourmand',
    canMatch: [visiteurGuard],
    loadComponent: () => import('./pages/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'Mot de passe oublié — Vite & Gourmand',
    canMatch: [visiteurGuard],
    loadComponent: () =>
      import('./pages/mot-de-passe-oublie/mot-de-passe-oublie').then((m) => m.MotDePasseOublie),
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
