import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { OptionsMenu } from '../../../core/models/catalogue';
import { MenuFormulaire } from './menu-formulaire';

const options: OptionsMenu = {
  themes: [{ theme_id: 2, libelle: 'Noël' }],
  regimes: [{ regime_id: 1, libelle: 'Classique' }],
  plats: [
    { plat_id: 1, titre: 'Foie gras', categorie: 'entree' },
    { plat_id: 4, titre: 'Chapon', categorie: 'plat' },
    { plat_id: 7, titre: 'Bûche', categorie: 'dessert' },
  ],
};

describe('MenuFormulaire', () => {
  let fixture: ComponentFixture<MenuFormulaire>;
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
      imports: [MenuFormulaire],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MenuFormulaire);
    if (id) fixture.componentRef.setInput('id', id);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/api/employe/menus/options').flush(options);
    if (id) {
      http.expectOne(`/api/employe/menus/${id}`).flush({
        menu_id: 8,
        titre: 'Menu de Noël',
        description: 'Un repas de fête pour la famille.',
        conditions: 'Commander 7 jours avant.',
        nombre_personne_min: 8,
        delai_minimum_jours: 7,
        prix_par_personne: 75,
        quantite_restante: 4,
        actif: 1,
        theme_id: 2,
        regime_id: 1,
        nombre_commandes: 2,
        plats: [1, 4],
      });
    }
    await rendre();
  }

  function saisir(id: string, valeur: string): void {
    const champ = page.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('nouveau menu vide : envoi bloqué, erreurs affichées', async () => {
    await ouvrir();
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await rendre();
    http.expectNone('/api/employe/menus');
    expect(page.querySelectorAll('.champ__erreur').length).toBeGreaterThanOrEqual(9);
    expect(page.textContent).toContain('Choisissez au moins un plat.');
  });

  it('création : POST avec les plats cochés, retour à la liste avec le message', async () => {
    await ouvrir();
    saisir('titre', ' Menu Réveillon ');
    saisir('description', 'Un réveillon raffiné en cinq temps.');
    saisir('conditions', 'Commander au moins 10 jours avant.');
    saisir('personnes', '6');
    saisir('prix', '89,90');
    saisir('delai', '10');
    saisir('stock', '5');
    const selects = page.querySelectorAll<HTMLSelectElement>('select');
    selects[0].selectedIndex = 1;
    selects[0].dispatchEvent(new Event('change'));
    selects[1].selectedIndex = 1;
    selects[1].dispatchEvent(new Event('change'));
    const cases = page.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    cases[0].click();
    cases[2].click();
    await rendre();
    expect(page.textContent).toContain('2 plats choisis');

    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    const requete = http.expectOne({ method: 'POST', url: '/api/employe/menus' });
    expect(requete.request.body).toEqual({
      titre: 'Menu Réveillon',
      description: 'Un réveillon raffiné en cinq temps.',
      conditions: 'Commander au moins 10 jours avant.',
      nombre_personne_min: 6,
      delai_minimum_jours: 10,
      prix_par_personne: 89.9,
      quantite_restante: 5,
      theme_id: 2,
      regime_id: 1,
      plats: [1, 7],
    });
    requete.flush({ message: 'Menu « Menu Réveillon » créé.', menu_id: 12 });
    expect(navigate).toHaveBeenCalledWith(['/espace-employe/menus'], {
      state: { message: 'Menu « Menu Réveillon » créé.' },
    });
  });

  it('modification : formulaire pré-rempli, PUT, et 409 affiché', async () => {
    await ouvrir('8');
    expect((page.querySelector('#titre') as HTMLInputElement).value).toBe('Menu de Noël');
    expect(page.textContent).toContain('commandé 2 fois');
    expect(page.textContent).toContain('2 plats choisis');

    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    http
      .expectOne({ method: 'PUT', url: '/api/employe/menus/8' })
      .flush({ error: 'Un menu porte déjà ce nom.' }, { status: 409, statusText: 'Conflit' });
    await rendre();
    expect(page.querySelector('#erreurs-serveur')?.textContent).toContain(
      'Un menu porte déjà ce nom.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
