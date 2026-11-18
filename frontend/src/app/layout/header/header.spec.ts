import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';

describe('Header (accessibilité)', () => {
  function ouvrir(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('logo : le nom accessible commence par le texte visible (WCAG 2.5.3)', () => {
    const logo = ouvrir().querySelector<HTMLAnchorElement>('.entete__logo')!;
    // Pas d'aria-label : le nom est le texte du lien, précision masquée comprise
    expect(logo.hasAttribute('aria-label')).toBe(false);
    const nom = logo.textContent!.replace(/\s+/g, ' ').trim();
    expect(nom).toBe("Vite & Gourmand, retour à l'accueil");
    expect(logo.querySelector('.visuellement-masque')?.textContent).toContain("retour à l'accueil");
  });
});
