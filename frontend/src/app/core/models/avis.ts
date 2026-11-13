/** Un avis client validé, tel que renvoyé par GET /api/avis */
export interface Avis {
  avis_id: number;
  /** Note de 1 à 5 */
  note: number;
  commentaire: string;
  date_creation: string;
  /** Prénom et initiale du nom seulement (minimisation des données, RGPD) */
  prenom: string;
  initiale_nom: string;
  /** Titre du menu commandé */
  menu: string;
}

/** Corps de POST /api/avis : sur une commande « terminée » du client */
export interface NouvelAvis {
  commande_id: number;
  /** Entier de 1 à 5 */
  note: number;
  commentaire: string;
}

/** Réponse 201 de POST /api/avis : l'avis créé, en attente de validation */
export interface ReponseAvis {
  message: string;
  avis: { note: number; commentaire: string; statut: 'en_attente' };
}
