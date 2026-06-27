/**
 * envoyer-mails-bienvenue.js — Test d'envoi des 3 mails de bienvenue vers Mailtrap
 * --------------------------------------------------------------------------------
 * 1) Vérifie la connexion SMTP (transporter.verify)
 * 2) Envoie les mails Administrateur, Employé, Client dans ta sandbox Mailtrap
 * 3) Affiche un compte rendu clair (succès / échec + aide au dépannage)
 *
 * Lancement :  node envoyer-mails-bienvenue.js
 */
const { transporter, EXPEDITEUR } = require('./mailer');
const { genererMailBienvenue } = require('./templates');

// Comptes de test (adapte les adresses à tes données seedées)
const COMPTES = [
  { role: 'administrateur', prenom: 'Admin', identifiant: 'admin@vite-gourmand.fr',    to: 'admin@vite-gourmand.fr' },
  { role: 'employe',        prenom: 'José',  identifiant: 'employe@vite-gourmand.fr',  to: 'employe@vite-gourmand.fr' },
  { role: 'client',         prenom: 'Camille', identifiant: 'client@vite-gourmand.fr', to: 'client@vite-gourmand.fr' },
];

function expliquerErreur(err) {
  const code = err && err.code;
  const map = {
    EAUTH: 'Identifiants Mailtrap invalides → recopie le username/password depuis Sandbox > Integration > SMTP.',
    ECONNECTION: 'Connexion impossible → vérifie le host (sandbox.smtp.mailtrap.io) et le port (2525, sinon essaie 587).',
    ETIMEDOUT: 'Délai dépassé → réseau ou pare-feu : essaie un autre port (587 ou 465) ou un autre réseau.',
    ESOCKET: 'Problème de socket/TLS → essaie le port 2525 (non chiffré) pour le sandbox.',
    ENOTFOUND: 'Hôte introuvable → vérifie l’orthographe de MAILTRAP_HOST.',
  };
  return map[code] || 'Vérifie ta configuration .env et les identifiants Mailtrap.';
}

(async () => {
  console.log('— Test des mails de bienvenue Vite & Gourmand (Mailtrap) —\n');

  // 1) Vérification de la connexion SMTP
  try {
    await transporter.verify();
    console.log('✓ Connexion SMTP OK (' + (process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io') + ')\n');
  } catch (err) {
    console.error('✗ Échec de connexion SMTP :', err.message);
    console.error('  → ' + expliquerErreur(err));
    process.exit(1);
  }

  // 2) Envoi des 3 mails
  let ok = 0;
  for (const c of COMPTES) {
    const mail = genererMailBienvenue(c.role, { prenom: c.prenom, identifiant: c.identifiant });
    try {
      const info = await transporter.sendMail({
        from: EXPEDITEUR,
        to: c.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      ok++;
      console.log(`✓ [${c.role}] envoyé → ${c.to}`);
      console.log(`    messageId : ${info.messageId}`);
    } catch (err) {
      console.error(`✗ [${c.role}] échec → ${c.to} : ${err.message}`);
      console.error('    → ' + expliquerErreur(err));
    }
  }

  // 3) Compte rendu
  console.log(`\n${ok}/${COMPTES.length} mails envoyés.`);
  console.log('Ouvre maintenant ta sandbox Mailtrap pour visualiser les 3 mails et vérifier le rendu HTML.');
  process.exit(ok === COMPTES.length ? 0 : 2);
})();
