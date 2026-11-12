/* ================================================================
   MODELS/STATCOMMANDE.MODEL.JS
   Statistiques des commandes dans MongoDB (base NoSQL)
   ================================================================
   MySQL reste la référence (commandes, stock, transactions).
   À chaque commande, une copie « à plat » des informations utiles
   aux statistiques est ajoutée dans la collection `commandes_stats` :
   nombre de commandes et chiffre d'affaires par menu, par période...
   Ces calculs (agrégations) se font ensuite dans MongoDB, sans
   charger la base MySQL qui sert les clients.

   Si MongoDB est absent ou en panne, la commande n'est PAS bloquée :
   l'erreur est seulement écrite dans la console du serveur.
   ================================================================ */

const mongoose = require('mongoose');

const statCommandeSchema = new mongoose.Schema(
    {
        commande_id:     { type: Number, required: true, unique: true }, // pas de doublon pour une même commande
        numero_commande: { type: String, required: true },
        menu_id:         { type: Number, required: true, index: true },
        menu_titre:      { type: String, required: true },
        nombre_personne: { type: Number, required: true, min: 1 },
        prix_total:      { type: Number, required: true, min: 0 },
        reduction:       { type: Number, default: 0 },
        prix_livraison:  { type: Number, default: 0 },
        ville:           { type: String },
        date_prestation: { type: String },               // AAAA-MM-JJ, comme dans MySQL
        date_commande:   { type: Date, default: Date.now, index: true },
        statut:          { type: String, default: 'en_attente' }
    },
    { collection: 'commandes_stats', versionKey: false }
);

// mongoose.models évite l'erreur « OverwriteModelError » si le fichier est chargé deux fois
const StatCommande = mongoose.models.StatCommande || mongoose.model('StatCommande', statCommandeSchema);

/**
 * Enregistre la statistique d'une commande.
 * Renvoie true si c'est fait, false sinon (MongoDB absent ou erreur).
 * Ne lance jamais d'exception : la commande MySQL est déjà validée.
 */
async function enregistrerStatCommande(donnees) {
    // 1 = connecté. Sans ce test, Mongoose mettrait l'opération en attente
    // pendant 10 secondes avant d'échouer.
    if (mongoose.connection.readyState !== 1) {
        return false;
    }
    try {
        await StatCommande.create(donnees);
        return true;
    } catch (err) {
        console.error('Statistique MongoDB non enregistrée :', err.message);
        return false;
    }
}

module.exports = { StatCommande, enregistrerStatCommande };
