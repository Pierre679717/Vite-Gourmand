/* ================================================================
   CONFIG/DB.MYSQL.JS
   Connexion à la base de données MySQL via un pool de connexions
   ================================================================ */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'vite_gourmand',
    waitForConnections: true,
    connectionLimit: 10,
    // Renvoyer DATE, DATETIME et TIME sous forme de texte ('2026-10-03').
    // Sans cette option, mysql2 crée des objets Date JavaScript en UTC :
    // une date_prestation au 03/10 pouvait s'afficher au 02/10 après
    // conversion de fuseau horaire.
    dateStrings: true,
    // Renvoyer les DECIMAL (prix) comme des nombres et non du texte :
    // "75.00" devient 75. Sans risque ici, nos prix restent bien en
    // dessous de la limite de précision des nombres JavaScript.
    decimalNumbers: true
});

// Tester la connexion au démarrage
async function testConnexion() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Connexion MySQL réussie');
        conn.release();
    } catch (err) {
        console.error('❌ Erreur MySQL :', err.message);
    }
}

module.exports = { pool, testConnexion };
