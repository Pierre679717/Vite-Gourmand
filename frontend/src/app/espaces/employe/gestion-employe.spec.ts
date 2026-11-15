import {
  FILTRES_VIDES,
  classeBadgeAvis,
  effetAction,
  erreurMotif,
  etapesPossibles,
  filtresDepuisUrl,
  libelleAction,
  messageSucces,
  memesFiltres,
  peutAnnuler,
  statutAvisDepuisFiltre,
  texteAucunAvis,
  texteResultats,
  versFiltres,
  versParametresUrl,
} from './gestion-employe';

describe('filtres des commandes', () => {
  it('formulaire vide : aucun filtre', () => {
    expect(versFiltres(FILTRES_VIDES)).toEqual({});
  });

  it('garde le statut et nettoie la recherche', () => {
    expect(versFiltres({ statut: 'livre', client: '  Camille   Martin ' })).toEqual({
      statut: 'livre',
      client: 'Camille Martin',
    });
    expect(versFiltres({ statut: '', client: '   ' })).toEqual({});
  });

  it('compare deux filtres', () => {
    expect(memesFiltres({}, {})).toBe(true);
    expect(memesFiltres({ statut: 'livre' }, { statut: 'livre' })).toBe(true);
    expect(memesFiltres({ statut: 'livre' }, { statut: 'livre', client: 'a' })).toBe(false);
  });

  it("lit les filtres dans l'URL, sans accepter un statut inconnu", () => {
    expect(filtresDepuisUrl({ statut: 'terminee', client: 'camille' })).toEqual({
      statut: 'terminee',
      client: 'camille',
    });
    expect(filtresDepuisUrl({ statut: 'DROP', client: null })).toEqual(FILTRES_VIDES);
    expect(filtresDepuisUrl({})).toEqual(FILTRES_VIDES);
  });

  it("écrit les filtres dans l'URL (null retire le paramètre)", () => {
    expect(versParametresUrl({})).toEqual({ statut: null, client: null });
    expect(versParametresUrl({ statut: 'livre', client: 'x' })).toEqual({
      statut: 'livre',
      client: 'x',
    });
  });

  it('annonce le nombre de résultats', () => {
    expect(texteResultats(0, false)).toBe('Aucune commande.');
    expect(texteResultats(0, true)).toBe('Aucune commande pour ces filtres.');
    expect(texteResultats(1, false)).toBe('1 commande.');
    expect(texteResultats(3, true)).toBe('3 commandes pour ces filtres.');
  });
});

describe("boutons d'action", () => {
  it('un libellé par étape', () => {
    expect(libelleAction('en_attente', 'accepte')).toBe('Accepter la commande');
    expect(libelleAction('accepte', 'en_preparation')).toBe('Passer en préparation');
    expect(libelleAction('en_preparation', 'en_cours_livraison')).toBe('Partir en livraison');
    expect(libelleAction('en_cours_livraison', 'livre')).toBe('Marquer comme livrée');
    expect(libelleAction('livre', 'attente_retour_materiel')).toBe(
      'Attendre le retour du matériel',
    );
  });

  it('« terminée » : libellé différent si le matériel revient', () => {
    expect(libelleAction('livre', 'terminee')).toBe('Terminer la commande');
    expect(libelleAction('attente_retour_materiel', 'terminee')).toBe(
      'Matériel restitué : terminer',
    );
  });

  it('prévient des deux mails envoyés au client', () => {
    expect(effetAction('attente_retour_materiel')).toMatch(/10 jours ouvrés.*600 €/);
    expect(effetAction('terminee')).toMatch(/avis/);
    expect(effetAction('accepte')).toBeNull();
  });

  it('message de réussite, avec le mail quand il y en a un', () => {
    expect(messageSucces('VG-2026-0013', 'accepte')).toBe(
      'Commande VG-2026-0013 : statut « Acceptée ».',
    );
    expect(messageSucces('VG-2026-0013', 'attente_retour_materiel')).toMatch(/e-mail.*10 jours/);
    expect(messageSucces('VG-2026-0013', 'terminee')).toMatch(/donner son avis/);
    expect(messageSucces('VG-2026-0014', 'annulee')).toMatch(/annulée.*remise en vente/);
  });

  it("sépare les étapes de l'annulation", () => {
    expect(etapesPossibles(['accepte', 'annulee'])).toEqual(['accepte']);
    expect(peutAnnuler(['accepte', 'annulee'])).toBe(true);
    expect(peutAnnuler(['livre'])).toBe(false);
    expect(etapesPossibles([])).toEqual([]);
  });
});

describe('motif d’annulation', () => {
  it('obligatoire, 5 à 1000 caractères, espaces ignorés', () => {
    expect(erreurMotif('')).toMatch(/motif/);
    expect(erreurMotif('   abc   ')).toBe('Au moins 5 caractères.');
    expect(erreurMotif('a'.repeat(1001))).toBe('1000 caractères au maximum.');
    expect(erreurMotif('  Client hospitalisé  ')).toBeNull();
  });
});

describe('modération des avis', () => {
  it("filtre « tous » = pas de paramètre pour l'API", () => {
    expect(statutAvisDepuisFiltre('tous')).toBeNull();
    expect(statutAvisDepuisFiltre('en_attente')).toBe('en_attente');
  });

  it('mêmes couleurs que les statuts de commande', () => {
    expect(classeBadgeAvis('en_attente')).toBe('badge badge--statut-attente');
    expect(classeBadgeAvis('valide')).toBe('badge badge--statut-terminee');
    expect(classeBadgeAvis('refuse')).toBe('badge badge--statut-annulee');
  });

  it('message vide adapté au filtre', () => {
    expect(texteAucunAvis('en_attente')).toMatch(/à jour/);
    expect(texteAucunAvis('tous')).toBe('Aucun avis pour le moment.');
  });
});
