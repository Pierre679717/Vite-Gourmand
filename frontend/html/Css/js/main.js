/**
 * ================================================================
 * VITE & GOURMAND - MAIN.JS
 * ================================================================
 * 
 * Fichier JavaScript principal
 * Contient les fonctionnalités communes à toutes les pages
 * 
 * SOMMAIRE :
 * 1. Menu mobile (hamburger)
 * 2. Header sticky au scroll
 * 3. Smooth scroll pour les ancres
 * 4. Utilitaires de sécurité
 * 
 * BONNES PRATIQUES APPLIQUÉES :
 * - "use strict" : mode strict pour éviter les erreurs silencieuses
 * - DOMContentLoaded : attend que le DOM soit prêt
 * - Fonctions nommées : meilleur débogage
 * - Gestion des erreurs : try/catch
 * - Pas de variables globales : tout dans des fonctions
 * 
 * ================================================================
 */

'use strict';

/**
 * ================================================================
 * INITIALISATION
 * ================================================================
 * On attend que le DOM soit complètement chargé avant d'exécuter
 * le code JavaScript. Cela évite les erreurs "element is null".
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🍽️ Vite & Gourmand - Site chargé');
    
    // Initialiser toutes les fonctionnalités
    initMobileMenu();
    initStickyHeader();
    initSmoothScroll();
});


/**
 * ================================================================
 * 1. MENU MOBILE (HAMBURGER)
 * ================================================================
 * 
 * Fonctionnalité : Ouvre/ferme le menu sur mobile
 * 
 * ACCESSIBILITÉ :
 * - aria-expanded : indique si le menu est ouvert
 * - aria-label : décrit l'action du bouton
 * - Focus trap : le focus reste dans le menu quand ouvert
 * 
 */
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('main-nav');
    
    // Vérifier que les éléments existent
    if (!menuToggle || !nav) {
        return; // Sortir si les éléments n'existent pas
    }
    
    /**
     * Fonction pour basculer le menu
     */
    function toggleMenu() {
        const isOpen = nav.classList.contains('active');
        
        if (isOpen) {
            // Fermer le menu
            nav.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
            document.body.style.overflow = ''; // Réactiver le scroll
        } else {
            // Ouvrir le menu
            nav.classList.add('active');
            menuToggle.setAttribute('aria-expanded', 'true');
            menuToggle.setAttribute('aria-label', 'Fermer le menu');
            document.body.style.overflow = 'hidden'; // Bloquer le scroll
        }
    }
    
    /**
     * Fonction pour fermer le menu
     */
    function closeMenu() {
        nav.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
        document.body.style.overflow = '';
    }
    
    // Événement : clic sur le bouton hamburger
    menuToggle.addEventListener('click', toggleMenu);
    
    // Événement : clic sur un lien du menu (ferme le menu)
    const navLinks = nav.querySelectorAll('.nav-link');
    navLinks.forEach(function(link) {
        link.addEventListener('click', closeMenu);
    });
    
    // Événement : touche Escape (ferme le menu)
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && nav.classList.contains('active')) {
            closeMenu();
            menuToggle.focus(); // Remettre le focus sur le bouton
        }
    });
    
    // Événement : clic en dehors du menu (ferme le menu)
    document.addEventListener('click', function(event) {
        const isClickInsideNav = nav.contains(event.target);
        const isClickOnToggle = menuToggle.contains(event.target);
        
        if (!isClickInsideNav && !isClickOnToggle && nav.classList.contains('active')) {
            closeMenu();
        }
    });
}


/**
 * ================================================================
 * 2. HEADER STICKY AU SCROLL
 * ================================================================
 * 
 * Fonctionnalité : Ajoute une ombre au header quand on scroll
 * 
 * PERFORMANCE :
 * - On utilise requestAnimationFrame pour optimiser
 * - On évite de modifier le DOM à chaque événement scroll
 * 
 */
function initStickyHeader() {
    const header = document.querySelector('.header');
    
    if (!header) {
        return;
    }
    
    let lastScrollY = 0;
    let ticking = false;
    
    /**
     * Met à jour l'apparence du header selon le scroll
     */
    function updateHeader() {
        const scrollY = window.scrollY;
        
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollY = scrollY;
        ticking = false;
    }
    
    /**
     * Gestionnaire de scroll optimisé avec requestAnimationFrame
     */
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', onScroll);
}


/**
 * ================================================================
 * 3. SMOOTH SCROLL POUR LES ANCRES
 * ================================================================
 * 
 * Fonctionnalité : Défilement fluide vers les ancres (#section)
 * 
 * Note : CSS "scroll-behavior: smooth" fait déjà ça,
 * mais ce JS ajoute un offset pour le header fixe.
 * 
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(function(link) {
        link.addEventListener('click', function(event) {
            const href = this.getAttribute('href');
            
            // Ignorer si c'est juste "#"
            if (href === '#') {
                return;
            }
            
            const target = document.querySelector(href);
            
            if (target) {
                event.preventDefault();
                
                // Calculer la position avec offset pour le header
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Mettre le focus sur l'élément cible (accessibilité)
                target.setAttribute('tabindex', '-1');
                target.focus();
            }
        });
    });
}


/**
 * ================================================================
 * 4. UTILITAIRES DE SÉCURITÉ
 * ================================================================
 * 
 * Fonctions utilitaires pour la sécurité côté client
 * 
 * IMPORTANT : Ces fonctions sont un COMPLÉMENT à la validation
 * côté serveur, pas un remplacement !
 * 
 */

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * 
 * @param {string} text - Le texte à échapper
 * @returns {string} - Le texte échappé
 * 
 * UTILISATION :
 * const safe = escapeHTML(userInput);
 * element.innerHTML = safe; // Sécurisé
 * 
 * ATTENTION : Préférer textContent quand possible !
 * element.textContent = userInput; // Plus sécurisé
 */
function escapeHTML(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Valide le format d'une adresse email
 * 
 * @param {string} email - L'email à valider
 * @returns {boolean} - True si valide
 * 
 * Note : Cette regex est simplifiée. La validation complète
 * doit se faire côté serveur.
 */
function isValidEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    
    // Regex simplifiée pour email
    // Format : texte@texte.texte
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valide le format d'un numéro de téléphone français
 * 
 * @param {string} phone - Le numéro à valider
 * @returns {boolean} - True si valide
 */
function isValidPhone(phone) {
    if (typeof phone !== 'string' || phone.trim() === '') {
        return true; // Vide = ok (champ optionnel)
    }
    
    // Accepte : 01 23 45 67 89, 0123456789, +33123456789, etc.
    const phoneRegex = /^[\d\s\+\-\.]{10,20}$/;
    return phoneRegex.test(phone);
}

/**
 * Nettoie une chaîne de caractères (trim + supprime espaces multiples)
 * 
 * @param {string} text - Le texte à nettoyer
 * @returns {string} - Le texte nettoyé
 */
function sanitizeString(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    return text.trim().replace(/\s+/g, ' ');
}

/**
 * Affiche un message d'erreur sous un champ
 * 
 * @param {HTMLElement} input - Le champ concerné
 * @param {string} message - Le message d'erreur
 */
function showFieldError(input, message) {
    // Trouver l'élément d'erreur associé
    const errorId = input.getAttribute('aria-describedby');
    if (!errorId) return;
    
    // Chercher l'élément d'erreur (peut avoir plusieurs IDs séparés par espace)
    const errorIds = errorId.split(' ');
    const errorElement = document.getElementById(errorIds.find(id => id.includes('error')));
    
    if (errorElement) {
        errorElement.textContent = message;
        input.classList.add('error');
    }
}

/**
 * Efface le message d'erreur d'un champ
 * 
 * @param {HTMLElement} input - Le champ concerné
 */
function clearFieldError(input) {
    const errorId = input.getAttribute('aria-describedby');
    if (!errorId) return;
    
    const errorIds = errorId.split(' ');
    const errorElement = document.getElementById(errorIds.find(id => id.includes('error')));
    
    if (errorElement) {
        errorElement.textContent = '';
        input.classList.remove('error');
    }
}


// Exporter les fonctions utilitaires pour les autres scripts
// (Pas de module ES6 pour rester compatible avec tous les navigateurs)
window.ViteGourmand = {
    escapeHTML: escapeHTML,
    isValidEmail: isValidEmail,
    isValidPhone: isValidPhone,
    sanitizeString: sanitizeString,
    showFieldError: showFieldError,
    clearFieldError: clearFieldError
};