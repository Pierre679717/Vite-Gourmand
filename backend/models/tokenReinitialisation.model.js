/* ================================================================
   MODELS/TOKENREINITIALISATION.MODEL.JS
   Accès à la table token_reinitialisation (mot de passe oublié)
   ================================================================
   La table ne contient que l'EMPREINTE SHA-256 du jeton (token_hash),
   jamais le jeton lui-même.
   Les dates sont calculées par MySQL (NOW(), DATE_ADD) : l'écriture
   et la comparaison utilisent la même horloge, sans conversion de
   fuseau horaire côté Node.
   ================================================================ */

const { pool } = require('../config/db.mysql');

class TokenReinitialisationModel {

    /**
     * Enregistre un nouveau jeton pour un compte, valable `minutes` minutes.
     * Dans la même transaction, les jetons encore valables de ce compte
     * sont marqués comme utilisés : seul le DERNIER lien envoyé fonctionne.
     * Si l'insertion échoue, l'invalidation est annulée (ROLLBACK).
     */
    static async creer(utilisateurId, empreinte, minutes) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE token_reinitialisation
                 SET utilise = 1
                 WHERE utilisateur_id = ? AND utilise = 0`,
                [utilisateurId]
            );

            await conn.query(
                `INSERT INTO token_reinitialisation (token_hash, expire_le, utilisateur_id)
                 VALUES (?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
                [empreinte, minutes, utilisateurId]
            );

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
}

module.exports = TokenReinitialisationModel;
