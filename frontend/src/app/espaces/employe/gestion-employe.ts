import { StatutCommande } from '../../core/models/commande';
import { FiltresCommandes, ModeContact, StatutAvis } from '../../core/models/employe';
import { LIBELLES_STATUT } from '../utilisateur/mes-commandes/suivi-commande';

/**
 * Logique pure de l'espace employé (sans Angular, donc testée simplement) :
 * filtres de la liste, libellés des boutons d'action, règles de
 * l'annulation, filtres de la modération des avis.
 * Les règles du parcours sont appliquées par le serveur, qui renvoie
 * `statuts_suivants` : le front se contente d'afficher ces boutons-là.
 */

// ---------------------------------------------------------------------
// 1. Filtres de la liste des commandes
// ---------------------------------------------------------------------

/** Ordre du parcours, pour la liste déroulante du filtre */
export const STATUTS_FILTRE: readonly StatutCommande[] = [
  'en_attente',
  'accepte',
  'en_preparation',
  'en_cours_livraison',
  'livre',
  'attente_retour_materiel',
  'terminee',
  'annulee',
];

/** Valeurs du formulaire de filtres (chaîne vide = « tous ») */
export interface FormulaireFiltres {
  statut: StatutCommande | '';
  client: string;
}

export const FILTRES_VIDES: FormulaireFiltres = { statut: '', client: '' };

/** Formulaire → filtres de l'API (champs vides retirés, recherche nettoyée) */
export function versFiltres(valeurs: FormulaireFiltres): FiltresCommandes {
  const filtres: FiltresCommandes = {};
  if (valeurs.statut) filtres.statut = valeurs.statut;
  const client = valeurs.client.trim().replace(/\s+/g, ' ');
  if (client) filtres.client = client;
  return filtres;
}

/** Deux filtres identiques : pas besoin de refaire la requête */
export function memesFiltres(a: FiltresCommandes, b: FiltresCommandes): boolean {
  return a.statut === b.statut && a.client === b.client;
}

/**
 * Paramètres de l'URL (?statut=livre&client=martin) → formulaire.
 * Les filtres vivent dans l'URL : le bouton « Retour » du navigateur
 * ramène la liste filtrée, et l'adresse peut être partagée entre collègues.
 * Un statut inconnu dans l'URL est ignoré.
 */
export function filtresDepuisUrl(params: {
  statut?: string | null;
  client?: string | null;
}): FormulaireFiltres {
  const statut = STATUTS_FILTRE.find((s) => s === params.statut) ?? '';
  return { statut, client: params.client ?? '' };
}

/** Formulaire → paramètres de l'URL (null retire le paramètre) */
export function versParametresUrl(filtres: FiltresCommandes): {
  statut: string | null;
  client: string | null;
} {
  return { statut: filtres.statut ?? null, client: filtres.client ?? null };
}

/** « 3 commandes », « 1 commande », « Aucune commande » (+ précision si filtrées) */
export function texteResultats(nombre: number, filtree: boolean): string {
  const suffixe = filtree ? ' pour ces filtres' : '';
  if (nombre === 0) return `Aucune commande${suffixe}.`;
  return `${nombre} commande${nombre > 1 ? 's' : ''}${suffixe}.`;
}

// ---------------------------------------------------------------------
// 2. Boutons d'action du détail
// ---------------------------------------------------------------------

/** Libellé du bouton qui fait passer la commande au statut `suivant` */
export function libelleAction(statutActuel: StatutCommande, suivant: StatutCommande): string {
  switch (suivant) {
    case 'accepte':
      return 'Accepter la commande';
    case 'en_preparation':
      return 'Passer en préparation';
    case 'en_cours_livraison':
      return 'Partir en livraison';
    case 'livre':
      return 'Marquer comme livrée';
    case 'attente_retour_materiel':
      return 'Attendre le retour du matériel';
    case 'terminee':
      return statutActuel === 'attente_retour_materiel'
        ? 'Matériel restitué : terminer'
        : 'Terminer la commande';
    case 'annulee':
      return 'Annuler la commande';
    default:
      return LIBELLES_STATUT[suivant];
  }
}

/** Ce qui se passe en plus du changement de statut (mail au client) */
export function effetAction(suivant: StatutCommande): string | null {
  switch (suivant) {
    case 'attente_retour_materiel':
      return 'Le client recevra un e-mail : matériel à restituer sous 10 jours ouvrés, sinon 600 € de frais.';
    case 'terminee':
      return 'Le client recevra un e-mail l’invitant à donner son avis.';
    default:
      return null;
  }
}

/** Boutons « avancer » (l'annulation a son propre formulaire) */
export function etapesPossibles(statutsSuivants: readonly StatutCommande[]): StatutCommande[] {
  return statutsSuivants.filter((statut) => statut !== 'annulee');
}

export function peutAnnuler(statutsSuivants: readonly StatutCommande[]): boolean {
  return statutsSuivants.includes('annulee');
}

// ---------------------------------------------------------------------
// 3. Annulation (mêmes limites que le serveur)
// ---------------------------------------------------------------------

export const MOTIF_MIN = 5;
export const MOTIF_MAX = 1000;

export const MODES_CONTACT: readonly ModeContact[] = ['gsm', 'mail'];

export const LIBELLES_MODE_CONTACT: Record<ModeContact, string> = {
  gsm: 'Appel sur son GSM',
  mail: 'E-mail',
};

/** Message d'erreur du motif, ou null s'il est valide (espaces ignorés) */
export function erreurMotif(texte: string): string | null {
  const longueur = texte.trim().length;
  if (longueur === 0) return 'Indiquez le motif de l’annulation.';
  if (longueur < MOTIF_MIN) return `Au moins ${MOTIF_MIN} caractères.`;
  if (longueur > MOTIF_MAX) return `${MOTIF_MAX} caractères au maximum.`;
  return null;
}

// ---------------------------------------------------------------------
// 4. Modération des avis
// ---------------------------------------------------------------------

/** Filtre de la page : un statut, ou 'tous' */
export type FiltreAvis = StatutAvis | 'tous';

export const FILTRES_AVIS: readonly { valeur: FiltreAvis; libelle: string }[] = [
  { valeur: 'en_attente', libelle: 'À modérer' },
  { valeur: 'valide', libelle: 'Publiés' },
  { valeur: 'refuse', libelle: 'Refusés' },
  { valeur: 'tous', libelle: 'Tous' },
];

/** Filtre de la page → paramètre de l'API (null = tous les avis) */
export function statutAvisDepuisFiltre(filtre: FiltreAvis): StatutAvis | null {
  return filtre === 'tous' ? null : filtre;
}

export const LIBELLES_AVIS: Record<StatutAvis, string> = {
  en_attente: 'À modérer',
  valide: 'Publié',
  refuse: 'Refusé',
};

/** Classe du badge : mêmes couleurs que les statuts de commande */
export function classeBadgeAvis(statut: StatutAvis): string {
  const ton = { en_attente: 'attente', valide: 'terminee', refuse: 'annulee' }[statut];
  return `badge badge--statut-${ton}`;
}

/** Message vide adapté au filtre */
export function texteAucunAvis(filtre: FiltreAvis): string {
  switch (filtre) {
    case 'en_attente':
      return 'Aucun avis à modérer : tout est à jour.';
    case 'valide':
      return 'Aucun avis publié pour le moment.';
    case 'refuse':
      return 'Aucun avis refusé.';
    default:
      return 'Aucun avis pour le moment.';
  }
}
