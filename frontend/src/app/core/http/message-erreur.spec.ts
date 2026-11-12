import { HttpErrorResponse } from '@angular/common/http';
import { messageErreur, messagesErreur } from './message-erreur';

/** Fabrique une erreur HTTP comme celles que reçoit HttpClient */
function erreurHttp(status: number, corps: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: corps });
}

describe('messageErreur', () => {
  it('reprend le message { error } envoyé par l’API', () => {
    expect(messageErreur(erreurHttp(503, { error: 'Service de géocodage indisponible.' }))).toBe(
      'Service de géocodage indisponible.',
    );
  });

  it('signale un serveur injoignable (statut 0)', () => {
    expect(messageErreur(erreurHttp(0, null))).toContain('injoignable');
  });

  it('donne un message générique pour une erreur inconnue', () => {
    expect(messageErreur(new Error('boum'))).toContain('erreur inattendue');
  });
});

describe('messagesErreur', () => {
  it('renvoie toute la liste erreurs[] d’un refus de validation', () => {
    const erreur = erreurHttp(400, {
      error: 'Adresse e-mail invalide.',
      erreurs: ['Adresse e-mail invalide.', 'Heure de livraison invalide (format HH:MM).'],
    });
    expect(messagesErreur(erreur)).toEqual([
      'Adresse e-mail invalide.',
      'Heure de livraison invalide (format HH:MM).',
    ]);
  });

  it('se rabat sur le message unique quand il n’y a pas de liste', () => {
    expect(messagesErreur(erreurHttp(409, { error: 'Stock épuisé.' }))).toEqual(['Stock épuisé.']);
  });

  it('ignore une liste mal formée', () => {
    expect(messagesErreur(erreurHttp(400, { error: 'Refusé.', erreurs: [42] }))).toEqual([
      'Refusé.',
    ]);
  });
});
