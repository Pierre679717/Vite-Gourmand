/* ================================================================
   CONTROLLERS/AVIS.CONTROLLER.JS
   ================================================================
   Règles du sujet :
   - un client donne un avis (note 1 à 5 + commentaire) sur une de
     SES commandes, une fois qu'elle est "terminée" ;
   - un seul avis par commande (contrainte UNIQUE en base) ;
   - l'avis est "en attente" jusqu'à ce qu'un employé le valide :
     seuls les avis validés sont affichés publiquement.
   ================================================================ */

const { pool } = require('../config/db.mysql');

class AvisController {

    /**
     * POST /api/avis
     */
    static async creer(req, res) {
        try {
            const { note, commentaire, commande_id } = req.body;

            if (!Number.isInteger(note) || note < 1 || note > 5) {
                return res.status(400).json({ error: 'La note doit être un entier entre 1 et 5.' });
            }
            if (!commentaire || !commentaire.trim()) {
                return res.status(400).json({ error: 'Le commentaire est requis.' });
            }
            if (!commande_id) {
                return res.status(400).json({ error: 'La commande concernée est requise.' });
            }

            // La commande doit appartenir au client connecté et être terminée
            const [commandes] = await pool.query(
                'SELECT statut FROM commande WHERE commande_id = ? AND utilisateur_id = ?',
                [commande_id, req.user.id]
            );
            if (commandes.length === 0) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }
            if (commandes[0].statut !== 'terminee') {
                return res.status(400).json({ error: 'Vous pourrez donner votre avis une fois la commande terminée.' });
            }

            await pool.query(
                'INSERT INTO avis (note, commentaire, commande_id, utilisateur_id) VALUES (?, ?, ?, ?)',
                [note, commentaire.trim(), commande_id, req.user.id]
            );
            res.status(201).json({ message: 'Merci ! Votre avis sera publié après validation.' });

        } catch (err) {
            // La contrainte UNIQUE (commande_id) refuse un deuxième avis
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Vous avez déjà donné votre avis sur cette commande.' });
            }
            console.error('Erreur avis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * GET /api/avis
     * Avis validés uniquement, pour la page d'accueil.
     * On n'expose que le prénom et l'initiale du nom (minimisation RGPD),
     * ainsi que le titre du menu commandé (« Lucie M. · Menu Gastronomique »).
     */
    static async lister(req, res) {
        try {
            const [avis] = await pool.query(
                `SELECT a.avis_id, a.note, a.commentaire, a.date_creation,
                        u.prenom, CONCAT(LEFT(u.nom, 1), '.') AS initiale_nom,
                        m.titre AS menu
                 FROM avis a
                 JOIN utilisateur u ON u.utilisateur_id = a.utilisateur_id
                 JOIN commande c    ON c.commande_id    = a.commande_id
                 JOIN menu m        ON m.menu_id        = c.menu_id
                 WHERE a.statut = 'valide'
                 ORDER BY a.date_creation DESC
                 LIMIT 20`
            );
            res.json(avis);
        } catch (err) {
            console.error('Erreur liste avis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AvisController;
