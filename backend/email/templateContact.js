/* ================================================================
   EMAIL/TEMPLATECONTACT.JS
   Mail envoyé à l'entreprise quand un visiteur utilise le formulaire
   de contact (titre, description, e-mail : champs imposés par le sujet)
   ================================================================
   Version HTML + version texte, comme le mail de confirmation.
   Tout ce que le visiteur a tapé passe par echapperHtml() : un
   « <a href=...> » ou un « <script> » s'affiche comme du texte et
   n'est jamais interprété par le client mail de Julie et José.
   ================================================================ */

const { echapperHtml } = require('../utils/echapperHtml');

/** Texte échappé, retours à la ligne conservés (<br>) */
function paragraphe(texte) {
    return echapperHtml(texte).replace(/\r?\n/g, '<br>');
}

function genererMailContact({ titre, description, email }) {
    const sujet = `[Contact] ${titre}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#F6F1EB;font-family:Arial,Helvetica,sans-serif;color:#1E2A22;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:8px;">
      <tr><td style="padding:20px 24px;background:#1F482E;color:#FFFFFF;font-size:18px;font-weight:bold;border-radius:8px 8px 0 0;">
        Nouveau message depuis le site
      </td></tr>
      <tr><td style="padding:24px;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 8px;"><strong>De :</strong> ${echapperHtml(email)}</p>
        <p style="margin:0 0 16px;"><strong>Titre :</strong> ${echapperHtml(titre)}</p>
        <p style="margin:0 0 4px;"><strong>Message :</strong></p>
        <p style="margin:0;padding:12px 16px;background:#F6F1EB;border-left:3px solid #CCAE5D;">${paragraphe(description)}</p>
        <p style="margin:16px 0 0;color:#6B746E;font-size:12px;">Répondez directement à ce mail : la réponse partira vers ${echapperHtml(email)}.</p>
      </td></tr>
    </table>
  </body>
</html>`;

    const texte = [
        'Nouveau message depuis le site Vite & Gourmand',
        '',
        `De : ${email}`,
        `Titre : ${titre}`,
        '',
        description,
        '',
        'Répondez directement à ce mail pour répondre au visiteur.'
    ].join('\n');

    return { sujet, html, texte };
}

module.exports = { genererMailContact };
