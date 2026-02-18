-- ================================================================
-- VITE & GOURMAND - Script de création de la base de données
-- ================================================================
-- Projet : Vite & Gourmand - Service de traiteur gastronomique
-- Auteur : Anoman Pierre MANOUAN
-- Date   : Février 2026
-- SGBD   : MySQL 8.x
-- ================================================================

-- Création de la base de données
CREATE DATABASE IF NOT EXISTS vite_gourmand CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vite_gourmand;


-- ================================================================
-- TABLE : utilisateurs
-- Gestion des comptes (clients, employés, administrateurs)
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
-- Catalogue des menus proposés par le traiteur
-- ================================================================
CREATE TABLE IF NOT EXISTS menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    prix DECIMAL(6,2) NOT NULL,
    theme VARCHAR(50),
    regime VARCHAR(50),
    image VARCHAR(255),
    minimum_personnes INT DEFAULT 6,
    actif TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- ================================================================
-- TABLE : plats
-- Plats composant chaque menu
-- ================================================================
CREATE TABLE IF NOT EXISTS plats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    categorie ENUM('entree', 'poisson', 'plat_principal', 'fromage', 'dessert') NOT NULL,
    description TEXT,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ================================================================
-- TABLE : commandes
-- Commandes passées par les clients
-- Réduction automatique de 10% au-delà de 5 personnes
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
    date_evenement DATE,
    adresse_livraison TEXT,
    commentaire TEXT,
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ================================================================
-- TABLE : avis
-- Avis et notes laissés par les clients (1 à 5 étoiles)
-- ================================================================
CREATE TABLE IF NOT EXISTS avis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    commande_id INT DEFAULT NULL,
    note INT NOT NULL,
    commentaire TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ================================================================
-- TABLE : messages_contact
-- Messages envoyés via le formulaire de contact
-- ================================================================
CREATE TABLE IF NOT EXISTS messages_contact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    telephone VARCHAR(20),
    sujet VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    lu TINYINT(1) DEFAULT 0,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- ================================================================
-- TABLE : tokens_reinitialisation
-- Tokens pour la réinitialisation des mots de passe
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

-- Utilisateurs (mot de passe hashé bcrypt = Admin123! / Employe123! / Client123!)
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES
('Admin', 'Vite&Gourmand', 'admin@vite-gourmand.fr', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'admin'),
('Dupont', 'Julie', 'julie@vite-gourmand.fr', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'employe'),
('Martin', 'Pierre', 'pierre@email.com', '$2b$10$8K1p/a0dR1xqM8K3hQJ8eOYm3RvU5Y1qT5L6wG5nVZT8F.P6Vu2Gy', 'client');

-- Menus
INSERT INTO menus (nom, description, prix, theme, regime, image, minimum_personnes) VALUES
('Menu sans porc', 'Cuisine créative sans porc.', 45.00, 'classique', 'sans-porc', 'sansporc.jpg', 6),
('Menu Gastronomique', 'Expérience haute gamme.', 55.00, 'gastronomique', 'standard', 'gastro.jpg', 6),
('Menu Méditerranéen', 'Cuisine méditerranéenne.', 40.00, 'mediterraneen', 'vegetarien', 'medi.jpg', 6),
('Menu Exotique', 'Saveurs du monde.', 55.00, 'exotique', 'standard', 'exotique.jpg', 6),
('Menu Traditionnel', 'Classiques français.', 48.00, 'classique', 'standard', 'Cassoulet Traditionnel.jpg', 6),
('Menu Végétarien', '100% végétarien.', 40.00, 'mediterraneen', 'vegetarien', 'vege.jpg', 6);

-- Plats du Menu Gastronomique (menu_id = 2)
INSERT INTO plats (menu_id, nom, categorie, description) VALUES
(2, 'Foie gras et chutney de figues', 'entree', 'Foie gras maison'),
(2, 'Noix de Saint-Jacques', 'poisson', 'Saint-Jacques snackées'),
(2, 'Filet de boeuf jus truffé', 'plat_principal', 'Filet cuisson parfaite'),
(2, 'Fromages affinés', 'fromage', 'Sélection 5 fromages'),
(2, 'Fondant chocolat', 'dessert', 'Chocolat noir 70%');

-- Avis
INSERT INTO avis (utilisateur_id, note, commentaire) VALUES
(3, 5, 'Exceptionnel pour notre mariage !'),
(3, 4, 'Très bonne qualité.'),
(3, 5, 'Menu gastronomique merveilleux.');

-- Commande de test
INSERT INTO commandes (utilisateur_id, menu_id, nombre_personnes, prix_unitaire, reduction, prix_total, statut, date_evenement, adresse_livraison) VALUES
(3, 2, 8, 55.00, 10.00, 396.00, 'livree', '2026-03-15', '128 Avenue des Vignes, Bordeaux');
