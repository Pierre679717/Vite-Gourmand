/**
 * ================================================================
 * VITE & GOURMAND - CONTACT-FORM.JS
 * ================================================================
 * 
 * Validation et gestion du formulaire de contact
 * 
 * FONCTIONNALITÉS :
 * 1. Validation en temps réel des champs
 * 2. Validation complète à la soumission
 * 3. Compteur de caractères pour le message
 * 4. Protection anti-spam (honeypot)
 * 5. Feedback visuel pour l'utilisateur
 * 
 * SÉCURITÉ CÔTÉ CLIENT :
 * - Validation des formats (email, téléphone)
 * - Limitation de la taille des champs
 * - Échappement des caractères spéciaux
 * - Vérification du honeypot
 * 
 * IMPORTANT : Cette validation côté client est pour l'UX uniquement !
 * La validation côté SERVEUR est OBLIGATOIRE pour la sécurité.
 * 
 * ================================================================
 */

'use strict';

/**
 * ================================================================
 * INITIALISATION
 * ================================================================
 */
document.addEventListener('DOMContentLoaded', function() {
    initContactForm();
});


/**
 * ================================================================
 * FORMULAIRE DE CONTACT
 * ================================================================
 */
function initContactForm() {
    // Récupérer le formulaire
    const form = document.getElementById('contact-form');
    
    // Vérifier qu'on est sur la bonne page
    if (!form) {
        return;
    }
    
    // Récupérer les éléments du formulaire
    const fields = {
        nom: document.getElementById('contact-nom'),
        email: document.getElementById('contact-email'),
        telephone: document.getElementById('contact-telephone'),
        sujet: document.getElementById('contact-sujet'),
        message: document.getElementById('contact-message'),
        rgpd: document.getElementById('contact-rgpd'),
        honeypot: document.getElementById('contact-website') // Champ anti-spam
    };
    
    // Récupérer les éléments de feedback
    const formSuccess = document.getElementById('form-success');
    const formError = document.getElementById('form-error');
    const messageCount = document.getElementById('message-count');
    const btnSubmit = document.getElementById('btn-submit');
    
    
    /**
     * ============================================================
     * RÈGLES DE VALIDATION
     * ============================================================
     * 
     * Chaque règle définit :
     * - required : champ obligatoire ?
     * - minLength / maxLength : longueur min/max
     * - pattern : expression régulière (optionnel)
     * - validate : fonction de validation personnalisée
     * - errorMessages : messages d'erreur personnalisés
     * 
     */
    const validationRules = {
        nom: {
            required: true,
            minLength: 2,
            maxLength: 100,
            pattern: /^[A-Za-zÀ-ÿ\s\-']+$/,
            errorMessages: {
                required: 'Veuillez entrer votre nom.',
                minLength: 'Le nom doit contenir au moins 2 caractères.',
                maxLength: 'Le nom ne peut pas dépasser 100 caractères.',
                pattern: 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes.'
            }
        },
        email: {
            required: true,
            maxLength: 255,
            validate: function(value) {
                // Utiliser la fonction utilitaire de main.js
                return window.ViteGourmand.isValidEmail(value);
            },
            errorMessages: {
                required: 'Veuillez entrer votre adresse email.',
                maxLength: 'L\'email ne peut pas dépasser 255 caractères.',
                validate: 'Veuillez entrer une adresse email valide.'
            }
        },
        telephone: {
            required: false, // Optionnel
            maxLength: 20,
            validate: function(value) {
                return window.ViteGourmand.isValidPhone(value);
            },
            errorMessages: {
                maxLength: 'Le numéro ne peut pas dépasser 20 caractères.',
                validate: 'Veuillez entrer un numéro de téléphone valide.'
            }
        },
        sujet: {
            required: true,
            errorMessages: {
                required: 'Veuillez sélectionner un sujet.'
            }
        },
        message: {
            required: true,
            minLength: 10,
            maxLength: 2000,
            errorMessages: {
                required: 'Veuillez entrer votre message.',
                minLength: 'Le message doit contenir au moins 10 caractères.',
                maxLength: 'Le message ne peut pas dépasser 2000 caractères.'
            }
        },
        rgpd: {
            required: true,
            errorMessages: {
                required: 'Vous devez accepter la politique de confidentialité.'
            }
        }
    };
    
    
    /**
     * ============================================================
     * FONCTION : Valider un champ
     * ============================================================
     * 
     * @param {string} fieldName - Nom du champ à valider
     * @returns {object} - { isValid: boolean, error: string }
     * 
     */
    function validateField(fieldName) {
        const field = fields[fieldName];
        const rules = validationRules[fieldName];
        
        // Si pas de champ ou pas de règles, considérer comme valide
        if (!field || !rules) {
            return { isValid: true, error: '' };
        }
        
        // Récupérer la valeur (trim pour enlever les espaces)
        let value;
        if (field.type === 'checkbox') {
            value = field.checked;
        } else {
            value = field.value.trim();
        }
        
        // Vérification : champ requis
        if (rules.required) {
            if (field.type === 'checkbox' && !value) {
                return { isValid: false, error: rules.errorMessages.required };
            }
            if (field.type !== 'checkbox' && value === '') {
                return { isValid: false, error: rules.errorMessages.required };
            }
        }
        
        // Si le champ est vide et non requis, c'est valide
        if (value === '' || value === false) {
            return { isValid: true, error: '' };
        }
        
        // Vérification : longueur minimale
        if (rules.minLength && value.length < rules.minLength) {
            return { isValid: false, error: rules.errorMessages.minLength };
        }
        
        // Vérification : longueur maximale
        if (rules.maxLength && value.length > rules.maxLength) {
            return { isValid: false, error: rules.errorMessages.maxLength };
        }
        
        // Vérification : pattern (regex)
        if (rules.pattern && !rules.pattern.test(value)) {
            return { isValid: false, error: rules.errorMessages.pattern };
        }
        
        // Vérification : fonction personnalisée
        if (rules.validate && !rules.validate(value)) {
            return { isValid: false, error: rules.errorMessages.validate };
        }
        
        // Tout est valide
        return { isValid: true, error: '' };
    }
    
    
    /**
     * ============================================================
     * FONCTION : Afficher l'erreur d'un champ
     * ============================================================
     * 
     * @param {string} fieldName - Nom du champ
     * @param {string} error - Message d'erreur
     * 
     */
    function showError(fieldName, error) {
        const field = fields[fieldName];
        if (!field) return;
        
        // Ajouter la classe d'erreur au champ
        field.classList.add('error');
        
        // Trouver l'élément d'erreur
        const errorElement = document.getElementById(fieldName + '-error');
        if (errorElement) {
            errorElement.textContent = error;
        }
    }
    
    
    /**
     * ============================================================
     * FONCTION : Effacer l'erreur d'un champ
     * ============================================================
     * 
     * @param {string} fieldName - Nom du champ
     * 
     */
    function clearError(fieldName) {
        const field = fields[fieldName];
        if (!field) return;
        
        // Retirer la classe d'erreur
        field.classList.remove('error');
        
        // Effacer le message d'erreur
        const errorElement = document.getElementById(fieldName + '-error');
        if (errorElement) {
            errorElement.textContent = '';
        }
    }
    
    
    /**
     * ============================================================
     * FONCTION : Valider tous les champs
     * ============================================================
     * 
     * @returns {boolean} - True si tous les champs sont valides
     * 
     */
    function validateAllFields() {
        let isFormValid = true;
        
        // Parcourir tous les champs avec des règles
        for (const fieldName in validationRules) {
            const result = validateField(fieldName);
            
            if (!result.isValid) {
                showError(fieldName, result.error);
                isFormValid = false;
            } else {
                clearError(fieldName);
            }
        }
        
        return isFormValid;
    }
    
    
    /**
     * ============================================================
     * FONCTION : Vérifier le honeypot (anti-spam)
     * ============================================================
     * 
     * Le honeypot est un champ invisible pour les humains.
     * Les bots le remplissent automatiquement.
     * Si ce champ est rempli = c'est un spam.
     * 
     * @returns {boolean} - True si ce n'est PAS un spam
     * 
     */
    function checkHoneypot() {
        if (fields.honeypot && fields.honeypot.value !== '') {
            console.warn('🍯 Honeypot détecté - Spam bloqué');
            return false; // C'est un spam
        }
        return true; // Pas un spam
    }
    
    
    /**
     * ============================================================
     * FONCTION : Mettre à jour le compteur de caractères
     * ============================================================
     */
    function updateCharCount() {
        if (!fields.message || !messageCount) return;
        
        const currentLength = fields.message.value.length;
        const maxLength = 2000;
        
        messageCount.textContent = currentLength + ' / ' + maxLength + ' caractères';
        
        // Changer la couleur si proche de la limite
        if (currentLength > maxLength * 0.9) {
            messageCount.style.color = 'var(--color-error)';
        } else if (currentLength > maxLength * 0.75) {
            messageCount.style.color = 'var(--color-warning)';
        } else {
            messageCount.style.color = '';
        }
    }
    
    
    /**
     * ============================================================
     * FONCTION : Soumettre le formulaire
     * ============================================================
     * 
     * ÉTAPES :
     * 1. Empêcher la soumission par défaut
     * 2. Vérifier le honeypot
     * 3. Valider tous les champs
     * 4. Si valide, envoyer au serveur (simulé ici)
     * 5. Afficher le feedback
     * 
     */
    function handleSubmit(event) {
        // Empêcher l'envoi par défaut
        event.preventDefault();
        
        // Cacher les messages précédents
        if (formSuccess) formSuccess.style.display = 'none';
        if (formError) formError.style.display = 'none';
        
        // Vérifier le honeypot
        if (!checkHoneypot()) {
            // Faire semblant que ça a marché (ne pas alerter le spammeur)
            if (formSuccess) {
                formSuccess.style.display = 'block';
            }
            return;
        }
        
        // Valider tous les champs
        const isValid = validateAllFields();
        
        if (!isValid) {
            // Afficher le message d'erreur global
            if (formError) {
                formError.style.display = 'block';
                formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Focus sur le premier champ en erreur
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
            }
            
            return;
        }
        
        // Désactiver le bouton pendant l'envoi
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Envoi en cours...';
        }
        
        // Simuler l'envoi au serveur
        // En production, remplacer par un vrai appel fetch() vers le backend
        simulateFormSubmission()
            .then(function(response) {
                // Succès
                if (formSuccess) {
                    formSuccess.style.display = 'block';
                    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                // Réinitialiser le formulaire
                form.reset();
                updateCharCount();
                
                console.log('✅ Formulaire envoyé avec succès');
            })
            .catch(function(error) {
                // Erreur
                if (formError) {
                    formError.style.display = 'block';
                    formError.querySelector('p').textContent = 
                        '❌ Une erreur est survenue lors de l\'envoi. Veuillez réessayer plus tard.';
                }
                
                console.error('❌ Erreur lors de l\'envoi:', error);
            })
            .finally(function() {
                // Réactiver le bouton
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Envoyer le message';
                }
            });
    }
    
    
    /**
     * ============================================================
     * FONCTION : Simuler l'envoi du formulaire
     * ============================================================
     * 
     * Cette fonction simule un appel serveur.
     * En production, remplacer par un vrai fetch() vers l'API.
     * 
     * EXEMPLE AVEC FETCH (pour le backend) :
     * 
     * return fetch('/api/contact', {
     *     method: 'POST',
     *     headers: {
     *         'Content-Type': 'application/json',
     *         'X-CSRF-Token': getCsrfToken()
     *     },
     *     body: JSON.stringify({
     *         nom: fields.nom.value,
     *         email: fields.email.value,
     *         telephone: fields.telephone.value,
     *         sujet: fields.sujet.value,
     *         message: fields.message.value
     *     })
     * })
     * .then(response => response.json());
     * 
     */
    function simulateFormSubmission() {
        return new Promise(function(resolve, reject) {
            // Simuler un délai réseau (1-2 secondes)
            setTimeout(function() {
                // Simuler une réussite (90% de chance)
                if (Math.random() > 0.1) {
                    resolve({ success: true, message: 'Message envoyé' });
                } else {
                    reject(new Error('Erreur serveur simulée'));
                }
            }, 1500);
        });
    }
    
    
    /**
     * ============================================================
     * ÉVÉNEMENTS
     * ============================================================
     */
    
    // Soumission du formulaire
    form.addEventListener('submit', handleSubmit);
    
    // Validation en temps réel (au blur = quand on quitte le champ)
    for (const fieldName in fields) {
        const field = fields[fieldName];
        if (!field || fieldName === 'honeypot') continue;
        
        // Événement : quand on quitte le champ
        field.addEventListener('blur', function() {
            const result = validateField(fieldName);
            if (!result.isValid) {
                showError(fieldName, result.error);
            } else {
                clearError(fieldName);
            }
        });
        
        // Événement : quand on tape (effacer l'erreur)
        field.addEventListener('input', function() {
            clearError(fieldName);
        });
    }
    
    // Compteur de caractères pour le message
    if (fields.message) {
        fields.message.addEventListener('input', updateCharCount);
        updateCharCount(); // Initialiser
    }
    
    
    console.log('✅ Formulaire de contact initialisé');
}