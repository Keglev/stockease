import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-envelope';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';
import { setUpErrorMessageService } from './error-message-service.fixtures';

/*
 * The four deletion vetoes (ADR 041 phase 3.3, ruling R44). German again, and for the same reason
 * as the families above: the English keys mirror the wire sentences byte for byte, so an English
 * assertion would pass whether or not the code was ever mapped. Whole strings, values included.
 */
describe('ErrorMessageService - entity in use', () => {
  let service: ErrorMessageService;

  beforeEach(() => {
    service = setUpErrorMessageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolve_supplierHasOpenInvoices_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError("Cannot delete supplier 'Acme': open invoices exist.", 409,
      'SUPPLIER_HAS_OPEN_INVOICES', { supplierName: 'Acme' });

    expect(service.resolve(error))
      .toBe("Lieferant 'Acme' kann nicht gelöscht werden: Es existieren offene Rechnungen.");
  });

  it('resolve_customerHasOpenInvoices_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError("Cannot delete customer 'Jane Doe': open invoices exist.", 409,
      'CUSTOMER_HAS_OPEN_INVOICES', { customerName: 'Jane Doe' });

    expect(service.resolve(error))
      .toBe("Kunde 'Jane Doe' kann nicht gelöscht werden: Es existieren offene Rechnungen.");
  });

  it('resolve_productOnOpenInvoice_inGerman_returnsTheTranslatedSentence', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError("Cannot delete product 'Widget': it appears on an open invoice.", 409,
      'PRODUCT_ON_OPEN_INVOICE', { productName: 'Widget' });

    expect(service.resolve(error))
      .toBe("Produkt 'Widget' kann nicht gelöscht werden: Es steht auf einer offenen Rechnung.");
  });

  it('resolve_productHasStock_inGerman_interpolatesTheNameAndTheQuantity', () => {
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError("Cannot delete product 'Widget': 7 units are still in stock.", 409,
      'PRODUCT_HAS_STOCK', { productName: 'Widget', quantity: '7' });

    expect(service.resolve(error))
      .toBe("Produkt 'Widget' kann nicht gelöscht werden: 7 Einheiten sind noch auf Lager.");
  });

  it('resolve_productHasStockMissingQuantity_fallsBackToTheServerMessage', () => {
    // The only veto of the four carrying a second param. Without it the German template would render
    // a gap where the count goes, and the server's English sentence already has the number in place.
    TestBed.inject(LanguageService).setLanguage('de');
    const error = new ApiError("Cannot delete product 'Widget': 7 units are still in stock.", 409,
      'PRODUCT_HAS_STOCK', { productName: 'Widget' });

    expect(service.resolve(error))
      .toBe("Cannot delete product 'Widget': 7 units are still in stock.");
  });
});
