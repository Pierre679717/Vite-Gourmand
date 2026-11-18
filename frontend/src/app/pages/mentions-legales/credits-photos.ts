/**
 * Crédits des photographies du site (page Mentions légales).
 * Toutes les photos sont libres de droits : licence Unsplash ou licence Pexels.
 * Ces licences n'imposent pas de citer l'auteur, mais nous le faisons par respect
 * de son travail et pour prouver l'origine de chaque image.
 */
export interface CreditPhoto {
  /** Où la photo est utilisée sur le site */
  usage: string;
  /** Ce que montre la photo (texte du lien vers sa page) */
  sujet: string;
  auteur: string;
  site: 'Unsplash' | 'Pexels';
  /** Page de la photo sur le site d'origine */
  lien: string;
  /** Fichier dans frontend/public/assets/images/ */
  fichier: string;
}

export const CREDITS_PHOTOS: readonly CreditPhoto[] = [
  {
    usage: "Bandeau de l'accueil",
    sujet: 'Tables dressées dans une salle de restaurant',
    auteur: 'Tanja Tepavac',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/elegant-dining-tables-set-in-a-cozy-restaurant-interior-jSH-7IjJVsQ',
    fichier: 'accueil/salle.webp',
  },
  {
    usage: 'Notre maison (accueil)',
    sujet: 'Un homme et une femme qui cuisinent ensemble',
    auteur: 'Becca Tapert',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/man-and-woman-on-kitchen-O7sK3d3TPWQ',
    fichier: 'accueil/julie-jose.webp',
  },
  {
    usage: 'Menu Gastronomique',
    sujet: 'Magret de canard rosé et chou kale',
    auteur: 'Sebastian Coman Photography',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/cooked-food-on-white-ceramic-plate-CRoAeTh5S_I',
    fichier: 'menus/gastronomique.webp',
  },
  {
    usage: 'Menu Traditionnel',
    sujet: 'Haricots blancs mijotés avec de la viande',
    auteur: 'Boryslav Shoot',
    site: 'Pexels',
    lien: 'https://www.pexels.com/photo/baked-beans-with-meat-19870148/',
    fichier: 'menus/traditionnel.webp',
  },
  {
    usage: 'Menu Méditerranéen',
    sujet: 'Part de moussaka aux aubergines',
    auteur: 'Nano Erdozain',
    site: 'Pexels',
    lien: 'https://www.pexels.com/photo/delicious-homemade-eggplant-moussaka-on-plate-29535638/',
    fichier: 'menus/mediterraneen.webp',
  },
  {
    usage: 'Menu Végétarien',
    sujet: 'Bowl de pois chiches, légumes et feta',
    auteur: 'Charlotte Karlsen',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/bowl-of-variety-of-food-yz0yUM6IZ4k',
    fichier: 'menus/vegetarien.webp',
  },
  {
    usage: 'Menu Vegan',
    sujet: "Bowl vegan à l'avocat et à la patate douce",
    auteur: 'Anna Pelzer',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/IGfIGP5ONV0',
    fichier: 'menus/vegan.webp',
  },
  {
    usage: 'Menu Sans porc',
    sujet: 'Soupe de poissons et crevette',
    auteur: 'henry perks',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/cooked-food-on-brown-ceramic-plate-8ni7LN6vaQ8',
    fichier: 'menus/sans-porc.webp',
  },
  {
    usage: 'Menu Exotique',
    sujet: 'Curry de poulet et riz',
    auteur: 'Imad 786',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/chicken-curry-and-rice-with-fresh-herbs-gk7XY0YWg-Q',
    fichier: 'menus/exotique.webp',
  },
  {
    usage: 'Menu de Noël',
    sujet: 'Table de fête avec une dinde rôtie',
    auteur: 'Noah Samuel Franz',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/a-table-with-food-and-drinks-on-it-H_Uu6LC83SU',
    fichier: 'menus/noel.webp',
  },
  {
    usage: 'Menu de Pâques',
    sujet: "Côtelettes d'agneau rôties aux herbes",
    auteur: 'Snappr',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/a-plate-of-food-on-a-wooden-table-wqsUZB9D0Lk',
    fichier: 'menus/paques.webp',
  },
  {
    usage: 'Menu Prestige',
    sujet: 'Tranches de bœuf rosé sur roquette',
    auteur: 'Jason Leung',
    site: 'Unsplash',
    lien: 'https://unsplash.com/photos/O67LZfeyYBk',
    fichier: 'menus/prestige.webp',
  },
];
