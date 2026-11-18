import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuResume } from '../../core/models/menu';
import { MENU_GASTRO } from '../../core/models/menus-de-test';
import { MenuCard, texteStock } from './menu-card';

// Comme dans app.config.ts : prix au format français (« 390 € »)
registerLocaleData(localeFr);

describe('texteStock', () => {
  it('annonce le stock confortable', () => {
    expect(texteStock(10)).toBe('10 commandes encore possibles');
    expect(texteStock(4)).toBe('4 commandes encore possibles');
  });

  it('insiste quand il reste peu de commandes', () => {
    expect(texteStock(3)).toBe('Plus que 3 commandes possibles');
    expect(texteStock(1)).toBe('Plus qu’une commande possible');
  });

  it('signale un menu épuisé', () => {
    expect(texteStock(0)).toBe('Épuisé pour le moment');
  });
});

describe('MenuCard', () => {
  function afficher(menu: MenuResume, variante?: 'compacte'): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'fr-FR' }],
    });
    const fixture = TestBed.createComponent(MenuCard);
    fixture.componentRef.setInput('menu', menu);
    if (variante) {
      fixture.componentRef.setInput('variante', variante);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('affiche le titre, le minimum et le prix pour ce minimum', () => {
    const element = afficher(MENU_GASTRO);
    expect(element.querySelector('h2')?.textContent).toContain('Menu Gastronomique');
    expect(element.querySelector('.menu-carte__minimum')?.textContent).toContain('6 personnes');
    // Le format français met une espace insécable avant « € » : \s la reconnaît
    expect(element.querySelector('.menu-carte__prix')?.textContent).toMatch(/390\s€/);
    expect(element.querySelector('.menu-carte__prix')?.textContent).toContain('pour 6 pers.');
  });

  it('affiche le thème, le régime et le stock restant', () => {
    const element = afficher(MENU_GASTRO);
    expect(element.textContent).toContain('Évènement');
    expect(element.textContent).toContain('Classique');
    expect(element.querySelector('.menu-carte__stock')?.textContent).toContain('10 commandes');
  });

  it('pointe vers la page détail du menu', () => {
    const lien = afficher(MENU_GASTRO).querySelector('a');
    expect(lien?.getAttribute('href')).toBe('/menus/1');
  });

  it('affiche le badge « Épuisé » quand le stock est à 0', () => {
    const element = afficher({ ...MENU_GASTRO, quantite_restante: 0 });
    expect(element.querySelector('.badge--bordeaux')?.textContent).toContain('Épuisé');
  });

  it('variante compacte : pas de bouton, le titre est le lien', () => {
    const element = afficher(MENU_GASTRO, 'compacte');
    expect(element.querySelector('.btn')).toBeNull();
    expect(element.querySelector('h2 a')?.getAttribute('href')).toBe('/menus/1');
    expect(element.textContent).toContain('Dès 6 personnes');
  });
});
