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
    connectionLimit: 10
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
