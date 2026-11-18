/* ================================================================
   CONFIG/SECURITE.JS
   En-têtes de sécurité (helmet), CORS et limitation des tentatives
   ================================================================
   Tout est réglé ici et branché dans server.js et auth.routes.js.
   Les fonctions reçoivent l'environnement en paramètre (process.env
   par défaut) : les tests peuvent ainsi simuler la production.

   NODE_ENV=production doit être défini chez l'hébergeur (Railway) :
   - CORS n'accepte alors que FRONTEND_URL ;
   - Express fait confiance au proxy de Railway pour lire la vraie
     adresse IP du visiteur (sinon tous les visiteurs auraient l'IP
     du proxy et partageraient le même compteur de tentatives).
   ================================================================ */

const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const enProduction = (env = process.env) => env.NODE_ENV === 'production';

/* ----------------------------------------------------------------
   HELMET — en-têtes HTTP de sécurité
   ----------------------------------------------------------------
   Content-Security-Policy (CSP) : liste des sources autorisées.
   Le site Angular est servi par Express (même origine) et n'utilise
   aucune ressource externe (polices auto-hébergées, Chart.js dans le
   build, images dans assets/) : 'self' suffit partout.
   - script-src 'self' : aucun script en ligne ni venu d'ailleurs ;
     c'est la protection principale contre le XSS ;
   - style-src 'unsafe-inline' : Angular injecte les styles de chaque
     composant dans des balises <style> au moment de l'affichage ;
     les styles ne peuvent pas exécuter de code ;
   - img-src data: : petites images SVG intégrées au CSS ;
   - frame-ancestors 'none' : le site ne peut pas être affiché dans
     une iframe d'un autre site (protection contre le clickjacking) ;
   - upgrade-insecure-requests seulement en production (HTTPS) :
     en local, le site est en HTTP.
   Referrer-Policy: no-referrer (valeur par défaut de helmet) : l'adresse
   de la page, qui contient le jeton de réinitialisation, n'est jamais
   envoyée à un autre site.
   ---------------------------------------------------------------- */
function optionsHelmet(env = process.env) {
    return {
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                fontSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                ...(enProduction(env) ? { upgradeInsecureRequests: [] } : {})
            }
        }
    };
}

const enTetesSecurite = (env = process.env) => helmet(optionsHelmet(env));

/* ----------------------------------------------------------------
   CORS — quels sites ont le droit d'appeler l'API depuis un navigateur
   ----------------------------------------------------------------
   En production, le front et l'API ont la même adresse : CORS ne sert
   qu'à refuser les AUTRES sites. Seule FRONTEND_URL est acceptée ;
   si elle manque, aucun autre site n'est accepté (jamais « * »).
   En développement, ng serve (port 4200) passe par un proxy : on
   accepte FRONTEND_URL ou, à défaut, http://localhost:4200.
   ---------------------------------------------------------------- */
function origineCors(env = process.env) {
    const url = (env.FRONTEND_URL || '').replace(/\/+$/, '');
    if (enProduction(env)) return url || false;
    return url || 'http://localhost:4200';
}

function optionsCors(env = process.env) {
    return {
        origin: origineCors(env),
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    };
}

/* ----------------------------------------------------------------
   LIMITATION DES TENTATIVES (express-rate-limit)
   ----------------------------------------------------------------
   Compteur par adresse IP, gardé en mémoire (un seul serveur).
   Au-delà de la limite : 429 Too Many Requests, message en français
   au même format que les autres erreurs de l'API ({ error }), et
   en-tête Retry-After (secondes avant de pouvoir réessayer).
   ---------------------------------------------------------------- */
const QUINZE_MINUTES = 15 * 60 * 1000;
const UNE_HEURE = 60 * 60 * 1000;

const MESSAGE_TROP_CONNEXIONS =
    'Trop de tentatives de connexion échouées. Réessayez dans 15 minutes '
    + 'ou utilisez « Mot de passe oublié ? ».';
const MESSAGE_TROP_DEMANDES =
    'Trop de demandes de réinitialisation depuis cette connexion. Réessayez dans une heure.';

function creerLimite({ fenetre, maximum, message, ignorerReussites = false }) {
    return rateLimit({
        windowMs: fenetre,
        limit: maximum,
        // Connexion : seules les tentatives ÉCHOUÉES comptent (réponse ≥ 400)
        skipSuccessfulRequests: ignorerReussites,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({ error: message })
    });
}

/** Connexion : 5 échecs par IP et par quart d'heure (attaque par force brute) */
const creerLimiteConnexion = () => creerLimite({
    fenetre: QUINZE_MINUTES, maximum: 5, message: MESSAGE_TROP_CONNEXIONS, ignorerReussites: true
});

/** Mot de passe oublié : 5 demandes par IP et par heure (pas d'inondation de mails) */
const creerLimiteDemandeReinitialisation = () => creerLimite({
    fenetre: UNE_HEURE, maximum: 5, message: MESSAGE_TROP_DEMANDES
});

module.exports = {
    enProduction,
    optionsHelmet,
    enTetesSecurite,
    origineCors,
    optionsCors,
    creerLimiteConnexion,
    creerLimiteDemandeReinitialisation,
    MESSAGE_TROP_CONNEXIONS,
    MESSAGE_TROP_DEMANDES
};
