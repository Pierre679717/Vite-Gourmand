import { CommandeDetaillee, ResumeCommande, StatutCommande } from './commande';

/**
 * Types de l'espace employé, calqués sur les réponses de l'API
 * (backend/utils/commandeEmploye.js et controllers/avis.controller.js).
 */

/** Filtres de GET /api/employe/commandes (un champ vide n'est pas envoyé) */
export interface FiltresCommandes {
  statut?: StatutCommande;
  /** Nom, prénom, e-mail du client ou numéro de commande */
  client?: string;
}

/** Client qui a passé la commande (son compte) */
export interface ClientCommande {
  nom: string;
  prenom: string;
  email: string;
}

/** Une ligne de GET /api/employe/commandes */
export interface CommandeEmploye extends Omit<ResumeCommande, 'avis_donne'> {
  pret_materiel: boolean;
  client: ClientCommande;
  /** Statuts que l'employé peut appliquer maintenant (calculés par le serveur) */
  statuts_suivants: StatutCommande[];
}

/** Mode de contact du client avant une annulation (exigé par le sujet) */
export type ModeContact = 'gsm' | 'mail';

/** GET /api/employe/commandes/:id */
export interface CommandeEmployeDetaillee extends Omit<
  CommandeDetaillee,
  'peut_modifier' | 'peut_donner_avis'
> {
  client: ClientCommande & { utilisateur_id: number; telephone: string | null };
  /** Renseignés seulement si un employé a annulé la commande */
  mode_contact: ModeContact | null;
  motif: string | null;
  statuts_suivants: StatutCommande[];
}

/** Corps de PUT /api/employe/commandes/:id */
export type ChangementStatut =
  | { statut: Exclude<StatutCommande, 'en_attente' | 'annulee'> }
  | { statut: 'annulee'; mode_contact: ModeContact; motif: string };

/** Réponse de PUT /api/employe/commandes/:id */
export interface ReponseChangementStatut {
  message: string;
  numero_commande: string;
  statut: StatutCommande;
}

// ---------------------------------------------------------------------
// Modération des avis
// ---------------------------------------------------------------------

export type StatutAvis = 'en_attente' | 'valide' | 'refuse';

/** Une ligne de GET /api/employe/avis */
export interface AvisModeration {
  avis_id: number;
  note: number;
  commentaire: string;
  statut: StatutAvis;
  /** AAAA-MM-JJ HH:MM:SS, heure de Paris */
  date_creation: string;
  commande_id: number;
  numero_commande: string;
  /** Titre du menu commandé */
  menu: string;
  prenom: string;
  nom: string;
  email: string;
}

/** Décision de l'employé : PUT /api/employe/avis/:id */
export type DecisionAvis = Exclude<StatutAvis, 'en_attente'>;

export interface ReponseModeration {
  message: string;
  avis_id: number;
  statut: DecisionAvis;
}
