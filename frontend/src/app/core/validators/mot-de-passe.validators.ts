import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Règles du mot de passe : les mêmes que côté serveur
 * (backend/utils/motDePasse.js). La vérification serveur fait foi ;
 * celle-ci sert à guider l'utilisateur pendant la saisie.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;
export const LONGUEUR_MAX_MOT_DE_PASSE = 72; // au-delà, bcrypt ignore la fin

/** Chaque critère, avec le libellé affiché sous le champ */
export const CRITERES_MOT_DE_PASSE = [
  {
    cle: 'longueur',
    libelle: `Entre ${LONGUEUR_MIN_MOT_DE_PASSE} et ${LONGUEUR_MAX_MOT_DE_PASSE} caractères`,
    test: (valeur: string) =>
      valeur.length >= LONGUEUR_MIN_MOT_DE_PASSE && valeur.length <= LONGUEUR_MAX_MOT_DE_PASSE,
  },
  { cle: 'majuscule', libelle: 'Une majuscule', test: (valeur: string) => /[A-Z]/.test(valeur) },
  { cle: 'minuscule', libelle: 'Une minuscule', test: (valeur: string) => /[a-z]/.test(valeur) },
  { cle: 'chiffre', libelle: 'Un chiffre', test: (valeur: string) => /\d/.test(valeur) },
  {
    cle: 'special',
    libelle: 'Un caractère spécial (ex. # ! @ ?)',
    test: (valeur: string) => /[^A-Za-z0-9]/.test(valeur),
  },
] as const;

export type CritereMotDePasse = (typeof CRITERES_MOT_DE_PASSE)[number]['cle'];

/**
 * Validateur de mot de passe fort.
 * Renvoie null si tout est bon, sinon { motDePasseFaible: { critères manquants } }.
 * Un champ vide n'est pas signalé ici : c'est le rôle de Validators.required.
 */
export const motDePasseFort: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valeur: string = controle.value ?? '';
  if (!valeur) {
    return null;
  }
  const manquants: Partial<Record<CritereMotDePasse, true>> = {};
  for (const critere of CRITERES_MOT_DE_PASSE) {
    if (!critere.test(valeur)) {
      manquants[critere.cle] = true;
    }
  }
  return Object.keys(manquants).length ? { motDePasseFaible: manquants } : null;
};

/**
 * Validateur de groupe : deux champs doivent avoir la même valeur
 * (mot de passe et confirmation). L'erreur est posée sur le groupe.
 */
export function champsIdentiques(champ: string, confirmation: string): ValidatorFn {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const valeur = groupe.get(champ)?.value;
    const valeurConfirmation = groupe.get(confirmation)?.value;
    return valeurConfirmation && valeur !== valeurConfirmation
      ? { confirmationDifferente: true }
      : null;
  };
}
