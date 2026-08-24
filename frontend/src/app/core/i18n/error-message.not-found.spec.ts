import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The not-found family (ADR 041's last). Seven codes, one sentence each, and every one asserted
 * in German and whole: the English keys mirror the wire sentences word for word once the
 * handler's "Entity not found: " prefix is stripped, so an English assertion would pass whether
 * or not the code was ever mapped. Nothing in this family is latent - all seven reach the wire -
 * so every one of them is a situation an operator can actually meet.
 *
 * The last case below sat under the generic-server comment in the undivided spec. It is a
 * not-found error whose id did not arrive, so it was co-located here with the family it tests.
 */
describe('ErrorMessageService - not found', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_customerNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Customer with ID 42 not found.', 404,
      'CUSTOMER_NOT_FOUND', { id: '42' });

    expect(service.resolve(error)).toBe('Kunde mit der ID 42 wurde nicht gefunden.');
  });

  it('resolve_invoiceNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Invoice with ID 7 not found.', 404,
      'INVOICE_NOT_FOUND', { id: '7' });

    expect(service.resolve(error)).toBe('Rechnung mit der ID 7 wurde nicht gefunden.');
  });

  it('resolve_invoiceItemNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Invoice item with ID 13 not found.', 404,
      'INVOICE_ITEM_NOT_FOUND', { id: '13' });

    expect(service.resolve(error)).toBe('Rechnungsposition mit der ID 13 wurde nicht gefunden.');
  });

  it('resolve_productNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Product with ID 5 not found.', 404,
      'PRODUCT_NOT_FOUND', { id: '5' });

    expect(service.resolve(error)).toBe('Produkt mit der ID 5 wurde nicht gefunden.');
  });

  it('resolve_softDeletedProductNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: No soft-deleted product with ID 9 found.', 404,
      'SOFT_DELETED_PRODUCT_NOT_FOUND', { id: '9' });

    expect(service.resolve(error)).toBe('Kein gelöschtes Produkt mit der ID 9 gefunden.');
  });

  it('resolve_supplierNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Supplier with ID 3 not found.', 404,
      'SUPPLIER_NOT_FOUND', { id: '3' });

    expect(service.resolve(error)).toBe('Lieferant mit der ID 3 wurde nicht gefunden.');
  });

  it('resolve_profitReportNotFound_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: No profit report for product with ID 42.', 404,
      'PROFIT_REPORT_NOT_FOUND', { id: '42' });

    expect(service.resolve(error)).toBe('Für das Produkt mit der ID 42 liegt kein Gewinnbericht vor.');
  });

  it('resolve_notFoundMissingItsId_fallsBackToTheServerMessage', () => {
    // The family's one param is the only part of the sentence that is not fixed prose, so a
    // response that lost it would render a hole where the id goes. The server's sentence still has
    // the value in place, which is why it wins - the same rule the other coded families follow.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Entity not found: Product with ID 5 not found.', 404,
      'PRODUCT_NOT_FOUND', undefined);

    expect(service.resolve(error)).toBe('Entity not found: Product with ID 5 not found.');
  });
});
