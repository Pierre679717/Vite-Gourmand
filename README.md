# 🍽️ Vite & Gourmand - Service Traiteur Gastronomique

Application web full-stack pour un service de traiteur gastronomique basé à Bordeaux.

**Projet Web Developer - RNCP 37674**

🌐 **Site en ligne :** [vite-gourmand-production.up.railway.app](https://vite-gourmand-production.up.railway.app)

---

## 📋 Fonctionnalités

### Pages publiques
- Page d'accueil avec présentation du service
- Catalogue des menus avec filtres (thème, régime alimentaire)
- Formulaire de contact avec validation côté client et serveur
- Inscription et connexion sécurisées

### Espace Client
- Passer une commande (choix du menu, nombre de personnes, date, adresse)
- Réduction automatique de 10% pour les commandes de plus de 5 personnes
- Historique des commandes avec suivi du statut
- Dépôt d'avis (note + commentaire)

### Espace Employé
- Gestion des commandes (modification du statut)
- Ajout de nouveaux menus
- Consultation des avis clients

### Espace Administrateur
- Tableau de bord avec statistiques (Chart.js)
- Gestion complète des commandes
- Gestion des employés (création de comptes)
- Supervision globale

---

## 🛠️ Stack Technologique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | HTML5, CSS3 (Flexbox, Grid, Media Queries), JavaScript ES5+ |
| **Backend** | Node.js, Express.js |
| **BDD relationnelle** | MySQL (données transactionnelles) |
| **BDD NoSQL** | MongoDB (statistiques) |
| **Authentification** | bcrypt, express-session |
| **Email** | Nodemailer (SMTP) |
| **Hébergement** | Railway (PaaS) |
| **Versioning** | Git / GitHub |

---

## 📁 Structure du projet

```
Vite-Gourmand/
├── backend/
│   ├── server.js            # Serveur Express (API REST)
│   ├── package.json         # Dépendances Node.js
│   ├── .env                 # Variables d'environnement (non commité)
│   └── database.sql         # Script création BDD
├── frontend/
│   └── html/
│       ├── index.html       # Page d'accueil
│       ├── menus.html       # Catalogue des menus
│       ├── contact.html     # Formulaire de contact
│       ├── connexion.html   # Connexion
│       ├── inscription.html # Inscription
│       ├── espace-utilisateur.html
│       ├── espace-employe.html
│       ├── espace-admin.html
│       ├── Css/
│       │   ├── style.css
│       │   └── js/          # Scripts JavaScript
│       └── images/
└── package.json             # Root (Railway)
```

---

## 🚀 Installation locale

### Prérequis
- Node.js (v18+)
- MySQL (v8+)
- MongoDB (optionnel, pour les statistiques)

### Étapes

1. **Cloner le dépôt**
```bash
git clone https://github.com/Pierre679717/Vite-Gourmand.git
cd Vite-Gourmand
```

2. **Installer les dépendances**
```bash
cd backend
npm install
```

3. **Créer la base de données**
```bash
mysql -u root -p < database.sql
```

4. **Configurer les variables d'environnement**

Créer un fichier `.env` dans le dossier `backend/` :
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=vite_gourmand
SESSION_SECRET=votre_secret_session
MONGO_URI=mongodb://localhost:27017/vite_gourmand
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=votre@email.com
EMAIL_PASSWORD=votre_app_password
```

5. **Lancer le serveur**
```bash
npm start
```

6. **Accéder au site**

Ouvrir `http://localhost:3000` dans le navigateur.

---

## 🔑 Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Administrateur | admin@vite-gourmand.fr | Admin123! |
| Employé | julie@vite-gourmand.fr | Employe123! |
| Client | pierre@email.com | Client123! |

---

## 🔒 Sécurité

- Hashage des mots de passe avec **bcrypt** (10 rounds)
- Sessions sécurisées avec **express-session**
- Requêtes SQL préparées (protection injection SQL)
- Validation côté client et serveur
- Contrôle d'accès par rôles (RBAC)
- Champs honeypot anti-spam
- Content-Security-Policy sur les pages sensibles
- Politique de mot de passe forte (8+ caractères, majuscule, minuscule, chiffre, caractère spécial)

---

## 📱 Responsive Design

Le site est entièrement responsive avec 3 breakpoints :
- **Mobile** (< 768px) : menu hamburger, colonnes empilées
- **Tablette** (768px - 1199px) : grille adaptée
- **Desktop** (≥ 1200px) : affichage complet

---

## 🎨 Charte Graphique

- **Vert foncé** `#2E7D32` — Couleur principale
- **Or** `#D4AF37` — Accents premium
- **Bordeaux** `#722F37` — Couleur secondaire
- **Playfair Display** — Titres
- **Open Sans** — Corps de texte

---

## 📄 API REST

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/inscription | Créer un compte |
| POST | /api/connexion | Se connecter |
| GET | /api/deconnexion | Se déconnecter |
| GET | /api/profil | Voir son profil |

### Menus & Commandes
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/menus | Liste des menus |
| GET | /api/menus/:id | Détail d'un menu |
| POST | /api/commandes | Passer commande |
| GET | /api/commandes | Mes commandes |
| POST | /api/contact | Envoyer message |
| POST | /api/avis | Laisser un avis |

### Administration
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/stats | Statistiques |
| GET | /api/admin/commandes | Toutes les commandes |
| POST | /api/admin/employes | Créer un employé |

---

## 👨‍💻 Auteur

**Pierre** — Développeur Web (RNCP 37674)

© 2026 Vite & Gourmand - Tous droits réservés
