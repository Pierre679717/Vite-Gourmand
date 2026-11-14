/* ================================================================
   UTILS/ECHAPPERHTML.JS
   Échapper un texte avant de l'insérer dans du HTML (mails)
   ================================================================
   Un « <script> » ou un lien piégé tapé dans un formulaire s'affiche
   alors comme du texte, sans être interprété par le client mail.
   Les 5 caractères qui ont un sens en HTML sont remplacés par leur
   entité ; & en premier, sinon on échapperait deux fois.
   ================================================================ */

function echapperHtml(valeur = '') {
    return String(valeur)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = { echapperHtml };
