import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CREDITS_PHOTOS } from '../mentions-legales/credits-photos';
import { MentionsLegales } from '../mentions-legales/mentions-legales';
import { Cgv } from './cgv';

describe('Pages légales', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('les CGV contiennent la clause du matériel : 10 jours ouvrés, sinon 600 €', () => {
    const fixture = TestBed.createComponent(Cgv);
    fixture.detectChanges();
    const texte = (fixture.nativeElement as HTMLElement).querySelector(
      '#pret-materiel + div',
    )!.textContent!;
    expect(texte).toContain('10 jours ouvrés');
    expect(texte).toContain('600 €');
  });

  it('les CGV reprennent les règles de prix du site (réduction, livraison)', () => {
    const fixture = TestBed.createComponent(Cgv);
    fixture.detectChanges();
    const texte = (fixture.nativeElement as HTMLElement).textContent!;
    expect(texte).toContain('10 %');
    expect(texte).toContain('0,59 € par kilomètre');
  });

  it('les mentions légales ont une section « Données personnelles » (ancre du pied de page)', () => {
    const fixture = TestBed.createComponent(MentionsLegales);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector('#donnees-personnelles');
    expect(section?.textContent).toContain('Données personnelles');
  });

  it('les mentions légales donnent le nom du concepteur', () => {
    const fixture = TestBed.createComponent(MentionsLegales);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector('#realisation + p');
    expect(section?.textContent).toContain('MANOUAN Anoman (Pierre)');
  });

  it('les crédits photos citent les 12 photos, chacune avec son auteur et un lien vers sa page', () => {
    const fixture = TestBed.createComponent(MentionsLegales);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const lignes = [...page.querySelectorAll('.credits-photos li')];
    expect(lignes).toHaveLength(12);
    expect(new Set(CREDITS_PHOTOS.map((c) => c.fichier)).size).toBe(12);
    lignes.forEach((ligne, i) => {
      const credit = CREDITS_PHOTOS[i];
      const lien = ligne.querySelector('a')!;
      expect(lien.getAttribute('href')).toBe(credit.lien);
      expect(lien.getAttribute('href')).toMatch(
        /^https:\/\/(unsplash\.com|www\.pexels\.com)\/photo/,
      );
      // Texte du lien explicite (RGAA 6.1) : le sujet de la photo, pas « ici » ni l'URL
      expect(lien.textContent!.trim()).toBe(credit.sujet);
      expect(ligne.textContent).toContain(credit.auteur);
    });
  });
});
