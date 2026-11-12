/**
 * templateCommande.js — E-mail de confirmation de commande
 * -------------------------------------------------------------------
 * genererMailConfirmationCommande(commande) renvoie { subject, text, html },
 * prêt à passer à Nodemailer (même format que templates.js).
 *
 * Fonction « pure » : elle ne fait que fabriquer du texte, sans envoyer
 * quoi que ce soit. On peut donc la tester sans serveur de mail.
 *
 * Sécurité : l'adresse, la ville et le prénom viennent du client.
 * Tout ce qui est inséré dans le HTML passe par echapperHtml() pour
 * qu'un « <script> » ou un lien piégé tapé dans le formulaire
 * s'affiche comme du texte dans le mail, sans être interprété.
 */

const { SITE } = require('./templates');

// Couleurs de la charte (maquettes haute fidélité)
const C = {
  vert: '#1F482E',
  vertFonce: '#153621',
  or: '#CCAE5D',
  bordeaux: '#792E35',
  creme: '#F6F1EB',
  encre: '#1F2421',
  texte: '#414B45',
  muted: '#6B746E',
  carte: '#FFFFFF',
  trait: '#E6DFD4',
};

const POLICE = 'Arial,Helvetica,sans-serif';
const MESSAGE_MATERIEL =
  'Vous avez demandé le prêt de matériel. Il est à restituer sous 10 jours ouvrés après la prestation ; '
  + 'à défaut, 600 € de frais seront facturés (conditions générales de vente).';

/** Échappe les 5 caractères spéciaux du HTML (y compris les guillemets, pour les attributs) */
function echapperHtml(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 392.19 -> « 392,19 € » (espaces insécables remplacés par des espaces simples pour les clients mail) */
function formaterEuros(montant) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(Number(montant))
    .replace(/[  ]/g, ' ');
}

/** '2026-12-05' -> « samedi 5 décembre 2026 » */
function formaterDate(dateIso) {
  const [annee, mois, jour] = String(dateIso).split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour)).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** '12:30' -> « 12 h 30 » */
function formaterHeure(heure) {
  const [h, m] = String(heure).split(':');
  return `${Number(h)} h ${m}`;
}

/**
 * Lignes du détail du prix, partagées par la version texte et la version HTML.
 * La réduction n'apparaît que si elle s'applique.
 */
function lignesPrix(c) {
  const lignes = [
    [`Menu : ${c.nombre_personne} pers. × ${formaterEuros(c.prix_par_personne)}`,
      formaterEuros(c.prix_par_personne * c.nombre_personne)],
  ];
  if (c.reduction > 0) {
    lignes.push(['Réduction de 10 %', `− ${formaterEuros(c.reduction)}`]);
  }
  lignes.push([
    c.prix_livraison > 0 ? `Livraison (${String(c.distance_km).replace('.', ',')} km)` : 'Livraison (Bordeaux)',
    c.prix_livraison > 0 ? formaterEuros(c.prix_livraison) : 'Offerte',
  ]);
  return lignes;
}

/**
 * @param {object} c commande : numero_commande, menu, nombre_personne, date_prestation,
 *   heure_livraison, adresse_prestation, ville_prestation, pret_materiel, contact_prenom,
 *   distance_km, prix_par_personne, reduction, prix_livraison, prix_total
 */
function genererMailConfirmationCommande(c) {
  const subject = `Commande ${c.numero_commande} confirmée — Vite & Gourmand`;
  const lienSuivi = `${SITE}/espace-utilisateur`;
  const date = formaterDate(c.date_prestation);
  const heure = formaterHeure(c.heure_livraison);
  const prix = lignesPrix(c);

  // --- Version texte (lue par les clients mail sans HTML, et utile contre le spam) ---
  const text = [
    `Bonjour ${c.contact_prenom},`,
    '',
    `Merci pour votre commande ${c.numero_commande} : elle est bien enregistrée.`,
    'Notre équipe va la traiter ; vous serez informé(e) à chaque étape.',
    '',
    `Menu : ${c.menu}`,
    `Prestation : ${date}, livraison à ${heure}`,
    `Adresse : ${c.adresse_prestation}, ${c.ville_prestation}`,
    '',
    ...prix.map(([libelle, montant]) => `${libelle} : ${montant}`),
    `Total TTC : ${formaterEuros(c.prix_total)}`,
    '',
    ...(c.pret_materiel ? [MESSAGE_MATERIEL, ''] : []),
    `Suivre ma commande : ${lienSuivi}`,
    '',
    'À bientôt,',
    'L’équipe Vite & Gourmand — Traiteur à Bordeaux',
  ].join('\n');

  // --- Version HTML (tableaux + styles en ligne : seule mise en page fiable dans les mails) ---
  const lignesHtml = prix.map(([libelle, montant]) => `
              <tr>
                <td style="padding:6px 0;font-family:${POLICE};font-size:14px;color:${C.texte};">${echapperHtml(libelle)}</td>
                <td align="right" style="padding:6px 0;font-family:${POLICE};font-size:14px;color:${C.texte};white-space:nowrap;">${echapperHtml(montant)}</td>
              </tr>`).join('');

  const blocMateriel = c.pret_materiel ? `
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0;padding:12px 16px;border-left:4px solid ${C.bordeaux};background-color:${C.creme};font-family:${POLICE};font-size:13px;line-height:20px;color:${C.texte};">
                ${echapperHtml(MESSAGE_MATERIEL)}
              </p>
            </td>
          </tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${echapperHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.creme};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.creme};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:${C.carte};border-radius:16px;overflow:hidden;border:1px solid ${C.trait};">
          <!-- En-tête -->
          <tr>
            <td style="background-color:${C.vertFonce};padding:24px 32px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#FFFFFF;">Vite <span style="color:${C.or};">&amp;</span> Gourmand</span>
              <div style="font-family:${POLICE};font-size:11px;letter-spacing:1.5px;color:${C.or};padding-top:6px;">COMMANDE CONFIRMÉE</div>
            </td>
          </tr>

          <!-- Introduction -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.encre};">Merci ${echapperHtml(c.contact_prenom)} !</h1>
              <p style="margin:0 0 10px;font-family:${POLICE};font-size:15px;line-height:23px;color:${C.texte};">
                Votre commande <strong style="color:${C.vert};">${echapperHtml(c.numero_commande)}</strong> est bien enregistrée.
                Notre équipe va la traiter ; vous serez informé(e) à chaque étape.
              </p>
            </td>
          </tr>

          <!-- Prestation -->
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.creme};border-radius:12px;">
                <tr><td style="padding:16px 20px;font-family:${POLICE};font-size:14px;line-height:22px;color:${C.texte};">
                  <strong style="color:${C.encre};">${echapperHtml(c.menu)}</strong><br>
                  ${echapperHtml(date)}, livraison à ${echapperHtml(heure)}<br>
                  ${echapperHtml(c.adresse_prestation)}, ${echapperHtml(c.ville_prestation)}
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Détail du prix -->
          <tr>
            <td style="padding:16px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignesHtml}
              <tr>
                <td style="padding:12px 0 0;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:16px;font-weight:bold;color:${C.encre};">Total TTC</td>
                <td align="right" style="padding:12px 0 0;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:16px;font-weight:bold;color:${C.vert};white-space:nowrap;">${echapperHtml(formaterEuros(c.prix_total))}</td>
              </tr>
              </table>
            </td>
          </tr>
${blocMateriel}
          <!-- Bouton -->
          <tr>
            <td style="padding:16px 32px 32px;">
              <a href="${echapperHtml(lienSuivi)}" target="_blank"
                 style="display:inline-block;padding:13px 30px;background-color:${C.vert};border-radius:999px;font-family:${POLICE};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">
                Suivre ma commande
              </a>
            </td>
          </tr>

          <!-- Pied -->
          <tr>
            <td style="background-color:${C.creme};padding:18px 32px;border-top:1px solid ${C.trait};font-family:${POLICE};font-size:11px;line-height:17px;color:${C.muted};">
              Vite &amp; Gourmand · Traiteur à Bordeaux · © 2026<br>
              Vous recevez cet e-mail suite à votre commande sur notre site.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = { genererMailConfirmationCommande, echapperHtml, formaterEuros, formaterDate, formaterHeure };
