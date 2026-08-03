import { TestBed } from '@angular/core/testing';

import { CSV_DOWNLOADER, buildCsv, downloadCsv } from './csv-export';

const HEADERS = ['Name', 'Value'];

/** Spelled by code point rather than written literally, which would be invisible in the source. */
const BOM = String.fromCharCode(0xfeff);

/** The data lines without the BOM, so assertions read the rows rather than the preamble. */
function lines(content: string): string[] {
  return content.slice(BOM.length).trimEnd().split('\r\n');
}

describe('buildCsv', () => {
  it('buildCsv_germanLocale_usesSemicolonAndCommaDecimals', () => {
    const csv = buildCsv(HEADERS, [['Möbel', 1234.5]], 'de-DE');

    // A semicolon file with dot decimals still breaks German Excel, so both follow the language.
    expect(lines(csv)[1]).toBe('Möbel;1234,5');
  });

  it('buildCsv_englishLocale_usesCommaAndDotDecimals', () => {
    const csv = buildCsv(HEADERS, [['Widget', 1234.5]], 'en-US');

    expect(lines(csv)[1]).toBe('Widget,1234.5');
  });

  it('buildCsv_fieldContainingSeparator_isQuoted', () => {
    const csv = buildCsv(HEADERS, [['Acme, Inc.', 5]], 'en-US');

    expect(lines(csv)[1]).toBe('"Acme, Inc.",5');
  });

  it('buildCsv_fieldContainingQuote_doublesInnerQuotes', () => {
    const csv = buildCsv(HEADERS, [['12" Bolt', 5]], 'en-US');

    expect(lines(csv)[1]).toBe('"12"" Bolt",5');
  });

  it('buildCsv_always_startsWithByteOrderMark', () => {
    const csv = buildCsv(HEADERS, [['Widget', 5]], 'en-US');

    // Without it Excel reads the UTF-8 umlauts in product names as mojibake.
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it('buildCsv_nullValue_writesEmptyField', () => {
    const csv = buildCsv(HEADERS, [['Widget', null]], 'en-US');

    expect(lines(csv)[1]).toBe('Widget,');
  });

  it('buildCsv_localeWithNoConfiguredSeparator_fallsBackToComma', () => {
    // Only en-US and de-DE are mapped. A third locale must still produce a readable file rather
    // than joining every field with `undefined`, which is what the ?? guards against.
    const csv = buildCsv(HEADERS, [['Widget', 1234.5]], 'fr-FR');

    expect(lines(csv)[0]).toBe('Name,Value');
    expect(lines(csv)[1]).toContain('Widget,');
  });
});

describe('downloadCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.fn>;
  let anchor: HTMLAnchorElement;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:stockease/1');
    revokeObjectURL = vi.fn();
    click = vi.fn();
    // Stubbed rather than exercised: jsdom has no object-URL store and a real click would try to
    // navigate. The unit under test is what the function asks the browser to do, in what order.
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    anchor = document.createElement('a');
    anchor.click = click as unknown as () => void;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloadCsv_anyContent_handsABlobToTheBrowserUnderTheGivenFilename', () => {
    downloadCsv('profit.csv', 'a,b\r\n');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    // The charset travels in the MIME type, not only in the BOM, because Excel consults both.
    expect(blob.type).toBe('text/csv;charset=utf-8;');
    expect(anchor.download).toBe('profit.csv');
    expect(anchor.href).toContain('blob:stockease/1');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloadCsv_afterClicking_revokesTheObjectUrl', () => {
    downloadCsv('profit.csv', 'a,b\r\n');

    // Leaking the URL would pin the whole file in memory for the life of the document, and the
    // revoke has to come after the click or the download never starts.
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stockease/1');
    expect(click.mock.invocationCallOrder[0]).toBeLessThan(
      revokeObjectURL.mock.invocationCallOrder[0]
    );
  });
});

describe('CSV_DOWNLOADER', () => {
  it('inject_withoutAnOverride_resolvesToTheRealDownloader', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    // The token exists so specs can swap the downloader per TestBed (ADR 016); production must
    // still get the real function without anyone providing it.
    expect(TestBed.inject(CSV_DOWNLOADER)).toBe(downloadCsv);
  });
});
