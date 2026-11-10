import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

// Règles d'affichage françaises (prix « 390,00 € », dates « 6 novembre 2026 »)
// utilisées par les pipes currency, number et date.
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Les paramètres d'URL (ex. :id d'un menu) arrivent directement en input() du composant
      withComponentInputBinding(),
      // Revenir en haut de la page à chaque navigation
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // Client HTTP pour appeler l'API (basé sur fetch, l'API moderne du navigateur),
    // avec l'intercepteur qui ajoute le JWT aux requêtes vers /api
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Langue et monnaie par défaut des pipes : {{ prix | currency }} → « 390,00 € »
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' },
  ],
};
