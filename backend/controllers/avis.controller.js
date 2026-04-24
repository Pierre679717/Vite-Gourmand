/* ================================================================
   CONTROLLERS/AVIS.CONTROLLER.JS
   ================================================================ */

const { pool } = require('../config/db.mysql');

class AvisController {

    static async creer(req, res) {
        try {
            const { note, commentaire, commande_id } = req.body;
            if (!note || note < 1 || note > 5) {
                return res.status(400).json({ error: 'La note doit être entre 1 et 5.' });
            }
            await pool.query(
                'INSERT INTO avis (utilisateur_id, commande_id, note, commentaire) VALUES (?, ?, ?, ?)',
                [req.session.user.id, commande_id || null, note, commentaire || null]
            );
            res.status(201).json({ message: 'Avis enregistré !' });
        } catch (err) {
            console.error('Erreur avis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    static async lister(req, res) {
        try {
            const [avis] = await pool.query(
                'SELECT a.*, u.prenom, u.nom FROM avis a JOIN utilisateurs u ON a.utilisateur_id = u.id ORDER BY a.date_creation DESC LIMIT 20'
            );
            res.json(avis);
        } catch (err) {
            console.error('Erreur liste avis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AvisController;
