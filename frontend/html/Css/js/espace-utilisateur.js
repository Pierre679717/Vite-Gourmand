/* ================================================================
   ESPACE-UTILISATEUR.JS
   Gestion de l'espace client : profil, commandes, commander, avis
   ================================================================ */

var API = 'http://localhost:3000/api';

// ================================================================
// VÉRIFIER SI CONNECTÉ
// ================================================================
function verifierConnexion() {
    fetch(API + '/profil', { credentials: 'include' })
        .then(function(response) {
            if (!response.ok) {
                // Non connecté
                document.getElementById('login-required').style.display = 'flex';
                document.getElementById('espace-user').style.display = 'none';
                return null;
            }
            return response.json();
        })
        .then(function(data) {
            if (!data) return;
            // Connecté
            document.getElementById('login-required').style.display = 'none';
            document.getElementById('espace-user').style.display = 'block';

            // Afficher les infos utilisateur
            var user = data.user;
            document.getElementById('user-name').textContent = user.prenom + ' ' + user.nom;
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('user-avatar').textContent = user.prenom.charAt(0).toUpperCase();

            var roleTexte = 'Client';
            if (user.role === 'admin') roleTexte = 'Administrateur';
            if (user.role === 'employe') roleTexte = 'Employé';
            document.getElementById('user-role').textContent = roleTexte;

            // Charger les commandes
            chargerCommandes();
            chargerMenus();
        })
        .catch(function() {
            document.getElementById('login-required').style.display = 'flex';
            document.getElementById('espace-user').style.display = 'none';
        });
}

// ================================================================
// ONGLETS
// ================================================================
var tabs = document.querySelectorAll('.espace-tab');
for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
        // Retirer la classe active de tous les onglets
        for (var j = 0; j < tabs.length; j++) {
            tabs[j].classList.remove('active');
        }
        this.classList.add('active');

        // Masquer tous les contenus
        var tabName = this.getAttribute('data-tab');
        document.getElementById('tab-commandes').style.display = 'none';
        document.getElementById('tab-commander').style.display = 'none';
        document.getElementById('tab-avis').style.display = 'none';

        // Afficher le bon
        document.getElementById('tab-' + tabName).style.display = 'block';
    });
}

// ================================================================
// CHARGER MES COMMANDES
// ================================================================
function chargerCommandes() {
    fetch(API + '/commandes', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(commandes) {
            var container = document.getElementById('commandes-list');

            if (!commandes || commandes.length === 0) {
                container.innerHTML = '<div class="espace-empty"><p>Vous n\'avez pas encore de commande.</p><button class="btn-primary" onclick="document.querySelector(\'[data-tab=commander]\').click()">Commander maintenant</button></div>';
                return;
            }

            var html = '';
            for (var i = 0; i < commandes.length; i++) {
                var c = commandes[i];
                var statutClass = 'statut-' + c.statut;
                var statutTexte = c.statut.replace('_', ' ');
                statutTexte = statutTexte.charAt(0).toUpperCase() + statutTexte.slice(1);

                var dateCmd = new Date(c.date_commande).toLocaleDateString('fr-FR');
                var dateEvt = c.date_evenement ? new Date(c.date_evenement).toLocaleDateString('fr-FR') : 'Non définie';

                html += '<div class="commande-card">';
                html += '  <div class="commande-card-header">';
                html += '    <span class="commande-id">Commande #' + c.id + '</span>';
                html += '    <span class="commande-statut ' + statutClass + '">' + statutTexte + '</span>';
                html += '  </div>';
                html += '  <div class="commande-card-body">';
                html += '    <div class="commande-info"><span>Menu :</span><strong>' + c.menu_nom + '</strong></div>';
                html += '    <div class="commande-info"><span>Personnes :</span><strong>' + c.nombre_personnes + '</strong></div>';
                html += '    <div class="commande-info"><span>Date événement :</span><strong>' + dateEvt + '</strong></div>';
                html += '    <div class="commande-info"><span>Commandé le :</span><strong>' + dateCmd + '</strong></div>';
                if (c.reduction > 0) {
                    html += '    <div class="commande-info"><span>Réduction :</span><strong class="text-green">-' + c.reduction + '%</strong></div>';
                }
                html += '    <div class="commande-info commande-total"><span>Total :</span><strong>' + parseFloat(c.prix_total).toFixed(2) + ' €</strong></div>';
                html += '  </div>';
                html += '</div>';
            }

            container.innerHTML = html;
        })
        .catch(function() {
            document.getElementById('commandes-list').innerHTML = '<p class="text-error">Erreur lors du chargement des commandes.</p>';
        });
}

// ================================================================
// CHARGER LES MENUS (pour le formulaire de commande)
// ================================================================
var menusData = [];

function chargerMenus() {
    fetch(API + '/menus')
        .then(function(response) { return response.json(); })
        .then(function(menus) {
            menusData = menus;
            var select = document.getElementById('menu-select');
            for (var i = 0; i < menus.length; i++) {
                var option = document.createElement('option');
                option.value = menus[i].id;
                option.textContent = menus[i].nom + ' - ' + parseFloat(menus[i].prix).toFixed(2) + ' €/pers.';
                select.appendChild(option);
            }
        });
}

// ================================================================
// CALCULER LE PRIX EN TEMPS RÉEL
// ================================================================
function calculerPrix() {
    var menuId = document.getElementById('menu-select').value;
    var nbPersonnes = parseInt(document.getElementById('nb-personnes').value) || 0;
    var recap = document.getElementById('commande-recap');

    if (!menuId || nbPersonnes < 1) {
        recap.style.display = 'none';
        return;
    }

    // Trouver le menu
    var menu = null;
    for (var i = 0; i < menusData.length; i++) {
        if (menusData[i].id == menuId) {
            menu = menusData[i];
            break;
        }
    }

    if (!menu) return;

    var prixUnit = parseFloat(menu.prix);
    var total = prixUnit * nbPersonnes;
    var reduction = false;

    if (nbPersonnes > 5) {
        reduction = true;
        total = total * 0.9;
    }

    recap.style.display = 'block';
    document.getElementById('recap-menu').textContent = menu.nom;
    document.getElementById('recap-prix-unit').textContent = prixUnit.toFixed(2) + ' €';
    document.getElementById('recap-personnes').textContent = nbPersonnes;
    document.getElementById('recap-total').textContent = total.toFixed(2) + ' €';

    if (reduction) {
        document.getElementById('recap-reduction-line').style.display = 'flex';
    } else {
        document.getElementById('recap-reduction-line').style.display = 'none';
    }
}

var menuSelect = document.getElementById('menu-select');
var nbPersonnesInput = document.getElementById('nb-personnes');
if (menuSelect) menuSelect.addEventListener('change', calculerPrix);
if (nbPersonnesInput) nbPersonnesInput.addEventListener('input', calculerPrix);

// ================================================================
// SOUMETTRE UNE COMMANDE
// ================================================================
var formCommande = document.getElementById('form-commande');
if (formCommande) {
    formCommande.addEventListener('submit', function(e) {
        e.preventDefault();

        var menuId = document.getElementById('menu-select').value;
        var nbPersonnes = parseInt(document.getElementById('nb-personnes').value);
        var dateEvt = document.getElementById('date-evenement').value;
        var adresse = document.getElementById('adresse-livraison').value;
        var commentaire = document.getElementById('commentaire').value;
        var messageDiv = document.getElementById('commande-message');

        if (!menuId) {
            messageDiv.textContent = 'Veuillez sélectionner un menu.';
            messageDiv.className = 'form-message form-error';
            return;
        }
        if (nbPersonnes < 6) {
            messageDiv.textContent = 'Minimum 6 personnes.';
            messageDiv.className = 'form-message form-error';
            return;
        }

        fetch(API + '/commandes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                menu_id: parseInt(menuId),
                nombre_personnes: nbPersonnes,
                date_evenement: dateEvt || null,
                adresse_livraison: adresse || null,
                commentaire: commentaire || null
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                messageDiv.textContent = data.error;
                messageDiv.className = 'form-message form-error';
                return;
            }
            messageDiv.textContent = 'Commande enregistrée ! Total : ' + data.commande.prix_total;
            messageDiv.className = 'form-message form-success';
            formCommande.reset();
            document.getElementById('commande-recap').style.display = 'none';

            // Recharger les commandes
            setTimeout(function() {
                document.querySelector('[data-tab="commandes"]').click();
                chargerCommandes();
            }, 2000);
        })
        .catch(function() {
            messageDiv.textContent = 'Erreur lors de la commande.';
            messageDiv.className = 'form-message form-error';
        });
    });
}

// ================================================================
// ÉTOILES (avis)
// ================================================================
var stars = document.querySelectorAll('.star');
for (var i = 0; i < stars.length; i++) {
    stars[i].addEventListener('click', function() {
        var note = parseInt(this.getAttribute('data-note'));
        document.getElementById('note-value').value = note;

        // Colorier les étoiles
        for (var j = 0; j < stars.length; j++) {
            if (parseInt(stars[j].getAttribute('data-note')) <= note) {
                stars[j].style.color = '#D4AF37';
            } else {
                stars[j].style.color = '#CCC';
            }
        }
    });
}

// ================================================================
// SOUMETTRE UN AVIS
// ================================================================
var formAvis = document.getElementById('form-avis');
if (formAvis) {
    formAvis.addEventListener('submit', function(e) {
        e.preventDefault();

        var note = parseInt(document.getElementById('note-value').value);
        var commentaire = document.getElementById('avis-commentaire').value;
        var messageDiv = document.getElementById('avis-message');

        if (!note || note < 1 || note > 5) {
            messageDiv.textContent = 'Veuillez sélectionner une note (1 à 5 étoiles).';
            messageDiv.className = 'form-message form-error';
            return;
        }

        fetch(API + '/avis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ note: note, commentaire: commentaire || null })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                messageDiv.textContent = data.error;
                messageDiv.className = 'form-message form-error';
                return;
            }
            messageDiv.textContent = 'Merci pour votre avis !';
            messageDiv.className = 'form-message form-success';
            formAvis.reset();
            // Reset étoiles
            for (var j = 0; j < stars.length; j++) {
                stars[j].style.color = '#CCC';
            }
            document.getElementById('note-value').value = '0';
        })
        .catch(function() {
            messageDiv.textContent = 'Erreur lors de l\'envoi de l\'avis.';
            messageDiv.className = 'form-message form-error';
        });
    });
}

// ================================================================
// DÉCONNEXION
// ================================================================
var btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', function() {
        fetch(API + '/deconnexion', { credentials: 'include' })
            .then(function() {
                window.location.href = 'connexion.html';
            });
    });
}

// ================================================================
// DATE MINIMUM = AUJOURD'HUI
// ================================================================
var dateInput = document.getElementById('date-evenement');
if (dateInput) {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    dateInput.setAttribute('min', yyyy + '-' + mm + '-' + dd);
}

// ================================================================
// LANCER
// ================================================================
verifierConnexion();
