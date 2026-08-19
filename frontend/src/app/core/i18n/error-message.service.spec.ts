import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { provideTestTranslations } from '../../testing/i18n-testing';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';

const TRANSLATIONS = {
  en: {
    products: {
      errors: {
        duplicateName: "A product named '{{name}}' already exists.",
        duplicateSku: "A product with SKU '{{sku}}' already exists."
      }
    },
    invoices: { errors: { duplicateNumber: "An invoice numbered '{{invoiceNumber}}' already exists." } }
  },
  de: {
    products: {
      errors: {
        duplicateName: 'Ein Produkt mit dem Namen \u201e{{name}}\u201c existiert bereits.',
        duplicateSku: 'Ein Produkt mit der Artikelnummer \u201e{{sku}}\u201c existiert bereits.'
      }
    },
    invoices: { errors: { duplicateNumber: 'Eine Rechnung mit der Nummer \u201e{{invoiceNumber}}\u201c existiert bereits.' } }
  }
};

/*
 * The single point at which a failure becomes a sentence: translated where the API named the
 * situation, and the server's own message everywhere else.
 * Out of scope: which surfaces call it - the dialog and invoice-create specs; how the code and
 * params reach the error - error.interceptor.spec.ts.
 */
describe('ErrorMessageService', () => {
  let service: ErrorMessageService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestTranslations(TRANSLATIONS)] });
    TestBed.inject(LanguageService).initialize().subscribe();
    service = TestBed.inject(ErrorMessageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_codedErrorWithItsParams_returnsTheTranslatedSentence', () => {
    const error = new ApiError('A product named \'Laptop\' already exists.', 409,
      'DUPLICATE_PRODUCT_NAME', { name: 'Laptop' });

    expect(service.resolve(error)).toBe("A product named 'Laptop' already exists.");
  });

  it('resolve_codedError_afterLanguageSwitch_returnsTheGermanSentence', () => {
    // The whole point of the mechanism: the same failure reads German without the server knowing.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('An invoice numbered \'RE-1\' already exists.', 409,
      'DUPLICATE_INVOICE_NUMBER', { invoiceNumber: 'RE-1' });

    expect(service.resolve(error)).toBe('Eine Rechnung mit der Nummer \u201eRE-1\u201c existiert bereits.');
  });

  it('resolve_codedErrorMissingItsParams_fallsBackToTheServerMessage', () => {
    // The template would render with a hole where the value goes; the server's sentence has it.
    const error = new ApiError('A product with SKU \'SKU-1\' already exists.', 409,
      'DUPLICATE_PRODUCT_SKU', undefined);

    expect(service.resolve(error)).toBe("A product with SKU 'SKU-1' already exists.");
  });

  it('resolve_unknownCode_fallsBackToTheServerMessage', () => {
    // A situation the API named after this build shipped: English beats a raw key.
    const error = new ApiError('Something the API named later.', 409, 'CODE_FROM_THE_FUTURE', { a: 'b' });

    expect(service.resolve(error)).toBe('Something the API named later.');
  });

  it('resolve_errorWithNoCode_fallsBackToTheServerMessage', () => {
    const error = new ApiError('Only open invoices can be closed.', 409, undefined, undefined);

    expect(service.resolve(error)).toBe('Only open invoices can be closed.');
  });

  it('resolve_plainError_fallsBackToItsMessage', () => {
    expect(service.resolve(new Error('Request failed. Please try again.')))
      .toBe('Request failed. Please try again.');
  });
});
