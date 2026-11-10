import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PrixPipe } from './prix.pipe';

registerLocaleData(localeFr);

describe('PrixPipe', () => {
  let pipe: PrixPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr-FR' }] });
    pipe = TestBed.runInInjectionContext(() => new PrixPipe());
  });

  // Le format français sépare les milliers et le symbole par des espaces insécables : \s les reconnaît
  it('prix rond : sans centimes', () => {
    expect(pipe.transform(390)).toMatch(/^390\s€$/);
  });

  it('prix avec centimes : toujours 2 chiffres', () => {
    expect(pipe.transform(71.5)).toMatch(/^71,50\s€$/);
    expect(pipe.transform(643.55)).toMatch(/^643,55\s€$/);
  });

  it('milliers séparés', () => {
    expect(pipe.transform(1250)).toMatch(/^1\s250\s€$/);
  });

  it('valeur absente : texte vide', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(Number.NaN)).toBe('');
  });
});
