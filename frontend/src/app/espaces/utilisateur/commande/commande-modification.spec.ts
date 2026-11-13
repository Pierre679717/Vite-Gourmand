import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SOPHIE, fauxToken } from '../../../core/auth/token-de-test';
import { CommandeDetaillee } from '../../../core/models/commande';
import { MENU_GASTRO } from '../../../core/models/menus-de-test';
import { Commande } from './commande';

registerLocaleData(localeFr);

/** Commande « en attente » sur le menu de test (id 1), livraison en 2099 */
function commande(modifs: Partial<CommandeDetaillee> = {}): CommandeDetaillee {
  return {
    commande_id: 14,
    numero_commande: 'VG-2026-0014',
    date_commande: '2026-11-12 15:47:20',
    statut: 'en_attente',
    menu: { menu_id: 1, titre: MENU_GASTRO.titre, nombre_personne_min: 6, delai_minimum_jours: 7 },
    nombre_personne: 11,
    date_prestation: '2099-12-05',
    heure_livraison: '12:30',
    adresse_prestation: '7 cours de l’Intendance',
    ville_prestation: 'Bordeaux',
    pret_materiel: true,
    materiel_restitue: false,
    contact_nom: 'Laurent',
    contact_prenom: 'Camille',
    contact_email: 'utilisateur@vite-gourmand.fr',
    contact_telephone: '0698765432',
    distance_km: 0,
    prix_par_personne: 65,
    reduction: 71.5,
    prix_menu: 643.5,
    prix_livraison: 0,
    prix_total: 643.5,
    avis: null,
    suivi: [{ statut: 'en_attente', date: '2026-11-12 15:47:20' }],
    peut_modifier: true,
    peut_donner_avis: false,
    ...modifs,
  };
}

/**
 * Le formulaire de commande en mode « modification » :
 * /espace-utilisateur/commandes/:commandeId/modifier
 */
describe('Commande (modification d’une commande en attente)', () => {
  let fixture: ComponentFixture<Commande>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function ouvrir(id: string, reponse: CommandeDetaillee | 404 | null): Promise<void> {
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
    fixture.componentRef.setInput('commandeId', id);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    if (reponse === 404) {
      http
        .expectOne(`/api/commandes/${id}`)
        .flush({ error: 'Commande introuvable.' }, { status: 404, statusText: 'Not Found' });
    } else if (reponse) {
      http.expectOne(`/api/commandes/${id}`).flush(reponse);
      if (reponse.peut_modifier) {
        http.expectOne('/api/menus/1').flush({ menu: MENU_GASTRO, images: [], plats: [] });
      }
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const champ = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  const cliquer = async (texte: string) => {
    [...page.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes(texte))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('pré-remplit avec la commande (pas avec le profil) et annonce la modification', async () => {
    await ouvrir('14', commande());

    expect(page.querySelector('h1')!.textContent).toContain('Modifier la commande VG-2026-0014');
    expect(champ('prenom').value).toBe('Camille');
    expect(champ('nom').value).toBe('Laurent');
    expect(champ('telephone').value).toBe('0698765432');
    expect(page.querySelector('[aria-current="page"]')!.textContent).toContain('Modifier');
  });

  it('le menu ne peut pas être changé (pas de lien « Changer de menu »)', async () => {
    await ouvrir('14', commande());
    await cliquer('Continuer');
    await cliquer('Continuer');

    expect(champ('personnes').value).toBe('11');
    expect(page.textContent).not.toContain('Changer de menu');
    expect(page.textContent).toContain('ne peut pas être changé');
  });

  it('enregistre par PUT sans menu ni prix, puis revient au détail avec un message', async () => {
    await ouvrir('14', commande());
    const router = TestBed.inject(Router);
    let navigation: unknown[] = [];
    let etat: unknown;
    router.navigate = (commandes: unknown[], extras?: { state?: unknown }) => {
      navigation = commandes;
      etat = extras?.state;
      return Promise.resolve(true);
    };

    // Tout est déjà rempli : on peut aller directement au récapitulatif
    const lienRecap = [...page.querySelectorAll<HTMLButtonElement>('.progression__lien')].at(-1)!;
    lienRecap.click();
    await fixture.whenStable();
    http.expectOne('/api/commandes/devis').flush({
      menu: commande().menu,
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
    fixture.detectChanges();

    await cliquer('Enregistrer les modifications');
    const requete = http.expectOne('/api/commandes/14');
    expect(requete.request.method).toBe('PUT');
    expect('menu_id' in requete.request.body).toBe(false);
    expect('prix_total' in requete.request.body).toBe(false);
    expect(requete.request.body.nombre_personne).toBe(11);
    requete.flush({ message: 'Commande modifiée.', commande: {} });
    await fixture.whenStable();

    expect(navigation).toEqual(['/espace-utilisateur/commandes', 14]);
    expect(etat).toEqual({ message: 'Commande VG-2026-0014 modifiée.' });
  });

  it('refus du serveur (409) : message affiché, on reste sur le formulaire', async () => {
    await ouvrir('14', commande());
    [...page.querySelectorAll<HTMLButtonElement>('.progression__lien')].at(-1)!.click();
    await fixture.whenStable();
    http.expectOne('/api/commandes/devis').flush({
      menu: commande().menu,
      nombre_personne: 11,
      personnes_pour_reduction: 11,
      livraison: {
        adresse_trouvee: 'x',
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
    fixture.detectChanges();

    await cliquer('Enregistrer les modifications');
    http.expectOne('/api/commandes/14').flush(
      {
        error:
          'Cette commande a déjà été prise en charge : elle ne peut plus être modifiée en ligne.',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.querySelector('[role="alert"]')!.textContent).toContain(
      "Les modifications n'ont pas pu être enregistrées",
    );
    expect(page.textContent).toContain('déjà été prise en charge');
  });

  it('commande déjà acceptée : pas de formulaire, message et lien vers la commande', async () => {
    await ouvrir('14', commande({ statut: 'accepte', peut_modifier: false }));

    expect(page.querySelector('form')).toBeNull();
    expect(page.textContent).toContain('ne peut plus être modifiée en ligne');
    expect(page.querySelector('a[href="/espace-utilisateur/commandes/14"]')).not.toBeNull();
  });

  it('commande d’un autre client : page introuvable', async () => {
    await ouvrir('1', 404);
    expect(page.querySelector('app-page-introuvable')).not.toBeNull();
  });
});
