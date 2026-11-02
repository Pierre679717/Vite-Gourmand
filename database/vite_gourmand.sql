-- ================================================================
-- VITE & GOURMAND - Base de données MySQL
-- ================================================================
-- Projet  : Vite & Gourmand - traiteur à Bordeaux (ECF Studi)
-- Auteur  : Anoman Pierre MANOUAN
-- Version : 2.0 (novembre 2026) - modèle de données refait (MLD v1)
-- SGBD    : MySQL 8.0.16 ou plus (contraintes CHECK appliquées)
--
-- Contenu :
--   1. Création de la base
--   2. Création des 15 tables (InnoDB, utf8mb4)
--   3. Données de test réalistes
--
-- Rejouer le script depuis zéro :
--   sudo mysql -e "DROP DATABASE IF EXISTS vite_gourmand;"
--   sudo mysql < database/vite_gourmand.sql
-- ================================================================


-- ================================================================
-- 1. BASE DE DONNÉES
-- ================================================================
CREATE DATABASE IF NOT EXISTS vite_gourmand
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vite_gourmand;

-- Supprimer les tables existantes pour pouvoir rejouer le script.
-- On désactive les clés étrangères le temps de la suppression,
-- sinon MySQL refuse de supprimer une table référencée par une autre.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS token_reinitialisation, horaire, avis, suivi_commande,
    commande, plat_allergene, allergene, menu_plat, plat, menu_image,
    menu, regime, theme, utilisateur, role;
SET FOREIGN_KEY_CHECKS = 1;


-- ================================================================
-- 2. CRÉATION DES TABLES
-- Ordre : d'abord les tables sans clé étrangère, puis celles qui
-- en dépendent (une FK ne peut pointer que vers une table existante).
-- ================================================================

-- ----------------------------------------------------------------
-- role : utilisateur, employe, administrateur
-- ----------------------------------------------------------------
CREATE TABLE role (
    role_id  INT AUTO_INCREMENT PRIMARY KEY,
    libelle  VARCHAR(30) NOT NULL,
    CONSTRAINT uq_role_libelle UNIQUE (libelle)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- utilisateur : comptes clients, employés et administrateur
-- Pas de suppression physique : on désactive le compte (actif = 0).
-- ----------------------------------------------------------------
CREATE TABLE utilisateur (
    utilisateur_id   INT AUTO_INCREMENT PRIMARY KEY,
    nom              VARCHAR(50)  NOT NULL,
    prenom           VARCHAR(50)  NOT NULL,
    email            VARCHAR(254) NOT NULL,
    telephone        VARCHAR(20)  NOT NULL,
    adresse_postale  VARCHAR(255) NOT NULL,
    code_postal      VARCHAR(5)   NOT NULL,
    ville            VARCHAR(100) NOT NULL,
    mot_de_passe     VARCHAR(255) NOT NULL,          -- empreinte bcrypt, jamais le mot de passe en clair
    actif            TINYINT(1)   NOT NULL DEFAULT 1,
    role_id          INT          NOT NULL,
    CONSTRAINT uq_utilisateur_email UNIQUE (email),
    CONSTRAINT fk_utilisateur_role FOREIGN KEY (role_id) REFERENCES role (role_id),
    CONSTRAINT ck_utilisateur_code_postal CHECK (code_postal REGEXP '^[0-9]{5}$')
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- theme : Noël, Pâques, Classique, Évènement
-- ----------------------------------------------------------------
CREATE TABLE theme (
    theme_id  INT AUTO_INCREMENT PRIMARY KEY,
    libelle   VARCHAR(50) NOT NULL,
    CONSTRAINT uq_theme_libelle UNIQUE (libelle)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- regime : Classique, Végétarien, Vegan, Sans porc
-- ----------------------------------------------------------------
CREATE TABLE regime (
    regime_id  INT AUTO_INCREMENT PRIMARY KEY,
    libelle    VARCHAR(50) NOT NULL,
    CONSTRAINT uq_regime_libelle UNIQUE (libelle)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- menu : on stocke le prix PAR PERSONNE.
-- Prix minimum affiché = prix_par_personne x nombre_personne_min.
-- quantite_restante = stock (nombre de commandes encore possibles).
-- ----------------------------------------------------------------
CREATE TABLE menu (
    menu_id              INT AUTO_INCREMENT PRIMARY KEY,
    titre                VARCHAR(100)  NOT NULL,
    description          TEXT          NOT NULL,
    nombre_personne_min  INT           NOT NULL,
    prix_par_personne    DECIMAL(6,2)  NOT NULL,
    conditions           TEXT          NOT NULL,
    quantite_restante    INT           NOT NULL DEFAULT 0,
    actif                TINYINT(1)    NOT NULL DEFAULT 1,
    theme_id             INT           NOT NULL,
    regime_id            INT           NOT NULL,
    CONSTRAINT uq_menu_titre UNIQUE (titre),
    CONSTRAINT fk_menu_theme  FOREIGN KEY (theme_id)  REFERENCES theme (theme_id),
    CONSTRAINT fk_menu_regime FOREIGN KEY (regime_id) REFERENCES regime (regime_id),
    CONSTRAINT ck_menu_personne_min CHECK (nombre_personne_min >= 1),
    CONSTRAINT ck_menu_prix         CHECK (prix_par_personne > 0),
    CONSTRAINT ck_menu_stock        CHECK (quantite_restante >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- menu_image : galerie d'images d'un menu (1 menu -> N images)
-- texte_alternatif obligatoire pour l'accessibilité (RGAA).
-- ----------------------------------------------------------------
CREATE TABLE menu_image (
    image_id          INT AUTO_INCREMENT PRIMARY KEY,
    chemin            VARCHAR(255) NOT NULL,
    texte_alternatif  VARCHAR(255) NOT NULL,
    ordre             INT          NOT NULL DEFAULT 1,
    menu_id           INT          NOT NULL,
    CONSTRAINT uq_menu_image_ordre UNIQUE (menu_id, ordre),
    CONSTRAINT fk_menu_image_menu FOREIGN KEY (menu_id) REFERENCES menu (menu_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- plat : un plat existe une seule fois, même s'il est dans plusieurs menus
-- ----------------------------------------------------------------
CREATE TABLE plat (
    plat_id    INT AUTO_INCREMENT PRIMARY KEY,
    titre      VARCHAR(150) NOT NULL,
    categorie  ENUM('entree', 'plat', 'dessert') NOT NULL,
    photo      VARCHAR(255) DEFAULT NULL,
    CONSTRAINT uq_plat_titre UNIQUE (titre)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- menu_plat : table d'association menu <-> plat (relation N:N)
-- La clé primaire composée empêche d'ajouter deux fois le même plat.
-- ----------------------------------------------------------------
CREATE TABLE menu_plat (
    menu_id  INT NOT NULL,
    plat_id  INT NOT NULL,
    PRIMARY KEY (menu_id, plat_id),
    CONSTRAINT fk_menu_plat_menu FOREIGN KEY (menu_id) REFERENCES menu (menu_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_menu_plat_plat FOREIGN KEY (plat_id) REFERENCES plat (plat_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- allergene : les 14 allergènes à déclaration obligatoire (règlement UE INCO)
-- ----------------------------------------------------------------
CREATE TABLE allergene (
    allergene_id  INT AUTO_INCREMENT PRIMARY KEY,
    libelle       VARCHAR(100) NOT NULL,
    CONSTRAINT uq_allergene_libelle UNIQUE (libelle)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- plat_allergene : table d'association plat <-> allergène (N:N)
-- ----------------------------------------------------------------
CREATE TABLE plat_allergene (
    plat_id       INT NOT NULL,
    allergene_id  INT NOT NULL,
    PRIMARY KEY (plat_id, allergene_id),
    CONSTRAINT fk_plat_allergene_plat FOREIGN KEY (plat_id) REFERENCES plat (plat_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_plat_allergene_allergene FOREIGN KEY (allergene_id) REFERENCES allergene (allergene_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- commande
-- Les prix sont FIGÉS au moment de la commande (comme une facture) :
-- si le prix du menu change ensuite, la commande garde son prix.
--   prix_menu      = prix_par_personne x nombre_personne - reduction
--   reduction      = 10 % si nombre_personne >= minimum du menu + 5
--   prix_livraison = 0 à Bordeaux, sinon 5 EUR + 0,59 EUR / km
--   prix_total     = prix_menu + prix_livraison
-- Un menu commandé ne peut pas être supprimé (ON DELETE RESTRICT) :
-- on le désactive (menu.actif = 0) pour garder l'historique.
-- ----------------------------------------------------------------
CREATE TABLE commande (
    commande_id         INT AUTO_INCREMENT PRIMARY KEY,
    numero_commande     VARCHAR(20)   NOT NULL,
    date_commande       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_prestation     DATE          NOT NULL,
    heure_livraison     TIME          NOT NULL,
    adresse_prestation  VARCHAR(255)  NOT NULL,
    ville_prestation    VARCHAR(100)  NOT NULL,
    distance_km         DECIMAL(6,2)  NOT NULL DEFAULT 0,
    nombre_personne     INT           NOT NULL,
    prix_par_personne   DECIMAL(6,2)  NOT NULL,
    reduction           DECIMAL(8,2)  NOT NULL DEFAULT 0,
    prix_menu           DECIMAL(8,2)  NOT NULL,
    prix_livraison      DECIMAL(8,2)  NOT NULL DEFAULT 0,
    prix_total          DECIMAL(8,2)  NOT NULL,
    statut              ENUM(
                            'en_attente',
                            'accepte',
                            'en_preparation',
                            'en_cours_livraison',
                            'livre',
                            'attente_retour_materiel',
                            'terminee',
                            'annulee'
                        ) NOT NULL DEFAULT 'en_attente',
    pret_materiel       TINYINT(1)    NOT NULL DEFAULT 0,
    materiel_restitue   TINYINT(1)    NOT NULL DEFAULT 0,
    mode_contact        ENUM('gsm', 'mail') DEFAULT NULL,   -- renseigné par l'employé qui annule ou modifie
    motif               TEXT          DEFAULT NULL,
    utilisateur_id      INT           NOT NULL,
    menu_id             INT           NOT NULL,
    CONSTRAINT uq_commande_numero UNIQUE (numero_commande),
    CONSTRAINT fk_commande_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (utilisateur_id),
    CONSTRAINT fk_commande_menu        FOREIGN KEY (menu_id)        REFERENCES menu (menu_id),
    CONSTRAINT ck_commande_personne    CHECK (nombre_personne >= 1),
    CONSTRAINT ck_commande_distance    CHECK (distance_km >= 0),
    CONSTRAINT ck_commande_prix        CHECK (prix_menu >= 0 AND prix_livraison >= 0 AND reduction >= 0),
    CONSTRAINT ck_commande_total       CHECK (prix_total = prix_menu + prix_livraison),
    CONSTRAINT ck_commande_materiel    CHECK (materiel_restitue = 0 OR pret_materiel = 1)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- suivi_commande : historique des statuts d'une commande (date + heure)
-- employe_id est NULL quand c'est le client qui agit (création, annulation).
-- ----------------------------------------------------------------
CREATE TABLE suivi_commande (
    suivi_id         INT AUTO_INCREMENT PRIMARY KEY,
    statut           ENUM(
                         'en_attente',
                         'accepte',
                         'en_preparation',
                         'en_cours_livraison',
                         'livre',
                         'attente_retour_materiel',
                         'terminee',
                         'annulee'
                     ) NOT NULL,
    date_changement  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    commande_id      INT      NOT NULL,
    employe_id       INT      DEFAULT NULL,
    CONSTRAINT fk_suivi_commande FOREIGN KEY (commande_id) REFERENCES commande (commande_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_suivi_employe  FOREIGN KEY (employe_id)  REFERENCES utilisateur (utilisateur_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- avis : un seul avis par commande (commande_id UNIQUE).
-- Seuls les avis 'valide' sont affichés sur la page d'accueil.
-- ----------------------------------------------------------------
CREATE TABLE avis (
    avis_id         INT AUTO_INCREMENT PRIMARY KEY,
    note            TINYINT  NOT NULL,
    commentaire     TEXT     NOT NULL,
    statut          ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'en_attente',
    date_creation   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    commande_id     INT      NOT NULL,
    utilisateur_id  INT      NOT NULL,
    CONSTRAINT uq_avis_commande UNIQUE (commande_id),
    CONSTRAINT fk_avis_commande    FOREIGN KEY (commande_id)    REFERENCES commande (commande_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_avis_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (utilisateur_id),
    CONSTRAINT ck_avis_note CHECK (note BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- horaire : un enregistrement par jour, affiché dans le pied de page.
-- Heures à NULL = fermé ce jour-là.
-- ----------------------------------------------------------------
CREATE TABLE horaire (
    horaire_id       INT AUTO_INCREMENT PRIMARY KEY,
    jour             ENUM('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche') NOT NULL,
    heure_ouverture  TIME DEFAULT NULL,
    heure_fermeture  TIME DEFAULT NULL,
    CONSTRAINT uq_horaire_jour UNIQUE (jour),
    CONSTRAINT ck_horaire_heures CHECK (
        (heure_ouverture IS NULL AND heure_fermeture IS NULL)
        OR (heure_ouverture IS NOT NULL AND heure_fermeture IS NOT NULL
            AND heure_fermeture > heure_ouverture)
    )
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- token_reinitialisation : mot de passe oublié.
-- On ne stocke que l'empreinte SHA-256 du jeton (64 caractères hexa) :
-- une fuite de la base ne permet pas de réinitialiser un compte.
-- ----------------------------------------------------------------
CREATE TABLE token_reinitialisation (
    token_id        INT AUTO_INCREMENT PRIMARY KEY,
    token_hash      CHAR(64)   NOT NULL,
    expire_le       DATETIME   NOT NULL,
    utilise         TINYINT(1) NOT NULL DEFAULT 0,
    utilisateur_id  INT        NOT NULL,
    CONSTRAINT uq_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_token_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (utilisateur_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


-- ================================================================
-- 3. DONNÉES DE TEST
-- Les identifiants sont écrits explicitement pour que les clés
-- étrangères ci-dessous soient faciles à relire.
-- ================================================================

-- ----------------------------------------------------------------
-- Rôles
-- ----------------------------------------------------------------
INSERT INTO role (role_id, libelle) VALUES
(1, 'utilisateur'),
(2, 'employe'),
(3, 'administrateur');

-- ----------------------------------------------------------------
-- Utilisateurs
-- Comptes de test (mots de passe conformes à la politique :
-- 10 caractères, majuscule, minuscule, chiffre, caractère spécial) :
--   admin@vite-gourmand.fr        Admin#Gourmand2026
--   employe@vite-gourmand.fr      Employe#Gourmand2026
--   utilisateur@vite-gourmand.fr  Client#Gourmand2026
-- Sophie et Lucas utilisent aussi Client#Gourmand2026.
-- Les clients fictifs ont une adresse en example.com (domaine réservé
-- aux exemples) pour ne jamais envoyer de mail à une vraie personne.
-- Nicolas Roux est un ancien employé : compte désactivé (actif = 0).
-- ----------------------------------------------------------------
INSERT INTO utilisateur
    (utilisateur_id, nom, prenom, email, telephone, adresse_postale, code_postal, ville, mot_de_passe, actif, role_id)
VALUES
(1, 'Martin',  'José',    'admin@vite-gourmand.fr',       '0556123401', '128 avenue des Vignes',     '33000', 'Bordeaux', '$2b$10$YpaGnrDL2uH2ZBOpiP9Eo.8Ck26kbmm.ud8WahzNH2e0/TXAwir2C', 1, 3),
(2, 'Girard',  'Thomas',  'employe@vite-gourmand.fr',     '0612345678', '14 rue Sainte-Catherine',   '33000', 'Bordeaux', '$2b$10$Wa6pyPXlC8zb8hIxTDuxXeUkbxX8yu7vFEl00agui0IQ4oLG5G8aW', 1, 2),
(3, 'Laurent', 'Camille', 'utilisateur@vite-gourmand.fr', '0698765432', '7 cours de l''Intendance',  '33000', 'Bordeaux', '$2b$10$B4enYCw45pn6acIiV9ldS.zTNdAqjyXc7n2KZwXy/4eKjZcB8AltG', 1, 1),
(4, 'Bernard', 'Sophie',  'sophie.bernard@example.com',   '0645128937', '22 rue Judaïque',           '33000', 'Bordeaux', '$2b$10$QnFc.ylUuVDNgsVtOjrq5.0FI2eyMCf30Kb3X4tQiBdS0A3EsU79q', 1, 1),
(5, 'Moreau',  'Lucas',   'lucas.moreau@example.com',     '0778451296', '5 avenue de la Libération', '33700', 'Mérignac', '$2b$10$M2YBZGcSlCq4LN9K4uOROuoNr0GrdavtcLZ0dQ4leKQD2p3C/fspW', 1, 1),
(6, 'Roux',    'Nicolas', 'nicolas.roux@vite-gourmand.fr','0633874512', '3 place de la Victoire',    '33000', 'Bordeaux', '$2b$10$yxcm6wdvjMU.lrhg8WQXEe4xWpu/xF6yZyY/TW35Ih/n6xLGfvXeG', 0, 2);

-- ----------------------------------------------------------------
-- Thèmes et régimes
-- ----------------------------------------------------------------
INSERT INTO theme (theme_id, libelle) VALUES
(1, 'Noël'),
(2, 'Pâques'),
(3, 'Classique'),
(4, 'Évènement');

INSERT INTO regime (regime_id, libelle) VALUES
(1, 'Classique'),
(2, 'Végétarien'),
(3, 'Vegan'),
(4, 'Sans porc');

-- ----------------------------------------------------------------
-- Allergènes (les 14 du règlement européen INCO n° 1169/2011)
-- ----------------------------------------------------------------
INSERT INTO allergene (allergene_id, libelle) VALUES
(1,  'Gluten'),
(2,  'Crustacés'),
(3,  'Œufs'),
(4,  'Poissons'),
(5,  'Arachides'),
(6,  'Soja'),
(7,  'Lait'),
(8,  'Fruits à coque'),
(9,  'Céleri'),
(10, 'Moutarde'),
(11, 'Graines de sésame'),
(12, 'Anhydride sulfureux et sulfites'),
(13, 'Lupin'),
(14, 'Mollusques');

-- ----------------------------------------------------------------
-- Menus
-- ----------------------------------------------------------------
INSERT INTO menu
    (menu_id, titre, description, nombre_personne_min, prix_par_personne, conditions, quantite_restante, actif, theme_id, regime_id)
VALUES
(1, 'Menu Gastronomique',
    'Une expérience de haute gastronomie pour vos grandes occasions : foie gras maison, magret de canard et dessert au chocolat grand cru.',
    6, 65.00,
    'À commander au moins 10 jours avant la prestation. Plats livrés frais : à conserver au réfrigérateur entre 0 et 4 °C et à consommer dans les 24 heures.',
    10, 1, 4, 1),
(2, 'Menu Traditionnel',
    'Les saveurs du terroir du Sud-Ouest : velouté de saison, cassoulet toulousain mijoté et tarte au citron meringuée.',
    6, 48.00,
    'À commander au moins 7 jours avant la prestation. Le cassoulet se réchauffe 45 minutes au four à 160 °C.',
    15, 1, 3, 1),
(3, 'Menu Méditerranéen',
    'Un voyage ensoleillé autour de la Méditerranée : houmous et falafels, moussaka d''agneau, saumon aux herbes et tiramisu.',
    6, 50.00,
    'À commander au moins 7 jours avant la prestation. À conserver au réfrigérateur entre 0 et 4 °C.',
    12, 1, 3, 1),
(4, 'Menu Végétarien',
    'Une cuisine créative et gourmande, 100 % végétarienne : velouté de potimarron, buddha bowl ou lasagnes aux légumes du soleil.',
    6, 40.00,
    'À commander au moins 5 jours avant la prestation. À conserver au réfrigérateur entre 0 et 4 °C.',
    12, 1, 3, 2),
(5, 'Menu Vegan',
    'Sans aucun produit d''origine animale : gaspacho, rouleaux de printemps, curry de pois chiches et panna cotta végétale.',
    6, 42.00,
    'À commander au moins 5 jours avant la prestation. À conserver au réfrigérateur entre 0 et 4 °C.',
    10, 1, 3, 3),
(6, 'Menu Sans Porc',
    'Un menu iodé et parfumé, garanti sans porc : accras de morue, cocotte de la mer ou curry de poulet au lait de coco.',
    6, 45.00,
    'À commander au moins 7 jours avant la prestation. Produits de la mer : à consommer le jour de la livraison.',
    10, 1, 3, 4),
(7, 'Menu Exotique',
    'Un voyage culinaire aux saveurs des îles : accras, curry de poulet au lait de coco et fruits exotiques.',
    6, 55.00,
    'À commander au moins 7 jours avant la prestation. À conserver au réfrigérateur entre 0 et 4 °C.',
    8, 1, 4, 1),
(8, 'Menu de Noël',
    'Le grand repas des fêtes : foie gras, Saint-Jacques, dinde farcie aux marrons et bûche chocolat praliné.',
    8, 75.00,
    'Disponible pour des prestations du 1er au 31 décembre. À commander au moins 3 semaines avant la prestation. Chauffe-plats prêtés sur demande, à restituer sous 10 jours ouvrés.',
    20, 1, 1, 1),
(9, 'Menu de Pâques Terre et Mer',
    'Le printemps à table : plateau de fruits de mer, carpaccio de Saint-Jacques, gigot d''agneau et nid de Pâques au chocolat.',
    6, 58.00,
    'Disponible pour des prestations en mars et avril. À commander au moins 15 jours avant la prestation. Fruits de mer à consommer le jour de la livraison.',
    0, 1, 2, 1),
(10, 'Menu Prestige',
    'Notre menu signature pour les réceptions d''exception : foie gras, plateau de fruits de mer, filet de bœuf ou magret, fondant au chocolat.',
    10, 85.00,
    'À commander au moins 3 semaines avant la prestation. Service en vaisselle prêtée, à restituer sous 10 jours ouvrés.',
    5, 1, 4, 1);

-- ----------------------------------------------------------------
-- Galerie d'images (chemins prévus pour le projet Angular :
-- les fichiers seront copiés dans frontend/src/assets/images/menus/)
-- ----------------------------------------------------------------
INSERT INTO menu_image (menu_id, chemin, texte_alternatif, ordre) VALUES
(1,  'assets/images/menus/gastronomique.jpg', 'Tranches de magret de canard rosé nappées de sauce, sur une purée onctueuse', 1),
(2,  'assets/images/menus/traditionnel.jpg',  'Cassoulet toulousain aux haricots blancs et viandes confites dans une cassole en terre cuite', 1),
(3,  'assets/images/menus/mediterraneen.jpg', 'Part de moussaka gratinée aux aubergines, servie avec des tomates cerises', 1),
(4,  'assets/images/menus/vegetarien.jpg',    'Assiette végétarienne : quinoa, lentilles, aubergines et patates douces rôties, épinards et sauce', 1),
(5,  'assets/images/menus/vegan.jpg',         'Bowl vegan de riz complet, haricots noirs, avocat, maïs et tomates', 1),
(6,  'assets/images/menus/sans-porc.jpg',     'Cocotte de cabillaud et de crevettes dans une sauce crémeuse aux légumes', 1),
(7,  'assets/images/menus/exotique.jpg',      'Curry de poulet à la sauce tomate épicée et à la coriandre, sur du riz blanc', 1),
(8,  'assets/images/menus/noel.jpg',          'Dinde rôtie entière garnie de légumes, sur une table de fête décorée pour Noël', 1),
(9,  'assets/images/menus/paques.jpg',        'Grand plateau de fruits de mer : crevettes, langoustines, Saint-Jacques et saumon', 1),
(10, 'assets/images/menus/prestige.jpg',      'Filet de bœuf tranché et légumes dans une assiette dressée façon restaurant', 1);

-- ----------------------------------------------------------------
-- Plats (un plat peut figurer dans plusieurs menus)
-- ----------------------------------------------------------------
INSERT INTO plat (plat_id, titre, categorie) VALUES
-- Entrées
(1,  'Foie gras maison et chutney de figues', 'entree'),
(2,  'Velouté de potimarron à la châtaigne', 'entree'),
(3,  'Houmous, falafels et pain pita', 'entree'),
(4,  'Carpaccio de Saint-Jacques aux agrumes', 'entree'),
(5,  'Salade de chèvre chaud au miel et aux noix', 'entree'),
(6,  'Gaspacho andalou et croûtons à l''huile d''olive', 'entree'),
(7,  'Accras de morue et sauce créole', 'entree'),
(8,  'Rouleaux de printemps aux légumes croquants', 'entree'),
(9,  'Plateau de fruits de mer', 'entree'),
-- Plats
(10, 'Filet de bœuf, jus au vin rouge et légumes glacés', 'plat'),
(11, 'Magret de canard, sauce aux fruits rouges et purée truffée', 'plat'),
(12, 'Cassoulet toulousain', 'plat'),
(13, 'Moussaka d''agneau aux aubergines', 'plat'),
(14, 'Dinde de Noël farcie aux marrons', 'plat'),
(15, 'Gigot d''agneau de Pâques et flageolets', 'plat'),
(16, 'Curry de poulet au lait de coco et riz basmati', 'plat'),
(17, 'Cocotte de la mer : cabillaud et crevettes à la crème', 'plat'),
(18, 'Pavé de saumon en croûte d''herbes', 'plat'),
(19, 'Lasagnes aux légumes du soleil', 'plat'),
(20, 'Buddha bowl : quinoa, lentilles et légumes rôtis', 'plat'),
(21, 'Bowl vegan : riz complet, haricots noirs, avocat et maïs', 'plat'),
(22, 'Curry de pois chiches et légumes', 'plat'),
-- Desserts
(23, 'Fondant au chocolat noir 70 %', 'dessert'),
(24, 'Bûche de Noël chocolat et praliné', 'dessert'),
(25, 'Tarte au citron meringuée', 'dessert'),
(26, 'Salade de fruits exotiques à la citronnelle', 'dessert'),
(27, 'Panna cotta végétale coco et coulis de mangue', 'dessert'),
(28, 'Nid de Pâques au chocolat', 'dessert'),
(29, 'Tiramisu maison', 'dessert');

-- ----------------------------------------------------------------
-- Composition des menus (menu_id, plat_id)
-- ----------------------------------------------------------------
INSERT INTO menu_plat (menu_id, plat_id) VALUES
-- 1. Gastronomique
(1, 1), (1, 4), (1, 11), (1, 18), (1, 23),
-- 2. Traditionnel
(2, 2), (2, 5), (2, 12), (2, 25),
-- 3. Méditerranéen
(3, 3), (3, 6), (3, 13), (3, 18), (3, 29),
-- 4. Végétarien
(4, 2), (4, 5), (4, 19), (4, 20), (4, 25),
-- 5. Vegan
(5, 6), (5, 8), (5, 21), (5, 22), (5, 26), (5, 27),
-- 6. Sans porc
(6, 4), (6, 7), (6, 16), (6, 17), (6, 26),
-- 7. Exotique
(7, 7), (7, 8), (7, 16), (7, 26), (7, 27),
-- 8. Noël
(8, 1), (8, 4), (8, 14), (8, 24),
-- 9. Pâques
(9, 4), (9, 9), (9, 15), (9, 28),
-- 10. Prestige
(10, 1), (10, 9), (10, 10), (10, 11), (10, 23);

-- ----------------------------------------------------------------
-- Allergènes des plats (plat_id, allergene_id)
-- 1 Gluten, 2 Crustacés, 3 Œufs, 4 Poissons, 5 Arachides, 6 Soja,
-- 7 Lait, 8 Fruits à coque, 9 Céleri, 10 Moutarde, 11 Sésame,
-- 12 Sulfites, 13 Lupin, 14 Mollusques
-- ----------------------------------------------------------------
INSERT INTO plat_allergene (plat_id, allergene_id) VALUES
(1, 1), (1, 12),                    -- foie gras (pain brioché, vin)
(2, 7), (2, 9),                     -- velouté potimarron
(3, 1), (3, 11),                    -- houmous, falafels, pita
(4, 14),                            -- carpaccio de Saint-Jacques
(5, 1), (5, 7), (5, 8),             -- chèvre chaud aux noix
(6, 1), (6, 9),                     -- gaspacho et croûtons
(7, 1), (7, 3), (7, 4),             -- accras de morue
(8, 5), (8, 6),                     -- rouleaux de printemps (sauce cacahuète, soja)
(9, 2), (9, 14),                    -- plateau de fruits de mer
(10, 7), (10, 12),                  -- filet de bœuf
(11, 7), (11, 12),                  -- magret de canard
(12, 9), (12, 12),                  -- cassoulet
(13, 1), (13, 3), (13, 7),          -- moussaka (béchamel)
(14, 1), (14, 3), (14, 7), (14, 9), -- dinde farcie
(15, 9), (15, 12),                  -- gigot d'agneau
(16, 9),                            -- curry de poulet
(17, 2), (17, 4), (17, 7),          -- cocotte de la mer
(18, 1), (18, 4), (18, 7),          -- saumon en croûte
(19, 1), (19, 3), (19, 7),          -- lasagnes
(20, 10), (20, 11),                 -- buddha bowl (sauce tahini moutarde)
(21, 6),                            -- bowl vegan (sauce soja)
(22, 9), (22, 10),                  -- curry de pois chiches
(23, 1), (23, 3), (23, 7),          -- fondant au chocolat
(24, 1), (24, 3), (24, 7), (24, 8), -- bûche praliné
(25, 1), (25, 3), (25, 7),          -- tarte au citron
(28, 1), (28, 3), (28, 7), (28, 8), -- nid de Pâques
(29, 1), (29, 3), (29, 7);          -- tiramisu
-- Plats 26 et 27 : aucun allergène majeur.

-- ----------------------------------------------------------------
-- Horaires (affichés dans le pied de page)
-- ----------------------------------------------------------------
INSERT INTO horaire (jour, heure_ouverture, heure_fermeture) VALUES
('lundi',    '09:00:00', '19:00:00'),
('mardi',    '09:00:00', '19:00:00'),
('mercredi', '09:00:00', '19:00:00'),
('jeudi',    '09:00:00', '19:00:00'),
('vendredi', '09:00:00', '19:00:00'),
('samedi',   '09:00:00', '21:00:00'),
('dimanche', '09:00:00', '21:00:00');

-- ----------------------------------------------------------------
-- Commandes (une par statut ou presque, pour tester tous les écrans)
-- Calculs détaillés :
--  1. 12 pers. x 65 = 780 ; 12 >= 6+5 -> réduction 78   ; Bordeaux 0         ; total 702.00
--  2.  8 pers. x 48 = 384 ; pas de réduction          ; 12 km : 5+7.08     ; total 396.08
--  3.  6 pers. x 50 = 300 ; pas de réduction          ; Bordeaux 0         ; total 300.00
--  4. 20 pers. x 55 = 1100 ; réduction 110            ; 7 km : 5+4.13      ; total 999.13
--  5. 10 pers. x 75 = 750 ; 10 < 8+5 pas de réduction ; Bordeaux 0         ; total 750.00
--  6.  6 pers. x 42 = 252 ; pas de réduction          ; 5 km : 5+2.95      ; total 259.95
--  7.  7 pers. x 45 = 315 ; pas de réduction          ; Bordeaux 0         ; total 315.00 (annulée)
--  8. 15 pers. x 85 = 1275 ; 15 >= 10+5 -> réduction 127.50 ; 65 km : 5+38.35 ; total 1190.85
--  9.  6 pers. x 40 = 240 ; pas de réduction          ; 12 km : 5+7.08     ; total 252.08
-- ----------------------------------------------------------------
INSERT INTO commande
    (commande_id, numero_commande, date_commande, date_prestation, heure_livraison,
     adresse_prestation, ville_prestation, distance_km, nombre_personne, prix_par_personne,
     reduction, prix_menu, prix_livraison, prix_total, statut, pret_materiel, materiel_restitue,
     mode_contact, motif, utilisateur_id, menu_id)
VALUES
(1, 'VG-2026-0001', '2026-09-10 10:15:00', '2026-10-03', '12:00:00',
    '22 rue Judaïque', 'Bordeaux', 0, 12, 65.00,
    78.00, 702.00, 0.00, 702.00, 'terminee', 0, 0, NULL, NULL, 4, 1),
(2, 'VG-2026-0002', '2026-09-15 18:40:00', '2026-10-10', '19:30:00',
    '5 avenue de la Libération', 'Mérignac', 12.00, 8, 48.00,
    0.00, 384.00, 12.08, 396.08, 'terminee', 1, 1, NULL, NULL, 5, 2),
(3, 'VG-2026-0003', '2026-10-01 09:05:00', '2026-10-17', '12:30:00',
    '7 cours de l''Intendance', 'Bordeaux', 0, 6, 50.00,
    0.00, 300.00, 0.00, 300.00, 'terminee', 0, 0, NULL, NULL, 3, 3),
(4, 'VG-2026-0004', '2026-10-08 14:20:00', '2026-10-31', '18:00:00',
    '12 avenue Jean Jaurès', 'Pessac', 7.00, 20, 55.00,
    110.00, 990.00, 9.13, 999.13, 'attente_retour_materiel', 1, 0, NULL, NULL, 4, 7),
(5, 'VG-2026-0005', '2026-10-20 20:10:00', '2026-12-24', '19:00:00',
    '18 quai des Chartrons', 'Bordeaux', 0, 10, 75.00,
    0.00, 750.00, 0.00, 750.00, 'accepte', 1, 0, NULL, NULL, 5, 8),
(6, 'VG-2026-0006', '2026-11-01 11:45:00', '2026-11-21', '12:30:00',
    '30 cours de la Libération', 'Talence', 5.00, 6, 42.00,
    0.00, 252.00, 7.95, 259.95, 'en_attente', 0, 0, NULL, NULL, 3, 5),
(7, 'VG-2026-0007', '2026-10-12 16:30:00', '2026-10-25', '13:00:00',
    '22 rue Judaïque', 'Bordeaux', 0, 7, 45.00,
    0.00, 315.00, 0.00, 315.00, 'annulee', 0, 0, 'gsm',
    'Cliente jointe par téléphone : l''évènement est reporté, annulation à sa demande.', 4, 6),
(8, 'VG-2026-0008', '2026-10-05 15:00:00', '2026-11-04', '19:00:00',
    '9 boulevard de la Plage', 'Arcachon', 65.00, 15, 85.00,
    127.50, 1147.50, 43.35, 1190.85, 'en_preparation', 1, 0, NULL, NULL, 3, 10),
(9, 'VG-2026-0009', '2026-09-02 12:00:00', '2026-09-12', '12:00:00',
    '5 avenue de la Libération', 'Mérignac', 12.00, 6, 40.00,
    0.00, 240.00, 12.08, 252.08, 'terminee', 0, 0, NULL, NULL, 5, 4);

-- ----------------------------------------------------------------
-- Suivi des commandes (historique des statuts)
-- employe_id NULL = action du client ; 2 = Thomas (employé) ; 1 = José (admin)
-- ----------------------------------------------------------------
INSERT INTO suivi_commande (commande_id, statut, date_changement, employe_id) VALUES
-- Commande 1 : parcours complet sans prêt de matériel
(1, 'en_attente',         '2026-09-10 10:15:00', NULL),
(1, 'accepte',            '2026-09-10 14:02:00', 2),
(1, 'en_preparation',     '2026-10-03 08:00:00', 2),
(1, 'en_cours_livraison', '2026-10-03 11:10:00', 2),
(1, 'livre',              '2026-10-03 11:50:00', 2),
(1, 'terminee',           '2026-10-03 18:00:00', 2),
-- Commande 2 : avec prêt de matériel restitué
(2, 'en_attente',              '2026-09-15 18:40:00', NULL),
(2, 'accepte',                 '2026-09-16 09:30:00', 2),
(2, 'en_preparation',          '2026-10-10 14:00:00', 2),
(2, 'en_cours_livraison',      '2026-10-10 18:30:00', 2),
(2, 'livre',                   '2026-10-10 19:20:00', 2),
(2, 'attente_retour_materiel', '2026-10-10 19:25:00', 2),
(2, 'terminee',                '2026-10-14 10:00:00', 1),
-- Commande 3
(3, 'en_attente',         '2026-10-01 09:05:00', NULL),
(3, 'accepte',            '2026-10-01 11:00:00', 2),
(3, 'en_preparation',     '2026-10-17 08:30:00', 2),
(3, 'en_cours_livraison', '2026-10-17 11:45:00', 2),
(3, 'livre',              '2026-10-17 12:25:00', 2),
(3, 'terminee',           '2026-10-17 17:00:00', 2),
-- Commande 4 : matériel pas encore rendu
(4, 'en_attente',              '2026-10-08 14:20:00', NULL),
(4, 'accepte',                 '2026-10-08 16:00:00', 2),
(4, 'en_preparation',          '2026-10-31 13:00:00', 2),
(4, 'en_cours_livraison',      '2026-10-31 17:15:00', 2),
(4, 'livre',                   '2026-10-31 17:55:00', 2),
(4, 'attente_retour_materiel', '2026-10-31 18:00:00', 2),
-- Commande 5
(5, 'en_attente', '2026-10-20 20:10:00', NULL),
(5, 'accepte',    '2026-10-21 09:15:00', 2),
-- Commande 6
(6, 'en_attente', '2026-11-01 11:45:00', NULL),
-- Commande 7 : annulée par l'employé après appel de la cliente
(7, 'en_attente', '2026-10-12 16:30:00', NULL),
(7, 'annulee',    '2026-10-13 10:20:00', 2),
-- Commande 8
(8, 'en_attente',     '2026-10-05 15:00:00', NULL),
(8, 'accepte',        '2026-10-06 09:00:00', 1),
(8, 'en_preparation', '2026-11-02 08:00:00', 2),
-- Commande 9
(9, 'en_attente',         '2026-09-02 12:00:00', NULL),
(9, 'accepte',            '2026-09-02 15:30:00', 2),
(9, 'en_preparation',     '2026-09-12 08:00:00', 2),
(9, 'en_cours_livraison', '2026-09-12 11:00:00', 2),
(9, 'livre',              '2026-09-12 11:45:00', 2),
(9, 'terminee',           '2026-09-12 16:00:00', 2);

-- ----------------------------------------------------------------
-- Avis (uniquement sur des commandes terminées)
-- ----------------------------------------------------------------
INSERT INTO avis (note, commentaire, statut, date_creation, commande_id, utilisateur_id) VALUES
(5, 'Un repas d''anniversaire parfait : le magret était fondant et tout est arrivé à l''heure. Nos invités ont adoré !',
    'valide',     '2026-10-04 10:30:00', 1, 4),
(4, 'Cassoulet généreux comme chez ma grand-mère. Livraison ponctuelle, le matériel prêté était très pratique.',
    'valide',     '2026-10-15 19:10:00', 2, 5),
(4, 'Très bon menu méditerranéen, la moussaka était excellente. Un peu plus de pain aurait été appréciable.',
    'en_attente', '2026-10-18 09:00:00', 3, 3),
(1, 'Visitez mon site pour gagner des cadeaux !!! www.promo-gratuite.example',
    'refuse',     '2026-09-13 22:40:00', 9, 5);
