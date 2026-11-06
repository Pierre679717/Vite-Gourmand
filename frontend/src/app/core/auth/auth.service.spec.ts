import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { HELENE_EMPLOYEE, SOPHIE, fauxToken } from './token-de-test';

describe('AuthService', () => {
  function creerService(): { auth: AuthService; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
  }

  beforeEach(() => localStorage.clear());

  it("n'a pas d'utilisateur au départ", () => {
    const { auth } = creerService();
    expect(auth.estConnecte()).toBe(false);
    expect(auth.utilisateur()).toBeNull();
  });

  it('stocke le token et expose l’utilisateur après la connexion', () => {
    const { auth, http } = creerService();
    const token = fauxToken(SOPHIE);

    auth.connexion('sophie@example.com', 'Client#Gourmand2026').subscribe();
    const requete = http.expectOne('/api/connexion');
    expect(requete.request.body).toEqual({
      email: 'sophie@example.com',
      mot_de_passe: 'Client#Gourmand2026',
    });
    requete.flush({ message: 'Connexion réussie', token, user: SOPHIE });

    expect(localStorage.getItem('vg_token')).toBe(token);
    expect(auth.utilisateur()).toEqual(SOPHIE);
    expect(auth.lienEspace()).toBe('/espace-utilisateur');
  });

  it('lit correctement les accents du prénom dans le token', () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    const { auth } = creerService();
    expect(auth.utilisateur()?.prenom).toBe('Hélène');
    expect(auth.lienEspace()).toBe('/espace-employe');
  });

  it('ignore et supprime un token expiré au démarrage', () => {
    localStorage.setItem('vg_token', fauxToken(SOPHIE, -60));
    const { auth } = creerService();
    expect(auth.estConnecte()).toBe(false);
    expect(localStorage.getItem('vg_token')).toBeNull();
  });

  it('oublie le token à la déconnexion', () => {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    const { auth } = creerService();
    auth.deconnexion();
    expect(auth.estConnecte()).toBe(false);
    expect(localStorage.getItem('vg_token')).toBeNull();
  });
});
