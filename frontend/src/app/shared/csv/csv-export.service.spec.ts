import { TestBed } from '@angular/core/testing';

import { FormatPreferencesService } from '../../core/format/format-preferences.service';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { CSV_DOWNLOADER } from './csv-export';
import { CsvExportService } from './csv-export.service';

const TRANSLATIONS = {
  en: { test: { col: { name: 'Name' } } },
  de: { test: { col: { name: 'Bezeichnung' } } }
};

/* Spelled by code point rather than written literally, which would be invisible in the source. */
const BOM = String.fromCharCode(0xfeff);

/* The data lines without the BOM, so assertions read the rows rather than the preamble. */
function lines(content: string): string[] {
  return content.slice(BOM.length).trimEnd().split('\r\n');
}

/*
 * The three things this service must resolve when the button is clicked rather than when the page
 * was built: the header keys through the interface language, the effective number locale, and the
 * filename it hands the downloader. Each case exports twice where the value can move, because a
 * cached header row or a locale read at construction passes a single-export assertion.
 * Out of scope: CSV rendering rules and the browser handover are csv-export.spec.ts's contract;
 * this spec only proves the service resolves language, locale and filename at call time.
 */
describe('CsvExportService', () => {
  let service: CsvExportService;
  let language: LanguageService;
  let preferences: FormatPreferencesService;
  let download: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    download = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTestTranslations(TRANSLATIONS),
        { provide: CSV_DOWNLOADER, useValue: download }
      ]
    });
    language = TestBed.inject(LanguageService);
    language.initialize().subscribe();
    preferences = TestBed.inject(FormatPreferencesService);
    service = TestBed.inject(CsvExportService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  /* The content of the nth call, which is what the browser would have received. */
  function contentOf(call: number): string {
    return download.mock.calls[call][1] as string;
  }

  it('export_headerKeys_resolveThroughTheInterfaceLanguage', () => {
    // Twice, in two languages: a header row resolved once at construction would satisfy the first
    // assertion and fail the second, which is the mistake this service exists to prevent.
    service.export('rows', ['name'], [['Widget']], 'test.col.');
    expect(lines(contentOf(0))[0]).toBe('Name');

    language.setLanguage('de');
    service.export('rows', ['name'], [['Widget']], 'test.col.');

    expect(lines(contentOf(1))[0]).toBe('Bezeichnung');
  });

  it('export_numberLocale_isReadAtCallTime', () => {
    // The whole row asserted, not only the decimal mark: the separator moves with the locale too,
    // and a file with German decimals and English separators opens as one column (ADR 023).
    service.export('rows', ['name'], [['Widget', 1234.5]], 'test.col.');
    expect(lines(contentOf(0))[1]).toBe('Widget,1234.5');

    preferences.setNumberFormat('de');
    service.export('rows', ['name'], [['Widget', 1234.5]], 'test.col.');

    expect(lines(contentOf(1))[1]).toBe('Widget;1234,5');
  });

  it('export_filename_isHandedToTheDownloaderUnchanged', () => {
    service.export('movements', ['name'], [['Widget']], 'test.col.');

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe('movements');
  });

  it('export_nullCell_reachesTheDownloaderAsAnEmptyField', () => {
    // A null is the honest empty cell rather than the string "null", which is what a reader would
    // meet in the spreadsheet if the service stringified it on the way past.
    service.export('rows', ['name'], [[null, 5]], 'test.col.');

    expect(lines(contentOf(0))[1]).toBe(',5');
  });
});
