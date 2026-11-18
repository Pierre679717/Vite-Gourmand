require('dotenv').config();
const nodemailer = require('nodemailer');
const { creerTransportApi } = require('./envoiApiMailtrap');

/* Deux façons d'envoyer, choisies par les variables d'environnement :
   - MAILTRAP_API_TOKEN défini (production Railway) : API HTTPS de Mailtrap,
     car l'offre Hobby de Railway bloque les ports SMTP sortants ;
   - sinon (poste de développement) : SMTP Mailtrap avec nodemailer.
   Dans les deux cas, les contrôleurs appellent transporter.sendMail(). */
function creerTransporter(env = process.env) {
  if (env.MAILTRAP_API_TOKEN) {
    return creerTransportApi({ jeton: env.MAILTRAP_API_TOKEN, idBoite: env.MAILTRAP_INBOX_ID });
  }
  return nodemailer.createTransport({
    host: env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
    port: Number(env.EMAIL_PORT) || 2525,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASSWORD,
    },
  });
}

const transporter = creerTransporter();

const EXPEDITEUR = process.env.MAIL_FROM || 'Vite & Gourmand <no-reply@vite-gourmand.fr>';

module.exports = { transporter, EXPEDITEUR, creerTransporter };
