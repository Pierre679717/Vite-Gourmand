import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { PlatsGestion } from './plats-gestion';

describe('PlatsGestion', () => {
  let fixture: ComponentFixture<PlatsGestion>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [PlatsGestion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PlatsGestion);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/api/employe/plats').flush([
      {
        plat_id: 1,
        titre: 'Foie gras',
        categorie: 'entree',
        allergenes: [{ allergene_id: 6, libelle: 'Gluten' }],
        menus: [{ menu_id: 8, titre: 'Menu de Noël' }],
      },
      { plat_id: 2, titre: 'Velouté', categorie: 'entree', allergenes: [], menus: [] },
      { plat_id: 7, titre: 'Bûche', categorie: 'dessert', allergenes: [], menus: [] },
    ]);
    await rendre();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('range les plats par catégorie, avec allergènes et menus', () => {
    const titres = [...page.querySelectorAll('h2')].map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(titres).toEqual(['Entrées (2)', 'Plats (0)', 'Desserts (1)']);
    expect(page.textContent).toContain('Gluten');
    expect(page.textContent).toContain('Dans : Menu de Noël');
    expect(page.textContent).toContain('Aucun allergène déclaré');
  });

  it('« Supprimer » seulement pour un plat dans aucun menu, avec confirmation', async () => {
    expect(page.querySelector('button[aria-label="Supprimer Foie gras"]')).toBeNull();
    page.querySelector<HTMLButtonElement>('button[aria-label="Supprimer Velouté"]')!.click();
    await rendre();
    [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!.click();
    http
      .expectOne({ method: 'DELETE', url: '/api/employe/plats/2' })
      .flush({ message: 'Plat « Velouté » supprimé.' });
    await rendre();
    http.expectOne('/api/employe/plats').flush([]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain(
      'Plat « Velouté » supprimé.',
    );
  });
});
