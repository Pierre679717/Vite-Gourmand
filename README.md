# Vite & Gourmand

Application web d'un traiteur bordelais (entreprise fictive) : catalogue de menus, commande en ligne, suivi des commandes, avis clients, espace employé et espace administrateur.

Projet réalisé pour l'ECF du titre professionnel Développeur Web et Web Mobile (Studi) par **MANOUAN Anoman (Pierre)**.

- **Site en ligne :** https://vite-gourmand-production.up.railway.app
- **Dépôt :** https://github.com/Pierre679717/Vite-Gourmand (branche `main` = production, `develop` = développement)

## Comptes de test

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@vite-gourmand.fr` | `Admin#Gourmand2026` |
| Employé | `employe@vite-gourmand.fr` | `Employe#Gourmand2026` |
| Client | `utilisateur@vite-gourmand.fr` | `Client#Gourmand2026` |

Ces comptes sont créés par le script SQL. Les mails envoyés par le site (confirmation de commande, changement de statut, mot de passe oublié, création d'un compte employé, contact) sont capturés dans une boîte de test Mailtrap : ils ne partent pas vers de vraies adresses.

## Fonctionnalités

- **Visiteur :** accueil (présentation, avis validés, horaires), catalogue des menus avec filtres (prix, thème, régime, nombre de personnes), détail d'un menu (plats, allergènes, conditions), contact, inscription, connexion, mot de passe oublié, CGV et mentions légales.
- **Client :** commande en plusieurs étapes (prix et distance de livraison calculés par le serveur, réduction de 10 % à partir du minimum + 5 personnes), suivi de ses commandes, modification ou annulation tant que la commande n'est pas acceptée, avis après une commande terminée, modification de ses informations.
- **Employé :** commandes filtrables, changement de statut (mails automatiques au retour du matériel et à la fin), annulation motivée, modération des avis, gestion des menus, des plats (avec allergènes) et des horaires.
- **Administrateur :** tout l'espace employé, création et désactivation des comptes employés, statistiques (graphique Chart.js du nombre de commandes et chiffre d'affaires par menu, filtres par menu et par période) lues dans MongoDB.

## Technologies

| Partie | Choix |
| --- | --- |
| Front-end | Angular 22 (composants autonomes, signaux, formulaires réactifs), SCSS, Chart.js |
| Back-end | Node.js 22, Express 4, API REST en JSON |
| Base relationnelle | MySQL 8.0.16 ou plus (`mysql2`, requêtes préparées, transactions) |
| Base NoSQL | MongoDB (Mongoose), collection `commandes_stats` pour les statistiques |
| Authentification | JWT (`jsonwebtoken`), mots de passe hachés avec bcrypt |
| Sécurité | helmet (CSP stricte, HSTS), express-rate-limit, CORS limité au domaine du site |
| E-mails | Nodemailer (SMTP Mailtrap) en local, API HTTPS de Mailtrap en production |
| Tests | `node:test` (backend), Vitest via `ng test` (front-end) |
| Hébergement | Railway (service Node + MySQL), MongoDB Atlas (offre gratuite M0) |

## Structure du dépôt

```
Vite-Gourmand/
├── package.json          # scripts de la racine : build (back + front) et start (Railway)
├── backend/              # API Express
│   ├── server.js         # point d'entrée : sécurité, routes /api, sert le build Angular
│   ├── config/           # MySQL, MongoDB, JWT, sécurité (helmet, CORS, limites)
│   ├── routes/           # une route par domaine (menus, commandes, employe, admin…)
│   ├── controllers/      # traitement des requêtes
│   ├── models/           # requêtes SQL et modèles MongoDB
│   ├── utils/            # validations, règles de prix, statuts, jetons
│   ├── email/            # gabarits des mails et transport (SMTP ou API)
│   ├── scripts/          # synchroniser-stats.js (MySQL → MongoDB)
│   ├── tests/            # tests automatisés du backend
│   └── .env.example      # modèle des variables d'environnement
├── frontend/             # application Angular
│   ├── src/app/          # core (services, gardes), pages, espaces (utilisateur, employe, admin), shared
│   ├── public/assets/    # images (WebP)
│   └── proxy.conf.json   # en développement, /api est redirigé vers le port 3000
├── database/
│   ├── vite_gourmand.sql        # création de la base, des 15 tables et des données de test
│   └── maj_images_libres.sql    # mise à jour des images d'une base créée avant le 18/11/2026
└── docs/                 # livrables (manuel d'utilisation, charte graphique, documentation technique)
```

## Installation en local

### Prérequis

- **Node.js 22.22.3 ou plus** (exigé par Angular 22) et npm
- **MySQL 8.0.16 ou plus** (les contraintes `CHECK` du script sont appliquées à partir de cette version)
- Git
- Facultatif : MongoDB (local ou Atlas) pour les statistiques, un compte Mailtrap pour voir les mails

### 1. Cloner le dépôt

```bash
git clone https://github.com/Pierre679717/Vite-Gourmand.git
cd Vite-Gourmand
```

### 2. Créer la base de données

Le script crée la base `vite_gourmand`, ses 15 tables et les données de démonstration. Il peut être rejoué : il supprime puis recrée les tables.

```bash
sudo mysql < database/vite_gourmand.sql
```

(Sous Windows ou macOS : `mysql -u root -p < database/vite_gourmand.sql`.)

Il est conseillé de créer un utilisateur réservé à l'application, limité à cette base (remplacer le mot de passe) :

```sql
CREATE USER 'vg_dev'@'localhost' IDENTIFIED BY 'Choisir#UnMotDePasse1';
GRANT ALL PRIVILEGES ON vite_gourmand.* TO 'vg_dev'@'localhost';
```

### 3. Configurer le backend

```bash
cd backend
npm ci
cp .env.example .env
```

Compléter ensuite `backend/.env` (le fichier n'est jamais commité) :

| Variable | Rôle |
| --- | --- |
| `JWT_SECRET` | **Obligatoire** (le serveur refuse de démarrer sans, 32 caractères minimum). Générer : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connexion MySQL (`DB_NAME=vite_gourmand`). Mettre le mot de passe entre guillemets s'il contient un `#`. |
| `FRONTEND_URL` | Adresse du site : `http://localhost:4200` en développement, `http://localhost:3000` pour le build de production |
| `MONGO_URI` | Facultatif : `mongodb://127.0.0.1:27017/vite_gourmand_stats`. Sans lui, le site fonctionne mais les statistiques restent vides. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` | Identifiants SMTP d'une boîte de test Mailtrap (facultatif : sans eux, les mails ne partent pas mais le site fonctionne) |
| `CONTACT_DESTINATAIRE` | Adresse qui reçoit les messages du formulaire de contact |

### 4. Installer le front-end

```bash
cd ../frontend
npm ci
```

## Lancer l'application

### En développement (deux terminaux)

```bash
# terminal 1 : API sur http://localhost:3000
cd backend
npm run dev
```

```bash
# terminal 2 : Angular sur http://localhost:4200 (les appels /api passent par le proxy)
cd frontend
npm start
```

Ouvrir http://localhost:4200.

### Comme en production (un seul serveur)

À la racine du dépôt :

```bash
npm run build
npm start
```

`npm run build` installe les dépendances du backend et du front-end puis construit Angular dans `frontend/dist/vite-gourmand/browser` ; Express sert ensuite ce build et l'API sur http://localhost:3000.

### Statistiques MongoDB

Les commandes créées par le script SQL ne passent pas par le site : pour les recopier dans MongoDB (sans doublon, le script peut être relancé) :

```bash
npm run stats:sync --prefix backend
```

## Tests

```bash
npm test --prefix backend                 # 431 tests (node:test)
cd frontend && npx ng test --watch=false  # 365 tests (Vitest)
```

## Déploiement (Railway)

- Le service web est relié à la branche **`main`** : chaque push déclenche un déploiement (Railpack, Node 22). Commandes : `npm run build` puis `npm start` (scripts de la racine). Le script `build` installe aussi les devDependencies du front-end, nécessaires à `ng build` même quand `NODE_ENV=production`.
- MySQL est un service Railway joignable uniquement par le réseau privé ; la base a été créée avec `database/vite_gourmand.sql`.
- MongoDB est hébergé sur MongoDB Atlas (utilisateur limité à la base des statistiques). Après la création de la base, `scripts/synchroniser-stats.js` a été lancé une fois dans le conteneur de production.
- L'offre Hobby de Railway bloque le SMTP sortant : en production, les mails passent par l'API HTTPS de Mailtrap (`MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID`).
- Variables de production : `NODE_ENV=production`, `FRONTEND_URL`, `PORT`, `DB_*`, `MONGO_URI`, `JWT_SECRET`, `MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID`, `CONTACT_DESTINATAIRE`, `TZ=Europe/Paris` (aussi sur le service MySQL).

## Organisation Git

- `main` : version en production ; `develop` : version de développement testée.
- Chaque fonctionnalité ou correction est développée sur une branche `feature/…` ou `fix/…` créée depuis `develop`, testée, puis fusionnée dans `develop` avec `--no-ff`.
- `develop` est fusionnée dans `main` (`--no-ff`) une fois testée, ce qui déclenche le déploiement.

## Sécurité (résumé)

- Mots de passe hachés avec bcrypt ; politique de mot de passe fort vérifiée côté serveur.
- Authentification par JWT ; rôles vérifiés par le serveur sur chaque route (client, employé, administrateur) ; aucune route ne crée d'administrateur.
- Requêtes SQL préparées ; données validées côté serveur (listes blanches) ; prix et distance recalculés par le serveur.
- Contenu échappé dans les mails ; Angular échappe l'affichage ; CSP `script-src 'self'` en deuxième barrière contre le XSS.
- Limite de 5 échecs de connexion par 15 minutes et de 5 demandes de réinitialisation par heure (réponse 429).
- Mot de passe oublié : jeton aléatoire à usage unique valable 30 minutes, seule son empreinte SHA-256 est stockée, même réponse que le compte existe ou non.
- Secrets uniquement dans `.env` (local) et dans les variables Railway.

## Documentation

Le dossier `docs/` contient le manuel d'utilisation, la charte graphique (palette, polices, maquettes) et la documentation technique (modèle de données, architecture, sécurité, déploiement).
