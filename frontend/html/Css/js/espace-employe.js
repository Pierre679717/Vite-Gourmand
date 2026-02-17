/* ================================================================
   ESPACE-EMPLOYE.JS
   Gestion employé : commandes, menus, avis
   ================================================================ */

var API = 'http://localhost:3000/api';

// ================================================================
// VÉRIFIER ACCÈS EMPLOYÉ
// ================================================================
function verifierAcces() {
    fetch(API + '/profil', { credentials: 'include' })
        .then(function(response) {
            if (!response.ok) {
                document.getElementById('access-denied').style.display = 'flex';
                document.getElementById('espace-employe').style.display = 'none';
                return null;
            }
            return response.json();
        })
        .then(function(data) {
            if (!data) return;
            var user = data.user;

            if (user.role !== 'employe' && user.role !== 'admin') {
                document.getElementById('access-denied').style.display = 'flex';
                document.getElementById('espace-employe').style.display = 'none';
                return;
            }

            document.getElementById('access-denied').style.display = 'none';
            document.getElementById('espace-employe').style.display = 'block';

            document.getElementById('emp-name').textContent = user.prenom + ' ' + user.nom;
            document.getElementById('emp-email').textContent = user.email;
            document.getElementById('emp-avatar').textContent = user.prenom.charAt(0).toUpperCase();
            document.getElementById('emp-role').textContent = user.role === 'admin' ? 'Administrateur' : 'Employé';

            chargerCommandes();
            chargerMenusExistants();
            chargerAvis();
        })
        .catch(function() {
            document.getElementById('access-denied').style.display = 'flex';
            document.getElementById('espace-employe').style.display = 'none';
        });
}

// ================================================================
// ONGLETS
// ================================================================
var tabs = document.querySelectorAll('.espace-tab');
for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
        for (var j = 0; j < tabs.length; j++) {
            tabs[j].classList.remove('active');
        }
        this.classList.add('active');

        var tabName = this.getAttribute('data-tab');
        document.getElementById('tab-emp-commandes').style.display = 'none';
        document.getElementById('tab-emp-menus').style.display = 'none';
        document.getElementById('tab-emp-avis').style.display = 'none';
        document.getElementById('tab-' + tabName).style.display = 'block';
    });
}

// ================================================================
// CHARGER COMMANDES
// ================================================================
var toutesLesCommandes = [];

function chargerCommandes() {
    fetch(API + '/employe/commandes', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(commandes) {
            toutesLesCommandes = commandes;
            afficherCommandes(commandes);
        })
        .catch(function() {
            document.getElementById('emp-commandes-list').innerHTML = '<p class="text-error">Erreur chargement.</p>';
        });
}

function afficherCommandes(commandes) {
    var container = document.getElementById('emp-commandes-list');

    if (!commandes || commandes.length === 0) {
        container.innerHTML = '<p class="espace-empty">Aucune commande.</p>';
        return;
    }

    var html = '';
    for (var i = 0; i < commandes.length; i++) {
        var c = commandes[i];
        var statutClass = 'statut-' + c.statut;
        var dateCmd = new Date(c.date_commande).toLocaleDateString('fr-FR');

        html += '<div class="commande-card">';
        html += '  <div class="commande-card-header">';
        html += '    <span class="commande-id">Commande #' + c.id + ' - ' + c.client_prenom + ' ' + c.client_nom + '</span>';
        html += '    <span class="commande-statut ' + statutClass + '">' + c.statut.replace('_', ' ') + '</span>';
        html += '  </div>';
        html += '  <div class="commande-card-body">';
        html += '    <div class="commande-info"><span>Menu :</span><strong>' + c.menu_nom + '</strong></div>';
        html += '    <div class="commande-info"><span>Personnes :</span><strong>' + c.nombre_personnes + '</strong></div>';
        html += '    <div class="commande-info"><span>Email client :</span><strong>' + c.client_email + '</strong></div>';
        html += '    <div class="commande-info"><span>Date :</span><strong>' + dateCmd + '</strong></div>';
        html += '    <div class="commande-info commande-total"><span>Total :</span><strong>' + parseFloat(c.prix_total).toFixed(2) + ' €</strong></div>';
        html += '    <div class="commande-actions">';
        html += '      <label>Changer statut :</label>';
        html += '      <select onchange="changerStatut(' + c.id + ', this.value)">';
        html += '        <option value="en_attente"' + (c.statut === 'en_attente' ? ' selected' : '') + '>En attente</option>';
        html += '        <option value="confirmee"' + (c.statut === 'confirmee' ? ' selected' : '') + '>Confirmée</option>';
        html += '        <option value="en_cours"' + (c.statut === 'en_cours' ? ' selected' : '') + '>En cours</option>';
        html += '        <option value="livree"' + (c.statut === 'livree' ? ' selected' : '') + '>Livrée</option>';
        html += '        <option value="annulee"' + (c.statut === 'annulee' ? ' selected' : '') + '>Annulée</option>';
        html += '      </select>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// Filtre par statut
var filtreStatut = document.getElementById('filtre-statut');
if (filtreStatut) {
    filtreStatut.addEventListener('change', function() {
        var val = this.value;
        if (!val) {
            afficherCommandes(toutesLesCommandes);
        } else {
            var filtrees = [];
            for (var i = 0; i < toutesLesCommandes.length; i++) {
                if (toutesLesCommandes[i].statut === val) filtrees.push(toutesLesCommandes[i]);
            }
            afficherCommandes(filtrees);
        }
    });
}

// Changer statut commande
function changerStatut(commandeId, nouveauStatut) {
    fetch(API + '/employe/commandes/' + commandeId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statut: nouveauStatut })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.message) {
            chargerCommandes();
        }
    });
}

// ================================================================
// CHARGER MENUS EXISTANTS
// ================================================================
function chargerMenusExistants() {
    fetch(API + '/menus')
        .then(function(response) { return response.json(); })
        .then(function(menus) {
            var container = document.getElementById('emp-menus-list');
            var html = '';
            for (var i = 0; i < menus.length; i++) {
                var m = menus[i];
                html += '<div class="commande-card">';
                html += '  <div class="commande-card-header">';
                html += '    <span class="commande-id">' + m.nom + '</span>';
                html += '    <span class="commande-statut statut-livree">' + parseFloat(m.prix).toFixed(2) + ' €/pers.</span>';
                html += '  </div>';
                html += '  <div class="commande-card-body">';
                html += '    <div class="commande-info"><span>Thème :</span><strong>' + (m.theme || '-') + '</strong></div>';
                html += '    <div class="commande-info"><span>Régime :</span><strong>' + (m.regime || '-') + '</strong></div>';
                html += '    <div class="commande-info"><span>Min. personnes :</span><strong>' + m.minimum_personnes + '</strong></div>';
                html += '  </div>';
                html += '</div>';
            }
            container.innerHTML = html;
        });
}

// Ajouter un menu
var formMenu = document.getElementById('form-menu');
if (formMenu) {
    formMenu.addEventListener('submit', function(e) {
        e.preventDefault();
        var messageDiv = document.getElementById('menu-message');

        fetch(API + '/employe/menus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                nom: document.getElementById('menu-nom').value,
                description: document.getElementById('menu-description').value,
                prix: parseFloat(document.getElementById('menu-prix').value),
                theme: document.getElementById('menu-theme').value,
                regime: document.getElementById('menu-regime').value,
                minimum_personnes: parseInt(document.getElementById('menu-minimum').value)
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                messageDiv.textContent = data.error;
                messageDiv.className = 'form-message form-error';
                return;
            }
            messageDiv.textContent = 'Menu ajouté avec succès !';
            messageDiv.className = 'form-message form-success';
            formMenu.reset();
            chargerMenusExistants();
        });
    });
}

// ================================================================
// CHARGER AVIS
// ================================================================
function chargerAvis() {
    fetch(API + '/avis')
        .then(function(response) { return response.json(); })
        .then(function(avis) {
            var container = document.getElementById('emp-avis-list');

            if (!avis || avis.length === 0) {
                container.innerHTML = '<p class="espace-empty">Aucun avis pour le moment.</p>';
                return;
            }

            var html = '';
            for (var i = 0; i < avis.length; i++) {
                var a = avis[i];
                var etoiles = '';
                for (var j = 0; j < 5; j++) {
                    etoiles += j < a.note ? '★' : '☆';
                }
                var dateAvis = new Date(a.date_creation).toLocaleDateString('fr-FR');

                html += '<div class="commande-card">';
                html += '  <div class="commande-card-header">';
                html += '    <span class="commande-id">' + a.prenom + ' ' + a.nom + '</span>';
                html += '    <span style="color: #D4AF37; font-size: 1.2rem;">' + etoiles + '</span>';
                html += '  </div>';
                html += '  <div class="commande-card-body">';
                if (a.commentaire) {
                    html += '    <p style="color: #555; font-style: italic;">"' + a.commentaire + '"</p>';
                }
                html += '    <p style="color: #999; font-size: 0.85rem; margin-top: 0.5rem;">' + dateAvis + '</p>';
                html += '  </div>';
                html += '</div>';
            }

            container.innerHTML = html;
        });
}

// ================================================================
// DÉCONNEXION
// ================================================================
var btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', function() {
        fetch(API + '/deconnexion', { credentials: 'include' })
            .then(function() { window.location.href = 'connexion.html'; });
    });
}

// ================================================================
// LANCER
// ================================================================
verifierAcces();
