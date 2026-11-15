import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EmployeService } from './employe.service';

describe('EmployeService', () => {
  let service: EmployeService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EmployeService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('liste toutes les commandes sans paramètre', () => {
    service.listerCommandes().subscribe();
    const requete = controleur.expectOne('/api/employe/commandes');
    expect(requete.request.method).toBe('GET');
    expect(requete.request.params.keys()).toEqual([]);
    requete.flush([]);
  });

  it('envoie le statut et la recherche client nettoyée', () => {
    service.listerCommandes({ statut: 'livre', client: '  camille  ' }).subscribe();
    const requete = controleur.expectOne(
      (r) => r.url === '/api/employe/commandes' && r.params.get('statut') === 'livre',
    );
    expect(requete.request.params.get('client')).toBe('camille');
    requete.flush([]);
  });

  it("n'envoie pas une recherche faite seulement d'espaces", () => {
    service.listerCommandes({ client: '   ' }).subscribe();
    const requete = controleur.expectOne('/api/employe/commandes');
    expect(requete.request.params.has('client')).toBe(false);
    requete.flush([]);
  });

  it('lit le détail d’une commande', () => {
    service.detailCommande(13).subscribe();
    const requete = controleur.expectOne('/api/employe/commandes/13');
    expect(requete.request.method).toBe('GET');
    requete.flush({});
  });

  it('fait avancer une commande (PUT avec le seul statut)', () => {
    let reponse: unknown;
    service.changerStatut(13, { statut: 'en_preparation' }).subscribe((r) => (reponse = r));
    const requete = controleur.expectOne('/api/employe/commandes/13');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({ statut: 'en_preparation' });
    requete.flush({ message: 'ok', numero_commande: 'VG-2026-0013', statut: 'en_preparation' });
    expect(reponse).toEqual({
      message: 'ok',
      numero_commande: 'VG-2026-0013',
      statut: 'en_preparation',
    });
  });

  it('annule avec le mode de contact et le motif', () => {
    service
      .changerStatut(14, { statut: 'annulee', mode_contact: 'gsm', motif: 'Client hospitalisé' })
      .subscribe();
    const requete = controleur.expectOne('/api/employe/commandes/14');
    expect(requete.request.body).toEqual({
      statut: 'annulee',
      mode_contact: 'gsm',
      motif: 'Client hospitalisé',
    });
    requete.flush({});
  });

  it('liste les avis, filtrés ou non', () => {
    service.listerAvis('en_attente').subscribe();
    const filtree = controleur.expectOne((r) => r.url === '/api/employe/avis');
    expect(filtree.request.params.get('statut')).toBe('en_attente');
    filtree.flush([]);

    service.listerAvis().subscribe();
    const tous = controleur.expectOne((r) => r.url === '/api/employe/avis');
    expect(tous.request.params.keys()).toEqual([]);
    tous.flush([]);
  });

  it('valide ou refuse un avis', () => {
    service.modererAvis(5, 'valide').subscribe();
    const requete = controleur.expectOne('/api/employe/avis/5');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({ statut: 'valide' });
    requete.flush({ message: 'ok', avis_id: 5, statut: 'valide' });
  });
});
