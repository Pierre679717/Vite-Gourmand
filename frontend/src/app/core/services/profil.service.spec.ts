import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Profil } from '../models/utilisateur';
import { ProfilService } from './profil.service';

describe('ProfilService', () => {
  it('lit GET /api/profil et renvoie l’utilisateur avec téléphone et adresse', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ProfilService);
    const controleur = TestBed.inject(HttpTestingController);
    const camille: Profil = {
      id: 3,
      nom: 'Laurent',
      prenom: 'Camille',
      email: 'utilisateur@vite-gourmand.fr',
      role: 'utilisateur',
      telephone: '0698765432',
      adresse_postale: '7 cours de l’Intendance',
      code_postal: '33000',
      ville: 'Bordeaux',
    };
    let recu: Profil | undefined;

    service.lire().subscribe((profil) => (recu = profil));
    const requete = controleur.expectOne('/api/profil');
    expect(requete.request.method).toBe('GET');
    requete.flush({ user: camille });

    expect(recu).toEqual(camille);
    controleur.verify();
  });
});
