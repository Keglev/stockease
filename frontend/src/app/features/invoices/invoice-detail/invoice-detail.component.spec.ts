import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import {
  InvoiceResponse,
  InvoiceSummaryResponse,
  RegisterReturnRequest
} from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/interceptors/error.interceptor';
import { ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { MovementService } from '../../movements/movement.service';
import { InvoiceReturnDialogComponent } from '../invoice-return-dialog/invoice-return-dialog.component';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { InvoiceService } from '../invoice.service';
import { InvoiceDetailComponent } from './invoice-detail.component';

const TRANSLATIONS = {
  en: {
    invoices: {
      paid: 'Paid',
      walkIn: 'Walk-in sale',
      columns: { counterparty: 'Counterparty' },
      type: { PURCHASE: 'Purchase', SALE: 'Sale' },
      status: { OPEN: 'Open', CLOSED: 'Closed', FULLY_RETURNED: 'Fully returned' },
      detail: {
        title: 'Invoice',
        dueDate: 'Due date',
        createdAt: 'Created',
        closedAt: 'Closed',
        paidAt: 'Paid',
        items: 'Items',
        product: 'Product',
        quantity: 'Quantity',
        unitPrice: 'Unit price',
        returnedQty: 'Returned',
        lineTotal: 'Line total',
        total: 'Invoice total',
        back: 'Back to invoices'
      }
    }
  }
};

function detail(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: 1,
    invoiceNumber: 'RE-2026-0117',
    type: 'PURCHASE',
    status: 'OPEN',
    dueDate: '2026-03-01',
    supplierId: 7,
    supplierName: 'Acme',
    customerId: null,
    customerName: null,
    closedAt: null,
    paidAt: null,
    createdAt: '2026-01-02T03:04:00',
    items: [
      { id: 4, productId: 3, productName: 'Widget', quantity: 2, unitPrice: 15, returnedQty: 0 },
      { id: 5, productId: 6, productName: 'Gadget', quantity: 3, unitPrice: 10, returnedQty: 1 }
    ],
    ...overrides
  };
}

const SUMMARY: InvoiceSummaryResponse = {
  id: 1,
  invoiceNumber: 'RE-2026-0117',
  type: 'PURCHASE',
  status: 'CLOSED',
  dueDate: '2026-03-01',
  supplierId: 7,
  supplierName: 'Acme',
  customerId: null,
  customerName: null,
  closedAt: '2026-02-01T10:00:00',
  paidAt: null,
  createdAt: '2026-01-02T03:04:00'
};

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

class NotificationServiceStub {
  successes: string[] = [];
  errors: string[] = [];

  success(message: string): void {
    this.successes.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

/* Counts detail reads so the re-fetch behaviour after a lifecycle call can be asserted. */
class InvoiceServiceStub {
  getByIdCalls = 0;
  closeCalls: number[] = [];
  paidCalls: number[] = [];
  removeCalls: number[] = [];

  closeResult: Observable<InvoiceSummaryResponse> = of(SUMMARY);
  paidResult: Observable<InvoiceSummaryResponse> = of(SUMMARY);
  removeResult: Observable<string> = of('Invoice deleted.');

  constructor(private readonly detailResponse: Observable<InvoiceResponse>) {}

  getById(): Observable<InvoiceResponse> {
    this.getByIdCalls += 1;
    return this.detailResponse;
  }

  close(id: number): Observable<InvoiceSummaryResponse> {
    this.closeCalls.push(id);
    return this.closeResult;
  }

  markPaid(id: number): Observable<InvoiceSummaryResponse> {
    this.paidCalls.push(id);
    return this.paidResult;
  }

  remove(id: number): Observable<string> {
    this.removeCalls.push(id);
    return this.removeResult;
  }
}

class MatDialogStub {
  confirmed: boolean | undefined = true;
  returnResult: { quantity: number } | undefined = { quantity: 1 };
  /* Data of the last dialog opened, so the confirmation copy's parameters can be asserted. */
  lastData: ConfirmDialogData | undefined;

  /* The return dialog resolves to a quantity; the lifecycle confirmations resolve to a boolean. */
  open(component: unknown, config?: { data?: unknown }) {
    const isReturn = component === InvoiceReturnDialogComponent;
    if (!isReturn) {
      this.lastData = config?.data as ConfirmDialogData;
    }
    return { afterClosed: () => of(isReturn ? this.returnResult : this.confirmed) };
  }
}

class MovementServiceStub {
  returns: RegisterReturnRequest[] = [];
  result: Observable<unknown> = of({});

  registerReturn(request: RegisterReturnRequest): Observable<unknown> {
    this.returns.push(request);
    return this.result;
  }
}

/*
 * One invoice and what may be done to it: totals are computed from the lines, the counterparty is read
 * from the snapshot on the row, and which of close, mark-paid, delete and return are offered depends on
 * status, payment and role. Also that each rejection maps to the right message, by code where one is
 * carried.
 * Out of scope: the return quantity form (invoice-return-dialog.component.spec.ts) and the requests
 * (invoice.service.spec.ts).
 */
describe('InvoiceDetailComponent', () => {
  let fixture: ComponentFixture<InvoiceDetailComponent>;
  let notifications: NotificationServiceStub;
  let invoices: InvoiceServiceStub;
  let movements: MovementServiceStub;
  let dialog: MatDialogStub;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function setUp(
    response: Observable<InvoiceResponse>,
    role: 'ADMIN' | 'USER' = 'ADMIN'
  ): Promise<void> {
    notifications = new NotificationServiceStub();
    invoices = new InvoiceServiceStub(response);
    movements = new MovementServiceStub();
    dialog = new MatDialogStub();

    await TestBed.configureTestingModule({
      imports: [InvoiceDetailComponent],
      providers: [
        // Registered so the load-failure navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app/invoices', children: [] }]),
        provideTestTranslations(TRANSLATIONS),
        { provide: InvoiceService, useValue: invoices },
        { provide: MovementService, useValue: movements },
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
        { provide: AuthService, useValue: { role: () => role } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } }
        }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(InvoiceDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('load_invoiceWithItems_rendersOneRowPerItem', async () => {
    await setUp(of(detail()));

    expect(host().querySelectorAll('.items-table tbody tr').length).toBe(2);
    expect(host().textContent).toContain('Widget');
  });

  it('render_items_showsComputedLineTotals', async () => {
    await setUp(of(detail()));

    const lineTotals = Array.from(host().querySelectorAll('.line-total')).map((cell) =>
      cell.textContent?.trim()
    );
    // 2 x 15 and 3 x 10.
    expect(lineTotals[0]).toContain('30');
    expect(lineTotals[1]).toContain('30');
  });

  it('render_multipleItems_sumsInvoiceTotal', async () => {
    await setUp(of(detail()));

    expect(host().querySelector('.invoice-total-value')?.textContent).toContain('60');
  });

  it('counterparty_supplierNameOnResponse_isRenderedWithoutLookup', async () => {
    await setUp(of(detail()));

    expect(host().querySelector('.detail-counterparty')?.textContent).toContain('Acme');
  });

  it('counterparty_bothNamesNull_rendersWalkInLabel', async () => {
    await setUp(of(detail({ type: 'SALE', supplierId: null, supplierName: null })));

    expect(host().querySelector('.detail-counterparty')?.textContent).toContain('Walk-in sale');
  });

  it('render_nullClosedAtAndPaidAt_omitsThoseRows', async () => {
    await setUp(of(detail({ closedAt: null, paidAt: null })));

    expect(host().querySelector('.detail-closed')).toBeNull();
    expect(host().querySelector('.detail-paid')).toBeNull();
    expect(host().querySelector('.paid-chip')).toBeNull();
  });

  it('render_closedAtAndPaidAtSet_showsThoseRows', async () => {
    await setUp(of(detail({ closedAt: '2026-02-01T10:00:00', paidAt: '2026-02-02T10:00:00' })));

    expect(host().querySelector('.detail-closed')).not.toBeNull();
    expect(host().querySelector('.detail-paid')).not.toBeNull();
    expect(host().querySelector('.paid-chip')).not.toBeNull();
  });

  it('load_requestFails_notifiesWithInterceptorMessage', async () => {
    await setUp(throwError(() => new Error('Invoice not found.')));

    expect(notifications.errors).toEqual(['Invoice not found.']);
  });

  it('actions_adminWithOpenInvoice_showsCloseMarkPaidAndDelete', async () => {
    await setUp(of(detail({ status: 'OPEN', paidAt: null })));

    expect(host().querySelector('.action-close')).not.toBeNull();
    expect(host().querySelector('.action-paid')).not.toBeNull();
    expect(host().querySelector('.action-delete')).not.toBeNull();
  });

  it('actions_adminWithClosedUnpaidInvoice_showsMarkPaidOnly', async () => {
    await setUp(of(detail({ status: 'CLOSED', paidAt: null })));

    expect(host().querySelector('.action-close')).toBeNull();
    expect(host().querySelector('.action-paid')).not.toBeNull();
    expect(host().querySelector('.action-delete')).toBeNull();
  });

  it('actions_adminWithClosedPaidInvoice_showsNoActions', async () => {
    await setUp(of(detail({ status: 'CLOSED', paidAt: '2026-02-02T10:00:00' })));

    expect(host().querySelector('.action-close')).toBeNull();
    expect(host().querySelector('.action-paid')).toBeNull();
    expect(host().querySelector('.action-delete')).toBeNull();
  });

  it('actions_adminWithFullyReturnedUnpaidInvoice_showsMarkPaidOnly', async () => {
    await setUp(of(detail({ status: 'FULLY_RETURNED', paidAt: null })));

    expect(host().querySelector('.action-close')).toBeNull();
    expect(host().querySelector('.action-paid')).not.toBeNull();
    expect(host().querySelector('.action-delete')).toBeNull();
  });

  it('actions_nonAdminWithOpenInvoice_showsNoActions', async () => {
    await setUp(of(detail({ status: 'OPEN', paidAt: null })), 'USER');

    // Non-admins get no lifecycle affordance at all; the server enforces 403 regardless.
    expect(host().querySelector('.action-close')).toBeNull();
    expect(host().querySelector('.action-paid')).toBeNull();
    expect(host().querySelector('.action-delete')).toBeNull();
  });

  it('close_confirmed_callsServiceAndRefetchesDetail', async () => {
    await setUp(of(detail({ status: 'OPEN' })));
    const loadsBefore = invoices.getByIdCalls;

    host().querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle();

    expect(invoices.closeCalls).toEqual([1]);
    expect(notifications.successes).toEqual(['invoices.actions.closed']);
    expect(invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('close_insufficientStock_surfacesMessageAndStillRefetches', async () => {
    await setUp(of(detail({ status: 'OPEN' })));
    invoices.closeResult = throwError(() => new Error('Insufficient stock for product Widget.'));
    const loadsBefore = invoices.getByIdCalls;

    host().querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle();

    expect(notifications.errors).toEqual(['Insufficient stock for product Widget.']);
    // The close rolled back entirely, so the page is re-read to prove nothing changed.
    expect(invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('close_cancelled_callsNothing', async () => {
    await setUp(of(detail({ status: 'OPEN' })));
    dialog.confirmed = false;

    host().querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle();

    expect(invoices.closeCalls).toEqual([]);
  });

  it('markPaid_confirmed_callsServiceAndRefetchesDetail', async () => {
    await setUp(of(detail({ status: 'CLOSED', paidAt: null })));
    const loadsBefore = invoices.getByIdCalls;

    host().querySelector<HTMLButtonElement>('.action-paid')?.click();
    await settle();

    expect(invoices.paidCalls).toEqual([1]);
    expect(notifications.successes).toEqual(['invoices.actions.markedPaid']);
    expect(invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('delete_confirmed_notifiesBackendMessageAndNavigatesToList', async () => {
    await setUp(of(detail({ status: 'OPEN' })));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    host().querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle();

    expect(invoices.removeCalls).toEqual([1]);
    expect(notifications.successes).toEqual(['Invoice deleted.']);
    expect(navigate).toHaveBeenCalledWith(['/app/invoices']);
  });

  it('confirmClose_dialogOpened_namesTheInvoiceByNumber', async () => {
    await setUp(of(detail({ status: 'OPEN', invoiceNumber: 'RE-2026-0117' })));

    host().querySelector<HTMLButtonElement>('.action-close')?.click();
    await settle();

    expect(dialog.lastData?.messageKey).toBe('invoices.actions.closeConfirmMessage');
    expect(dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0117' });
  });

  it('confirmMarkPaid_dialogOpened_namesTheInvoiceByNumber', async () => {
    await setUp(of(detail({ status: 'CLOSED', paidAt: null, invoiceNumber: 'RE-2026-0118' })));

    host().querySelector<HTMLButtonElement>('.action-paid')?.click();
    await settle();

    expect(dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0118' });
  });

  it('confirmDelete_dialogOpened_namesTheInvoiceByNumber', async () => {
    await setUp(of(detail({ status: 'OPEN', invoiceNumber: 'RE-2026-0119' })));

    host().querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle();

    // A destructive prompt must state which invoice it is about to act on.
    expect(dialog.lastData?.messageParams).toEqual({ number: 'RE-2026-0119' });
  });

  it('returnAction_openInvoice_hidesReturnButton', async () => {
    await setUp(of(detail({ status: 'OPEN' })));

    // Returns require a closed invoice; the backend rejects them on an open one.
    expect(host().querySelectorAll('.item-return').length).toBe(0);
  });

  it('returnAction_fullyReturnedLine_hidesReturnButtonForThatLine', async () => {
    await setUp(
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

    expect(host().querySelectorAll('.item-return').length).toBe(1);
  });

  it('returnAction_closedInvoiceAsNonAdmin_showsReturnButton', async () => {
    await setUp(of(detail({ status: 'CLOSED' })), 'USER');

    // Returns are operational, not admin: the endpoint authorizes hasAnyRole(ADMIN, USER).
    expect(host().querySelectorAll('.item-return').length).toBe(2);
  });

  it('return_saleInvoice_postsReturnFromCustomerWithLineProductId', async () => {
    await setUp(of(detail({ status: 'CLOSED', type: 'SALE' })));
    dialog.returnResult = { quantity: 2 };

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(movements.returns).toEqual([
      { invoiceItemId: 4, productId: 3, reason: 'RETURN_FROM_CUSTOMER', quantity: 2 }
    ]);
  });

  it('return_purchaseInvoice_postsReturnedToSupplierWithLineProductId', async () => {
    await setUp(of(detail({ status: 'CLOSED', type: 'PURCHASE' })));
    dialog.returnResult = { quantity: 1 };

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(movements.returns).toEqual([
      { invoiceItemId: 4, productId: 3, reason: 'RETURNED_TO_SUPPLIER', quantity: 1 }
    ]);
  });

  it('return_success_refetchesDetail', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    const loadsBefore = invoices.getByIdCalls;

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.successes).toEqual(['invoices.returnDialog.registered']);
    // A full return flips the status server-side, which only a re-read can reveal.
    expect(invoices.getByIdCalls).toBe(loadsBefore + 1);
  });

  it('return_cancelled_postsNothing', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    dialog.returnResult = undefined;

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(movements.returns).toEqual([]);
  });

  it('typeChip_purchaseInvoice_carriesThePurchaseClass', async () => {
    await setUp(of(detail({ type: 'PURCHASE' })));

    // The same class the list picks for the same type: one invoice reads the same on both pages.
    expect(host().querySelector('.type-chip')?.classList.contains('type-purchase')).toBe(true);
  });

  it('typeChip_saleInvoice_carriesTheSaleClass', async () => {
    await setUp(of(detail({ type: 'SALE', supplierId: null, supplierName: null, customerId: 9 })));

    expect(host().querySelector('.type-chip')?.classList.contains('type-sale')).toBe(true);
  });

  it('return_rejected_surfacesMessageVerbatim', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    movements.result = throwError(() => new Error('Only 1 unit remains returnable.'));

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.errors).toEqual(['Only 1 unit remains returnable.']);
  });

  it('return_rejectedWithProductDeletedCode_showsTheDeletedProductNotification', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    // The failure is injected at the service seam, in the shape the interceptor produces: an
    // ApiError carrying the backend's own sentence, the 409, and the code that says which 409 it
    // is. The sentence is what must NOT reach the screen.
    movements.result = throwError(
      () =>
        new ApiError(
          "Cannot register a return for 'Widget': the product is deleted. "
            + 'Restore it first, then record the return.',
          409,
          'PRODUCT_DELETED'
        )
    );

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.errors).toEqual(['invoices.returnDialog.deletedProduct']);
  });

  it('return_rejectedWithInsufficientStockCode_showsTheStockNotification', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    // Same endpoint, same 409, opposite advice. Before the code existed this response produced the
    // deleted-product message, telling the operator to restore a product that was never deleted.
    movements.result = throwError(
      () =>
        new ApiError(
          'Adjustment of -2 would result in negative stock for product 3.',
          409,
          'INSUFFICIENT_STOCK'
        )
    );

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.errors).toEqual(['invoices.returnDialog.insufficientStock']);
  });

  it('return_rejectedWith409ButNoCode_fallsBackToTheBackendMessage', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    // The cap-exceeded conflict, which the API deliberately leaves uncoded. It must take the same
    // path every other unremarkable failure on this page takes rather than borrowing a message
    // written for a different situation.
    movements.result = throwError(
      () =>
        new ApiError(
          'Return of 2 exceeds remaining returnable quantity 1 for invoice item 4.',
          409
        )
    );

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.errors).toEqual([
      'Return of 2 exceeds remaining returnable quantity 1 for invoice item 4.'
    ]);
  });

  it('return_rejectedWithUnknownCode_fallsBackToTheBackendMessage', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));
    // Codes are added to responses that previously had none, so a client meets values it has never
    // heard of. An unknown code must read as "no code", not as a reason to show nothing useful.
    movements.result = throwError(
      () => new ApiError('Some future conflict.', 409, 'SOME_CODE_THIS_BUILD_HAS_NEVER_SEEN')
    );

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.errors).toEqual(['Some future conflict.']);
  });

  it('return_registeredSuccessfully_isUnaffectedByTheConflictMapping', async () => {
    await setUp(of(detail({ status: 'CLOSED' })));

    host().querySelector<HTMLButtonElement>('.item-return')?.click();
    await settle();

    expect(notifications.successes).toEqual(['invoices.returnDialog.registered']);
    expect(notifications.errors).toEqual([]);
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

  it('delete_rejected_surfacesMessageAndStaysOnPage', async () => {
    await setUp(of(detail({ status: 'OPEN' })));
    invoices.removeResult = throwError(() => new Error('Only open invoices can be deleted.'));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    host().querySelector<HTMLButtonElement>('.action-delete')?.click();
    await settle();

    expect(notifications.errors).toEqual(['Only open invoices can be deleted.']);
    expect(navigate).not.toHaveBeenCalled();
  });
});
