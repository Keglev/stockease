import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import {
  CustomerResponse,
  InvoiceSummaryResponse,
  PaginatedInvoices,
  SupplierResponse
} from '../../../core/api/api-models';
import { LanguageService } from '../../../core/i18n/language.service';
import { provideTestTranslations } from '../../../testing/i18n-testing';
import { CustomerService } from '../../customers/customer.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { InvoiceService } from '../invoice.service';
import { InvoiceListComponent } from './invoice-list.component';

const TRANSLATIONS = {
  en: {
    invoices: {
      title: 'Invoices',
      empty: 'No invoices found.',
      create: 'New invoice',
      paid: 'Paid',
      overdue: 'Overdue',
      walkIn: 'Walk-in sale',
      columns: {
        id: 'No.',
        invoiceNumber: 'Invoice number',
        type: 'Type',
        status: 'Status',
        counterparty: 'Counterparty',
        dueDate: 'Due date',
        createdAt: 'Created'
      },
      type: { PURCHASE: 'Purchase', SALE: 'Sale' },
      status: { OPEN: 'Open', CLOSED: 'Closed', FULLY_RETURNED: 'Fully returned' }
    }
  }
};

function invoice(overrides: Partial<InvoiceSummaryResponse>): InvoiceSummaryResponse {
  return {
    id: 1,
    invoiceNumber: 'RE-2026-0117',
    type: 'PURCHASE',
    status: 'OPEN',
    dueDate: '2026-03-01',
    supplierId: null,
    customerId: null,
    closedAt: null,
    paidAt: null,
    createdAt: '2026-01-02T03:04:00',
    ...overrides
  };
}

const SUPPLIERS: SupplierResponse[] = [
  { id: 7, name: 'Acme', address: '1 Main St', createdAt: '2026-01-02T03:04:00' }
];

const CUSTOMERS: CustomerResponse[] = [
  {
    id: 9,
    name: 'Jane Doe',
    email: null,
    phone: null,
    address: null,
    city: null,
    createdAt: '2026-01-02T03:04:00'
  }
];

/** Serves one page out of the given rows, recording what the component asked for. */
class InvoiceServiceStub {
  readonly requests: { page: number; size: number }[] = [];

  constructor(private readonly all: InvoiceSummaryResponse[]) {}

  getPagedInvoices(page: number, size: number): Observable<PaginatedInvoices> {
    this.requests.push({ page, size });
    const start = page * size;
    return of({
      content: this.all.slice(start, start + size),
      pageNumber: page,
      pageSize: size,
      totalElements: this.all.length,
      totalPages: Math.max(1, Math.ceil(this.all.length / size))
    });
  }
}

describe('InvoiceListComponent', () => {
  let fixture: ComponentFixture<InvoiceListComponent>;
  let invoiceService: InvoiceServiceStub;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowText(index: number): string {
    return host().querySelectorAll('tbody tr')[index].textContent ?? '';
  }

  async function setUp(invoices: InvoiceSummaryResponse[]): Promise<void> {
    invoiceService = new InvoiceServiceStub(invoices);
    await TestBed.configureTestingModule({
      imports: [InvoiceListComponent],
      providers: [
        provideRouter([]),
        provideTestTranslations(TRANSLATIONS),
        { provide: InvoiceService, useValue: invoiceService },
        { provide: SupplierService, useValue: { getAll: () => of(SUPPLIERS) } },
        { provide: CustomerService, useValue: { getAll: () => of(CUSTOMERS) } }
      ]
    }).compileComponents();

    TestBed.inject(LanguageService).initialize().subscribe();

    fixture = TestBed.createComponent(InvoiceListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    // Only Date is faked: the overdue predicate compares against today, and a test that reads the
    // real clock changes its answer at midnight. Timers stay real so nothing else is affected.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('load_invoicesReturned_rendersOneRowPerInvoice', async () => {
    await setUp([invoice({ id: 1 }), invoice({ id: 2 }), invoice({ id: 3 })]);

    expect(host().querySelectorAll('tbody tr').length).toBe(3);
  });

  it('counterparty_purchaseWithSupplierId_resolvesSupplierName', async () => {
    await setUp([invoice({ type: 'PURCHASE', supplierId: 7 })]);

    expect(rowText(0)).toContain('Acme');
  });

  it('counterparty_saleWithCustomerId_resolvesCustomerName', async () => {
    await setUp([invoice({ type: 'SALE', customerId: 9 })]);

    expect(rowText(0)).toContain('Jane Doe');
  });

  it('counterparty_bothIdsNull_rendersWalkInLabel', async () => {
    await setUp([invoice({ type: 'SALE' })]);

    expect(rowText(0)).toContain('Walk-in sale');
  });

  it('counterparty_unknownId_rendersHashedIdFallback', async () => {
    await setUp([invoice({ type: 'PURCHASE', supplierId: 404 })]);

    expect(rowText(0)).toContain('#404');
  });

  it('render_paidAtSet_showsPaidChip', async () => {
    await setUp([invoice({ paidAt: '2026-02-01T10:00:00' })]);

    expect(host().querySelectorAll('.paid-chip').length).toBe(1);
  });

  it('render_paidAtNull_omitsPaidChip', async () => {
    await setUp([invoice({ paidAt: null })]);

    expect(host().querySelectorAll('.paid-chip').length).toBe(0);
  });

  it('overdueChip_closedUnpaidPastDue_isRendered', async () => {
    await setUp([invoice({ status: 'CLOSED', paidAt: null, dueDate: '2026-03-01' })]);

    expect(host().querySelectorAll('.overdue-chip').length).toBe(1);
    expect(rowText(0)).toContain('Overdue');
  });

  it('overdueChip_closedButPaid_isAbsent', async () => {
    await setUp([
      invoice({ status: 'CLOSED', paidAt: '2026-03-02T10:00:00', dueDate: '2026-03-01' })
    ]);

    // Settled after the due date is not overdue; the debt is gone.
    expect(host().querySelectorAll('.overdue-chip').length).toBe(0);
  });

  it('overdueChip_openInvoicePastDue_isAbsent', async () => {
    await setUp([invoice({ status: 'OPEN', paidAt: null, dueDate: '2026-03-01' })]);

    // An open invoice is not booked yet, so it cannot be past due on the backend's definition.
    expect(host().querySelectorAll('.overdue-chip').length).toBe(0);
  });

  it('render_anyInvoice_showsItsNumberInItsOwnColumn', async () => {
    await setUp([invoice({ id: 1, invoiceNumber: 'RE-2026-0117' })]);

    // scoped to the cell, so the assertion cannot pass on some other part of the row
    const cell = host().querySelector('.invoice-number-cell');
    expect(cell?.textContent?.trim()).toBe('RE-2026-0117');
    expect(host().textContent).toContain('Invoice number');
  });

  it('render_statusValues_applyDistinctChipClasses', async () => {
    await setUp([
      invoice({ id: 1, status: 'OPEN' }),
      invoice({ id: 2, status: 'CLOSED' }),
      invoice({ id: 3, status: 'FULLY_RETURNED' })
    ]);

    expect(host().querySelectorAll('.status-open').length).toBe(1);
    expect(host().querySelectorAll('.status-closed').length).toBe(1);
    expect(host().querySelectorAll('.status-fully-returned').length).toBe(1);
  });

  it('render_anyRole_showsCreateButtonRoutedToNewPage', async () => {
    await setUp([invoice({ id: 1 })]);

    // Creation is not admin-gated: the backend permits hasAnyRole(ADMIN, USER).
    const create = host().querySelector<HTMLAnchorElement>('.invoice-create');
    expect(create).not.toBeNull();
    expect(create?.getAttribute('href')).toBe('/app/invoices/new');
  });

  it('load_firstRender_requestsTheFirstPageOfTen', async () => {
    await setUp([invoice({ id: 1 })]);

    expect(invoiceService.requests).toEqual([{ page: 0, size: 10 }]);
  });

  it('pageChange_event_requestsThatPage', async () => {
    await setUp(Array.from({ length: 25 }, (unused, index) => invoice({ id: index + 1 })));

    const page = fixture.componentInstance as unknown as {
      onPage: (event: { pageIndex: number; pageSize: number; length: number }) => void;
    };
    page.onPage({ pageIndex: 2, pageSize: 5, length: 25 });
    fixture.detectChanges();
    await fixture.whenStable();

    // server-side: the page change is a request, not a local slice
    expect(invoiceService.requests.at(-1)).toEqual({ page: 2, size: 5 });
  });

  it('load_pagedEnvelope_rendersOnlyThatPage', async () => {
    await setUp(Array.from({ length: 25 }, (unused, index) => invoice({ id: index + 1 })));

    // the table shows the page, and the paginator learns the ledger's true size from the envelope
    expect(host().querySelectorAll('tbody tr').length).toBe(10);
    expect(host().querySelector('mat-paginator')).not.toBeNull();
  });

  it('load_backendOrder_isRenderedUnchanged', async () => {
    await setUp([invoice({ id: 9 }), invoice({ id: 4 }), invoice({ id: 7 })]);

    const ids = Array.from(host().querySelectorAll('tbody tr')).map(
      (row) => row.querySelectorAll('td')[0].textContent?.trim()
    );
    expect(ids).toEqual(['9', '4', '7']);
  });
});
