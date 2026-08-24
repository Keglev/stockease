import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The five invoice-state situations (ADR 041 phase 3.2). Every one of them asserts in German,
 * and has to: the English keys mirror the wire sentences byte for byte, so an English assertion
 * would pass whether or not the code was ever mapped. Whole strings, because a substring match
 * would accept a sentence that lost the half carrying the meaning.
 */
describe('ErrorMessageService - invoice state', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_invoiceNotOpenForClose_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Only open invoices can be closed.', 409,
      'INVOICE_NOT_OPEN_FOR_CLOSE', undefined);

    expect(service.resolve(error)).toBe('Nur offene Rechnungen können geschlossen werden.');
  });

  it('resolve_returnRequiresClosedInvoice_inGerman_returnsTheTranslatedSentence', () => {
    // The guard this code names is currently unreachable from the app: an open invoice offers no
    // return button, so the request is never made. It is mapped anyway - an unused entry costs
    // nothing under the fallback design, and the client is ready should the backend order change.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Returns require a closed invoice.', 409,
      'RETURN_REQUIRES_CLOSED_INVOICE', undefined);

    expect(service.resolve(error)).toBe('Rücksendungen erfordern eine geschlossene Rechnung.');
  });

  it('resolve_returnExceedsReturnable_inGerman_interpolatesTheThreeValues', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError(
      'Return of 3 exceeds remaining returnable quantity 1 for invoice item 4.', 409,
      'RETURN_EXCEEDS_RETURNABLE', { quantity: '3', remaining: '1', itemId: '4' });

    expect(service.resolve(error)).toBe(
      'Die Rücksendung von 3 überschreitet die verbleibende rücksendbare Menge 1 '
      + 'für die Rechnungsposition 4.'
    );
  });

  it('resolve_invoiceAlreadyPaid_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Invoice is already marked as paid.', 409,
      'INVOICE_ALREADY_PAID', undefined);

    expect(service.resolve(error)).toBe('Die Rechnung ist bereits als bezahlt markiert.');
  });

  it('resolve_invoiceNotOpenForDelete_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError('Only open invoices can be deleted.', 409,
      'INVOICE_NOT_OPEN_FOR_DELETE', undefined);

    expect(service.resolve(error)).toBe('Nur offene Rechnungen können gelöscht werden.');
  });

  it('resolve_returnExceedsReturnableMissingRemaining_fallsBackToTheServerMessage', () => {
    // The only one of the five that interpolates. With a value missing the German template would
    // render a gap where the number goes, and the server's English sentence already has it.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError(
      'Return of 3 exceeds remaining returnable quantity 1 for invoice item 4.', 409,
      'RETURN_EXCEEDS_RETURNABLE', { quantity: '3', itemId: '4' });

    expect(service.resolve(error)).toBe(
      'Return of 3 exceeds remaining returnable quantity 1 for invoice item 4.'
    );
  });
});
