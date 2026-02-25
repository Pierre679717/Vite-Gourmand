/* ================================================================
   ESPACE-ADMIN.JS
   Gestion admin : stats, graphiques, employés, commandes
   ================================================================ */

var API = '/api';
// ================================================================
// VÉRIFIER ACCÈS ADMIN
// ================================================================
function verifierAccesAdmin() {
    fetch(API + '/profil', { credentials: 'include' })
        .then(function(response) {
            if (!response.ok) {
                document.getElementById('access-denied').style.display = 'flex';
                document.getElementById('espace-admin').style.display = 'none';
                return null;
            }
            return response.json();
        })
        .then(function(data) {
            if (!data) return;
            var user = data.user;

            if (user.role !== 'admin') {
                document.getElementById('access-denied').style.display = 'flex';
                document.getElementById('espace-admin').style.display = 'none';
                return;
            }

            document.getElementById('access-denied').style.display = 'none';
            document.getElementById('espace-admin').style.display = 'block';

            document.getElementById('admin-name').textContent = user.prenom + ' ' + user.nom;
            document.getElementById('admin-email').textContent = user.email;
            document.getElementById('admin-avatar').textContent = user.prenom.charAt(0).toUpperCase();

            chargerStats();
            chargerEmployes();
            chargerCommandes();
        })
        .catch(function() {
            document.getElementById('access-denied').style.display = 'flex';
            document.getElementById('espace-admin').style.display = 'none';
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
        document.getElementById('tab-admin-stats').style.display = 'none';
        document.getElementById('tab-admin-employes').style.display = 'none';
        document.getElementById('tab-admin-commandes').style.display = 'none';
        document.getElementById('tab-' + tabName).style.display = 'block';
    });
}

// ================================================================
// CHARGER STATISTIQUES + GRAPHIQUES
// ================================================================
function chargerStats() {
    fetch(API + '/admin/stats', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(stats) {
            // Cartes
            document.getElementById('stat-users').textContent = stats.utilisateurs;
            document.getElementById('stat-commandes').textContent = stats.commandes;
            document.getElementById('stat-ca').textContent = parseFloat(stats.chiffre_affaires).toFixed(2) + ' €';
            document.getElementById('stat-menus').textContent = stats.menus_actifs;
            document.getElementById('stat-note').textContent = stats.note_moyenne + '/5';

            // Stats MongoDB
            if (stats.mongodb_stats) {
                document.getElementById('mongo-stats').style.display = 'block';
                document.getElementById('stat-visites').textContent = stats.mongodb_stats.visites;
                document.getElementById('stat-commandes-mongo').textContent = stats.mongodb_stats.commandes;
            }

            // Créer les graphiques
            creerGraphiques();
        })
        .catch(function(err) {
            console.error('Erreur stats:', err);
        });
}

function creerGraphiques() {
    // Charger les commandes pour les graphiques
    fetch(API + '/admin/commandes', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(commandes) {

            // Graphique 1 : Répartition par statut (Doughnut)
            var statuts = { en_attente: 0, confirmee: 0, en_cours: 0, livree: 0, annulee: 0 };
            var caParStatut = { en_attente: 0, confirmee: 0, en_cours: 0, livree: 0, annulee: 0 };

            for (var i = 0; i < commandes.length; i++) {
                var c = commandes[i];
                if (statuts[c.statut] !== undefined) {
                    statuts[c.statut]++;
                    caParStatut[c.statut] += parseFloat(c.prix_total);
                }
            }

            var ctx1 = document.getElementById('chart-commandes').getContext('2d');
            new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['En attente', 'Confirmée', 'En cours', 'Livrée', 'Annulée'],
                    datasets: [{
                        data: [statuts.en_attente, statuts.confirmee, statuts.en_cours, statuts.livree, statuts.annulee],
                        backgroundColor: ['#FF9800', '#2196F3', '#FFC107', '#4CAF50', '#F44336'],
                        borderWidth: 2,
                        borderColor: '#FFFFFF'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });

            // Graphique 2 : CA par statut (Bar)
            var ctx2 = document.getElementById('chart-ca').getContext('2d');
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['En attente', 'Confirmée', 'En cours', 'Livrée', 'Annulée'],
                    datasets: [{
                        label: 'Chiffre d\'affaires (€)',
                        data: [caParStatut.en_attente, caParStatut.confirmee, caParStatut.en_cours, caParStatut.livree, caParStatut.annulee],
                        backgroundColor: ['#FF9800', '#2196F3', '#FFC107', '#4CAF50', '#F44336'],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) { return value + ' €'; }
                            }
                        }
                    }
                }
            });
        });
}

// ================================================================
// CHARGER EMPLOYÉS
// ================================================================
function chargerEmployes() {
    fetch(API + '/admin/employes', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(employes) {
            var container = document.getElementById('admin-employes-list');

            if (!employes || employes.length === 0) {
                container.innerHTML = '<p class="espace-empty">Aucun employé enregistré.</p>';
                return;
            }

            var html = '';
            for (var i = 0; i < employes.length; i++) {
                var e = employes[i];
                var dateCreation = new Date(e.date_creation).toLocaleDateString('fr-FR');

                html += '<div class="commande-card">';
                html += '  <div class="commande-card-header">';
                html += '    <span class="commande-id">' + e.prenom + ' ' + e.nom + '</span>';
                html += '    <span class="commande-statut statut-confirmee">Employé</span>';
                html += '  </div>';
                html += '  <div class="commande-card-body">';
                html += '    <div class="commande-info"><span>Email :</span><strong>' + e.email + '</strong></div>';
                html += '    <div class="commande-info"><span>Ajouté le :</span><strong>' + dateCreation + '</strong></div>';
                html += '  </div>';
                html += '</div>';
            }

            container.innerHTML = html;
        });
}

// Ajouter un employé
var formEmploye = document.getElementById('form-employe');
if (formEmploye) {
    formEmploye.addEventListener('submit', function(e) {
        e.preventDefault();
        var messageDiv = document.getElementById('employe-message');

        fetch(API + '/admin/employes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                nom: document.getElementById('emp-nom-input').value,
                prenom: document.getElementById('emp-prenom-input').value,
                email: document.getElementById('emp-email-input').value,
                mot_de_passe: document.getElementById('emp-mdp').value
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error) {
                messageDiv.textContent = data.error;
                messageDiv.className = 'form-message form-error';
                return;
            }
            messageDiv.textContent = 'Employé créé avec succès !';
            messageDiv.className = 'form-message form-success';
            formEmploye.reset();
            chargerEmployes();
        });
    });
}

// ================================================================
// CHARGER COMMANDES (admin)
// ================================================================
function chargerCommandes() {
    fetch(API + '/admin/commandes', { credentials: 'include' })
        .then(function(response) { return response.json(); })
        .then(function(commandes) {
            var container = document.getElementById('admin-commandes-list');

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
                html += '    <span class="commande-id">#' + c.id + ' - ' + c.client_prenom + ' ' + c.client_nom + '</span>';
                html += '    <span class="commande-statut ' + statutClass + '">' + c.statut.replace('_', ' ') + '</span>';
                html += '  </div>';
                html += '  <div class="commande-card-body">';
                html += '    <div class="commande-info"><span>Menu :</span><strong>' + c.menu_nom + '</strong></div>';
                html += '    <div class="commande-info"><span>Personnes :</span><strong>' + c.nombre_personnes + '</strong></div>';
                html += '    <div class="commande-info"><span>Date :</span><strong>' + dateCmd + '</strong></div>';
                html += '    <div class="commande-info commande-total"><span>Total :</span><strong>' + parseFloat(c.prix_total).toFixed(2) + ' €</strong></div>';
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
verifierAccesAdmin();
