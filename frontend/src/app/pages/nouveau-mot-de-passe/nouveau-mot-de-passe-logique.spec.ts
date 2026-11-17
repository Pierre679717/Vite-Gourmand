import { HttpErrorResponse } from '@angular/common/http';
import {
  jetonBienForme,
  lienMalForme,
  lienRefuseDepuisErreur,
} from './nouveau-mot-de-passe-logique';

const erreurHttp = (status: number, corps: unknown) =>
  new HttpErrorResponse({ status, error: corps });

describe('jetonBienForme', () => {
  it('accepte 64 caractères hexadécimaux', () => {
    expect(jetonBienForme('a1'.repeat(32))).toBe(true);
  });

  it('refuse un jeton absent, tronqué (copier-coller incomplet) ou en majuscules', () => {
    expect(jetonBienForme(undefined)).toBe(false);
    expect(jetonBienForme('')).toBe(false);
    expect(jetonBienForme('a'.repeat(40))).toBe(false);
    expect(jetonBienForme('A'.repeat(64))).toBe(false);
  });
});

describe('lienMalForme', () => {
  it('propose une nouvelle demande', () => {
    expect(lienMalForme()).toEqual(
      expect.objectContaining({
        type: 'refuse',
        nouvelleDemande: true,
      }),
    );
  });
});

describe('lienRefuseDepuisErreur', () => {
  it('lien expiré : message du serveur, nouvelle demande proposée', () => {
    const refus = lienRefuseDepuisErreur(
      erreurHttp(400, {
        code: 'LIEN_EXPIRE',
        error: 'Ce lien a expiré (il est valable 30 minutes).',
      }),
    );
    expect(refus).toEqual({
      type: 'refuse',
      message: 'Ce lien a expiré (il est valable 30 minutes).',
      nouvelleDemande: true,
    });
  });

  it('lien déjà utilisé (2e clic)', () => {
    expect(lienRefuseDepuisErreur(erreurHttp(400, { code: 'LIEN_UTILISE' }))?.message).toBe(
      'Ce lien a déjà été utilisé. Faites une nouvelle demande si besoin.',
    );
  });

  it('compte désactivé : pas de nouvelle demande proposée', () => {
    const refus = lienRefuseDepuisErreur(
      erreurHttp(403, { code: 'COMPTE_DESACTIVE', error: 'Désactivé.' }),
    );
    expect(refus?.nouvelleDemande).toBe(false);
  });

  it('400 sans code (mot de passe refusé) : ne concerne pas le lien', () => {
    expect(
      lienRefuseDepuisErreur(erreurHttp(400, { error: 'Mot de passe trop faible', erreurs: [] })),
    ).toBeNull();
  });

  it('serveur injoignable ou 429 : erreur passagère, à réessayer', () => {
    expect(lienRefuseDepuisErreur(erreurHttp(0, null))?.type).toBe('erreur');
    const trop = lienRefuseDepuisErreur(erreurHttp(429, { error: 'Trop de tentatives.' }));
    expect(trop).toEqual(
      expect.objectContaining({ type: 'erreur', message: 'Trop de tentatives.' }),
    );
  });
});
