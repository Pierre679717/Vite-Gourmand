/* ================================================================
   CONTROLLERS/AUTH.CONTROLLER.JS
   Authentification avec JWT (JSON Web Token)
   ================================================================
   - À la connexion, le serveur signe un token contenant
     id, nom, prenom, email et role.
   - Le client l'envoie ensuite dans le header
     Authorization: Bearer <token>.
   - Le middleware auth.middleware.js vérifie la signature et
     remplit req.user. Le serveur ne stocke aucune session.
   ================================================================ */

const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const UtilisateurModel = require('../models/utilisateur.model');
const { sauvegarderStat } = require('../config/db.mongo');
const { genererMailBienvenue } = require('../email/templates');
const { transporter, EXPEDITEUR } = require('../email/mailer');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt');
const { motDePasseValide, MESSAGE_MOT_DE_PASSE } = require('../utils/motDePasse');

/**
 * Envoie le mail de bienvenue sans bloquer l'inscription :
 * si l'envoi échoue, le compte reste créé et on journalise l'erreur.
 */
async function envoyerMailBienvenue(prenom, email) {
    try {
        const mail = genererMailBienvenue('client', { prenom, identifiant: email });
        await transporter.sendMail({ from: EXPEDITEUR, to: email, ...mail });
    } catch (err) {
        console.error('Mail de bienvenue non envoyé :', err.message);
    }
}

class AuthController {

    /**
     * POST /api/inscription
     * Créer un nouveau compte utilisateur
     */
    static async inscription(req, res) {
        try {
            const { nom, prenom, email, telephone, adresse_postale, code_postal, ville, mot_de_passe } = req.body;

            // Validation des champs obligatoires (le sujet exige le GSM et l'adresse postale)
            if (!nom || !prenom || !email || !telephone || !adresse_postale || !code_postal || !ville || !mot_de_passe) {
                return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
            }
            if (!/^[0-9]{5}$/.test(code_postal)) {
                return res.status(400).json({ error: 'Le code postal doit contenir 5 chiffres.' });
            }
            if (!motDePasseValide(mot_de_passe)) {
                return res.status(400).json({ error: MESSAGE_MOT_DE_PASSE });
            }

            // Vérifier si l'email existe déjà
            const emailPris = await UtilisateurModel.emailExiste(email);
            if (emailPris) {
                return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
            }

            // Hasher le mot de passe avec bcrypt (10 tours de salage)
            const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);

            // Créer l'utilisateur en base.
            // Le rôle est forcé à 'utilisateur' : il n'est jamais lu dans req.body,
            // donc impossible de s'inscrire comme employé ou administrateur.
            const id = await UtilisateurModel.creer({
                nom, prenom, email, telephone,
                adressePostale: adresse_postale, codePostal: code_postal, ville,
                motDePasseHash, role: 'utilisateur'
            });

            // Mail de bienvenue + stat MongoDB (non bloquants)
            await envoyerMailBienvenue(prenom, email);
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

            // Compte désactivé par l'administrateur (ex. ancien employé)
            if (!user.actif) {
                return res.status(403).json({ error: 'Ce compte est désactivé. Contactez Vite & Gourmand.' });
            }

            // ── JWT : Générer le token ────────────────────────────────
            // Le payload contient les infos de l'utilisateur (pas le mot de passe !)
            const payload = {
                id:     user.utilisateur_id,
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
