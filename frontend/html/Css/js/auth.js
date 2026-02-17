/* ================================================================
   AUTH.JS - Validation + connexion API backend
   ================================================================ */

var API = 'http://localhost:3000/api';

// ================================================================
// PAGE CONNEXION
// ================================================================
var formConnexion = document.getElementById('form-connexion');

if (formConnexion) {
    formConnexion.addEventListener('submit', function(e) {
        e.preventDefault();

        var email = document.getElementById('email');
        var motDePasse = document.getElementById('mot-de-passe');
        var messageErreur = document.getElementById('message-erreur');
        var btnSubmit = formConnexion.querySelector('button[type="submit"]');
        var ok = true;

        // Reset erreurs
        email.style.borderColor = '#CCC';
        motDePasse.style.borderColor = '#CCC';
        if (messageErreur) messageErreur.style.display = 'none';

        // Validation email
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.value || !emailRegex.test(email.value)) {
            email.style.borderColor = '#D32F2F';
            ok = false;
        }

        // Validation mot de passe
        if (!motDePasse.value || motDePasse.value.length < 8) {
            motDePasse.style.borderColor = '#D32F2F';
            ok = false;
        }

        if (!ok) {
            if (messageErreur) {
                messageErreur.textContent = 'Veuillez remplir tous les champs correctement.';
                messageErreur.style.display = 'block';
            }
            return;
        }

        // Appel API
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Connexion...';

        fetch(API + '/connexion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                email: email.value,
                mot_de_passe: motDePasse.value
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                if (messageErreur) {
                    messageErreur.textContent = data.error;
                    messageErreur.style.display = 'block';
                }
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Se connecter';
                return;
            }

            // Connexion réussie - rediriger selon le rôle
            btnSubmit.textContent = 'Connecté !';
            btnSubmit.style.backgroundColor = '#2E7D32';

            var user = data.user;
            setTimeout(function() {
                if (user.role === 'admin') {
                    window.location.href = 'espace-admin.html';
                } else if (user.role === 'employe') {
                    window.location.href = 'espace-employe.html';
                } else {
                    window.location.href = 'espace-utilisateur.html';
                }
            }, 1000);
        })
        .catch(function() {
            if (messageErreur) {
                messageErreur.textContent = 'Erreur de connexion au serveur.';
                messageErreur.style.display = 'block';
            }
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Se connecter';
        });
    });
}


// ================================================================
// PAGE INSCRIPTION
// ================================================================
var formInscription = document.getElementById('form-inscription');

if (formInscription) {
    // Indicateur de force du mot de passe
    var mdpInput = document.getElementById('mot-de-passe');
    var strengthBar = document.getElementById('strength-bar');
    var strengthText = document.getElementById('strength-text');

    if (mdpInput && strengthBar) {
        mdpInput.addEventListener('input', function() {
            var val = mdpInput.value;
            var score = 0;

            if (val.length >= 8) score++;
            if (val.length >= 12) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[a-z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            if (score <= 2) {
                strengthBar.style.width = '33%';
                strengthBar.style.backgroundColor = '#D32F2F';
                if (strengthText) strengthText.textContent = 'Faible';
            } else if (score <= 4) {
                strengthBar.style.width = '66%';
                strengthBar.style.backgroundColor = '#FF9800';
                if (strengthText) strengthText.textContent = 'Moyen';
            } else {
                strengthBar.style.width = '100%';
                strengthBar.style.backgroundColor = '#2E7D32';
                if (strengthText) strengthText.textContent = 'Fort';
            }
        });
    }

    formInscription.addEventListener('submit', function(e) {
        e.preventDefault();

        var nom = document.getElementById('nom');
        var prenom = document.getElementById('prenom');
        var email = document.getElementById('email');
        var telephone = document.getElementById('telephone');
        var motDePasse = document.getElementById('mot-de-passe');
        var confirmMdp = document.getElementById('confirm-mdp');
        var cgu = document.getElementById('cgu');
        var honeypot = document.getElementById('website');
        var btnSubmit = formInscription.querySelector('button[type="submit"]');
        var ok = true;

        // Reset
        var inputs = formInscription.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].style.borderColor = '#CCC';
        }
        var oldErrors = formInscription.querySelectorAll('.error-msg');
        for (var i = 0; i < oldErrors.length; i++) {
            oldErrors[i].textContent = '';
        }

        // Honeypot
        if (honeypot && honeypot.value) {
            console.warn('Bot détecté');
            return;
        }

        // Nom
        if (!nom.value || nom.value.length < 2) {
            nom.style.borderColor = '#D32F2F';
            showError(nom, 'Minimum 2 caractères');
            ok = false;
        }

        // Prénom
        if (!prenom.value || prenom.value.length < 2) {
            prenom.style.borderColor = '#D32F2F';
            showError(prenom, 'Minimum 2 caractères');
            ok = false;
        }

        // Email
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.value || !emailRegex.test(email.value)) {
            email.style.borderColor = '#D32F2F';
            showError(email, 'E-mail invalide');
            ok = false;
        }

        // Téléphone (optionnel)
        if (telephone && telephone.value) {
            var telRegex = /^[0-9\s\+\-\.()]+$/;
            if (!telRegex.test(telephone.value)) {
                telephone.style.borderColor = '#D32F2F';
                showError(telephone, 'Numéro invalide');
                ok = false;
            }
        }

        // Mot de passe
        var mdpRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!motDePasse.value || !mdpRegex.test(motDePasse.value)) {
            motDePasse.style.borderColor = '#D32F2F';
            showError(motDePasse, 'Min 8 car. avec majuscule, minuscule, chiffre et caractère spécial');
            ok = false;
        }

        // Confirmation
        if (confirmMdp && confirmMdp.value !== motDePasse.value) {
            confirmMdp.style.borderColor = '#D32F2F';
            showError(confirmMdp, 'Les mots de passe ne correspondent pas');
            ok = false;
        }

        // CGU
        if (cgu && !cgu.checked) {
            showError(cgu, 'Vous devez accepter les CGU');
            ok = false;
        }

        if (!ok) return;

        // Appel API
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Création...';

        fetch(API + '/inscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                nom: nom.value,
                prenom: prenom.value,
                email: email.value,
                telephone: telephone ? telephone.value : null,
                mot_de_passe: motDePasse.value
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                showError(email, data.error);
                email.style.borderColor = '#D32F2F';
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Créer mon compte';
                return;
            }

            // Succès
            btnSubmit.textContent = 'Compte créé !';
            btnSubmit.style.backgroundColor = '#2E7D32';

            var successDiv = document.createElement('div');
            successDiv.style.cssText = 'background: #E8F5E9; color: #2E7D32; padding: 12px 16px; border-radius: 8px; margin-top: 1rem; font-weight: 600; text-align: center;';
            successDiv.textContent = 'Compte créé avec succès ! Redirection...';
            formInscription.appendChild(successDiv);

            setTimeout(function() {
                window.location.href = 'connexion.html';
            }, 2000);
        })
        .catch(function() {
            showError(email, 'Erreur de connexion au serveur.');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Créer mon compte';
        });
    });
}

// ================================================================
// FONCTION UTILITAIRE : afficher erreur sous un champ
// ================================================================
function showError(input, message) {
    var errorSpan = input.parentNode.querySelector('.error-msg');
    if (errorSpan) {
        errorSpan.textContent = message;
    }
}

// ================================================================
// TOGGLE MOT DE PASSE (oeil)
// ================================================================
var toggleBtns = document.querySelectorAll('.toggle-password');
for (var i = 0; i < toggleBtns.length; i++) {
    toggleBtns[i].addEventListener('click', function() {
        var input = this.parentNode.querySelector('input');
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = '🙈';
        } else {
            input.type = 'password';
            this.textContent = '👁️';
        }
    });
}
