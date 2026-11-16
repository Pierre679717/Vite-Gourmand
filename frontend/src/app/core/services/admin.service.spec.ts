import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('liste les employés', () => {
    let employes: unknown;
    service.listerEmployes().subscribe((r) => (employes = r));
    const requete = controleur.expectOne('/api/admin/employes');
    expect(requete.request.method).toBe('GET');
    requete.flush([
      { utilisateur_id: 2, nom: 'Girard', prenom: 'Thomas', email: 'e@vg.fr', actif: 1 },
    ]);
    expect(employes).toHaveLength(1);
  });

  it('crée un employé avec les 4 champs, sans rôle', () => {
    const donnees = {
      nom: 'Durand',
      prenom: 'Léa',
      email: 'lea@vite-gourmand.fr',
      mot_de_passe: 'Cuisine#Bordeaux26',
    };
    service.creerEmploye(donnees).subscribe();
    const requete = controleur.expectOne('/api/admin/employes');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual(donnees);
    expect(requete.request.body).not.toHaveProperty('role');
    requete.flush({ message: 'ok', employe: {} });
  });

  it('désactive puis réactive un compte (PUT avec un booléen)', () => {
    service.changerActif(7, false).subscribe();
    const desactivation = controleur.expectOne('/api/admin/employes/7/actif');
    expect(desactivation.request.method).toBe('PUT');
    expect(desactivation.request.body).toEqual({ actif: false });
    desactivation.flush({});

    service.changerActif(7, true).subscribe();
    expect(controleur.expectOne('/api/admin/employes/7/actif').request.body).toEqual({
      actif: true,
    });
  });

  it('statistiques sans filtre : aucun paramètre', () => {
    service.statistiques().subscribe();
    const requete = controleur.expectOne('/api/admin/statistiques');
    expect(requete.request.params.keys()).toEqual([]);
    requete.flush({});
  });

  it('statistiques filtrées : menu et période dans l’adresse', () => {
    service.statistiques({ menu_id: 2, debut: '2026-10-01', fin: '2026-10-31' }).subscribe();
    const requete = controleur.expectOne((r) => r.url === '/api/admin/statistiques');
    expect(requete.request.params.get('menu_id')).toBe('2');
    expect(requete.request.params.get('debut')).toBe('2026-10-01');
    expect(requete.request.params.get('fin')).toBe('2026-10-31');
    requete.flush({});
  });

  it('une borne de période vide n’est pas envoyée', () => {
    service.statistiques({ debut: '2026-10-01', fin: '' }).subscribe();
    const requete = controleur.expectOne((r) => r.url === '/api/admin/statistiques');
    expect(requete.request.params.keys()).toEqual(['debut']);
    requete.flush({});
  });
});
