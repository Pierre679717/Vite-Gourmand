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
