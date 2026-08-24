import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { TRANSLATIONS, setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The single point at which a failure becomes a sentence: translated where the API named the
 * situation, and the server's own message everywhere else.
 * Out of scope: which surfaces call it - the dialog and invoice-create specs; how the code and
 * params reach the error - error.interceptor.spec.ts.
 * This file holds the mechanism; the coded families live beside it, one file each, in
 * error-message.invoice-state, .entity-in-use, .movement, .invalid-request and .not-found.
 */
describe('ErrorMessageService', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
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

    expect(service.resolve(error)).toBe('Eine Rechnung mit der Nummer „RE-1“ existiert bereits.');
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

  /*
   * The generic server failure: the one sentence this service picks without the API having named a
   * situation. Asserted against the stub catalog entry rather than a literal, so these cases pin
   * that the branch resolves the key - not what today's copy happens to say.
   */

  it('resolve_uncodedServerError_returnsTheTranslatedGenericSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('An unexpected error occurred', 500, undefined, undefined);

    expect(service.resolve(error)).toBe(TRANSLATIONS.de.common.errors.serverError);
  });

  it('resolve_uncoded503_returnsTheSameGenericSentence', () => {
    // The boundary is "at or above 500", not "is 500": a gateway or an overloaded upstream answers
    // 502 and 503, and those are the same failure to the operator as the one the app raised itself.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Service unavailable.', 503, undefined, undefined);

    expect(service.resolve(error)).toBe(TRANSLATIONS.de.common.errors.serverError);
  });

  it('resolve_uncodedClientError_stillFallsBackToTheServerMessage', () => {
    // Below the boundary nothing changed: an uncoded 4xx says something specific about what the
    // caller sent, and the server's sentence is the only place that specific thing exists.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('That page is gone.', 404, undefined, undefined);

    expect(service.resolve(error)).toBe('That page is gone.');
  });

  it('resolve_unknownCodeAtServerError_stillFallsBackToTheServerMessage', () => {
    // The deliberate exclusion: a 5xx the API named with a code this build does not know keeps the
    // server's sentence, because that sentence is about the named situation rather than about
    // servers in general. Ruled, not an oversight.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('The ledger rejected the write.', 500, 'CODE_FROM_THE_FUTURE', undefined);

    expect(service.resolve(error)).toBe('The ledger rejected the write.');
  });
});
