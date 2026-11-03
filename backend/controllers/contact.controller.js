/* ================================================================
   CONTROLLERS/CONTACT.CONTROLLER.JS
   ================================================================ */

const { envoyerEmail } = require('../config/email');

class ContactController {
    static async envoyer(req, res) {
        try {
            const { nom, email, sujet, message } = req.body;
            if (!nom || !email || !sujet || !message) {
                return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
            }
            // Le message n'est pas stocké en base (minimisation RGPD) :
            // le sujet demande seulement qu'il soit envoyé par e-mail.
            await envoyerEmail('admin@vite-gourmand.fr', 'Nouveau message : ' + sujet,
                `<p><strong>De :</strong> ${nom} (${email})</p><p><strong>Message :</strong></p><p>${message}</p>`
            );
            res.status(201).json({ message: 'Message envoyé avec succès !' });
        } catch (err) {
            console.error('Erreur contact :', err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
}

module.exports = ContactController;
