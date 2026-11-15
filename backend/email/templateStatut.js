/**
 * templateStatut.js — E-mails envoyés quand l'employé change le statut
 * -------------------------------------------------------------------
 * Le sujet (page 8) impose deux mails :
 *  - « attente_retour_materiel » : le matériel prêté est à rendre sous
 *    10 jours ouvrés, sinon 600 € de frais (conditions générales de vente) ;
 *    pour le rendre, le client prend contact avec la société ;
 *  - « terminee » : la commande est terminée, le client est invité à
 *    donner son avis depuis son espace.
 *
 * genererMailStatut(statut, commande) renvoie { subject, text, html },
 * ou null pour les statuts sans mail. Fonction « pure » : elle fabrique
 * du texte sans rien envoyer, on la teste sans serveur de mail.
 * Le prénom vient du client : il passe par echapperHtml() dans le HTML.
 */

const { SITE } = require('./templates');
const { echapperHtml } = require('../utils/echapperHtml');
const { C, POLICE } = require('./templateCommande');

const DELAI_RESTITUTION = '10 jours ouvrés';
const FRAIS_NON_RESTITUTION = '600 €';
const TELEPHONE = '01 23 45 67 89'; // même numéro que le pied de page du site

/**
 * Contenu des deux mails. Chaque entrée fabrique, à partir de la commande,
 * les textes communs à la version texte et à la version HTML.
 * @param {object} c { commande_id, numero_commande, contact_prenom }
 */
const MAILS = {
  attente_retour_materiel: (c) => ({
    subject: `Commande ${c.numero_commande} : matériel à restituer — Vite & Gourmand`,
    surtitre: 'RETOUR DU MATÉRIEL',
    titre: `Bonjour ${c.contact_prenom},`,
    paragraphes: [
      `Votre commande ${c.numero_commande} a été livrée. Le matériel qui vous a été prêté est à restituer.`,
      `Pour le rendre, contactez-nous par téléphone (${TELEPHONE}) ou depuis la page Contact du site : `
        + 'nous conviendrons ensemble du jour et de l’heure.',
    ],
    encadre: `Le matériel doit être restitué sous ${DELAI_RESTITUTION} à compter de ce message. `
      + `À défaut, ${FRAIS_NON_RESTITUTION} de frais vous seront facturés, comme le prévoient nos conditions générales de vente.`,
    bouton: { texte: 'Nous contacter', lien: `${SITE}/contact` },
  }),

  terminee: (c) => ({
    subject: `Commande ${c.numero_commande} terminée — donnez votre avis`,
    surtitre: 'COMMANDE TERMINÉE',
    titre: `Merci ${c.contact_prenom} !`,
    paragraphes: [
      `Votre commande ${c.numero_commande} est terminée. Nous espérons que la prestation vous a plu.`,
      'Votre avis nous aide à progresser et guide nos futurs clients : il ne prend qu’une minute, '
        + 'depuis le suivi de votre commande.',
    ],
    encadre: null,
    bouton: { texte: 'Donner mon avis', lien: `${SITE}/espace-utilisateur/commandes/${c.commande_id}` },
  }),
};

function genererMailStatut(statut, commande) {
  const fabrique = MAILS[statut];
  if (!fabrique) return null;
  const m = fabrique(commande);

  // --- Version texte ---
  const text = [
    m.titre,
    '',
    ...m.paragraphes.flatMap((p) => [p, '']),
    ...(m.encadre ? [m.encadre, ''] : []),
    `${m.bouton.texte} : ${m.bouton.lien}`,
    '',
    'À bientôt,',
    'L’équipe Vite & Gourmand — Traiteur à Bordeaux',
  ].join('\n');

  // --- Version HTML (mêmes couleurs et même structure que le mail de confirmation) ---
  const paragraphesHtml = m.paragraphes.map((p) => `
              <p style="margin:0 0 12px;font-family:${POLICE};font-size:15px;line-height:23px;color:${C.texte};">${echapperHtml(p)}</p>`).join('');

  const encadreHtml = m.encadre ? `
          <tr>
            <td style="padding:4px 32px 0;">
              <p style="margin:0;padding:12px 16px;border-left:4px solid ${C.bordeaux};background-color:${C.creme};font-family:${POLICE};font-size:14px;line-height:21px;color:${C.texte};">
                <strong style="color:${C.bordeaux};">Important :</strong> ${echapperHtml(m.encadre)}
              </p>
            </td>
          </tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapperHtml(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.creme};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.creme};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:${C.carte};border-radius:16px;overflow:hidden;border:1px solid ${C.trait};">
          <tr>
            <td style="background-color:${C.vertFonce};padding:24px 32px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#FFFFFF;">Vite <span style="color:${C.or};">&amp;</span> Gourmand</span>
              <div style="font-family:${POLICE};font-size:11px;letter-spacing:1.5px;color:${C.or};padding-top:6px;">${echapperHtml(m.surtitre)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 4px;">
              <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.encre};">${echapperHtml(m.titre)}</h1>${paragraphesHtml}
            </td>
          </tr>
${encadreHtml}
          <tr>
            <td style="padding:20px 32px 32px;">
              <a href="${echapperHtml(m.bouton.lien)}" target="_blank"
                 style="display:inline-block;padding:13px 30px;background-color:${C.vert};border-radius:999px;font-family:${POLICE};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">
                ${echapperHtml(m.bouton.texte)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${C.creme};padding:18px 32px;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:11px;line-height:17px;color:${C.muted};">
              Vite &amp; Gourmand · Traiteur à Bordeaux · © 2026<br>
              Vous recevez cet e-mail au sujet de votre commande ${echapperHtml(commande.numero_commande)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: m.subject, text, html };
}

module.exports = { genererMailStatut, STATUTS_AVEC_MAIL: Object.keys(MAILS) };
