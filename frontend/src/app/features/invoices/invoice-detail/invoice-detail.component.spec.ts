import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { InvoiceResponse } from '../../../core/api/api-models';
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

class NotificationServiceStub {
  errors: string[] = [];

  success(): void {
    // Not exercised by these tests.
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

describe('InvoiceDetailComponent', () => {
  let fixture: ComponentFixture<InvoiceDetailComponent>;
  let notifications: NotificationServiceStub;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setUp(response: Observable<InvoiceResponse>): Promise<void> {
    notifications = new NotificationServiceStub();

    await TestBed.configureTestingModule({
      imports: [InvoiceDetailComponent],
      providers: [
        // Registered so the load-failure navigation resolves instead of rejecting mid-test.
        provideRouter([{ path: 'app/invoices', children: [] }]),
        provideTestTranslations(TRANSLATIONS),
        { provide: InvoiceService, useValue: { getById: () => response } },
        { provide: NotificationService, useValue: notifications },
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

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

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
});
