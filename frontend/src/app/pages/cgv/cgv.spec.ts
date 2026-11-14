import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
