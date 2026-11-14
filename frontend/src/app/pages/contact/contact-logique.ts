import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { MessageContact } from '../../core/models/contact';
import { MOTIF_EMAIL } from '../../core/validators/profil.validators';

/**
 * Règles du formulaire de contact : les mêmes que l'API
 * (backend/controllers/contact.controller.js, validerContact).
 */
export const TITRE_MIN = 3;
export const TITRE_MAX = 100;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;

/** Longueur comptée sans les espaces de début et de fin, comme le serveur */
function longueurEntre(min: number, max: number) {
  return (controle: AbstractControl): ValidationErrors | null => {
    const longueur = String(controle.value ?? '').trim().length;
    if (longueur === 0) return null; // laissé à Validators.required
    return longueur < min || longueur > max ? { longueur: { min, max } } : null;
  };
}

/** Configuration des 3 champs pour FormBuilder.nonNullable.group() */
export function champsContact(emailInitial = '') {
  return {
    titre: ['', [Validators.required, longueurEntre(TITRE_MIN, TITRE_MAX)]],
    description: ['', [Validators.required, longueurEntre(DESCRIPTION_MIN, DESCRIPTION_MAX)]],
    email: [
      emailInitial,
      [Validators.required, Validators.pattern(MOTIF_EMAIL), Validators.maxLength(100)],
    ],
  };
}

/** Message d'erreur d'un champ, ou null */
export function messageChampContact(
  champ: keyof MessageContact,
  erreurs: ValidationErrors | null,
): string | null {
  if (!erreurs) return null;
  if (champ === 'email') return 'Saisissez une adresse e-mail valide (exemple : nom@domaine.fr).';
  if (erreurs['required']) {
    return champ === 'titre' ? 'Indiquez l’objet de votre message.' : 'Écrivez votre message.';
  }
  if (erreurs['longueur']) {
    const { min, max } = erreurs['longueur'] as { min: number; max: number };
    return `Entre ${min} et ${max} caractères.`;
  }
  return null;
}

/** Valeurs saisies → corps de POST /api/contact (espaces retirés, e-mail en minuscules) */
export function versMessageContact(valeurs: MessageContact): MessageContact {
  return {
    titre: valeurs.titre.trim().replace(/\s+/g, ' '),
    description: valeurs.description.trim(),
    email: valeurs.email.trim().toLowerCase(),
  };
}
