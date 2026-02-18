/* ================================================================
   SERVER.JS - Serveur principal Vite & Gourmand
   ================================================================
   
   Lancer : npm start (ou npm run dev pour le développement)
   
   Routes API :
   - POST /api/inscription     → Créer un compte
   - POST /api/connexion       → Se connecter
   - GET  /api/deconnexion     → Se déconnecter
   - GET  /api/profil          → Voir son profil
   - POST /api/mot-de-passe-oublie → Demander réinitialisation
   
   - GET  /api/menus           → Liste des menus
   - GET  /api/menus/:id       → Détail d'un menu
   
   - POST /api/commandes       → Passer une commande
   - GET  /api/commandes       → Mes commandes (client)
   
   - POST /api/contact         → Envoyer un message
   
   - POST /api/avis            → Laisser un avis
   - GET  /api/avis            → Liste des avis
   
   - GET  /api/admin/stats          → Statistiques (admin)
   - GET  /api/admin/commandes      → Toutes les commandes (admin)
   - GET  /api/employe/commandes    → Commandes à gérer (employé)
   
   ================================================================ */

require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


/* ================================================================
   MIDDLEWARE
   ================================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '..', 'frontend', 'html')));

// Sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'vite-gourmand-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));


/* ================================================================
   CONNEXION MYSQL
   ================================================================ */
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vite_gourmand',
    waitForConnections: true,
    connectionLimit: 10
});

// Tester la connexion MySQL
async function testMySQL() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Connexion MySQL réussie');
        conn.release();
    } catch (err) {
        console.error('❌ Erreur MySQL :', err.message);
    }
}


/* ================================================================
   CONNEXION MONGODB (statistiques)
   ================================================================ */
const StatSchema = new mongoose.Schema({
    type: String,       // 'visite', 'commande', 'inscription'
    page: String,
    date: { type: Date, default: Date.now },
    details: Object
});
let StatModel;

async function connectMongo() {
    try {
        if (process.env.MONGO_URI) {
            await mongoose.connect(process.env.MONGO_URI);
            StatModel = mongoose.model('Stat', StatSchema);
            console.log('✅ Connexion MongoDB réussie');
        } else {
            console.log('⚠️  MongoDB non configuré (MONGO_URI manquant dans .env)');
        }
    } catch (err) {
        console.error('❌ Erreur MongoDB :', err.message);
    }
}


/* ================================================================
   EMAIL (Nodemailer)
   ================================================================ */
let transporter;
try {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
} catch (err) {
    console.log('⚠️  Email non configuré');
}

async function envoyerEmail(to, subject, html) {
    if (!transporter || !process.env.EMAIL_USER) {
        console.log('📧 Email simulé vers', to, ':', subject);
        return;
    }
    try {
        await transporter.sendMail({
            from: '"Vite & Gourmand" <' + process.env.EMAIL_USER + '>',
            to: to,
            subject: subject,
            html: html
        });
    } catch (err) {
        console.error('Erreur envoi email :', err.message);
    }
}


/* ================================================================
   MIDDLEWARE : Vérifier si connecté
   ================================================================ */
function authRequired(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Vous devez être connecté.' });
    }
    next();
}

function adminRequired(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
}

function employeRequired(req, res, next) {
    if (!req.session.user || (req.session.user.role !== 'employe' && req.session.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Accès réservé aux employés.' });
    }
    next();
}


/* ================================================================
   ROUTES : AUTHENTIFICATION
   ================================================================ */

// --- INSCRIPTION ---
app.post('/api/inscription', async (req, res) => {
    try {
        var { nom, prenom, email, telephone, mot_de_passe } = req.body;

        // Validation
        if (!nom || !prenom || !email || !mot_de_passe) {
            return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
        }
        if (mot_de_passe.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }

        // Vérifier si l'email existe déjà
        var [existing] = await pool.query('SELECT id FROM utilisateurs WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
        }

        // Hasher le mot de passe
        var hash = await bcrypt.hash(mot_de_passe, 10);

        // Insérer en base
        var [result] = await pool.query(
            'INSERT INTO utilisateurs (nom, prenom, email, telephone, mot_de_passe, role) VALUES (?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, telephone || null, hash, 'client']
        );

        // Envoyer email de bienvenue
        await envoyerEmail(email, 'Bienvenue chez Vite & Gourmand !',
            '<h1>Bienvenue ' + prenom + ' !</h1>' +
            '<p>Votre compte a été créé avec succès.</p>' +
            '<p>Vous pouvez maintenant commander nos menus gastronomiques.</p>' +
            '<p>L\'équipe Vite & Gourmand</p>'
        );

        // Sauvegarder la stat dans MongoDB
        if (StatModel) {
            await new StatModel({ type: 'inscription', details: { email: email } }).save();
        }

        res.status(201).json({ message: 'Compte créé avec succès !', id: result.insertId });

    } catch (err) {
        console.error('Erreur inscription :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- CONNEXION ---
app.post('/api/connexion', async (req, res) => {
    try {
        var { email, mot_de_passe } = req.body;

        if (!email || !mot_de_passe) {
            return res.status(400).json({ error: 'E-mail et mot de passe requis.' });
        }

        var [users] = await pool.query('SELECT * FROM utilisateurs WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
        }

        var user = users[0];
        var match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!match) {
            return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
        }

        // Créer la session
        req.session.user = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role
        };

        res.json({ message: 'Connexion réussie', user: req.session.user });

    } catch (err) {
        console.error('Erreur connexion :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- DÉCONNEXION ---
app.get('/api/deconnexion', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Déconnexion réussie.' });
});

// --- PROFIL ---
app.get('/api/profil', authRequired, (req, res) => {
    res.json({ user: req.session.user });
});

// --- MOT DE PASSE OUBLIÉ ---
app.post('/api/mot-de-passe-oublie', async (req, res) => {
    try {
        var { email } = req.body;

        var [users] = await pool.query('SELECT id, prenom FROM utilisateurs WHERE email = ?', [email]);
        if (users.length === 0) {
            // On ne révèle pas si l'email existe ou non (sécurité)
            return res.json({ message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.' });
        }

        var user = users[0];
        var token = crypto.randomBytes(32).toString('hex');
        var expireAt = new Date(Date.now() + 3600000); // 1 heure

        await pool.query(
            'INSERT INTO tokens_reinitialisation (utilisateur_id, token, expire_at) VALUES (?, ?, ?)',
            [user.id, token, expireAt]
        );

        await envoyerEmail(email, 'Réinitialisation de votre mot de passe',
            '<h1>Bonjour ' + user.prenom + '</h1>' +
            '<p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p>' +
            '<a href="http://localhost:' + PORT + '/reset-password.html?token=' + token + '">Réinitialiser mon mot de passe</a>' +
            '<p>Ce lien expire dans 1 heure.</p>'
        );

        res.json({ message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.' });

    } catch (err) {
        console.error('Erreur mot de passe oublié :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : MENUS
   ================================================================ */

// --- LISTE DES MENUS ---
app.get('/api/menus', async (req, res) => {
    try {
        var [menus] = await pool.query('SELECT * FROM menus WHERE actif = 1');
        res.json(menus);
    } catch (err) {
        console.error('Erreur menus :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- DÉTAIL D'UN MENU ---
app.get('/api/menus/:id', async (req, res) => {
    try {
        var [menus] = await pool.query('SELECT * FROM menus WHERE id = ?', [req.params.id]);
        if (menus.length === 0) {
            return res.status(404).json({ error: 'Menu non trouvé.' });
        }

        var [plats] = await pool.query('SELECT * FROM plats WHERE menu_id = ? ORDER BY FIELD(categorie, "entree", "poisson", "plat_principal", "fromage", "dessert")', [req.params.id]);

        res.json({ menu: menus[0], plats: plats });

    } catch (err) {
        console.error('Erreur détail menu :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : COMMANDES
   ================================================================ */

// --- PASSER UNE COMMANDE ---
// Réduction de 10% si +5 personnes
app.post('/api/commandes', authRequired, async (req, res) => {
    try {
        var { menu_id, nombre_personnes, date_evenement, adresse_livraison, commentaire } = req.body;

        if (!menu_id || !nombre_personnes) {
            return res.status(400).json({ error: 'Menu et nombre de personnes requis.' });
        }

        // Récupérer le menu
        var [menus] = await pool.query('SELECT * FROM menus WHERE id = ? AND actif = 1', [menu_id]);
        if (menus.length === 0) {
            return res.status(404).json({ error: 'Menu non trouvé.' });
        }

        var menu = menus[0];

        // Vérifier le minimum de personnes
        if (nombre_personnes < menu.minimum_personnes) {
            return res.status(400).json({ error: 'Minimum ' + menu.minimum_personnes + ' personnes pour ce menu.' });
        }

        // Calcul du prix avec réduction
        var prixUnitaire = parseFloat(menu.prix);
        var reduction = 0;
        var prixTotal = prixUnitaire * nombre_personnes;

        // Réduction 10% si plus de 5 personnes
        if (nombre_personnes > 5) {
            reduction = 10;
            prixTotal = prixTotal * 0.9;
        }

        // Insérer la commande
        var [result] = await pool.query(
            'INSERT INTO commandes (utilisateur_id, menu_id, nombre_personnes, prix_unitaire, reduction, prix_total, date_evenement, adresse_livraison, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.session.user.id, menu_id, nombre_personnes, prixUnitaire, reduction, prixTotal, date_evenement || null, adresse_livraison || null, commentaire || null]
        );

        // Stat MongoDB
        if (StatModel) {
            await new StatModel({
                type: 'commande',
                details: { menu_id: menu_id, prix_total: prixTotal, personnes: nombre_personnes }
            }).save();
        }

        res.status(201).json({
            message: 'Commande enregistrée !',
            commande: {
                id: result.insertId,
                menu: menu.nom,
                nombre_personnes: nombre_personnes,
                prix_unitaire: prixUnitaire,
                reduction: reduction + '%',
                prix_total: prixTotal.toFixed(2) + ' €'
            }
        });

    } catch (err) {
        console.error('Erreur commande :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- MES COMMANDES (client) ---
app.get('/api/commandes', authRequired, async (req, res) => {
    try {
        var [commandes] = await pool.query(
            'SELECT c.*, m.nom AS menu_nom FROM commandes c JOIN menus m ON c.menu_id = m.id WHERE c.utilisateur_id = ? ORDER BY c.date_commande DESC',
            [req.session.user.id]
        );
        res.json(commandes);
    } catch (err) {
        console.error('Erreur mes commandes :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : CONTACT
   ================================================================ */
app.post('/api/contact', async (req, res) => {
    try {
        var { nom, email, telephone, sujet, message } = req.body;

        if (!nom || !email || !sujet || !message) {
            return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
        }

        await pool.query(
            'INSERT INTO messages_contact (nom, email, telephone, sujet, message) VALUES (?, ?, ?, ?, ?)',
            [nom, email, telephone || null, sujet, message]
        );

        // Notification par email à l'admin
        await envoyerEmail('admin@vite-gourmand.fr', 'Nouveau message de contact : ' + sujet,
            '<p><strong>De :</strong> ' + nom + ' (' + email + ')</p>' +
            '<p><strong>Sujet :</strong> ' + sujet + '</p>' +
            '<p><strong>Message :</strong></p><p>' + message + '</p>'
        );

        res.status(201).json({ message: 'Message envoyé avec succès !' });

    } catch (err) {
        console.error('Erreur contact :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : AVIS
   ================================================================ */

// --- LAISSER UN AVIS ---
app.post('/api/avis', authRequired, async (req, res) => {
    try {
        var { note, commentaire, commande_id } = req.body;

        if (!note || note < 1 || note > 5) {
            return res.status(400).json({ error: 'La note doit être entre 1 et 5.' });
        }

        await pool.query(
            'INSERT INTO avis (utilisateur_id, commande_id, note, commentaire) VALUES (?, ?, ?, ?)',
            [req.session.user.id, commande_id || null, note, commentaire || null]
        );

        res.status(201).json({ message: 'Avis enregistré !' });

    } catch (err) {
        console.error('Erreur avis :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- LISTE DES AVIS ---
app.get('/api/avis', async (req, res) => {
    try {
        var [avis] = await pool.query(
            'SELECT a.*, u.prenom, u.nom FROM avis a JOIN utilisateurs u ON a.utilisateur_id = u.id ORDER BY a.date_creation DESC LIMIT 20'
        );
        res.json(avis);
    } catch (err) {
        console.error('Erreur avis :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : ESPACE EMPLOYÉ
   ================================================================ */

// --- LISTE DES COMMANDES (employé) ---
app.get('/api/employe/commandes', employeRequired, async (req, res) => {
    try {
        var [commandes] = await pool.query(
            'SELECT c.*, m.nom AS menu_nom, u.nom AS client_nom, u.prenom AS client_prenom, u.email AS client_email FROM commandes c JOIN menus m ON c.menu_id = m.id JOIN utilisateurs u ON c.utilisateur_id = u.id ORDER BY c.date_commande DESC'
        );
        res.json(commandes);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- MODIFIER LE STATUT D'UNE COMMANDE ---
app.put('/api/employe/commandes/:id', employeRequired, async (req, res) => {
    try {
        var { statut } = req.body;
        var statutsValides = ['en_attente', 'confirmee', 'en_cours', 'livree', 'annulee'];

        if (!statutsValides.includes(statut)) {
            return res.status(400).json({ error: 'Statut invalide.' });
        }

        await pool.query('UPDATE commandes SET statut = ? WHERE id = ?', [statut, req.params.id]);
        res.json({ message: 'Statut mis à jour.' });

    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- GÉRER LES MENUS (employé) ---
app.post('/api/employe/menus', employeRequired, async (req, res) => {
    try {
        var { nom, description, prix, theme, regime, image, minimum_personnes } = req.body;

        if (!nom || !prix) {
            return res.status(400).json({ error: 'Nom et prix requis.' });
        }

        var [result] = await pool.query(
            'INSERT INTO menus (nom, description, prix, theme, regime, image, minimum_personnes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nom, description, prix, theme, regime, image, minimum_personnes || 6]
        );

        res.status(201).json({ message: 'Menu créé !', id: result.insertId });

    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});


/* ================================================================
   ROUTES : ESPACE ADMIN
   ================================================================ */

// --- STATISTIQUES ---
app.get('/api/admin/stats', adminRequired, async (req, res) => {
    try {
        var [totalUsers] = await pool.query('SELECT COUNT(*) AS total FROM utilisateurs');
        var [totalCommandes] = await pool.query('SELECT COUNT(*) AS total FROM commandes');
        var [chiffreAffaires] = await pool.query('SELECT SUM(prix_total) AS total FROM commandes WHERE statut != "annulee"');
        var [totalMenus] = await pool.query('SELECT COUNT(*) AS total FROM menus WHERE actif = 1');
        var [moyenneAvis] = await pool.query('SELECT AVG(note) AS moyenne FROM avis');

        // Stats MongoDB si connecté
        var mongoStats = null;
        if (StatModel) {
            var visites = await StatModel.countDocuments({ type: 'visite' });
            var commandesMongo = await StatModel.countDocuments({ type: 'commande' });
            mongoStats = { visites: visites, commandes: commandesMongo };
        }

        res.json({
            utilisateurs: totalUsers[0].total,
            commandes: totalCommandes[0].total,
            chiffre_affaires: chiffreAffaires[0].total || 0,
            menus_actifs: totalMenus[0].total,
            note_moyenne: moyenneAvis[0].moyenne ? parseFloat(moyenneAvis[0].moyenne).toFixed(1) : 'N/A',
            mongodb_stats: mongoStats
        });

    } catch (err) {
        console.error('Erreur stats :', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- TOUTES LES COMMANDES (admin) ---
app.get('/api/admin/commandes', adminRequired, async (req, res) => {
    try {
        var [commandes] = await pool.query(
            'SELECT c.*, m.nom AS menu_nom, u.nom AS client_nom, u.prenom AS client_prenom FROM commandes c JOIN menus m ON c.menu_id = m.id JOIN utilisateurs u ON c.utilisateur_id = u.id ORDER BY c.date_commande DESC'
        );
        res.json(commandes);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- GÉRER LES EMPLOYÉS (admin) ---
app.get('/api/admin/employes', adminRequired, async (req, res) => {
    try {
        var [employes] = await pool.query(
            'SELECT id, nom, prenom, email, role, date_creation FROM utilisateurs WHERE role = "employe"'
        );
        res.json(employes);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.post('/api/admin/employes', adminRequired, async (req, res) => {
    try {
        var { nom, prenom, email, mot_de_passe } = req.body;
        var hash = await bcrypt.hash(mot_de_passe, 10);

        var [result] = await pool.query(
            'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, "employe")',
            [nom, prenom, email, hash]
        );

        res.status(201).json({ message: 'Employé créé !', id: result.insertId });

    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur.' });
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
    await testMySQL();
    await connectMongo();
    console.log('');
});
