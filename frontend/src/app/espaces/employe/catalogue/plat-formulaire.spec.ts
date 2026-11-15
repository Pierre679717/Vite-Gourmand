import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { PlatFormulaire } from './plat-formulaire';

describe('PlatFormulaire', () => {
  let fixture: ComponentFixture<PlatFormulaire>;
  let http: HttpTestingController;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(id?: string): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [PlatFormulaire],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(PlatFormulaire);
    if (id) fixture.componentRef.setInput('id', id);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/api/employe/allergenes').flush([
      { allergene_id: 6, libelle: 'Gluten' },
      { allergene_id: 7, libelle: 'Lait' },
      { allergene_id: 11, libelle: 'Œufs' },
    ]);
    if (id) {
      http
        .expectOne(`/api/employe/plats/${id}`)
        .flush({ plat_id: 7, titre: 'Bûche glacée', categorie: 'dessert', allergenes: [7, 11] });
    }
    await rendre();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('création : catégorie obligatoire, puis POST avec les allergènes', async () => {
    await ouvrir();
    const titre = page.querySelector<HTMLInputElement>('#titre')!;
    titre.value = 'Velouté de potimarron';
    titre.dispatchEvent(new Event('input'));
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await rendre();
    http.expectNone('/api/employe/plats');
    expect(page.textContent).toContain('Choisissez la catégorie du plat.');

    page.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0].click();
    page.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click();
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    const requete = http.expectOne({ method: 'POST', url: '/api/employe/plats' });
    expect(requete.request.body).toEqual({
      titre: 'Velouté de potimarron',
      categorie: 'entree',
      allergenes: [7],
    });
    requete.flush({ message: 'Plat « Velouté de potimarron » créé.', plat_id: 40 });
    expect(navigate).toHaveBeenCalledWith(['/espace-employe/plats'], {
      state: { message: 'Plat « Velouté de potimarron » créé.' },
    });
  });

  it('modification : cases pré-cochées, décocher un allergène', async () => {
    await ouvrir('7');
    const cases = page.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect([...cases].map((c) => c.checked)).toEqual([false, true, true]);
    cases[2].click();
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    const requete = http.expectOne({ method: 'PUT', url: '/api/employe/plats/7' });
    expect(requete.request.body).toEqual({
      titre: 'Bûche glacée',
      categorie: 'dessert',
      allergenes: [7],
    });
    requete.flush({ message: 'ok' });
  });
});
