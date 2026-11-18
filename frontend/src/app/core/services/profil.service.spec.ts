import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { fauxToken } from '../auth/token-de-test';
import { DonneesProfil, Profil } from '../models/utilisateur';
import { ProfilService } from './profil.service';

const CAMILLE: Profil = {
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

describe('ProfilService', () => {
  let service: ProfilService;
  let controleur: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfilService);
    controleur = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => controleur.verify());

  it('lit GET /api/profil et renvoie l’utilisateur avec téléphone et adresse', () => {
    let recu: Profil | undefined;

    service.lire().subscribe((profil) => (recu = profil));
    const requete = controleur.expectOne('/api/profil');
    expect(requete.request.method).toBe('GET');
    requete.flush({ user: CAMILLE });

    expect(recu).toEqual(CAMILLE);
  });

  it('modifie par PUT /api/profil puis remplace le token (nouveau prénom affiché)', () => {
    const { id: _id, role: _role, ...donnees } = { ...CAMILLE, prenom: 'Camila' };
    const nouveauToken = fauxToken({
      id: 3,
      nom: 'Laurent',
      prenom: 'Camila',
      email: CAMILLE.email,
      role: 'utilisateur',
    });
    let recu: Profil | undefined;

    service.modifier(donnees as DonneesProfil).subscribe((profil) => (recu = profil));
    const requete = controleur.expectOne('/api/profil');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual(donnees);
    expect('role' in requete.request.body).toBe(false);
    requete.flush({
      message: 'Vos informations ont été mises à jour.',
      user: { ...CAMILLE, prenom: 'Camila' },
      token: nouveauToken,
    });

    expect(recu?.prenom).toBe('Camila');
    expect(localStorage.getItem('vg_token')).toBe(nouveauToken);
    expect(auth.utilisateur()?.prenom).toBe('Camila');
  });

  it('en cas d’erreur (409 e-mail déjà utilisé), le token n’est pas touché', () => {
    const ancien = fauxToken({
      id: 3,
      nom: 'Laurent',
      prenom: 'Camille',
      email: CAMILLE.email,
      role: 'utilisateur',
    });
    auth.remplacerToken(ancien);
    let statut = 0;

    service
      .modifier({} as DonneesProfil)
      .subscribe({ error: (e: HttpErrorResponse) => (statut = e.status) });
    controleur
      .expectOne('/api/profil')
      .flush(
        { error: 'Cet e-mail est déjà utilisé par un autre compte.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(statut).toBe(409);
    expect(localStorage.getItem('vg_token')).toBe(ancien);
  });
});
