/* ================================================================
   MIDDLEWARE/AUTH.MIDDLEWARE.JS
   Middlewares de vérification des droits d'accès
   ================================================================ */

/**
 * Vérifie que l'utilisateur est connecté
 */
function authRequired(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Vous devez être connecté.' });
    }
    next();
}

/**
 * Vérifie que l'utilisateur est administrateur
 */
function adminRequired(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
}

/**
 * Vérifie que l'utilisateur est employé ou administrateur
 */
function employeRequired(req, res, next) {
    const role = req.session.user?.role;
    if (!role || (role !== 'employe' && role !== 'admin')) {
        return res.status(403).json({ error: 'Accès réservé aux employés.' });
    }
    next();
}

module.exports = { authRequired, adminRequired, employeRequired };
