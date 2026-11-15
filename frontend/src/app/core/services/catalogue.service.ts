import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Allergene,
  DonneesMenu,
  DonneesPlat,
  Horaire,
  MenuEdition,
  MenuGestion,
  OptionsMenu,
  PlatEdition,
  PlatGestion,
  ReponseCatalogue,
} from '../models/catalogue';

/**
 * Gestion du catalogue par l'employé : /api/employe/menus, /plats, /horaires.
 * Le serveur vérifie le rôle avec le token et revalide chaque donnée.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/employe';

  // ---- Menus -----------------------------------------------------------
  listerMenus(): Observable<MenuGestion[]> {
    return this.http.get<MenuGestion[]>(`${this.api}/menus`);
  }

  optionsMenu(): Observable<OptionsMenu> {
    return this.http.get<OptionsMenu>(`${this.api}/menus/options`);
  }

  menu(id: number): Observable<MenuEdition> {
    return this.http.get<MenuEdition>(`${this.api}/menus/${id}`);
  }

  creerMenu(donnees: DonneesMenu): Observable<ReponseCatalogue> {
    return this.http.post<ReponseCatalogue>(`${this.api}/menus`, donnees);
  }

  modifierMenu(id: number, donnees: DonneesMenu): Observable<ReponseCatalogue> {
    return this.http.put<ReponseCatalogue>(`${this.api}/menus/${id}`, donnees);
  }

  /** Retire le menu de la carte (false) ou l'y remet (true) */
  changerCarte(id: number, actif: boolean): Observable<ReponseCatalogue> {
    return this.http.put<ReponseCatalogue>(`${this.api}/menus/${id}/carte`, { actif });
  }

  supprimerMenu(id: number): Observable<ReponseCatalogue> {
    return this.http.delete<ReponseCatalogue>(`${this.api}/menus/${id}`);
  }

  // ---- Plats et allergènes ---------------------------------------------
  listerAllergenes(): Observable<Allergene[]> {
    return this.http.get<Allergene[]>(`${this.api}/allergenes`);
  }

  listerPlats(): Observable<PlatGestion[]> {
    return this.http.get<PlatGestion[]>(`${this.api}/plats`);
  }

  plat(id: number): Observable<PlatEdition> {
    return this.http.get<PlatEdition>(`${this.api}/plats/${id}`);
  }

  creerPlat(donnees: DonneesPlat): Observable<ReponseCatalogue> {
    return this.http.post<ReponseCatalogue>(`${this.api}/plats`, donnees);
  }

  modifierPlat(id: number, donnees: DonneesPlat): Observable<ReponseCatalogue> {
    return this.http.put<ReponseCatalogue>(`${this.api}/plats/${id}`, donnees);
  }

  supprimerPlat(id: number): Observable<ReponseCatalogue> {
    return this.http.delete<ReponseCatalogue>(`${this.api}/plats/${id}`);
  }

  // ---- Horaires (lecture publique) ---------------------------------------
  horaires(): Observable<Horaire[]> {
    return this.http.get<Horaire[]>('/api/horaires');
  }

  modifierHoraires(horaires: Horaire[]): Observable<ReponseCatalogue> {
    return this.http.put<ReponseCatalogue>(`${this.api}/horaires`, { horaires });
  }
}
