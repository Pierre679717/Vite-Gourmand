import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Avis } from '../../core/models/avis';
import { Accueil } from './accueil';

const AVIS: Avis[] = [
  {
    avis_id: 1,
    note: 4,
    commentaire: 'Très bon',
    date_creation: '2026-10-01',
    prenom: 'Camille',
    initiale_nom: 'L.',
    menu: 'Menu Gastronomique',
  },
  {
    avis_id: 2,
    note: 5,
    commentaire: 'Parfait',
    date_creation: '2026-10-02',
    prenom: 'Lucas',
    initiale_nom: 'M.',
    menu: 'Menu Vegan',
  },
];

describe('Accueil (accessibilité des avis)', () => {
  let fixture: ComponentFixture<Accueil>;
  let http: HttpTestingController;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Accueil],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(Accueil);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/menus').flush([]);
    http.expectOne('/api/avis').flush(AVIS);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('la note est lue en texte, sans aria-label sur le paragraphe', () => {
    const notes = [...page.querySelectorAll('.avis .etoiles')];
    expect(notes).toHaveLength(2);
    expect(notes[0].hasAttribute('aria-label')).toBe(false);
    expect(notes[0].querySelector('.visuellement-masque')?.textContent).toBe('Note : 4 sur 5');
    // Les étoiles elles-mêmes sont ignorées par les lecteurs d'écran
    expect(notes[0].querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it('la liste des avis (défilante sur mobile) est focusable et nommée', () => {
    const liste = page.querySelector<HTMLUListElement>('ul[aria-labelledby="titre-avis"]')!;
    expect(liste.getAttribute('tabindex')).toBe('0');
    expect(page.querySelector('#titre-avis')?.textContent).toBe('Avis de nos clients');
  });
});
