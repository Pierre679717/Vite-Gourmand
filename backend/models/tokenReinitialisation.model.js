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
const { etatJeton } = require('../utils/jetonReinitialisation');

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

    /**
     * Lit un jeton par son empreinte, sans rien modifier
     * (affichage de la page « Nouveau mot de passe »).
     * `expire` est calculé par MySQL. Renvoie la ligne ou null.
     */
    static async trouver(empreinte) {
        const [rows] = await pool.query(
            `SELECT t.utilisateur_id, t.utilise, (t.expire_le < NOW()) AS expire, u.actif
             FROM token_reinitialisation t
             JOIN utilisateur u ON u.utilisateur_id = t.utilisateur_id
             WHERE t.token_hash = ?`,
            [empreinte]
        );
        return rows[0] || null;
    }

    /**
     * Change le mot de passe du compte lié au jeton, dans UNE transaction :
     * 1. lecture du jeton avec FOR UPDATE : la ligne est verrouillée jusqu'au
     *    COMMIT, donc deux clics simultanés sur le même lien ne peuvent pas
     *    réussir tous les deux (le second attend, puis voit utilise = 1) ;
     * 2. etatJeton(ligne) décide si le jeton est utilisable
     *    (fonction pure de utils/jetonReinitialisation.js) ;
     * 3. nouveau hash du mot de passe ;
     * 4. TOUS les jetons encore valables du compte sont marqués utilisés.
     * Renvoie { etat } : 'valide' si le mot de passe a changé, sinon
     * 'invalide' | 'utilise' | 'expire' | 'desactive' (rien n'est modifié).
     */
    static async reinitialiser(empreinte, motDePasseHash) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.query(
                `SELECT t.utilisateur_id, t.utilise, (t.expire_le < NOW()) AS expire, u.actif
                 FROM token_reinitialisation t
                 JOIN utilisateur u ON u.utilisateur_id = t.utilisateur_id
                 WHERE t.token_hash = ?
                 FOR UPDATE`,
                [empreinte]
            );
            const ligne = rows[0] || null;

            let etat = etatJeton(ligne);
            if (etat === 'valide' && !Number(ligne.actif)) etat = 'desactive';
            if (etat !== 'valide') {
                await conn.rollback();
                return { etat };
            }

            await conn.query(
                'UPDATE utilisateur SET mot_de_passe = ? WHERE utilisateur_id = ?',
                [motDePasseHash, ligne.utilisateur_id]
            );
            await conn.query(
                `UPDATE token_reinitialisation
                 SET utilise = 1
                 WHERE utilisateur_id = ? AND utilise = 0`,
                [ligne.utilisateur_id]
            );

            await conn.commit();
            return { etat };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
}

module.exports = TokenReinitialisationModel;
