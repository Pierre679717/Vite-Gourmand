import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Employe, FiltresStats, NouvelEmploye, StatMenu } from '../../core/models/admin';

/**
 * Logique pure de l'espace administrateur (sans Angular, donc testée
 * simplement) : comptes employés, filtres et mise en forme des statistiques.
 * Le serveur revérifie tout ; ces règles guident l'administrateur.
 */

// ---------------------------------------------------------------------
// 1. Comptes employés
// ---------------------------------------------------------------------

/** Valeurs du formulaire « Créer un compte employé » */
export interface ValeursEmploye {
  prenom: string;
  nom: string;
  email: string;
  mot_de_passe: string;
}

export const EMPLOYE_VIDE: ValeursEmploye = { prenom: '', nom: '', email: '', mot_de_passe: '' };

/**
 * Formulaire → corps de la requête : espaces retirés, e-mail en minuscules.
 * Le mot de passe est envoyé tel quel (une espace en fait partie).
 * Aucun champ « rôle » : le serveur crée toujours un employé.
 */
export function versNouvelEmploye(v: ValeursEmploye): NouvelEmploye {
  return {
    prenom: v.prenom.trim(),
    nom: v.nom.trim(),
    email: v.email.trim().toLowerCase(),
    mot_de_passe: v.mot_de_passe,
  };
}

export const estActif = (employe: Pick<Employe, 'actif'>): boolean => employe.actif === 1;

export const nomComplet = (employe: Pick<Employe, 'prenom' | 'nom'>): string =>
  `${employe.prenom} ${employe.nom}`;

/** « 3 comptes employés, dont 1 désactivé. » */
export function texteNombreEmployes(employes: readonly Pick<Employe, 'actif'>[]): string {
  if (employes.length === 0) return 'Aucun compte employé pour le moment.';
  const desactives = employes.filter((e) => !estActif(e)).length;
  const base = `${employes.length} compte${employes.length > 1 ? 's' : ''} employé${employes.length > 1 ? 's' : ''}`;
  if (desactives === 0) return `${base}.`;
  return `${base}, dont ${desactives} désactivé${desactives > 1 ? 's' : ''}.`;
}

/**
 * Texte de l'encadré de confirmation, selon l'action demandée.
 * Tournures neutres (« ce compte ») : le texte convient à tout le monde.
 */
export function texteConfirmation(employe: Employe): {
  titre: string;
  texte: string;
  bouton: string;
} {
  const nom = nomComplet(employe);
  return estActif(employe)
    ? {
        titre: `Désactiver le compte de ${nom} ?`,
        texte:
          'Ce compte ne permettra plus de se connecter, et l’accès à l’espace employé est coupé ' +
          'aussitôt. Rien n’est supprimé : les commandes traitées avec ce compte gardent leur historique.',
        bouton: 'Confirmer la désactivation',
      }
    : {
        titre: `Réactiver le compte de ${nom} ?`,
        texte: 'Ce compte permettra de nouveau de se connecter, avec le même mot de passe.',
        bouton: 'Confirmer la réactivation',
      };
}

// ---------------------------------------------------------------------
// 2. Filtres des statistiques (menu, période)
// ---------------------------------------------------------------------

/** Valeurs du formulaire de filtres (chaîne vide = pas de filtre) */
export interface ValeursFiltresStats {
  /** Valeur de la liste déroulante : '' (tous) ou l'id du menu en texte */
  menu_id: string;
  debut: string;
  fin: string;
}

export const FILTRES_STATS_VIDES: ValeursFiltresStats = { menu_id: '', debut: '', fin: '' };

const MOTIF_ID = /^[1-9]\d{0,9}$/;
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'AAAA-MM-JJ' qui existe vraiment au calendrier (mêmes règles que le serveur) */
export function dateValide(texte: string): boolean {
  if (!MOTIF_DATE.test(texte)) return false;
  const [annee, mois, jour] = texte.split('-').map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour
  );
}

/**
 * Paramètres de l'URL (?menu_id=2&debut=2026-10-01) → formulaire.
 * Les filtres vivent dans l'URL : « Retour » et F5 gardent la vue choisie.
 * Une valeur invalide est ignorée (comme si le filtre n'était pas là).
 */
export function filtresStatsDepuisUrl(params: {
  menu_id?: string | null;
  debut?: string | null;
  fin?: string | null;
}): ValeursFiltresStats {
  const garder = (valeur: string | null | undefined, valide: (v: string) => boolean) =>
    valeur && valide(valeur) ? valeur : '';
  return {
    menu_id: garder(params.menu_id, (v) => MOTIF_ID.test(v)),
    debut: garder(params.debut, dateValide),
    fin: garder(params.fin, dateValide),
  };
}

/** Formulaire → filtres de l'API (les champs vides ne sont pas envoyés) */
export function versFiltresStats(v: ValeursFiltresStats): FiltresStats {
  const filtres: FiltresStats = {};
  if (MOTIF_ID.test(v.menu_id)) filtres.menu_id = Number(v.menu_id);
  if (dateValide(v.debut)) filtres.debut = v.debut;
  if (dateValide(v.fin)) filtres.fin = v.fin;
  return filtres;
}

/** Filtres → paramètres de l'URL (null retire le paramètre) */
export function versParametresUrlStats(f: FiltresStats): {
  menu_id: string | null;
  debut: string | null;
  fin: string | null;
} {
  return {
    menu_id: f.menu_id ? String(f.menu_id) : null,
    debut: f.debut ?? null,
    fin: f.fin ?? null,
  };
}

/** Validateur du groupe de filtres : le début ne peut pas suivre la fin */
export function periodeValide(groupe: AbstractControl): ValidationErrors | null {
  const debut: string = groupe.get('debut')?.value ?? '';
  const fin: string = groupe.get('fin')?.value ?? '';
  // Comparer deux textes AAAA-MM-JJ revient à comparer les dates
  return debut && fin && debut > fin ? { periodeInversee: true } : null;
}

/** '2026-10-01' → '01/10/2026' */
export function dateFr(date: string): string {
  const [annee, mois, jour] = date.split('-');
  return `${jour}/${mois}/${annee}`;
}

/** Résumé lisible des filtres appliqués, affiché au-dessus des résultats */
export function texteFiltres(f: FiltresStats, titreMenu: string | null): string {
  const menu = f.menu_id ? (titreMenu ?? 'Menu choisi') : 'Tous les menus';
  let periode = 'toutes les dates';
  if (f.debut && f.fin) {
    periode =
      f.debut === f.fin ? `le ${dateFr(f.debut)}` : `du ${dateFr(f.debut)} au ${dateFr(f.fin)}`;
  } else if (f.debut) {
    periode = `depuis le ${dateFr(f.debut)}`;
  } else if (f.fin) {
    periode = `jusqu’au ${dateFr(f.fin)}`;
  }
  return `${menu}, ${periode}.`;
}

// ---------------------------------------------------------------------
// 3. Mise en forme des statistiques
// ---------------------------------------------------------------------

/**
 * Données du graphique : menus du plus commandé au moins commandé.
 * (Le tableau, lui, est trié par chiffre d'affaires, comme le renvoie le serveur.)
 */
export function donneesGraphique(menus: readonly StatMenu[]): {
  libelles: string[];
  valeurs: number[];
} {
  const tries = [...menus].sort(
    (a, b) =>
      b.nombre_commandes - a.nombre_commandes || a.menu_titre.localeCompare(b.menu_titre, 'fr'),
  );
  return {
    libelles: tries.map((m) => m.menu_titre),
    valeurs: tries.map((m) => m.nombre_commandes),
  };
}

/**
 * Description du graphique pour les lecteurs d'écran (attribut aria-label
 * du canvas, qui n'est sinon qu'une image muette).
 */
export function descriptionGraphique(menus: readonly StatMenu[]): string {
  if (menus.length === 0) return 'Graphique vide : aucune commande pour ces filtres.';
  const { libelles, valeurs } = donneesGraphique(menus);
  const detail = libelles.map((l, i) => `${l} : ${valeurs[i]}`).join(', ');
  return `Graphique en barres du nombre de commandes par menu. ${detail}. Détail dans le tableau qui suit.`;
}

/** Part d'un menu dans le chiffre d'affaires total, arrondie : « 45 % » */
export function partDuTotal(valeur: number, total: number): string {
  if (total <= 0) return '—';
  return `${Math.round((valeur / total) * 100)} %`;
}

/**
 * Coupe un titre de menu en lignes d'au plus `max` caractères, aux espaces,
 * pour l'axe du graphique (Chart.js accepte un tableau de lignes).
 * Un mot plus long que `max` reste entier sur sa ligne.
 */
export function couperLibelle(texte: string, max: number): string[] {
  const lignes: string[] = [];
  for (const mot of texte.trim().split(/\s+/)) {
    const derniere = lignes.at(-1);
    if (derniere !== undefined && `${derniere} ${mot}`.length <= max) {
      lignes[lignes.length - 1] = `${derniere} ${mot}`;
    } else {
      lignes.push(mot);
    }
  }
  return lignes;
}
