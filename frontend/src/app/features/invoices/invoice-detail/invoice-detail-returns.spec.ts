import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/api/api-envelope';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  configureInvoiceDetailTestBed,
  detail,
  host,
  InvoiceDetailHarness,
  settle
} from './invoice-detail.fixtures';

/*
 * Registering a return from the detail page: when a line offers the action at all, what the movement
 * it posts carries, and how a refusal reads - by code where the 409 carries one, by the backend's own
 * sentence where it does not. The two coded messages are then read out of the shipped locale files, so
 * the key assertions above are not vacuous about the words an operator sees.
 *
 * The collaborator is driven through the real detail page rather than constructed directly. It is a
 * component-scoped provider, and the flow under test starts at a button on a line and ends at a
 * notification; building it by hand would pin a wiring the spec invented rather than the one that
 * ships.
 * Out of scope: rendering and load (invoice-detail.component.spec.ts), the lifecycle actions
 * (invoice-detail-actions.spec.ts) and the return quantity form
 * (invoice-return-dialog.component.spec.ts).
 */
describe('InvoiceDetailReturns (through the detail page)', () => {
  let page: InvoiceDetailHarness;

  /*
   * Reads one invoices.returnDialog message out of a shipped locale file. Walks up from the working
   * directory so it resolves whether the runner starts in frontend/ or at the repository root, and
   * reads from disk rather than importing, because public/ sits outside the spec tsconfig's
   * rootDir - both for the reasons translation-parity.spec sets out.
   */
  function localeMessage(file: string, key: 'deletedProduct' | 'insufficientStock'): string {
    let dir = process.cwd();
    for (;;) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(join(dir, 'public', 'i18n', file), 'utf8'));
        return (parsed as { invoices: { returnDialog: Record<string, string> } }).invoices
          .returnDialog[key];
      } catch {
        const parent = dirname(dir);
        if (parent === dir) {
          throw new Error(`public/i18n/${file} not found above ${process.cwd()}`);
        }
        dir = parent;
      }
    }
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('returnAction_openInvoice_hidesReturnButton', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'OPEN' })));

    // Returns require a closed invoice; the backend rejects them on an open one.
    expect(host(page.fixture).querySelectorAll('.item-return').length).toBe(0);
  });

  it('returnAction_fullyReturnedLine_hidesReturnButtonForThatLine', async () => {
    page = await configureInvoiceDetailTestBed(
      of(
        detail({
          status: 'CLOSED',
          items: [
            { id: 4, productId: 3, productName: 'Widget', quantity: 2, unitPrice: 15, returnedQty: 2 },
            { id: 5, productId: 6, productName: 'Gadget', quantity: 3, unitPrice: 10, returnedQty: 1 }
          ]
        })
      )
    );

    expect(host(page.fixture).querySelectorAll('.item-return').length).toBe(1);
  });

  it('returnAction_closedInvoiceAsNonAdmin_showsReturnButton', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })), 'USER');

    // Returns are operational, not admin: the endpoint authorizes hasAnyRole(ADMIN, USER).
    expect(host(page.fixture).querySelectorAll('.item-return').length).toBe(2);
  });

  it('return_saleInvoice_postsReturnFromCustomerWithLineProductId', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED', type: 'SALE' })));
    page.dialog.returnResult = { quantity: 2 };

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.movements.returns).toEqual([
      { invoiceItemId: 4, productId: 3, reason: 'RETURN_FROM_CUSTOMER', quantity: 2 }
    ]);
  });

  it('return_purchaseInvoice_postsReturnedToSupplierWithLineProductId', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED', type: 'PURCHASE' })));
    page.dialog.returnResult = { quantity: 1 };

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.movements.returns).toEqual([
      { invoiceItemId: 4, productId: 3, reason: 'RETURNED_TO_SUPPLIER', quantity: 1 }
    ]);
  });

  it('return_success_refetchesDetail', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    const loadsBefore = page.invoices.getByIdCalls;

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.successes).toEqual(['invoices.returnDialog.registered']);
    // A full return flips the status server-side, which only a re-read can reveal.
    expect(page.invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('return_cancelled_postsNothing', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    page.dialog.returnResult = undefined;

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.movements.returns).toEqual([]);
  });

  it('return_rejected_surfacesMessageVerbatim', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    page.movements.result = throwError(() => new Error('Only 1 unit remains returnable.'));

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['Only 1 unit remains returnable.']);
  });

  it('return_rejectedWithProductDeletedCode_showsTheDeletedProductNotification', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    // The failure is injected at the service seam, in the shape the interceptor produces: an
    // ApiError carrying the backend's own sentence, the 409, and the code that says which 409 it
    // is. The sentence is what must NOT reach the screen.
    page.movements.result = throwError(
      () =>
        new ApiError(
          "Cannot register a return for 'Widget': the product is deleted. "
            + 'Restore it first, then record the return.',
          409,
          'PRODUCT_DELETED'
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['invoices.returnDialog.deletedProduct']);
  });

  it('return_rejectedWithInsufficientStockCode_showsTheStockNotification', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    // Same endpoint, same 409, opposite advice. Before the code existed this response produced the
    // deleted-product message, telling the operator to restore a product that was never deleted.
    page.movements.result = throwError(
      () =>
        new ApiError(
          'Adjustment of -2 would result in negative stock for product 3.',
          409,
          'INSUFFICIENT_STOCK'
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['invoices.returnDialog.insufficientStock']);
  });

  it('return_rejectedWith409ButNoCode_fallsBackToTheBackendMessage', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    // A 409 that arrives with no code at all. The wire sentence is the cap-exceeded one, which now
    // does carry a code - kept that way on purpose, so the case turns on the absent code and not on
    // the words. It must take the same path every other unremarkable failure on this page takes
    // rather than borrowing a message written for a different situation.
    page.movements.result = throwError(
      () =>
        new ApiError(
          'Return of 2 exceeds remaining returnable quantity 1 for invoice item 4.',
          409
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Return of 2 exceeds remaining returnable quantity 1 for invoice item 4.'
    ]);
  });

  it('return_rejectedWithExceedsReturnableCode_surfacesTheGermanSentenceWithItsValues', async () => {
    // The cap-exceeded conflict, uncoded when the case above it was written and coded as of ADR 041
    // phase 3. This surface has no advice of its own for it, so it takes the resolver layer: the
    // translated sentence with the server's three values interpolated into it. German, because the
    // English key mirrors the wire sentence byte for byte and so could not tell the two apart.
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    TestBed.inject(LanguageService).setLanguage('de');
    page.movements.result = throwError(
      () =>
        new ApiError(
          'Return of 3 exceeds remaining returnable quantity 1 for invoice item 4.',
          409,
          'RETURN_EXCEEDS_RETURNABLE',
          { quantity: '3', remaining: '1', itemId: '4' }
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Die Rücksendung von 3 überschreitet die verbleibende rücksendbare Menge 1 '
        + 'für die Rechnungsposition 4.'
    ]);
  });

  /*
   * The movement family reaches this surface too: the return endpoint runs the movement validation
   * matrix, and four of its wire-reachable refusals answer here (ADR 041 phase 3.4). This surface
   * has no advice of its own for any of them, so all four take the resolver layer.
   */
  it('return_rejectedWithInvoiceOpenCode_surfacesTheGermanSentence', async () => {
    // The guard that shadows RETURN_REQUIRES_CLOSED_INVOICE: the movement service refuses an open
    // invoice with its own 400 before the invoice module's 409 for the same state is reached, so
    // this is the code an operator actually meets and the one that has to read German.
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    TestBed.inject(LanguageService).setLanguage('de');
    page.movements.result = throwError(
      () =>
        new ApiError(
          'Movements cannot be recorded against an open invoice.',
          400,
          'MOVEMENT_INVOICE_OPEN',
          undefined
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Bewegungen können nicht gegen eine offene Rechnung erfasst werden.'
    ]);
  });

  it('return_rejectedWithTypeMismatchCode_translatesBothEnumTokensIntoTheGermanSentence', async () => {
    // The enum-param capability end to end (R46). The API sends RETURN_FROM_CUSTOMER and SALE as
    // raw tokens; what the operator reads is „Kundenrücksendung" and „Verkauf", which is the whole
    // point - a German sentence with an English shout inside it would read as a bug.
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    TestBed.inject(LanguageService).setLanguage('de');
    page.movements.result = throwError(
      () =>
        new ApiError(
          'RETURN_FROM_CUSTOMER movements must reference a SALE invoice item.',
          400,
          'MOVEMENT_INVOICE_TYPE_MISMATCH',
          { reason: 'RETURN_FROM_CUSTOMER', requiredType: 'SALE' }
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Bewegungen vom Typ „Kundenrücksendung“ müssen sich auf eine Rechnungsposition '
        + 'vom Typ „Verkauf“ beziehen.'
    ]);
  });

  it('return_rejectedWithItemProductMismatchCode_interpolatesTheIdIntoTheGermanSentence', async () => {
    // A value param beside the enum ones: the id is not in the translation table and reaches the
    // sentence exactly as the server sent it.
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    TestBed.inject(LanguageService).setLanguage('de');
    page.movements.result = throwError(
      () =>
        new ApiError(
          'Invoice item 4 belongs to a different product.',
          400,
          'MOVEMENT_ITEM_PRODUCT_MISMATCH',
          { invoiceItemId: '4' }
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Die Rechnungsposition 4 gehört zu einem anderen Produkt.'
    ]);
  });

  it('return_rejectedWithEndpointReturnsOnlyCode_surfacesTheGermanSentence', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    TestBed.inject(LanguageService).setLanguage('de');
    page.movements.result = throwError(
      () =>
        new ApiError(
          'This endpoint records returns only.',
          400,
          'MOVEMENT_ENDPOINT_RETURNS_ONLY',
          undefined
        )
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual([
      'Über diesen Endpunkt können nur Rücksendungen erfasst werden.'
    ]);
  });

  it('return_rejectedWithUnknownCode_fallsBackToTheBackendMessage', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));
    // Codes are added to responses that previously had none, so a client meets values it has never
    // heard of. An unknown code must read as "no code", not as a reason to show nothing useful.
    page.movements.result = throwError(
      () => new ApiError('Some future conflict.', 409, 'SOME_CODE_THIS_BUILD_HAS_NEVER_SEEN')
    );

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.errors).toEqual(['Some future conflict.']);
  });

  it('return_registeredSuccessfully_isUnaffectedByTheConflictMapping', async () => {
    page = await configureInvoiceDetailTestBed(of(detail({ status: 'CLOSED' })));

    host(page.fixture).querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle(page.fixture);

    expect(page.notifications.successes).toEqual(['invoices.returnDialog.registered']);
    expect(page.notifications.errors).toEqual([]);
  });

  it('deletedProductMessage_bothLocales_readAsTheShippedSentences', () => {
    // The component emits a key; what the operator reads is the value in the file the app fetches
    // at runtime. Asserting the shipped files - the technique translation-parity.spec uses, and
    // for the same reason - is what makes the specs above non-vacuous about the actual words.
    // Whole strings, both languages: a substring match would accept a message that dropped the
    // restore instruction, which is the only actionable half of it.
    expect(localeMessage('en.json', 'deletedProduct')).toBe(
      'This product is deleted and cannot take returns. Restore it first, then register the return.'
    );
    expect(localeMessage('de.json', 'deletedProduct')).toBe(
      'Dieses Produkt ist gelöscht und kann keine Retouren annehmen. '
        + 'Stellen Sie es zuerst wieder her, dann erfassen Sie die Retoure.'
    );
  });

  it('insufficientStockMessage_bothLocales_readAsTheShippedSentences', () => {
    // The distinguishing pair: this sentence and the one above must say different things, or the
    // code that separates them buys nothing. It names the stock level, not a restore, because the
    // product in this case is perfectly live.
    expect(localeMessage('en.json', 'insufficientStock')).toBe(
      'More units were returned than are in stock. '
        + 'Check the current stock level before returning these units.'
    );
    expect(localeMessage('de.json', 'insufficientStock')).toBe(
      'Es wurden mehr Einheiten retourniert, als auf Lager sind. '
        + 'Prüfen Sie den aktuellen Lagerbestand, bevor Sie diese Einheiten retournieren.'
    );
  });
});
