import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SOPHIE, fauxToken } from '../../../core/auth/token-de-test';
import { MENU_GASTRO } from '../../../core/models/menus-de-test';
import { Commande } from './commande';

registerLocaleData(localeFr);

/**
 * Tests du composant : le parcours vu par le client, avec une API simulée.
 * Les règles elles-mêmes sont testées dans commande-logique.spec.ts.
 */
describe('Commande (formulaire en étapes)', () => {
  let fixture: ComponentFixture<Commande>;
  let http: HttpTestingController;
  let page: HTMLElement;

  const PROFIL = {
    ...SOPHIE,
    telephone: '0612345678',
    adresse_postale: '7 cours de l’Intendance',
    code_postal: '33000',
    ville: 'Bordeaux',
  };

  /** Ouvre /commander/1?personnes=… et répond au chargement du menu et du profil */
  async function ouvrir(personnes?: string): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    TestBed.configureTestingModule({
      imports: [Commande],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    fixture = TestBed.createComponent(Commande);
    fixture.componentRef.setInput('menuId', '1');
    if (personnes) {
      fixture.componentRef.setInput('personnes', personnes);
    }
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/menus/1').flush({ menu: MENU_GASTRO, images: [], plats: [] });
    http.expectOne('/api/profil').flush({ user: PROFIL });
    await fixture.whenStable();
  }

  const champ = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  const cliquer = async (texte: string) => {
    const bouton = [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(texte),
    )!;
    bouton.click();
    await fixture.whenStable();
  };
  const saisir = (id: string, valeur: string) => {
    champ(id).value = valeur;
    champ(id).dispatchEvent(new Event('input'));
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('pré-remplit l’étape 1 avec le compte', async () => {
    await ouvrir();
    expect(champ('prenom').value).toBe('Sophie');
    expect(champ('nom').value).toBe('Martin');
    expect(champ('email').value).toBe('sophie@example.com');
    expect(champ('telephone').value).toBe('0612345678');
  });

  it('reste sur l’étape 1 et affiche l’erreur si le téléphone est invalide', async () => {
    await ouvrir();
    saisir('telephone', '06 12');
    await cliquer('Continuer');

    expect(page.querySelector('#telephone')).not.toBeNull();
    expect(page.textContent).toContain('Numéro invalide');
  });

  it('va jusqu’au récapitulatif et affiche le devis du serveur', async () => {
    await ouvrir('11');
    await cliquer('Continuer');

    // Étape 2 : adresse pré-remplie, date et heure à saisir
    expect(champ('adresse').value).toBe('7 cours de l’Intendance');
    saisir('date', '2099-12-05');
    saisir('heure', '12:30');
    await cliquer('Continuer');

    // Étape 3 : ?personnes=11 repris de l'URL
    expect(champ('personnes').value).toBe('11');
    expect(page.textContent).toContain('Réduction de 10 % appliquée.');
    await cliquer('Continuer');

    const requete = http.expectOne('/api/commandes/devis');
    expect(requete.request.body).toEqual({
      menu_id: 1,
      nombre_personne: 11,
      adresse_prestation: '7 cours de l’Intendance',
      ville_prestation: 'Bordeaux',
    });
    requete.flush({
      menu: {
        menu_id: 1,
        titre: 'Menu Gastronomique',
        nombre_personne_min: 6,
        delai_minimum_jours: 7,
      },
      nombre_personne: 11,
      personnes_pour_reduction: 11,
      livraison: {
        adresse_trouvee: '7 Cours de l’Intendance 33000 Bordeaux',
        ville: 'Bordeaux',
        code_postal: '33000',
        est_bordeaux: true,
      },
      distance_km: 0,
      prix_par_personne: 65,
      reduction: 71.5,
      prix_menu: 643.5,
      prix_livraison: 0,
      prix_total: 643.5,
    });
    await fixture.whenStable();

    expect(page.textContent).toContain('7 Cours de l’Intendance 33000 Bordeaux');
    expect(page.textContent).toContain('Offerte');
    expect(page.querySelector('.prix__total')!.textContent).toContain('643,50');
  });

  it('propose Réessayer quand le service de distance est indisponible (503)', async () => {
    await ouvrir();
    await cliquer('Continuer');
    saisir('date', '2099-12-05');
    saisir('heure', '12:30');
    await cliquer('Continuer');
    await cliquer('Continuer');

    http
      .expectOne('/api/commandes/devis')
      .flush(
        { error: 'Service indisponible.' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await fixture.whenStable();

    expect(page.textContent).toContain('Service indisponible.');
    await cliquer('Réessayer');
    http
      .expectOne('/api/commandes/devis')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
  });
});
