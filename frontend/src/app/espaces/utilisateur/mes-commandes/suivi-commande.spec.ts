import { EtapeSuivi, ResumeCommande, StatutCommande } from '../../../core/models/commande';
import {
  LIBELLES_STATUT,
  classeBadge,
  dateHeureFr,
  dateHeureIso,
  dateLongue,
  erreurCommentaire,
  etapesFrise,
  heureFr,
  parcoursCommande,
  repartirCommandes,
  telephoneFr,
  tonStatut,
} from './suivi-commande';

const TOUS_LES_STATUTS: StatutCommande[] = [
  'en_attente',
  'accepte',
  'en_preparation',
  'en_cours_livraison',
  'livre',
  'attente_retour_materiel',
  'terminee',
  'annulee',
];

describe('Statuts', () => {
  it('chaque statut de la base a un libellé', () => {
    for (const statut of TOUS_LES_STATUTS) {
      expect(LIBELLES_STATUT[statut]).toBeTruthy();
    }
    expect(LIBELLES_STATUT.attente_retour_materiel).toBe('En attente du retour du matériel');
  });

  it('quatre couleurs : à valider, en cours, terminée, annulée', () => {
    expect(tonStatut('en_attente')).toBe('attente');
    expect(tonStatut('en_preparation')).toBe('en-cours');
    expect(tonStatut('attente_retour_materiel')).toBe('en-cours');
    expect(tonStatut('terminee')).toBe('terminee');
    expect(tonStatut('annulee')).toBe('annulee');
    expect(classeBadge('annulee')).toBe('badge badge--statut-annulee');
  });

  it('répartit en cours / passées sans changer l’ordre', () => {
    const c = (numero: string, statut: StatutCommande) =>
      ({ numero_commande: numero, statut }) as ResumeCommande;
    const { enCours, passees } = repartirCommandes([
      c('VG-4', 'en_attente'),
      c('VG-3', 'terminee'),
      c('VG-2', 'livre'),
      c('VG-1', 'annulee'),
    ]);
    expect(enCours.map((x) => x.numero_commande)).toEqual(['VG-4', 'VG-2']);
    expect(passees.map((x) => x.numero_commande)).toEqual(['VG-3', 'VG-1']);
  });
});

describe('Dates', () => {
  it('date et heure du serveur affichées sans conversion de fuseau', () => {
    expect(dateHeureFr('2026-11-12 15:47:20')).toBe('12/11/2026 à 15h47');
    expect(dateHeureFr('2026-11-12')).toBe('12/11/2026');
    expect(dateHeureIso('2026-11-12 15:47:20')).toBe('2026-11-12T15:47:20');
  });

  it('date longue en français, sans décalage d’un jour', () => {
    expect(dateLongue('2026-12-05')).toBe('samedi 5 décembre 2026');
    expect(dateLongue('2027-01-01')).toBe('vendredi 1 janvier 2027');
  });

  it('téléphone par groupes de deux chiffres', () => {
    expect(telephoneFr('0698765432')).toBe('06 98 76 54 32');
    expect(telephoneFr('+33698765432')).toBe('+33698765432');
  });

  it('heure au format 12h30', () => {
    expect(heureFr('12:30')).toBe('12h30');
    expect(heureFr('09:05:00')).toBe('09h05');
  });
});

describe('Frise du suivi', () => {
  const suivi = (...etapes: [StatutCommande, string][]): EtapeSuivi[] =>
    etapes.map(([statut, date]) => ({ statut, date }));

  it('parcours avec ou sans retour du matériel', () => {
    expect(parcoursCommande(false)).not.toContain('attente_retour_materiel');
    expect(parcoursCommande(true)).toContain('attente_retour_materiel');
    expect(parcoursCommande(true).at(-1)).toBe('terminee');
  });

  it('commande en attente : 1 étape datée, puis les étapes à venir', () => {
    const etapes = etapesFrise(suivi(['en_attente', '2026-11-12 15:47:20']), 'en_attente', true);

    expect(etapes[0]).toEqual({
      statut: 'en_attente',
      libelle: 'En attente',
      date: '2026-11-12 15:47:20',
      etat: 'actuelle',
    });
    expect(etapes.slice(1).map((e) => e.statut)).toEqual([
      'accepte',
      'en_preparation',
      'en_cours_livraison',
      'livre',
      'attente_retour_materiel',
      'terminee',
    ]);
    expect(etapes.slice(1).every((e) => e.etat === 'a-venir' && e.date === null)).toBe(true);
  });

  it('commande en préparation : étapes franchies datées, actuelle, puis à venir sans matériel', () => {
    const etapes = etapesFrise(
      suivi(
        ['en_attente', '2026-11-01 10:00:00'],
        ['accepte', '2026-11-02 09:00:00'],
        ['en_preparation', '2026-11-05 08:30:00'],
      ),
      'en_preparation',
      false,
    );

    expect(etapes.map((e) => e.etat)).toEqual([
      'franchie',
      'franchie',
      'actuelle',
      'a-venir',
      'a-venir',
      'a-venir',
    ]);
    expect(etapes.map((e) => e.statut)).not.toContain('attente_retour_materiel');
  });

  it('commande annulée : seulement l’historique, sans étape à venir', () => {
    const etapes = etapesFrise(
      suivi(['en_attente', '2026-11-12 15:47:20'], ['annulee', '2026-11-13 17:20:00']),
      'annulee',
      true,
    );

    expect(etapes.map((e) => [e.statut, e.etat])).toEqual([
      ['en_attente', 'franchie'],
      ['annulee', 'actuelle'],
    ]);
  });

  it('commande terminée : tout est daté, rien à venir', () => {
    const etapes = etapesFrise(
      suivi(
        ['en_attente', '2026-10-01 10:00:00'],
        ['livre', '2026-10-10 12:00:00'],
        ['terminee', '2026-10-11 09:00:00'],
      ),
      'terminee',
      false,
    );
    expect(etapes.length).toBe(3);
    expect(etapes.every((e) => e.date !== null)).toBe(true);
  });

  it('étape sautée par l’équipe : elle n’est pas proposée « à venir »', () => {
    const etapes = etapesFrise(
      suivi(['en_attente', '2026-11-01 10:00:00'], ['en_preparation', '2026-11-02 10:00:00']),
      'en_preparation',
      false,
    );
    expect(etapes.filter((e) => e.statut === 'accepte')).toEqual([]);
  });

  it('suivi vide (ancienne commande) : le statut actuel sans date', () => {
    const etapes = etapesFrise([], 'accepte', false);
    expect(etapes[0]).toEqual({
      statut: 'accepte',
      libelle: 'Acceptée',
      date: null,
      etat: 'actuelle',
    });
  });
});

describe('Avis', () => {
  it('commentaire : vide, trop court, trop long, valide', () => {
    expect(erreurCommentaire('   ')).toMatch(/quelques mots/);
    expect(erreurCommentaire(' ok ')).toMatch(/Au moins 3/);
    expect(erreurCommentaire('a'.repeat(1001))).toMatch(/1000 caractères au maximum/);
    expect(erreurCommentaire('  Parfait  ')).toBeNull();
  });
});
