import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MenuResume } from '../models/menu';
import { MenuService, versParametres } from './menu.service';

describe('versParametres', () => {
  it('ne met rien dans l’URL sans filtre', () => {
    expect(versParametres({}).toString()).toBe('');
  });

  it('traduit chaque filtre en paramètre', () => {
    const parametres = versParametres({
      prix_min: 300,
      prix_max: 400,
      theme: 4,
      regime: 1,
      personnes: 8,
    });
    expect(parametres.toString()).toBe('prix_min=300&prix_max=400&theme=4&regime=1&personnes=8');
  });

  it('ignore les valeurs qui ne sont pas des nombres valides', () => {
    const filtres = { prix_max: Number.NaN, theme: undefined, regime: null } as never;
    expect(versParametres(filtres).toString()).toBe('');
  });
});

describe('MenuService', () => {
  let service: MenuService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MenuService);
    controleur = TestBed.inject(HttpTestingController);
  });

  // Vérifie qu'aucune requête inattendue n'est restée en attente
  afterEach(() => controleur.verify());

  it('appelle GET /api/menus avec les filtres en paramètres', () => {
    const menus = [{ menu_id: 1, titre: 'Menu Gastronomique' }] as MenuResume[];
    let recu: MenuResume[] | undefined;

    service.lister({ prix_max: 400, theme: 4 }).subscribe((reponse) => (recu = reponse));

    const requete = controleur.expectOne((r) => r.url === '/api/menus');
    expect(requete.request.method).toBe('GET');
    expect(requete.request.params.get('prix_max')).toBe('400');
    expect(requete.request.params.get('theme')).toBe('4');
    expect(requete.request.params.has('regime')).toBe(false);
    requete.flush(menus);

    expect(recu).toEqual(menus);
  });

  it('appelle GET /api/menus sans paramètre quand aucun filtre n’est choisi', () => {
    service.lister().subscribe();
    const requete = controleur.expectOne('/api/menus');
    expect(requete.request.params.keys()).toEqual([]);
    requete.flush([]);
  });

  it('appelle GET /api/menus/filtres pour les options', () => {
    service.optionsFiltres().subscribe();
    controleur.expectOne('/api/menus/filtres').flush({ themes: [], regimes: [] });
  });

  it('appelle GET /api/menus/:id pour le détail', () => {
    service.detail(9).subscribe();
    controleur.expectOne('/api/menus/9').flush({ menu: {}, images: [], plats: [] });
  });

  it('encode un identifiant venu de l’URL', () => {
    service.detail('../admin').subscribe({ error: () => undefined });
    controleur
      .expectOne('/api/menus/..%2Fadmin')
      .flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('transmet l’erreur 404 au composant', () => {
    let statut: number | undefined;
    service.detail(999).subscribe({ error: (erreur) => (statut = erreur.status) });
    controleur
      .expectOne('/api/menus/999')
      .flush({ error: 'Menu non trouvé.' }, { status: 404, statusText: 'Not Found' });
    expect(statut).toBe(404);
  });
});
