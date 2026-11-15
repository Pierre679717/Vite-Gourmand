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
const { idValide } = require('../utils/commandeClient');

const COMMENTAIRE_MIN = 3;
const COMMENTAIRE_MAX = 1000;

/** Statuts d'un avis (ENUM MySQL) ; l'employé choisit entre les deux derniers */
const STATUTS_AVIS = ['en_attente', 'valide', 'refuse'];
const DECISIONS = ['valide', 'refuse'];

/**
 * Filtre ?statut= de la liste de modération : vide = tous les avis.
 * Renvoie { statut, erreur }.
 */
function validerFiltreAvis(query = {}) {
    const statut = (query || {}).statut;
    if (statut === undefined || statut === '') return { statut: null, erreur: null };
    if (typeof statut === 'string' && STATUTS_AVIS.includes(statut)) return { statut, erreur: null };
    return { statut: null, erreur: 'Statut d\'avis inconnu.' };
}

/**
 * Vérifie le corps de POST /api/avis.
 * Renvoie { donnees, erreurs } : seuls note, commentaire et commande_id
 * sont lus (le statut est toujours « en_attente », jamais lu dans la requête).
 */
function validerAvis(corps = {}) {
    corps = corps || {};
    const erreurs = [];
    const donnees = {};

    if (Number.isInteger(corps.note) && corps.note >= 1 && corps.note <= 5) {
        donnees.note = corps.note;
    } else {
        erreurs.push('La note doit être un entier entre 1 et 5.');
    }

    const commentaire = typeof corps.commentaire === 'string' ? corps.commentaire.trim() : '';
    if (commentaire.length >= COMMENTAIRE_MIN && commentaire.length <= COMMENTAIRE_MAX) {
        donnees.commentaire = commentaire;
    } else {
        erreurs.push(`Le commentaire est requis (${COMMENTAIRE_MIN} à ${COMMENTAIRE_MAX} caractères).`);
    }

    if (Number.isInteger(corps.commande_id) && corps.commande_id > 0) {
        donnees.commandeId = corps.commande_id;
    } else {
        erreurs.push('La commande concernée est requise.');
    }

    return { donnees, erreurs };
}

class AvisController {

    /**
     * POST /api/avis
     */
    static async creer(req, res) {
        try {
            const { donnees, erreurs } = validerAvis(req.body);
            if (erreurs.length > 0) {
                return res.status(400).json({ error: erreurs[0], erreurs });
            }
            const { note, commentaire, commandeId } = donnees;

            // La commande doit appartenir au client connecté et être terminée
            const [commandes] = await pool.query(
                'SELECT statut FROM commande WHERE commande_id = ? AND utilisateur_id = ?',
                [commandeId, req.user.id]
            );
            if (commandes.length === 0) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }
            // 409 (conflit avec l'état de la commande), comme pour une modification refusée
            if (commandes[0].statut !== 'terminee') {
                return res.status(409).json({ error: 'Vous pourrez donner votre avis une fois la commande terminée.' });
            }

            await pool.query(
                'INSERT INTO avis (note, commentaire, commande_id, utilisateur_id) VALUES (?, ?, ?, ?)',
                [note, commentaire, commandeId, req.user.id]
            );
            // L'avis est renvoyé pour que la page l'affiche sans recharger la commande
            res.status(201).json({
                message: 'Merci ! Votre avis sera publié après validation.',
                avis: { note, commentaire, statut: 'en_attente' }
            });

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

    /**
     * GET /api/employe/avis?statut=en_attente
     * Tous les avis pour la modération (employé ou administrateur),
     * les plus récents en premier, avec la commande et le client.
     */
    static async listerPourModeration(req, res) {
        try {
            const { statut, erreur } = validerFiltreAvis(req.query);
            if (erreur) {
                return res.status(400).json({ error: erreur });
            }
            const [avis] = await pool.query(
                `SELECT a.avis_id, a.note, a.commentaire, a.statut, a.date_creation,
                        c.commande_id, c.numero_commande, m.titre AS menu,
                        u.prenom, u.nom, u.email
                 FROM avis a
                 JOIN utilisateur u ON u.utilisateur_id = a.utilisateur_id
                 JOIN commande c    ON c.commande_id    = a.commande_id
                 JOIN menu m        ON m.menu_id        = c.menu_id
                 ${statut ? 'WHERE a.statut = ?' : ''}
                 ORDER BY a.date_creation DESC, a.avis_id DESC`,
                statut ? [statut] : []
            );
            res.json(avis);
        } catch (err) {
            console.error('Erreur liste avis (modération) :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    /**
     * PUT /api/employe/avis/:id  { statut: 'valide' | 'refuse' }
     * Seuls les avis « valide » apparaissent sur l'accueil (GET /api/avis).
     * Une décision peut être changée : un avis validé par erreur peut
     * être refusé ensuite, et inversement.
     */
    static async moderer(req, res) {
        try {
            const avisId = idValide(req.params.id);
            if (avisId === null) {
                return res.status(404).json({ error: 'Avis introuvable.' });
            }
            const statut = req.body ? req.body.statut : undefined;
            if (!DECISIONS.includes(statut)) {
                return res.status(400).json({ error: 'Décision invalide : « valide » ou « refuse ».' });
            }
            const [resultat] = await pool.query(
                'UPDATE avis SET statut = ? WHERE avis_id = ?',
                [statut, avisId]
            );
            if (resultat.affectedRows === 0) {
                return res.status(404).json({ error: 'Avis introuvable.' });
            }
            res.json({
                message: statut === 'valide' ? 'Avis validé : il est visible sur l\'accueil.' : 'Avis refusé.',
                avis_id: avisId,
                statut
            });
        } catch (err) {
            console.error('Erreur modération avis :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AvisController;
module.exports.validerAvis = validerAvis;
module.exports.validerFiltreAvis = validerFiltreAvis;
