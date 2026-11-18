import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { MenuGestion } from '../../../core/models/catalogue';
import { MenusGestion } from './menus-gestion';

registerLocaleData(localeFr);

const menu = (modifs: Partial<MenuGestion> = {}): MenuGestion => ({
  menu_id: 8,
  titre: 'Menu de Noël',
  actif: 1,
  nombre_personne_min: 8,
  prix_par_personne: 75,
  prix_minimum: 600,
  quantite_restante: 4,
  theme: 'Noël',
  regime: 'Classique',
  nombre_plats: 4,
  nombre_commandes: 2,
  ...modifs,
});

describe('MenusGestion', () => {
  let fixture: ComponentFixture<MenusGestion>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const bouton = (nom: string) =>
    page.querySelector<HTMLButtonElement>(`button[aria-label="${nom}"]`);

  beforeEach(async () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [MenusGestion],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    fixture = TestBed.createComponent(MenusGestion);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/api/employe/menus')
      .flush([
        menu(),
        menu({ menu_id: 9, titre: 'Menu de Pâques', nombre_commandes: 0 }),
        menu({ menu_id: 5, titre: 'Menu Vegan', actif: 0, nombre_commandes: 1 }),
      ]);
    await rendre();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('affiche les menus, sur la carte ou non', () => {
    const cartes = page.querySelectorAll('.element');
    expect(cartes.length).toBe(3);
    expect(cartes[0].textContent).toContain('Sur la carte');
    expect(cartes[0].textContent).toContain('Commandé 2 fois');
    expect(cartes[2].textContent).toContain('Retiré de la carte');
  });

  it('« Supprimer » seulement pour un menu jamais commandé', () => {
    expect(bouton('Supprimer Menu de Noël')).toBeNull();
    expect(bouton('Supprimer Menu Vegan')).toBeNull();
    expect(bouton('Supprimer Menu de Pâques')).toBeTruthy();
  });

  it('retirer de la carte : PUT actif false, message, liste relue', async () => {
    bouton('Retirer de la carte Menu de Noël')!.click();
    const requete = http.expectOne('/api/employe/menus/8/carte');
    expect(requete.request.body).toEqual({ actif: false });
    requete.flush({ message: 'Menu retiré de la carte.', actif: false });
    await rendre();
    http.expectOne('/api/employe/menus').flush([menu({ actif: 0 })]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain(
      '« Menu de Noël » : menu retiré de la carte.',
    );
    expect(bouton('Remettre sur la carte Menu de Noël')).toBeTruthy();
  });

  it('suppression : confirmation, puis DELETE', async () => {
    bouton('Supprimer Menu de Pâques')!.click();
    await rendre();
    expect(page.querySelector('.confirmation')?.textContent).toContain(
      'Supprimer « Menu de Pâques » ?',
    );
    http.expectNone('/api/employe/menus/9');

    [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!.click();
    http.expectOne({ method: 'DELETE', url: '/api/employe/menus/9' }).flush({
      message: 'Menu « Menu de Pâques » supprimé.',
    });
    await rendre();
    http.expectOne('/api/employe/menus').flush([menu()]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain('supprimé');
  });

  it('Échap annule la confirmation', async () => {
    bouton('Supprimer Menu de Pâques')!.click();
    await rendre();
    page
      .querySelector('.confirmation')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await rendre();
    expect(page.querySelector('.confirmation')).toBeNull();
  });
});
