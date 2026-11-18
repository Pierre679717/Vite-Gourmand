import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { CommandeEmployeDetaillee } from '../../../core/models/employe';
import { DetailCommandeEmploye } from './detail-commande-employe';

registerLocaleData(localeFr);

/** VG-2026-0013 (prêt de matériel) livrée */
function commande(modifs: Partial<CommandeEmployeDetaillee> = {}): CommandeEmployeDetaillee {
  return {
    commande_id: 13,
    numero_commande: 'VG-2026-0013',
    date_commande: '2026-11-13 22:40:00',
    statut: 'livre',
    menu: {
      menu_id: 2,
      titre: 'Menu Traditionnel',
      nombre_personne_min: 6,
      delai_minimum_jours: 7,
    },
    nombre_personne: 8,
    date_prestation: '2026-11-20',
    heure_livraison: '12:30',
    adresse_prestation: 'Avenue Jean Jaurès',
    ville_prestation: 'Pessac',
    pret_materiel: true,
    materiel_restitue: false,
    contact_nom: 'Martin',
    contact_prenom: 'Camille',
    contact_email: 'utilisateur@vite-gourmand.fr',
    contact_telephone: '0698765432',
    distance_km: 4.5,
    prix_par_personne: 48,
    reduction: 0,
    prix_menu: 384,
    prix_livraison: 7.66,
    prix_total: 391.66,
    avis: null,
    suivi: [{ statut: 'en_attente', date: '2026-11-13 22:40:00' }],
    client: {
      utilisateur_id: 3,
      nom: 'Martin',
      prenom: 'Camille',
      email: 'utilisateur@vite-gourmand.fr',
      telephone: '0698765432',
    },
    mode_contact: null,
    motif: null,
    statuts_suivants: ['attente_retour_materiel'],
    ...modifs,
  };
}

describe('DetailCommandeEmploye', () => {
  let fixture: ComponentFixture<DetailCommandeEmploye>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function rendre(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ouvrir(reponse: CommandeEmployeDetaillee): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [DetailCommandeEmploye],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    fixture = TestBed.createComponent(DetailCommandeEmploye);
    fixture.componentRef.setInput('id', String(reponse.commande_id));
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne(`/api/employe/commandes/${reponse.commande_id}`).flush(reponse);
    await rendre();
  }

  const boutons = () => [...page.querySelectorAll<HTMLButtonElement>('.actions button')];
  const bouton = (texte: string) => boutons().find((b) => b.textContent?.includes(texte));

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('prêt de matériel : seul « Attendre le retour du matériel » est proposé après « Livrée »', async () => {
    await ouvrir(commande());
    expect(boutons().map((b) => b.textContent?.trim())).toEqual(['Attendre le retour du matériel']);
    expect(page.textContent).toContain('10 jours ouvrés');
    expect(bouton('Terminer')).toBeUndefined();
    expect(bouton('Annuler')).toBeUndefined();
  });

  it('affiche les coordonnées du client pour le contacter', async () => {
    await ouvrir(commande());
    expect(page.querySelector('a[href="tel:0698765432"]')?.textContent).toContain('06 98 76 54 32');
    expect(page.querySelector('a[href="mailto:utilisateur@vite-gourmand.fr"]')).toBeTruthy();
  });

  it('avancer : PUT, message, puis la commande est relue', async () => {
    await ouvrir(commande());
    bouton('Attendre le retour')!.click();
    const requete = http.expectOne('/api/employe/commandes/13');
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({ statut: 'attente_retour_materiel' });
    requete.flush({
      message: 'ok',
      numero_commande: 'VG-2026-0013',
      statut: 'attente_retour_materiel',
    });
    await rendre();

    const relue = http.expectOne('/api/employe/commandes/13');
    expect(relue.request.method).toBe('GET');
    relue.flush(commande({ statut: 'attente_retour_materiel', statuts_suivants: ['terminee'] }));
    await rendre();

    expect(page.querySelector('.alerte--succes')?.textContent).toContain('10 jours ouvrés');
    expect(boutons().map((b) => b.textContent?.trim())).toEqual(['Matériel restitué : terminer']);
  });

  it('409 (statut changé par un collègue) : message et relecture', async () => {
    await ouvrir(commande());
    bouton('Attendre le retour')!.click();
    http
      .expectOne('/api/employe/commandes/13')
      .flush({ error: 'Cette commande est clôturée.' }, { status: 409, statusText: 'Conflit' });
    await rendre();
    http
      .expectOne('/api/employe/commandes/13')
      .flush(commande({ statut: 'terminee', statuts_suivants: [] }));
    await rendre();

    expect(page.querySelector('.alerte--erreur')?.textContent).toContain(
      'Cette commande est clôturée.',
    );
    expect(page.textContent).toContain('son statut ne peut plus changer');
  });

  it('annulation : mode de contact et motif obligatoires', async () => {
    await ouvrir(commande({ statut: 'accepte', statuts_suivants: ['en_preparation', 'annulee'] }));
    bouton('Annuler la commande')!.click();
    await rendre();

    const form = page.querySelector<HTMLFormElement>('form.annulation')!;
    form.dispatchEvent(new Event('submit'));
    await rendre();
    http.expectNone('/api/employe/commandes/13');
    expect(page.textContent).toContain('Indiquez comment vous avez contacté le client.');
    expect(page.textContent).toContain('Indiquez le motif de l’annulation.');
  });

  it('annulation complète : PUT avec le mode de contact et le motif nettoyé', async () => {
    await ouvrir(commande({ statut: 'accepte', statuts_suivants: ['en_preparation', 'annulee'] }));
    bouton('Annuler la commande')!.click();
    await rendre();

    // 1er bouton radio = GSM ([value] est une propriété, pas un attribut)
    page.querySelectorAll<HTMLInputElement>('form.annulation input[type="radio"]')[0].click();
    const motif = page.querySelector<HTMLTextAreaElement>('#motif')!;
    motif.value = '  Client hospitalisé, prestation reportée  ';
    motif.dispatchEvent(new Event('input'));
    page.querySelector<HTMLFormElement>('form.annulation')!.dispatchEvent(new Event('submit'));
    await rendre();

    const requete = http.expectOne('/api/employe/commandes/13');
    expect(requete.request.body).toEqual({
      statut: 'annulee',
      mode_contact: 'gsm',
      motif: 'Client hospitalisé, prestation reportée',
    });
    requete.flush({ message: 'ok', numero_commande: 'VG-2026-0013', statut: 'annulee' });
    await rendre();
    http.expectOne('/api/employe/commandes/13').flush(
      commande({
        statut: 'annulee',
        statuts_suivants: [],
        mode_contact: 'gsm',
        motif: 'Client hospitalisé, prestation reportée',
      }),
    );
    await rendre();

    expect(page.querySelector('.alerte--succes')?.textContent).toContain('annulée');
    expect(page.textContent).toContain("Motif de l'annulation");
    expect(page.textContent).toContain('Appel sur son GSM');
  });

  it('Échap referme le formulaire d’annulation', async () => {
    await ouvrir(commande({ statut: 'en_attente', statuts_suivants: ['accepte', 'annulee'] }));
    bouton('Annuler la commande')!.click();
    await rendre();
    page
      .querySelector('form.annulation')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await rendre();
    expect(page.querySelector('form.annulation')).toBeNull();
  });
});
