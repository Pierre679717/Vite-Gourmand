import { FormBuilder } from '@angular/forms';
import { Profil } from '../models/utilisateur';
import { champsProfil, valeursDepuisProfil, versDonneesProfil } from './profil.validators';

function formulaire() {
  return new FormBuilder().nonNullable.group(champsProfil());
}

const VALIDE = {
  prenom: 'Camille',
  nom: 'Laurent',
  email: 'utilisateur@vite-gourmand.fr',
  telephone: '06 98 76 54 32',
  adresse_postale: "7 cours de l'Intendance",
  code_postal: '33000',
  ville: 'Bordeaux',
};

describe('Règles des informations personnelles', () => {
  it('accepte un profil valide (téléphone avec espaces ou points)', () => {
    const f = formulaire();
    f.setValue(VALIDE);
    expect(f.valid).toBe(true);
    f.controls.telephone.setValue('06.98.76.54.32');
    expect(f.controls.telephone.valid).toBe(true);
  });

  it('refuse un e-mail sans point, comme le serveur', () => {
    const f = formulaire();
    f.setValue({ ...VALIDE, email: 'camille@exemple' });
    expect(f.controls.email.hasError('pattern')).toBe(true);
  });

  it('refuse un téléphone ou un code postal mal formés', () => {
    const f = formulaire();
    f.setValue({ ...VALIDE, telephone: '06 12', code_postal: '3300' });
    expect(f.controls.telephone.invalid).toBe(true);
    expect(f.controls.code_postal.invalid).toBe(true);
  });

  it('limite les longueurs (nom 50, e-mail 100, adresse 255)', () => {
    const f = formulaire();
    f.setValue({
      ...VALIDE,
      nom: 'a'.repeat(51),
      email: 'a'.repeat(96) + '@b.fr',
      adresse_postale: 'a'.repeat(256),
    });
    expect(f.controls.nom.hasError('maxlength')).toBe(true);
    expect(f.controls.email.hasError('maxlength')).toBe(true);
    expect(f.controls.adresse_postale.hasError('maxlength')).toBe(true);
  });

  it('nettoie les valeurs avant l’envoi', () => {
    expect(
      versDonneesProfil({ ...VALIDE, prenom: ' Camille ', email: ' Camille@Exemple.FR ' }),
    ).toEqual({ ...VALIDE, telephone: '0698765432', email: 'camille@exemple.fr' });
  });

  it('pré-remplit depuis le profil (champ absent → vide)', () => {
    const profil = {
      id: 3,
      role: 'utilisateur',
      ...VALIDE,
      telephone: null,
      ville: null,
    } as unknown as Profil;
    expect(valeursDepuisProfil(profil)).toEqual({ ...VALIDE, telephone: '', ville: '' });
  });
});
