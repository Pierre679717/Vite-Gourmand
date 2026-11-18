import { HttpErrorResponse } from '@angular/common/http';
import { messageErreur } from '../../core/http/message-erreur';
import { CodeLien } from '../../core/models/mot-de-passe';

/**
 * Logique « pure » de la page Nouveau mot de passe (sans Angular, testée seule).
 */

/** Un jeton est 64 caractères hexadécimaux (backend/utils/jetonReinitialisation.js) */
export function jetonBienForme(jeton: string | null | undefined): jeton is string {
  return typeof jeton === 'string' && /^[a-f0-9]{64}$/.test(jeton);
}

/**
 * Lien refusé : message, et s'il faut proposer une nouvelle demande.
 * - 'refuse' : lien expiré, déjà utilisé, invalide ou compte désactivé ;
 * - 'erreur' : problème passager (serveur injoignable, 429, 500) → « Réessayer ».
 */
export interface LienRefuse {
  type: 'refuse' | 'erreur';
  message: string;
  nouvelleDemande: boolean;
}

const MESSAGES_PAR_DEFAUT: Record<CodeLien, string> = {
  LIEN_EXPIRE: 'Ce lien a expiré. Faites une nouvelle demande.',
  LIEN_UTILISE: 'Ce lien a déjà été utilisé. Faites une nouvelle demande si besoin.',
  LIEN_INVALIDE: "Ce lien de réinitialisation n'est pas valide. Faites une nouvelle demande.",
  COMPTE_DESACTIVE: 'Ce compte est désactivé. Contactez Vite & Gourmand.',
};

function estCodeLien(valeur: unknown): valeur is CodeLien {
  return typeof valeur === 'string' && valeur in MESSAGES_PAR_DEFAUT;
}

/** Lien absent ou mal formé dans l'adresse : inutile d'interroger le serveur */
export function lienMalForme(): LienRefuse {
  return {
    type: 'refuse',
    message: MESSAGES_PAR_DEFAUT.LIEN_INVALIDE,
    nouvelleDemande: true,
  };
}

/**
 * Traduit une erreur de l'API en lien refusé, ou null si l'erreur ne concerne
 * pas le lien (ex. 400 sur le mot de passe : affiché sous le formulaire).
 */
export function lienRefuseDepuisErreur(erreur: unknown): LienRefuse | null {
  if (erreur instanceof HttpErrorResponse) {
    const code: unknown = erreur.error?.code;
    if (estCodeLien(code)) {
      return {
        type: 'refuse',
        message:
          typeof erreur.error?.error === 'string' ? erreur.error.error : MESSAGES_PAR_DEFAUT[code],
        // Compte désactivé : une nouvelle demande ne servirait à rien
        nouvelleDemande: code !== 'COMPTE_DESACTIVE',
      };
    }
    if (erreur.status === 400) return null;
  }
  return {
    type: 'erreur',
    message: messageErreur(erreur),
    nouvelleDemande: false,
  };
}
