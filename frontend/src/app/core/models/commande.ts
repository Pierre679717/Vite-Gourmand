/**
 * Types de la commande, calqués sur les réponses de l'API
 * (voir backend/controllers/commande.controller.js).
 * Les noms des champs sont ceux attendus par le serveur.
 */

/** Corps de POST /api/commandes/devis : ce qu'il faut pour calculer le prix */
export interface DemandeDevis {
  menu_id: number;
  nombre_personne: number;
  adresse_prestation: string;
  ville_prestation: string;
}

/** Adresse reconnue par le service de géocodage (Géoplateforme IGN) */
export interface LivraisonTrouvee {
  /** Adresse complète telle que le service l'a comprise */
  adresse_trouvee: string;
  ville: string;
  code_postal: string;
  /** Livraison offerte à Bordeaux */
  est_bordeaux: boolean;
}

/** Détail du prix calculé par le serveur (mêmes champs pour le devis et la commande) */
export interface DetailPrix {
  /** Distance à vol d'oiseau depuis Bordeaux, arrondie à 0,1 km */
  distance_km: number;
  prix_par_personne: number;
  /** Réduction de 10 % (0 si elle ne s'applique pas) */
  reduction: number;
  /** Prix du menu, réduction déduite */
  prix_menu: number;
  prix_livraison: number;
  prix_total: number;
}

/** Réponse de POST /api/commandes/devis (rien n'est enregistré) */
export interface Devis extends DetailPrix {
  menu: {
    menu_id: number;
    titre: string;
    nombre_personne_min: number;
    delai_minimum_jours: number;
  };
  nombre_personne: number;
  /** La réduction s'applique à partir de ce nombre de personnes (minimum + 5) */
  personnes_pour_reduction: number;
  livraison: LivraisonTrouvee;
}

/**
 * Corps de POST /api/commandes.
 * Aucun prix ni distance : le serveur les recalcule toujours lui-même.
 */
export interface DonneesCommande extends DemandeDevis {
  /** AAAA-MM-JJ */
  date_prestation: string;
  /** HH:MM */
  heure_livraison: string;
  pret_materiel: boolean;
  contact_nom: string;
  contact_prenom: string;
  contact_email: string;
  contact_telephone: string;
}

/** La commande enregistrée, renvoyée avec le statut 201 */
export interface CommandeCreee extends DetailPrix {
  commande_id: number;
  /** VG-AAAA-NNNN */
  numero_commande: string;
  /** Titre du menu */
  menu: string;
  nombre_personne: number;
  date_prestation: string;
  heure_livraison: string;
  adresse_prestation: string;
  /** Ville officielle renvoyée par le géocodage */
  ville_prestation: string;
  pret_materiel: boolean;
}

/** Réponse complète de POST /api/commandes */
export interface ReponseCreationCommande {
  message: string;
  commande: CommandeCreee;
}
