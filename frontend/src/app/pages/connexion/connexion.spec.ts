import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Connexion } from './connexion';

describe('Connexion', () => {
  let fixture: ComponentFixture<Connexion>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(entrees: Record<string, string> = {}): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Connexion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(Connexion);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    for (const [nom, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(nom, valeur);
    await rendre();
  }

  const saisir = (id: string, valeur: string) => {
    const champ = page.querySelector<HTMLInputElement>(`#${id}`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('après un changement de mot de passe (?motDePasse=modifie) : message de confirmation', async () => {
    await ouvrir({ motDePasse: 'modifie' });
    expect(page.querySelector('[role="status"]')?.textContent).toContain(
      'Votre mot de passe a été modifié',
    );
  });

  it('sans paramètre : aucun message', async () => {
    await ouvrir();
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('429 (trop de tentatives) : affiche le message du serveur, le bouton redevient utilisable', async () => {
    await ouvrir();
    saisir('email', 'utilisateur@vite-gourmand.fr');
    saisir('mot_de_passe', 'mauvais');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();

    http.expectOne('/api/connexion').flush(
      {
        error:
          'Trop de tentatives de connexion échouées. Réessayez dans 15 minutes ou utilisez « Mot de passe oublié ? ».',
      },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await rendre();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Réessayez dans 15 minutes',
    );
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(page.querySelector('a[href="/mot-de-passe-oublie"]')).not.toBeNull();
  });
});
