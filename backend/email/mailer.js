require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
  port: Number(process.env.EMAIL_PORT) || 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const EXPEDITEUR = process.env.MAIL_FROM || 'Vite & Gourmand <no-reply@vite-gourmand.fr>';

module.exports = { transporter, EXPEDITEUR };