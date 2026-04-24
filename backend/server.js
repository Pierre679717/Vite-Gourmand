/* ================================================================
   SERVER.JS - Point d'entrée principal — Vite & Gourmand
   ================================================================
   
   CHANGEMENT JWT :
   - Suppression de express-session
   - Ajout de JWT_SECRET dans les variables d'environnement
   - L'authentification est maintenant stateless (sans état serveur)
   ================================================================ */

require('dotenv').config();

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

const app  = express();
const PORT = process.env.PORT || 3000;

/* ================================================================
   CHEMIN DU FRONTEND
   ================================================================ */
let frontendPath = path.join(__dirname, '..', 'frontend', 'html');
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.join(process.cwd(), 'frontend', 'html');
}

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

app.use(express.static(frontendPath));

// ── SUPPRIMÉ : express-session n'est plus nécessaire avec JWT ──
// app.use(session({ ... }))

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

/* ================================================================
   ROUTE PAR DÉFAUT → index.html
   ================================================================ */
app.get('*', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).json({ error: 'Frontend non trouvé.' });
    }
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
