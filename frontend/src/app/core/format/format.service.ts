import { Injectable, computed, inject, signal } from '@angular/core';

import { LanguageService, SupportedLanguage } from '../i18n/language.service';

export const DATE_FORMATS = ['auto', 'dmyDot', 'mdySlash', 'ymdDash'] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export const NUMBER_FORMATS = ['auto', 'de', 'en'] as const;

export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export const FORMAT_DATE_KEY = 'stockease.format.date';
export const FORMAT_NUMBER_KEY = 'stockease.format.number';

/** The locale each language means when a preference is left on 'auto'. */
const LANGUAGE_LOCALES: Record<SupportedLanguage, string> = { en: 'en-US', de: 'de-DE' };

/** The order and separator each explicit date option pins, independent of any locale. */
const DATE_PATTERNS: Record<Exclude<DateFormat, 'auto'>, { order: ('day' | 'month' | 'year')[]; separator: string }> = {
  dmyDot: { order: ['day', 'month', 'year'], separator: '.' },
  mdySlash: { order: ['month', 'day', 'year'], separator: '/' },
  ymdDash: { order: ['year', 'month', 'day'], separator: '-' }
};

const CURRENCY = 'EUR';

/**
 * Renders dates and money the way the reader expects, at the moment of rendering.
 *
 * <p>The application registers no `LOCALE_ID` and no locale data, so every `| date` and
 * `| currency` in the app rendered en-US regardless of the interface language - a German reader
 * saw `12/31/2026` and `€1,234.56`. That is the defect this service closes. Registration would not
 * have closed it: `LOCALE_ID` is fixed at bootstrap while this app changes language at runtime
 * (ADR 015), and the format overrides below need a per-call decision point anyway (ADR 031).
 *
 * <p>Two preferences, each 'auto' by default and each stored per browser (ADR 030). 'auto' means
 * "follow the interface language"; an explicit date format pins the order and separators only,
 * while the time of day and the currency follow the effective number locale - a reader who wants
 * ISO dates has said nothing about wanting a dot as a decimal mark.
 */
@Injectable({ providedIn: 'root' })
export class FormatService {
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

  /** The date alone. Anything unparseable renders as nothing rather than "Invalid Date". */
  formatDate(value: Date | string | number | null | undefined): string {
    const date = toDate(value);
    if (!date) {
      return '';
    }
    const pattern = this.date();
    if (pattern === 'auto') {
      return formatter(this.numberLocale(), 'date').format(date);
    }
    return this.assemble(date, DATE_PATTERNS[pattern]);
  }

  /** The date followed by the time of day, which is what `| date: 'medium'` used to show. */
  formatDateTime(value: Date | string | number | null | undefined): string {
    const date = toDate(value);
    if (!date) {
      return '';
    }
    return `${this.formatDate(date)} ${formatter(this.numberLocale(), 'time').format(date)}`;
  }

  formatCurrency(value: number | string | null | undefined): string {
    const amount = typeof value === 'string' ? Number(value) : value;
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return '';
    }
    return currencyFormatter(this.numberLocale()).format(amount);
  }

  /**
   * A plain count or quantity - grouped, but with no currency attached.
   *
   * <p>`formatCurrency` was the only number this service rendered, so anything that is a count
   * rather than money had nowhere to go and reached the reader ungrouped and en-US-grouped by
   * turns. Units sold and stock levels are the callers: `1.234` in German is not `1,234`, and a
   * chart tick reading the wrong one misstates the figure by three orders of magnitude.
   */
  formatNumber(value: number | string | null | undefined): string {
    const amount = typeof value === 'string' ? Number(value) : value;
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return '';
    }
    return numberFormatter(this.numberLocale()).format(amount);
  }

  /**
   * A month key (`2026-01`) as the month and the year, which is what a timeline axis labels with.
   *
   * <p>It follows the number locale alone, as the time of day and the currency do. The date
   * overrides pin the ORDER of a day, a month and a year; a month and a year that reads as a word
   * has no order to pin, so there is nothing for them to say here.
   *
   * <p>Anything that is not a month key renders as itself rather than as nothing: this labels an
   * axis, and a tick that vanishes is worse than one showing the raw key it was built from.
   */
  formatMonth(value: string | null | undefined): string {
    const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
    if (!match) {
      return value ?? '';
    }
    // Assembled from the parts rather than parsed: `new Date('2026-01')` is UTC midnight, which
    // is the previous December for every reader west of Greenwich.
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return formatter(this.numberLocale(), 'month').format(date);
  }

  /**
   * A percentage stated the way a reader states it - `42.5` renders as `42,5 %` or `42.5%`.
   *
   * <p>Intl's percent style takes a fraction, so the division lives here. The alternative was every
   * caller dividing before the call, which would mean the gauge's dial ran 0-1 while its scale
   * still read 0-100.
   */
  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }
    return percentFormatter(this.numberLocale()).format(value / 100);
  }

  /**
   * Renders a date as one specific option would, whatever is currently selected.
   *
   * <p>Only the settings page calls these two: its option labels are live examples rather than
   * names, so it has to ask what an option it has *not* chosen would produce.
   */
  previewDate(pattern: Exclude<DateFormat, 'auto'>, value: Date): string {
    return this.assemble(value, DATE_PATTERNS[pattern]);
  }

  previewCurrency(locale: Exclude<NumberFormat, 'auto'>, value: number): string {
    return currencyFormatter(LANGUAGE_LOCALES[locale]).format(value);
  }

  /**
   * Builds an explicitly-ordered date from the parts a fixed formatter produces.
   *
   * <p>Assembled from parts rather than by string surgery on a locale's own output: the numerals
   * come from Intl, so an explicit order is still the same two digits a reader would otherwise see.
   */
  private assemble(date: Date, pattern: { order: ('day' | 'month' | 'year')[]; separator: string }): string {
    const parts = formatter('en-US', 'date').formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return pattern.order.map(value).join(pattern.separator);
  }
}

/**
 * One formatter per locale and style, built on first use.
 *
 * <p>Intl formatters are expensive to construct and cheap to reuse, and these are called once per
 * table cell - a page of a hundred rows would otherwise build a hundred identical formatters.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

const DATE_STYLES: Record<'date' | 'time' | 'month', Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: '2-digit', day: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
  month: { year: 'numeric', month: 'short' }
};

function formatter(locale: string, style: 'date' | 'time' | 'month'): Intl.DateTimeFormat {
  const key = `${locale}:${style}`;
  let cached = FORMATTERS.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, DATE_STYLES[style]);
    FORMATTERS.set(key, cached);
  }
  return cached;
}

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string): Intl.NumberFormat {
  let cached = CURRENCY_FORMATTERS.get(locale);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY });
    CURRENCY_FORMATTERS.set(locale, cached);
  }
  return cached;
}

const NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: string): Intl.NumberFormat {
  let cached = NUMBER_FORMATTERS.get(locale);
  if (!cached) {
    cached = new Intl.NumberFormat(locale);
    NUMBER_FORMATTERS.set(locale, cached);
  }
  return cached;
}

const PERCENT_FORMATTERS = new Map<string, Intl.NumberFormat>();

// One decimal, because the one caller rounds to one: a gauge reading 42.5% must not draw 43%.
function percentFormatter(locale: string): Intl.NumberFormat {
  let cached = PERCENT_FORMATTERS.get(locale);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    PERCENT_FORMATTERS.set(locale, cached);
  }
  return cached;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
