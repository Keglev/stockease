import { Injectable, computed, inject, signal } from '@angular/core';

import { LanguageService, SupportedLanguage } from '../i18n/language.service';

export const DATE_FORMATS = ['auto', 'dmyDot', 'mdySlash', 'ymdDash'] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export const NUMBER_FORMATS = ['auto', 'de', 'en'] as const;

export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export const FORMAT_DATE_KEY = 'stockease.format.date';
export const FORMAT_NUMBER_KEY = 'stockease.format.number';

/** The locale each language means when a preference is left on 'auto'. */
export const LANGUAGE_LOCALES: Record<SupportedLanguage, string> = { en: 'en-US', de: 'de-DE' };

/**
 * Owns the two formatting preferences: what they are, what they mean, and where they are kept.
 *
 * @remarks
 * Two preferences, each 'auto' by default and each stored per browser (ADR 030). 'auto' means
 * "follow the interface language"; an explicit date format pins the order and separators only,
 * while the time of day and the currency follow the effective number locale - a reader who wants
 * ISO dates has said nothing about wanting a dot as a decimal mark.
 *
 * A root-provided service rather than one of the store factories under `shared/`: those build
 * per-component state from a callback, while this holds one reader's choices for the whole
 * application. Two instances would give the settings page a different answer from the tables, and
 * it needs `LanguageService` to resolve 'auto', which a plain factory would have to be handed. The
 * precedent is `ThemeService` and `LanguageService`, which own a stored preference the same way.
 *
 * {@link FormatService} renders through these; nothing else reads them directly.
 */
@Injectable({ providedIn: 'root' })
export class FormatPreferencesService {
  private readonly language = inject(LanguageService);

  private readonly date = signal<DateFormat>(readStored(FORMAT_DATE_KEY, DATE_FORMATS, 'auto'));
  private readonly number = signal<NumberFormat>(
    readStored(FORMAT_NUMBER_KEY, NUMBER_FORMATS, 'auto')
  );

  readonly dateFormat = this.date.asReadonly();
  readonly numberFormat = this.number.asReadonly();

  /**
   * The locale every number, currency and time is rendered in.
   *
   * <p>Also what the CSV export reads: its field separator has to agree with the decimal mark, or
   * a German-formatted file with comma separators arrives in a spreadsheet as one column.
   */
  readonly numberLocale = computed(() => {
    const override = this.number();
    return override === 'auto'
      ? LANGUAGE_LOCALES[this.language.currentLang()]
      : LANGUAGE_LOCALES[override];
  });

  /** Unsupported values are ignored rather than silently resetting the reader's choice. */
  setDateFormat(value: string): void {
    const supported = toSupported(value, DATE_FORMATS);
    if (supported) {
      this.date.set(supported);
      persist(FORMAT_DATE_KEY, supported);
    }
  }

  setNumberFormat(value: string): void {
    const supported = toSupported(value, NUMBER_FORMATS);
    if (supported) {
      this.number.set(supported);
      persist(FORMAT_NUMBER_KEY, supported);
    }
  }
}

function toSupported<T extends string>(value: string, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    return toSupported(localStorage.getItem(key) ?? '', allowed) ?? fallback;
  } catch {
    // Storage can be unavailable (private mode); the default still applies.
    return fallback;
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // As above: the in-memory choice still applies for this session.
  }
}
