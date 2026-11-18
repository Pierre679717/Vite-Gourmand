/**
 * Mot de passe oublié : échanges avec l'API
 * (backend/controllers/motDePasse.controller.js).
 */

/** Codes renvoyés par l'API quand un lien de réinitialisation est refusé */
export type CodeLien = 'LIEN_INVALIDE' | 'LIEN_UTILISE' | 'LIEN_EXPIRE' | 'COMPTE_DESACTIVE';

/** Réponse simple { message } (demande de lien, nouveau mot de passe) */
export interface ReponseMessage {
  message: string;
}
