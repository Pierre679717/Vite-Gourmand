import { FormControl, FormGroup } from '@angular/forms';
import { champsIdentiques, motDePasseFort } from './mot-de-passe.validators';

describe('Validateurs de mot de passe', () => {
  const verifier = (valeur: string) => motDePasseFort(new FormControl(valeur));

  it('accepte un mot de passe qui respecte toutes les règles', () => {
    expect(verifier('Client#Gourmand2026')).toBeNull();
  });

  it('ne signale rien pour un champ vide (géré par required)', () => {
    expect(verifier('')).toBeNull();
  });

  it('liste les critères manquants', () => {
    expect(verifier('abc')).toEqual({
      motDePasseFaible: { longueur: true, majuscule: true, chiffre: true, special: true },
    });
  });

  it('refuse un mot de passe sans caractère spécial', () => {
    expect(verifier('Gourmand2026')).toEqual({ motDePasseFaible: { special: true } });
  });

  it('refuse plus de 72 caractères (limite de bcrypt)', () => {
    expect(verifier('Aa1#' + 'x'.repeat(69))).toEqual({ motDePasseFaible: { longueur: true } });
  });

  it('détecte une confirmation différente', () => {
    const groupe = new FormGroup(
      {
        mot_de_passe: new FormControl('Client#Gourmand2026'),
        confirmation: new FormControl('autre'),
      },
      { validators: champsIdentiques('mot_de_passe', 'confirmation') },
    );
    expect(groupe.hasError('confirmationDifferente')).toBe(true);
    groupe.controls.confirmation.setValue('Client#Gourmand2026');
    expect(groupe.hasError('confirmationDifferente')).toBe(false);
  });
});
