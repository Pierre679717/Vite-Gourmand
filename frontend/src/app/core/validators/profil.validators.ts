import { Validators } from '@angular/forms';
import { DonneesProfil, Profil } from '../models/utilisateur';

/**
 * Règles des informations personnelles, partagées par l'inscription et
 * « Mes informations ». Ce sont les mêmes que côté serveur
 * (backend/utils/validationProfil.js) : la vérification serveur fait foi,
 * celle-ci guide l'utilisateur pendant la saisie.
 */

/** Téléphone français : 10 chiffres commençant par 0, espaces ou points autorisés */
export const MOTIF_TELEPHONE = /^0[1-9](?:[ .]?\d{2}){4}$/;
export const MOTIF_CODE_POSTAL = /^\d{5}$/;
/** Un @ et un point après : Validators.email accepterait « nom@domaine », que le serveur refuse */
export const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Configuration des 7 champs pour FormBuilder.nonNullable.group() */
export function champsProfil() {
  return {
    prenom: ['', [Validators.required, Validators.maxLength(50)]],
    nom: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.pattern(MOTIF_EMAIL), Validators.maxLength(100)]],
    telephone: ['', [Validators.required, Validators.pattern(MOTIF_TELEPHONE)]],
    adresse_postale: ['', [Validators.required, Validators.maxLength(255)]],
    code_postal: ['', [Validators.required, Validators.pattern(MOTIF_CODE_POSTAL)]],
    ville: ['', [Validators.required, Validators.maxLength(100)]],
  };
}

/** Valeurs saisies → corps envoyé à l'API (espaces retirés, e-mail en minuscules) */
export function versDonneesProfil(valeurs: DonneesProfil): DonneesProfil {
  return {
    prenom: valeurs.prenom.trim(),
    nom: valeurs.nom.trim(),
    email: valeurs.email.trim().toLowerCase(),
    telephone: valeurs.telephone.replace(/[ .]/g, ''), // 06 12 34 56 78 -> 0612345678
    adresse_postale: valeurs.adresse_postale.trim(),
    code_postal: valeurs.code_postal.trim(),
    ville: valeurs.ville.trim(),
  };
}

/** Profil lu sur le serveur → valeurs du formulaire (un champ absent devient vide) */
export function valeursDepuisProfil(profil: Profil): DonneesProfil {
  return {
    prenom: profil.prenom,
    nom: profil.nom,
    email: profil.email,
    telephone: profil.telephone ?? '',
    adresse_postale: profil.adresse_postale ?? '',
    code_postal: profil.code_postal ?? '',
    ville: profil.ville ?? '',
  };
}
