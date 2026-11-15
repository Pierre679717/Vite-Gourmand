import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { HELENE_EMPLOYEE, fauxToken } from '../../../core/auth/token-de-test';
import { CommandeEmploye } from '../../../core/models/employe';
import { CommandesEmploye } from './commandes-employe';

registerLocaleData(localeFr);

function ligne(modifs: Partial<CommandeEmploye> = {}): CommandeEmploye {
  return {
    commande_id: 13,
    numero_commande: 'VG-2026-0013',
    date_commande: '2026-11-13 22:40:00',
    statut: 'livre',
    menu_titre: 'Menu Traditionnel',
    nombre_personne: 8,
    date_prestation: '2026-11-20',
    heure_livraison: '12:30',
    ville_prestation: 'Pessac',
    prix_total: 482.86,
    pret_materiel: true,
    client: { nom: 'Martin', prenom: 'Camille', email: 'utilisateur@vite-gourmand.fr' },
    statuts_suivants: ['attente_retour_materiel'],
    ...modifs,
  };
}

describe('CommandesEmploye (liste filtrable)', () => {
  let fixture: ComponentFixture<CommandesEmploye>;
  let http: HttpTestingController;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function ouvrir(params: Record<string, string> = {}): Promise<void> {
    vi.useFakeTimers();
    localStorage.setItem('vg_token', fauxToken(HELENE_EMPLOYEE));
    TestBed.configureTestingModule({
      imports: [CommandesEmploye],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CommandesEmploye);
    http = TestBed.inject(HttpTestingController);
    page = fixture.nativeElement;
    fixture.detectChanges();
  }

  function repondre(liste: CommandeEmploye[]): void {
    http.expectOne((r) => r.url === '/api/employe/commandes').flush(liste);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('affiche les commandes et annonce leur nombre', async () => {
    await ouvrir();
    repondre([
      ligne(),
      ligne({
        commande_id: 3,
        numero_commande: 'VG-2026-0003',
        statut: 'terminee',
        pret_materiel: false,
        statuts_suivants: [],
      }),
    ]);

    expect(page.querySelector('[role="status"]')?.textContent).toContain('2 commandes.');
    const cartes = page.querySelectorAll('.commande-ligne');
    expect(cartes.length).toBe(2);
    expect(cartes[0].textContent).toContain('Camille Martin');
    expect(cartes[0].textContent).toContain('Livrée');
    expect(cartes[0].textContent).toContain('Matériel prêté');
    expect(cartes[1].textContent).not.toContain('Matériel prêté');
    expect(cartes[0].querySelector('a')?.getAttribute('aria-label')).toBe(
      'Gérer la commande VG-2026-0013',
    );
  });

  it("reprend les filtres de l'URL pour la première requête", async () => {
    await ouvrir({ statut: 'terminee', client: 'camille' });
    const requete = http.expectOne((r) => r.url === '/api/employe/commandes');
    expect(requete.request.params.get('statut')).toBe('terminee');
    expect(requete.request.params.get('client')).toBe('camille');
    requete.flush([]);
    fixture.detectChanges();

    expect((page.querySelector('#filtre-statut') as HTMLSelectElement).value).toBe('terminee');
    expect(page.querySelector('[role="status"]')?.textContent).toContain(
      'Aucune commande pour ces filtres.',
    );
  });

  it('relance la recherche 300 ms après la saisie et met à jour l’URL', async () => {
    await ouvrir();
    repondre([ligne()]);

    const champ = page.querySelector<HTMLInputElement>('#filtre-client')!;
    champ.value = 'martin';
    champ.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(299);
    http.expectNone((r) => r.url === '/api/employe/commandes');

    vi.advanceTimersByTime(1);
    const requete = http.expectOne((r) => r.url === '/api/employe/commandes');
    expect(requete.request.params.get('client')).toBe('martin');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { statut: null, client: 'martin' },
        replaceUrl: true,
      }),
    );
    requete.flush([]);
  });

  it('« Effacer les filtres » remet la liste complète', async () => {
    await ouvrir({ statut: 'livre' });
    repondre([ligne()]);

    const bouton = [...page.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Effacer'),
    );
    expect(bouton).toBeTruthy();
    bouton!.click();
    vi.advanceTimersByTime(300);
    const requete = http.expectOne((r) => r.url === '/api/employe/commandes');
    expect(requete.request.params.keys()).toEqual([]);
    requete.flush([]);
  });

  it('erreur du serveur : message et Réessayer', async () => {
    await ouvrir();
    http
      .expectOne((r) => r.url === '/api/employe/commandes')
      .flush({ error: 'Erreur serveur.' }, { status: 500, statusText: 'Erreur' });
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Erreur serveur.');

    [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Réessayer'))!.click();
    fixture.detectChanges();
    repondre([ligne()]);
    expect(page.querySelectorAll('.commande-ligne').length).toBe(1);
  });
});
