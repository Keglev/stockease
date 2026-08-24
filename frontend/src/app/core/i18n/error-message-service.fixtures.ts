import { TestBed } from '@angular/core/testing';

import { provideTestTranslations } from '../../testing/i18n-testing';
import { LanguageService } from './language.service';
import { ErrorMessageService } from './error-message.service';

/*
 * Scaffolding for the six resolver specs: error-message.service.spec.ts, which holds the
 * mechanism, and the five family specs beside it - error-message.invoice-state,
 * .entity-in-use, .movement, .invalid-request and .not-found.
 *
 * What lives here is what was never a test. The stub catalog below is the whole of the
 * scaffolding those specs share: every family asserts German sentences, so every family needs
 * the same two-language dictionary, and duplicating it six times would make a new key a
 * six-file edit. The setup helper is here for the same reason - one description of how the
 * service is built, rather than six copies drifting apart.
 *
 * The catalog is a literal and deliberately not the shipped one: these specs pin that a code
 * resolves to the sentence its key holds, not what today's copy of that sentence says. The
 * shipped text is pinned where it belongs, in translation-parity.spec.ts and at the surfaces
 * that render it.
 *
 * No hook registration belongs here. A beforeEach or afterEach registered outside a describe
 * block has been observed not to run for every spec under coverage, so a hook placed here would
 * silently protect nothing - which is why the helper below is a function each spec's own
 * beforeEach calls rather than a hook this module installs.
 */
export const TRANSLATIONS = {
  en: {
    common: {
      errors: {
        validationFailed: 'Validation failed. Please check your entries.',
        serverError: 'A server error occurred. Please try again later.'
      }
    },
    products: {
      errors: {
        duplicateName: "A product named '{{name}}' already exists.",
        duplicateSku: "A product with SKU '{{sku}}' already exists.",
        onOpenInvoice: "Cannot delete product '{{productName}}': it appears on an open invoice.",
        hasStock: "Cannot delete product '{{productName}}': {{quantity}} units are still in stock.",
        productNotFound: 'Product with ID {{id}} not found.',
        softDeletedProductNotFound: 'No soft-deleted product with ID {{id}} found.'
      }
    },
    suppliers: {
      errors: {
        hasOpenInvoices: "Cannot delete supplier '{{supplierName}}': open invoices exist.",
        supplierNameAndAddressRequired: 'Supplier name and address are required.',
        supplierNotFound: 'Supplier with ID {{id}} not found.'
      }
    },
    customers: {
      errors: {
        hasOpenInvoices: "Cannot delete customer '{{customerName}}': open invoices exist.",
        customerNotFound: 'Customer with ID {{id}} not found.'
      }
    },
    invoices: {
      type: {
        PURCHASE: 'Purchase',
        SALE: 'Sale'
      },
      errors: {
        duplicateNumber: "An invoice numbered '{{invoiceNumber}}' already exists.",
        notOpenForClose: 'Only open invoices can be closed.',
        returnRequiresClosed: 'Returns require a closed invoice.',
        returnExceedsReturnable:
          'Return of {{quantity}} exceeds remaining returnable quantity {{remaining}} '
          + 'for invoice item {{itemId}}.',
        alreadyPaid: 'Invoice is already marked as paid.',
        notOpenForDelete: 'Only open invoices can be deleted.',
        purchaseInvoicePartyMismatch: 'Purchase invoices require a supplier and no customer.',
        saleInvoicePartyMismatch: 'Sale invoices must not reference a supplier.',
        itemQuantityNotPositive: 'Item quantity must be positive.',
        invoiceNotFound: 'Invoice with ID {{id}} not found.',
        invoiceItemNotFound: 'Invoice item with ID {{id}} not found.'
      }
    },
    reports: {
      errors: {
        periodStartAfterEnd: 'The start of the period must not be after its end.',
        reportDaysNotPositive: 'Days must be positive.',
        profitReportNotFound: 'No profit report for product with ID {{id}}.'
      }
    },
    movements: {
      reason: {
        LOST: 'Lost',
        DESTROYED: 'Destroyed',
        PURCHASE: 'Purchase',
        SOLD: 'Sold',
        RETURN_FROM_CUSTOMER: 'Customer return',
        RETURNED_TO_SUPPLIER: 'Returned to supplier'
      },
      errors: {
        endpointReturnsOnly: 'This endpoint records returns only.',
        reasonNotStandalone:
          'PURCHASE and SOLD movements exist only through invoice closing; '
          + 'returns use the return endpoint.',
        lossRequiresRemark: 'LOST and DESTROYED movements require a remark.',
        requiresInvoiceItem: '{{reason}} movements require an invoice item.',
        remarkForbidden:
          'A remark explains a loss and must not be supplied for {{reason}} movements.',
        invoiceTypeMismatch:
          '{{reason}} movements must reference a {{requiredType}} invoice item.',
        invoiceOpen: 'Movements cannot be recorded against an open invoice.',
        itemProductMismatch: 'Invoice item {{invoiceItemId}} belongs to a different product.',
        quantityMismatch:
          'Movement quantity must equal the invoice item quantity ({{quantity}}).',
        alreadyRecorded:
          'A {{reason}} movement already exists for invoice item {{invoiceItemId}}.'
      }
    }
  },
  de: {
    common: {
      errors: {
        validationFailed: 'Validierung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.',
        serverError: 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      }
    },
    products: {
      errors: {
        duplicateName: 'Ein Produkt mit dem Namen „{{name}}“ existiert bereits.',
        duplicateSku: 'Ein Produkt mit der Artikelnummer „{{sku}}“ existiert bereits.',
        onOpenInvoice:
          "Produkt '{{productName}}' kann nicht gelöscht werden: Es steht auf einer offenen Rechnung.",
        hasStock:
          "Produkt '{{productName}}' kann nicht gelöscht werden: {{quantity}} Einheiten sind noch auf Lager.",
        productNotFound: 'Produkt mit der ID {{id}} wurde nicht gefunden.',
        softDeletedProductNotFound: 'Kein gelöschtes Produkt mit der ID {{id}} gefunden.'
      }
    },
    suppliers: {
      errors: {
        hasOpenInvoices:
          "Lieferant '{{supplierName}}' kann nicht gelöscht werden: Es existieren offene Rechnungen.",
        supplierNameAndAddressRequired: 'Name und Adresse des Lieferanten sind erforderlich.',
        supplierNotFound: 'Lieferant mit der ID {{id}} wurde nicht gefunden.'
      }
    },
    customers: {
      errors: {
        hasOpenInvoices:
          "Kunde '{{customerName}}' kann nicht gelöscht werden: Es existieren offene Rechnungen.",
        customerNotFound: 'Kunde mit der ID {{id}} wurde nicht gefunden.'
      }
    },
    invoices: {
      type: {
        PURCHASE: 'Einkauf',
        SALE: 'Verkauf'
      },
      errors: {
        duplicateNumber: 'Eine Rechnung mit der Nummer „{{invoiceNumber}}“ existiert bereits.',
        notOpenForClose: 'Nur offene Rechnungen können geschlossen werden.',
        returnRequiresClosed: 'Rücksendungen erfordern eine geschlossene Rechnung.',
        returnExceedsReturnable:
          'Die Rücksendung von {{quantity}} überschreitet die verbleibende '
          + 'rücksendbare Menge {{remaining}} für die Rechnungsposition {{itemId}}.',
        alreadyPaid: 'Die Rechnung ist bereits als bezahlt markiert.',
        notOpenForDelete: 'Nur offene Rechnungen können gelöscht werden.',
        purchaseInvoicePartyMismatch: 'Einkaufsrechnungen erfordern einen Lieferanten und keinen Kunden.',
        saleInvoicePartyMismatch: 'Verkaufsrechnungen dürfen sich nicht auf einen Lieferanten beziehen.',
        itemQuantityNotPositive: 'Die Positionsmenge muss positiv sein.',
        invoiceNotFound: 'Rechnung mit der ID {{id}} wurde nicht gefunden.',
        invoiceItemNotFound: 'Rechnungsposition mit der ID {{id}} wurde nicht gefunden.'
      }
    },
    reports: {
      errors: {
        periodStartAfterEnd: 'Der Beginn des Zeitraums darf nicht nach seinem Ende liegen.',
        reportDaysNotPositive: 'Die Anzahl der Tage muss positiv sein.',
        profitReportNotFound: 'Für das Produkt mit der ID {{id}} liegt kein Gewinnbericht vor.'
      }
    },
    movements: {
      reason: {
        LOST: 'Verlust',
        DESTROYED: 'Zerstört',
        PURCHASE: 'Einkauf',
        SOLD: 'Verkauf',
        RETURN_FROM_CUSTOMER: 'Kundenrücksendung',
        RETURNED_TO_SUPPLIER: 'Rücksendung an Lieferanten'
      },
      errors: {
        endpointReturnsOnly: 'Über diesen Endpunkt können nur Rücksendungen erfasst werden.',
        reasonNotStandalone:
          'Einkaufs- und Verkaufsbewegungen entstehen nur beim Schließen einer Rechnung; '
          + 'Rücksendungen werden über die Rücksendungsfunktion erfasst.',
        lossRequiresRemark: 'Verlustbewegungen erfordern einen Vermerk.',
        requiresInvoiceItem: 'Bewegungen vom Typ „{{reason}}“ erfordern eine Rechnungsposition.',
        remarkForbidden:
          'Ein Vermerk erklärt einen Verlust und darf für Bewegungen vom Typ „{{reason}}“ '
          + 'nicht angegeben werden.',
        invoiceTypeMismatch:
          'Bewegungen vom Typ „{{reason}}“ müssen sich auf eine Rechnungsposition vom Typ '
          + '„{{requiredType}}“ beziehen.',
        invoiceOpen: 'Bewegungen können nicht gegen eine offene Rechnung erfasst werden.',
        itemProductMismatch:
          'Die Rechnungsposition {{invoiceItemId}} gehört zu einem anderen Produkt.',
        quantityMismatch:
          'Die Bewegungsmenge muss der Menge der Rechnungsposition ({{quantity}}) entsprechen.',
        alreadyRecorded:
          'Für die Rechnungsposition {{invoiceItemId}} existiert bereits eine Bewegung '
          + 'vom Typ „{{reason}}“.'
      }
    }
  }
};


/**
 * Builds the service against the stub catalog, as each spec's own `beforeEach` does.
 *
 * @returns the resolver, with the language service initialised and English active
 */
export function setUpErrorMessageService(): ErrorMessageService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideTestTranslations(TRANSLATIONS)] });
  TestBed.inject(LanguageService).initialize().subscribe();
  return TestBed.inject(ErrorMessageService);
}
