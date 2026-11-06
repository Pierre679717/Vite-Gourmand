/* ================================================================
   SERVER.JS - Point d'entrée principal — Vite & Gourmand
   ================================================================ */

require('dotenv').config();

// Refuse de démarrer si JWT_SECRET est absent ou trop court
const { verifierConfigJwt } = require('./config/jwt');
verifierConfigJwt();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// Connexions BDD
const { testConnexion } = require('./config/db.mysql');
const { connectMongo }  = require('./config/db.mongo');

// Routeurs
const authRoutes     = require('./routes/auth.routes');
const menuRoutes     = require('./routes/menu.routes');
const commandeRoutes = require('./routes/commande.routes');
const contactRoutes  = require('./routes/contact.routes');
const avisRoutes     = require('./routes/avis.routes');
const employeRoutes  = require('./routes/employe.routes');
const adminRoutes    = require('./routes/admin.routes');
const horaireRoutes  = require('./routes/horaire.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ================================================================
   CHEMIN DU FRONTEND (build Angular)
   ================================================================
   « ng build » produit le site dans frontend/dist/vite-gourmand/browser.
   En production, Express sert à la fois ce dossier et l'API : une seule
   origine, donc pas besoin de CORS ni de proxy.
   En développement, on utilise plutôt « ng serve » (port 4200) et son
   proxy vers l'API (port 3000).
   ================================================================ */
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist', 'vite-gourmand', 'browser');
const indexFile    = path.join(frontendPath, 'index.html');

/* ================================================================
   MIDDLEWARES GLOBAUX
   ================================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration CORS — autorise le front à envoyer le header Authorization
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Fichiers du build (JS, CSS, images, polices).
// Leurs noms contiennent une empreinte (main-M5JGVSHK.js) qui change à chaque
// modification : le navigateur peut donc les garder en cache longtemps.
// index.html, lui, ne doit jamais être mis en cache (sinon le navigateur
// garderait les anciens noms de fichiers après une mise à jour).
app.use(express.static(frontendPath, {
    index: false,
    maxAge: '1y',
    immutable: true
}));

/* ================================================================
   ROUTES API
   ================================================================ */
app.use('/api',           authRoutes);
app.use('/api/menus',     menuRoutes);
app.use('/api/commandes', commandeRoutes);
app.use('/api/contact',   contactRoutes);
app.use('/api/avis',      avisRoutes);
app.use('/api/employe',   employeRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/horaires',  horaireRoutes);

/* ================================================================
   ROUTES INCONNUES
   ================================================================ */
// Une route d'API inconnue renvoie une erreur JSON, pas la page du site
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route API inconnue.' });
});

// Toutes les autres adresses (/menus, /espace-admin...) renvoient index.html :
// c'est le routeur d'Angular, dans le navigateur, qui affiche la bonne page.
// Sans cela, actualiser la page sur /menus donnerait une erreur 404.
app.get('*', (req, res) => {
    if (!fs.existsSync(indexFile)) {
        return res.status(503).json({
            error: 'Frontend non construit. Lancez « npm run build » à la racine du projet.'
        });
    }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
});

/* ================================================================
   DÉMARRAGE DU SERVEUR
   ================================================================ */
app.listen(PORT, async () => {
    console.log('');
    console.log('🍽️  Serveur Vite & Gourmand démarré');
    console.log('📍 http://localhost:' + PORT);
    console.log('🔐 Authentification : JWT (stateless)');
    console.log('');
    await testConnexion();
    await connectMongo();
    console.log('');
});
