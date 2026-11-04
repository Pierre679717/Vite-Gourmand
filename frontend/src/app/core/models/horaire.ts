/** Un jour d'ouverture, tel que renvoyé par GET /api/horaires. */
export interface Horaire {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
  /** "09:00", ou null si l'entreprise est fermée ce jour-là */
  heure_ouverture: string | null;
  heure_fermeture: string | null;
}
