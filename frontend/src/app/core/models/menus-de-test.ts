import { MenuResume } from './menu';

/**
 * Menus de test, proches des données de la base (database/vite_gourmand.sql).
 * Utilisés uniquement par les fichiers *.spec.ts.
 */
export const MENU_GASTRO: MenuResume = {
  menu_id: 1,
  titre: 'Menu Gastronomique',
  description: 'Foie gras maison, magret de canard et dessert au chocolat grand cru.',
  nombre_personne_min: 6,
  delai_minimum_jours: 7,
  prix_par_personne: 65,
  prix_minimum: 390,
  conditions: 'À commander 7 jours avant.',
  quantite_restante: 10,
  theme: 'Évènement',
  regime: 'Classique',
  theme_id: 4,
  regime_id: 1,
  image: 'assets/images/menus/gastronomique.jpg',
  image_alt: 'Magret de canard',
};

export const MENU_PAQUES_EPUISE: MenuResume = {
  ...MENU_GASTRO,
  menu_id: 9,
  titre: 'Menu de Pâques Terre et Mer',
  prix_par_personne: 58,
  prix_minimum: 348,
  quantite_restante: 0,
  theme: 'Pâques',
  theme_id: 2,
  image: 'assets/images/menus/paques.jpg',
  image_alt: 'Plateau de fruits de mer',
};
