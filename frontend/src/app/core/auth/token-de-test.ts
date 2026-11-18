import { Utilisateur } from '../models/utilisateur';

/**
 * Fabrique un faux JWT pour les tests (la signature n'est pas vérifiée
 * côté front, seul le contenu est lu).
 * @param dureeSecondes durée de validité ; négative = token déjà expiré
 */
export function fauxToken(utilisateur: Utilisateur, dureeSecondes = 3600): string {
  const encoder = (objet: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(objet))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + dureeSecondes;
  return `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder({ ...utilisateur, exp })}.signature`;
}

export const SOPHIE: Utilisateur = {
  id: 3,
  nom: 'Martin',
  prenom: 'Sophie',
  email: 'sophie@example.com',
  role: 'utilisateur',
};

export const HELENE_EMPLOYEE: Utilisateur = {
  id: 2,
  nom: 'Durand',
  prenom: 'Hélène',
  email: 'employe@vite-gourmand.fr',
  role: 'employe',
};
