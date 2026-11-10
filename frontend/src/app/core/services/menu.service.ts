import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FiltresMenus, MenuDetail, MenuResume, OptionsFiltres } from '../models/menu';

/**
 * Accès aux menus.
 * Le filtrage est fait par le serveur : ce service se contente de traduire
 * les filtres en paramètres d'URL (?prix_max=400&theme=4...).
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);

  /** Menus actifs, filtrés côté serveur */
  lister(filtres: FiltresMenus = {}): Observable<MenuResume[]> {
    return this.http.get<MenuResume[]>('/api/menus', { params: versParametres(filtres) });
  }

  /** Thèmes, régimes et bornes de prix pour construire la barre de filtres */
  optionsFiltres(): Observable<OptionsFiltres> {
    return this.http.get<OptionsFiltres>('/api/menus/filtres');
  }

  /** Détail d'un menu (galerie, plats, allergènes). Erreur 404 s'il n'existe pas. */
  detail(id: number | string): Observable<MenuDetail> {
    // encodeURIComponent : l'id vient de l'URL du navigateur, on ne le colle pas tel quel
    return this.http.get<MenuDetail>(`/api/menus/${encodeURIComponent(id)}`);
  }
}

/**
 * Transforme les filtres en paramètres d'URL.
 * Seuls les nombres sont envoyés : une clé absente, null ou NaN
 * n'apparaît pas dans l'URL (= pas de filtre sur ce critère).
 */
export function versParametres(filtres: FiltresMenus): HttpParams {
  let parametres = new HttpParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (typeof valeur === 'number' && Number.isFinite(valeur)) {
      parametres = parametres.set(cle, String(valeur));
    }
  }
  return parametres;
}
