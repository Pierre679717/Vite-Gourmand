/* ================================================================
   CONTROLLERS/AUTH.CONTROLLER.JS
   Authentification avec JWT (JSON Web Token)
   ================================================================
   
   AVANT (sessions Express) :
   - Le serveur stockait req.session.user en mémoire
   - Le client recevait un cookie de session
   
   APRÈS (JWT) :
   - Le serveur génère un token signé (JWT)
   - Le client stocke le token (localStorage ou cookie httpOnly)
   - Le client envoie le token dans le header : Authorization: Bearer <token>
   - Le serveur vérifie la signature du token à chaque requête
   - Le serveur ne stocke RIEN → sans état (stateless)
   ================================================================ */

const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const UtilisateurModel = require('../models/utilisateur.model');
const { sauvegarderStat } = require('../config/db.mongo');
const { genererMailBienvenue } = require('../email/templates');
const { transporter, EXPEDITEUR } = require('../email/mailer');

// Clé secrète pour signer les tokens (définie dans .env)
const JWT_SECRET  = process.env.JWT_SECRET  || 'vite-gourmand-jwt-secret-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

class AuthController {

    /**
     * POST /api/inscription
     * Créer un nouveau compte utilisateur
     */
    static async inscription(req, res) {
        try {
            const { nom, prenom, email, telephone, mot_de_passe } = req.body;

            // Validation des champs obligatoires
            if (!nom || !prenom || !email || !mot_de_passe) {
                return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
            }
            if (mot_de_passe.length < 8) {
                return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
            }

            // Vérifier si l'email existe déjà
            const emailPris = await UtilisateurModel.emailExiste(email);
            if (emailPris) {
                return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
            }

            // Hasher le mot de passe avec bcrypt (10 tours de salage)
            const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);

            // Créer l'utilisateur en base
            const id = await UtilisateurModel.creer({ nom, prenom, email, telephone, motDePasseHash });

            // Email de bienvenue + stat MongoDB (non bloquants)
            await envoyerEmail(email, 'Bienvenue chez Vite & Gourmand !',
                `<h1>Bienvenue ${prenom} !</h1>
                 <p>Votre compte a été créé avec succès.</p>
                 <p>L'équipe Vite & Gourmand</p>`
            );
            await sauvegarderStat('inscription', { email });

            res.status(201).json({ message: 'Compte créé avec succès !', id });

        } catch (err) {
            console.error('Erreur inscription :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/connexion
     * Authentifier un utilisateur et retourner un JWT
     * 
     * CHANGEMENT JWT :
     * - AVANT : req.session.user = { ... }  → stockage serveur
     * - APRÈS : jwt.sign({ ... })            → token retourné au client
     */
    static async connexion(req, res) {
        try {
            const { email, mot_de_passe } = req.body;

            if (!email || !mot_de_passe) {
                return res.status(400).json({ error: 'E-mail et mot de passe requis.' });
            }

            // Rechercher l'utilisateur par email
            const user = await UtilisateurModel.trouverParEmail(email);
            if (!user) {
                return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
            }

            // Comparer le mot de passe avec le hash stocké (bcrypt)
            const motDePasseCorrect = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
            if (!motDePasseCorrect) {
                return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
            }

            // ── JWT : Générer le token ────────────────────────────────
            // Le payload contient les infos de l'utilisateur (pas le mot de passe !)
            const payload = {
                id:     user.id,
                nom:    user.nom,
                prenom: user.prenom,
                email:  user.email,
                role:   user.role
            };

            // Signer le token avec la clé secrète + durée d'expiration
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

            // Retourner le token au client
            // Le client devra l'envoyer dans chaque requête :
            // Header : Authorization: Bearer <token>
            res.json({
                message: 'Connexion réussie',
                token,
                user: payload
            });

        } catch (err) {
            console.error('Erreur connexion :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * POST /api/deconnexion
     * Avec JWT, la déconnexion se fait côté client
     * (le client supprime simplement le token de son stockage)
     * 
     * CHANGEMENT JWT :
     * - AVANT : req.session.destroy()  → on détruisait la session serveur
     * - APRÈS : le client supprime son token → le serveur ne fait rien
     */
    static deconnexion(req, res) {
        // Avec JWT, le serveur n'a rien à détruire
        // C'est le client qui supprime le token de son localStorage
        res.json({ message: 'Déconnexion réussie. Supprimez le token côté client.' });
    }

    /**
     * GET /api/profil
     * Retourner les informations de l'utilisateur connecté
     * Les infos viennent maintenant du token décodé (req.user)
     * injecté par le middleware JWT
     */
    static profil(req, res) {
        // req.user est injecté par le middleware auth.middleware.js
        res.json({ user: req.user });
    }
}

module.exports = AuthController;
