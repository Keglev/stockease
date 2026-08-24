import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The invalid-request family (ADR 041 phase 3.5). Twelve codes over thirteen backend throw
 * sites, none of them carrying params - every sentence in this family is fixed - so these cases
 * are whole-string German assertions and nothing more. Four of the twelve reach a client; the
 * eight latent ones are mapped so the sentence is ready if a constraint is relaxed, and two of
 * them are exercised here to show the mapping is real rather than declared.
 */
describe('ErrorMessageService - invalid request', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_purchaseInvoicePartyMismatch_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Purchase invoices require a supplier and no customer.', 400,
      'PURCHASE_INVOICE_PARTY_MISMATCH', undefined);

    expect(service.resolve(error))
      .toBe('Einkaufsrechnungen erfordern einen Lieferanten und keinen Kunden.');
  });

  it('resolve_saleInvoicePartyMismatch_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Sale invoices must not reference a supplier.', 400,
      'SALE_INVOICE_PARTY_MISMATCH', undefined);

    expect(service.resolve(error))
      .toBe('Verkaufsrechnungen dürfen sich nicht auf einen Lieferanten beziehen.');
  });

  it('resolve_periodStartAfterEnd_inGerman_returnsTheTranslatedSentence', () => {
    // One code for two backend throw sites - the reporting controller and the audit controller -
    // which is ruling R48 seen from the client: one key, one sentence, whichever raised it.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('The start of the period must not be after its end.', 400,
      'PERIOD_START_AFTER_END', undefined);

    expect(service.resolve(error))
      .toBe('Der Beginn des Zeitraums darf nicht nach seinem Ende liegen.');
  });

  it('resolve_reportDaysNotPositive_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Days must be positive.', 400,
      'REPORT_DAYS_NOT_POSITIVE', undefined);

    expect(service.resolve(error)).toBe('Die Anzahl der Tage muss positiv sein.');
  });

  it('resolve_supplierNameAndAddressRequired_inGerman_returnsTheTranslatedSentence', () => {
    // Latent on the wire: @NotBlank on both fields answers first. Mapped anyway (R45/R47), and
    // this is the one place the mapping is proved.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Supplier name and address are required.', 400,
      'SUPPLIER_NAME_AND_ADDRESS_REQUIRED', undefined);

    expect(service.resolve(error)).toBe('Name und Adresse des Lieferanten sind erforderlich.');
  });

  it('resolve_itemQuantityNotPositive_inGerman_returnsTheTranslatedSentence', () => {
    // The second latent one exercised here, from the invoices half of the family.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Item quantity must be positive.', 400,
      'ITEM_QUANTITY_NOT_POSITIVE', undefined);

    expect(service.resolve(error)).toBe('Die Positionsmenge muss positiv sein.');
  });

  /*
   * The shape refusal (ADR 041 phase 3.6). One situation the backend reaches three ways, and the
   * first key this service resolves under common.* rather than under a feature. German again, and
   * whole-string: the English key mirrors the wire sentence closely enough that an English
   * assertion would pass whether or not the code was ever mapped.
   */

  it('resolve_validationFailed_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Validation failed for request parameters.', 400,
      'VALIDATION_FAILED', undefined);

    expect(service.resolve(error))
      .toBe('Validierung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.');
  });
});
