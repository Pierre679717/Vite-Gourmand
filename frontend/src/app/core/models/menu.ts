/**
 * Types des menus, calqués sur les réponses de l'API
 * (voir backend/models/menu.model.js).
 */

/** Un menu dans la liste : GET /api/menus */
export interface MenuResume {
  menu_id: number;
  titre: string;
  description: string;
  nombre_personne_min: number;
  prix_par_personne: number;
  /** Prix pour le nombre minimum de personnes (calculé par le serveur) */
  prix_minimum: number;
  conditions: string;
  quantite_restante: number;
  theme: string;
  regime: string;
  theme_id: number;
  regime_id: number;
  /** Image principale (ordre 1 de la galerie), ou null s'il n'y en a pas */
  image: string | null;
  image_alt: string | null;
}

/** Le menu dans la réponse du détail (sans image, ni identifiants de thème/régime) */
export type MenuInfos = Omit<MenuResume, 'image' | 'image_alt' | 'theme_id' | 'regime_id'>;

export interface ImageMenu {
  image_id: number;
  chemin: string;
  texte_alternatif: string;
  ordre: number;
}

export type CategoriePlat = 'entree' | 'plat' | 'dessert';

export interface Plat {
  plat_id: number;
  titre: string;
  categorie: CategoriePlat;
  photo: string | null;
  allergenes: string[];
}

/** Détail d'un menu : GET /api/menus/:id */
export interface MenuDetail {
  menu: MenuInfos;
  images: ImageMenu[];
  plats: Plat[];
}

/** Un thème ou un régime, pour les listes déroulantes */
export interface OptionFiltre {
  id: number;
  libelle: string;
}

/** Options de la barre de filtres : GET /api/menus/filtres */
export interface OptionsFiltres {
  themes: OptionFiltre[];
  regimes: OptionFiltre[];
  /** Bornes calculées sur les menus actifs (null s'il n'y a aucun menu) */
  prix_min: number | null;
  prix_max: number | null;
  personnes_min: number | null;
}

/**
 * Filtres envoyés à GET /api/menus.
 * Les noms correspondent aux paramètres de l'URL attendus par le serveur.
 * Une clé absente = pas de filtre sur ce critère.
 */
export interface FiltresMenus {
  prix_min?: number;
  prix_max?: number;
  theme?: number;
  regime?: number;
  personnes?: number;
}
