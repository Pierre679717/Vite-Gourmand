import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  PartialMatchRouteSnapshot,
  Route,
  Router,
  UrlSegment,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { roleGuard, visiteurGuard } from './auth.guards';
import { HELENE_EMPLOYEE, SOPHIE, fauxToken } from './token-de-test';

describe('Guards d’authentification', () => {
  const route: Route = {};
  const segments = [new UrlSegment('espace-admin', {})];
  // Le guard n'utilise pas ce 3e paramètre : un objet vide suffit pour le test
  const instantane = {} as PartialMatchRouteSnapshot;

  function executer(guard: ReturnType<typeof roleGuard>): boolean | UrlTree {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    return TestBed.runInInjectionContext(() => guard(route, segments, instantane)) as boolean | UrlTree;
  }

  function url(resultat: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(resultat as UrlTree);
  }

  beforeEach(() => localStorage.clear());

  it('renvoie un visiteur vers la connexion en retenant la page demandée', () => {
    const resultat = executer(roleGuard('administrateur'));
    expect(url(resultat)).toBe('/connexion?retour=%2Fespace-admin');
  });

  it('laisse passer un utilisateur qui a le bon rôle', () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    expect(executer(roleGuard('employe', 'administrateur'))).toBe(true);
  });

  it('renvoie un utilisateur sans le bon rôle vers son propre espace', () => {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    expect(url(executer(roleGuard('administrateur')))).toBe('/espace-utilisateur');
  });

  it('renvoie un utilisateur déjà connecté hors de la page de connexion', () => {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    expect(url(executer(visiteurGuard))).toBe('/espace-utilisateur');
  });
});
