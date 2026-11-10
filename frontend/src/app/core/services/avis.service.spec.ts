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
});
