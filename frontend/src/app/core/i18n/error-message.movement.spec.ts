import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The movement validation matrix (ADR 041 phase 3.4). German throughout, for the reason the
 * families above give: the English keys mirror the wire sentences, so an English assertion would
 * pass whether or not the code was ever mapped.
 *
 * Six of the sixteen are wire-reachable and are asserted here as whole sentences. The other ten
 * are latent by backend design (R45/R47) - mapped so the sentence is ready if a shadow moves, and
 * exercised here only where they carry a param the mechanism below needs to demonstrate.
 */
describe('ErrorMessageService - movement', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_movementEndpointReturnsOnly_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('This endpoint records returns only.', 400,
      'MOVEMENT_ENDPOINT_RETURNS_ONLY', undefined);

    expect(service.resolve(error))
      .toBe('Über diesen Endpunkt können nur Rücksendungen erfasst werden.');
  });

  it('resolve_movementReasonNotStandalone_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError(
      'PURCHASE and SOLD movements exist only through invoice closing; '
      + 'returns use the return endpoint.', 400, 'MOVEMENT_REASON_NOT_STANDALONE', undefined);

    expect(service.resolve(error)).toBe(
      'Einkaufs- und Verkaufsbewegungen entstehen nur beim Schließen einer Rechnung; '
      + 'Rücksendungen werden über die Rücksendungsfunktion erfasst.'
    );
  });

  it('resolve_lossRequiresRemark_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('LOST and DESTROYED movements require a remark.', 400,
      'LOSS_MOVEMENT_REQUIRES_REMARK', undefined);

    expect(service.resolve(error)).toBe('Verlustbewegungen erfordern einen Vermerk.');
  });

  it('resolve_movementInvoiceOpen_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Movements cannot be recorded against an open invoice.', 400,
      'MOVEMENT_INVOICE_OPEN', undefined);

    expect(service.resolve(error))
      .toBe('Bewegungen können nicht gegen eine offene Rechnung erfasst werden.');
  });

  /*
   * The enum-param capability (R46). The API sends reason and requiredType as raw tokens -
   * RETURN_FROM_CUSTOMER, SALE - because the token is the contract and the language is the
   * client's business. These four cases are the whole of that mechanism.
   */

  it('resolve_invoiceTypeMismatch_inGerman_translatesBothEnumTokensBeforeInterpolating', () => {
    // Both params are enums, and neither may reach the sentence as the shout it arrives as.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError(
      'RETURN_FROM_CUSTOMER movements must reference a SALE invoice item.', 400,
      'MOVEMENT_INVOICE_TYPE_MISMATCH', { reason: 'RETURN_FROM_CUSTOMER', requiredType: 'SALE' });

    expect(service.resolve(error)).toBe(
      'Bewegungen vom Typ „Kundenrücksendung“ müssen sich auf eine Rechnungsposition '
      + 'vom Typ „Verkauf“ beziehen.'
    );
  });

  it('resolve_itemProductMismatch_inGerman_interpolatesTheIdUntouched', () => {
    // A value param, not an enum: it is not in the translation table and must arrive verbatim.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Invoice item 7 belongs to a different product.', 400,
      'MOVEMENT_ITEM_PRODUCT_MISMATCH', { invoiceItemId: '7' });

    expect(service.resolve(error))
      .toBe('Die Rechnungsposition 7 gehört zu einem anderen Produkt.');
  });

  it('resolve_alreadyRecorded_inGerman_translatesTheEnumAndLeavesTheIdAlone', () => {
    // One sentence carrying both kinds of param, which is the distinction stated as a test.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('A SOLD movement already exists for invoice item 7.', 400,
      'MOVEMENT_ALREADY_RECORDED', { reason: 'SOLD', invoiceItemId: '7' });

    expect(service.resolve(error)).toBe(
      'Für die Rechnungsposition 7 existiert bereits eine Bewegung vom Typ „Verkauf“.'
    );
  });

  it('resolve_enumParamWithNoCatalogEntry_fallsBackToTheServerMessage', () => {
    // A reason this build has no word for. Interpolating the token would put an English shout in
    // the middle of a German sentence and rendering the key would be worse; English that is merely
    // English is the least bad of the three.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('SCRAPPED movements require an invoice item.', 400,
      'MOVEMENT_REQUIRES_INVOICE_ITEM', { reason: 'SCRAPPED' });

    expect(service.resolve(error)).toBe('SCRAPPED movements require an invoice item.');
  });

  it('resolve_movementMissingItsRequiredParam_fallsBackToTheServerMessage', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('A SOLD movement already exists for invoice item 7.', 400,
      'MOVEMENT_ALREADY_RECORDED', { reason: 'SOLD' });

    expect(service.resolve(error)).toBe('A SOLD movement already exists for invoice item 7.');
  });
});
