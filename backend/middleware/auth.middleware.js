/* ================================================================
   MIDDLEWARE/AUTH.MIDDLEWARE.JS
   Vérification des tokens JWT
   ================================================================
   - Lit le token dans le header Authorization: Bearer <token>
   - Vérifie la signature avec jwt.verify()
   - Remplit req.user avec le contenu du token
     (id, nom, prenom, email, role)
   - Pour le personnel (employé, administrateur) : relit le compte
     en base, pour qu'une désactivation prenne effet immédiatement
   ================================================================ */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const UtilisateurModel = require('../models/utilisateur.model');

/**
 * Extraire et vérifier le token JWT depuis le header
 * Header attendu : Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
 */
function verifierToken(req, res, next) {
    // Lire le header Authorization
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
    }

    // Le format est "Bearer <token>" — on extrait la 2ème partie
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Format de token invalide. Utilisez : Bearer <token>' });
    }

    try {
        // Vérifier la signature et décoder le token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Injecter les données de l'utilisateur dans req
        // (accessible dans tous les controllers via req.user)
        req.user = decoded;
        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expiré. Veuillez vous reconnecter.' });
        }
        return res.status(401).json({ error: 'Token invalide.' });
    }
}

/**
 * Vérifie que l'utilisateur est connecté (token valide)
 */
function authRequired(req, res, next) {
    verifierToken(req, res, next);
}

/**
 * Fabrique un middleware réservé à certains rôles (personnel du site).
 *
 * Le token seul ne suffit pas : il reste valable 24 h. Si l'administrateur
 * désactive un employé, celui-ci doit perdre l'accès TOUT DE SUITE, pas le
 * lendemain. Le compte est donc relu en base à chaque requête :
 * - compte supprimé ou désactivé → 401 (le front déconnecte alors
 *   l'utilisateur et l'envoie vers la page de connexion) ;
 * - rôle en base non autorisé → 403.
 * C'est le rôle EN BASE qui fait foi, pas celui écrit dans le token.
 */
function exigerCompteActif(rolesAutorises, messageRefus) {
    return (req, res, next) => {
        verifierToken(req, res, async () => {
            try {
                const compte = await UtilisateurModel.trouverParId(req.user.id);
                if (!compte || !compte.actif) {
                    return res.status(401).json({
                        error: 'Ce compte est désactivé. Rapprochez-vous de l\'administrateur.'
                    });
                }
                if (!rolesAutorises.includes(compte.role)) {
                    return res.status(403).json({ error: messageRefus });
                }
                next();
            } catch (err) {
                console.error('Erreur vérification du compte :', err.message);
                res.status(500).json({ error: 'Erreur serveur.' });
            }
        });
    };
}

/**
 * Vérifie que l'utilisateur est un administrateur actif
 */
const adminRequired = exigerCompteActif(
    ['administrateur'], 'Accès réservé aux administrateurs.'
);

/**
 * Vérifie que l'utilisateur est un employé ou un administrateur actif
 */
const employeRequired = exigerCompteActif(
    ['employe', 'administrateur'], 'Accès réservé aux employés.'
);

module.exports = { authRequired, adminRequired, employeRequired };
