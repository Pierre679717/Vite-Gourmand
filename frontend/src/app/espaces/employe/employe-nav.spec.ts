import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../core/auth/token-de-test';
import { EmployeNav } from './employe-nav';

describe('EmployeNav', () => {
  afterEach(() => localStorage.clear());

  function onglets(): { libelle: string; nav: string | null } {
    TestBed.configureTestingModule({ imports: [EmployeNav], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(EmployeNav);
    fixture.detectChanges();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    return {
      libelle: [...nav.querySelectorAll('a')].map((a) => a.textContent?.trim()).join(' · '),
      nav: nav.getAttribute('aria-label'),
    };
  }

  it('employé : les 5 onglets de son espace', () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    expect(onglets()).toEqual({
      libelle: 'Commandes · Avis clients · Menus · Plats · Horaires',
      nav: 'Espace employé',
    });
  });

  it('administrateur : ses 2 onglets, puis tout l’espace employé', () => {
    localStorage.setItem(
      'vg_token',
      fauxToken({ ...HELENE_EMPLOYEE, id: 1, role: 'administrateur' }),
    );
    expect(onglets()).toEqual({
      libelle: 'Statistiques · Employés · Commandes · Avis clients · Menus · Plats · Horaires',
      nav: 'Espace administrateur',
    });
  });
});
