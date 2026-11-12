import { FormControl } from '@angular/forms';
import { Profil } from '../../../core/models/utilisateur';
import {
  ValeursFormulaire,
  adresseValide,
  ajouterJours,
  aujourdhuiParis,
  dateAuPlusTot,
  dateFr,
  dateMinimumPrestation,
  emailValide,
  estDateValide,
  etapePrecedente,
  etapeSuivante,
  heureValide,
  indicationReduction,
  messageChamp,
  nomValide,
  peutAllerA,
  personnesInitiales,
  personnesPourReduction,
  personnesValides,
  reductionApplicable,
  telephoneValide,
  valeursDepuisProfil,
  versDemandeDevis,
  versDonneesCommande,
  villeValide,
} from './commande-logique';

/** Erreurs d'un validateur pour une valeur donnée */
function erreurs(validateur: Parameters<FormControl['setValidators']>[0], valeur: unknown) {
  return new FormControl(valeur, validateur).errors;
}

describe('dates en Europe/Paris', () => {
  it('donne la date de Bordeaux, pas celle du temps universel', () => {
    // 23 h 30 UTC le 11/11 = 0 h 30 le 12/11 à Paris (UTC+1 en hiver)
    expect(aujourdhuiParis(new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12');
    // 21 h 30 UTC le 30/06 = 23 h 30 à Paris (UTC+2 en été) : encore le 30
    expect(aujourdhuiParis(new Date('2026-06-30T21:30:00Z'))).toBe('2026-06-30');
  });

  it('ajoute des jours en changeant de mois, d’année et en traversant l’heure d’hiver', () => {
    expect(ajouterJours('2026-11-28', 7)).toBe('2026-12-05');
    expect(ajouterJours('2026-12-30', 3)).toBe('2027-01-02');
    expect(ajouterJours('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('date minimum = aujourd’hui + délai du menu', () => {
    expect(dateMinimumPrestation('2026-11-12', 7)).toBe('2026-11-19');
    expect(dateMinimumPrestation('2026-11-12', 21)).toBe('2026-12-03');
  });

  it('date minimum = demain au plus tôt, même avec un délai de 0', () => {
    expect(dateMinimumPrestation('2026-11-12', 0)).toBe('2026-11-13');
  });

  it('reconnaît les dates du calendrier', () => {
    expect(estDateValide('2026-12-05')).toBe(true);
    expect(estDateValide('2026-02-30')).toBe(false);
    expect(estDateValide('05/12/2026')).toBe(false);
  });

  it('affiche une date au format français', () => {
    expect(dateFr('2026-12-05')).toBe('05/12/2026');
  });
});

describe('validateur de date', () => {
  const minimum = '2026-11-19';

  it('accepte le minimum et après', () => {
    expect(erreurs(dateAuPlusTot(minimum), '2026-11-19')).toBeNull();
    expect(erreurs(dateAuPlusTot(minimum), '2026-12-24')).toBeNull();
  });

  it('refuse un jour trop tôt et indique la première date possible', () => {
    expect(erreurs(dateAuPlusTot(minimum), '2026-11-18')).toEqual({ dateTropTot: { minimum } });
  });

  it('refuse aujourd’hui et une date passée', () => {
    expect(erreurs(dateAuPlusTot(minimum), '2026-11-12')).not.toBeNull();
    expect(erreurs(dateAuPlusTot(minimum), '2025-12-01')).not.toBeNull();
  });

  it('refuse une date qui n’existe pas', () => {
    expect(erreurs(dateAuPlusTot(minimum), '2026-02-30')).toEqual({ date: true });
  });

  it('laisse un champ vide à Validators.required', () => {
    expect(erreurs(dateAuPlusTot(minimum), '')).toBeNull();
  });
});

describe('validateur du nombre de personnes', () => {
  it('accepte le minimum du menu', () => {
    expect(erreurs(personnesValides(6), 6)).toBeNull();
  });

  it('refuse sous le minimum, en indiquant le minimum', () => {
    expect(erreurs(personnesValides(6), 5)).toEqual({ minimumPersonnes: { minimum: 6 } });
  });

  it('refuse un nombre décimal et au-delà de 1 000', () => {
    expect(erreurs(personnesValides(6), 7.5)).toEqual({ entier: true });
    expect(erreurs(personnesValides(6), 1001)).toEqual({ maximumPersonnes: { maximum: 1000 } });
  });
});

describe('validateurs des coordonnées', () => {
  it('téléphone : 10 chiffres, espaces et points acceptés', () => {
    expect(erreurs(telephoneValide, '0698765432')).toBeNull();
    expect(erreurs(telephoneValide, '06 98 76 54 32')).toBeNull();
    expect(erreurs(telephoneValide, '06.98.76.54.32')).toBeNull();
  });

  it('téléphone : refuse 9 chiffres, 00 au début, des lettres, le +33', () => {
    for (const numero of ['069876543', '0098765432', '06987654AB', '+33698765432']) {
      expect(erreurs(telephoneValide, numero)).toEqual({ telephone: true });
    }
  });

  it('e-mail : exige un domaine avec un point', () => {
    expect(erreurs(emailValide, 'camille@exemple.fr')).toBeNull();
    expect(erreurs(emailValide, 'camille@exemple')).toEqual({ email: true });
    expect(erreurs(emailValide, 'camille exemple.fr')).toEqual({ email: true });
  });

  it('nom : accents, tiret et apostrophe acceptés ; chiffres et balises refusés', () => {
    expect(erreurs(nomValide, 'Hélène')).toBeNull();
    expect(erreurs(nomValide, "D'Artagnan-Lévêque")).toBeNull();
    expect(erreurs(nomValide, 'Camille2')).toEqual({ nom: true });
    expect(erreurs(nomValide, '<script>')).toEqual({ nom: true });
  });

  it('ville et adresse', () => {
    expect(erreurs(villeValide, 'Saint-Médard-en-Jalles')).toBeNull();
    expect(erreurs(villeValide, '33000')).toEqual({ ville: true });
    expect(erreurs(adresseValide, '7 cours de l’Intendance')).toBeNull();
    expect(erreurs(adresseValide, '7 r')).toEqual({ adresse: true });
  });

  it('heure : HH:MM entre 00:00 et 23:59', () => {
    expect(erreurs(heureValide, '12:30')).toBeNull();
    expect(erreurs(heureValide, '24:00')).toEqual({ heure: true });
  });
});

describe('messageChamp', () => {
  it('ne dit rien si le champ est valide', () => {
    expect(messageChamp(null)).toBeNull();
  });

  it('donne la première date possible en français', () => {
    expect(messageChamp({ dateTropTot: { minimum: '2026-11-19' } })).toBe(
      "Ce menu se commande à l'avance : première date possible le 19/11/2026.",
    );
  });

  it('rappelle le minimum de personnes', () => {
    expect(messageChamp({ minimumPersonnes: { minimum: 6 } })).toContain('6 personnes au minimum');
  });

  it('signale d’abord un champ obligatoire', () => {
    expect(messageChamp({ required: true, email: true })).toBe('Ce champ est obligatoire.');
  });
});

describe('nombre de personnes et réduction', () => {
  it('reprend ?personnes= quand il est valide', () => {
    expect(personnesInitiales('11', 6)).toBe(11);
  });

  it('se rabat sur le minimum si ?personnes= est absent, invalide ou trop petit', () => {
    expect(personnesInitiales(undefined, 6)).toBe(6);
    expect(personnesInitiales('abc', 6)).toBe(6);
    expect(personnesInitiales('7.5', 6)).toBe(6);
    expect(personnesInitiales('3', 6)).toBe(6);
  });

  it('plafonne à 1 000', () => {
    expect(personnesInitiales('5000', 6)).toBe(1000);
  });

  it('réduction à partir du minimum + 5', () => {
    expect(personnesPourReduction(6)).toBe(11);
    expect(reductionApplicable(10, 6)).toBe(false);
    expect(reductionApplicable(11, 6)).toBe(true);
  });

  it('indique combien de personnes il manque pour la réduction', () => {
    expect(indicationReduction(6, 6)).toBe(
      'Encore 5 personnes pour bénéficier de 10 % de réduction.',
    );
    expect(indicationReduction(10, 6)).toBe(
      'Encore 1 personne pour bénéficier de 10 % de réduction.',
    );
    expect(indicationReduction(11, 6)).toBe('Réduction de 10 % appliquée.');
    expect(indicationReduction(4, 6)).toBeNull();
  });
});

describe('étapes', () => {
  it('avance seulement si l’étape est valide', () => {
    expect(etapeSuivante(1, true)).toBe(2);
    expect(etapeSuivante(1, false)).toBe(1);
    expect(etapeSuivante(3, true)).toBe(4);
    expect(etapeSuivante(4, true)).toBe(4);
  });

  it('revient en arrière sans descendre sous la première étape', () => {
    expect(etapePrecedente(3)).toBe(2);
    expect(etapePrecedente(1)).toBe(1);
  });

  it('permet de revenir à une étape déjà atteinte, jamais de sauter en avant', () => {
    expect(peutAllerA(1, 4)).toBe(true);
    expect(peutAllerA(3, 2)).toBe(false);
  });
});

describe('données envoyées au serveur', () => {
  const camille: Profil = {
    id: 3,
    nom: 'Laurent',
    prenom: 'Camille',
    email: 'utilisateur@vite-gourmand.fr',
    role: 'utilisateur',
    telephone: null,
    adresse_postale: '7 cours de l’Intendance',
    code_postal: '33000',
    ville: 'Bordeaux',
  };

  const valeurs: ValeursFormulaire = {
    contact: {
      nom: '  Laurent ',
      prenom: 'Camille',
      email: ' Camille@Exemple.FR ',
      telephone: '06 98 76 54 32',
    },
    livraison: {
      adresse: '  1   avenue Jean Jaurès ',
      ville: 'Pessac',
      date: '2026-12-05',
      heure: '12:30',
      pretMateriel: true,
    },
    menu: { personnes: 11 },
  };

  it('pré-remplit depuis le compte ; un téléphone absent devient un champ vide', () => {
    expect(valeursDepuisProfil(camille)).toEqual({
      contact: {
        nom: 'Laurent',
        prenom: 'Camille',
        email: 'utilisateur@vite-gourmand.fr',
        telephone: '',
      },
      livraison: { adresse: '7 cours de l’Intendance', ville: 'Bordeaux' },
    });
  });

  it('construit la demande de devis avec les textes nettoyés', () => {
    expect(versDemandeDevis(2, valeurs)).toEqual({
      menu_id: 2,
      nombre_personne: 11,
      adresse_prestation: '1 avenue Jean Jaurès',
      ville_prestation: 'Pessac',
    });
  });

  it('construit la commande : e-mail en minuscules, téléphone sans espaces, aucun prix', () => {
    const commande = versDonneesCommande(2, valeurs);
    expect(commande).toEqual({
      menu_id: 2,
      nombre_personne: 11,
      adresse_prestation: '1 avenue Jean Jaurès',
      ville_prestation: 'Pessac',
      date_prestation: '2026-12-05',
      heure_livraison: '12:30',
      pret_materiel: true,
      contact_nom: 'Laurent',
      contact_prenom: 'Camille',
      contact_email: 'camille@exemple.fr',
      contact_telephone: '0698765432',
    });
    expect('prix_total' in commande).toBe(false);
  });
});
