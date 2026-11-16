import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fauxToken } from '../../../core/auth/token-de-test';
import { Employe } from '../../../core/models/admin';
import { Utilisateur } from '../../../core/models/utilisateur';
import { EmployesAdmin } from './employes-admin';

const JOSE: Utilisateur = {
  id: 1,
  nom: 'Martin',
  prenom: 'José',
  email: 'admin@vite-gourmand.fr',
  role: 'administrateur',
};

const employe = (modifs: Partial<Employe> = {}): Employe => ({
  utilisateur_id: 2,
  nom: 'Girard',
  prenom: 'Thomas',
  email: 'employe@vite-gourmand.fr',
  actif: 1,
  ...modifs,
});

describe('EmployesAdmin', () => {
  let fixture: ComponentFixture<EmployesAdmin>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const champ = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  function saisir(id: string, valeur: string): void {
    const input = champ(id);
    input.value = valeur;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }
  const bouton = (nom: string) =>
    page.querySelector<HTMLButtonElement>(`button[aria-label="${nom}"]`);
  const soumettre = () =>
    page.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

  beforeEach(async () => {
    localStorage.setItem('vg_token', fauxToken(JOSE));
    TestBed.configureTestingModule({
      imports: [EmployesAdmin],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(EmployesAdmin);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne('/api/admin/employes')
      .flush([
        employe(),
        employe({
          utilisateur_id: 6,
          prenom: 'Julie',
          nom: 'Petit',
          email: 'julie@vg.fr',
          actif: 0,
        }),
      ]);
    await rendre();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('liste les comptes, actifs et désactivés', () => {
    const cartes = page.querySelectorAll('.element');
    expect(cartes.length).toBe(2);
    expect(cartes[0].textContent).toContain('Actif');
    expect(cartes[1].textContent).toContain('Désactivé');
    expect(page.textContent).toContain('2 comptes employés, dont 1 désactivé.');
  });

  it('le formulaire n’a aucun champ « rôle »', () => {
    expect(page.querySelector('[formcontrolname="role"], #role, select')).toBeNull();
  });

  it('formulaire vide : erreurs sous les champs, aucune requête', async () => {
    soumettre();
    await rendre();
    expect(page.querySelectorAll('.champ__erreur').length).toBe(4);
    expect(champ('prenom').getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/api/admin/employes');
  });

  it('mot de passe trop faible refusé côté front', async () => {
    saisir('prenom', 'Léa');
    saisir('nom', 'Durand');
    saisir('email', 'lea@vite-gourmand.fr');
    saisir('mot_de_passe', 'motdepasse');
    soumettre();
    await rendre();
    expect(page.querySelector('#mot-de-passe-erreur')?.textContent).toContain('ne respecte pas');
    http.expectNone('/api/admin/employes');
  });

  it('création : POST nettoyé, message, formulaire vidé, liste relue', async () => {
    saisir('prenom', ' Léa ');
    saisir('nom', 'Durand');
    saisir('email', ' Lea@Vite-Gourmand.fr');
    saisir('mot_de_passe', 'Cuisine#Bordeaux26');
    soumettre();
    const requete = http.expectOne((r) => r.method === 'POST' && r.url === '/api/admin/employes');
    expect(requete.request.body).toEqual({
      prenom: 'Léa',
      nom: 'Durand',
      email: 'lea@vite-gourmand.fr',
      mot_de_passe: 'Cuisine#Bordeaux26',
    });
    requete.flush({
      message: 'Compte de Léa Durand créé. Un mail lui a été envoyé, sans le mot de passe.',
      employe: employe({ utilisateur_id: 9, prenom: 'Léa', nom: 'Durand' }),
    });
    await rendre();
    http.expectOne((r) => r.method === 'GET' && r.url === '/api/admin/employes').flush([]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain(
      'Compte de Léa Durand créé',
    );
    expect(champ('prenom').value).toBe('');
    expect(champ('mot_de_passe').value).toBe('');
  });

  it('e-mail déjà pris : message du serveur affiché', async () => {
    saisir('prenom', 'Léa');
    saisir('nom', 'Durand');
    saisir('email', 'employe@vite-gourmand.fr');
    saisir('mot_de_passe', 'Cuisine#Bordeaux26');
    soumettre();
    http
      .expectOne('/api/admin/employes')
      .flush(
        { error: 'Cet e-mail est déjà utilisé par un autre compte.' },
        { status: 409, statusText: 'Conflict' },
      );
    await rendre();
    expect(page.querySelector('#erreurs-serveur')?.textContent).toContain('déjà utilisé');
  });

  it('désactiver : confirmation, puis PUT actif false', async () => {
    bouton('Désactiver le compte de Thomas Girard')!.click();
    await rendre();
    expect(page.querySelector('.confirmation')?.textContent).toContain(
      'Désactiver le compte de Thomas Girard ?',
    );
    http.expectNone('/api/admin/employes/2/actif');

    const confirmer = [...page.querySelectorAll<HTMLButtonElement>('.confirmation button')].find(
      (b) => b.textContent?.includes('Confirmer la désactivation'),
    )!;
    confirmer.click();
    const requete = http.expectOne('/api/admin/employes/2/actif');
    expect(requete.request.body).toEqual({ actif: false });
    requete.flush({
      message: 'Le compte de Thomas Girard est désactivé.',
      employe: employe({ actif: 0 }),
    });
    await rendre();
    http.expectOne('/api/admin/employes').flush([employe({ actif: 0 })]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain('est désactivé');
  });

  it('Échap ferme la confirmation sans rien envoyer', async () => {
    bouton('Réactiver le compte de Julie Petit')!.click();
    await rendre();
    page
      .querySelector('.confirmation')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await rendre();
    expect(page.querySelector('.confirmation')).toBeNull();
    http.expectNone('/api/admin/employes/6/actif');
  });
});
