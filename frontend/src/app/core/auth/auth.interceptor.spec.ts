import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { SOPHIE, fauxToken } from './token-de-test';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controleur: HttpTestingController;
  const token = fauxToken(SOPHIE);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('vg_token', token);
    TestBed.configureTestingModule({
      providers: [
        // Route factice : la déconnexion redirige vers /connexion
        provideRouter([{ path: 'connexion', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controleur = TestBed.inject(HttpTestingController);
  });

  it("ajoute le JWT aux requêtes vers l'API", () => {
    http.get('/api/commandes').subscribe();
    const requete = controleur.expectOne('/api/commandes');
    expect(requete.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it("n'envoie jamais le JWT vers un site tiers", () => {
    http.get('https://api-adresse.data.gouv.fr/search/?q=Bordeaux').subscribe();
    const requete = controleur.expectOne((r) => r.url.startsWith('https://api-adresse'));
    expect(requete.request.headers.has('Authorization')).toBe(false);
  });

  it("déconnecte l'utilisateur si l'API répond 401", () => {
    http.get('/api/commandes').subscribe({ error: () => undefined });
    controleur
      .expectOne('/api/commandes')
      .flush({ error: 'Token expiré.' }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(AuthService).estConnecte()).toBe(false);
  });
});
