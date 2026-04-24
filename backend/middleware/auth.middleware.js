/* ================================================================
   MIDDLEWARE/AUTH.MIDDLEWARE.JS
   Vérification des tokens JWT
   ================================================================
   
   AVANT (sessions) :
   - On vérifiait req.session.user
   - La session était stockée en mémoire serveur
   
   APRÈS (JWT) :
   - On lit le token depuis le header Authorization: Bearer <token>
   - On vérifie la signature avec jwt.verify()
   - On injecte req.user avec les données du token décodé
   - Aucun accès base de données nécessaire !
   ================================================================ */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vite-gourmand-jwt-secret-2026';

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
 * Vérifie que l'utilisateur est administrateur
 */
function adminRequired(req, res, next) {
    verifierToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
        }
        next();
    });
}

/**
 * Vérifie que l'utilisateur est employé ou administrateur
 */
function employeRequired(req, res, next) {
    verifierToken(req, res, () => {
        if (req.user.role !== 'employe' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès réservé aux employés.' });
        }
        next();
    });
}

module.exports = { authRequired, adminRequired, employeRequired };
