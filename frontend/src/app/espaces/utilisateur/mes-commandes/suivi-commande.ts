import { EtapeSuivi, ResumeCommande, StatutCommande } from '../../../core/models/commande';

/**
 * Logique pure de « Mes commandes » (sans Angular, donc testée simplement) :
 * libellés et couleurs des statuts, dates françaises, frise du suivi,
 * répartition « en cours » / « passées », règles du formulaire d'avis.
 */

// ---------------------------------------------------------------------
// 1. Statuts : libellé affiché et couleur du badge
// ---------------------------------------------------------------------

/** Libellés du sujet de l'ECF, pour chacun des 8 statuts de la base */
export const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente: 'En attente',
  accepte: 'Acceptée',
  en_preparation: 'En préparation',
  en_cours_livraison: 'En cours de livraison',
  livre: 'Livrée',
  attente_retour_materiel: 'En attente du retour du matériel',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

/** Quatre couleurs suffisent : à valider, en cours, terminée, annulée */
export type TonStatut = 'attente' | 'en-cours' | 'terminee' | 'annulee';

export function tonStatut(statut: StatutCommande): TonStatut {
  switch (statut) {
    case 'en_attente':
      return 'attente';
    case 'terminee':
      return 'terminee';
    case 'annulee':
      return 'annulee';
    default:
      return 'en-cours';
  }
}

/** Classes CSS du badge : « badge badge--statut-attente »... (voir _cartes.scss) */
export function classeBadge(statut: StatutCommande): string {
  return `badge badge--statut-${tonStatut(statut)}`;
}

/** Une commande terminée ou annulée ne bougera plus */
export function estFinie(statut: StatutCommande): boolean {
  return statut === 'terminee' || statut === 'annulee';
}

/** Liste « Mes commandes » : d'abord celles en cours, puis l'historique (ordre du serveur conservé) */
export function repartirCommandes(commandes: readonly ResumeCommande[]): {
  enCours: ResumeCommande[];
  passees: ResumeCommande[];
} {
  return {
    enCours: commandes.filter((c) => !estFinie(c.statut)),
    passees: commandes.filter((c) => estFinie(c.statut)),
  };
}

// ---------------------------------------------------------------------
// 2. Dates
// ---------------------------------------------------------------------
// Le serveur envoie des textes déjà à l'heure de Paris (« 2026-11-12 15:47:20 ») :
// on les découpe sans passer par new Date(), qui les convertirait selon le
// fuseau de l'ordinateur du visiteur.

/** « 2026-11-12 15:47:20 » → « 12/11/2026 à 15h47 » */
export function dateHeureFr(dateHeure: string): string {
  const [date, heure = ''] = dateHeure.split(' ');
  const [annee, mois, jour] = date.split('-');
  const [h, min] = heure.split(':');
  const dateFr = `${jour}/${mois}/${annee}`;
  return h && min ? `${dateFr} à ${h}h${min}` : dateFr;
}

/** Valeur pour l'attribut datetime de <time> : « 2026-11-12T15:47:20 » */
export function dateHeureIso(dateHeure: string): string {
  return dateHeure.replace(' ', 'T');
}

/** « 2026-12-05 » → « samedi 5 décembre 2026 » (calcul en UTC : aucun décalage de jour) */
export function dateLongue(dateIso: string): string {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(annee, mois - 1, jour)));
}

/** « 12:30 » → « 12h30 » */
export function heureFr(heure: string): string {
  return heure.slice(0, 5).replace(':', 'h');
}

/** « 0698765432 » → « 06 98 76 54 32 » (autre format : laissé tel quel) */
export function telephoneFr(telephone: string): string {
  return /^\d{10}$/.test(telephone) ? telephone.replace(/(\d{2})(?=\d)/g, '$1 ') : telephone;
}

// ---------------------------------------------------------------------
// 3. Frise du suivi
// ---------------------------------------------------------------------

export interface EtapeFrise {
  statut: StatutCommande;
  libelle: string;
  /** Date et heure du changement ; null pour une étape à venir */
  date: string | null;
  etat: 'franchie' | 'actuelle' | 'a-venir';
}

/** Parcours normal d'une commande ; le retour du matériel seulement s'il a été prêté */
export function parcoursCommande(pretMateriel: boolean): StatutCommande[] {
  return [
    'en_attente',
    'accepte',
    'en_preparation',
    'en_cours_livraison',
    'livre',
    ...(pretMateriel ? (['attente_retour_materiel'] as const) : []),
    'terminee',
  ];
}

/**
 * Étapes affichées dans la frise :
 * - tout l'historique, avec la date et l'heure de chaque changement (exigence du sujet) ;
 *   la dernière étape est l'étape actuelle ;
 * - puis, tant que la commande n'est ni terminée ni annulée, les étapes qui
 *   restent dans le parcours normal, sans date (« à venir »).
 */
export function etapesFrise(
  suivi: readonly EtapeSuivi[],
  statutActuel: StatutCommande,
  pretMateriel: boolean,
): EtapeFrise[] {
  const historique = suivi.length > 0 ? suivi : [{ statut: statutActuel, date: '' }];

  const etapes: EtapeFrise[] = historique.map((etape, index) => ({
    statut: etape.statut,
    libelle: LIBELLES_STATUT[etape.statut],
    date: etape.date || null,
    etat: index === historique.length - 1 ? 'actuelle' : 'franchie',
  }));

  if (!estFinie(statutActuel)) {
    const parcours = parcoursCommande(pretMateriel);
    const dejaVus = new Set(historique.map((etape) => etape.statut));
    for (const statut of parcours.slice(parcours.indexOf(statutActuel) + 1)) {
      if (!dejaVus.has(statut)) {
        etapes.push({ statut, libelle: LIBELLES_STATUT[statut], date: null, etat: 'a-venir' });
      }
    }
  }
  return etapes;
}

// ---------------------------------------------------------------------
// 4. Avis (mêmes limites que le serveur : POST /api/avis)
// ---------------------------------------------------------------------

export const NOTES = [1, 2, 3, 4, 5] as const;
export const COMMENTAIRE_MIN = 3;
export const COMMENTAIRE_MAX = 1000;

export const LIBELLES_NOTE: Record<number, string> = {
  1: 'Très décevant',
  2: 'Décevant',
  3: 'Correct',
  4: 'Très bien',
  5: 'Excellent',
};

export const LIBELLES_STATUT_AVIS: Record<'en_attente' | 'valide' | 'refuse', string> = {
  en_attente: 'En attente de validation',
  valide: 'Publié sur le site',
  refuse: 'Non publié',
};

/** Message d'erreur du commentaire, ou null s'il est valide (espaces ignorés) */
export function erreurCommentaire(texte: string): string | null {
  const longueur = texte.trim().length;
  if (longueur === 0) return 'Écrivez quelques mots sur votre expérience.';
  if (longueur < COMMENTAIRE_MIN) return `Au moins ${COMMENTAIRE_MIN} caractères.`;
  if (longueur > COMMENTAIRE_MAX) return `${COMMENTAIRE_MAX} caractères au maximum.`;
  return null;
}
