/* ================================================================
   CONFIG/EMAIL.JS
   Configuration Nodemailer pour l'envoi d'emails
   ================================================================ */

const nodemailer = require('nodemailer');

let transporter;
try {
    transporter = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
        port:   process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
} catch (err) {
    console.log('⚠️  Email non configuré');
}

/**
 * Envoyer un email (ne bloque pas si non configuré)
 */
async function envoyerEmail(to, subject, html) {
    if (!transporter || !process.env.EMAIL_USER) {
        console.log('📧 Email simulé vers', to, ':', subject);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Vite & Gourmand" <${process.env.EMAIL_USER}>`,
            to, subject, html
        });
    } catch (err) {
        console.error('Erreur envoi email :', err.message);
    }
}

module.exports = { envoyerEmail };
