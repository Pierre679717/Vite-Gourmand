import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

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
    // Client HTTP pour appeler l'API (basé sur fetch, l'API moderne du navigateur)
    provideHttpClient(withFetch()),
  ],
};
