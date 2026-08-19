import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import {
  InvoiceResponse,
  InvoiceSummaryResponse,
  RegisterReturnRequest
} from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { MovementService } from '../../movements/movement.service';
import { InvoiceReturnDialogComponent } from '../invoice-return-dialog/invoice-return-dialog.component';
import { InvoiceService } from '../invoice.service';
import { InvoiceDetailComponent } from './invoice-detail.component';

/*
 * Response fixtures and the shared TestBed the invoice-detail specs build the page through, held
 * here under the shared-fixture rule because three spec files consume them.
 *
 * Constants, pure builders, and the configure function only. No beforeEach, afterEach, or any
 * other hook registration belongs here: hooks registered outside a describe block have been
 * observed not to run for every spec under coverage, so a hook placed here would silently protect
 * nothing. Nor does any `vi.*` call or `node:` import: this module is not a spec, so it is
 * compiled by tsconfig.app.json, which declares no types at all.
 */
export const TRANSLATIONS = {
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
      },
      errors: {
        returnExceedsReturnable:
          'Return of {{quantity}} exceeds remaining returnable quantity {{remaining}} '
          + 'for invoice item {{itemId}}.',
        alreadyPaid: 'Invoice is already marked as paid.'
      }
    }
  },
  /*
   * German carries only the error sentences, because they are the only strings these specs assert
   * after a language switch: a refusal that reads German is the proof the resolver ran, which an
   * English assertion cannot give when the English key mirrors the wire sentence byte for byte.
   * Everything else falls back to the English dictionary above, as it does in the shipped app.
   */
  de: {
    invoices: {
      errors: {
        returnExceedsReturnable:
          'Die Rücksendung von {{quantity}} überschreitet die verbleibende '
          + 'rücksendbare Menge {{remaining}} für die Rechnungsposition {{itemId}}.',
        alreadyPaid: 'Die Rechnung ist bereits als bezahlt markiert.'
      }
    }
  }
};

export function detail(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
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

export const SUMMARY: InvoiceSummaryResponse = {
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

export class NotificationServiceStub {
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
export class InvoiceServiceStub {
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

export class MatDialogStub {
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

export class MovementServiceStub {
  returns: RegisterReturnRequest[] = [];
  result: Observable<unknown> = of({});

  registerReturn(request: RegisterReturnRequest): Observable<unknown> {
    this.returns.push(request);
    return this.result;
  }
}

/** The rendered page and the four stubs a spec drives it through. */
export interface InvoiceDetailHarness {
  fixture: ComponentFixture<InvoiceDetailComponent>;
  invoices: InvoiceServiceStub;
  movements: MovementServiceStub;
  notifications: NotificationServiceStub;
  dialog: MatDialogStub;
}

/**
 * Builds the detail page over the given detail response and role, and answers with it and the
 * stubs it was wired with.
 *
 * <p>One function rather than a copy per spec file, so the runner sees one context configuration
 * across all of them: a difference here would fork the compilation the specs share.
 */
export async function configureInvoiceDetailTestBed(
  response: Observable<InvoiceResponse>,
  role: 'ADMIN' | 'USER' = 'ADMIN'
): Promise<InvoiceDetailHarness> {
  // The entry clear for all three consumers of this fixture, which is how each of them meets the
  // storage-isolation rule without repeating it.
  localStorage.clear();
  TestBed.resetTestingModule();

  const notifications = new NotificationServiceStub();
  const invoices = new InvoiceServiceStub(response);
  const movements = new MovementServiceStub();
  const dialog = new MatDialogStub();

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

  const fixture = TestBed.createComponent(InvoiceDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, invoices, movements, notifications, dialog };
}

export function host(fixture: ComponentFixture<InvoiceDetailComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

export async function settle(fixture: ComponentFixture<InvoiceDetailComponent>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}
