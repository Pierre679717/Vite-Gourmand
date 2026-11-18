import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SOPHIE, fauxToken } from '../../../core/auth/token-de-test';
import { ResumeCommande } from '../../../core/models/commande';
import { MesCommandes } from './mes-commandes';

registerLocaleData(localeFr);

function resume(numero: string, statut: ResumeCommande['statut'], avis = false): ResumeCommande {
  return {
    commande_id: Number(numero.slice(-2)),
    numero_commande: numero,
    date_commande: '2026-11-12 15:47:20',
    statut,
    menu_titre: 'Menu Traditionnel',
    nombre_personne: 11,
    date_prestation: '2026-12-05',
    heure_livraison: '12:30',
    ville_prestation: 'Bordeaux',
    prix_total: 475.2,
    avis_donne: avis,
  };
}

describe('MesCommandes (liste)', () => {
  let fixture: ComponentFixture<MesCommandes>;
  let http: HttpTestingController;
  let page: HTMLElement;

  async function ouvrir(reponse: ResumeCommande[] | 'erreur'): Promise<void> {
    localStorage.setItem('vg_token', fauxToken(SOPHIE));
    TestBed.configureTestingModule({
      imports: [MesCommandes],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
      ],
    });
    fixture = TestBed.createComponent(MesCommandes);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    const requete = http.expectOne('/api/commandes');
    if (reponse === 'erreur') {
      requete.flush({ error: 'Erreur serveur.' }, { status: 500, statusText: 'Erreur' });
    } else {
      requete.flush(reponse);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('affiche les commandes en cours puis l’historique, avec leur badge de statut', async () => {
    await ouvrir([
      resume('VG-2026-0014', 'en_attente'),
      resume('VG-2026-0003', 'terminee'),
      resume('VG-2026-0008', 'en_preparation'),
    ]);

    const titres = [...page.querySelectorAll('h2')].map((h) => h.textContent!.trim());
    expect(titres).toEqual(['En cours (2)', 'Historique (1)']);
    const numeros = [...page.querySelectorAll('h3')].map((h) => h.textContent!.trim());
    expect(numeros).toEqual(['VG-2026-0014', 'VG-2026-0008', 'VG-2026-0003']);

    const badge = page.querySelector('.badge--statut-attente')!;
    expect(badge.textContent!.trim()).toBe('En attente');
    expect(page.textContent).toContain('samedi 5 décembre 2026 à 12h30');
    expect(page.textContent).toContain('475,20');
    expect(page.textContent).toContain('Bonjour Sophie');
  });

  it('invite à donner un avis sur une commande terminée sans avis', async () => {
    await ouvrir([resume('VG-2026-0003', 'terminee'), resume('VG-2026-0002', 'terminee', true)]);
    expect(page.querySelectorAll('.commande-ligne__invitation').length).toBe(1);
  });

  it('chaque lien « Voir le détail » a un nom accessible unique', async () => {
    await ouvrir([resume('VG-2026-0014', 'en_attente')]);
    const lien = page.querySelector<HTMLAnchorElement>('a.btn')!;
    expect(lien.getAttribute('aria-label')).toBe('Voir le détail de la commande VG-2026-0014');
    expect(lien.getAttribute('href')).toBe('/commandes/14');
  });

  it('aucune commande : message et lien vers les menus', async () => {
    await ouvrir([]);
    expect(page.textContent).toContain("Vous n'avez pas encore passé de commande");
    expect(page.querySelector('a[href="/menus"]')).not.toBeNull();
  });

  it('erreur : message et bouton Réessayer qui relance la requête', async () => {
    await ouvrir('erreur');
    expect(page.querySelector('[role="alert"]')!.textContent).toContain('Erreur serveur.');

    page.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    http.expectOne('/api/commandes').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.textContent).toContain("Vous n'avez pas encore passé de commande");
  });
});
