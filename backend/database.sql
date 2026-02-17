-- ================================================================
-- VITE & GOURMAND - Création de la base de données MySQL
-- ================================================================
-- Exécuter ce fichier dans MySQL pour créer toutes les tables
-- Commande : mysql -u root -p < database.sql
-- ================================================================

-- Créer la base de données
CREATE DATABASE IF NOT EXISTS vite_gourmand CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vite_gourmand;

-- ================================================================
-- TABLE : utilisateurs
-- ================================================================
-- Rôles : client, employe, admin
-- Le mot de passe est stocké hashé (bcrypt)
-- ================================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    telephone VARCHAR(20) DEFAULT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('client', 'employe', 'admin') DEFAULT 'client',
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : menus
-- ================================================================
CREATE TABLE IF NOT EXISTS menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    prix DECIMAL(6,2) NOT NULL,
    theme VARCHAR(50) DEFAULT NULL,
    regime VARCHAR(50) DEFAULT NULL,
    image VARCHAR(255) DEFAULT NULL,
    minimum_personnes INT DEFAULT 6,
    actif TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : plats
-- ================================================================
-- Chaque plat appartient à un menu
-- ================================================================
CREATE TABLE IF NOT EXISTS plats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    categorie ENUM('entree', 'poisson', 'plat_principal', 'fromage', 'dessert') NOT NULL,
    description TEXT DEFAULT NULL,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : commandes
-- ================================================================
-- Réduction de 10% si nombre_personnes > 5
-- ================================================================
CREATE TABLE IF NOT EXISTS commandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    menu_id INT NOT NULL,
    nombre_personnes INT NOT NULL,
    prix_unitaire DECIMAL(6,2) NOT NULL,
    reduction DECIMAL(4,2) DEFAULT 0,
    prix_total DECIMAL(8,2) NOT NULL,
    statut ENUM('en_attente', 'confirmee', 'en_cours', 'livree', 'annulee') DEFAULT 'en_attente',
    date_evenement DATE DEFAULT NULL,
    adresse_livraison TEXT DEFAULT NULL,
    commentaire TEXT DEFAULT NULL,
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : avis
-- ================================================================
CREATE TABLE IF NOT EXISTS avis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    commande_id INT DEFAULT NULL,
    note INT NOT NULL CHECK (note >= 1 AND note <= 5),
    commentaire TEXT DEFAULT NULL,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : messages_contact
-- ================================================================
CREATE TABLE IF NOT EXISTS messages_contact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    telephone VARCHAR(20) DEFAULT NULL,
    sujet VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    lu TINYINT(1) DEFAULT 0,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================================
-- TABLE : tokens_reinitialisation
-- ================================================================
-- Pour la fonctionnalité "mot de passe oublié"
-- ================================================================
CREATE TABLE IF NOT EXISTS tokens_reinitialisation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expire_at DATETIME NOT NULL,
    utilise TINYINT(1) DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ================================================================
-- DONNÉES DE TEST
-- ================================================================

-- Admin par défaut (mot de passe : Admin123!)
-- Hash bcrypt de "Admin123!" 
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES
('Admin', 'Vite&Gourmand', 'admin@vite-gourmand.fr', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'admin');

-- Employé test (mot de passe : Employe123!)
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES
('Dupont', 'Julie', 'julie@vite-gourmand.fr', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'employe');

-- Client test (mot de passe : Client123!)
INSERT INTO utilisateurs (nom, prenom, email, telephone, mot_de_passe, role) VALUES
('Martin', 'Pierre', 'pierre@email.com', '01 23 45 67 89', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'client');

-- Menus
INSERT INTO menus (nom, description, prix, theme, regime, image, minimum_personnes) VALUES
('Menu sans porc', 'Cuisine créative et gourmande sans viande de porc.', 45.00, 'classique', 'sans-porc', 'sansporc.jpg', 6),
('Menu Gastronomique', 'Une expérience gastronomique de haute gamme.', 55.00, 'gastronomique', 'standard', 'gastro.jpg', 6),
('Menu Méditerranéen', 'Cuisine créative et gourmande 100% végétarienne.', 40.00, 'mediterraneen', 'vegetarien', 'medi.jpg', 6),
('Menu Exotique', 'Saveurs du monde pour un voyage culinaire.', 55.00, 'exotique', 'standard', 'exotique.jpg', 6),
('Menu Traditionnel', 'Les grands classiques de la cuisine française.', 48.00, 'classique', 'standard', 'Cassoulet Traditionnel.jpg', 6),
('Menu Végétarien', 'Un menu 100% végétarien gourmand et créatif.', 40.00, 'mediterraneen', 'vegetarien', 'vege.jpg', 6);

-- Plats du Menu Gastronomique (id = 2)
INSERT INTO plats (menu_id, nom, categorie, description) VALUES
(2, 'Foie gras et chutney de figues', 'entree', 'Foie gras maison accompagné de son chutney de figues'),
(2, 'Noix de Saint-Jacques, émulsion de champagne', 'poisson', 'Saint-Jacques snackées avec émulsion légère au champagne'),
(2, 'Filet de bœuf, jus truffé et légumes de saison', 'plat_principal', 'Filet de bœuf cuisson parfaite, jus à la truffe noire'),
(2, 'Assiette de fromages affinés', 'fromage', 'Sélection de 5 fromages affinés par notre maître fromager'),
(2, 'Fondant au chocolat et coulis de framboise', 'dessert', 'Fondant chocolat noir 70% cœur coulant, coulis framboise');

-- Avis de test
INSERT INTO avis (utilisateur_id, note, commentaire) VALUES
(3, 5, 'Un repas exceptionnel pour notre mariage ! Tout était parfait.'),
(3, 4, 'Très bonne qualité, service impeccable. Je recommande.'),
(3, 5, 'Le menu gastronomique est une pure merveille.');

-- Commande de test
INSERT INTO commandes (utilisateur_id, menu_id, nombre_personnes, prix_unitaire, reduction, prix_total, statut, date_evenement, adresse_livraison) VALUES
(3, 2, 8, 55.00, 10.00, 396.00, 'livree', '2026-03-15', '128 Avenue des Vignes, 33000 Bordeaux');
