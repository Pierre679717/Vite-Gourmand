/* ================================================================
   CONFIG/DB.MONGO.JS
   Connexion à MongoDB Atlas + modèle Stat
   ================================================================ */

const mongoose = require('mongoose');

// Schéma pour les statistiques de visite
const StatSchema = new mongoose.Schema({
    type:    String,    // 'visite', 'commande', 'inscription'
    page:    String,
    date:    { type: Date, default: Date.now },
    details: Object
});

let StatModel = null;

async function connectMongo() {
    try {
        if (!process.env.MONGO_URI) {
            console.log('⚠️  MongoDB non configuré (MONGO_URI manquant dans .env)');
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        StatModel = mongoose.model('Stat', StatSchema);
        console.log('✅ Connexion MongoDB réussie');
    } catch (err) {
        console.error('❌ Erreur MongoDB :', err.message);
    }
}

// Sauvegarder une stat (ne plante pas si MongoDB est absent)
async function sauvegarderStat(type, details = {}) {
    try {
        if (StatModel) {
            await new StatModel({ type, details }).save();
        }
    } catch (err) {
        console.error('Erreur stat MongoDB :', err.message);
    }
}

module.exports = { connectMongo, sauvegarderStat, getStatModel: () => StatModel };
