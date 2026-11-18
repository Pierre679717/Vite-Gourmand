/* ================================================================
   EMAIL/ENVOIAPIMAILTRAP.JS
   Envoi des mails par l'API HTTPS de Mailtrap (Email Sandbox)
   ================================================================
   Pourquoi ce fichier ?
   - Sur Railway (offre Hobby), les ports SMTP sortants (25, 465, 587,
     2525) sont bloqués : nodemailer obtenait « Connection timeout ».
   - Railway recommande d'envoyer les mails par une API HTTPS (port 443,
     autorisé). Mailtrap en propose une pour sa boîte de test :
     POST https://sandbox.api.mailtrap.io/api/send/<id de la boîte>
   - Les mails restent capturés dans la boîte Mailtrap (aucun envoi
     réel), comme en SMTP : la démonstration ne change pas.

   creerTransportApi() renvoie un objet avec la même méthode sendMail()
   que nodemailer : les contrôleurs et les tests ne changent pas.
   Aucune dépendance ajoutée : fetch est fourni par Node 22.
   ================================================================ */

const URL_API_SANDBOX = 'https://sandbox.api.mailtrap.io/api/send/';
const DELAI_MAX_MS = 10000;

/**
 * 'Vite & Gourmand <no-reply@vite-gourmand.fr>' → { name, email }
 * 'camille@example.com'                         → { email }
 * L'API attend un objet { email, name? } et non le texte de nodemailer.
 */
function analyserAdresse(adresse) {
    const texte = String(adresse || '').trim();
    const morceaux = texte.match(/^(.*)<([^<>]+)>$/);
    if (!morceaux) return { email: texte };
    const nom = morceaux[1].trim().replace(/^"(.*)"$/, '$1');
    const email = morceaux[2].trim();
    return nom ? { name: nom, email } : { email };
}

/** Options nodemailer (from, to, replyTo, subject, html, text) → corps JSON de l'API */
function construireCorps(options) {
    const destinataires = Array.isArray(options.to) ? options.to : String(options.to).split(',');
    const corps = {
        from: analyserAdresse(options.from),
        to: destinataires.map(analyserAdresse).filter((a) => a.email),
        subject: options.subject
    };
    // reply_to : un seul objet (et non un tableau) dans l'API Mailtrap
    if (options.replyTo) corps.reply_to = analyserAdresse(options.replyTo);
    if (options.text) corps.text = options.text;
    if (options.html) corps.html = options.html;
    return corps;
}

/**
 * Transport « API Mailtrap » : même interface que nodemailer (sendMail, verify).
 * Refuse d'être créé sans jeton ou sans identifiant de boîte, pour que
 * l'erreur de configuration se voie au démarrage et non au premier mail.
 */
function creerTransportApi({ jeton, idBoite, fetch: fetchHttp = globalThis.fetch } = {}) {
    if (!jeton) throw new Error('MAILTRAP_API_TOKEN manquant : envoi par API impossible.');
    if (!/^\d+$/.test(String(idBoite || ''))) {
        throw new Error('MAILTRAP_INBOX_ID manquant ou invalide (nombre attendu).');
    }
    const url = URL_API_SANDBOX + idBoite;

    return {
        mode: 'api-mailtrap',

        async sendMail(options) {
            const reponse = await fetchHttp(url, {
                method: 'POST',
                headers: {
                    'Api-Token': jeton,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(construireCorps(options)),
                signal: AbortSignal.timeout(DELAI_MAX_MS)
            });
            const donnees = await reponse.json().catch(() => ({}));
            if (!reponse.ok || donnees.success === false) {
                const details = Array.isArray(donnees.errors) ? donnees.errors.join(', ') : 'réponse inattendue';
                throw new Error(`API Mailtrap ${reponse.status} : ${details}`);
            }
            return { messageId: (donnees.message_ids || [])[0], reponse: donnees };
        },

        // nodemailer.verify() teste la connexion SMTP ; ici rien à ouvrir à l'avance
        async verify() {
            return true;
        }
    };
}

module.exports = { analyserAdresse, construireCorps, creerTransportApi, URL_API_SANDBOX };
