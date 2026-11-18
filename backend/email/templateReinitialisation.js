/**
 * templateReinitialisation.js — Mail « réinitialiser votre mot de passe »
 * -------------------------------------------------------------------
 * genererMailReinitialisation({ prenom, lien, minutes }) renvoie
 * { subject, text, html }, prêt à passer à Nodemailer.
 *
 * Fonction « pure », testée sans serveur de mail.
 * - Le prénom vient de la base (saisi à l'inscription) : il passe par
 *   echapperHtml() avant d'être inséré dans le HTML.
 * - Le lien est aussi échappé (dans href et dans le texte affiché).
 * - Une version texte est fournie pour les clients mail sans HTML,
 *   avec le lien complet à copier.
 */

const { echapperHtml } = require('../utils/echapperHtml');
const { C, POLICE } = require('./templateCommande');

const SUJET = 'Réinitialisation de votre mot de passe Vite & Gourmand';

function genererMailReinitialisation({ prenom, lien, minutes }) {
  const titre = `Bonjour ${prenom},`;
  const intro = 'Vous avez demandé à choisir un nouveau mot de passe pour votre compte Vite & Gourmand. '
    + 'Cliquez sur le bouton ci-dessous pour le faire.';
  const validite = `Ce lien est valable ${minutes} minutes et ne peut servir qu’une seule fois.`;
  const pasVous = 'Vous n’êtes pas à l’origine de cette demande ? Ignorez simplement ce message : '
    + 'votre mot de passe actuel reste inchangé.';

  // --- Version texte ---
  const text = [
    titre,
    '',
    intro,
    '',
    `Choisir un nouveau mot de passe : ${lien}`,
    '',
    validite,
    '',
    pasVous,
    '',
    'À bientôt,',
    'L’équipe Vite & Gourmand — Traiteur à Bordeaux',
  ].join('\n');

  // --- Version HTML (même structure que les autres mails du site) ---
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
              <div style="font-family:${POLICE};font-size:11px;letter-spacing:1.5px;color:${C.or};padding-top:6px;">MOT DE PASSE OUBLIÉ</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 4px;">
              <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.encre};">${echapperHtml(titre)}</h1>
              <p style="margin:0 0 12px;font-family:${POLICE};font-size:15px;line-height:23px;color:${C.texte};">${echapperHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 8px;">
              <a href="${echapperHtml(lien)}" target="_blank"
                 style="display:inline-block;padding:13px 30px;background-color:${C.vert};border-radius:999px;font-family:${POLICE};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">
                Choisir un nouveau mot de passe
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0;">
              <p style="margin:0 0 12px;padding:12px 16px;border-left:4px solid ${C.bordeaux};background-color:${C.creme};font-family:${POLICE};font-size:14px;line-height:21px;color:${C.texte};">
                <strong style="color:${C.bordeaux};">Attention :</strong> ${echapperHtml(validite)}
              </p>
              <p style="margin:0 0 12px;font-family:${POLICE};font-size:13px;line-height:20px;color:${C.muted};">
                Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :<br>
                <span style="word-break:break-all;color:${C.encre};">${echapperHtml(lien)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 28px;">
              <p style="margin:0;font-family:${POLICE};font-size:13px;line-height:20px;color:${C.muted};">${echapperHtml(pasVous)}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${C.creme};padding:18px 32px;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:11px;line-height:17px;color:${C.muted};">
              Vite &amp; Gourmand · Traiteur à Bordeaux · © 2026<br>
              Vous recevez cet e-mail car une réinitialisation du mot de passe a été demandée pour votre compte.
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

module.exports = { genererMailReinitialisation, SUJET };
