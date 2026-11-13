import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SOPHIE, fauxToken } from '../../../core/auth/token-de-test';
import { CommandeDetaillee } from '../../../core/models/commande';
import { CommandeDetail } from './commande-detail';

registerLocaleData(localeFr);

/** VG-2026-0014 telle que renvoyée par l'API le 12/11 */
function commande(modifs: Partial<CommandeDetaillee> = {}): CommandeDetaillee {
  return {
    commande_id: 14,
    numero_commande: 'VG-2026-0014',
    date_commande: '2026-11-12 15:47:20',
    statut: 'en_attente',
    menu: {
      menu_id: 2,
      titre: 'Menu Traditionnel',
      nombre_personne_min: 6,
      delai_minimum_jours: 7,
    },
    nombre_personne: 11,
    date_prestation: '2026-12-05',
    heure_livraison: '12:30',
    adresse_prestation: "7 cours de l'Intendance",
    ville_prestation: 'Bordeaux',
    pret_materiel: true,
    materiel_restitue: false,
    contact_nom: 'Laurent',
    contact_prenom: 'Camille',
    contact_email: 'utilisateur@vite-gourmand.fr',
    contact_telephone: '0698765432',
    distance_km: 0,
    prix_par_personne: 48,
    reduction: 52.8,
    prix_menu: 475.2,
    prix_livraison: 0,
    prix_total: 475.2,
    avis: null,
    suivi: [{ statut: 'en_attente', date: '2026-11-12 15:47:20' }],
    peut_modifier: true,
    peut_donner_avis: false,
    ...modifs,
  };
}

const TERMINEE = {
  statut: 'terminee',
  peut_modifier: false,
  peut_donner_avis: true,
  suivi: [
    { statut: 'en_attente', date: '2026-10-01 10:00:00' },
    { statut: 'livre', date: '2026-10-10 12:00:00' },
    { statut: 'terminee', date: '2026-10-11 09:00:00' },
  ],
} as Partial<CommandeDetaillee>;

describe('CommandeDetail', () => {
  let fixture: ComponentFixture<CommandeDetail>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Ouvre /espace-utilisateur/commandes/:id ; `reponse` = ce que renvoie l'API (rien si null) */
  async function ouvrir(id: string, reponse: CommandeDetaillee | 404 | null): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    TestBed.configureTestingModule({
      imports: [CommandeDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    fixture = TestBed.createComponent(CommandeDetail);
    fixture.componentRef.setInput('id', id);
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
    }
    await rendre();
  }

  const bouton = (texte: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(texte),
    );

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('affiche la commande et la frise : étape datée puis étapes à venir', async () => {
    await ouvrir('14', commande());

    expect(page.querySelector('h1')!.textContent).toContain('VG-2026-0014');
    expect(page.querySelector('.badge--statut-attente')!.textContent!.trim()).toBe('En attente');

    const etapes = page.querySelectorAll('.frise__etape');
    expect(etapes.length).toBe(7); // en attente + 6 à venir (avec le retour du matériel)
    expect(etapes[0].classList).toContain('frise__etape--actuelle');
    expect(etapes[0].querySelector('time')!.textContent).toBe('12/11/2026 à 15h47');
    expect(etapes[0].querySelector('time')!.getAttribute('datetime')).toBe('2026-11-12T15:47:20');
    expect(etapes[1].classList).toContain('frise__etape--a-venir');
    expect(etapes[1].querySelector('time')).toBeNull();

    expect(page.textContent).toContain('samedi 5 décembre 2026 à 12h30');
    expect(page.textContent).toContain('Offerte');
  });

  it('commande d’un autre client (404) : page introuvable', async () => {
    await ouvrir('1', 404);
    expect(page.querySelector('app-page-introuvable')).not.toBeNull();
  });

  it('id invalide : page introuvable sans appeler l’API', async () => {
    await ouvrir('abc', null);
    expect(page.querySelector('app-page-introuvable')).not.toBeNull();
  });

  describe('annulation', () => {
    it('pas de bouton si la commande est déjà acceptée', async () => {
      await ouvrir('14', commande({ statut: 'accepte', peut_modifier: false }));
      expect(bouton('Annuler la commande')).toBeUndefined();
      expect(page.textContent).toContain('prise en charge');
    });

    it('demande confirmation ; « Non, la garder » referme sans requête', async () => {
      await ouvrir('14', commande());

      bouton('Annuler la commande')!.click();
      await rendre();
      expect(page.querySelector('#titre-confirmation')!.textContent).toContain(
        'Annuler la commande VG-2026-0014 ?',
      );
      expect(document.activeElement?.id).toBe('titre-confirmation');

      bouton('Non, la garder')!.click();
      await rendre();
      expect(page.querySelector('#titre-confirmation')).toBeNull();
      expect(bouton('Annuler la commande')).toBeDefined();
    });

    it('Échap referme la confirmation', async () => {
      await ouvrir('14', commande());
      bouton('Annuler la commande')!.click();
      await rendre();

      page
        .querySelector('.confirmation-annulation')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await rendre();
      expect(page.querySelector('.confirmation-annulation')).toBeNull();
    });

    it('confirmée : POST /annulation, puis la commande est relue et affichée annulée', async () => {
      await ouvrir('14', commande());
      bouton('Annuler la commande')!.click();
      await rendre();
      bouton('Oui, annuler la commande')!.click();

      const requete = http.expectOne('/api/commandes/14/annulation');
      expect(requete.request.method).toBe('POST');
      requete.flush({
        message: 'Commande VG-2026-0014 annulée.',
        numero_commande: 'VG-2026-0014',
        statut: 'annulee',
      });
      await rendre();

      http.expectOne('/api/commandes/14').flush(
        commande({
          statut: 'annulee',
          peut_modifier: false,
          suivi: [
            { statut: 'en_attente', date: '2026-11-12 15:47:20' },
            { statut: 'annulee', date: '2026-11-13 17:20:00' },
          ],
        }),
      );
      await rendre();

      expect(page.querySelector('[role="status"]')!.textContent).toContain(
        'Commande VG-2026-0014 annulée.',
      );
      expect(page.querySelector('.badge--statut-annulee')!.textContent!.trim()).toBe('Annulée');
      expect(page.querySelectorAll('.frise__etape').length).toBe(2);
      expect(bouton('Annuler la commande')).toBeUndefined();
    });

    it('refusée par le serveur (409) : le message est affiché, la confirmation reste ouverte', async () => {
      await ouvrir('14', commande());
      bouton('Annuler la commande')!.click();
      await rendre();
      bouton('Oui, annuler la commande')!.click();

      http
        .expectOne('/api/commandes/14/annulation')
        .flush(
          { error: 'Cette commande a déjà été prise en charge.' },
          { status: 409, statusText: 'Conflict' },
        );
      await rendre();

      expect(page.querySelector('.confirmation-annulation [role="alert"]')!.textContent).toContain(
        'déjà été prise en charge',
      );
    });
  });

  describe('avis', () => {
    it('pas de formulaire tant que la commande n’est pas terminée', async () => {
      await ouvrir('14', commande());
      expect(page.querySelector('.avis-form')).toBeNull();
    });

    it('commande terminée : envoi refusé sans note ni commentaire, aucune requête', async () => {
      await ouvrir('3', commande({ commande_id: 3, ...TERMINEE }));

      bouton('Envoyer mon avis')!.click();
      await rendre();

      expect(page.textContent).toContain('Choisissez une note de 1 à 5 étoiles.');
      expect(page.textContent).toContain('Écrivez quelques mots sur votre expérience.');
    });

    it('note + commentaire : POST /api/avis puis l’avis s’affiche en attente de validation', async () => {
      await ouvrir('3', commande({ commande_id: 3, ...TERMINEE }));

      page.querySelector<HTMLInputElement>('#note-4')!.click();
      const texte = page.querySelector<HTMLTextAreaElement>('#commentaire')!;
      texte.value = '  Très bon menu, merci !  ';
      texte.dispatchEvent(new Event('input'));
      await rendre();
      expect(page.querySelectorAll('.etoiles--saisie .etoile--active').length).toBe(4);

      bouton('Envoyer mon avis')!.click();
      const requete = http.expectOne('/api/avis');
      expect(requete.request.body).toEqual({
        commande_id: 3,
        note: 4,
        commentaire: 'Très bon menu, merci !',
      });
      requete.flush(
        {
          message: 'Merci !',
          avis: { note: 4, commentaire: 'Très bon menu, merci !', statut: 'en_attente' },
        },
        { status: 201, statusText: 'Created' },
      );
      await rendre();

      expect(page.querySelector('.avis-form')).toBeNull();
      expect(page.textContent).toContain('En attente de validation');
      expect(page.textContent).toContain('Merci pour votre avis');
    });

    it('avis déjà donné : affiché, sans formulaire', async () => {
      await ouvrir(
        '3',
        commande({
          commande_id: 3,
          ...TERMINEE,
          peut_donner_avis: false,
          avis: { note: 5, commentaire: 'Parfait', statut: 'valide' },
        }),
      );
      expect(page.querySelector('.avis-form')).toBeNull();
      expect(page.textContent).toContain('Publié sur le site');
    });
  });

  it('retour du matériel : rappel des 600 € et lien vers le contact', async () => {
    await ouvrir('8', commande({ statut: 'attente_retour_materiel', peut_modifier: false }));
    expect(page.textContent).toContain('600 €');
    expect(page.querySelector('a[href="/contact"]')).not.toBeNull();
  });
});
