/* ================================================================
   CONTROLLERS/ADMIN.CONTROLLER.JS
   ================================================================ */

const bcrypt = require('bcrypt');
const UtilisateurModel = require('../models/utilisateur.model');
const CommandeModel    = require('../models/commande.model');
const MenuModel        = require('../models/menu.model');
const { pool }         = require('../config/db.mysql');
const { getStatModel } = require('../config/db.mongo');

class AdminController {

    static async statistiques(req, res) {
        try {
            const totalUsers    = await UtilisateurModel.compter();
            const statsCommandes = await CommandeModel.statistiques();
            const totalMenus    = await MenuModel.compterActifs();
            const [moyenneAvis] = await pool.query('SELECT AVG(note) AS moyenne FROM avis');

            let mongoStats = null;
            const StatModel = getStatModel();
            if (StatModel) {
                mongoStats = {
                    visites:   await StatModel.countDocuments({ type: 'visite' }),
                    commandes: await StatModel.countDocuments({ type: 'commande' })
                };
            }

            res.json({
                utilisateurs:    totalUsers,
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
            const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);
            const id = await UtilisateurModel.creer({ nom, prenom, email, motDePasseHash, role: 'employe' });
            res.status(201).json({ message: 'Employé créé !', id });
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = AdminController;
