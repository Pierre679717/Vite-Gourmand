import { TestBed } from '@angular/core/testing';
import { etapesFrise } from '../../espaces/utilisateur/mes-commandes/suivi-commande';
import { FriseSuivi } from './frise-suivi';

describe('FriseSuivi', () => {
  function rendre(etapes = etapesFrise([], 'en_attente', false)): HTMLElement {
    const fixture = TestBed.createComponent(FriseSuivi);
    fixture.componentRef.setInput('etapes', etapes);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('affiche chaque étape, datée si elle est franchie', () => {
    const page = rendre(
      etapesFrise(
        [
          { statut: 'en_attente', date: '2026-11-14 22:46:00' },
          { statut: 'accepte', date: '2026-11-14 22:47:05' },
        ],
        'accepte',
        true,
      ),
    );
    const etapes = page.querySelectorAll('li');
    // 2 franchies + préparation, livraison, livrée, retour du matériel, terminée
    expect(etapes.length).toBe(7);
    expect(etapes[1].classList).toContain('frise__etape--actuelle');
    expect(etapes[1].textContent).toContain('(étape actuelle)');
    expect(etapes[1].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-14T22:47:05');
    expect(etapes[1].querySelector('time')?.textContent).toContain('14/11/2026 à 22h47');
    expect(etapes[2].textContent).toContain('(à venir)');
    expect(etapes[2].querySelector('time')).toBeNull();
  });
});
