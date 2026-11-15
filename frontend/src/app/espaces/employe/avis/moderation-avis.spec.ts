import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { AvisModeration } from '../../../core/models/employe';
import { ModerationAvis } from './moderation-avis';

/** Avis 5/5 de Camille sur VG-2026-0013, envoyé le 14/11 */
function avis(modifs: Partial<AvisModeration> = {}): AvisModeration {
  return {
    avis_id: 5,
    note: 5,
    commentaire: 'Parfait, merci !',
    statut: 'en_attente',
    date_creation: '2026-11-14 22:52:00',
    commande_id: 13,
    numero_commande: 'VG-2026-0013',
    menu: 'Menu Traditionnel',
    prenom: 'Camille',
    nom: 'Martin',
    email: 'utilisateur@vite-gourmand.fr',
    ...modifs,
  };
}

describe('ModerationAvis', () => {
  let fixture: ComponentFixture<ModerationAvis>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const requeteListe = () => http.expectOne((r) => r.url === '/api/employe/avis');
  const bouton = (texte: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texte),
    );

  beforeEach(async () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [ModerationAvis],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ModerationAvis);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('montre par défaut les avis à modérer, avec Valider et Refuser', async () => {
    const requete = requeteListe();
    expect(requete.request.params.get('statut')).toBe('en_attente');
    requete.flush([avis()]);
    await rendre();

    expect(page.querySelector('.avis-moderation')?.textContent).toContain('Parfait, merci !');
    expect(page.textContent).toContain('VG-2026-0013');
    expect(bouton('Valider')?.getAttribute('aria-label')).toBe('Valider l’avis de Camille Martin');
    expect(bouton('Refuser')).toBeTruthy();
  });

  it('valider : PUT, message, liste relue', async () => {
    requeteListe().flush([avis()]);
    await rendre();

    bouton('Valider')!.click();
    const requete = http.expectOne('/api/employe/avis/5');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({ statut: 'valide' });
    requete.flush({
      message: "Avis validé : il est visible sur l'accueil.",
      avis_id: 5,
      statut: 'valide',
    });
    await rendre();

    requeteListe().flush([]);
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain('visible sur l');
    expect(page.textContent).toContain('Aucun avis à modérer');
  });

  it('un avis publié ne propose que « Refuser »', async () => {
    requeteListe().flush([avis({ statut: 'valide' })]);
    await rendre();
    expect(bouton('Valider')).toBeUndefined();
    expect(bouton('Refuser')).toBeTruthy();
  });

  it('le filtre « Tous » ne transmet pas de statut', async () => {
    requeteListe().flush([]);
    await rendre();

    page.querySelector<HTMLInputElement>('#filtre-tous')!.click();
    await rendre();
    const requete = requeteListe();
    expect(requete.request.params.has('statut')).toBe(false);
    requete.flush([avis({ statut: 'refuse' })]);
    await rendre();
    expect(page.textContent).toContain('Refusé');
  });

  it('erreur lors de la décision : message affiché', async () => {
    requeteListe().flush([avis()]);
    await rendre();
    bouton('Refuser')!.click();
    http
      .expectOne('/api/employe/avis/5')
      .flush({ error: 'Avis introuvable.' }, { status: 404, statusText: 'Introuvable' });
    await rendre();
    requeteListe().flush([]);
    await rendre();
    expect(page.querySelector('.alerte--erreur')?.textContent).toContain('Avis introuvable.');
  });
});
