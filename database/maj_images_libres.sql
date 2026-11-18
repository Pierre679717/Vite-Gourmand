-- ================================================================
-- Vite & Gourmand — mise à jour des images des menus (bloc accessibilité)
-- À lancer UNE fois sur une base créée avant le 18/11/2026 (local, Railway).
-- Remplace les anciennes photos .jpg (droits non garantis) par des photos
-- libres en WebP et met à jour leurs textes alternatifs.
-- Idempotent : relancé, il réécrit les mêmes valeurs.
-- ================================================================
START TRANSACTION;

UPDATE menu_image SET chemin = 'assets/images/menus/gastronomique.webp',
    texte_alternatif = 'Tranches de magret de canard rosé, chou kale, pomme fondante et jus de cuisson'
  WHERE menu_id = 1 AND chemin LIKE 'assets/images/menus/gastronomique.%';
UPDATE menu_image SET chemin = 'assets/images/menus/traditionnel.webp',
    texte_alternatif = 'Haricots blancs mijotés avec de la viande confite, façon cassoulet, dans une assiette creuse'
  WHERE menu_id = 2 AND chemin LIKE 'assets/images/menus/traditionnel.%';
UPDATE menu_image SET chemin = 'assets/images/menus/mediterraneen.webp',
    texte_alternatif = 'Part de moussaka gratinée aux aubergines dans une assiette'
  WHERE menu_id = 3 AND chemin LIKE 'assets/images/menus/mediterraneen.%';
UPDATE menu_image SET chemin = 'assets/images/menus/vegetarien.webp',
    texte_alternatif = 'Bowl végétarien : pois chiches rôtis et feta, tomates cerises, edamame, épinards et kaki'
  WHERE menu_id = 4 AND chemin LIKE 'assets/images/menus/vegetarien.%';
UPDATE menu_image SET chemin = 'assets/images/menus/vegan.webp',
    texte_alternatif = 'Bowl vegan : avocat, pois chiches, patate douce, tomates cerises, chou rouge et salade'
  WHERE menu_id = 5 AND chemin LIKE 'assets/images/menus/vegan.%';
UPDATE menu_image SET chemin = 'assets/images/menus/sans-porc.webp',
    texte_alternatif = 'Soupe de poissons et grosse crevette, avec un croûton à la rouille'
  WHERE menu_id = 6 AND chemin LIKE 'assets/images/menus/sans-porc.%';
UPDATE menu_image SET chemin = 'assets/images/menus/exotique.webp',
    texte_alternatif = 'Curry de poulet à la menthe, servi avec un riz aux carottes'
  WHERE menu_id = 7 AND chemin LIKE 'assets/images/menus/exotique.%';
UPDATE menu_image SET chemin = 'assets/images/menus/noel.webp',
    texte_alternatif = 'Table de fête aux chandelles avec une dinde rôtie, des pommes de terre et du chou rouge'
  WHERE menu_id = 8 AND chemin LIKE 'assets/images/menus/noel.%';
UPDATE menu_image SET chemin = 'assets/images/menus/paques.webp',
    texte_alternatif = 'Côtelettes d''agneau rôties aux herbes sur un plateau en bois'
  WHERE menu_id = 9 AND chemin LIKE 'assets/images/menus/paques.%';
UPDATE menu_image SET chemin = 'assets/images/menus/prestige.webp',
    texte_alternatif = 'Tranches de bœuf rosé sur un lit de roquette, sauce au vin'
  WHERE menu_id = 10 AND chemin LIKE 'assets/images/menus/prestige.%';

COMMIT;

-- Contrôle : 10 lignes, toutes en .webp
SELECT menu_id, chemin FROM menu_image ORDER BY menu_id;
