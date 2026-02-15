/**
 * ================================================================
 * VITE & GOURMAND - FILTERS.JS (CORRIGÉ)
 * ================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Initialisation des filtres...');
    
    // Récupérer les éléments
    const form = document.getElementById('filters-form');
    const filterPrix = document.getElementById('filter-prix');
    const filterTheme = document.getElementById('filter-theme');
    const filterRegime = document.getElementById('filter-regime');
    const btnReset = document.getElementById('btn-reset');
    const menusGrid = document.getElementById('menus-grid');
    const noResults = document.getElementById('no-results');
    
    // Vérifier qu'on est sur la bonne page
    if (!form || !menusGrid) {
        console.log('❌ Pas sur la page menus, filtres non initialisés');
        return;
    }
    
    // Récupérer toutes les cartes
    const menuCards = menusGrid.querySelectorAll('.menu-card');
    console.log('✅ Trouvé', menuCards.length, 'cartes de menu');
    
    /**
     * Vérifier le filtre de prix
     */
    function checkPrixFilter(cardPrix, filterValue) {
        if (!filterValue) return true;
        
        const range = filterValue.split('-');
        const minPrix = parseInt(range[0], 10);
        const maxPrix = parseInt(range[1], 10);
        
        return cardPrix >= minPrix && cardPrix <= maxPrix;
    }
    
    /**
     * Vérifier le filtre de thème
     */
    function checkThemeFilter(cardTheme, filterValue) {
        if (!filterValue) return true;
        return cardTheme.toLowerCase() === filterValue.toLowerCase();
    }
    
    /**
     * Vérifier le filtre de régime
     */
    function checkRegimeFilter(cardRegime, filterValue) {
        if (!filterValue) return true;
        return cardRegime.toLowerCase() === filterValue.toLowerCase();
    }
    
    /**
     * Appliquer les filtres
     */
    function applyFilters() {
        console.log('🔍 Application des filtres...');
        
        const prixValue = filterPrix ? filterPrix.value : '';
        const themeValue = filterTheme ? filterTheme.value : '';
        const regimeValue = filterRegime ? filterRegime.value : '';
        
        console.log('Filtres sélectionnés:', { prix: prixValue, theme: themeValue, regime: regimeValue });
        
        let visibleCount = 0;
        
        menuCards.forEach(function(card) {
            const cardPrix = parseInt(card.getAttribute('data-prix'), 10);
            const cardTheme = card.getAttribute('data-theme') || '';
            const cardRegime = card.getAttribute('data-regime') || '';
            
            const matchPrix = checkPrixFilter(cardPrix, prixValue);
            const matchTheme = checkThemeFilter(cardTheme, themeValue);
            const matchRegime = checkRegimeFilter(cardRegime, regimeValue);
            
            const isVisible = matchPrix && matchTheme && matchRegime;
            
            if (isVisible) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Message aucun résultat
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
        
        // Bouton réinitialiser
        if (btnReset) {
            const hasFilter = prixValue || themeValue || regimeValue;
            btnReset.style.display = hasFilter ? 'inline-block' : 'none';
        }
        
        console.log('📋 Résultat:', visibleCount, 'menu(s) visible(s)');
    }
    
    /**
     * Réinitialiser les filtres
     */
    function resetFilters() {
        if (filterPrix) filterPrix.value = '';
        if (filterTheme) filterTheme.value = '';
        if (filterRegime) filterRegime.value = '';
        
        menuCards.forEach(function(card) {
            card.style.display = '';
        });
        
        if (noResults) noResults.style.display = 'none';
        if (btnReset) btnReset.style.display = 'none';
        
        console.log('🔄 Filtres réinitialisés');
    }
    
    // ÉVÉNEMENT : Soumission du formulaire
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        applyFilters();
    });
    
    // ÉVÉNEMENT : Bouton réinitialiser
    if (btnReset) {
        btnReset.addEventListener('click', function(event) {
            event.preventDefault();
            resetFilters();
        });
    }
    
    console.log('✅ Filtres initialisés avec succès');
});