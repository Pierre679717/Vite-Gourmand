/* ================================================================
   CONTROLLERS/AUTH.CONTROLLER.JS
   Logique métier pour l'authentification
   (Couche Controller du pattern MVC)
   ================================================================ */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UtilisateurModel = require('../models/utilisateur.model');
const { sauvegarderStat } = require('../config/db.mongo');
const { envoyerEmail } = require('../config/email');

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
     * Authentifier un utilisateur et créer sa session
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

            // Comparer le mot de passe avec le hash stocké
            const motDePasseCorrect = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
            if (!motDePasseCorrect) {
                return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
            }

            // Créer la session (côté serveur)
            req.session.user = {
                id:     user.id,
                nom:    user.nom,
                prenom: user.prenom,
                email:  user.email,
                role:   user.role
            };

            res.json({ message: 'Connexion réussie', user: req.session.user });

        } catch (err) {
            console.error('Erreur connexion :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/deconnexion
     * Détruire la session de l'utilisateur
     */
    static deconnexion(req, res) {
        req.session.destroy();
        res.json({ message: 'Déconnexion réussie.' });
    }

    /**
     * GET /api/profil
     * Retourner les informations de l'utilisateur connecté
     */
    static profil(req, res) {
        res.json({ user: req.session.user });
    }
}

module.exports = AuthController;
