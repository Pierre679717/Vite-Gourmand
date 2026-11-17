import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MotDePasseOublie } from './mot-de-passe-oublie';

const MESSAGE_NEUTRE =
  'Si un compte actif correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d’être envoyé.';

describe('MotDePasseOublie', () => {
  let fixture: ComponentFixture<MotDePasseOublie>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MotDePasseOublie],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(MotDePasseOublie);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    await rendre();
  });

  afterEach(() => http.verify());

  const champ = () => page.querySelector<HTMLInputElement>('#email')!;
  const saisir = (valeur: string) => {
    champ().value = valeur;
    champ().dispatchEvent(new Event('input'));
  };
  const envoyer = async () => {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();
  };

  it('e-mail invalide : message sous le champ, aucune requête', async () => {
    saisir('camille.example.com');
    await envoyer();

    expect(page.querySelector('#email-erreur')?.textContent).toContain("n'est pas valide");
    http.expectNone('/api/mot-de-passe-oublie');
  });

  it('envoie l’e-mail nettoyé puis affiche le message neutre du serveur et les deux boutons', async () => {
    saisir('  camille@example.com ');
    await envoyer();

    const requete = http.expectOne('/api/mot-de-passe-oublie');
    expect(requete.request.body).toEqual({ email: 'camille@example.com' });
    expect(page.querySelector('button[type="submit"]')?.textContent).toContain('Envoi en cours');
    requete.flush({ message: MESSAGE_NEUTRE });
    await rendre();

    expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe(MESSAGE_NEUTRE);
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('a[href="/connexion"]')?.textContent).toContain(
      'Retour à la connexion',
    );
    expect(page.textContent).toContain('Faire une nouvelle demande');
  });

  it('« Faire une nouvelle demande » ré-affiche le formulaire avec l’e-mail saisi', async () => {
    saisir('camille@example.com');
    await envoyer();
    http.expectOne('/api/mot-de-passe-oublie').flush({ message: MESSAGE_NEUTRE });
    await rendre();

    const bouton = [...page.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('nouvelle demande'),
    )!;
    bouton.click();
    await rendre();

    expect(champ().value).toBe('camille@example.com');
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('429 : affiche le message du serveur dans une alerte, le formulaire reste disponible', async () => {
    saisir('camille@example.com');
    await envoyer();
    http
      .expectOne('/api/mot-de-passe-oublie')
      .flush(
        {
          error:
            'Trop de demandes de réinitialisation depuis cette connexion. Réessayez dans une heure.',
        },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await rendre();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Réessayez dans une heure');
    expect(page.querySelector('form')).not.toBeNull();
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
});
