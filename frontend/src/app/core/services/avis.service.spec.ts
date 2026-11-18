import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Avis } from '../models/avis';
import { AvisService } from './avis.service';

describe('AvisService', () => {
  let service: AvisService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AvisService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('appelle GET /api/avis et renvoie les avis validés', () => {
    const avis = [{ avis_id: 1, note: 5, prenom: 'Sophie' }] as Avis[];
    let recu: Avis[] | undefined;

    service.listerValides().subscribe((reponse) => (recu = reponse));

    const requete = controleur.expectOne('/api/avis');
    expect(requete.request.method).toBe('GET');
    requete.flush(avis);
    expect(recu).toEqual(avis);
  });

  it('donne un avis par POST /api/avis et renvoie l’avis créé (en attente)', () => {
    let recu: { statut: string } | undefined;

    service
      .creer({ commande_id: 3, note: 5, commentaire: 'Parfait' })
      .subscribe((avis) => (recu = avis));

    const requete = controleur.expectOne('/api/avis');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ commande_id: 3, note: 5, commentaire: 'Parfait' });
    requete.flush(
      {
        message: 'Merci !',
        avis: { note: 5, commentaire: 'Parfait', statut: 'en_attente' },
      },
      { status: 201, statusText: 'Created' },
    );
    expect(recu).toEqual({ note: 5, commentaire: 'Parfait', statut: 'en_attente' });
  });
});
