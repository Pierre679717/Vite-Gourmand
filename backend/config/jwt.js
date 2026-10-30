/* ================================================================
   CONFIG/JWT.JS
   Configuration centralisée des JSON Web Tokens
   ================================================================
   Le secret n'a AUCUNE valeur par défaut : s'il manque, le serveur
   refuse de démarrer (voir verifierConfigJwt() appelé dans server.js).
   Un secret codé en dur dans le dépôt permettrait à n'importe qui
   de forger un token administrateur.
   ================================================================ */

const LONGUEUR_MIN_SECRET = 32;

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

/**
 * Arrête le processus si JWT_SECRET est absent ou trop court.
 * À appeler au tout début de server.js, avant app.listen().
 */
function verifierConfigJwt() {
    if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET est absent. Ajoutez-le dans le fichier .env (voir .env.example).');
        process.exit(1);
    }
    if (JWT_SECRET.length < LONGUEUR_MIN_SECRET) {
        console.error(`❌ JWT_SECRET doit contenir au moins ${LONGUEUR_MIN_SECRET} caractères.`);
        process.exit(1);
    }
}

module.exports = { JWT_SECRET, JWT_EXPIRES, verifierConfigJwt };
