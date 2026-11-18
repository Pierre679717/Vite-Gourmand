/**
 * templateCompteEmploye.js — Mail « votre compte employé a été créé »
 * -------------------------------------------------------------------
 * Le sujet (page 9) : l'employé reçoit un mail lui annonçant la création
 * de son compte, MAIS le mot de passe n'y figure pas : il doit se
 * rapprocher de l'administrateur pour l'obtenir.
 *
 * genererMailCompteEmploye({ prenom, email }) renvoie { subject, text, html }.
 * La fonction ne reçoit jamais le mot de passe : impossible de l'écrire
 * dans le mail par erreur. Fonction « pure », testée sans serveur de mail.
 * Le prénom est saisi par l'administrateur : il passe par echapperHtml().
 */

const { SITE } = require('./templates');
const { echapperHtml } = require('../utils/echapperHtml');
const { C, POLICE } = require('./templateCommande');

const SUJET = 'Votre compte employé Vite & Gourmand a été créé';
const MESSAGE_MOT_DE_PASSE =
  'Pour des raisons de sécurité, votre mot de passe n’est pas indiqué dans ce message : '
  + 'rapprochez-vous de l’administrateur pour l’obtenir.';

function genererMailCompteEmploye({ prenom, email }) {
  const lien = `${SITE}/connexion`;
  const titre = `Bonjour ${prenom},`;
  const intro = 'Un compte employé vient d’être créé pour vous sur le site Vite & Gourmand. '
    + 'Depuis votre espace, vous pourrez suivre les commandes, modérer les avis et gérer la carte.';

  // --- Version texte ---
  const text = [
    titre,
    '',
    intro,
    '',
    `Identifiant (votre adresse e-mail) : ${email}`,
    '',
    MESSAGE_MOT_DE_PASSE,
    '',
    `Se connecter : ${lien}`,
    '',
    'À bientôt,',
    'L’équipe Vite & Gourmand — Traiteur à Bordeaux',
  ].join('\n');

  // --- Version HTML (même structure que les mails de commande) ---
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapperHtml(SUJET)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.creme};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.creme};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:${C.carte};border-radius:16px;overflow:hidden;border:1px solid ${C.trait};">
          <tr>
            <td style="background-color:${C.vertFonce};padding:24px 32px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#FFFFFF;">Vite <span style="color:${C.or};">&amp;</span> Gourmand</span>
              <div style="font-family:${POLICE};font-size:11px;letter-spacing:1.5px;color:${C.or};padding-top:6px;">COMPTE EMPLOYÉ</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 4px;">
              <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.encre};">${echapperHtml(titre)}</h1>
              <p style="margin:0 0 12px;font-family:${POLICE};font-size:15px;line-height:23px;color:${C.texte};">${echapperHtml(intro)}</p>
              <p style="margin:0 0 12px;font-family:${POLICE};font-size:15px;line-height:23px;color:${C.texte};">
                Identifiant (votre adresse e-mail) : <strong style="color:${C.encre};">${echapperHtml(email)}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 0;">
              <p style="margin:0;padding:12px 16px;border-left:4px solid ${C.bordeaux};background-color:${C.creme};font-family:${POLICE};font-size:14px;line-height:21px;color:${C.texte};">
                <strong style="color:${C.bordeaux};">Mot de passe :</strong> ${echapperHtml(MESSAGE_MOT_DE_PASSE)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px;">
              <a href="${echapperHtml(lien)}" target="_blank"
                 style="display:inline-block;padding:13px 30px;background-color:${C.vert};border-radius:999px;font-family:${POLICE};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">
                Se connecter
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${C.creme};padding:18px 32px;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:11px;line-height:17px;color:${C.muted};">
              Vite &amp; Gourmand · Traiteur à Bordeaux · © 2026<br>
              Vous recevez cet e-mail car un administrateur a créé un compte à votre nom.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: SUJET, text, html };
}

module.exports = { genererMailCompteEmploye };
