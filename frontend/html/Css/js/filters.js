/* ================================================================
   FILTERS.JS - Filtres dynamiques page menus
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    var btnFiltrer = document.getElementById('btn-filtrer');
    var filterPrix = document.getElementById('filter-prix');
    var filterTheme = document.getElementById('filter-theme');
    var filterRegime = document.getElementById('filter-regime');
    var cards = document.querySelectorAll('.menu-card');

    if (!btnFiltrer) return;

    function filtrer() {
        var prix = filterPrix ? filterPrix.value : '';
        var theme = filterTheme ? filterTheme.value : '';
        var regime = filterRegime ? filterRegime.value : '';
        var nbVisible = 0;

        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var cardPrix = parseFloat(card.getAttribute('data-prix'));
            var cardTheme = card.getAttribute('data-theme');
            var cardRegime = card.getAttribute('data-regime');
            var show = true;

            /* Filtre prix */
            if (prix === '0-40' && cardPrix > 40) show = false;
            if (prix === '40-50' && (cardPrix <= 40 || cardPrix > 50)) show = false;
            if (prix === '50-65' && (cardPrix <= 50 || cardPrix > 65)) show = false;
            if (prix === '65+' && cardPrix < 65) show = false;

            /* Filtre thème */
            if (theme && cardTheme !== theme) show = false;

            /* Filtre régime */
            if (regime && cardRegime !== regime) show = false;

            card.style.display = show ? '' : 'none';
            if (show) nbVisible++;
        }

        /* Message aucun résultat */
        var msg = document.getElementById('no-results-message');
        if (nbVisible === 0) {
            if (!msg) {
                msg = document.createElement('p');
                msg.id = 'no-results-message';
                msg.textContent = 'Aucun menu ne correspond à vos critères.';
                msg.style.textAlign = 'center';
                msg.style.padding = '3rem';
                msg.style.color = '#666';
                msg.style.gridColumn = '1 / -1';
                document.querySelector('.menus-grid').appendChild(msg);
            }
        } else if (msg) {
            msg.remove();
        }
    }

    btnFiltrer.addEventListener('click', filtrer);
    if (filterPrix) filterPrix.addEventListener('change', filtrer);
    if (filterTheme) filterTheme.addEventListener('change', filtrer);
    if (filterRegime) filterRegime.addEventListener('change', filtrer);

});