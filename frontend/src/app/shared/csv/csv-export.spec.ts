import { buildCsv } from './csv-export';

const HEADERS = ['Name', 'Value'];

/** Spelled by code point rather than written literally, which would be invisible in the source. */
const BOM = String.fromCharCode(0xfeff);

/** The data lines without the BOM, so assertions read the rows rather than the preamble. */
function lines(content: string): string[] {
  return content.slice(BOM.length).trimEnd().split('\r\n');
}

describe('buildCsv', () => {
  it('buildCsv_germanLocale_usesSemicolonAndCommaDecimals', () => {
    const csv = buildCsv(HEADERS, [['Möbel', 1234.5]], 'de');

    // A semicolon file with dot decimals still breaks German Excel, so both follow the language.
    expect(lines(csv)[1]).toBe('Möbel;1234,5');
  });

  it('buildCsv_englishLocale_usesCommaAndDotDecimals', () => {
    const csv = buildCsv(HEADERS, [['Widget', 1234.5]], 'en');

    expect(lines(csv)[1]).toBe('Widget,1234.5');
  });

  it('buildCsv_fieldContainingSeparator_isQuoted', () => {
    const csv = buildCsv(HEADERS, [['Acme, Inc.', 5]], 'en');

    expect(lines(csv)[1]).toBe('"Acme, Inc.",5');
  });

  it('buildCsv_fieldContainingQuote_doublesInnerQuotes', () => {
    const csv = buildCsv(HEADERS, [['12" Bolt', 5]], 'en');

    expect(lines(csv)[1]).toBe('"12"" Bolt",5');
  });

  it('buildCsv_always_startsWithByteOrderMark', () => {
    const csv = buildCsv(HEADERS, [['Widget', 5]], 'en');

    // Without it Excel reads the UTF-8 umlauts in product names as mojibake.
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it('buildCsv_nullValue_writesEmptyField', () => {
    const csv = buildCsv(HEADERS, [['Widget', null]], 'en');

    expect(lines(csv)[1]).toBe('Widget,');
  });
});
