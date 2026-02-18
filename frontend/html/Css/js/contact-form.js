/* ================================================================
   CONTACT-FORM.JS - Validation formulaire contact + envoi API
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    var API = '/api';
    var form = document.getElementById('contact-form');
    if (!form) return;

    var nom = document.getElementById('contact-nom');
    var email = document.getElementById('contact-email');
    var telephone = document.getElementById('contact-telephone');
    var sujet = document.getElementById('contact-sujet');
    var message = document.getElementById('contact-message');
    var charCount = document.getElementById('char-count');
    var honeypot = document.getElementById('website');
    var success = document.getElementById('form-success');

    /* === Compteur de caractères === */
    if (message && charCount) {
        message.addEventListener('input', function () {
            charCount.textContent = message.value.length;
        });
    }

    /* === Afficher erreur === */
    function erreur(input, id, msg) {
        if (input) input.style.borderColor = '#D32F2F';
        var el = document.getElementById(id);
        if (el) el.textContent = msg;
    }

    /* === Effacer erreur === */
    function ok(input, id) {
        if (input) input.style.borderColor = '#2E7D32';
        var el = document.getElementById(id);
        if (el) el.textContent = '';
    }

    /* === Validation === */
    function validerNom() {
        if (!nom.value.trim()) { erreur(nom, 'error-nom', 'Le nom est obligatoire.'); return false; }
        if (nom.value.trim().length < 2) { erreur(nom, 'error-nom', 'Minimum 2 caractères.'); return false; }
        ok(nom, 'error-nom'); return true;
    }

    function validerEmail() {
        var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.value.trim()) { erreur(email, 'error-email', 'L\'e-mail est obligatoire.'); return false; }
        if (!re.test(email.value.trim())) { erreur(email, 'error-email', 'E-mail invalide.'); return false; }
        ok(email, 'error-email'); return true;
    }

    function validerSujet() {
        if (!sujet.value) { erreur(sujet, 'error-sujet', 'Choisissez un sujet.'); return false; }
        ok(sujet, 'error-sujet'); return true;
    }

    function validerMessage() {
        if (!message.value.trim()) { erreur(message, 'error-message', 'Le message est obligatoire.'); return false; }
        if (message.value.trim().length < 10) { erreur(message, 'error-message', 'Minimum 10 caractères.'); return false; }
        ok(message, 'error-message'); return true;
    }

    /* === Validation en temps réel === */
    if (nom) nom.addEventListener('blur', validerNom);
    if (email) email.addEventListener('blur', validerEmail);
    if (sujet) sujet.addEventListener('change', validerSujet);
    if (message) message.addEventListener('blur', validerMessage);

    /* === Soumission === */
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        /* Anti-spam honeypot */
        if (honeypot && honeypot.value !== '') return;

        var ok1 = validerNom();
        var ok2 = validerEmail();
        var ok3 = validerSujet();
        var ok4 = validerMessage();

        if (ok1 && ok2 && ok3 && ok4) {
            var btn = form.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours...'; }

            // Envoi au serveur
            fetch(API + '/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: nom.value.trim(),
                    email: email.value.trim(),
                    telephone: telephone ? telephone.value.trim() : null,
                    sujet: sujet.value,
                    message: message.value.trim()
                })
            })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.error) {
                    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer le message'; }
                    erreur(null, 'error-message', data.error);
                    return;
                }

                // Succès
                if (success) success.hidden = false;
                if (btn) { btn.textContent = 'Message envoyé !'; }

                setTimeout(function () {
                    form.reset();
                    if (charCount) charCount.textContent = '0';
                    if (success) success.hidden = true;
                    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer le message'; }
                }, 4000);
            })
            .catch(function() {
                if (btn) { btn.disabled = false; btn.textContent = 'Envoyer le message'; }
                erreur(null, 'error-message', 'Erreur de connexion au serveur.');
            });
        }
    });

});
