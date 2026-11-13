import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { fauxToken } from '../../../core/auth/token-de-test';
import { Profil, Utilisateur } from '../../../core/models/utilisateur';
import { MesInformations } from './mes-informations';

const CAMILLE: Utilisateur = {
  id: 3,
  nom: 'Martin',
  prenom: 'Camille',
  email: 'utilisateur@vite-gourmand.fr',
  role: 'utilisateur',
};

const PROFIL: Profil = {
  ...CAMILLE,
  telephone: '0612345678',
  adresse_postale: '12 rue Sainte-Catherine',
  code_postal: '33000',
  ville: 'Bordeaux',
};

describe('MesInformations', () => {
  let fixture: ComponentFixture<MesInformations>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(CAMILLE));
    TestBed.configureTestingModule({
      imports: [MesInformations],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(MesInformations);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/api/profil').flush({ user: PROFIL });
    await rendre();
  }

  const champ = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  const saisir = (id: string, valeur: string) => {
    champ(id).value = valeur;
    champ(id).dispatchEvent(new Event('input'));
  };
  const enregistrer = async () => {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('pré-remplit le formulaire depuis GET /api/profil', async () => {
    await ouvrir();
    expect(champ('prenom').value).toBe('Camille');
    expect(champ('email').value).toBe('utilisateur@vite-gourmand.fr');
    expect(champ('telephone').value).toBe('0612345678');
    expect(champ('code_postal').value).toBe('33000');
  });

  it('affiche les onglets de l’espace', async () => {
    await ouvrir();
    const liens = [...page.querySelectorAll('.espace-nav a')].map((a) => a.textContent!.trim());
    expect(liens).toEqual(['Mes commandes', 'Mes informations']);
  });

  it('champs invalides : erreurs affichées, aucune requête', async () => {
    await ouvrir();
    saisir('email', 'camille@exemple');
    saisir('code_postal', '330');
    await enregistrer();

    expect(page.textContent).toContain('Saisissez une adresse e-mail valide');
    expect(page.textContent).toContain('Le code postal contient 5 chiffres.');
    expect(champ('email').getAttribute('aria-invalid')).toBe('true');
  });

  it('enregistre par PUT /api/profil, puis met à jour le prénom affiché (nouveau token)', async () => {
    await ouvrir();
    const auth = TestBed.inject(AuthService);
    saisir('prenom', '  Camila ');
    saisir('telephone', '06 11 22 33 44');
    await enregistrer();

    const requete = http.expectOne('/api/profil');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({
      prenom: 'Camila',
      nom: 'Martin',
      email: 'utilisateur@vite-gourmand.fr',
      telephone: '0611223344',
      adresse_postale: '12 rue Sainte-Catherine',
      code_postal: '33000',
      ville: 'Bordeaux',
    });
    requete.flush({
      message: 'Vos informations ont été mises à jour.',
      user: { ...PROFIL, prenom: 'Camila', telephone: '0611223344' },
      token: fauxToken({ ...CAMILLE, prenom: 'Camila' }),
    });
    await rendre();

    expect(page.querySelector('.alerte--succes')!.textContent).toContain('mises à jour');
    expect(auth.utilisateur()?.prenom).toBe('Camila');
    expect(champ('telephone').value).toBe('0611223344');
  });

  it('e-mail déjà utilisé (409) : message du serveur affiché', async () => {
    await ouvrir();
    saisir('email', 'employe@vite-gourmand.fr');
    await enregistrer();

    http
      .expectOne('/api/profil')
      .flush(
        { error: 'Cet e-mail est déjà utilisé par un autre compte.' },
        { status: 409, statusText: 'Conflict' },
      );
    await rendre();

    expect(page.querySelector('[role="alert"]')!.textContent).toContain(
      'Cet e-mail est déjà utilisé par un autre compte.',
    );
  });
});
