import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DemandeDevis, DonneesCommande } from '../../../core/models/commande';
import { Profil } from '../../../core/models/utilisateur';

/**
 * Logique du formulaire de commande, sans composant :
 * dates, validateurs, étapes et construction des données envoyées.
 * Testée dans commande-logique.spec.ts.
 *
 * Les règles sont les mêmes que côté serveur (backend/utils/validationCommande.js
 * et backend/utils/prix.js). Le serveur fait foi : ces vérifications servent
 * à guider le client pendant la saisie, avant d'envoyer la commande.
 */

// ---------------------------------------------------------------------
// 1. Constantes partagées avec le serveur
// ---------------------------------------------------------------------

/** Réduction de 10 % à partir du minimum du menu + 5 personnes */
export const PERSONNES_EN_PLUS_POUR_REDUCTION = 5;
export const PERSONNES_MAX = 1000;

/** Prêt de matériel (CGV) : restitution sous 10 jours ouvrés, sinon 600 € de frais */
export const PRET_MATERIEL_JOURS_OUVRES = 10;
export const PRET_MATERIEL_FRAIS = 600;

const REGEX_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const REGEX_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Lettres (accents compris), espaces, tirets, apostrophes */
const REGEX_NOM = /^\p{L}[\p{L}' -]*$/u;
/** Plus strict que Validators.email d'Angular, qui accepte « nom@domaine » sans point */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 10 chiffres commençant par 0 puis 1 à 9, après retrait des espaces et des points */
const REGEX_TELEPHONE = /^0[1-9]\d{8}$/;

// ---------------------------------------------------------------------
// 2. Dates (toujours au format AAAA-MM-JJ, dans le fuseau de Bordeaux)
// ---------------------------------------------------------------------

/**
 * Date du jour à Bordeaux, au format AAAA-MM-JJ.
 * Le fuseau est imposé : un client à l'étranger, ou à 0 h 30 en hiver
 * (23 h 30 en temps universel), obtient la même date que le serveur.
 */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  // La locale « en-CA » écrit justement les dates en AAAA-MM-JJ
  return maintenant.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

/** Vrai si la chaîne est une date du calendrier (refuse 2026-02-30) */
export function estDateValide(texte: string): boolean {
  const morceaux = REGEX_DATE.exec(texte);
  if (!morceaux) {
    return false;
  }
  const [annee, mois, jour] = morceaux.slice(1).map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour
  );
}

/** '2026-11-28' + 7 → '2026-12-05' (calcul en UTC : pas de piège avec l'heure d'été) */
export function ajouterJours(dateIso: string, jours: number): string {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10);
}

/**
 * Première date de prestation possible pour un menu.
 * Toujours au moins demain (la date doit être dans le futur), même si le délai vaut 0.
 */
export function dateMinimumPrestation(aujourdhui: string, delaiJours: number): string {
  return ajouterJours(aujourdhui, Math.max(1, delaiJours));
}

/** '2026-12-05' → '05/12/2026' (affichage) */
export function dateFr(dateIso: string): string {
  const [annee, mois, jour] = dateIso.split('-');
  return `${jour}/${mois}/${annee}`;
}

// ---------------------------------------------------------------------
// 3. Validateurs des champs (un champ vide est laissé à Validators.required)
// ---------------------------------------------------------------------

/** Texte saisi, espaces de début et de fin retirés */
function texteDe(controle: AbstractControl): string {
  return typeof controle.value === 'string' ? controle.value.trim() : '';
}

/** Validateur à partir d'une expression régulière, avec une clé d'erreur */
function selonRegex(regex: RegExp, cle: string, longueurMax: number): ValidatorFn {
  return (controle) => {
    const valeur = texteDe(controle);
    if (!valeur) {
      return null;
    }
    return regex.test(valeur) && valeur.length <= longueurMax ? null : { [cle]: true };
  };
}

export const nomValide = selonRegex(REGEX_NOM, 'nom', 50);
export const villeValide = selonRegex(REGEX_NOM, 'ville', 100);
export const emailValide = selonRegex(REGEX_EMAIL, 'email', 254);
export const heureValide = selonRegex(REGEX_HEURE, 'heure', 5);

/** Retire les espaces et les points : « 06 98.76 54 32 » → « 0698765432 » */
export function nettoyerTelephone(valeur: string): string {
  return valeur.replace(/[ .]/g, '');
}

/** Téléphone français à 10 chiffres ; espaces et points acceptés à la saisie */
export const telephoneValide: ValidatorFn = (controle) => {
  const valeur = texteDe(controle);
  if (!valeur) {
    return null;
  }
  return REGEX_TELEPHONE.test(nettoyerTelephone(valeur)) ? null : { telephone: true };
};

/** Adresse de 5 à 255 caractères */
export const adresseValide: ValidatorFn = (controle) => {
  const valeur = texteDe(controle);
  if (!valeur) {
    return null;
  }
  return valeur.length >= 5 && valeur.length <= 255 ? null : { adresse: true };
};

/**
 * Date de prestation : une vraie date, au plus tôt `minimum` (AAAA-MM-JJ).
 * Le minimum est calculé une fois le menu chargé (délai du menu).
 */
export function dateAuPlusTot(minimum: string): ValidatorFn {
  return (controle): ValidationErrors | null => {
    const valeur = texteDe(controle);
    if (!valeur) {
      return null;
    }
    if (!estDateValide(valeur)) {
      return { date: true };
    }
    // AAAA-MM-JJ se compare comme du texte
    return valeur >= minimum ? null : { dateTropTot: { minimum } };
  };
}

/** Nombre entier de personnes entre le minimum du menu et 1 000 */
export function personnesValides(minimum: number): ValidatorFn {
  return (controle): ValidationErrors | null => {
    const valeur = controle.value;
    if (valeur === null || valeur === undefined || valeur === '') {
      return null;
    }
    if (!Number.isInteger(valeur)) {
      return { entier: true };
    }
    if (valeur < minimum) {
      return { minimumPersonnes: { minimum } };
    }
    return valeur <= PERSONNES_MAX ? null : { maximumPersonnes: { maximum: PERSONNES_MAX } };
  };
}

/**
 * Message affiché sous un champ, à partir de ses erreurs.
 * Le premier problème trouvé suffit : on corrige une chose à la fois.
 */
export function messageChamp(erreurs: ValidationErrors | null | undefined): string | null {
  if (!erreurs) {
    return null;
  }
  if (erreurs['required']) return 'Ce champ est obligatoire.';
  if (erreurs['nom']) return 'Lettres, espaces, tirets et apostrophes uniquement (50 au plus).';
  if (erreurs['email']) return 'Adresse e-mail invalide (ex. camille@exemple.fr).';
  if (erreurs['telephone']) return 'Numéro invalide : 10 chiffres, ex. 06 12 34 56 78.';
  if (erreurs['adresse']) return 'Adresse trop courte (5 caractères au moins).';
  if (erreurs['ville']) return 'Nom de ville invalide (lettres, espaces, tirets).';
  if (erreurs['date']) return 'Date invalide.';
  if (erreurs['dateTropTot']) {
    return `Ce menu se commande à l'avance : première date possible le ${dateFr(erreurs['dateTropTot'].minimum)}.`;
  }
  if (erreurs['heure']) return 'Heure invalide (format HH:MM).';
  if (erreurs['entier']) return 'Indiquez un nombre entier de personnes.';
  if (erreurs['minimumPersonnes']) {
    return `Ce menu est prévu pour ${erreurs['minimumPersonnes'].minimum} personnes au minimum.`;
  }
  if (erreurs['maximumPersonnes']) {
    return `${erreurs['maximumPersonnes'].maximum} personnes au maximum.`;
  }
  return 'Valeur invalide.';
}

// ---------------------------------------------------------------------
// 4. Nombre de personnes et réduction
// ---------------------------------------------------------------------

/**
 * Nombre de personnes de départ, à partir de ?personnes= dans l'URL.
 * Une valeur absente, invalide ou sous le minimum donne le minimum du menu.
 */
export function personnesInitiales(parametre: string | null | undefined, minimum: number): number {
  const nombre = Number(parametre);
  if (!parametre || !Number.isInteger(nombre) || nombre < minimum) {
    return minimum;
  }
  return Math.min(nombre, PERSONNES_MAX);
}

/** Nombre de personnes à partir duquel la réduction de 10 % s'applique */
export function personnesPourReduction(minimum: number): number {
  return minimum + PERSONNES_EN_PLUS_POUR_REDUCTION;
}

/** Vrai si la réduction de 10 % s'applique */
export function reductionApplicable(personnes: number, minimum: number): boolean {
  return personnes >= personnesPourReduction(minimum);
}

/**
 * Indication affichée sous le nombre de personnes :
 * « Encore 3 personnes pour bénéficier de 10 % de réduction. »
 * ou « Réduction de 10 % appliquée. ». Rien si le nombre est hors limites.
 */
export function indicationReduction(personnes: number, minimum: number): string | null {
  if (!Number.isInteger(personnes) || personnes < minimum || personnes > PERSONNES_MAX) {
    return null;
  }
  const manque = personnesPourReduction(minimum) - personnes;
  if (manque <= 0) {
    return 'Réduction de 10 % appliquée.';
  }
  return `Encore ${manque} personne${manque > 1 ? 's' : ''} pour bénéficier de 10 % de réduction.`;
}

// ---------------------------------------------------------------------
// 5. Étapes du formulaire
// ---------------------------------------------------------------------

/** Les champs du formulaire, rangés par étape (noms des contrôles Angular) */
export const ETAPES = [
  { numero: 1, titre: 'Vos coordonnées', groupe: 'contact' },
  { numero: 2, titre: 'Livraison', groupe: 'livraison' },
  { numero: 3, titre: 'Votre menu', groupe: 'menu' },
] as const;

export type NumeroEtape = 1 | 2 | 3 | 4;

/** Après la 3e étape vient le récapitulatif (étape 4) */
export const ETAPE_RECAPITULATIF = 4;

/**
 * Étape à afficher quand le client clique sur « Continuer ».
 * On ne passe à la suivante que si l'étape en cours est valide.
 */
export function etapeSuivante(etape: NumeroEtape, etapeValide: boolean): NumeroEtape {
  if (!etapeValide || etape === ETAPE_RECAPITULATIF) {
    return etape;
  }
  return (etape + 1) as NumeroEtape;
}

/** Étape précédente (« Retour ») ; on reste sur la première */
export function etapePrecedente(etape: NumeroEtape): NumeroEtape {
  return etape === 1 ? 1 : ((etape - 1) as NumeroEtape);
}

/**
 * Le client peut revenir directement à une étape déjà franchie
 * (lien « Modifier » du récapitulatif), jamais sauter en avant.
 */
export function peutAllerA(cible: NumeroEtape, etapeAtteinte: NumeroEtape): boolean {
  return cible >= 1 && cible <= etapeAtteinte;
}

// ---------------------------------------------------------------------
// 6. Données du formulaire → corps des requêtes
// ---------------------------------------------------------------------

export interface ValeursContact {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface ValeursLivraison {
  adresse: string;
  ville: string;
  date: string;
  heure: string;
  pretMateriel: boolean;
}

export interface ValeursFormulaire {
  contact: ValeursContact;
  livraison: ValeursLivraison;
  menu: { personnes: number };
}

/** Pré-remplissage depuis le compte (champs absents du profil = vides) */
export function valeursDepuisProfil(profil: Profil): {
  contact: ValeursContact;
  livraison: Pick<ValeursLivraison, 'adresse' | 'ville'>;
} {
  return {
    contact: {
      nom: profil.nom,
      prenom: profil.prenom,
      email: profil.email,
      telephone: profil.telephone ?? '',
    },
    livraison: { adresse: profil.adresse_postale ?? '', ville: profil.ville ?? '' },
  };
}

/** Espaces de début et de fin retirés, espaces multiples réduits à un seul */
function propre(texte: string): string {
  return texte.trim().replace(/\s+/g, ' ');
}

/** Corps de POST /api/commandes/devis */
export function versDemandeDevis(menuId: number, valeurs: ValeursFormulaire): DemandeDevis {
  return {
    menu_id: menuId,
    nombre_personne: valeurs.menu.personnes,
    adresse_prestation: propre(valeurs.livraison.adresse),
    ville_prestation: propre(valeurs.livraison.ville),
  };
}

/** Corps de POST /api/commandes (aucun prix : le serveur les calcule) */
export function versDonneesCommande(menuId: number, valeurs: ValeursFormulaire): DonneesCommande {
  const { contact, livraison } = valeurs;
  return {
    ...versDemandeDevis(menuId, valeurs),
    date_prestation: livraison.date,
    heure_livraison: livraison.heure,
    pret_materiel: livraison.pretMateriel,
    contact_nom: propre(contact.nom),
    contact_prenom: propre(contact.prenom),
    contact_email: contact.email.trim().toLowerCase(),
    contact_telephone: nettoyerTelephone(contact.telephone.trim()),
  };
}

// ---------------------------------------------------------------------
// 7. Récapitulatif
// ---------------------------------------------------------------------

/** Libellés de l'indicateur de progression (les 3 étapes + le récapitulatif) */
export const LIBELLES_ETAPES: Record<NumeroEtape, string> = {
  1: 'Coordonnées',
  2: 'Livraison',
  3: 'Menu',
  4: 'Récapitulatif',
};

/** Prix du menu avant réduction : 11 × 48 € = 528 € (calcul en centimes) */
export function montantAvantReduction(prixParPersonne: number, personnes: number): number {
  return (Math.round(prixParPersonne * 100) * personnes) / 100;
}

/**
 * Que proposer quand le devis échoue ?
 * - 400 : l'adresse n'a pas été trouvée → corriger l'adresse (étape 2) ;
 * - 503, 0 (serveur injoignable), 500 : panne passagère → réessayer ;
 * - autre (404 menu, 409 stock) : rien à réessayer, revenir aux menus.
 */
export type ActionErreurDevis = 'corriger-adresse' | 'reessayer' | 'changer-menu';

export function actionErreurDevis(statut: number): ActionErreurDevis {
  if (statut === 400) {
    return 'corriger-adresse';
  }
  if (statut === 404 || statut === 409) {
    return 'changer-menu';
  }
  return 'reessayer';
}
