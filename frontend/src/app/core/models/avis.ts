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
