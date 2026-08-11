import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { LocalizedPaginatorIntl } from './core/i18n/localized-paginator-intl';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'en'
    }),
    // Returning the loader observable holds bootstrap until translations are in place,
    // so the login page never flashes raw translation keys.
    provideAppInitializer(() => inject(LanguageService).initialize()),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    // Material's paginator strings are hardcoded English with no pipe to reach them; this subclass
    // is the seam it offers.
    { provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl }
  ]
};
