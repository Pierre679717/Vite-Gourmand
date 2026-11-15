import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { Horaire } from '../../../core/models/catalogue';
import { HorairesGestion } from './horaires-gestion';

const semaine: Horaire[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
].map((jour) => ({
  jour: jour as Horaire['jour'],
  heure_ouverture: jour === 'dimanche' ? null : '09:00',
  heure_fermeture: jour === 'dimanche' ? null : '19:00',
}));

describe('HorairesGestion', () => {
  let fixture: ComponentFixture<HorairesGestion>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const envoyer = () => page.querySelector('form')!.dispatchEvent(new Event('submit'));

  beforeEach(async () => {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [HorairesGestion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HorairesGestion);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne('/api/horaires').flush(semaine);
    await rendre();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('7 jours, dimanche fermé sans champs d’heure', () => {
    expect(page.querySelectorAll('fieldset').length).toBe(7);
    expect(page.querySelector('#ouverture-lundi')).toBeTruthy();
    expect(page.querySelector('#ouverture-dimanche')).toBeNull();
    expect(page.textContent).toContain('Fermé ce jour-là');
  });

  it('fermeture avant l’ouverture : erreur sous le jour, aucune requête', async () => {
    const fermeture = page.querySelector<HTMLInputElement>('#fermeture-lundi')!;
    fermeture.value = '08:00';
    fermeture.dispatchEvent(new Event('input'));
    envoyer();
    await rendre();
    http.expectNone('/api/employe/horaires');
    expect(page.querySelector('#erreur-lundi')?.textContent).toContain('après l’ouverture');
  });

  it('fermer le samedi : PUT de la semaine avec heures à null, message', async () => {
    const cases = page.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    cases[5].click();
    await rendre();
    expect(page.querySelector('#ouverture-samedi')).toBeNull();
    envoyer();
    const requete = http.expectOne({ method: 'PUT', url: '/api/employe/horaires' });
    const corps = requete.request.body.horaires as Horaire[];
    expect(corps).toHaveLength(7);
    expect(corps[5]).toEqual({ jour: 'samedi', heure_ouverture: null, heure_fermeture: null });
    expect(corps[0]).toEqual({ jour: 'lundi', heure_ouverture: '09:00', heure_fermeture: '19:00' });
    requete.flush({ message: 'Horaires enregistrés : le pied de page est à jour.' });
    await rendre();
    expect(page.querySelector('.alerte--succes')?.textContent).toContain('Horaires enregistrés');
  });
});
