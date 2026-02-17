/* ================================================================
   MAIN.JS - Menu hamburger + Toggle mot de passe
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    /* === MENU HAMBURGER === */
    var btn = document.getElementById('hamburger-btn');
    var menu = document.getElementById('mobile-menu');

    if (btn && menu) {
        btn.addEventListener('click', function () {
            if (menu.style.display === 'block') {
                menu.style.display = 'none';
                btn.classList.remove('active');
            } else {
                menu.style.display = 'block';
                btn.classList.add('active');
            }
        });
    }

    /* === TOGGLE MOT DE PASSE === */
    var toggleBtns = document.querySelectorAll('.btn-toggle-password');
    for (var i = 0; i < toggleBtns.length; i++) {
        toggleBtns[i].addEventListener('click', function () {
            var input = document.getElementById(this.getAttribute('data-target'));
            if (input) {
                input.type = (input.type === 'password') ? 'text' : 'password';
            }
        });
    }

});