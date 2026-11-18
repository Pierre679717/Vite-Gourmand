import { CategoriePlat } from './menu';

/**
 * Types de la gestion du catalogue par l'employé, calqués sur les
 * réponses de l'API (backend/models/catalogue.model.js).
 */

// ---------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------

/** Une ligne de GET /api/employe/menus (menus sur la carte ou non) */
export interface MenuGestion {
  menu_id: number;
  titre: string;
  /** 1 = sur la carte, 0 = retiré de la carte (TINYINT MySQL) */
  actif: number;
  nombre_personne_min: number;
  prix_par_personne: number;
  prix_minimum: number;
  quantite_restante: number;
  theme: string;
  regime: string;
  nombre_plats: number;
  /** Un menu déjà commandé ne peut pas être supprimé, seulement retiré de la carte */
  nombre_commandes: number;
}

/** Ce que le formulaire envoie : POST et PUT /api/employe/menus */
export interface DonneesMenu {
  titre: string;
  description: string;
  conditions: string;
  nombre_personne_min: number;
  delai_minimum_jours: number;
  prix_par_personne: number;
  quantite_restante: number;
  theme_id: number;
  regime_id: number;
  /** Identifiants des plats qui composent le menu */
  plats: number[];
}

/** GET /api/employe/menus/:id : le menu à modifier */
export interface MenuEdition extends DonneesMenu {
  menu_id: number;
  actif: number;
  nombre_commandes: number;
}

export interface OptionLibelle {
  libelle: string;
}

/** GET /api/employe/menus/options : les choix du formulaire */
export interface OptionsMenu {
  themes: (OptionLibelle & { theme_id: number })[];
  regimes: (OptionLibelle & { regime_id: number })[];
  plats: { plat_id: number; titre: string; categorie: CategoriePlat }[];
}

// ---------------------------------------------------------------------
// Plats et allergènes
// ---------------------------------------------------------------------

export interface Allergene {
  allergene_id: number;
  libelle: string;
}

/** Une ligne de GET /api/employe/plats */
export interface PlatGestion {
  plat_id: number;
  titre: string;
  categorie: CategoriePlat;
  allergenes: Allergene[];
  /** Menus qui utilisent ce plat (s'il y en a, il ne peut pas être supprimé) */
  menus: { menu_id: number; titre: string }[];
}

/** POST et PUT /api/employe/plats */
export interface DonneesPlat {
  titre: string;
  categorie: CategoriePlat;
  /** Identifiants des allergènes (liste vide = aucun) */
  allergenes: number[];
}

/** GET /api/employe/plats/:id */
export interface PlatEdition extends DonneesPlat {
  plat_id: number;
}

// ---------------------------------------------------------------------
// Horaires et réponses
// ---------------------------------------------------------------------

export type Jour = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

/** Un jour : GET /api/horaires et PUT /api/employe/horaires (heures à null = fermé) */
export interface Horaire {
  jour: Jour;
  heure_ouverture: string | null;
  heure_fermeture: string | null;
}

/** Réponse des écritures du catalogue */
export interface ReponseCatalogue {
  message: string;
  menu_id?: number;
  plat_id?: number;
  actif?: boolean;
  horaires?: Horaire[];
}
