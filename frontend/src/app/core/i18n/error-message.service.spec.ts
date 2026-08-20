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
        duplicateSku: "A product with SKU '{{sku}}' already exists.",
        onOpenInvoice: "Cannot delete product '{{productName}}': it appears on an open invoice.",
        hasStock: "Cannot delete product '{{productName}}': {{quantity}} units are still in stock."
      }
    },
    suppliers: {
      errors: {
        hasOpenInvoices: "Cannot delete supplier '{{supplierName}}': open invoices exist."
      }
    },
    customers: {
      errors: {
        hasOpenInvoices: "Cannot delete customer '{{customerName}}': open invoices exist."
      }
    },
    invoices: {
      errors: {
        duplicateNumber: "An invoice numbered '{{invoiceNumber}}' already exists.",
        notOpenForClose: 'Only open invoices can be closed.',
        returnRequiresClosed: 'Returns require a closed invoice.',
        returnExceedsReturnable:
          'Return of {{quantity}} exceeds remaining returnable quantity {{remaining}} '
          + 'for invoice item {{itemId}}.',
        alreadyPaid: 'Invoice is already marked as paid.',
        notOpenForDelete: 'Only open invoices can be deleted.'
      }
    }
  },
  de: {
    products: {
      errors: {
        duplicateName: 'Ein Produkt mit dem Namen „{{name}}“ existiert bereits.',
        duplicateSku: 'Ein Produkt mit der Artikelnummer „{{sku}}“ existiert bereits.',
        onOpenInvoice:
          "Produkt '{{productName}}' kann nicht gelöscht werden: Es steht auf einer offenen Rechnung.",
        hasStock:
          "Produkt '{{productName}}' kann nicht gelöscht werden: {{quantity}} Einheiten sind noch auf Lager."
      }
    },
    suppliers: {
      errors: {
        hasOpenInvoices:
          "Lieferant '{{supplierName}}' kann nicht gelöscht werden: Es existieren offene Rechnungen."
      }
    },
    customers: {
      errors: {
        hasOpenInvoices:
          "Kunde '{{customerName}}' kann nicht gelöscht werden: Es existieren offene Rechnungen."
      }
    },
    invoices: {
      errors: {
        duplicateNumber: 'Eine Rechnung mit der Nummer „{{invoiceNumber}}“ existiert bereits.',
        notOpenForClose: 'Nur offene Rechnungen können geschlossen werden.',
        returnRequiresClosed: 'Rücksendungen erfordern eine geschlossene Rechnung.',
        returnExceedsReturnable:
          'Die Rücksendung von {{quantity}} überschreitet die verbleibende '
          + 'rücksendbare Menge {{remaining}} für die Rechnungsposition {{itemId}}.',
        alreadyPaid: 'Die Rechnung ist bereits als bezahlt markiert.',
        notOpenForDelete: 'Nur offene Rechnungen können gelöscht werden.'
      }
    }
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
   * The five invoice-state situations (ADR 041 phase 3.2). Every one of them asserts in German,
   * and has to: the English keys mirror the wire sentences byte for byte, so an English assertion
   * would pass whether or not the code was ever mapped. Whole strings, because a substring match
   * would accept a sentence that lost the half carrying the meaning.
   */
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
  /*
   * The four deletion vetoes (ADR 041 phase 3.3, ruling R44). German again, and for the same reason
   * as the families above: the English keys mirror the wire sentences byte for byte, so an English
   * assertion would pass whether or not the code was ever mapped. Whole strings, values included.
   */
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
