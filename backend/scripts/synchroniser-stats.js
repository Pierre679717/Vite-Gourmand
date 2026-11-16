/* ================================================================
   SCRIPTS/SYNCHRONISER-STATS.JS
   Recopie toutes les commandes MySQL dans MongoDB (commandes_stats)
   ================================================================
   Lancement : cd backend && npm run stats:sync

   Pourquoi ce script ?
   - Le site écrit dans commandes_stats à chaque commande, modification
     ou changement de statut. Mais les commandes créées par le script SQL
     (données de démonstration) ne passent pas par le site : elles ne
     sont pas dans MongoDB.
   - En production, la base MongoDB Atlas démarre vide.
   - Si MongoDB a été indisponible un moment, des commandes manquent
     (l'enregistrement est volontairement non bloquant).

   MySQL reste la référence : chaque commande est recopiée avec un
   « upsert » (mise à jour si elle existe, création sinon), repérée par
   commande_id. On peut donc relancer le script autant de fois qu'on
   veut : aucun doublon n'est créé.
   ================================================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { pool } = require('../config/db.mysql');
const { StatCommande } = require('../models/statCommande.model');

const REQUETE_COMMANDES = `
    SELECT c.commande_id, c.numero_commande, c.menu_id, m.titre AS menu_titre,
           c.nombre_personne, c.prix_total, c.reduction, c.prix_livraison,
           c.ville_prestation, c.date_prestation, c.date_commande, c.statut
    FROM commande c
    JOIN menu m ON m.menu_id = c.menu_id
    ORDER BY c.commande_id`;

/**
 * Ligne MySQL → document commandes_stats (mêmes champs que ceux écrits
 * par le site au moment de la commande).
 * date_commande arrive en texte ('2026-11-14 21:18:05', option dateStrings) :
 * elle est lue à l'heure locale du serveur, celle où MySQL l'a écrite.
 */
function versDocumentStat(ligne) {
    return {
        commande_id:     ligne.commande_id,
        numero_commande: ligne.numero_commande,
        menu_id:         ligne.menu_id,
        menu_titre:      ligne.menu_titre,
        nombre_personne: ligne.nombre_personne,
        prix_total:      Number(ligne.prix_total),
        reduction:       Number(ligne.reduction),
        prix_livraison:  Number(ligne.prix_livraison),
        ville:           ligne.ville_prestation,
        date_prestation: String(ligne.date_prestation).slice(0, 10),
        date_commande:   new Date(String(ligne.date_commande).replace(' ', 'T')),
        statut:          ligne.statut
    };
}

/** Une opération « upsert » par commande, pour un seul bulkWrite */
function operationsSynchro(lignes) {
    return lignes.map((ligne) => {
        const document = versDocumentStat(ligne);
        return {
            updateOne: {
                filter: { commande_id: document.commande_id },
                update: { $set: document },
                upsert: true
            }
        };
    });
}

async function synchroniser() {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI manquant dans backend/.env : synchronisation impossible.');
        process.exitCode = 1;
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const [lignes] = await pool.query(REQUETE_COMMANDES);
        if (lignes.length === 0) {
            console.log('Aucune commande dans MySQL : rien à synchroniser.');
            return;
        }
        const resultat = await StatCommande.bulkWrite(operationsSynchro(lignes));
        console.log(`${lignes.length} commandes lues dans MySQL.`);
        console.log(`MongoDB : ${resultat.upsertedCount} ajoutées, ${resultat.modifiedCount} mises à jour, `
            + `${resultat.matchedCount - resultat.modifiedCount} déjà à jour.`);
    } catch (err) {
        console.error('Synchronisation interrompue :', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        await pool.end();
    }
}

// Lancé directement (npm run stats:sync) et non chargé par un test
if (require.main === module) {
    synchroniser();
}

module.exports = { versDocumentStat, operationsSynchro };
