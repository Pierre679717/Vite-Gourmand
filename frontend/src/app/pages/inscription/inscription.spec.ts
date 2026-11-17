import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Inscription } from './inscription';

describe('Inscription (erreurs accessibles, RGAA 11.10)', () => {
  let fixture: ComponentFixture<Inscription>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const saisir = (id: string, valeur: string) => {
    const champ = page.querySelector<HTMLInputElement>(`#${id}`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
  };

  const envoyer = async () => {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rendre();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Inscription],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(Inscription);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    await rendre();
  });

  afterEach(() => http.verify());

  it('avant tout envoi : aucun champ marqué invalide', () => {
    expect(page.querySelector('#prenom')!.getAttribute('aria-invalid')).toBe('false');
    expect(page.querySelector('#prenom')!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('envoi vide : chaque champ est marqué invalide et relié à son message', async () => {
    await envoyer();

    for (const id of ['prenom', 'nom', 'email', 'adresse_postale', 'code_postal', 'ville']) {
      const champ = page.querySelector(`#${id}`)!;
      expect(champ.getAttribute('aria-invalid')).toBe('true');
      expect(champ.getAttribute('aria-describedby')).toBe(`${id}-erreur`);
      expect(page.querySelector(`#${id}-erreur`)?.textContent?.trim()).not.toBe('');
    }
    // L'aide reste lue, suivie du message d'erreur
    expect(page.querySelector('#telephone')!.getAttribute('aria-describedby')).toBe(
      'telephone-aide telephone-erreur',
    );
    expect(page.querySelector('#mot_de_passe')!.getAttribute('aria-describedby')).toBe(
      'criteres-mot-de-passe mot_de_passe-erreur',
    );
  });

  it('envoi vide : le focus va sur le premier champ (Prénom)', async () => {
    await envoyer();
    expect(document.activeElement).toBe(page.querySelector('#prenom'));
  });

  it('seuls les mots de passe diffèrent : focus et message sur la confirmation', async () => {
    saisir('prenom', 'Camille');
    saisir('nom', 'Laurent');
    saisir('email', 'camille@example.com');
    saisir('telephone', '0612345678');
    saisir('adresse_postale', '12 rue Sainte-Catherine');
    saisir('code_postal', '33000');
    saisir('ville', 'Bordeaux');
    saisir('mot_de_passe', 'Essai#Gourmand26');
    saisir('confirmation', 'Essai#Gourmand27');
    await envoyer();

    const confirmation = page.querySelector('#confirmation')!;
    expect(confirmation.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#confirmation-erreur')?.textContent).toContain('pas identiques');
    expect(document.activeElement).toBe(confirmation);
    http.expectNone('/api/inscription');
  });
});
