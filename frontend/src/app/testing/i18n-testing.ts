import { Provider } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

export type TestTranslations = Record<string, object>;

/**
 * Wires ngx-translate to in-memory dictionaries so specs never hit the HTTP loader.
 * Keys absent from a dictionary render as the key itself, exactly as in production.
 */
export function provideTestTranslations(translations: TestTranslations): Provider[] {
  return provideTranslateService({
    loader: () => ({
      getTranslation: (lang: string) => of(translations[lang] ?? {})
    }),
    fallbackLang: 'en'
  });
}
