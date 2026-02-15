/**
 * ================================================================
 * VITE & GOURMAND - AUTH.JS
 * ================================================================
 * 
 * Gestion des formulaires d'authentification :
 * - Connexion
 * - Inscription
 * 
 * FONCTIONNALITÉS :
 * 1. Validation des champs en temps réel
 * 2. Afficher/masquer le mot de passe
 * 3. Indicateur de force du mot de passe
 * 4. Vérification des exigences du mot de passe
 * 5. Confirmation du mot de passe
 * 6. Champ conditionnel (entreprise)
 * 7. Protection anti-spam (honeypot)
 * 
 * SÉCURITÉ CÔTÉ CLIENT :
 * - Validation des formats
 * - Messages d'erreur génériques (pas d'énumération)
 * - Pas de stockage de données sensibles
 * 
 * RAPPEL SÉCURITÉ SERVEUR (obligatoire) :
 * - Hashage bcrypt (coût >= 12)
 * - Protection brute force (rate limiting)
 * - Tokens CSRF
 * - Sessions sécurisées (HttpOnly, Secure, SameSite)
 * - Validation de TOUS les champs
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
    // Initialiser selon la page
    initConnexionForm();
    initInscriptionForm();
    initPasswordToggles();
});


/**
 * ================================================================
 * 1. FORMULAIRE DE CONNEXION
 * ================================================================
 */
function initConnexionForm() {
    const form = document.getElementById('connexion-form');
    
    // Vérifier qu'on est sur la page connexion
    if (!form) {
        return;
    }
    
    // Récupérer les éléments
    const fields = {
        email: document.getElementById('connexion-email'),
        password: document.getElementById('connexion-password'),
        remember: document.getElementById('connexion-remember')
    };
    
    const errorMessage = document.getElementById('connexion-error');
    const successMessage = document.getElementById('connexion-success');
    const btnSubmit = document.getElementById('btn-connexion');
    
    
    /**
     * Valider le formulaire de connexion
     * 
     * NOTE : La validation côté client est minimale pour la connexion.
     * On vérifie juste que les champs ne sont pas vides.
     * La vraie validation se fait côté serveur.
     */
    function validateConnexion() {
        let isValid = true;
        
        // Vérifier l'email
        if (!fields.email.value.trim()) {
            showFieldError(fields.email, 'Veuillez entrer votre email.');
            isValid = false;
        } else if (!window.ViteGourmand.isValidEmail(fields.email.value)) {
            showFieldError(fields.email, 'Format d\'email invalide.');
            isValid = false;
        } else {
            clearFieldError(fields.email);
        }
        
        // Vérifier le mot de passe
        if (!fields.password.value) {
            showFieldError(fields.password, 'Veuillez entrer votre mot de passe.');
            isValid = false;
        } else {
            clearFieldError(fields.password);
        }
        
        return isValid;
    }
    
    
    /**
     * Gérer la soumission du formulaire
     */
    function handleSubmit(event) {
        event.preventDefault();
        
        // Cacher les messages précédents
        if (errorMessage) errorMessage.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
        
        // Vérifier le honeypot
        const honeypot = form.querySelector('input[name="username"]');
        if (honeypot && honeypot.value !== '') {
            // Bot détecté - faire semblant que ça marche
            if (successMessage) successMessage.style.display = 'block';
            return;
        }
        
        // Valider
        if (!validateConnexion()) {
            if (errorMessage) {
                errorMessage.style.display = 'block';
            }
            return;
        }
        
        // Désactiver le bouton
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Connexion en cours...';
        }
        
        // Simuler l'envoi au serveur
        simulateLogin()
            .then(function(response) {
                if (successMessage) {
                    successMessage.style.display = 'block';
                }
                
                // Rediriger après 2 secondes
                setTimeout(function() {
                    window.location.href = 'index.html';
                }, 2000);
                
                console.log('✅ Connexion réussie');
            })
            .catch(function(error) {
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                }
                console.error('❌ Erreur de connexion');
            })
            .finally(function() {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Se connecter';
                }
            });
    }
    
    
    /**
     * Simuler une connexion
     * En production : remplacer par un vrai appel API
     */
    function simulateLogin() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                // Simuler une vérification
                // En production : le serveur vérifie email + hash du mot de passe
                if (Math.random() > 0.3) {
                    resolve({ success: true });
                } else {
                    reject(new Error('Identifiants incorrects'));
                }
            }, 1500);
        });
    }
    
    
    // Événements
    form.addEventListener('submit', handleSubmit);
    
    // Validation en temps réel
    fields.email.addEventListener('blur', function() {
        if (!this.value.trim()) {
            showFieldError(this, 'Veuillez entrer votre email.');
        } else if (!window.ViteGourmand.isValidEmail(this.value)) {
            showFieldError(this, 'Format d\'email invalide.');
        } else {
            clearFieldError(this);
        }
    });
    
    fields.email.addEventListener('input', function() {
        clearFieldError(this);
    });
    
    fields.password.addEventListener('input', function() {
        clearFieldError(this);
    });
    
    
    console.log('✅ Formulaire de connexion initialisé');
}


/**
 * ================================================================
 * 2. FORMULAIRE D'INSCRIPTION
 * ================================================================
 */
function initInscriptionForm() {
    const form = document.getElementById('inscription-form');
    
    // Vérifier qu'on est sur la page inscription
    if (!form) {
        return;
    }
    
    // Récupérer les éléments
    const fields = {
        prenom: document.getElementById('inscription-prenom'),
        nom: document.getElementById('inscription-nom'),
        email: document.getElementById('inscription-email'),
        telephone: document.getElementById('inscription-telephone'),
        password: document.getElementById('inscription-password'),
        passwordConfirm: document.getElementById('inscription-password-confirm'),
        type: document.getElementById('inscription-type'),
        entreprise: document.getElementById('inscription-entreprise'),
        cgu: document.getElementById('inscription-cgu'),
        rgpd: document.getElementById('inscription-rgpd'),
        newsletter: document.getElementById('inscription-newsletter')
    };
    
    const entrepriseGroup = document.getElementById('entreprise-group');
    const errorMessage = document.getElementById('inscription-error');
    const successMessage = document.getElementById('inscription-success');
    const btnSubmit = document.getElementById('btn-inscription');
    
    // Éléments pour la force du mot de passe
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const strengthContainer = document.getElementById('password-strength');
    
    // Éléments pour les exigences
    const requirements = {
        length: document.getElementById('req-length'),
        uppercase: document.getElementById('req-uppercase'),
        lowercase: document.getElementById('req-lowercase'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special')
    };
    
    
    /**
     * ============================================================
     * RÈGLES DE VALIDATION
     * ============================================================
     */
    const validationRules = {
        prenom: {
            required: true,
            minLength: 2,
            maxLength: 50,
            pattern: /^[A-Za-zÀ-ÿ\s\-']+$/,
            errorMessages: {
                required: 'Veuillez entrer votre prénom.',
                minLength: 'Le prénom doit contenir au moins 2 caractères.',
                maxLength: 'Le prénom ne peut pas dépasser 50 caractères.',
                pattern: 'Le prénom ne peut contenir que des lettres.'
            }
        },
        nom: {
            required: true,
            minLength: 2,
            maxLength: 50,
            pattern: /^[A-Za-zÀ-ÿ\s\-']+$/,
            errorMessages: {
                required: 'Veuillez entrer votre nom.',
                minLength: 'Le nom doit contenir au moins 2 caractères.',
                maxLength: 'Le nom ne peut pas dépasser 50 caractères.',
                pattern: 'Le nom ne peut contenir que des lettres.'
            }
        },
        email: {
            required: true,
            maxLength: 255,
            validate: function(value) {
                return window.ViteGourmand.isValidEmail(value);
            },
            errorMessages: {
                required: 'Veuillez entrer votre email.',
                maxLength: 'L\'email ne peut pas dépasser 255 caractères.',
                validate: 'Veuillez entrer une adresse email valide.'
            }
        },
        telephone: {
            required: false,
            maxLength: 20,
            validate: function(value) {
                return window.ViteGourmand.isValidPhone(value);
            },
            errorMessages: {
                maxLength: 'Le numéro ne peut pas dépasser 20 caractères.',
                validate: 'Veuillez entrer un numéro valide.'
            }
        },
        password: {
            required: true,
            minLength: 8,
            maxLength: 128,
            validate: function(value) {
                return checkPasswordStrength(value).score >= 3;
            },
            errorMessages: {
                required: 'Veuillez créer un mot de passe.',
                minLength: 'Le mot de passe doit contenir au moins 8 caractères.',
                maxLength: 'Le mot de passe ne peut pas dépasser 128 caractères.',
                validate: 'Le mot de passe n\'est pas assez fort.'
            }
        },
        passwordConfirm: {
            required: true,
            validate: function(value) {
                return value === fields.password.value;
            },
            errorMessages: {
                required: 'Veuillez confirmer votre mot de passe.',
                validate: 'Les mots de passe ne correspondent pas.'
            }
        },
        type: {
            required: true,
            errorMessages: {
                required: 'Veuillez sélectionner un type de compte.'
            }
        },
        cgu: {
            required: true,
            errorMessages: {
                required: 'Vous devez accepter les conditions générales.'
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
     * FONCTION : Vérifier la force du mot de passe
     * ============================================================
     * 
     * Calcule un score de 0 à 5 basé sur :
     * - Longueur >= 8
     * - Contient une majuscule
     * - Contient une minuscule
     * - Contient un chiffre
     * - Contient un caractère spécial
     * 
     * @param {string} password - Le mot de passe à vérifier
     * @returns {object} - { score, checks }
     * 
     */
    function checkPasswordStrength(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
        
        // Calculer le score
        let score = 0;
        for (const check in checks) {
            if (checks[check]) score++;
        }
        
        return { score, checks };
    }
    
    
    /**
     * ============================================================
     * FONCTION : Mettre à jour l'affichage de la force
     * ============================================================
     */
    function updatePasswordStrength() {
        const password = fields.password.value;
        const { score, checks } = checkPasswordStrength(password);
        
        // Mettre à jour les exigences
        for (const req in requirements) {
            if (requirements[req]) {
                if (checks[req]) {
                    requirements[req].classList.add('valid');
                    requirements[req].querySelector('.req-icon').textContent = '✓';
                } else {
                    requirements[req].classList.remove('valid');
                    requirements[req].querySelector('.req-icon').textContent = '○';
                }
            }
        }
        
        // Mettre à jour la barre de force
        if (strengthContainer && strengthBar && strengthText) {
            // Retirer les classes précédentes
            strengthContainer.className = 'password-strength';
            strengthText.className = 'password-strength-text';
            
            if (password.length === 0) {
                strengthBar.style.width = '0';
                strengthText.textContent = '';
            } else if (score <= 2) {
                strengthContainer.classList.add('strength-weak');
                strengthText.classList.add('weak');
                strengthText.textContent = 'Faible';
            } else if (score === 3) {
                strengthContainer.classList.add('strength-fair');
                strengthText.classList.add('fair');
                strengthText.textContent = 'Moyen';
            } else if (score === 4) {
                strengthContainer.classList.add('strength-good');
                strengthText.classList.add('good');
                strengthText.textContent = 'Bon';
            } else {
                strengthContainer.classList.add('strength-strong');
                strengthText.classList.add('strong');
                strengthText.textContent = 'Excellent';
            }
        }
    }
    
    
    /**
     * ============================================================
     * FONCTION : Valider un champ
     * ============================================================
     */
    function validateField(fieldName) {
        const field = fields[fieldName];
        const rules = validationRules[fieldName];
        
        if (!field || !rules) {
            return { isValid: true, error: '' };
        }
        
        // Récupérer la valeur
        let value;
        if (field.type === 'checkbox') {
            value = field.checked;
        } else {
            value = field.value.trim();
        }
        
        // Champ requis
        if (rules.required) {
            if (field.type === 'checkbox' && !value) {
                return { isValid: false, error: rules.errorMessages.required };
            }
            if (field.type !== 'checkbox' && value === '') {
                return { isValid: false, error: rules.errorMessages.required };
            }
        }
        
        // Si vide et non requis, c'est valide
        if (value === '' || value === false) {
            return { isValid: true, error: '' };
        }
        
        // Longueur minimale
        if (rules.minLength && value.length < rules.minLength) {
            return { isValid: false, error: rules.errorMessages.minLength };
        }
        
        // Longueur maximale
        if (rules.maxLength && value.length > rules.maxLength) {
            return { isValid: false, error: rules.errorMessages.maxLength };
        }
        
        // Pattern
        if (rules.pattern && !rules.pattern.test(value)) {
            return { isValid: false, error: rules.errorMessages.pattern };
        }
        
        // Validation personnalisée
        if (rules.validate && !rules.validate(value)) {
            return { isValid: false, error: rules.errorMessages.validate };
        }
        
        return { isValid: true, error: '' };
    }
    
    
    /**
     * ============================================================
     * FONCTION : Valider tous les champs
     * ============================================================
     */
    function validateAllFields() {
        let isFormValid = true;
        
        for (const fieldName in validationRules) {
            const result = validateField(fieldName);
            
            if (!result.isValid) {
                showFieldError(fields[fieldName], result.error);
                isFormValid = false;
            } else {
                clearFieldError(fields[fieldName]);
            }
        }
        
        return isFormValid;
    }
    
    
    /**
     * ============================================================
     * FONCTION : Gérer le champ entreprise (conditionnel)
     * ============================================================
     */
    function handleTypeChange() {
        if (!fields.type || !entrepriseGroup) return;
        
        if (fields.type.value === 'professionnel') {
            entrepriseGroup.style.display = 'block';
        } else {
            entrepriseGroup.style.display = 'none';
            if (fields.entreprise) {
                fields.entreprise.value = '';
            }
        }
    }
    
    
    /**
     * ============================================================
     * FONCTION : Gérer la soumission
     * ============================================================
     */
    function handleSubmit(event) {
        event.preventDefault();
        
        // Cacher les messages
        if (errorMessage) errorMessage.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
        
        // Vérifier le honeypot
        const honeypots = form.querySelectorAll('input[name="website"], input[name="username"]');
        for (const honeypot of honeypots) {
            if (honeypot.value !== '') {
                if (successMessage) successMessage.style.display = 'block';
                return;
            }
        }
        
        // Valider
        if (!validateAllFields()) {
            if (errorMessage) {
                errorMessage.style.display = 'block';
                errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            const firstError = form.querySelector('.error');
            if (firstError) firstError.focus();
            
            return;
        }
        
        // Désactiver le bouton
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Inscription en cours...';
        }
        
        // Simuler l'envoi
        simulateRegistration()
            .then(function(response) {
                if (successMessage) {
                    successMessage.style.display = 'block';
                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                form.reset();
                updatePasswordStrength();
                handleTypeChange();
                
                console.log('✅ Inscription réussie');
            })
            .catch(function(error) {
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                    errorMessage.querySelector('p').textContent = 
                        '❌ ' + (error.message || 'Une erreur est survenue.');
                }
                console.error('❌ Erreur inscription:', error);
            })
            .finally(function() {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Créer mon compte';
                }
            });
    }
    
    
    /**
     * Simuler une inscription
     */
    function simulateRegistration() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                // Simuler une vérification d'email unique
                if (Math.random() > 0.2) {
                    resolve({ success: true });
                } else {
                    reject(new Error('Cette adresse email est déjà utilisée.'));
                }
            }, 1500);
        });
    }
    
    
    /**
     * ============================================================
     * ÉVÉNEMENTS
     * ============================================================
     */
    
    // Soumission
    form.addEventListener('submit', handleSubmit);
    
    // Changement de type de compte
    if (fields.type) {
        fields.type.addEventListener('change', handleTypeChange);
    }
    
    // Mise à jour de la force du mot de passe
    if (fields.password) {
        fields.password.addEventListener('input', function() {
            updatePasswordStrength();
            clearFieldError(this);
            
            // Vérifier aussi la confirmation si elle est remplie
            if (fields.passwordConfirm && fields.passwordConfirm.value) {
                const result = validateField('passwordConfirm');
                if (!result.isValid) {
                    showFieldError(fields.passwordConfirm, result.error);
                } else {
                    clearFieldError(fields.passwordConfirm);
                }
            }
        });
    }
    
    // Validation en temps réel pour tous les champs
    for (const fieldName in fields) {
        const field = fields[fieldName];
        if (!field) continue;
        
        // Au blur
        field.addEventListener('blur', function() {
            if (validationRules[fieldName]) {
                const result = validateField(fieldName);
                if (!result.isValid) {
                    showFieldError(field, result.error);
                } else {
                    clearFieldError(field);
                }
            }
        });
        
        // À l'input
        field.addEventListener('input', function() {
            if (fieldName !== 'password') { // Password géré séparément
                clearFieldError(field);
            }
        });
    }
    
    
    console.log('✅ Formulaire d\'inscription initialisé');
}


/**
 * ================================================================
 * 3. AFFICHER/MASQUER LE MOT DE PASSE
 * ================================================================
 */
function initPasswordToggles() {
    // Récupérer tous les boutons toggle
    const toggleButtons = document.querySelectorAll('.password-toggle');
    
    toggleButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            // Trouver le champ password associé (frère précédent)
            const passwordField = this.previousElementSibling;
            
            if (!passwordField) return;
            
            // Basculer le type
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                this.setAttribute('aria-pressed', 'true');
                this.setAttribute('aria-label', 'Masquer le mot de passe');
                this.querySelector('.icon-eye').textContent = '🙈';
            } else {
                passwordField.type = 'password';
                this.setAttribute('aria-pressed', 'false');
                this.setAttribute('aria-label', 'Afficher le mot de passe');
                this.querySelector('.icon-eye').textContent = '👁️';
            }
        });
    });
}


/**
 * ================================================================
 * FONCTIONS UTILITAIRES (locales)
 * ================================================================
 */

/**
 * Afficher une erreur sur un champ
 */
function showFieldError(field, message) {
    if (!field) return;
    
    field.classList.add('error');
    
    // Chercher l'élément d'erreur
    const describedBy = field.getAttribute('aria-describedby');
    if (describedBy) {
        const errorIds = describedBy.split(' ');
        for (const id of errorIds) {
            if (id.includes('error')) {
                const errorElement = document.getElementById(id);
                if (errorElement) {
                    errorElement.textContent = message;
                }
                break;
            }
        }
    }
}

/**
 * Effacer l'erreur d'un champ
 */
function clearFieldError(field) {
    if (!field) return;
    
    field.classList.remove('error');
    
    const describedBy = field.getAttribute('aria-describedby');
    if (describedBy) {
        const errorIds = describedBy.split(' ');
        for (const id of errorIds) {
            if (id.includes('error')) {
                const errorElement = document.getElementById(id);
                if (errorElement) {
                    errorElement.textContent = '';
                }
                break;
            }
        }
    }
}