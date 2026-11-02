/* ================================================================
   CONTROLLERS/ADMIN.CONTROLLER.JS
   ================================================================ */

const bcrypt = require('bcrypt');
const UtilisateurModel = require('../models/utilisateur.model');
const { CommandeModel } = require('../models/commande.model');
const MenuModel        = require('../models/menu.model');
const { pool }         = require('../config/db.mysql');
const { getStatModel } = require('../config/db.mongo');
const { motDePasseValide, MESSAGE_MOT_DE_PASSE } = require('../utils/motDePasse');

class AdminController {

    static async statistiques(req, res) {
        try {
            const totalClients   = await UtilisateurModel.compterClients();
            const statsCommandes = await CommandeModel.statistiques();
            const totalMenus     = await MenuModel.compterActifs();
            // Moyenne calculée sur les avis validés seulement (ceux affichés au public)
            const [moyenneAvis]  = await pool.query(
                "SELECT AVG(note) AS moyenne FROM avis WHERE statut = 'valide'"
            );

            let mongoStats = null;
            const StatModel = getStatModel();
            if (StatModel) {
                mongoStats = {
                    visites:   await StatModel.countDocuments({ type: 'visite' }),
                    commandes: await StatModel.countDocuments({ type: 'commande' })
                };
            }

            res.json({
                utilisateurs:    totalClients,
                commandes:       statsCommandes.total,
                chiffre_affaires: statsCommandes.chiffreAffaires,
                menus_actifs:    totalMenus,
                note_moyenne:    moyenneAvis[0].moyenne ? parseFloat(moyenneAvis[0].moyenne).toFixed(1) : 'N/A',
                mongodb_stats:   mongoStats
            });
        } catch (err) {
            console.error('Erreur stats :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    static async listerEmployes(req, res) {
        try {
            const employes = await UtilisateurModel.listerEmployes();
            res.json(employes);
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }

    static async creerEmploye(req, res) {
        try {
            const { nom, prenom, email, mot_de_passe } = req.body;
            if (!nom || !prenom || !email || !mot_de_passe) {
                return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
            }
            if (!motDePasseValide(mot_de_passe)) {
                return res.status(400).json({ error: MESSAGE_MOT_DE_PASSE });
            }
            if (await UtilisateurModel.emailExiste(email)) {
                return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
            }
            const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);
            // Téléphone et adresse restent NULL : seuls l'identité, l'e-mail
            // et le mot de passe sont demandés pour un compte employé.
            const id = await UtilisateurModel.creer({ nom, prenom, email, motDePasseHash, role: 'employe' });
            res.status(201).json({ message: 'Employé créé !', id });
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AdminController;
