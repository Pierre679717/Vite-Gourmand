import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { Component, LOCALE_ID, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fauxToken } from '../../../core/auth/token-de-test';
import { StatMenu, Statistiques } from '../../../core/models/admin';
import { GraphiqueCommandes } from './graphique-commandes';
import { StatistiquesAdmin } from './statistiques-admin';

registerLocaleData(localeFr);

/** Le vrai graphique a besoin d'un canvas (absent de jsdom) : on le remplace */
@Component({
  selector: 'app-graphique-commandes',
  template: '<p class="faux-graphique">{{ menus().length }} barres</p>',
})
class FauxGraphique {
  readonly menus = input.required<StatMenu[]>();
}

const STATS: Statistiques = {
  filtres: { menu_id: null, debut: null, fin: null },
  menus: [
    {
      menu_id: 2,
      menu_titre: 'Menu Prestige',
      nombre_commandes: 5,
      nombre_annulees: 1,
      chiffre_affaires: 4250,
    },
    {
      menu_id: 1,
      menu_titre: 'Menu de Noël',
      nombre_commandes: 4,
      nombre_annulees: 0,
      chiffre_affaires: 2639.4,
    },
  ],
  totaux: { nombre_commandes: 9, nombre_annulees: 1, chiffre_affaires: 6889.4 },
};

describe('StatistiquesAdmin', () => {
  let harnais: RouterTestingHarness;
  let http: HttpTestingController;

  const page = () => harnais.routeNativeElement as HTMLElement;
  async function ouvrir(url: string, reponse: Statistiques | null = STATS): Promise<void> {
    harnais = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    await harnais.navigateByUrl(url);
    http.expectOne('/api/employe/menus').flush([
      { menu_id: 1, titre: 'Menu de Noël' },
      { menu_id: 2, titre: 'Menu Prestige' },
    ]);
    const requete = http.expectOne((r) => r.url === '/api/admin/statistiques');
    if (reponse) requete.flush(reponse);
    else
      requete.flush(
        { error: "Statistiques indisponibles : la base MongoDB n'est pas connectée." },
        { status: 503, statusText: 'Service Unavailable' },
      );
    harnais.detectChanges();
    await harnais.fixture.whenStable();
    harnais.detectChanges();
  }

  beforeEach(() => {
    localStorage.setItem(
      'vg_token',
      fauxToken({ id: 1, nom: 'Martin', prenom: 'José', email: 'a@vg.fr', role: 'administrateur' }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'stats', component: StatistiquesAdmin }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    TestBed.overrideComponent(StatistiquesAdmin, {
      remove: { imports: [GraphiqueCommandes] },
      add: { imports: [FauxGraphique] },
    });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('sans filtre : totaux, graphique et tableau', async () => {
    await ouvrir('/stats');
    expect(page().querySelector('.stats-resume')?.textContent).toContain(
      'Tous les menus, toutes les dates.',
    );
    expect(page().querySelector('.stats-tuiles')?.textContent).toMatch(/6\u202f889,40/); // espace fine insécable du format français
    expect(page().querySelector('.faux-graphique')?.textContent).toBe('2 barres');
    const lignes = page().querySelectorAll('tbody tr');
    expect(lignes.length).toBe(2);
    expect(lignes[0].textContent).toContain('Menu Prestige');
    expect(lignes[0].textContent).toContain('62 %');
    expect(page().querySelector('tfoot')?.textContent).toContain('Total');
  });

  it('filtres lus dans l’URL, envoyés à l’API et recopiés dans le formulaire', async () => {
    harnais = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    await harnais.navigateByUrl('/stats?menu_id=1&debut=2026-10-01&fin=2026-10-31');
    http.expectOne('/api/employe/menus').flush([{ menu_id: 1, titre: 'Menu de Noël' }]);
    const requete = http.expectOne((r) => r.url === '/api/admin/statistiques');
    expect(requete.request.params.get('menu_id')).toBe('1');
    expect(requete.request.params.get('debut')).toBe('2026-10-01');
    expect(requete.request.params.get('fin')).toBe('2026-10-31');
    requete.flush({ ...STATS, menus: [STATS.menus[1]] });
    harnais.detectChanges();
    await harnais.fixture.whenStable();
    harnais.detectChanges();
    expect(page().querySelector<HTMLInputElement>('#debut')!.value).toBe('2026-10-01');
    expect(page().querySelector('.stats-resume')?.textContent).toContain(
      'Menu de Noël, du 01/10/2026 au 31/10/2026.',
    );
  });

  it('« Afficher » met les filtres dans l’URL', async () => {
    await ouvrir('/stats');
    const debut = page().querySelector<HTMLInputElement>('#debut')!;
    debut.value = '2026-11-01';
    debut.dispatchEvent(new Event('input'));
    page().querySelector('form')!.dispatchEvent(new Event('submit'));
    await harnais.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/stats?debut=2026-11-01');
    http
      .expectOne(
        (r) => r.url === '/api/admin/statistiques' && r.params.get('debut') === '2026-11-01',
      )
      .flush(STATS);
  });

  it('période inversée : message, aucune requête', async () => {
    await ouvrir('/stats');
    for (const [id, valeur] of [
      ['debut', '2026-11-02'],
      ['fin', '2026-11-01'],
    ]) {
      const champ = page().querySelector<HTMLInputElement>(`#${id}`)!;
      champ.value = valeur;
      champ.dispatchEvent(new Event('input'));
    }
    page().querySelector('form')!.dispatchEvent(new Event('submit'));
    harnais.detectChanges();
    expect(page().querySelector('#periode-erreur')?.textContent).toContain('doit précéder');
    http.expectNone((r) => r.url === '/api/admin/statistiques');
  });

  it('aucune commande : message à la place du graphique', async () => {
    await ouvrir('/stats?debut=2030-01-01', {
      ...STATS,
      menus: [],
      totaux: { nombre_commandes: 0, nombre_annulees: 0, chiffre_affaires: 0 },
    });
    expect(page().textContent).toContain('Aucune commande pour ces filtres.');
    expect(page().querySelector('table')).toBeNull();
  });

  it('MongoDB indisponible : message du serveur et « Réessayer »', async () => {
    await ouvrir('/stats', null);
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('MongoDB');
    page().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    harnais.detectChanges();
    await harnais.fixture.whenStable();
    http.expectOne((r) => r.url === '/api/admin/statistiques').flush(STATS);
  });
});
