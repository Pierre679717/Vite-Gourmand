import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MotDePasseService } from './mot-de-passe.service';

const JETON = 'a'.repeat(64);

describe('MotDePasseService', () => {
  let service: MotDePasseService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MotDePasseService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('demande un lien : POST /api/mot-de-passe-oublie { email }', () => {
    let recu = '';
    service.demanderLien('camille@example.com').subscribe((r) => (recu = r.message));

    const requete = controleur.expectOne('/api/mot-de-passe-oublie');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ email: 'camille@example.com' });
    requete.flush({ message: 'Si un compte actif correspond…' });

    expect(recu).toBe('Si un compte actif correspond…');
  });

  it('transmet le 429 (trop de demandes)', () => {
    let statut = 0;
    service.demanderLien('camille@example.com').subscribe({
      error: (e: HttpErrorResponse) => (statut = e.status),
    });
    controleur
      .expectOne('/api/mot-de-passe-oublie')
      .flush({ error: 'Trop de demandes…' }, { status: 429, statusText: 'Too Many Requests' });

    expect(statut).toBe(429);
  });

  it('vérifie un lien : le jeton part dans le corps, pas dans l’adresse', () => {
    let valide = false;
    service.verifierLien(JETON).subscribe((r) => (valide = r.valide));

    const requete = controleur.expectOne('/api/reinitialiser-mot-de-passe/verifier');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.urlWithParams).not.toContain(JETON);
    expect(requete.request.body).toEqual({ token: JETON });
    requete.flush({ valide: true });

    expect(valide).toBe(true);
  });

  it('réinitialise : POST { token, mot_de_passe } (nom de champ de l’API)', () => {
    let recu = '';
    service.reinitialiser(JETON, 'Nouveau#Gourmand26').subscribe((r) => (recu = r.message));

    const requete = controleur.expectOne('/api/reinitialiser-mot-de-passe');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ token: JETON, mot_de_passe: 'Nouveau#Gourmand26' });
    requete.flush({ message: 'Votre mot de passe a été modifié.' });

    expect(recu).toBe('Votre mot de passe a été modifié.');
  });

  it('transmet le code d’un lien refusé (LIEN_EXPIRE)', () => {
    let code = '';
    service.reinitialiser(JETON, 'Nouveau#Gourmand26').subscribe({
      error: (e: HttpErrorResponse) => (code = e.error.code),
    });
    controleur
      .expectOne('/api/reinitialiser-mot-de-passe')
      .flush(
        { error: 'Ce lien a expiré.', code: 'LIEN_EXPIRE' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(code).toBe('LIEN_EXPIRE');
  });
});
