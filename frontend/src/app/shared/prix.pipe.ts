import { formatCurrency } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

/**
 * Affiche un prix en euros, au format français :
 *   390   → « 390 € »     (pas de « ,00 » inutile)
 *   71.5  → « 71,50 € »   (toujours 2 chiffres s'il y a des centimes)
 *
 * Utilisation : {{ menu.prix_minimum | prix }}
 */
@Pipe({ name: 'prix' })
export class PrixPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(valeur: number | null | undefined): string {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
      return '';
    }
    const chiffres = Number.isInteger(valeur) ? '1.0-0' : '1.2-2';
    return formatCurrency(valeur, this.locale, '€', 'EUR', chiffres);
  }
}
