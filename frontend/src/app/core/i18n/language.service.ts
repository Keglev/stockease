import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'stockease.lang';

const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  private readonly current = signal<SupportedLanguage>(FALLBACK_LANGUAGE);

  readonly currentLang = this.current.asReadonly();

  /**
   * Resolves and applies the startup language. Returns the loader observable so app
   * initialization can wait for it and the first rendered page is already localized.
   */
  initialize(): Observable<unknown> {
    const lang = this.resolveInitialLanguage();
    this.persist(lang);
    this.current.set(lang);
    return this.translate.use(lang);
  }

  /** Unsupported values are ignored rather than silently resetting the user's choice. */
  setLanguage(lang: string): void {
    const supported = this.toSupported(lang);
    if (!supported) {
      return;
    }
    this.translate.use(supported);
    this.persist(supported);
    this.current.set(supported);
  }

  private resolveInitialLanguage(): SupportedLanguage {
    const stored = this.toSupported(this.readStored());
    if (stored) {
      return stored;
    }
    return this.translate.getBrowserLang()?.startsWith('de') ? 'de' : FALLBACK_LANGUAGE;
  }

  private toSupported(lang: string | null | undefined): SupportedLanguage | null {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
      ? (lang as SupportedLanguage)
      : null;
  }

  private readStored(): string | null {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persist(lang: SupportedLanguage): void {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Storage can be unavailable (private mode); the in-memory choice still applies.
    }
  }
}
