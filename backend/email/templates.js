/**
 * templates.js — Générateur des e-mails de bienvenue Vite & Gourmand
 * -------------------------------------------------------------------
 * Un seul template, décliné selon le rôle : administrateur, employe, client.
 * Renvoie { subject, text, html } prêt à passer à Nodemailer / Mailtrap.
 *
 * Usage :
 *   const { genererMailBienvenue } = require('./templates');
 *   const mail = genererMailBienvenue('client', { prenom: 'Camille', identifiant: 'client@vite-gourmand.fr' });
 */

// --- Charte graphique Vite & Gourmand ---
const C = {
  vert: '#2E7D32',
  vertFonce: '#1B5E20',
  or: '#D4AF37',
  bordeaux: '#722F37',
  encre: '#26302A',
  texte: '#414B45',
  muted: '#7A857D',
  bgPage: '#EEF1EC',
  carte: '#FFFFFF',
  pied: '#F4F6F2',
  trait: '#E3E6E0',
};

const SITE = 'https://vite-gourmand-production.up.railway.app';

// --- Contenu propre à chaque rôle ---
const ROLES = {
  administrateur: {
    badge: 'ADMINISTRATEUR',
    accent: C.bordeaux,
    subject: 'Votre accès administrateur Vite & Gourmand est activé',
    heading: 'Votre espace administrateur est activé',
    intro:
      "Votre compte <strong>administrateur</strong> vient d'être créé. Vous disposez d'un accès complet au back-office Vite & Gourmand.",
    items: [
      'Gérer les menus et les catégories (création, modification, suppression)',
      'Suivre et mettre à jour le statut des commandes',
      'Consulter le tableau de bord et les statistiques',
      'Gérer les comptes employés',
    ],
    ctaLabel: 'Accéder au back-office',
    ctaPath: '/admin',
    note: 'Pour des raisons de sécurité, pensez à modifier votre mot de passe lors de la première connexion.',
  },
  employe: {
    badge: 'EMPLOYÉ',
    accent: C.vert,
    subject: 'Bienvenue dans l’équipe — votre espace Vite & Gourmand est prêt',
    heading: 'Bienvenue dans l’équipe !',
    intro:
      "Votre compte <strong>employé</strong> vient d'être créé. Depuis votre espace, vous pouvez accompagner les clients au quotidien.",
    items: [
      'Consulter et traiter les commandes des clients',
      'Mettre à jour le statut des réservations',
      'Consulter les menus et leurs disponibilités',
    ],
    ctaLabel: 'Accéder à mon espace',
    ctaPath: '/espace',
    note: 'Accès limité : la gestion des comptes et les statistiques globales restent réservées aux administrateurs. Pensez à personnaliser votre mot de passe à la première connexion.',
  },
  client: {
    badge: 'CLIENT',
    accent: C.vert,
    subject: 'Bienvenue chez Vite & Gourmand, l’élégance culinaire',
    heading: 'Bienvenue chez Vite & Gourmand',
    intro:
      "Merci pour votre inscription ! Votre compte est désormais actif et toute notre table vous est ouverte.",
    items: [
      'Parcourir nos menus gastronomiques et leurs informations allergènes',
      'Commander en ligne pour vos événements (à partir de 6 personnes)',
      'Suivre l’historique de vos commandes',
      'Laisser un avis sur vos prestations',
    ],
    ctaLabel: 'Découvrir nos menus',
    ctaPath: '/menus',
    note: 'Une question ? Julie & José et toute l’équipe sont à votre écoute.',
  },
};

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function genererMailBienvenue(role, { prenom = '', identifiant = '', lien = '' } = {}) {
  const r = ROLES[(role || '').toLowerCase()];
  if (!r) throw new Error(`Rôle inconnu : "${role}". Attendu : administrateur | employe | client.`);

  const cta = lien || SITE + r.ctaPath;
  const salutation = prenom ? `Bonjour ${escapeHtml(prenom)},` : 'Bonjour,';

  // --- Version texte (fallback, importante pour le score anti-spam) ---
  const text = [
    `${r.heading}`,
    '',
    salutation,
    '',
    r.intro.replace(/<[^>]+>/g, ''),
    '',
    'Vous pouvez :',
    ...r.items.map((i) => `  - ${i}`),
    '',
    identifiant ? `Identifiant : ${identifiant}` : '',
    `${r.ctaLabel} : ${cta}`,
    '',
    r.note,
    '',
    'À bientôt,',
    'L’équipe Vite & Gourmand',
    'Traiteur gastronomique · Bordeaux · © 2026',
  ]
    .filter((l) => l !== '')
    .join('\n');

  // --- Liste des fonctionnalités (puces or, email-safe) ---
  const liste = r.items
    .map(
      (i) => `
        <tr>
          <td valign="top" style="padding:5px 10px 5px 0;color:${C.or};font-size:16px;line-height:22px;">&#9679;</td>
          <td valign="top" style="padding:5px 0;color:${C.texte};font-size:15px;line-height:22px;font-family:Arial,Helvetica,sans-serif;">${i}</td>
        </tr>`
    )
    .join('');

  const blocIdentifiant = identifiant
    ? `
        <tr><td style="padding:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${C.muted};">
          Identifiant : <span style="color:${C.encre};font-weight:bold;">${escapeHtml(identifiant)}</span>
        </td></tr>`
    : '';

  // --- HTML complet (tables + styles inline = compatibilité maximale) ---
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${escapeHtml(r.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bgPage};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bgPage};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:${C.carte};border-radius:12px;overflow:hidden;border:1px solid ${C.trait};">
          <!-- En-tête -->
          <tr>
            <td style="background-color:${C.vertFonce};padding:26px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#FFFFFF;">
                    Vite <span style="color:${C.or};">&amp;</span> Gourmand
                  </td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.5px;color:${C.or};">${r.badge}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#AFC6B0;padding-top:4px;">
                    L’élégance culinaire · Bordeaux
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;color:${C.encre};">${r.heading}</h1>
              <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:${C.texte};">${salutation}</p>
              <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:${C.texte};">${r.intro}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                ${liste}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 0;">
                ${blocIdentifiant}
              </table>

              <!-- Bouton -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td align="center" bgcolor="${r.accent}" style="border-radius:8px;">
                    <a href="${cta}" target="_blank"
                       style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                      ${r.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${C.muted};">${r.note}</p>
            </td>
          </tr>

          <!-- Pied -->
          <tr>
            <td style="background-color:${C.pied};padding:20px 32px;border-top:1px solid ${C.trait};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.texte};">À bientôt,<br><strong>L’équipe Vite &amp; Gourmand</strong></p>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.muted};">
                Vite &amp; Gourmand · Traiteur gastronomique · Bordeaux · © 2026<br>
                Cet e-mail vous a été envoyé suite à la création de votre compte.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: r.subject, text, html };
}

module.exports = { genererMailBienvenue, ROLES, SITE };
