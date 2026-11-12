import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommandeCreee, DemandeDevis, Devis, DonneesCommande } from '../models/commande';
import { CommandeService } from './commande.service';

/** Cas réel vérifié sur l'API : Pessac, 11 personnes, Menu Traditionnel */
const DEMANDE: DemandeDevis = {
  menu_id: 2,
  nombre_personne: 11,
  adresse_prestation: '1 avenue Jean Jaurès',
  ville_prestation: 'Pessac',
};

const DEVIS: Devis = {
  menu: { menu_id: 2, titre: 'Menu Traditionnel', nombre_personne_min: 6, delai_minimum_jours: 7 },
  nombre_personne: 11,
  personnes_pour_reduction: 11,
  livraison: {
    adresse_trouvee: '1 Avenue Jean Jaurès 33600 Pessac',
    ville: 'Pessac',
    code_postal: '33600',
    est_bordeaux: false,
  },
  distance_km: 5.4,
  prix_par_personne: 48,
  reduction: 52.8,
  prix_menu: 475.2,
  prix_livraison: 8.19,
  prix_total: 483.39,
};

const DONNEES: DonneesCommande = {
  ...DEMANDE,
  date_prestation: '2026-12-05',
  heure_livraison: '12:30',
  pret_materiel: false,
  contact_nom: 'Laurent',
  contact_prenom: 'Camille',
  contact_email: 'utilisateur@vite-gourmand.fr',
  contact_telephone: '0698765432',
};

describe('CommandeService', () => {
  let service: CommandeService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommandeService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('demande le devis par POST /api/commandes/devis avec les 4 champs', () => {
    let recu: Devis | undefined;

    service.devis(DEMANDE).subscribe((devis) => (recu = devis));

    const requete = controleur.expectOne('/api/commandes/devis');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual(DEMANDE);
    requete.flush(DEVIS);

    expect(recu).toEqual(DEVIS);
  });

  it('transmet l’erreur 400 « adresse introuvable » du devis', () => {
    let statut = 0;

    service.devis(DEMANDE).subscribe({ error: (e: HttpErrorResponse) => (statut = e.status) });

    controleur
      .expectOne('/api/commandes/devis')
      .flush({ error: 'Adresse introuvable.' }, { status: 400, statusText: 'Bad Request' });
    expect(statut).toBe(400);
  });

  it('transmet l’erreur 503 quand le géocodage est indisponible', () => {
    let statut = 0;

    service.devis(DEMANDE).subscribe({ error: (e: HttpErrorResponse) => (statut = e.status) });

    controleur
      .expectOne('/api/commandes/devis')
      .flush(
        { error: 'Service indisponible.' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(statut).toBe(503);
  });

  it('crée la commande par POST /api/commandes sans aucun prix dans le corps', () => {
    service.creer(DONNEES).subscribe();

    const requete = controleur.expectOne('/api/commandes');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual(DONNEES);
    for (const champ of ['prix_total', 'distance_km', 'prix_livraison', 'reduction']) {
      expect(champ in requete.request.body).toBe(false);
    }
    requete.flush({ message: 'Commande enregistrée !', commande: {} });
  });

  it('renvoie seulement la commande créée (numéro VG-AAAA-NNNN)', () => {
    const commande = { commande_id: 13, numero_commande: 'VG-2026-0013' } as CommandeCreee;
    let recu: CommandeCreee | undefined;

    service.creer(DONNEES).subscribe((c) => (recu = c));
    controleur
      .expectOne('/api/commandes')
      .flush(
        { message: 'Commande enregistrée !', commande },
        { status: 201, statusText: 'Created' },
      );

    expect(recu).toEqual(commande);
  });
});
