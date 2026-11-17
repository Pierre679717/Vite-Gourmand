import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NouveauMotDePasse } from './nouveau-mot-de-passe';

const JETON = 'b'.repeat(64);
const VERIFIER = '/api/reinitialiser-mot-de-passe/verifier';
const REINITIALISER = '/api/reinitialiser-mot-de-passe';

describe('NouveauMotDePasse', () => {
  let fixture: ComponentFixture<NouveauMotDePasse>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(token?: string): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NouveauMotDePasse],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(NouveauMotDePasse);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    if (token !== undefined) fixture.componentRef.setInput('token', token);
    await rendre();
  }

  /** Ouvre la page avec un lien que le serveur déclare valable */
  async function ouvrirLienValable(): Promise<void> {
    await ouvrir(JETON);
    http.expectOne(VERIFIER).flush({ valide: true });
    await rendre();
  }

  const champ = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  const saisir = (id: string, valeur: string) => {
    champ(id).value = valeur;
    champ(id).dispatchEvent(new Event('input'));
    champ(id).dispatchEvent(new Event('blur'));
  };
  const envoyer = async () => {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();
  };
  const criteresRespectes = () => page.querySelectorAll('.criteres__item--ok').length;

  afterEach(() => http.verify());

  it('sans jeton dans l’adresse : lien invalide, aucune requête, nouvelle demande proposée', async () => {
    await ouvrir();
    http.expectNone(VERIFIER);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain("n'est pas valide");
    expect(page.querySelector('a[href="/mot-de-passe-oublie"]')).not.toBeNull();
    expect(page.querySelector('form')).toBeNull();
  });

  it('vérifie le lien dès l’ouverture puis affiche le formulaire', async () => {
    await ouvrir(JETON);
    expect(page.textContent).toContain('Vérification du lien');
    const requete = http.expectOne(VERIFIER);
    expect(requete.request.body).toEqual({ token: JETON });
    requete.flush({ valide: true });
    await rendre();

    expect(page.querySelector('form')).not.toBeNull();
    expect(champ('mot_de_passe').getAttribute('autocomplete')).toBe('new-password');
  });

  it('lien expiré à l’ouverture : message du serveur, pas de formulaire', async () => {
    await ouvrir(JETON);
    http
      .expectOne(VERIFIER)
      .flush(
        { code: 'LIEN_EXPIRE', error: 'Ce lien a expiré (il est valable 30 minutes).' },
        { status: 400, statusText: 'Bad Request' },
      );
    await rendre();

    const alerte = page.querySelector('[role="alert"]')!.textContent!;
    expect(alerte).toContain('Ce lien a expiré');
    expect(alerte).toContain('valable 30 minutes');
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('a[href="/mot-de-passe-oublie"]')?.textContent).toContain(
      'nouvelle demande',
    );
  });

  it('coche les critères à chaque frappe, comme à l’inscription', async () => {
    await ouvrirLienValable();
    expect(page.querySelector('.criteres--neutre')).not.toBeNull();

    saisir('mot_de_passe', 'abc');
    await rendre();
    expect(page.querySelector('.criteres--neutre')).toBeNull();
    expect(criteresRespectes()).toBe(1); // minuscule

    saisir('mot_de_passe', 'Nouveau#Gourmand26');
    await rendre();
    expect(criteresRespectes()).toBe(5);
  });

  it('confirmation différente : message, aucune requête', async () => {
    await ouvrirLienValable();
    saisir('mot_de_passe', 'Nouveau#Gourmand26');
    saisir('confirmation', 'Nouveau#Gourmand27');
    await envoyer();

    expect(page.textContent).toContain('ne sont pas identiques');
    http.expectNone(REINITIALISER);
  });

  it('succès : envoie jeton + mot de passe, puis retour à la connexion (adresse remplacée)', async () => {
    await ouvrirLienValable();
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    saisir('mot_de_passe', 'Nouveau#Gourmand26');
    saisir('confirmation', 'Nouveau#Gourmand26');
    await envoyer();

    const requete = http.expectOne(REINITIALISER);
    expect(requete.request.body).toEqual({ token: JETON, mot_de_passe: 'Nouveau#Gourmand26' });
    expect(page.querySelector('button[type="submit"]')?.textContent).toContain('Enregistrement');
    requete.flush({ message: 'Votre mot de passe a été modifié.' });
    await rendre();

    expect(navigation).toHaveBeenCalledWith(['/connexion'], {
      queryParams: { motDePasse: 'modifie' },
      replaceUrl: true,
    });
  });

  it('lien utilisé entre-temps (autre onglet) : message « déjà utilisé »', async () => {
    await ouvrirLienValable();
    saisir('mot_de_passe', 'Nouveau#Gourmand26');
    saisir('confirmation', 'Nouveau#Gourmand26');
    await envoyer();
    http
      .expectOne(REINITIALISER)
      .flush(
        { code: 'LIEN_UTILISE', error: 'Ce lien a déjà été utilisé.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await rendre();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('déjà été utilisé');
    expect(page.querySelector('form')).toBeNull();
  });

  it('mot de passe refusé par le serveur : liste des erreurs, formulaire conservé', async () => {
    await ouvrirLienValable();
    saisir('mot_de_passe', 'Nouveau#Gourmand26');
    saisir('confirmation', 'Nouveau#Gourmand26');
    await envoyer();
    http
      .expectOne(REINITIALISER)
      .flush(
        { error: 'Règle A', erreurs: ['Règle A', 'Règle B'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await rendre();

    expect(page.querySelectorAll('.liste-erreurs li').length).toBe(2);
    expect(page.querySelector('form')).not.toBeNull();
  });

  it('serveur injoignable à la vérification : bouton Réessayer qui relance la vérification', async () => {
    await ouvrir(JETON);
    http.expectOne(VERIFIER).error(new ProgressEvent('error'), { status: 0 });
    await rendre();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('injoignable');
    const reessayer = [...page.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer'),
    )!;
    reessayer.click();
    await rendre();
    http.expectOne(VERIFIER).flush({ valide: true });
    await rendre();
    expect(page.querySelector('form')).not.toBeNull();
  });
});
