import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SOPHIE, fauxToken } from '../../core/auth/token-de-test';
import { Contact } from './contact';

describe('Contact', () => {
  let fixture: ComponentFixture<Contact>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(connecte = false): Promise<void> {
    if (connecte) localStorage.setItem('vg_token', fauxToken(SOPHIE));
    TestBed.configureTestingModule({
      imports: [Contact],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(Contact);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    await rendre();
  }

  const champ = (id: string) =>
    page.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
  const saisir = (id: string, valeur: string) => {
    champ(id).value = valeur;
    champ(id).dispatchEvent(new Event('input'));
  };
  const envoyer = async () => {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();
  };
  const remplir = () => {
    saisir('titre', '  Mariage le 20 juin ');
    saisir('description', 'Bonjour,\nun menu pour 80 personnes est-il possible ?');
    saisir('email', 'Camille@Exemple.fr');
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('propose les trois champs du sujet : titre, message (description), e-mail', async () => {
    await ouvrir();
    expect(champ('titre')).not.toBeNull();
    expect(champ('description').tagName).toBe('TEXTAREA');
    expect(champ('email').value).toBe('');
  });

  it('pré-remplit l’e-mail du visiteur connecté', async () => {
    await ouvrir(true);
    expect(champ('email').value).toBe('sophie@example.com');
  });

  it('formulaire vide : erreurs affichées, aucune requête', async () => {
    await ouvrir();
    await envoyer();
    expect(page.textContent).toContain('Indiquez l’objet de votre message.');
    expect(page.textContent).toContain('Écrivez votre message.');
    expect(champ('titre').getAttribute('aria-invalid')).toBe('true');
  });

  it('envoie le message nettoyé par POST /api/contact puis confirme et vide le formulaire', async () => {
    await ouvrir();
    remplir();
    await envoyer();

    const requete = http.expectOne('/api/contact');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({
      titre: 'Mariage le 20 juin',
      description: 'Bonjour,\nun menu pour 80 personnes est-il possible ?',
      email: 'camille@exemple.fr',
    });
    requete.flush({ message: 'Message envoyé.' }, { status: 201, statusText: 'Created' });
    await rendre();

    expect(page.querySelector('.alerte--succes')!.textContent).toContain('bien été envoyé');
    expect(champ('titre').value).toBe('');
    expect(champ('description').value).toBe('');
    expect(champ('email').value).toBe('camille@exemple.fr');
  });

  it('envoi impossible (503) : le visiteur est prévenu, son message reste saisi', async () => {
    await ouvrir();
    remplir();
    await envoyer();

    http.expectOne('/api/contact').flush(
      {
        error:
          'Votre message n’a pas pu être envoyé. Réessayez dans quelques minutes ou appelez-nous.',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await rendre();

    expect(page.querySelector('[role="alert"]')!.textContent).toContain('appelez-nous');
    expect(champ('description').value).toContain('80 personnes');
  });
});
