import { FormControl, FormGroup } from '@angular/forms';
import { StatMenu } from '../../core/models/admin';
import {
  couperLibelle,
  dateFr,
  dateValide,
  descriptionGraphique,
  donneesGraphique,
  estActif,
  filtresStatsDepuisUrl,
  partDuTotal,
  periodeValide,
  texteConfirmation,
  texteFiltres,
  texteNombreEmployes,
  versFiltresStats,
  versNouvelEmploye,
  versParametresUrlStats,
} from './admin-logique';

const THOMAS = { utilisateur_id: 2, nom: 'Girard', prenom: 'Thomas', email: 'e@vg.fr', actif: 1 };

const stat = (
  menu_id: number,
  menu_titre: string,
  nombre_commandes: number,
  ca: number,
): StatMenu => ({
  menu_id,
  menu_titre,
  nombre_commandes,
  nombre_annulees: 0,
  chiffre_affaires: ca,
});

describe('admin-logique : comptes employés', () => {
  it('nettoie le formulaire, e-mail en minuscules, mot de passe intact, aucun rôle', () => {
    const corps = versNouvelEmploye({
      prenom: ' Léa ',
      nom: ' Durand',
      email: ' Lea.Durand@Vite-Gourmand.FR ',
      mot_de_passe: ' Cuisine#Bordeaux26',
    });
    expect(corps).toEqual({
      prenom: 'Léa',
      nom: 'Durand',
      email: 'lea.durand@vite-gourmand.fr',
      mot_de_passe: ' Cuisine#Bordeaux26',
    });
    expect(corps).not.toHaveProperty('role');
  });

  it('actif = 1 en base', () => {
    expect(estActif({ actif: 1 })).toBe(true);
    expect(estActif({ actif: 0 })).toBe(false);
  });

  it('compte les employés et les désactivés', () => {
    expect(texteNombreEmployes([])).toBe('Aucun compte employé pour le moment.');
    expect(texteNombreEmployes([{ actif: 1 }])).toBe('1 compte employé.');
    expect(texteNombreEmployes([{ actif: 1 }, { actif: 0 }, { actif: 1 }])).toBe(
      '3 comptes employés, dont 1 désactivé.',
    );
    expect(texteNombreEmployes([{ actif: 0 }, { actif: 0 }])).toBe(
      '2 comptes employés, dont 2 désactivés.',
    );
  });

  it('confirmation adaptée à l’action', () => {
    expect(texteConfirmation(THOMAS).titre).toBe('Désactiver le compte de Thomas Girard ?');
    expect(texteConfirmation(THOMAS).texte).toMatch(/Rien n’est supprimé/);
    // Tournure neutre : ni « il » ni « elle »
    for (const e of [THOMAS, { ...THOMAS, actif: 0 }]) {
      expect(texteConfirmation(e).texte).not.toMatch(/\b(il|elle)\b/i);
    }
    expect(texteConfirmation({ ...THOMAS, actif: 0 }).bouton).toBe('Confirmer la réactivation');
  });
});

describe('admin-logique : filtres des statistiques', () => {
  it('dates du calendrier seulement', () => {
    expect(dateValide('2026-10-31')).toBe(true);
    expect(dateValide('2028-02-29')).toBe(true);
    expect(dateValide('2026-11-31')).toBe(false);
    expect(dateValide('31/10/2026')).toBe(false);
  });

  it('URL → formulaire : valeurs invalides ignorées', () => {
    expect(filtresStatsDepuisUrl({ menu_id: '2', debut: '2026-10-01', fin: '2026-10-31' })).toEqual(
      {
        menu_id: '2',
        debut: '2026-10-01',
        fin: '2026-10-31',
      },
    );
    expect(filtresStatsDepuisUrl({ menu_id: 'abc', debut: '2026-13-01', fin: null })).toEqual({
      menu_id: '',
      debut: '',
      fin: '',
    });
    expect(filtresStatsDepuisUrl({})).toEqual({ menu_id: '', debut: '', fin: '' });
  });

  it('formulaire → API → URL', () => {
    const filtres = versFiltresStats({ menu_id: '2', debut: '2026-10-01', fin: '' });
    expect(filtres).toEqual({ menu_id: 2, debut: '2026-10-01' });
    expect(versParametresUrlStats(filtres)).toEqual({
      menu_id: '2',
      debut: '2026-10-01',
      fin: null,
    });
    expect(versFiltresStats({ menu_id: '', debut: '', fin: '' })).toEqual({});
  });

  it('période inversée signalée sur le groupe', () => {
    const groupe = (debut: string, fin: string) =>
      new FormGroup({ debut: new FormControl(debut), fin: new FormControl(fin) });
    expect(periodeValide(groupe('2026-11-02', '2026-11-01'))).toEqual({ periodeInversee: true });
    expect(periodeValide(groupe('2026-11-01', '2026-11-01'))).toBeNull();
    expect(periodeValide(groupe('2026-11-01', ''))).toBeNull();
  });

  it('résumé lisible des filtres', () => {
    expect(texteFiltres({}, null)).toBe('Tous les menus, toutes les dates.');
    expect(
      texteFiltres({ menu_id: 2, debut: '2026-10-01', fin: '2026-10-31' }, 'Menu de Noël'),
    ).toBe('Menu de Noël, du 01/10/2026 au 31/10/2026.');
    expect(texteFiltres({ debut: '2026-10-01' }, null)).toBe(
      'Tous les menus, depuis le 01/10/2026.',
    );
    expect(texteFiltres({ fin: '2026-10-31' }, null)).toBe('Tous les menus, jusqu’au 31/10/2026.');
    expect(texteFiltres({ debut: '2026-10-05', fin: '2026-10-05' }, null)).toBe(
      'Tous les menus, le 05/10/2026.',
    );
    expect(dateFr('2026-01-09')).toBe('09/01/2026');
  });
});

describe('admin-logique : statistiques', () => {
  const menus = [
    stat(1, 'Menu de Noël', 3, 1500),
    stat(2, 'Menu Prestige', 5, 900),
    stat(3, 'Brunch', 3, 300),
  ];

  it('graphique : du plus commandé au moins commandé, puis par titre', () => {
    expect(donneesGraphique(menus)).toEqual({
      libelles: ['Menu Prestige', 'Brunch', 'Menu de Noël'],
      valeurs: [5, 3, 3],
    });
    expect(donneesGraphique([])).toEqual({ libelles: [], valeurs: [] });
  });

  it('description du graphique pour les lecteurs d’écran', () => {
    expect(descriptionGraphique(menus)).toBe(
      'Graphique en barres du nombre de commandes par menu. Menu Prestige : 5, Brunch : 3, Menu de Noël : 3. Détail dans le tableau qui suit.',
    );
    expect(descriptionGraphique([])).toMatch(/aucune commande/);
  });

  it('part du chiffre d’affaires', () => {
    expect(partDuTotal(1500, 2700)).toBe('56 %');
    expect(partDuTotal(0, 0)).toBe('—');
  });

  it('titres longs coupés en lignes pour l’axe du graphique', () => {
    expect(couperLibelle('Menu Végétarien du Marché', 18)).toEqual([
      'Menu Végétarien du',
      'Marché',
    ]);
    expect(couperLibelle('Brunch', 18)).toEqual(['Brunch']);
    expect(couperLibelle('Anticonstitutionnellement', 10)).toEqual(['Anticonstitutionnellement']);
  });
});
