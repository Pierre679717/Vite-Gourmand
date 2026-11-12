/** Les trois rôles définis dans la table role de la base. */
export type Role = 'utilisateur' | 'employe' | 'administrateur';

/** Utilisateur connecté : contenu du JWT renvoyé par POST /api/connexion. */
export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
}

/**
 * Profil complet de l'utilisateur connecté : GET /api/profil.
 * Lu en base par le serveur (le token ne contient ni téléphone ni adresse).
 * Les coordonnées sont facultatives à l'inscription : elles peuvent valoir null.
 */
export interface Profil extends Utilisateur {
  telephone: string | null;
  adresse_postale: string | null;
  code_postal: string | null;
  ville: string | null;
}

/** Réponse de POST /api/connexion */
export interface ReponseConnexion {
  message: string;
  token: string;
  user: Utilisateur;
}

/** Corps attendu par POST /api/inscription (tous les champs sont requis). */
export interface DonneesInscription {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse_postale: string;
  code_postal: string;
  ville: string;
  mot_de_passe: string;
}
