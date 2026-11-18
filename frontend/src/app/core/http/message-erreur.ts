import { HttpErrorResponse } from '@angular/common/http';

/**
 * Transforme une erreur HTTP en message lisible pour l'utilisateur.
 * L'API renvoie ses erreurs sous la forme { error: "message" }.
 */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      return 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.';
    }
    if (typeof erreur.error?.error === 'string') {
      return erreur.error.error;
    }
  }
  return 'Une erreur inattendue est survenue. Réessayez dans quelques instants.';
}

/**
 * Toutes les erreurs d'une réponse, pour les afficher en liste.
 * En cas de validation refusée (400), l'API renvoie aussi un tableau
 * { error: "première erreur", erreurs: ["...", "..."] } ;
 * sinon on se contente du message unique de messageErreur().
 */
export function messagesErreur(erreur: unknown): string[] {
  if (erreur instanceof HttpErrorResponse) {
    const liste: unknown = erreur.error?.erreurs;
    if (Array.isArray(liste) && liste.length > 0 && liste.every((m) => typeof m === 'string')) {
      return liste;
    }
  }
  return [messageErreur(erreur)];
}
