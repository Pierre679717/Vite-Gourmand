import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DonneesMenu } from '../models/catalogue';
import { CatalogueService } from './catalogue.service';

describe('CatalogueService', () => {
  let service: CatalogueService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const menu: DonneesMenu = {
    titre: 'Menu de Noël',
    description: 'Un repas de fête.',
    conditions: 'Commander 7 jours avant.',
    nombre_personne_min: 6,
    delai_minimum_jours: 7,
    prix_par_personne: 75,
    quantite_restante: 10,
    theme_id: 1,
    regime_id: 1,
    plats: [1, 4],
  };

  it('lit les menus, les options et un menu', () => {
    service.listerMenus().subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/menus' }).flush([]);
    service.optionsMenu().subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/menus/options' }).flush({});
    service.menu(8).subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/menus/8' }).flush({});
  });

  it('crée et modifie un menu avec le corps attendu', () => {
    service.creerMenu(menu).subscribe();
    const creation = http.expectOne({ method: 'POST', url: '/api/employe/menus' });
    expect(creation.request.body).toEqual(menu);
    creation.flush({ message: 'ok', menu_id: 12 });

    service.modifierMenu(8, menu).subscribe();
    expect(http.expectOne({ method: 'PUT', url: '/api/employe/menus/8' }).request.body).toEqual(
      menu,
    );
  });

  it('retire de la carte et supprime', () => {
    service.changerCarte(8, false).subscribe();
    const carte = http.expectOne({ method: 'PUT', url: '/api/employe/menus/8/carte' });
    expect(carte.request.body).toEqual({ actif: false });
    carte.flush({});

    service.supprimerMenu(9).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/employe/menus/9' }).flush({});
  });

  it('gère les plats et les allergènes', () => {
    service.listerAllergenes().subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/allergenes' }).flush([]);
    service.listerPlats().subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/plats' }).flush([]);
    service.plat(7).subscribe();
    http.expectOne({ method: 'GET', url: '/api/employe/plats/7' }).flush({});

    const plat = { titre: 'Bûche glacée', categorie: 'dessert' as const, allergenes: [3] };
    service.creerPlat(plat).subscribe();
    expect(http.expectOne({ method: 'POST', url: '/api/employe/plats' }).request.body).toEqual(
      plat,
    );
    service.modifierPlat(7, plat).subscribe();
    http.expectOne({ method: 'PUT', url: '/api/employe/plats/7' }).flush({});
    service.supprimerPlat(7).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/employe/plats/7' }).flush({});
  });

  it('lit les horaires publics et envoie la semaine', () => {
    service.horaires().subscribe();
    http.expectOne({ method: 'GET', url: '/api/horaires' }).flush([]);

    const semaine = [
      { jour: 'lundi' as const, heure_ouverture: '09:00', heure_fermeture: '19:00' },
    ];
    service.modifierHoraires(semaine).subscribe();
    const requete = http.expectOne({ method: 'PUT', url: '/api/employe/horaires' });
    expect(requete.request.body).toEqual({ horaires: semaine });
    requete.flush({});
  });
});
