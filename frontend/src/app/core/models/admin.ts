/**
 * Types de l'espace administrateur, calqués sur les réponses de l'API
 * (backend/controllers/admin.controller.js et utils/filtresStats.js).
 */

// ---------------------------------------------------------------------
// Comptes employés
// ---------------------------------------------------------------------

/** Une ligne de GET /api/admin/employes (jamais le mot de passe) */
export interface Employe {
  utilisateur_id: number;
  nom: string;
  prenom: string;
  email: string;
  /** 1 = peut se connecter, 0 = compte désactivé (TINYINT MySQL) */
  actif: number;
}

/** Corps de POST /api/admin/employes (le rôle n'est jamais envoyé) */
export interface NouvelEmploye {
  nom: string;
  prenom: string;
  /** Sert d'identifiant de connexion */
  email: string;
  mot_de_passe: string;
}

/** Réponse de POST /api/admin/employes et de PUT /api/admin/employes/:id/actif */
export interface ReponseEmploye {
  message: string;
  employe: Employe;
}

// ---------------------------------------------------------------------
// Statistiques (lues dans MongoDB par le serveur)
// ---------------------------------------------------------------------

/** Filtres de GET /api/admin/statistiques (un filtre absent n'est pas envoyé) */
export interface FiltresStats {
  menu_id?: number;
  /** AAAA-MM-JJ, jour de la commande inclus */
  debut?: string;
  fin?: string;
}

/** Une ligne par menu commandé */
export interface StatMenu {
  menu_id: number;
  menu_titre: string;
  /** Commandes non annulées */
  nombre_commandes: number;
  nombre_annulees: number;
  /** Somme des prix des commandes non annulées, en euros */
  chiffre_affaires: number;
}

export interface TotauxStats {
  nombre_commandes: number;
  nombre_annulees: number;
  chiffre_affaires: number;
}

/** GET /api/admin/statistiques */
export interface Statistiques {
  filtres: { menu_id: number | null; debut: string | null; fin: string | null };
  menus: StatMenu[];
  totaux: TotauxStats;
}
