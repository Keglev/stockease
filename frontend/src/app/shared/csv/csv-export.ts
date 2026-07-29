/**
 * Builds and hands over CSV files entirely in the browser, from rows the page already holds. The
 * field and decimal separators follow the UI language rather than a fixed convention, because
 * German Excel reads a comma-separated file with dot decimals as one column; see ADR 023.
 */

import { InjectionToken } from '@angular/core';

import { SupportedLanguage } from '../../core/i18n/language.service';

const SEPARATORS: Record<SupportedLanguage, string> = { en: ',', de: ';' };

const LOCALES: Record<SupportedLanguage, string> = { en: 'en-US', de: 'de-DE' };

// Excel decides a file's encoding from its first bytes, and without this it reads UTF-8 umlauts
// in product and supplier names as mojibake. Built from the code point rather than written as a
// literal, which would be an invisible character in the source.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const LINE_ENDING = '\r\n';

/** Renders headers and rows as one CSV string, localized separators included. */
export function buildCsv(
  headers: string[],
  rows: (string | number | null)[][],
  lang: SupportedLanguage
): string {
  const separator = SEPARATORS[lang];
  const lines = [headers, ...rows].map((row) =>
    row.map((field) => quote(format(field, lang), separator)).join(separator)
  );

  return BYTE_ORDER_MARK + lines.join(LINE_ENDING) + LINE_ENDING;
}

/** Hands the built string to the browser as a download; there is no server round trip. */
export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type CsvDownloader = typeof downloadCsv;

// Injected rather than imported at the call site for the reason recorded in ADR 016 for the chart
// engine: a provider stub is per-TestBed, while mocking a module is shared with every other spec
// in the same Vitest worker.
export const CSV_DOWNLOADER = new InjectionToken<CsvDownloader>('CSV_DOWNLOADER', {
  providedIn: 'root',
  factory: () => downloadCsv
});

function format(field: string | number | null, lang: SupportedLanguage): string {
  if (field === null) {
    return '';
  }
  if (typeof field === 'number') {
    // Grouping is off on purpose: a thousands separator is itself a field separator in one of
    // the two locales, and the quoting would survive it but a spreadsheet import would not.
    return field.toLocaleString(LOCALES[lang], { useGrouping: false, maximumFractionDigits: 20 });
  }
  return field;
}

/** RFC 4180: a field carrying the separator, a quote or a newline is quoted, inner quotes doubled. */
function quote(field: string, separator: string): string {
  if (!field.includes(separator) && !field.includes('"') && !/[\r\n]/.test(field)) {
    return field;
  }
  return `"${field.replace(/"/g, '""')}"`;
}
