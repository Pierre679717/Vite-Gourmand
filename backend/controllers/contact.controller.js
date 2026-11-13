/* ================================================================
   CONTROLLERS/CONTACT.CONTROLLER.JS
   POST /api/contact : formulaire de contact (page publique)
   ================================================================
   Le sujet impose 3 champs : titre, description, e-mail.
   Le message n'est pas stocké en base (minimisation RGPD) : il est
   seulement envoyé par mail à l'entreprise. Contrairement au mail de
   confirmation de commande, on ATTEND la fin de l'envoi : si le mail
   ne part pas, le message est perdu, donc le visiteur doit le savoir
   (503) pour réessayer ou appeler.
   ================================================================ */

const { transporter, EXPEDITEUR } = require('../email/mailer');
const { genererMailContact } = require('../email/templateContact');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITRE_MIN = 3;
const TITRE_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;

/** Adresse de l'entreprise qui reçoit les messages (.env, sinon adresse par défaut) */
function destinataire() {
    return process.env.CONTACT_DESTINATAIRE || 'contact@vite-gourmand.fr';
}

/**
 * Vérifie le corps de la requête. Renvoie { donnees, erreurs }.
 * Le titre est mis sur une seule ligne : il devient le sujet du mail.
 */
function validerContact(corps = {}) {
    corps = corps || {};
    const erreurs = [];
    const donnees = {};

    const titre = typeof corps.titre === 'string' ? corps.titre.trim().replace(/\s+/g, ' ') : '';
    if (titre.length >= TITRE_MIN && titre.length <= TITRE_MAX) donnees.titre = titre;
    else erreurs.push(`Le titre est requis (${TITRE_MIN} à ${TITRE_MAX} caractères).`);

    const description = typeof corps.description === 'string' ? corps.description.trim() : '';
    if (description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_MAX) donnees.description = description;
    else erreurs.push(`Le message est requis (${DESCRIPTION_MIN} à ${DESCRIPTION_MAX} caractères).`);

    const email = typeof corps.email === 'string' ? corps.email.trim() : '';
    if (email.length <= 100 && REGEX_EMAIL.test(email)) donnees.email = email.toLowerCase();
    else erreurs.push('Adresse e-mail invalide.');

    return { donnees, erreurs };
}

class ContactController {

    static async envoyer(req, res) {
        const { donnees, erreurs } = validerContact(req.body);
        if (erreurs.length > 0) {
            return res.status(400).json({ error: erreurs[0], erreurs });
        }

        const { sujet, html, texte } = genererMailContact(donnees);
        try {
            await transporter.sendMail({
                from:    EXPEDITEUR,
                to:      destinataire(),
                replyTo: donnees.email,   // « Répondre » écrit directement au visiteur
                subject: sujet,
                html,
                text:    texte
            });
            res.status(201).json({ message: 'Message envoyé. Nous vous répondrons rapidement.' });
        } catch (err) {
            console.error('Message de contact non envoyé :', err.message);
            res.status(503).json({
                error: 'Votre message n\'a pas pu être envoyé. Réessayez dans quelques minutes ou appelez-nous.'
            });
        }
    }
}

module.exports = ContactController;
module.exports.validerContact = validerContact;
