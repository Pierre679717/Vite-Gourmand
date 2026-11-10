import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { Avis } from '../../core/models/avis';
import { MenuResume } from '../../core/models/menu';
import { AvisService } from '../../core/services/avis.service';
import { MenuService } from '../../core/services/menu.service';
import { MenuCard } from '../../shared/menu-card/menu-card';
import { etoiles, menusDuMoment, moyenneNotes } from './accueil-logique';

/** undefined = chargement en cours, null = erreur, sinon les données */
type Chargement<T> = T | null | undefined;

/** Transforme une requête en signal : undefined pendant le chargement, null en cas d'erreur */
function charger<T>(requete: Observable<T>) {
  return toSignal<Chargement<T>, undefined>(requete.pipe(catchError(() => of(null))), {
    initialValue: undefined,
  });
}

/**
 * Page d'accueil (maquette « Accueil ») : présentation de Vite & Gourmand,
 * l'équipe, les menus du moment et les avis validés chargés depuis l'API.
 */
@Component({
  selector: 'app-accueil',
  imports: [RouterLink, DecimalPipe, NgTemplateOutlet, MenuCard],
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accueil {
  private readonly menuService = inject(MenuService);
  private readonly avisService = inject(AvisService);

  /** Tous les menus (pour « Voir les 10 menus ») */
  protected readonly menus = charger<MenuResume[]>(this.menuService.lister());
  /** Les 3 menus mis en avant */
  protected readonly menusDuMoment = computed(() => {
    const menus = this.menus();
    return menus ? menusDuMoment(menus) : menus;
  });

  /** Avis validés par un employé */
  protected readonly avis = charger<Avis[]>(
    this.avisService.listerValides().pipe(map((liste) => liste.slice(0, 3))),
  );
  protected readonly moyenne = computed(() => {
    const avis = this.avis();
    return avis ? moyenneNotes(avis) : null;
  });

  protected readonly etoiles = etoiles;
}
