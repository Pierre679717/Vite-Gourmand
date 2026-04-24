/* ================================================================
   SERVER.JS - Point d'entrée principal — Vite & Gourmand
   ================================================================
   
   Architecture MVC :
   ┌─────────────────────────────────────────────┐
   │  server.js  (configuration + démarrage)     │
   ├─────────────────────────────────────────────┤
   │  routes/    (points d'entrée HTTP)          │
   │  controllers/ (logique métier)              │
   │  models/    (accès base de données)         │
   │  middleware/ (vérification droits)          │
   │  config/    (connexions BDD, email)         │
   └─────────────────────────────────────────────┘
   
   Lancer : npm start (production) / npm run dev (développement)
   ================================================================ */

require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

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
app.use(cors());
app.use(express.static(frontendPath));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'vite-gourmand-secret-2026',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

/* ================================================================
   ROUTES API
   ================================================================ */
app.use('/api',               authRoutes);
app.use('/api/menus',         menuRoutes);
app.use('/api/commandes',     commandeRoutes);
app.use('/api/contact',       contactRoutes);
app.use('/api/avis',          avisRoutes);
app.use('/api/employe',       employeRoutes);
app.use('/api/admin',         adminRoutes);

/* ================================================================
   ROUTE PAR DÉFAUT → index.html
   ================================================================ */
app.get('/', (req, res) => {
    const indexFile = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Frontend non trouvé. Chemin : ' + frontendPath);
    }
});

/* ================================================================
   DÉMARRAGE DU SERVEUR
   ================================================================ */
app.listen(PORT, async () => {
    console.log('');
    console.log('🍽️  Serveur Vite & Gourmand démarré');
    console.log('📍 http://localhost:' + PORT);
    console.log('');
    await testConnexion();
    await connectMongo();
    console.log('');
});
