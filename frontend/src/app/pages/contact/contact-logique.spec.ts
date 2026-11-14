import { FormBuilder } from '@angular/forms';
import { champsContact, messageChampContact, versMessageContact } from './contact-logique';

const formulaire = (email = '') => new FormBuilder().nonNullable.group(champsContact(email));

describe('Formulaire de contact (règles)', () => {
  it('accepte un message valide et pré-remplit l’e-mail', () => {
    const f = formulaire('camille@exemple.fr');
    expect(f.controls.email.value).toBe('camille@exemple.fr');
    f.patchValue({ titre: 'Mariage', description: 'Un menu pour 80 personnes ?' });
    expect(f.valid).toBe(true);
  });

  it('mêmes limites que l’API : titre 3 à 100, message 10 à 2000 (espaces ignorés)', () => {
    const f = formulaire('a@b.fr');
    f.patchValue({ titre: '  ok  ', description: '   Bonjour   ' });
    expect(f.controls.titre.hasError('longueur')).toBe(true);
    expect(f.controls.description.hasError('longueur')).toBe(true);

    f.patchValue({ titre: 'a'.repeat(101), description: 'a'.repeat(2001) });
    expect(f.controls.titre.invalid).toBe(true);
    expect(f.controls.description.invalid).toBe(true);
  });

  it('e-mail avec un point obligatoire', () => {
    const f = formulaire('camille@exemple');
    expect(f.controls.email.invalid).toBe(true);
  });

  it('messages d’erreur', () => {
    expect(messageChampContact('titre', { required: true })).toBe(
      'Indiquez l’objet de votre message.',
    );
    expect(messageChampContact('description', { longueur: { min: 10, max: 2000 } })).toBe(
      'Entre 10 et 2000 caractères.',
    );
    expect(messageChampContact('email', { pattern: true })).toContain('adresse e-mail valide');
    expect(messageChampContact('titre', null)).toBeNull();
  });

  it('nettoie avant l’envoi', () => {
    expect(
      versMessageContact({
        titre: '  Mariage\n le 20 juin ',
        description: '\n Bonjour,\nmerci. \n',
        email: ' Camille@Exemple.FR ',
      }),
    ).toEqual({
      titre: 'Mariage le 20 juin',
      description: 'Bonjour,\nmerci.',
      email: 'camille@exemple.fr',
    });
  });
});
