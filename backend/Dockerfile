# ================================================================
# DOCKERFILE — Vite & Gourmand
# ================================================================
# Image de base : Node.js 20 LTS sur Alpine (image légère)
FROM node:20-alpine

# Métadonnées
LABEL maintainer="Pierre — Vite & Gourmand"
LABEL description="Application web traiteur gastronomique Bordeaux"

# Définir le dossier de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances en premier
# (optimisation du cache Docker : si package.json ne change pas,
#  npm install ne sera pas relancé à chaque build)
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm install --production

# Copier tout le code source dans le conteneur
COPY . .

# Exposer le port utilisé par l'application
EXPOSE 3000

# Commande de démarrage
CMD ["node", "server.js"]
